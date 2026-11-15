# Connect an external location system

This desktop API accepts resolved Mars positions from a separate process. It works on Windows and Linux ARM64, including Raspberry Pi, without Internet access. It does not assume a particular NASA device or automatically convert Earth GPS/IMU data into Mars coordinates.

## Start the app with the local input API

Use the existing developer input listener. Before launching Atlas, set:

```text
MARS_ATLAS_DR_PORT=47831
MARS_ATLAS_DR_TOKEN=<a random 64-character hexadecimal token>
```

Generate the token locally with `python3 -c "import secrets; print(secrets.token_hex(32))"` (or your team's secure token generator). Give the client process the same environment variables. Quit the existing Atlas process and relaunch it with these variables. An already-running instance does not inherit new variables.

Example Linux launch, replacing the executable path:

```sh
export MARS_ATLAS_DR_PORT=47831
export MARS_ATLAS_DR_TOKEN="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
/path/to/atlas-executable
```

Example PowerShell launch after generating a token:

```powershell
$env:MARS_ATLAS_DR_PORT = '47831'
$env:MARS_ATLAS_DR_TOKEN = '<your random 64-hex-character token>'
& 'C:\path\to\Mars Field Atlas.exe'
```

The listener binds to **127.0.0.1 only**. Requests need `Authorization: Bearer <token>`. Do not put the token in URLs, screenshots or shared code. HTTP requests from browser pages are rejected; use the hardware application's native HTTP client or a small adapter process. These endpoints share the existing terrain, observation and dead-reckoning listener, but location fixes do not require starting or engaging a dead-reckoning run.

## Send a resolved position

`POST http://127.0.0.1:47831/v1/location/fixes`

```json
{
  "sourceId": "eva-nav-1",
  "frame": "mars-east-planetocentric",
  "point": [77.43, 18.44],
  "at": "2026-11-15T08:00:00.000Z",
  "accuracyMeters": 2.5
}
```

Send a current UTC timestamp; the timestamp above is only a format example. Coordinate order is **[east longitude, planetocentric latitude]**, both degrees. Longitude is −180…180 and latitude −90…90. The adapter must explicitly convert other coordinate conventions before submitting. Do not relabel Earth WGS84 positions as Mars positions. `accuracyMeters` is the device's reported nonnegative horizontal uncertainty; use `null` when unknown. Atlas does not independently certify that accuracy.

Include `Content-Type: application/json` and a `Content-Length` (ordinary native HTTP clients set it). The shared request-body limit is 256 KiB. IDs may contain letters, digits, underscores, dots and hyphens, up to 80 characters. At most 32 source IDs are kept per app session.

Responses:

- `200`: accepted, or an identical retry accepted with `duplicate: true`.
- `403`: incorrect/missing authorization, wrong host, or a browser-origin request.
- `409`: this source already provided the same/later timestamp with different data.
- `422`: invalid coordinates/frame/accuracy/time. Fixes older than one minute or over five seconds into the future are rejected; synchronize clocks.
- `503`: local input is busy/shutting down. Check status before retrying.

The latest fix for each source is held in memory. **Fresh** means within ten seconds, with up to five seconds of clock lead tolerated. Feed updates should arrive faster than that, for example once per second. Missing packets never cause extrapolation. On restart the feed starts empty, so an old fix cannot masquerade as a live position.

`GET /v1/location/status` returns `sources`, each with its source/time/point/accuracy and a `fresh` flag, plus `nowMs`, `frame` and `maxAgeSeconds`. It uses the same bearer token. After a timeout, read status and retry the identical sample only if needed.

## Mark a site

1. Open **Explore → My sites** or **Mark a site**.
2. Expand **Use external location system**.
3. Select the source if more than one system is sending positions. Review coordinates, UTC time and reported accuracy.
4. Choose **Use these coordinates**. The current fresh fix is copied once into the form.
5. Enter the site's name/notes and choose **Save site**. A marker is created on the maps and retained with personal sites and saved missions.

Sending a fix never creates or moves a saved site by itself. The saved site retains the selected source, timestamp and reported accuracy. Later feed updates do not move that marker. If the operator edits the copied coordinates, the source attribution is removed so manually edited coordinates are not presented as device measurements. Stale fixes cannot be copied through this control.

## Reference client

`tools/send_location_fix.py` uses Python's standard library. In a client terminal with the same port/token variables:

```sh
python3 tools/send_location_fix.py --lon 77.43 --lat 18.44 --source eva-nav-1 --accuracy 2.5
```

The script sends an explicitly supplied position. Replace those example coordinates with your detector's output; it does not operate any sensor itself. Import `send_fix([longitude, latitude], source_id, accuracy_meters)` into the detector's output loop, or implement the same authenticated JSON POST in C++, Rust, JavaScript or your existing SBC software. Raw readings still use the separate dead-reckoning adapter described in `DEAD_RECKONING.md`.

For a detector on a different SBC, use an authenticated tunnel to the Atlas host and forward a local client port to the Atlas loopback listener. Keep the same bearer token and coordinate schema. Direct unauthenticated LAN access is not enabled by this integration.

This is the application's documented interface, not an official NASA API or a tested integration with NASA hardware.

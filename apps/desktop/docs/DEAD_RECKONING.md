# Position and dead reckoning — source draft, 5 November 2026

## User workflow

Open **Desktop → Position / dead reckoning** after the map is ready. Enter east-positive longitude and planetocentric latitude, or move the map crosshair to a Mars surface point and choose **Use map crosshair as start**. Select an input mode/calibration, save the starting location, then **Engage dead reckoning**. Engage arms input; it does not start simulated movement or claim a device connection. Camera panning, walking-view controls and the planned route never supply movement data.

The yellow estimated trail and start/current markers appear in 3D, 2D and the overview. Existing route-planning overlays remain independent. **Use estimate as route start** is an explicit user action; it invokes the existing route planner without snapping the measured/estimated trail onto a planned path. A centre-on-estimate control and full JSON session export are available.

Pause stops accepting samples and preserves the trail. Resuming creates a new run identifier and resets packet sequencing for that run. If movement occurred while paused, supply a new known start rather than assuming continuity. A new starting location creates a new session; older sessions remain in the local session directory. Configuration changes require saving a new start. On app restart, sessions always restore paused and never automatically reconnect/engage. No extrapolation occurs when input stops. After ten seconds without accepted input, the UI reports stale data and the position remains frozen.

## Two integration paths

1. **Gear readings — app calculates position.** The present prototype adapters handle calibrated distance/heading (`motion`), integer incremental encoder ticks (`encoder`) with metres/tick, or incremental step counts (`steps`) with stride length. Heading is clockwise from Mars map north after device alignment; a user-configurable heading offset is applied. IMU-derived magnetic/relative yaw is not silently interpreted as Mars north.
2. **Ready positions — gear calculates position.** The app receives already calculated coordinates in its stated Mars frame, plots them and preserves the source-reported error bound, or unknown when absent.

Raw accelerometer and gyroscope fusion is **not implemented**. `kind: "imu"` is reserved and currently rejected without updating the position. Once the astronaut-worn prototype is ready, its axis frame, attitude/yaw reference, units, sensor bias, gravity compensation, timing, mounting alignment and stationary/motion detection must be specified before implementing that adapter. Do not double-integrate uncalibrated acceleration as though it were a reliable position.

The manual JSON panel and the opt-in local input API accept the same packets. A developer can run an adapter on the Atlas computer to read a sensor or device and submit updates over localhost.

The same source works on Windows and Raspberry Pi/Linux ARM64; no Pi hardware has been exercised. Earth prototype motion can provide calibrated local displacement for a bench simulation anchored on Mars. Earth GPS latitude/longitude must not be sent as Mars coordinates. An Earth-coordinate or local ENU-to-Mars alignment adapter remains future work with the location-detection system.

## Packet contract

Obtain the current `state` from `window.marsDesktop.deadReckoningStatus()` after setting a start and engaging. The UI's **Create packet template** fills the current identifiers. `window.marsDesktop.deadReckoningInput(samples)` accepts an array of 1–200 packets, up to 256 KiB. This bridge is available only to the app's trusted main frame, not to external pages or devices.

Every packet must contain:

| Field | Meaning |
| --- | --- |
| sessionId | UUID of the saved starting-location session |
| runId | Fresh UUID returned on Engage; old/paused runs cannot submit |
| sourceId | Exact source ID configured at the start |
| sequence | Increasing safe integer within the run; duplicates/backwards packets reject |
| timestampMs | UTC Unix milliseconds, after the run was engaged and later than the last track timestamp; at most five seconds ahead of the app clock |

Motion packet body:

```json
{"kind":"motion","distanceMeters":1.2,"headingDegrees":90,"headingReference":"map-north"}
```

Encoder packet body, in gear-reading mode with metres/tick configured:

```json
{"kind":"encoder","deltaTicks":24,"headingDegrees":90,"headingReference":"map-north"}
```

Step packet body, in gear-reading mode with stride configured:

```json
{"kind":"steps","deltaSteps":2,"headingDegrees":90,"headingReference":"map-north"}
```

Ready-position packet body, in ready-position mode:

```json
{"kind":"position","frame":"mars-east-planetocentric","point":[77.43002,18.44],"errorMeters":null}
```

These bodies must be combined with the common fields; they are not standalone packets. Distances/ticks are incremental, not cumulative counters. Signed motion distance and ticks support reverse travel; step counts are nonnegative increments. A first processed position may repeat the anchor before later movement. Device/app clock synchronization is required; recorded logs need an explicit replay/rebasing adapter, not timestamp spoofing presented as live data.

Packets with the wrong frame/source/run, duplicate/out-of-order sequence or time, invalid coordinates/calibration, movements beyond 1 km per packet or the configured plausible speed (default 10 m/s for gear modes) reject. Manual prototype samples are exempt from the speed test because they are explicitly entered movement examples. A submitted batch is applied to a candidate state and committed only if all packets validate.

## Local input API

The same listener exposes [terrain, routes, observations and environment](DEVELOPER_MAP_API.md).

Enable the developer input API by setting both `MARS_ATLAS_DR_PORT` and `MARS_ATLAS_DR_TOKEN` before launching the app. Choose a free port such as `47831`. Generate a token with `python -c "import secrets; print(secrets.token_hex(32))"`. Set the same values in the client process. Quit and relaunch any already running Atlas instance so the settings take effect. The listener binds only to `127.0.0.1` and works in Offline Mode. The Position / dead reckoning panel shows the listener status.

In Atlas, set a starting location and choose **Gear readings** or **Ready positions**. Configure the source ID and any calibration, then select **Engage**. The client can read the active run and submit data. The operator controls the starting point and pause/resume in Atlas.

- `GET /v1/dead-reckoning/status` returns the phase (`idle`, `ready`, `paused`, or `engaged`), input mode, current session/run/source IDs, coordinate frame, last accepted sequence, latest track timestamp, app clock and latest point/error. Before an initial sample the latest track timestamp comes from the anchor. Only submit while engaged in the intended mode with the expected source ID.
- `POST /v1/dead-reckoning/samples` takes a JSON array of 1â€“200 packets with a `Content-Length` and `Content-Type: application/json`. The body limit is 256 KiB. A `200` means the whole batch was accepted and saved. `422` means validation failed and the batch was rejected. After a timeout or `503`, read status before retrying. A response may be lost after a batch is saved. Match the run and last sequence before sending again so incremental movement is applied once.

Both endpoints require `Authorization: Bearer <token>`. A minimal Python client using the standard library:

```python
import json
import os
from urllib.request import Request, urlopen

port = int(os.environ["MARS_ATLAS_DR_PORT"])
base = f"http://127.0.0.1:{port}/v1/dead-reckoning"
token = os.environ["MARS_ATLAS_DR_TOKEN"]

def request(endpoint, samples=None):
    data = None if samples is None else json.dumps(samples).encode("utf-8")
    headers = {"Authorization": f"Bearer {token}"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    with urlopen(Request(base + endpoint, data=data, headers=headers), timeout=5) as response:
        return json.load(response)

state = request("/status")
# In your capture loop, attach state["sessionId"], state["runId"], and
# state["sourceId"] to each sample. Start at state["lastSequence"] + 1,
# include the UTC capture timestamp, and use a packet body from above.
# state = request("/samples", [sample])
```

Keep one submitting process per run and batch high rate input. When the run changes, discard pending samples from the previous run and wait for fresh readings. A sensor on another device can send readings to its adapter over the hardware link. The adapter runs on the same computer as Atlas and calls this API.


## Estimation, storage and limits

The horizontal integrator uses the app's Mars reference sphere, radius 3,396,190 metres, and spherical destination geometry. Longitude wraps at the dateline; polar operation beyond ±89.9° and per-packet distances over 1 km are not supported in this draft. There is no vertical inertial state, sensor fusion, absolute-position correction, route matching, collision avoidance or navigation certification.

Initial position, distance and heading error bounds are optional and unset by default. For app-computed travel, a displayed bound is available only when all assumptions are provided: previous bound + absolute distance × distance-error fraction + 2 × absolute distance × sin(heading-error-bound/2). This is a prototype geometric accumulation of user assumptions, not a calibrated confidence interval. For ready positions, the last device-supplied error bound is displayed. Missing/unobserved motion or clock gaps can invalidate these assumptions; stale input never implies the astronaut is stationary.

Up to 10,000 accepted track points per session are retained. The map decimates the display to approximately 1,000 vertices for load control, while export/local storage keep every accepted point. At capacity, pause/export and save a new start. Actual low-power performance has not been measured. A snapshot is saved per accepted UI operation/batch; high-rate sensor logging/fusion requires a future buffered adapter and must not write every raw IMU frame to the Pi's storage.

Files live under the app's per-user `dead-reckoning/latest.json` and `dead-reckoning/sessions/<session UUID>.json`. Writes are serialized and use temporary files/renames. Unreadable latest snapshots are not engaged and are moved to an app-owned invalid backup where possible. Track coordinates stay on the computer by default. The optional API listens only on loopback. User-chosen exports contain location history.

## Verification state

Eight automated behavior tests passed, covering movement, seam handling, calibration, error propagation, freshness/ordering, pause/restore and atomic batch rejection. In the Windows app, a manual Jezero start and 10 m eastward sample displayed the expected estimated position and trail; Pause was visible and stopped input. Raw IMU processing, real gear transports, actual Pi timing and hardware accuracy remain untested.

Before hardware use, validate known north/east/reverse movements, dateline/polar rejection, calibration/unit errors, duplicate and stale packets, atomic batch rejection, disconnect/re-engage/re-anchor behavior, error propagation, storage failure/recovery, no motion from camera controls, preserving the planned route, and real Pi sensor timing/latency. Define and test the raw IMU adapter with the prototype before accepting those raw measurements as position input.

## Independent resolved positions for site marking

A separate location-detection system can use `POST /v1/location/fixes` on the same listener without engaging a dead-reckoning run. This updates the source picker in Mark a site. The operator chooses whether to copy and save the position; no marker is created automatically. See [Location-system integration](LOCATION_SYSTEM_API.md).

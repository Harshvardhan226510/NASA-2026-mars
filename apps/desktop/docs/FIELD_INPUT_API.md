# Local field inputs

Open **APIs** in the top bar for the local address, connection instructions and endpoint schemas. Enable the listener before launch with `MARS_ATLAS_DR_PORT=47831` and a random 64-hex-character `MARS_ATLAS_DR_TOKEN`. Use a native client on the same host with `Authorization: Bearer <token>`. POST JSON using Content-Length and Content-Type application/json. The request limit is 256 KiB.

## Suit telemetry

Send a snapshot to **POST /v1/suit/telemetry**. Use a current UTC timestamp and a stable source and suit ID. Set `simulated` explicitly.

```json
{"sourceId":"plss-1","suitId":"eva-1","simulated":true,"at":"2026-11-15T08:00:00Z","metrics":{"oxygenPercent":74,"oxygenPartialPressureKPa":26,"suitPressureKPa":29,"carbonDioxidePartialPressureKPa":0.5,"batteryPercent":87,"coolantTempC":20,"heartRateBpm":96,"oxygenRemainingMinutes":94}}
```

Replace the example timestamp with the capture time. The top-bar **Telemetry** panel shows each suit's latest snapshot with units, source and freshness. Unreported metrics are unavailable. The latest snapshot is stale after 10 seconds. The app displays the instrument's reported oxygen time without estimating life-support duration. **GET /v1/suit/telemetry** returns the same snapshots plus the app clock and freshness window.

## Seismic events

Send an event to **POST /v1/seismic/events**. The submitting system supplies the epicentre and classification. Input consists of 2–4096 numeric samples of one ground-velocity component in µm/s and the corresponding sampling rate (0.1–1000 Hz). Include an optional magnitude when available.

```json
{"id":"event-004","sourceId":"seis-1","frame":"mars-east-planetocentric","point":[77.43,18.44],"at":"2026-11-15T08:00:00Z","kind":"marsquake","simulated":true,"sampleRateHz":20,"velocityMicrometersPerSecond":[0.02,0.1,-1.2,2.3,-1.5,0.4,0.05]}
```

Use **Telemetry → Seismic events → Locate and replay** to view the waveform and see an expanding pulse centred on the supplied coordinates. Pulse intensity follows relative waveform amplitude. Replay duration is bounded to 3–10 seconds for visibility, with illustrative ring distance. It does not estimate an epicentre, propagation speed or damage. **GET /v1/seismic/events** returns the 32 most recently added events. Both feeds are session-only and are cleared at app restart.

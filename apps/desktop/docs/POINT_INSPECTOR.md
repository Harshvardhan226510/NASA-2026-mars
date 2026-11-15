# Pyxis point inspector

Select **Inspect** in the top bar, then click or tap the Martian surface in 2D or 3D. Click another point to update the same report, use **Collapse** to keep just its coordinates, or press Escape to stop picking. Active route, measurement, and placement tools keep first use of map clicks. Crew markers also open a report at their last reported coordinate.

The inspector samples physical terrain from the existing desktop terrain service, prioritizing installed DEMs. It reports slopes and relief at the source grid scale. A terrain-shadow result requires a fine, continuous DEM for the sampled sunward line. A clear sampled line does not establish the absence of distant shadows.

Reference panels sample the original delivered cells for TES mineral fractions, shallow SWIM ice consistency, and Odyssey water-equivalent hydrogen, including published uncertainty where supported. Nearby science targets include distance to the catalogue centre and source provenance. The geology panel reads the existing USGS SIM 3292 product when a tile is available and its cartography identifies one unambiguous unit. Mineral and ice layers do not quantify accessible resources.

Environment distinguishes reported measurements near the point from dated, coarse NASA climate archive cells. Sunlight uses Mars24 at selection time. The Curiosity RAD record is historical instrument context from its own traverse. Local dose is unavailable from that record.

Imagery includes the bundled coarse overview, associated installed source tiles, online regional source tiles, and nearby catalogue-linked rover photos or panoramas. Mission context distinguishes instrument and crew fixes, historical rover localizations, planned equipment and camps, and modeled radio coverage.

**Plan route**, **Evaluate landing site**, **Evaluate base site**, and **Add waypoint** prefill the existing tools. **Compare locations** holds the current point as A and compares the next point as B. **Save observation** stores a named waypoint in the local observation library, with its coordinates and time. **Ask ARES** supplies the selected point and sourced context to the local assistant. If no local model is available, the assistant displays the report text.

## Crew location API

Use the same localhost authentication as the other [field inputs](FIELD_INPUT_API.md). The top-bar **APIs** guide lists both routes.

- `POST /v1/crew/locations` updates one named crew member. Provide `crewId`, `name`, `sourceId`, `frame`, `point`, `at`, and `simulated`. Optional `accuracyMeters` is reported horizontal uncertainty, or null when unknown.
- `GET /v1/crew/locations` returns `{frame, nowMs, maxAgeSeconds, crew}`, with each member’s latest fix and a `fresh` flag.

```json
{"crewId":"eva-1","name":"Field Lead","sourceId":"eva-nav-1","frame":"mars-east-planetocentric","point":[77.43,18.44],"at":"2026-11-15T08:00:00Z","simulated":true,"accuracyMeters":3.5}
```

Replace the example time with the fix’s UTC capture time. Coordinates are east longitude and planetocentric latitude in degrees, in that order. Use one source and one simulation flag per crew ID per app session. A repeated identical packet is safe. An out-of-order timestamp or conflicting source returns HTTP 409. The latest fix is fresh for ten seconds. Atlas retains stale fixes at their last reported position, labels them in the map and inspector, and clears them when the app restarts. The session supports up to 32 crew IDs. The API does not convert Earth GPS coordinates to Mars coordinates.

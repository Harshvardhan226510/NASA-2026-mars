# Upstream equipment planner and local atlas fixes

Integrated upstream `038af6ead12d9c44c7884541f5f3c6bdc7b44095` with local fixes `3b52e18baf8d2f783efaa34a514e216aca5efc46`, common ancestor `3e2984cef5f05f7d58a548685268483ed6922290`. This is a merge of the private fork's accessible main, not certification that the inaccessible original repository has no newer commits.

## Overlap decisions

| Area | Decision | Reason |
|---|---|---|
| Mission equipment planner | Retain upstream | Adds placement, fleet overview, equipment models, solar/weather connections, ARES commands and tests absent locally. |
| Model assets | Retain upstream byte-for-byte | Rebuilt all nine GLBs with the upstream generator; Git blob hashes match upstream. No proxy models substituted. |
| Direct/return routing | Retain local | Independent Dijkstra regressions establish minimum modeled strict-grid energy; searched-cell telemetry stays consistent. Return has its own details and legend. |
| Route rendering | Retain local | Terrain-following, display-only subpixel simplification and slim lines preserve visibility without forcing the user to disable relief. All profiles stay visible. |
| Endpoint markers | Adapt upstream idea | Mark actual searched grid endpoints in 2D and 3D. Retain exact science-target coordinates instead of snapping any target within 0.05 degrees to a route; that threshold can move an unreached target by kilometres. |
| Relief handling | Retain local preference | Remove upstream automatic relief disablement. Render equipment at displayed surface height; derive equipment measurements from physical DEM samples, not exaggerated geometry. |
| Science overlays, masks and overview | Retain local | Preserve coherent world-scale derivatives, local boundary transitions, genuine missing-source masks and overview sizing repairs. |
| 3D loading | Retain local | Keep bundled startup photography, nonblocking coarse terrain and movement-only refinement reduction. |
| Search spacing | Retain local | 50 m regional search cells with explicit disclosure of the coarser elevation source and bounded grid adaptation. |
| Horizon interface | Retain and extend local | Preserve the optional interface and add Equipment to its Plan workspace. |
| Equipment map wiring | Correct integration | Inject Leaflet explicitly for markers/drop placement; add the Horizon action; keep one solar-change notification route instead of duplicate callback/event updates. |
| Equipment inputs and claims | Clarify | Preserve valid zero elevation; use physical terrain where available; disclose assumed regional elevation and slope/aspect defaults. Call outputs scenario estimates, not measured hardware telemetry. |

## Validation

383 JavaScript tests and 28 Python tests pass. Production build passes, with the pre-existing large-bundle warning. Additional integration tests cover unchanged relief preference, physical-versus-displayed elevation, zero elevation, assumption labels, Leaflet marker placement, actual route endpoints and unchanged target coordinates. Original upstream source files in `routing/upstream` remain checksum-pinned.

No complete visual browser QA is claimed. Equipment engineering equations and hardcoded site assumptions are retained as scenarios; passing these tests is not hardware validation, a measured weather report, radio-link certification or astronaut route clearance. Original scientific imagery, cloud collectors and account allocations are untouched. No Vercel deployment is manually triggered by this integration.

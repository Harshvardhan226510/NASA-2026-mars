# Partner pathfinding integration

The round-trip budgets, station tasks, dated conditions, coverage audit, field
logging/replanning and geometric communications interface are documented in
[Marswalk workflow](docs/MARSWALK_WORKFLOW.md).

The Atlas runs Harshvardhan226510/mars-mapping's original Python engine at
commit `2d3713a2a44183a154e7d0e9fd15fef5a4500215`. The two files in
`routing/upstream/` are byte-for-byte copies of the partner's original
`algorithms/src/grid.py` and `algorithms/src/pathfinder.py`. Their SHA-256 hashes are in
`routing/upstream-source.json`; regression tests verify this attribution and
compare all three profiles with the original engine.

## What is preserved

- Eight-neighbour, energy-aware A*; the original heuristic and tie behaviour.
- Minetti walking-cost polynomial, gravity factor, suit/mass uphill penalty.
- Direct safe, APF proximity survey, and deep science expedition profiles.
- APF target priorities, sensor radius, attraction strength and discount cap.
- Exact permutations for checkpoint order using straight grid distances, then
  separate A* legs. This is the original ordering objective, not a new TSP solver.
- Original distance, ascent/descent, energy, calories, oxygen and priority-credit
  telemetry. User priorities are not measured mineral quantities.
- The original HTML canyon sandbox, unchanged, at
  `/partner-pathfinding-sandbox.html`. Its terrain is synthetic and kept separate
  from the real Mars globe. Its search demonstration remains available there.

## Explicit integration adaptations

`routing/adapters.py` subclasses the original engine. It adds a spherical
azimuthal-equidistant local grid with square metre cells; latitude/longitude
degrees cannot be treated as equal metre distances, especially near a pole.

The original greedy smoother returned from its corridor check after its first
step, so it could shortcut through a cliff. The adapter checks every crossed
grid cell. The APF curve filter also retains intermediate points if skipping
them would cross a blocked cell. The A* search and cost functions are unchanged.
Deep-science results explicitly report unreachable checkpoints rather than
silently implying that all selected checkpoints were visited.

Endpoints may be moved to the original engine's nearest walkable cell. The
response and UI disclose each endpoint's displacement, including grid rounding.
Requested A/B pins remain visible; the colored line shows actual route endpoints.

## Browser to server flow

1. Open **Routes** and place A/B. Nearby source-linked science, mineral and
   resource markers are included automatically within a default 5 km corridor
   around the endpoints and any manual checkpoints. Expand **Nearby sites of
   value** to change the radius or categories, exclude sites, or edit their
   priorities. This uses the full research catalogue, independently of display
   filters and hidden pin layers. Marker coordinates retain their published or
   approximate location basis; they are exploration stops, not surveyed outcrops.
   All catalogue stops begin at equal user priority 50, not an inferred scientific
   rank. Manual checkpoints reserve slots first; the nearest distinct catalogue
   locations fill the remaining slots up to six total, preserving the original
   exact permutation search. The panel reports omitted candidates. Colocated
   pins do not create duplicate visits. APF attraction still uses the selected
   sensor radius; deep science attempts to visit included stops. Direct safe
   remains the original terrain-cost comparison. Turning off nearby sites restores
   manual-only planning.
2. The browser includes all selected catalogue stops in the requested DEM area, preferring a prepared HiRISE DEM
   when the entire mission fits. Otherwise it uses validated HRSC/MOLA tiles.
   Source files remain in Drive; only the sampled window is transferred.
3. A metre grid adapts to available sampling and at most 513 x 513 cells.
   There is no fixed kilometre limit. The regional elevation pyramid level follows
   the actual calculation spacing, and only tiles touched by analysis nodes are
   loaded with three transfers at a time. Wrapped and polar areas use node
   coordinates rather than a longitude bounding-box tile sweep. Missing elevation stays blocked. Coarse global
   MOLA fallback alone is rejected for routing. No synthetic terrain substitutes
   for an unavailable source. Larger areas may use coarser cells; the UI and
   exports report requested versus actual spacing, area width, and projection
   scale distortion. These are broad-area estimates, not fine hazard surveys.
   A grid reaching its centre's antipode must be divided into sections because
   this projection is singular there. This is a geometry constraint, not a
   replacement distance cap.
4. `POST /api/route` runs the original Python engine for all three profiles.
5. Results appear together or individually in 3D, 2D and Compare. Save JSON for
   full telemetry or GeoJSON for geographic route lines and checkpoints. Actual
   catalogue stops, source links, location notes and user priorities survive
   mission save/restore and route exports. Layers
   can hide mission routes without deleting the plan.

`Try Jezero terrain` places a small example mission within an available prepared
DEM. These are user example checkpoints, not a claimed mission plan.

## Running and deployment

From `apps/web/` in the shared repository (or this standalone app directory):

```text
npm ci
python -m pip install -r requirements.txt
npm run dev
```

Use Python 3.12 or a compatible NumPy environment. Set `MARS_PYTHON` to the Python
executable if it is not on PATH. Existing read-only Drive API settings belong
in `.env.local` locally and Vercel environment settings in production. Never put
Drive credentials in browser source or commit `.env*` files.

Vercel Root Directory is `apps/web/` for the shared repository. `vercel.json` builds
Vite and exposes the existing Node APIs plus `api/route.py`. The Python function
uses `requirements.txt`, takes at most 4 MB of JSON and has a 300-second limit.
Colab is not required to use published map data or compute routes.

```text
npm test
python -m unittest discover -s tests -p test_routing.py -v
npm run build
```

## Accuracy and limits

The original model is preserved, not certified as an EVA planner. The original
heuristic/APF discount and subsequent smoothing do not guarantee a globally
optimal route. Metabolic and oxygen estimates are model outputs, not an
operational life-support budget. Regional DEMs cannot resolve small rocks,
cliffs below the sampling scale, soil strength, weather or radiation. Grid
slope limits do not establish astronaut safety. Display relief exaggeration
does not modify the route's source elevations.

The always-visible camera altitude HUD estimates shortest Cartesian distance
to sampled nearby terrain triangles, including slopes beside the nadir point.
It uses available HiRISE, HRSC/MOLA or overview MOLA heights, labels the source
and remains approximate. It is independent of the view-centre elevation and
the 2D distance scale. In 2D it labels the retained 3D camera explicitly.

## Repository boundaries

The web app lives under `apps/web/`. The Python prototype and shared datasets
live under `packages/`. Drive originals, personal account files, dependency folders and
deployment credentials are excluded. The checked-in source inventory and
small measured global fallback are application assets, not copies of the
multi-terabyte archives.

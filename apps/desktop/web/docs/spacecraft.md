# Spacecraft on Mars

Open **Spacecraft** above the map, or choose **Spacecraft · rovers & landers** in Explore. The directory contains 41 major vehicles and probes from the supplied research package: 25 surface objects and 16 current or historical orbiter records. It includes inactive hardware. It is not a complete debris inventory.

## What is implemented

- 15 sourced surface markers in 3D, 2D and the overview. Different symbols distinguish rovers, landers, helicopter and impact debris. Nearby 3D markers cluster; labels appear on closer views.
- Search, surface/orbiter scope, vehicle-type filters, source-linked details and fly-to-location controls. Links to landing-site vicinities are explicitly separate from unverified final rover positions.
- A Spacecraft checkbox in Layers. Hiding all layers also hides spacecraft and their recorded tracks; selecting a spacecraft enables its layer.
- NASA current-position adapters for Curiosity, Perseverance and Ingenuity. Server-side single-flight refresh, six-hour caching, 15-minute retry after failure, and a dated bundled fallback. The browser checks on load, every six visible hours, and on request. No user credentials or API key are needed.
- Lazy recorded paths for Curiosity, Perseverance, Ingenuity, Spirit and Opportunity. Paths preserve separate source segments and discontinuities. Repeated stationary coordinates are removed and connected segments joined without bridging gaps. These historical track files are snapshots, with independent source dates; they do not claim continuous current tracking.
- 12 NASA GLB assets, pinned source hashes, source pages and credits, including orbiter reference models. Models can be inspected in a separate menu 3D view. Eight sourced surface spacecraft now appear automatically in the 3D/Compare terrain view when detailed local CTX is available. Models are downloaded only for nearby visible spacecraft, or an explicit View 3D model on map request.
- Deep links such as `/#spacecraft=perseverance`.

## Position meaning and limitations

`public/spacecraft/catalog.json` preserves the original evidence classifications and model availability. Its `refreshed_at` field describes preparation of this release; each position retains its own evidence date. `public/spacecraft/positions.json` and `data/spacecraft/bootstrap.json` contain refreshed NASA records. Raw current-location responses are retained in `data/spacecraft/` with SHA-256 hashes in the position records.

The NASA moving-rover records use Sol and RMC. File Last-Modified and retrieval time are displayed separately and are never invented Earth observation timestamps. Ingenuity's record remains **final flight 72**, even if the provider has edited the file more recently. Localizations are published mission-team positions, not real-time telemetry. The API validates point geometry, plausible mission region, Sol and response size. Failed refreshes retain the prior sourced coordinates and their dates. An earlier Sol cannot replace a later record.

Spirit and Opportunity positions come from corrected science-team traverses hosted by the Washington University Analyst's Notebook. The products explicitly are not PDS-archived products, and some positions were interpolated. Their landing platforms are separate objects at traverse origins. Fixed landing-site solutions have different map ties. Displayed decimal places do not imply equivalent placement accuracy; quantified placement uncertainty was not supplied.

Sojourner, Zhurong, Mars 2/3/6, Mars Polar Lander, Deep Space 2 and carried PrOP-M units remain unlocated in this release. A mission's planned region, a landing platform, and an orbital image centre are not substituted for the vehicle's final coordinates. Schiaparelli uses an approximate impact marker, not an intact lander model at a claimed precise site.

No current orbital positions or tracks have been invented. Orbiters appear in the directory with their available NASA reference models, and explicit position-unavailable text. Actual orbital placement needs a separate integration of validated SPICE kernels or another mission ephemeris with UTC epoch, coverage, reference frame, altitude and reconstructed/forecast status. Old orbital kernels do not establish a current position. MAVEN's end of mission was checked against [NASA’s mission announcement](https://www.nasa.gov/news-release/nasa-says-farewell-to-maven-mars-mission-hosts-media-call-today/).

## Model normalization and use

Original model bytes were checked against every entry in the supplied ZIP manifest. GLB JSON hierarchy transforms and accessor bounds were inspected. Derivatives add a Y-up root wrapper: horizontal origin centred, bounding-box base at zero. Geometry, textures, embedded buffers and animation clips are retained; animations are not played as telemetry. Viking artwork uses arbitrary source units; its overall height is normalized to approximately 2 m, following NASA's [Viking encounter press kit](https://science.nasa.gov/wp-content/uploads/2023/09/viking-encounter-press-kit.pdf). Other assets retain their source scale. Reference geometry is not certified metrology; Perseverance's default mast pose, for example, differs from its fully deployed dimensions.

Cesium supports the supplied Draco compression and texture-transform extensions. The reference inspector reports loading/ready/failure and recovers without removing location markers. Surface models are terrain-clamped. Terrain meshes use a fixed per-model world scale, with a longest reference dimension of 600 m for display (or original size if already larger). This retains the prominent view at normal local zoom while allowing normal perspective growth on approach. There is no minimum screen-size floor and no camera-dependent shrink. The menu details state the enlargement factor; models are not life-size. The separate menu inspector retains reference geometry. Full mesh bounding spheres determine visibility, including close views with the ground anchor behind the camera. Back-facing artwork surfaces remain drawable during close inspection. The direct terrain-view button frames the enlarged mesh from outside its bounds rather than flying to a fixed 30 m range inside it. The automatic local model pool creates GPU buffers immediately so streaming terrain cannot starve creation jobs; transfers and decoding remain asynchronous. Readiness polling is bounded and stops after success, cancellation or timeout. Model vertical exaggeration is disabled. Artwork attitude, dust, damage, instrument configuration and final condition are illustrative. No provider roll/pitch/yaw has been applied without a verified attitude convention. Terrain registration and model-ground contact remain approximate at the source DEM resolution.

Models are served locally from `/spacecraft/models/`; total derivatives are approximately 63.2 MB, fetched only on demand. This requires no extra Drive account or bulk map compilation. Original and derivative SHA-256 values, transforms, required extensions, size, attribution and source URLs are in the public catalog and `asset-sources.json`. NASA media rules apply; [NASA's media-use guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) is linked in the inspector. No NASA endorsement is implied. Unacquired community or paid models are not presented as available.

## Primary location sources

- [Curiosity map and explanation](https://science.nasa.gov/mission/msl-curiosity/location-map/), [NASA current GeoJSON](https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints_current.json)
- [Perseverance map](https://science.nasa.gov/mission/mars-2020-perseverance/location-map/), [NASA current GeoJSON](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints_current.json)
- [Ingenuity final localization](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/m20_heli_waypoints_current.json)
- [MER corrected traverse documentation](https://an.rsl.wustl.edu/mera/AN/pages/mer/mer_traverse.htm)
- [ODE landing-site reference](https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Landing_Sites.htm)

Other per-object publications and identification evidence remain linked in each directory entry. The supplied handoff was research input, not an authority to fabricate missing coordinates or acquire restricted model assets.

## Validation

`tests/spacecraft.test.mjs` covers catalog identity and placement, NASA parsing and source timestamps, caching and partial outages, regression prevention, track discontinuities and geometry bounds, and binary checksums / embedded GLB dependencies. Browser verification additionally checks actual Draco rendering, terrain placement, view switching, layer controls, unlocated cases and the reference inspector. See the release verification artifact for the observed results.

## Automatic terrain models

Curiosity, Perseverance, Ingenuity, Spirit, Opportunity, InSight, Viking 1 and
Viking 2 have both an acquired NASA model and a sourced surface position.
They appear without opening the inspector when the published CTX tiles at
**that spacecraft’s coordinates** have loaded at no coarser than 5.2 m/pixel
(the 5.1 m value rounded in the HUD). Source-null pixels, Viking gap imagery
and coarser CTX parents do not trigger automatic loading.

The object must also be on screen, within 20 km of the camera, and in a close
view (at most 16 m per screen pixel). These checks prevent stale cached tile
metadata from placing giant models on a distant globe. A full-model frustum test
supports below-datum locations such as Gale and Jezero; a reference-ellipsoid
horizon test would incorrectly hide local objects in these depressions.

The pool supports multiple nearby objects independently of the selected menu
item, with two concurrent GLB transfers. Models that passed the initial CTX gate
stay admitted during local close inspection if imagery metadata is evicted; view,
layer, range and camera-resolution guards still apply. Leaving the view, hiding Spacecraft,
changing its type/scope, switching to 2D, or disabling **3D models on detailed
terrain** retires models and restores their location icons. Late downloads are
destroyed before attachment. Failed models retain pins and use a one-minute
retry backoff; unchanged views do not restart loads or a continuous render loop.
Published location changes replace only the affected model.

**View 3D model on map** is available directly in each eligible menu entry;
it switches to 3D and approaches the object without requiring the inspector.
This explicit action may load the model while imagery is still arriving.
Clicking a model opens its menu entry without flying the camera away.
**Inspect NASA 3D model** remains available, including reference-only orbiter
assets. In 2D the map retains location pins; actual meshes render in 3D and
Compare. Unlocated or unacquired objects are never assigned substitute meshes.

# Mars Field Atlas

Vercel hosts the explorer and its bounded, read-only APIs. Google Drive holds
prepared imagery, terrain and the catalogue. Colab prepares assets; published
observations remain viewable without a running Colab session.

## Available views

- A continuous Mars globe with streamed Murray Lab CTX photography and
  HRSC/MOLA terrain from Esri's Mars services.
- Real Viking MDIM 2.1 imagery under CTX fills missing photography and polar
  caps at coarser resolution. A bundled, source-digested MOLA topography grid
  supplies missing elevation pixels and unavailable coarse roots.
- A separate Sites of value catalogue contains 36 source-linked research
  windows: 16 science, 11 mineral prospects and 9 crew resource candidates.
  Distant category pins become nearby dashed perimeters. Region landmarks
  use hollow diamonds. Perimeters are study windows, not deposit boundaries.
  Evidence, approximate location basis, prepared coverage and discovery
  status are shown separately. No mineable reserve or confirmed life is asserted.
- Smooth flights from the globe to a region overview and individual HiRISE
  observations. CTX and global terrain remain visible outside each observation.
- Completed observations supply native ~0.25 m grayscale imagery and ~1 m DEM
  grids from Drive on demand. The mutable catalogue tracks eight observations
  across Arcadia Planitia, Valles Marineris, Jezero and Gale.
- North-up 2D, inset overview, and linked side-by-side comparison. Compare links
  the viewed ground position and scale in either direction and can be unlinked.
- Places detail badges, coverage outlines, and a view-centre indicator that
  distinguishes source availability from the imagery currently displayed.
- A Layers checklist hides or shows region landmarks, science sites, mineral
  prospects, crew resources, research boundaries, image footprints and personal
  measurements. Hide all clears overlays; Show all restores them. Choices persist
  in the browser across places and reloads, and apply to 3D, 2D and Compare.
  Hiding a measurement preserves its points; opening Measure makes it visible again.
- Map appearance offers Grayscale and a sourced colorized Viking context.
  Its ≈232 m photographic base has coarser color; it is not HiRISE RGB.
  Collected HiRISE enhanced-color originals still require display preparation.
  Image footprints show prepared satellite image bounds.
- Ground pan, cursor-centred zoom, rotate/tilt, right-drag rotation, north reset,
  and keyboard movement (arrows/WASD, +/-).

Each observation is a satellite strip, not a resolution level. Native coverage
does not span entire regions. Matching observation outlines and labels appear
in 3D, 2D and the inset. Absolute photographic registration remains unvalidated.
Five new value-site anchors intersect prepared HiRISE bounds; only one small
study window lies wholly within a prepared bounding rectangle. Actual usable
pixels still require auditing. Remaining value-site native builds, hazard layers,
landing/camp coverage and validated operational routing remain broader project work.

The Routes tool now applies the partner's original three-profile Python engine
to measured terrain, with A/B placement, priority checkpoints, mission controls,
profile comparison and JSON/GeoJSON export. See [ROUTING.md](ROUTING.md) for
fidelity, explicit repairs, accuracy limits and deployment instructions. A
persistent camera altitude HUD estimates clearance to nearby terrain, including
slopes beside the point directly below the camera.

`public/value-sites.json` retains the evidence references. The metadata-only
audit found 648 distinct fine-image candidates; this is discovery, not a download
or full-coverage certificate. `scripts/build-value-acquisition.mjs` preserves
the existing adaptive collector and adds 37 discovery windows for the 36 sites.

## Data flow

`Drive originals → hosted Colab COG shards → Drive catalogue → Vercel → browser`

`/api/surface` delivers versioned, gzip-compressed canonical display packets:
a 129 × 129 measured elevation grid and 512 × 512 grayscale/alpha photograph.
`/api/elevation` supplies native height grids to the continuous terrain.
HiRISE photography uses a bounded window at the desired imagery level,
so local photographs do not wait for every global terrain ancestor to load.
`/api/planet` proxies a fixed-host CTX/terrain source with validated LERC
grids. Damaged global tiles retain a verified coarser parent so a failed source
tile cannot block refinement of the whole terrain tree.

CTX supplies distant and regional photography. HiRISE appears progressively
at close range. Visible requests share a bounded transfer queue, cancel
abandoned work, and reuse nearby packets. Versioned CDN/runtime caches and
bounded memory caches reduce repeat reads. First uncached reads still depend
on Drive latency; this is not a guaranteed high-traffic tile service. A prepared
  full tile pyramid remains future work. Eighteen versioned, precompressed display
  packets now serve common observation views directly from the website CDN.
  A bounded public-tile browser cache and small cancellable prefetch improve revisits.

Photograph masks expose the context layer underneath; border pixels do not
repeat across patches. Failed source decoders are evicted and retried within
bounded limits. Only catalogue-published observations and bounded tile indices
are accepted. Source reads use byte ranges of at most 2 MiB; large originals
never pass through a function. No account credentials reach the browser.

## Coordinates and elevation

Images retain the publisher's Mars sphere and east-positive planetocentric
coordinates. Paired orthophoto PDS labels determine their transforms. Readouts
use longitude in -180…180 degrees; distances use the Mars radius.

Completed DEMs retain publisher elevations without a regional median shift.
Native NoData retains known global terrain while remaining unavailable as
native data. Legacy preview crops retain their separate local display reference.
Absolute height datum registration and image-to-image alignment are unvalidated.
CTX is a semi-controlled photographic context. Relief ×3 affects display only.
Visual detail does not certify navigation safety.

## Development

Node 24: `npm ci`, `npm test`, `npm run build`.
Full local API flow: `node dev-server.mjs` on port 8770.
Vercel project: `mars-field-atlas`, team `samsdevforges-projects`.
Exclude `.env*`, `.vercel/`, dependencies and temporary data from source uploads.

## Hosted preparation

Notebook: https://colab.research.google.com/drive/1TR6F1GDtFjstDKlSxGOcjmtrUhUHJ9hK

Prepared data: https://drive.google.com/drive/folders/13Vk1fjkv47MmBBPqP1EkdrRn6e8E01kL

Partner handoff: https://drive.google.com/drive/folders/130glERGlm6jsqIwdYg_MKGZ0kLkphfjD

The hosted CPU builder verifies original hashes and uploaded sizes/MD5,
checkpoints observations, and reuses verified output after reconnection.
Colab maximum duration is not guaranteed. The archive collector is a separate
job; avoid launching duplicate builders against the same catalogue.

## Source gaps and elevation integrity

The reported Sacra Fossae black strips reproduced with both our custom mesh and
Cesium's heightmap mesh, but disappeared with an ellipsoid. The official
`MDEM200M/ImageServer/tile/7/55/79` decodes to 5,426–5,645 m, while its neighboring
western edge differs by up to 5,461 m and the independent MOLA reference disagrees
by over 5 km. The byte-identical upstream fixture is pinned in the tests.

Every global elevation tile is now checked with 81 samples against measured MOLA.
A systematic median disagreement exceeding 1,500 m, with at least 70% of samples
agreeing on the signed error, uses measured coarse MOLA instead. Isolated real
peaks or craters are retained. This check detects gross tile offsets; it is not
absolute registration certification. Source elevations and native HiRISE DEMs
are never shifted to make a visual seam disappear. Coarse fallback is labelled.

CTX photographic gaps now use grayscale **optical** Viking MDIM context; infrared
temperature imagery is no longer inserted into the photographic display. A
bounded low-frequency brightness adjustment and mask-aware transition soften
the patch boundaries. Fine tiles and successive zoom levels share a fixed
geographic brightness reference, avoiding independent rectangular adjustments.
Fully opaque CTX pixels, including black shadows, remain
unchanged. The source mask survives compositing and cropped parent fallback,
so a filled display gap cannot claim native CTX coverage. Display preparation
does not modify the archived original sources.

CTX is approximately 5 m where present; optical fallback is approximately 232 m.
Coarse MOLA reference data have a roughly 15 km grid. Missing photography cannot
acquire CTX detail through blending, and source registration/illumination changes
can remain visible. Loaded imagery resolution and coarse elevation fallback are
reported at the view centre in 2D and 3D.

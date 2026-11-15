# Local map developer API

The desktop top bar **APIs** panel lists the supported local contracts. See [Local field inputs](FIELD_INPUT_API.md) for suit telemetry and seismic replay.

Enable the localhost listener with the port and token in [Dead reckoning](DEAD_RECKONING.md#local-input-api). All calls below use the same bearer token. Positions are `[east longitude, planetocentric latitude]` in degrees, frame `mars-east-planetocentric`. Submit JSON with `Content-Type: application/json`.

| Method and path | Input and result |
| --- | --- |
| `POST /v1/terrain/query` | `{"points":[[77.43,18.44]]}`. Returns elevation and sampled slope per point, dataset, elevation datum, grid spacing and coverage. Installed DEMs take precedence over the MOLA overview. A gap inside an installed DEM returns null. |
| `POST /v1/routes/evaluate` | A `path` array of 2–128 points, or `start` and `destination`. Optional `exclusions` array with an `id` and simple `polygon` of 3–128 points each, plus `maxSlopeDegrees` and `spacingMeters` (10–15,000, up to 768 total samples). Returns route length, sampled terrain profile, intersected exclusion IDs, steep sample indices and unknown terrain count. The existing route planner remains the place to generate alternative paths. |
| `POST /v1/observations` | Save a `waypoint`, `sample`, `photo`, or `measurement` with `id`, `kind`, `label`, `frame`, `point` and UTC `at`. Optional `source` and `reference` identify the instrument or photo/sample record. Measurements also need `parameter`, `value`, `units` and `dataKind` (`measured` or `modeled`). Repeating the same ID and data is safe. Different data with that ID returns 409. |
| `GET /v1/observations` | Read GeoJSON point features. Optional `bounds=west,south,east,north`, `since`, `until` and `offset`. Use `nextOffset` for additional pages. Atlas displays these points on the globe, 2D map and overview. |
| `GET /v1/environment` | Supply `lon`, `lat`, UTC `at`, and `parameter` from `Tair` (K), `Tsurf` (K), `Psurf` (Pa), `Dust` (tau) or `wind` (m/s). `kind=measured` finds submitted instrument observations within `radiusMeters` and `maxAgeSeconds`. `kind=modeled` samples the bundled NASA GSFC/EMARS archive at its exact model timestamp. If the requested time or location is outside the archive, the API reports unavailable and lists the archived time. |

Example instrument reading.

```json
{"id":"pi-thermometer-0042","kind":"measurement","label":"Air temperature","frame":"mars-east-planetocentric","point":[77.43,18.44],"at":"2026-11-06T12:00:00Z","source":"pi-thermometer","parameter":"Tair","value":220,"units":"K","dataKind":"measured"}
```

Terrain slopes describe the sampled grid. Route lengths use the Atlas Mars radius. Route evaluation samples the great-circle path between supplied points and checks the resulting segments against caller-provided polygons, including short crossings of the date line.

## Source map downloads

Open **Map Manager → Custom area**. Apply the selection, choose a source and resolution, then select **Download map** in Online Mode. Transient upstream errors are retried before reporting the failed tile. Pick the product, then a resolution. Each product displays its available tile levels, approximate equatorial grid spacing and a storage ceiling. Lower levels are included for zooming. Rectangle, circle, lasso and coordinates work with source downloads.

| Product | Finest supported tier | Coverage and appearance |
| --- | --- | --- |
| Viking MDIM 2.1 | About 326 m/px from the 232 m source mosaic | Global. Publisher-colorized imagery or locally converted grayscale. |
| HRSC / MOLA shaded relief | About 200 m/px effective source spacing | Global. Publisher grayscale or color relief. |
| HRSC / MOLA measured elevation | 200 m effective source spacing | Numeric elevation. Used by the offline globe and the terrain API. |
| THEMIS daytime infrared | About 100 m/px effective source spacing | Equatorial mosaic with source gaps. Grayscale. |
| CTX global mosaic | About 5.1 m/px | Near-global coverage to ±88°. Grayscale. |
| HiRISE site mosaics | About 0.32–1.27 m/px at the finest served level, depending on site | Jezero, Gale, InSight, Columbia Hills, Opportunity, Phoenix, Sojourner, Southwest Candor Chasma, Viking 1, Viking 2 and Marth Crater. Grayscale display tiles. |

Resolution labels describe the served grid or native source limit, whichever is coarser. HiRISE site downloads use publisher-rendered tiles. Original HiRISE orthoimages and stereo DEMs are separate data products. Supported resolutions remain visible. Every supported quality remains selectable. A red Storage exceeded counter warns when the selection, coarser zoom levels and index exceed available drive space; download preflight prevents starting an oversized transfer. Source packages currently support up to 1,000,000 tiles each; larger archives require separate sections. The picker flags partial footprints and the installer records missing tiles. Activate a saved product from the installed map list. Downloaded imagery and elevation remain separate.

[NASA Mars Trek layer catalogue](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars), [Caltech CTX mosaic](https://murray-lab.caltech.edu/CTX/V01/TilePages/), [USGS HRSC/MOLA DEM](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m), [USGS HiRISE science products](https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/).

## External location systems

`POST /v1/location/fixes` and `GET /v1/location/status` share this authenticated listener. The operator can copy a fresh received Mars position into Mark a site, then name and save it. These fixes do not require engaging dead reckoning. See [Location-system integration](LOCATION_SYSTEM_API.md).

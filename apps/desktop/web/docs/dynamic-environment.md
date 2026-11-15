# Time-dependent scientific overlays

This change adds 22 selectable views, increasing the dynamic catalogue from 8
to **30 of 62**. It does **not** complete all the originally requested scientific
quantities. The [entry-by-entry audit](dynamic-overlay-audit.md) identifies the
32 remaining dependencies. The same audit is published as
`/dynamic-overlay-status.json` and explicitly reports
`all_requested_quantities_complete: false`.

## Added map views

Under Layers → More overlays, the original categories now include:

- Water / ice: seasonal surface water frost and CO₂ snow / frost.
- Atmosphere: surface and air temperatures, pressure, atmospheric column mass,
  density proxy, dust optical depth, water-ice cloud optical depth, and wind
  direction using the existing animated EMARS vector field.
- Solar / thermal: NASA’s relative UV level, a blackbody thermal-emission
  reference, sampled diurnal temperature range, geometric solar elevation,
  level-surface illumination and terrain sunlight with a local shadow check.
- Space-weather context: Earth-view solar flares, NOAA storm categories, EUV
  spectral lines, Sun–Earth L1 solar-wind speed / density and IMF components.

The selected description defines the displayed quantity, units and limitations.
Descriptions remain next to the selected checkbox. Unimplemented entries have
an expandable “Why unavailable?” explanation. The four recommended entries
are unchanged.

## Weather source and time controls

Source: [NASA GSFC Mars Explorer](https://psg.gsfc.nasa.gov/apps/mars/), selecting
EMARS and the “Most similar MY” historical climate analogue. The verified source
label was `EMARS MY32 Moderate dust`; it is taken from each response, never
hard-coded as the current Mars year. NASA describes the app as testing software.

`GET /api/environment?parameter=Tsurf&at=2026-10-18T21:00:00.000Z`
serves a validated grid. Only the documented parameters `Tsurf`, `Tair`,
`Psurf`, `Dust`, `Ice`, `Vapor`, `Frost`, `Snow`, and `Rad` are accepted.
Requests use the complete provider form, Scientific units, explicit UTC and
EMARS/Optimum. The HTML response must echo that exact time and model selection
before the grid is accepted. Units, axes and dimensions are checked. Raw
responses are hashed; observation/publication time and uncertainty remain null
when unavailable.

These are **modeled climatological conditions, not live weather observations**.
The shared time control defaults to the current UTC hour, follows subsequent
hours while visible, allows a selected UTC time, and provides ±6-hour buttons.
Custom requests are bounded to 2000–2030. No observation or forecast is invented
by advancing a model clock. Source polar coverage ends at ±88.393°; no values
are extrapolated into the small unsampled polar caps.

The raster appears in 3D, 2D and Compare. Shared edge samples avoid tile seams;
wrapped Leaflet worlds receive independent canvases. Display interpolation is
periodic across the longitude seam and retains missing-neighbor masks. Tint
changes display only. Numeric centre readouts and downloaded JSON retain source
values, including values beyond the fixed color scale.

Server requests are coalesced and cached per parameter **and hour**. Failure
retains only an exact-time cached field, with its original provenance. Another
hour or a zero-filled grid is never substituted. Selected-time requests can be
cancelled when the layer changes. A failed source remains visibly unavailable.

## Derived fields and scientific limits

| View | Calculation and limit |
| --- | --- |
| Atmospheric column mass | Hydrostatic `P/g`, `g = 3.72076 m/s²`; kg/m², not molecule number column or radiation shielding dose |
| Atmospheric density proxy | Ideal pure-CO₂ `P/(188.92 T)`; air-temperature height is not documented, so this is **not a validated near-surface density** |
| Thermal emission reference | Bolometric `σT⁴`, emissivity fixed at 1; **not** actual material emissivity, measured band radiance or atmospheric transmission |
| Diurnal range | Seven Tsurf snapshots at 0, 4, 8, 12, 16, 20 and 25 Earth hours; sampled extrema may underestimate the full one-sol range |
| NASA UV level | Source returns unit `level`; **not** calibrated UVA/B/C irradiance, standard UV Index, ionizing dose or astronaut-risk classification |
| Geometric sunlight | Cosine of solar zenith clipped to 0–1; **not** dust-attenuated surface irradiance |
| Terrain sunlight / shadows | Physical DEM slope and sunward horizon at 1, 2, 4 and 8 grid spacings, including spherical curvature; distant blockers and sub-grid features may be missed |

Solar geometry follows [NASA GISS Mars24](https://www.giss.nasa.gov/tools/mars24/help/algorithm.html),
including orbital perturbations, equation of time, TT−UTC, seasonal declination
and longitude. Atlas planetocentric latitudes are converted to planetographic
latitude for local angles. Both NASA worked examples are checked in tests.
Leap seconds through 2017 are included; a future leap-second update requires
updating that table. Solar geometry is analytic and works offline after loading
the app. Terrain shadows additionally require valid elevation coverage.
The globe’s 3× display exaggeration never enters these calculations.

## Added official space-weather sources

| Source | Scope and adapter rules |
| --- | --- |
| NOAA `/json/rtsw/rtsw_wind_1m.json` | Active Sun–Earth L1 proton speed, density and temperature; only `overall_quality == 0` values plotted; provider source and flags preserved |
| NOAA `/json/rtsw/rtsw_mag_1m.json` | Active L1 IMF magnitude and GSM components; no propagation to Mars |
| NOAA GOES `xray-flares-7-day.json` | Flare beginnings, peaks, ends, class and satellite; chart shows discrete event peaks |
| NOAA `/products/noaa-scales.json` | Current S/R/G categories for **Earth**, separate from future probabilities |
| NOAA GOES `euvs-6-hour.json` | 25.6/28.4/30.4 nm line irradiance in W/m²; eclipse, lunar-transit and geocorona samples masked; Mg II index is not irradiance and is excluded |

These refresh every five minutes while selected/visible. They are clearly
labelled **Earth context**; no tint implying Mars coverage is drawn. The existing
RAD, Mars Express, iPATH, DONKI and GOES views remain separate. The adapter also
supports NOAA F10.7 as a solar-activity context product, without claiming a
GCR modulation potential or enabling the unavailable GCR-modulation entry.

## Verification and reproducibility

`node scripts/verify-dynamic-sources.mjs` refreshes the new source snapshots and
content-addressed raw evidence. `data/environment/verified-snapshot.json` is
verification evidence, not an automatic substitute for another model hour.
The existing durable worker `tools/refresh-space-weather.mjs` automatically
includes the newly registered feeds, with its lock, atomic publish and raw
archive behavior. No permanent external scheduler is provisioned by this change;
active views refresh through the cache-backed APIs.

Tests cover source-unit changes, malformed dimensions, missing versus zero,
longitude wrap, polar bounds, matched model times, dimensional calculations,
NASA worked examples, physical terrain shadows, source allowlists, NOAA flags,
fallback timestamps and cache coalescing. All source grids can be reconstructed
from their saved raw bytes and checked against their SHA-256 hashes.

## Remaining scientific work

The handoff explicitly requires a validated particle transport/response model
before global GCR/SEP dose, secondary species, albedo radiation or human Sv
exposure can be calculated. NOAA Earth spectra, local RAD dose and NASA’s UV
relative level cannot supply these products.

Primary leads checked include [Guo et al. 2019 ready response functions](https://doi.org/10.1051/swsc/2019004)
and [the published AtRIS source archive](https://zenodo.org/records/3633451).
RADMAREE’s published HTTPS service and the original Kiel repository could not
be fetched in this environment; the IRAP repository redirected to sign-in.
The Zenodo record identifies simulation source; its download was rate-limited,
so ready response matrices could not be verified from that archive. No configured,
validated live Mars response service was established. Access/porting, response matrices, primary spectra,
material/shielding definitions and RAD validation are still required.

Other missing entries need their own inputs: depth-resolved subsurface thermal
properties, calibrated UV/visible/IR surface radiative transfer, current storm
detections, probability ensembles, and timestamped SPICE/link-budget products
for communications. Route exposure and time-dependent energy also require
arrival times, stops/return travel and validated response/vehicle or suit models.
These dependencies are disclosed per entry; none are silently turned into zero,
an unvalidated proxy, or a claim of completed science.

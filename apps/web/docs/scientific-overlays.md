# Scientific overlays

Layers now separates Map appearance, Scientific overlays, and Places & pins.
Recommended overlays is a four-item shortlist: elevation gradient, hydrated
minerals / clay signatures, subsurface water-ice likelihood, and crustal magnetic
field strength. Each comes from a different category. All entries, including
slope, roughness, thermal inertia and mission-analysis layers, remain available
in More overlays under the owner's nine classifications. Static
and Dynamic badges appear on every entry. Only the selected overlay opens its
explanation directly beneath the checkbox that selected it, in either
Recommended overlays or More overlays. The visible explanation has three
plain-language parts: What this shows, How to read it, and Keep in mind.
Depth/component and uncertainty choices update this explanation immediately.
Source, resolution and technical method remain available in a collapsed
disclosure; controls stay with the selected overlay. The terrain-confidence
explanation explicitly identifies blue/red as terrain source categories and
explains loading/fallback rectangles, rather than claiming statistical certainty. Contour details open only
when contours are enabled. Verified dynamic observations and forecasts are now
connected; unsupported products remain disabled until their source/model and
scientific interpretation are established. See [Dynamic overlays](dynamic-overlays.md).

There are **31 connected static entries out of 64** and **8 connected dynamic
views out of 62**. The added Earth-proton context view makes 126 catalog entries.
The other 33 static entries are deliberately disabled. The catalog is not a
claim that every requested product is an available global map. In particular,
uranium, alpha/beta/gamma exposure potentials, extraction accessibility and
mission communication products cannot be made by relabeling other fields.
Geological units/ages still require a prepared georeferenced package (USGS
SIM 3292's spatial download and WMS were inaccessible in this environment).
No substitute geology was inferred from photographs or terrain colors.

## Delivery and controls

One scientific raster/point product is selected at a time. Contour lines are
an independent vector overlay; pin and drawing controls remain separate.
The same source and tint are used in Cesium 3D, Leaflet 2D and Compare.
New raster tints range from 0–100%; the existing magnetic 65% guide and
visibility warning are retained. No published field values change with tint.

Prepared numeric reference maps load only when selected. Every float packet
has a SHA-256 in `public/scientific/manifest.json`; the client checks it before
rendering. NoData remains transparent. Reference products refine only to
their stated grid sampling; zooming cannot manufacture new scientific detail.
The current 19 numeric assets (including depth bands and uncertainty choices)
use about 29.5 MB compressed in total, plus a small detection-coordinate file.
They require no Drive login or running Colab notebook to display.

### Latitude / longitude guide

**Layers → Map guides → Latitude / longitude grid** enables an independent
coordinate graticule in 3D, 2D, Compare and the small overview. Visibility is
remembered; Hide all disables it. Show all keeps the user's grid choice.
Planetocentric latitude is labeled N/S and east-positive longitude E/W,
matching the viewer's coordinate readout. The equator, prime meridian and
180° meridian receive stronger strokes. Decimal precision follows grid spacing.

The guide is calculated locally, with no downloaded instrument product or
archive storage. Transparent geographic image tiles drape the lines over the
loaded surface, above scientific color layers and below map markers. The view
extent controls latitude and longitude spacing separately; 2D and the small
overview can use their own spacing. Coarse ancestors skip lines too dense to
read, labels appear only with enough room, and coordinate labels are omitted
above 85°N/below 85°S to avoid polar crowding. All tile work is bounded, including
near-ground zoom. It never issues offscreen terrain-pick renders, elevation
requests or network requests.

### Ice display and polar coverage correction

The recommended ice entry now opens **Global hydrogen · includes both poles
(MONS)**. This is the ASU-served Wilson et al. (2017) reconstruction of Odyssey
epithermal-neutron water-equivalent hydrogen, on a 720×360, 0.5° delivery grid.
Its effective resolving power is approximately **290 km**, not 30 km. Both
polar regions contain source values. The legend changes to **0–100 wt% H₂O
equivalent**; hydrogen can occur in ice or hydrated material, and values near
100 reach the reconstruction's model limit. These are not ice probabilities,
purity assays, accessible reserves or a live frost map.

The three original SWIM depth composites remain separate choices, each with
its own **−1…+1 signed ice-consistency scale**. They still end at the published
60°S/60°N limits. Their polar readout now explains this limit and directs users
to the global hydrogen choice. No MONS values are spliced into SWIM, and no
SWIM consistency values are extrapolated to the poles.

Display shading now uses 512-pixel reference tiles, area-averaged overview
levels, bilinear sampling and blending between overview levels. Shared tile
edges sample identical geographic positions. Exact coordinate poles converge
to a single display value from the adjacent source-row mean to avoid radial
longitude fans. The original float grids remain unchanged. Numeric readouts
explicitly say **Source cell** and use the original nearest source cell; all
missing cells remain transparent, and interpolation does not bridge a missing
neighbor. Shading is a visual interpolation, not improved instrument resolution.
Real SWIM footprint/composite boundaries can therefore remain visible; they
are not corrected by inventing new measurements or excessive cosmetic blur.

The MONS packet is 852,650 bytes compressed. Its original double-precision
VICAR source hash, exact request, units, source metadata and float-packet hash
are retained. The EPSG:4326 request uses signed east longitude directly; an
independent MOLA request locates Olympus Mons at 133.5°W, 17.5°N as a service
registration check. See `tools/data/mons/` for the metadata excerpt and provenance.

## Primary sources and interpretation

* NASA MGS/TES via the ASU author-listed numeric WMS:
  https://www.mars.asu.edu/data/ . Native mineral grids are 4 pixels/degree;
  albedo is 8 pixels/degree. Thermal inertia is delivered at 2 pixels/degree
  from the 8-pixel/degree reference. Numeric WMS download addresses, labels,
  packet digests and source digests are preserved in the manifest. The author
  downloads use public HTTP; visitors fetch only bundled same-origin assets.
  The live WMS capabilities confirm units, max sampling and the −1 mineral NullValue; thermal-inertia and albedo layers declare no NullValue. Negative mineral sentinels become NaN; real zero abundance is retained.
  Glass/sheet silicates are ambiguous and are not called unique clay evidence.
* NASA PDS Odyssey GRS v2.0 5° unsmoothed element tables:
  https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html . Survey
  2002-06-04 through 2005-04-03. K is weight %, Th is converted from weight % to
  ppm by multiplying by 10,000, and H₂O is water-equivalent weight %. 9999.999
  invalid bins are NaN. Negative peak-fit estimates are preserved; they are
  uncertain estimates, not physically negative concentration. The original
  1σ statistical uncertainty is selectable separately, in matching units.
  Correction-factor errors are not silently added. Spatial bins are not
  instrument resolving power; this is neither radiation dose nor ice reserves.
* PSI/JPL SWIM4IMIM August 2025 reference composites:
  https://swim.psi.edu/SWIM4MIMProducts.php . Full 7200×2400 source arrays span
  60°S–60°N at 20 pixels/degree. Depth bands are 0–1 m, 1–5 m and >5 m sensing
  composites. Signed consistency −1…+1 is not calibrated likelihood, measured
  depth, or extractable water. NoData −30 stays transparent. Archive, member,
  CRS-bounds checks and original archive checksum are retained.
* Wilson et al. (2017), Odyssey MONS reconstruction:
  https://doi.org/10.1016/j.icarus.2017.07.028 . Numeric product
  `mars_odyssey_grs_mons_perc_wt` served by the ASU JMARS WMS, ingested
  2019-02-22. Native numeric values are preserved as float32; no global/SWIM
  merger, artificial polar filling or scientific smoothing. The paper's
  effective resolution is approximately 290 km. ASU metadata and source
  digests are included with the prepared package.
* NASA PDS OMEGA/CRISM hydrated sites, Carter et al. (2013):
  https://pds-geosciences.wustl.edu/mex/mex-m-omega-5-ddr-global-maps-v1/mexomg_2000/data/hydrous/ .
  1,847 distinct detection coordinates, merged only at identical source
  coordinates. Product identifiers are retained. These are points, not
  deposit polygons or mineral absence away from detections.
* Langlais et al. (2019) magnetic model: see `magnetic-field.md`.
* NASA MOLA / ESA HRSC: the same validated terrain pyramid already used by
  the viewer, with the bundled 4-pixel/degree MOLA fallback. See
  https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m
  and https://gdal.org/en/stable/programs/gdaldem.html .

## Derived terrain methods

All derivatives use unexaggerated measured heights, Mars metre distances,
spherical neighborhood destinations, and the disclosed map-scale baseline.
A 3×3 neighboring source-tile mosaic avoids differentiating against an
unrelated tile-edge fill. Missing cells or changes between source tiers
remain transparent; there is no invented fine elevation. The coordinate-pole
neighborhood (|latitude| >89.5°) is excluded from directional derivatives.

* Slope: Horn weighted 3×3 gradient, degrees.
* Aspect: downslope direction, clockwise from north; flat cells undefined.
* Roughness: RMS residual after removing the central tangent plane, metres.
* Ruggedness: RMS difference from the eight neighbors, metres.
* Curvature: four-neighbor Laplacian, inverse kilometres; positive concave.
* Local relief: 3×3 maximum minus minimum, metres.
* Hillshade: fixed azimuth 315°, elevation 45°; not current solar conditions.
* Landforms: documented local TPI/slope heuristic (depression, intermediate,
  ridge, slope); not mapped geology.
* Local sky view: eight horizon directions at 1/2/4 source-cell baselines,
  mean cos² of positive horizon angles. Shielding geometry is one minus this
  factor, with no particle-transport or radiation-dose interpretation.
* Traversal: project terrain-screening index combining slope and RMS roughness
  with explicit weights/thresholds shown in the selected description.
* Landing suitability: inverse of that terrain-only index. It omits entry,
  rocks, soil, weather and mission constraints; not a landing recommendation.
* Terrain confidence: a source-tier proxy (0 coarse MOLA; 1 HRSC/MOLA), not
  a statistical probability or native HiRISE confidence model.
* Accessibility: explicitly stated slope classes, not certified traversability.
* Baseline energy: the partner's Minetti polynomial, capped at ±0.45 gradient,
  floor 1.2 J kg⁻¹ m⁻¹, evaluated in the uphill steepest direction. Mass and
  Mars-gravity factors are not applied to this per-unit reference. Actual
  directional route calculations remain in the original Python Routes engine.

## Contours

Marching-squares segments on a bounded 49×49 display grid over the visible
source neighborhood, intervals 100/250/500/1000/2000 m. Missing cells do not
bridge. The globe-scale view asks the user to zoom closer; output is capped
at 4,000 segments and discloses that cap. The 3D lines are raised 35 m for
visibility; their stated level is the source elevation, not the display offset.
Contour simplification is for display, not a survey export.

## Preparation and validation

`tools/build-static-overlays.py --cache PATH --swim-zip PATH` reproduces the
numeric assets using NumPy and rasterio (preparation only). ASU VICAR inputs
and source HTML go in the cache directory, with exact download URLs retained
in the manifest; PDS GRS tables/labels are also preserved under tools/data/grs.
The existing SWIM archive is read without changing the original. No credentials,
account configuration, or source-archive collector was changed.

Tests cover catalog completeness, dynamic gating, exclusive heatmaps plus
independent contours, known-plane slope/aspect/roughness/curvature, spherical
longitude wrapping, partner energy clamp, contour bounds/NoData, packet hashes,
point-value agreement, GRS unit conversion, and missing-coverage transparency.
A separate DOM/Cesium check exercises the actual menu, both hemisphere image
requests and the scientific data loader. Browser visual inspection remains
unavailable because the in-app browser control fails during initialization.

## Full catalog status

| Classification | Overlay | Type | Status |
|---|---|---|---|
| Terrain & Topography | Elevation gradient | Static | Connected |
| Terrain & Topography | Slope steepness | Static | Connected |
| Terrain & Topography | Terrain roughness | Static | Connected |
| Terrain & Topography | Terrain ruggedness | Static | Connected |
| Terrain & Topography | Slope aspect | Static | Connected |
| Terrain & Topography | Terrain curvature | Static | Connected |
| Terrain & Topography | Terrain landform classification | Static | Connected |
| Terrain & Topography | Local relief / elevation variation | Static | Connected |
| Terrain & Topography | Terrain hillshade (fixed lighting) | Static | Connected |
| Terrain & Topography | Topographic sky visibility | Static | Connected |
| Terrain & Topography | Contour lines | Static | Connected |
| Geology & Surface History | Geological units | Static | USGS SIM 3292 spatial package still needs preparation; no substitute geology inferred from imagery. |
| Geology & Surface History | Geological ages | Static | USGS SIM 3292 spatial package still needs preparation; no substitute geology inferred from imagery. |
| Geology & Surface History | Impact crater density | Static | Published spatial product or defensible model still required |
| Geology & Surface History | Ancient river valley distribution | Static | Published spatial product or defensible model still required |
| Geology & Surface History | Ancient lakebed distribution | Static | Published spatial product or defensible model still required |
| Geology & Surface History | Delta and sedimentary deposit distribution | Static | Published spatial product or defensible model still required |
| Geology & Surface History | Volcanic terrain classification | Static | Published spatial product or defensible model still required |
| Geology & Surface History | Fault and fracture density | Static | Published spatial product or defensible model still required |
| Geology & Surface History | Ancient drainage network density | Static | Published spatial product or defensible model still required |
| Geology & Surface History | Impact ejecta distribution | Static | Published spatial product or defensible model still required |
| Geology & Surface History | Sedimentary geological formations | Static | Published spatial product or defensible model still required |
| Geology & Surface History | Tectonic structure classification | Static | Published spatial product or defensible model still required |
| Minerals & Surface Properties | Mineral composition | Static | Connected |
| Minerals & Surface Properties | Hydrated minerals / clay signatures | Static | Connected |
| Minerals & Surface Properties | Thermal inertia | Static | Connected |
| Minerals & Surface Properties | Olivine abundance | Static | Connected |
| Minerals & Surface Properties | Pyroxene abundance | Static | Connected |
| Minerals & Surface Properties | Hematite abundance | Static | Connected |
| Minerals & Surface Properties | Feldspar abundance | Static | Connected |
| Minerals & Surface Properties | Sulfate signatures | Static | Published spatial product or defensible model still required |
| Minerals & Surface Properties | Surface albedo (reference composite) | Static | Connected |
| Minerals & Surface Properties | Surface dust cover index (reference composite) | Static | Published spatial product or defensible model still required |
| Minerals & Surface Properties | Rock abundance | Static | Published spatial product or defensible model still required |
| Minerals & Surface Properties | Mafic mineral composition | Static | Connected |
| Minerals & Surface Properties | Spectral alteration indices | Static | Published spatial product or defensible model still required |
| Water, Ice & Subsurface | Subsurface water-ice likelihood | Static | Connected |
| Water, Ice & Subsurface | Water-equivalent hydrogen | Static | Connected |
| Water, Ice & Subsurface | Estimated subsurface ice depth | Static | SWIM sensing-depth bands are available under ice likelihood; they are not measured depth or calibrated confidence. |
| Water, Ice & Subsurface | Ice evidence confidence | Static | SWIM sensing-depth bands are available under ice likelihood; they are not measured depth or calibrated confidence. |
| Water, Ice & Subsurface | Modeled resource accessibility | Static | Published spatial product or defensible model still required |
| Water, Ice & Subsurface | Subsurface radar reflector interpretations | Static | Published spatial product or defensible model still required |
| Water, Ice & Subsurface | Subsurface ice stability estimates under defined conditions | Static | Published spatial product or defensible model still required |
| Water, Ice & Subsurface | Seasonal surface frost coverage | Dynamic | Awaiting dynamic endpoint |
| Water, Ice & Subsurface | Seasonal subsurface thermal conditions | Dynamic | Awaiting dynamic endpoint |
| Geophysics & Natural Radioactivity | Crustal magnetic field strength | Static | Connected |
| Geophysics & Natural Radioactivity | Potassium abundance | Static | Connected |
| Geophysics & Natural Radioactivity | Thorium abundance | Static | Connected |
| Geophysics & Natural Radioactivity | Gravity anomalies | Static | Published spatial product or defensible model still required |
| Geophysics & Natural Radioactivity | Crustal magnetic anomalies / vector components | Static | Published spatial product or defensible model still required |
| Geophysics & Natural Radioactivity | Uranium abundance (only if defensibly mapped) | Static | No defensibly verified spatial model connected; elemental presence cannot be substituted for measured radiation dose. |
| Geophysics & Natural Radioactivity | Natural gamma emission potential | Static | No defensibly verified spatial model connected; elemental presence cannot be substituted for measured radiation dose. |
| Geophysics & Natural Radioactivity | Natural alpha radioactivity potential | Static | No defensibly verified spatial model connected; elemental presence cannot be substituted for measured radiation dose. |
| Geophysics & Natural Radioactivity | Natural beta radioactivity potential | Static | No defensibly verified spatial model connected; elemental presence cannot be substituted for measured radiation dose. |
| Geophysics & Natural Radioactivity | Modeled geothermal heat-flow distribution | Static | Published spatial product or defensible model still required |
| Marswalk & Mission Analysis | Traversal difficulty | Static | Connected |
| Marswalk & Mission Analysis | Terrain-data confidence | Static | Connected |
| Marswalk & Mission Analysis | Landing terrain suitability | Static | Connected |
| Marswalk & Mission Analysis | Terrain shielding potential / sky obstruction | Static | Connected |
| Marswalk & Mission Analysis | Science target density | Static | Published spatial product or defensible model still required |
| Marswalk & Mission Analysis | Baseline route energy-cost surface | Static | Connected |
| Marswalk & Mission Analysis | Terrain accessibility classification | Static | Connected |
| Marswalk & Mission Analysis | Terrain-based communication line-of-sight potential | Static | Requires a defined transmitter/site, antenna geometry and a validated visibility model. |
| Marswalk & Mission Analysis | Fixed-site communication visibility | Static | Requires a defined transmitter/site, antenna geometry and a validated visibility model. |
| Marswalk & Mission Analysis | Local solar-horizon geometry | Static | Published spatial product or defensible model still required |
| Marswalk & Mission Analysis | Potential sampling-site suitability | Static | Published spatial product or defensible model still required |
| Marswalk & Mission Analysis | Solar illumination and terrain shadows | Dynamic | Awaiting dynamic endpoint |
| Marswalk & Mission Analysis | Time-specific communication availability | Dynamic | Awaiting dynamic endpoint |
| Marswalk & Mission Analysis | EVA environmental exposure along routes | Dynamic | Awaiting dynamic endpoint |
| Marswalk & Mission Analysis | Time-dependent route energy requirements | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | GCR surface dose estimate | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | SEP surface dose estimate | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Total ionizing radiation dose estimate | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Galactic cosmic-ray particle flux | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | High-energy proton flux | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Alpha-particle flux | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Heavy-ion / HZE flux | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Energetic electron flux | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Secondary neutron flux | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Secondary neutron dose estimate | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Secondary gamma-ray flux | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Secondary gamma-ray dose estimate | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Secondary proton / ion flux | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Secondary electron and positron flux | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Secondary muon flux | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Upward-emitted albedo neutron radiation | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Upward-emitted albedo gamma radiation | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Absorbed dose rate (Gy/time) | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Dose equivalent rate (Sv/time) | Dynamic | Awaiting dynamic endpoint |
| Radiation & Exposure | Cumulative Marswalk radiation exposure | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | Mars-directed SEP event intensity / forecast | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | Solar storm / CME arrival forecast | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | Solar radiation event status | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | Solar flare observations | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | Solar X-ray flux | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | Solar extreme-ultraviolet flux | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | Solar wind speed | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | Solar wind density | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | Interplanetary magnetic field | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | Heliospheric magnetic connectivity | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | GCR solar-cycle modulation | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | Solar particle energy spectra | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | Space-weather forecast uncertainty | Dynamic | Awaiting dynamic endpoint |
| Space Weather & Solar Activity | Mars-specific energetic particle observations | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Surface temperature | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Atmospheric dust opacity | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Solar UV exposure | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Atmospheric pressure | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Atmospheric column density | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Near-surface atmospheric density | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Atmospheric temperature | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Wind speed | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Wind direction | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Dust storm extent | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Atmospheric water-ice clouds | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | UVA irradiance | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | UVB irradiance | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Surface-reaching UVC irradiance | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Visible solar irradiance | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Solar infrared irradiance | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Thermal infrared emission from the surface | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Day/night surface temperature variation | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Solar elevation angle | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Surface solar illumination | Dynamic | Awaiting dynamic endpoint |
| Atmosphere, Solar & Thermal Environment | Seasonal COÃ¢â€šâ€š frost distribution | Dynamic | Awaiting dynamic endpoint |


The atmospheric Wind speed entry now connects the NASA Mars Explorer
current-hour **EMARS climatology** with speed shading, downwind arrows, units
and source-time readouts. It is not labelled as live measured weather. See
[Wind overlay](wind-overlay.md) for the numerical contract and limits.

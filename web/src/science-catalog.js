// Catalog names and classifications supplied by the project owner.
import {DYNAMIC_DEFINITIONS,DYNAMIC_BLOCKERS} from './dynamic-overlay-definitions.js';
import {SOURCE_OVERLAY_DEFINITIONS,DYNAMIC_RESEARCH} from './dynamic-source-research.js';
import {ADDITIONAL_STATIC_OVERLAYS} from './additional-static-overlays.js';
import {STATIC_REQUIREMENTS} from './overlay-roadmap.js';
export const SCIENCE_GROUPS=[{"id": 1, "name": "Terrain & Topography"}, {"id": 2, "name": "Geology & Surface History"}, {"id": 3, "name": "Minerals & Surface Properties"}, {"id": 4, "name": "Water, Ice & Subsurface"}, {"id": 5, "name": "Geophysics & Natural Radioactivity"}, {"id": 6, "name": "Marswalk & Mission Analysis"}, {"id": 7, "name": "Radiation & Exposure"}, {"id": 8, "name": "Space Weather & Solar Activity"}, {"id": 9, "name": "Atmosphere, Solar & Thermal Environment"}];
export const SCIENCE_CATALOG=[
 {
  "id": "elevation-gradient",
  "name": "Elevation gradient",
  "group": 1,
  "type": "static",
  "engine": "existing",
  "reason": null,
  "key": "elevation",
  "description": "Measured height colors over surface photography; not slope or color photography.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   }
  ],
  "coverage": "HRSC/MOLA with coarse MOLA fallback.",
  "recommended": true
 },
 {
  "id": "slope-steepness",
  "name": "Slope steepness",
  "group": 1,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "slope-steepness",
  "metric": "slope",
  "min": 0,
  "max": 40,
  "units": "°",
  "description": "Horn 3×3 finite-difference slope on the source grid. Coarse slopes cannot resolve rocks, small cliffs or EVA hazards.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "terrain-roughness",
  "name": "Terrain roughness",
  "group": 1,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "terrain-roughness",
  "metric": "roughness",
  "min": 0,
  "max": 300,
  "units": "m RMS",
  "description": "RMS height residual after subtracting the central tangent plane in a 3×3 neighborhood; scale dependent.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "terrain-ruggedness",
  "name": "Terrain ruggedness",
  "group": 1,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "terrain-ruggedness",
  "metric": "ruggedness",
  "min": 0,
  "max": 1000,
  "units": "m RMS",
  "description": "RMS elevation difference between the centre and eight neighbors. This is a stated RMS ruggedness metric, not an unlabelled hazard score.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "slope-aspect",
  "name": "Slope aspect",
  "group": 1,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "slope-aspect",
  "metric": "aspect",
  "min": 0,
  "max": 360,
  "units": "° downslope from north",
  "description": "Downslope compass direction; flat terrain and the coordinate-pole neighborhood are transparent.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "terrain-curvature",
  "name": "Terrain curvature",
  "group": 1,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "terrain-curvature",
  "metric": "curvature",
  "min": -1,
  "max": 1,
  "units": "km⁻¹",
  "description": "Four-neighbor Laplacian of elevation; positive values indicate a locally concave surface. Not geological curvature.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "terrain-landform-classification",
  "name": "Terrain landform classification",
  "group": 1,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "terrain-landform-classification",
  "metric": "landform",
  "min": 0,
  "max": 3,
  "units": "local terrain class",
  "description": "Terrain-only heuristic: 0 depression, 1 level/intermediate, 2 ridge, 3 slope. TPI threshold max(10 m, 20% relief); slope threshold 5°. Not mapped geological units.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "local-relief-elevation-variation",
  "name": "Local relief / elevation variation",
  "group": 1,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "local-relief-elevation-variation",
  "metric": "relief",
  "min": 0,
  "max": 2000,
  "units": "m",
  "description": "Maximum minus minimum height within the source-grid 3×3 neighborhood.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "terrain-hillshade-fixed-lighting",
  "name": "Terrain hillshade (fixed lighting)",
  "group": 1,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "terrain-hillshade-fixed-lighting",
  "metric": "hillshade",
  "min": 0,
  "max": 1,
  "units": "illumination factor",
  "description": "Fixed simulated illumination: azimuth 315°, solar elevation 45°, no relief exaggeration. This is not current sunlight.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "topographic-sky-visibility",
  "name": "Topographic sky visibility",
  "group": 1,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "topographic-sky-visibility",
  "metric": "sky",
  "min": 0,
  "max": 1,
  "units": "local sky-view factor",
  "description": "Eight-direction horizon approximation, sampled at 1, 2 and 4 source cells. Mean cos² of the positive horizon angle. Distant terrain beyond this window is omitted.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "contours",
  "name": "Contour lines",
  "group": 1,
  "type": "static",
  "engine": "contours",
  "reason": null,
  "key": "contours",
  "description": "Independent elevation isolines over any scientific heatmap. Local view only; line interval is adjustable. Heights are relative to the Mars terrain datum.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   }
  ],
  "coverage": "Visible HRSC/MOLA or MOLA grid; hidden at globe scale.",
  "recommended": false
 },
 {
  "id": "geological-units",
  "name": "Geological units",
  "group": 2,
  "type": "static",
  "engine": null,
  "reason": "USGS SIM 3292 spatial package still needs preparation; no substitute geology inferred from imagery.",
  "key": "geological-units",
  "recommended": false
 },
 {
  "id": "geological-ages",
  "name": "Geological ages",
  "group": 2,
  "type": "static",
  "engine": null,
  "reason": "USGS SIM 3292 spatial package still needs preparation; no substitute geology inferred from imagery.",
  "key": "geological-ages",
  "recommended": false
 },
 {
  "id": "impact-crater-density",
  "name": "Impact crater density",
  "group": 2,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "impact-crater-density",
  "recommended": false
 },
 {
  "id": "ancient-river-valley-distribution",
  "name": "Ancient river valley distribution",
  "group": 2,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "ancient-river-valley-distribution",
  "recommended": false
 },
 {
  "id": "ancient-lakebed-distribution",
  "name": "Ancient lakebed distribution",
  "group": 2,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "ancient-lakebed-distribution",
  "recommended": false
 },
 {
  "id": "delta-and-sedimentary-deposit-distribution",
  "name": "Delta and sedimentary deposit distribution",
  "group": 2,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "delta-and-sedimentary-deposit-distribution",
  "recommended": false
 },
 {
  "id": "volcanic-terrain-classification",
  "name": "Volcanic terrain classification",
  "group": 2,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "volcanic-terrain-classification",
  "recommended": false
 },
 {
  "id": "fault-and-fracture-density",
  "name": "Fault and fracture density",
  "group": 2,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "fault-and-fracture-density",
  "recommended": false
 },
 {
  "id": "ancient-drainage-network-density",
  "name": "Ancient drainage network density",
  "group": 2,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "ancient-drainage-network-density",
  "recommended": false
 },
 {
  "id": "impact-ejecta-distribution",
  "name": "Impact ejecta distribution",
  "group": 2,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "impact-ejecta-distribution",
  "recommended": false
 },
 {
  "id": "sedimentary-geological-formations",
  "name": "Sedimentary geological formations",
  "group": 2,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "sedimentary-geological-formations",
  "recommended": false
 },
 {
  "id": "tectonic-structure-classification",
  "name": "Tectonic structure classification",
  "group": 2,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "tectonic-structure-classification",
  "recommended": false
 },
 {
  "id": "mineral-composition",
  "name": "Mineral composition",
  "group": 3,
  "type": "static",
  "engine": "reference",
  "reason": null,
  "key": "mineral-composition",
  "asset": "olivine-abundance",
  "variants": [
   "olivine-abundance",
   "pyroxene-abundance",
   "hematite-abundance",
   "feldspar-abundance",
   "glass-clay"
  ],
  "min": 0,
  "max": 0.5,
  "units": "spectral fraction",
  "description": "Select a published TES spectral component. The glass/sheet-silicate product is ambiguous between glass and clay and is not treated as a unique clay detection.",
  "sources": [
   {
    "title": "ASU TES mineral maps / Bandfield (2002)",
    "url": "https://www.mars.asu.edu/data/"
   }
  ],
  "coverage": "≈15 km source sampling; NoData remains transparent. Components are model abundances, not in situ assays.",
  "recommended": false
 },
 {
  "id": "hydrated-minerals-clay-signatures",
  "name": "Hydrated minerals / clay signatures",
  "group": 3,
  "type": "static",
  "engine": "points",
  "reason": null,
  "key": "hydrated-minerals-clay-signatures",
  "description": "Published OMEGA/CRISM hydrated-mineral detection coordinates from Carter et al. (2013). Pins represent detection locations, not deposit boundaries or abundance; glass/clay ambiguity is retained in TES separately.",
  "sources": [
   {
    "title": "NASA PDS MEX OMEGA global maps",
    "url": "https://pds-geosciences.wustl.edu/mex/mex-m-omega-5-ddr-global-maps-v1/mexomg_2000/data/hydrous/"
   }
  ],
  "coverage": "Published detections; gaps do not establish mineral absence.",
  "recommended": true
 },
 {
  "id": "thermal-inertia",
  "name": "Thermal inertia",
  "group": 3,
  "type": "static",
  "engine": "reference",
  "reason": null,
  "key": "thermal-inertia",
  "asset": "thermal-inertia",
  "min": 0,
  "max": 600,
  "units": "J m⁻² K⁻¹ s⁻½",
  "description": "Published NASA MGS/TES thermal-inertia reference, delivered from the ASU numeric map service. Thermal inertia describes resistance to temperature changes; it is not a current temperature measurement.",
  "sources": [
   {
    "title": "ASU Mars Global Data Sets / TES",
    "url": "https://www.mars.asu.edu/data/"
   }
  ],
  "coverage": "Global reference grid with source gaps preserved. TES mineral sampling ≈15 km; albedo ≈7.5 km; thermal inertia is delivered at ≈30 km sampling from an ≈7.5 km source. Survey-era reference, not current conditions.",
  "recommended": false
 },
 {
  "id": "olivine-abundance",
  "name": "Olivine abundance",
  "group": 3,
  "type": "static",
  "engine": "reference",
  "reason": null,
  "key": "olivine-abundance",
  "asset": "olivine-abundance",
  "min": 0,
  "max": 0.3,
  "units": "spectral fraction",
  "description": "Published NASA MGS/TES reference product delivered from the author-listed ASU numeric service. Mineral fractions are spectral unmixing estimates, not ore grade or confirmed extraction potential.",
  "sources": [
   {
    "title": "ASU Mars Global Data Sets / TES",
    "url": "https://www.mars.asu.edu/data/"
   }
  ],
  "coverage": "Global reference grid with source gaps preserved. TES mineral sampling ≈15 km; albedo ≈7.5 km; thermal inertia is delivered at ≈30 km sampling from an ≈7.5 km source. Survey-era reference, not current conditions.",
  "recommended": false
 },
 {
  "id": "pyroxene-abundance",
  "name": "Pyroxene abundance",
  "group": 3,
  "type": "static",
  "engine": "reference",
  "reason": null,
  "key": "pyroxene-abundance",
  "asset": "pyroxene-abundance",
  "min": 0,
  "max": 0.5,
  "units": "spectral fraction",
  "description": "Published NASA MGS/TES reference product delivered from the author-listed ASU numeric service. Mineral fractions are spectral unmixing estimates, not ore grade or confirmed extraction potential.",
  "sources": [
   {
    "title": "ASU Mars Global Data Sets / TES",
    "url": "https://www.mars.asu.edu/data/"
   }
  ],
  "coverage": "Global reference grid with source gaps preserved. TES mineral sampling ≈15 km; albedo ≈7.5 km; thermal inertia is delivered at ≈30 km sampling from an ≈7.5 km source. Survey-era reference, not current conditions.",
  "recommended": false
 },
 {
  "id": "hematite-abundance",
  "name": "Hematite abundance",
  "group": 3,
  "type": "static",
  "engine": "reference",
  "reason": null,
  "key": "hematite-abundance",
  "asset": "hematite-abundance",
  "min": 0,
  "max": 0.3,
  "units": "spectral fraction",
  "description": "Published NASA MGS/TES reference product delivered from the author-listed ASU numeric service. Mineral fractions are spectral unmixing estimates, not ore grade or confirmed extraction potential.",
  "sources": [
   {
    "title": "ASU Mars Global Data Sets / TES",
    "url": "https://www.mars.asu.edu/data/"
   }
  ],
  "coverage": "Global reference grid with source gaps preserved. TES mineral sampling ≈15 km; albedo ≈7.5 km; thermal inertia is delivered at ≈30 km sampling from an ≈7.5 km source. Survey-era reference, not current conditions.",
  "recommended": false
 },
 {
  "id": "feldspar-abundance",
  "name": "Feldspar abundance",
  "group": 3,
  "type": "static",
  "engine": "reference",
  "reason": null,
  "key": "feldspar-abundance",
  "asset": "feldspar-abundance",
  "min": 0,
  "max": 0.3,
  "units": "spectral fraction (K-feldspar)",
  "description": "Published NASA MGS/TES reference product delivered from the author-listed ASU numeric service. Mineral fractions are spectral unmixing estimates, not ore grade or confirmed extraction potential.",
  "sources": [
   {
    "title": "ASU Mars Global Data Sets / TES",
    "url": "https://www.mars.asu.edu/data/"
   }
  ],
  "coverage": "Global reference grid with source gaps preserved. TES mineral sampling ≈15 km; albedo ≈7.5 km; thermal inertia is delivered at ≈30 km sampling from an ≈7.5 km source. Survey-era reference, not current conditions.",
  "recommended": false
 },
 {
  "id": "sulfate-signatures",
  "name": "Sulfate signatures",
  "group": 3,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "sulfate-signatures",
  "recommended": false
 },
 {
  "id": "surface-albedo-reference-composite",
  "name": "Surface albedo (reference composite)",
  "group": 3,
  "type": "static",
  "engine": "reference",
  "reason": null,
  "key": "surface-albedo-reference-composite",
  "asset": "surface-albedo-reference-composite",
  "min": 0,
  "max": 0.4,
  "units": "Lambert albedo",
  "description": "Published NASA MGS/TES Lambert-albedo reference from the ASU numeric service. Values are unitless reflectivity estimates, not elevation, current lighting or mineral abundance.",
  "sources": [
   {
    "title": "ASU Mars Global Data Sets / TES",
    "url": "https://www.mars.asu.edu/data/"
   }
  ],
  "coverage": "Global reference grid with source gaps preserved. TES mineral sampling ≈15 km; albedo ≈7.5 km; thermal inertia is delivered at ≈30 km sampling from an ≈7.5 km source. Survey-era reference, not current conditions.",
  "recommended": false
 },
 {
  "id": "surface-dust-cover-index-reference-composite",
  "name": "Surface dust cover index (reference composite)",
  "group": 3,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "surface-dust-cover-index-reference-composite",
  "recommended": false
 },
 {
  "id": "rock-abundance",
  "name": "Rock abundance",
  "group": 3,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "rock-abundance",
  "recommended": false
 },
 {
  "id": "mafic-mineral-composition",
  "name": "Mafic mineral composition",
  "group": 3,
  "type": "static",
  "engine": "reference",
  "reason": null,
  "key": "mafic-mineral-composition",
  "asset": "olivine-abundance",
  "variants": [
   "olivine-abundance",
   "pyroxene-abundance"
  ],
  "min": 0,
  "max": 0.5,
  "units": "spectral fraction",
  "description": "Select a published TES spectral component. The glass/sheet-silicate product is ambiguous between glass and clay and is not treated as a unique clay detection.",
  "sources": [
   {
    "title": "ASU TES mineral maps / Bandfield (2002)",
    "url": "https://www.mars.asu.edu/data/"
   }
  ],
  "coverage": "≈15 km source sampling; NoData remains transparent. Components are model abundances, not in situ assays.",
  "recommended": false
 },
 {
  "id": "spectral-alteration-indices",
  "name": "Spectral alteration indices",
  "group": 3,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "spectral-alteration-indices",
  "recommended": false
 },
 {
  "id": "subsurface-water-ice-likelihood",
  "name": "Subsurface water-ice likelihood",
  "group": 4,
  "type": "static",
  "engine": "reference",
  "reason": null,
  "key": "subsurface-water-ice-likelihood",
  "asset": "mons-weh",
  "variants": [
   "mons-weh",
   "ice-0_1",
   "ice-1_5",
   "ice-5"
  ],
  "min": -1,
  "max": 1,
  "units": "signed ice consistency",
  "description": "Global view: Mars Odyssey/MONS water-equivalent hydrogen (Wilson et al., 2017), including both polar regions. Hydrogen can be in ice or hydrated material; this is not ice probability. For regional evidence choose a SWIM4IMIM depth composite: −1 inconsistent, 0 no indication, +1 consistent with ice. Products retain separate units and scales; neither measures extractable reserves.",
  "sources": [
   {
    "title": "Wilson et al. (2017) · MONS hydrogen reconstruction",
    "url": "https://doi.org/10.1016/j.icarus.2017.07.028"
   },
   {
    "title": "ASU JMARS · published numeric-map service",
    "url": "https://www.mars.asu.edu/data/"
   },
   {
    "title": "PSI / JPL SWIM products and methodology",
    "url": "https://swim.psi.edu/SWIM4MIMProducts.php"
   }
  ],
  "coverage": "MONS: full globe, 0.5° delivered grid (~30 km at equator), ~290 km effective resolution. SWIM: 60°S–60°N only, ~3 km grid with varying sensor footprints. No SWIM extrapolation into polar areas; smooth shading does not improve scientific resolution.",
  "recommended": true
 },
 {
  "id": "water-equivalent-hydrogen",
  "name": "Water-equivalent hydrogen",
  "group": 4,
  "type": "static",
  "engine": "reference",
  "reason": null,
  "key": "water-equivalent-hydrogen",
  "recommended": false,
  "asset": "water-equivalent-hydrogen",
  "variants": [
   "water-equivalent-hydrogen",
   "water-equivalent-hydrogen-sigma"
  ],
  "min": 0,
  "max": 20,
  "units": "weight % H₂O equivalent",
  "description": "NASA Odyssey GRS v2.0 unsmoothed 5° water-equivalent-hydrogen bins in weight percent, observed 2002-06-04 to 2005-04-03. Concentration and published 1σ statistical uncertainty are separate choices. Invalid bins remain transparent and negative peak-fit estimates are retained. Hydrogen can occur in different materials and does not establish accessible ice.",
  "coverage": "5° bins (≈296 km at equator); effective sensor footprint is broad. Source masks and fit uncertainties remain meaningful. No sharpening or extrapolation into invalid polar bins.",
  "sources": [
   {
    "title": "NASA PDS Odyssey GRS element products",
    "url": "https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html"
   },
   {
    "title": "Boynton et al. (2007)",
    "url": "https://doi.org/10.1029/2007JE002887"
   }
  ]
 },
 {
  "id": "estimated-subsurface-ice-depth",
  "name": "Estimated subsurface ice depth",
  "group": 4,
  "type": "static",
  "engine": null,
  "reason": "SWIM sensing-depth bands are available under ice likelihood; they are not measured depth or calibrated confidence.",
  "key": "estimated-subsurface-ice-depth",
  "recommended": false
 },
 {
  "id": "ice-evidence-confidence",
  "name": "Ice evidence confidence",
  "group": 4,
  "type": "static",
  "engine": null,
  "reason": "SWIM sensing-depth bands are available under ice likelihood; they are not measured depth or calibrated confidence.",
  "key": "ice-evidence-confidence",
  "recommended": false
 },
 {
  "id": "modeled-resource-accessibility",
  "name": "Modeled resource accessibility",
  "group": 4,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "modeled-resource-accessibility",
  "recommended": false
 },
 {
  "id": "subsurface-radar-reflector-interpretations",
  "name": "Subsurface radar reflector interpretations",
  "group": 4,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "subsurface-radar-reflector-interpretations",
  "recommended": false
 },
 {
  "id": "subsurface-ice-stability-estimates-under-defined-conditions",
  "name": "Subsurface ice stability estimates under defined conditions",
  "group": 4,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "subsurface-ice-stability-estimates-under-defined-conditions",
  "recommended": false
 },
 {
  "id": "seasonal-surface-frost-coverage",
  "name": "Seasonal surface frost coverage",
  "group": 4,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "seasonal-surface-frost-coverage",
  "recommended": false
 },
 {
  "id": "seasonal-subsurface-thermal-conditions",
  "name": "Seasonal subsurface thermal conditions",
  "group": 4,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "seasonal-subsurface-thermal-conditions",
  "recommended": false
 },
 {
  "id": "crustal-magnetic-field-strength",
  "name": "Crustal magnetic field strength",
  "group": 5,
  "type": "static",
  "engine": "existing",
  "reason": null,
  "key": "magnetic",
  "description": "Langlais et al. (2019) static crustal |B| model; not live solar-wind magnetism.",
  "sources": [
   {
    "title": "Author-published coefficients",
    "url": "https://doi.org/10.5281/zenodo.3876714"
   }
  ],
  "coverage": "Global model; ≈160 km surface resolving power.",
  "recommended": true
 },
 {
  "id": "potassium-abundance",
  "name": "Potassium abundance",
  "group": 5,
  "type": "static",
  "engine": "reference",
  "reason": null,
  "key": "potassium-abundance",
  "recommended": false,
  "asset": "potassium-abundance",
  "variants": [
   "potassium-abundance",
   "potassium-abundance-sigma"
  ],
  "min": 0,
  "max": 1,
  "units": "weight % K",
  "description": "NASA Odyssey GRS v2.0 unsmoothed 5° potassium bins in weight percent, observed 2002-06-04 to 2005-04-03. Concentration and published 1σ statistical uncertainty are separate choices. Invalid bins remain transparent and negative peak-fit estimates are retained; these are not mineable grades or radiation-dose measurements.",
  "coverage": "5° bins (≈296 km at equator); effective sensor footprint is broad. Source masks and fit uncertainties remain meaningful. No sharpening or extrapolation into invalid polar bins.",
  "sources": [
   {
    "title": "NASA PDS Odyssey GRS element products",
    "url": "https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html"
   },
   {
    "title": "Boynton et al. (2007)",
    "url": "https://doi.org/10.1029/2007JE002887"
   }
  ]
 },
 {
  "id": "thorium-abundance",
  "name": "Thorium abundance",
  "group": 5,
  "type": "static",
  "engine": "reference",
  "reason": null,
  "key": "thorium-abundance",
  "recommended": false,
  "asset": "thorium-abundance",
  "variants": [
   "thorium-abundance",
   "thorium-abundance-sigma"
  ],
  "min": 0,
  "max": 2,
  "units": "ppm Th",
  "description": "NASA Odyssey GRS v2.0 unsmoothed 5° thorium bins, observed 2002-06-04 to 2005-04-03. Weight percent is converted to ppm by multiplying by 10,000. Concentration and published 1σ statistical uncertainty are separate choices. Invalid bins remain transparent and negative peak-fit estimates are retained; thorium concentration is not radiation dose or extractable reserves.",
  "coverage": "5° bins (≈296 km at equator); effective sensor footprint is broad. Source masks and fit uncertainties remain meaningful. No sharpening or extrapolation into invalid polar bins.",
  "sources": [
   {
    "title": "NASA PDS Odyssey GRS element products",
    "url": "https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html"
   },
   {
    "title": "Boynton et al. (2007)",
    "url": "https://doi.org/10.1029/2007JE002887"
   }
  ]
 },
 {
  "id": "gravity-anomalies",
  "name": "Gravity anomalies",
  "group": 5,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "gravity-anomalies",
  "recommended": false
 },
 {
  "id": "crustal-magnetic-anomalies-vector-components",
  "name": "Crustal magnetic anomalies / vector components",
  "group": 5,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "crustal-magnetic-anomalies-vector-components",
  "recommended": false
 },
 {
  "id": "uranium-abundance-only-if-defensibly-mapped",
  "name": "Uranium abundance (only if defensibly mapped)",
  "group": 5,
  "type": "static",
  "engine": null,
  "reason": "No defensibly verified spatial model connected; elemental presence cannot be substituted for measured radiation dose.",
  "key": "uranium-abundance-only-if-defensibly-mapped",
  "recommended": false
 },
 {
  "id": "natural-gamma-emission-potential",
  "name": "Natural gamma emission potential",
  "group": 5,
  "type": "static",
  "engine": null,
  "reason": "No defensibly verified spatial model connected; elemental presence cannot be substituted for measured radiation dose.",
  "key": "natural-gamma-emission-potential",
  "recommended": false
 },
 {
  "id": "natural-alpha-radioactivity-potential",
  "name": "Natural alpha radioactivity potential",
  "group": 5,
  "type": "static",
  "engine": null,
  "reason": "No defensibly verified spatial model connected; elemental presence cannot be substituted for measured radiation dose.",
  "key": "natural-alpha-radioactivity-potential",
  "recommended": false
 },
 {
  "id": "natural-beta-radioactivity-potential",
  "name": "Natural beta radioactivity potential",
  "group": 5,
  "type": "static",
  "engine": null,
  "reason": "No defensibly verified spatial model connected; elemental presence cannot be substituted for measured radiation dose.",
  "key": "natural-beta-radioactivity-potential",
  "recommended": false
 },
 {
  "id": "modeled-geothermal-heat-flow-distribution",
  "name": "Modeled geothermal heat-flow distribution",
  "group": 5,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "modeled-geothermal-heat-flow-distribution",
  "recommended": false
 },
 {
  "id": "traversal-difficulty",
  "name": "Traversal difficulty",
  "group": 6,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "traversal-difficulty",
  "metric": "difficulty",
  "min": 0,
  "max": 100,
  "units": "terrain index",
  "description": "Terrain-only screening: 100 × min(1, 0.7 × slope/40° + 0.3 × RMS roughness/300 m). Project heuristic, not a safety probability.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "terrain-data-confidence",
  "name": "Terrain-data confidence",
  "group": 6,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "terrain-data-confidence",
  "metric": "confidence",
  "min": 0,
  "max": 1,
  "units": "source tier",
  "description": "Source availability proxy: 0 = coarse MOLA fallback; 1 = validated HRSC/MOLA source. This is not statistical confidence or navigational certification. HiRISE source confidence is not included.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "landing-terrain-suitability",
  "name": "Landing terrain suitability",
  "group": 6,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "landing-terrain-suitability",
  "metric": "suitability",
  "min": 0,
  "max": 100,
  "units": "terrain screening index",
  "description": "100 minus the stated traversal difficulty index. Terrain-only illustrative screening: rocks, atmospheric entry, soil strength, hazards and mission constraints are not assessed.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "terrain-shielding-potential-sky-obstruction",
  "name": "Terrain shielding potential / sky obstruction",
  "group": 6,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "terrain-shielding-potential-sky-obstruction",
  "metric": "shield",
  "min": 0,
  "max": 1,
  "units": "local sky obstruction",
  "description": "One minus the local sky-view factor. Pure geometry; does not calculate radiation dose or particle shielding effectiveness.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "science-target-density",
  "name": "Science target density",
  "group": 6,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "science-target-density",
  "recommended": false
 },
 {
  "id": "baseline-route-energy-cost-surface",
  "name": "Baseline route energy-cost surface",
  "group": 6,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "baseline-route-energy-cost-surface",
  "metric": "energy",
  "min": 0,
  "max": 25,
  "units": "J kg⁻¹ m⁻¹ (Earth model)",
  "description": "Minetti polynomial from the preserved partner algorithm evaluated for uphill travel in the steepest local direction, gradient capped at ±0.45; minimum cost 1.2 J kg⁻¹ m⁻¹. Mass and Mars-gravity scaling are not applied. Actual route energy is direction dependent; use Routes for mission-specific calculations.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "terrain-accessibility-classification",
  "name": "Terrain accessibility classification",
  "group": 6,
  "type": "static",
  "engine": "terrain",
  "reason": null,
  "key": "terrain-accessibility-classification",
  "metric": "accessibility",
  "min": 0,
  "max": 3,
  "units": "slope class",
  "description": "Terrain-only slope classes: 0 under 5°, 1 from 5–15°, 2 from 15–30°, 3 at least 30°. No route clearance or crew-safety guarantee.",
  "sources": [
   {
    "title": "NASA MOLA / ESA HRSC measured topography",
    "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"
   },
   {
    "title": "Terrain-method reference (GDAL)",
    "url": "https://gdal.org/en/stable/programs/gdaldem.html"
   }
  ],
  "coverage": "Global measured topography. HRSC/MOLA ≈200 m where validated; otherwise coarse ≈15 km MOLA. Calculation neighborhood changes with map scale; no artificial fine detail.",
  "recommended": false
 },
 {
  "id": "terrain-based-communication-line-of-sight-potential",
  "name": "Terrain-based communication line-of-sight potential",
  "group": 6,
  "type": "static",
  "engine": null,
  "reason": "Requires a defined transmitter/site, antenna geometry and a validated visibility model.",
  "key": "terrain-based-communication-line-of-sight-potential",
  "recommended": false
 },
 {
  "id": "fixed-site-communication-visibility",
  "name": "Fixed-site communication visibility",
  "group": 6,
  "type": "static",
  "engine": null,
  "reason": "Requires a defined transmitter/site, antenna geometry and a validated visibility model.",
  "key": "fixed-site-communication-visibility",
  "recommended": false
 },
 {
  "id": "local-solar-horizon-geometry",
  "name": "Local solar-horizon geometry",
  "group": 6,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "local-solar-horizon-geometry",
  "recommended": false
 },
 {
  "id": "potential-sampling-site-suitability",
  "name": "Potential sampling-site suitability",
  "group": 6,
  "type": "static",
  "engine": null,
  "reason": "Published spatial product or defensible model still required",
  "key": "potential-sampling-site-suitability",
  "recommended": false
 },
 {
  "id": "solar-illumination-and-terrain-shadows",
  "name": "Solar illumination and terrain shadows",
  "group": 6,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "solar-illumination-and-terrain-shadows",
  "recommended": false
 },
 {
  "id": "time-specific-communication-availability",
  "name": "Time-specific communication availability",
  "group": 6,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "time-specific-communication-availability",
  "recommended": false
 },
 {
  "id": "eva-environmental-exposure-along-routes",
  "name": "EVA environmental exposure along routes",
  "group": 6,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "eva-environmental-exposure-along-routes",
  "recommended": false
 },
 {
  "id": "time-dependent-route-energy-requirements",
  "name": "Time-dependent route energy requirements",
  "group": 6,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "time-dependent-route-energy-requirements",
  "recommended": false
 },
 {
  "id": "gcr-surface-dose-estimate",
  "name": "GCR surface dose estimate",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "gcr-surface-dose-estimate",
  "recommended": false
 },
 {
  "id": "sep-surface-dose-estimate",
  "name": "SEP surface dose estimate",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "sep-surface-dose-estimate",
  "recommended": false
 },
 {
  "id": "total-ionizing-radiation-dose-estimate",
  "name": "Total ionizing radiation dose estimate",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "total-ionizing-radiation-dose-estimate",
  "recommended": false
 },
 {
  "id": "galactic-cosmic-ray-particle-flux",
  "name": "Galactic cosmic-ray particle flux",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "galactic-cosmic-ray-particle-flux",
  "recommended": false
 },
 {
  "id": "high-energy-proton-flux",
  "name": "High-energy proton flux",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "high-energy-proton-flux",
  "recommended": false
 },
 {
  "id": "alpha-particle-flux",
  "name": "Alpha-particle flux",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "alpha-particle-flux",
  "recommended": false
 },
 {
  "id": "heavy-ion-hze-flux",
  "name": "Heavy-ion / HZE flux",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "heavy-ion-hze-flux",
  "recommended": false
 },
 {
  "id": "energetic-electron-flux",
  "name": "Energetic electron flux",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "energetic-electron-flux",
  "recommended": false
 },
 {
  "id": "secondary-neutron-flux",
  "name": "Secondary neutron flux",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "secondary-neutron-flux",
  "recommended": false
 },
 {
  "id": "secondary-neutron-dose-estimate",
  "name": "Secondary neutron dose estimate",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "secondary-neutron-dose-estimate",
  "recommended": false
 },
 {
  "id": "secondary-gamma-ray-flux",
  "name": "Secondary gamma-ray flux",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "secondary-gamma-ray-flux",
  "recommended": false
 },
 {
  "id": "secondary-gamma-ray-dose-estimate",
  "name": "Secondary gamma-ray dose estimate",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "secondary-gamma-ray-dose-estimate",
  "recommended": false
 },
 {
  "id": "secondary-proton-ion-flux",
  "name": "Secondary proton / ion flux",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "secondary-proton-ion-flux",
  "recommended": false
 },
 {
  "id": "secondary-electron-and-positron-flux",
  "name": "Secondary electron and positron flux",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "secondary-electron-and-positron-flux",
  "recommended": false
 },
 {
  "id": "secondary-muon-flux",
  "name": "Secondary muon flux",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "secondary-muon-flux",
  "recommended": false
 },
 {
  "id": "upward-emitted-albedo-neutron-radiation",
  "name": "Upward-emitted albedo neutron radiation",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "upward-emitted-albedo-neutron-radiation",
  "recommended": false
 },
 {
  "id": "upward-emitted-albedo-gamma-radiation",
  "name": "Upward-emitted albedo gamma radiation",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "upward-emitted-albedo-gamma-radiation",
  "recommended": false
 },
 {
  "id": "absorbed-dose-rate-gy-time",
  "name": "Local absorbed dose rate · Curiosity RAD",
  "group": 7,
  "type": "dynamic",
  "engine": "feed",
  "reason": null,
  "key": "absorbed-dose-rate-gy-time",
  "recommended": false,
  "feed": "rad",
  "description": "Recent absorbed-dose readings at Curiosity, with a selectable silicon B or plastic E detector and local trend history.",
  "reading": "Read microgray per day (µGy/day) in the selected detector material. B RTG-corrected is the default; B raw and E total remain separate.",
  "coverage": "Quicklook for display; use SPDF/PDS science products for analysis or publication. Local to Curiosity, often delayed. No tissue/organ dose-equivalent conversion, global footprint, or route exposure. Gale marker is a reference, not time-matched rover geometry.",
  "sources": [
   {
    "title": "NASA ISWA RAD quicklook contract",
    "url": "https://iswa.ccmc.gsfc.nasa.gov/meta/information/MSL_RAD_Timeline.html"
   },
   {
    "title": "RAD science history · separate calibrated archive",
    "url": "https://spdf.gsfc.nasa.gov/pub/data/aaa_planetary/msl/rad/cdf/obs-l2/"
   }
  ]
 },
 {
  "id": "dose-equivalent-rate-sv-time",
  "name": "Dose equivalent rate (Sv/time)",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "dose-equivalent-rate-sv-time",
  "recommended": false
 },
 {
  "id": "cumulative-marswalk-radiation-exposure",
  "name": "Cumulative Marswalk radiation exposure",
  "group": 7,
  "type": "dynamic",
  "engine": null,
  "reason": "Requires a validated Mars surface transport/response model or species-resolved source. Available detector readings and forecasts do not supply this quantity.",
  "key": "cumulative-marswalk-radiation-exposure",
  "recommended": false
 },
 {
  "id": "mars-directed-sep-event-intensity-forecast",
  "name": "Mars-directed SEP event intensity / forecast",
  "group": 8,
  "type": "dynamic",
  "engine": "feed",
  "reason": null,
  "key": "mars-directed-sep-event-intensity-forecast",
  "recommended": false,
  "feed": "ipath",
  "description": "Experimental iPATH forecasts of integral solar-proton flux at the Mars heliospheric observer.",
  "reading": "Each energy threshold has a predicted peak in pfu and its own validity window. Issue time and forecast expiry remain visible; overlapping channels are not summed.",
  "coverage": "Forecast outside the surface, not a measurement or surface-dose prediction. Early event phases can be missed. A model threshold result never grants EVA clearance.",
  "sources": [
   {
    "title": "NASA CCMC iPATH model and limitations",
    "url": "https://ccmc.gsfc.nasa.gov/models/iPATH~2/"
   }
  ]
 },
 {
  "id": "solar-storm-cme-arrival-forecast",
  "name": "Mars CME / shock arrival forecast",
  "group": 8,
  "type": "dynamic",
  "engine": "feed",
  "reason": null,
  "key": "solar-storm-cme-arrival-forecast",
  "recommended": false,
  "feed": "donki",
  "description": "DONKI WSA-ENLIL model runs that explicitly list Mars in their impact lists.",
  "reading": "Each card shows predicted arrival, model completion time, and source run. Multiple runs can revise the same CME; they are not independent events.",
  "coverage": "An arrival estimate is not a confirmed impact, SEP onset, or dose forecast. No listed Mars impacts does not establish quiet conditions or EVA safety.",
  "sources": [
   {
    "title": "NASA CCMC DONKI source and research limits",
    "url": "https://ccmc.gsfc.nasa.gov/tools/DONKI/"
   }
  ]
 },
 {
  "id": "solar-radiation-event-status",
  "name": "Solar radiation event status",
  "group": 8,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "solar-radiation-event-status",
  "recommended": false
 },
 {
  "id": "solar-flare-observations",
  "name": "Solar flare observations",
  "group": 8,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "solar-flare-observations",
  "recommended": false
 },
 {
  "id": "solar-x-ray-flux",
  "name": "Solar X-ray flux · Earth context",
  "group": 8,
  "type": "dynamic",
  "engine": "feed",
  "reason": null,
  "key": "solar-x-ray-flux",
  "recommended": false,
  "feed": "goes-xrays",
  "description": "NOAA GOES solar X-ray measurements from an Earth-orbit spacecraft, with separate wavelength bands.",
  "reading": "Choose a band to read flux in W/m². The primary satellite identity is preserved; contaminated samples remain missing.",
  "coverage": "Earth-view solar context. These are not X-rays measured at Mars or surface dose. Overlapping bands are not added.",
  "sources": [
   {
    "title": "NOAA GOES primary X-ray observations",
    "url": "https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json"
   }
  ]
 },
 {
  "id": "solar-extreme-ultraviolet-flux",
  "name": "Solar extreme-ultraviolet flux",
  "group": 8,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "solar-extreme-ultraviolet-flux",
  "recommended": false
 },
 {
  "id": "solar-wind-speed",
  "name": "Solar wind speed",
  "group": 8,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "solar-wind-speed",
  "recommended": false
 },
 {
  "id": "solar-wind-density",
  "name": "Solar wind density",
  "group": 8,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "solar-wind-density",
  "recommended": false
 },
 {
  "id": "interplanetary-magnetic-field",
  "name": "Interplanetary magnetic field",
  "group": 8,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "interplanetary-magnetic-field",
  "recommended": false
 },
 {
  "id": "heliospheric-magnetic-connectivity",
  "name": "Heliospheric magnetic connectivity",
  "group": 8,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "heliospheric-magnetic-connectivity",
  "recommended": false
 },
 {
  "id": "gcr-solar-cycle-modulation",
  "name": "GCR solar-cycle modulation",
  "group": 8,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "gcr-solar-cycle-modulation",
  "recommended": false
 },
 {
  "id": "solar-particle-energy-spectra",
  "name": "Mars proton energy spectrum · forecast",
  "group": 8,
  "type": "dynamic",
  "engine": "feed",
  "reason": null,
  "key": "solar-particle-energy-spectra",
  "recommended": false,
  "feed": "ipath",
  "view": "spectrum",
  "description": "The differential proton spectrum from the same iPATH run as the newest validated Mars forecast.",
  "reading": "Choose a prediction time. The chart uses logarithmic energy and intensity axes: MeV and protons/(cm² s sr MeV). Zero intensity cannot appear on a log axis.",
  "coverage": "Mars observer forecast, not a surface spectrum or absorbed dose. A spectrum from a different issue is never substituted. Expired runs stay marked expired.",
  "sources": [
   {
    "title": "NASA CCMC iPATH model",
    "url": "https://ccmc.gsfc.nasa.gov/models/iPATH~2/"
   }
  ]
 },
 {
  "id": "space-weather-forecast-uncertainty",
  "name": "Space-weather forecast uncertainty",
  "group": 8,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "space-weather-forecast-uncertainty",
  "recommended": false
 },
 {
  "id": "mars-specific-energetic-particle-observations",
  "name": "Mars orbital particle indicator · Mars Express",
  "group": 8,
  "type": "dynamic",
  "engine": "feed",
  "reason": null,
  "key": "mars-specific-energetic-particle-observations",
  "recommended": false,
  "feed": "mex",
  "description": "Mars Express ASPERA-3/IMA penetrating-particle background and total instrument counts in Mars orbit.",
  "reading": "Counts include combined protons above 20 MeV and electrons above 1 MeV, reported as 192-second averages. The two species cannot be separated here.",
  "coverage": "Spacecraft indicator only. Counts are not calibrated particle flux, surface radiation, or human dose. No orbit track is drawn without ephemeris.",
  "sources": [
   {
    "title": "NASA ISWA Mars Express metadata",
    "url": "https://iswa.ccmc.gsfc.nasa.gov/hapi/info?id=mars_express_aspera3_ima_ep"
   }
  ]
 },
 {
  "id": "surface-temperature",
  "name": "Surface temperature",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "surface-temperature",
  "recommended": false
 },
 {
  "id": "atmospheric-dust-opacity",
  "name": "Atmospheric dust opacity",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "atmospheric-dust-opacity",
  "recommended": false
 },
 {
  "id": "solar-uv-exposure",
  "name": "Solar UV exposure",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "solar-uv-exposure",
  "recommended": false
 },
 {
  "id": "atmospheric-pressure",
  "name": "Atmospheric pressure",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "atmospheric-pressure",
  "recommended": false
 },
 {
  "id": "atmospheric-column-density",
  "name": "Atmospheric column density",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "atmospheric-column-density",
  "recommended": false
 },
 {
  "id": "near-surface-atmospheric-density",
  "name": "Near-surface atmospheric density",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "near-surface-atmospheric-density",
  "recommended": false
 },
 {
  "id": "atmospheric-temperature",
  "name": "Atmospheric temperature",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "atmospheric-temperature",
  "recommended": false
 },
 {
  "id": "wind-speed",
  "name": "Wind speed · EMARS climatology",
  "group": 9,
  "type": "dynamic",
  "engine": "wind",
  "reason": null,
  "key": "wind-speed",
  "recommended": false,
  "description": "NASA Mars Explorer wind components from the EMARS historical climate analogue, evaluated for the current UTC model hour and refreshed automatically.",
  "reading": "NASA-style blue–green–red colors show 0–100 km/h wind speed; values above the display range stay red and the numerical readout remains uncapped. Animated white trails follow the wind direction. Motion is accelerated for visibility, not physical travel time. Units can switch to m/s; reduced-motion settings show still trails.",
  "coverage": "This is a live connection to a climatology service, not live weather measurements or a storm forecast. Source year and model time are shown. The 60 × 36 grid is hundreds of kilometres across; wind height and uncertainty are not supplied. Unsampled polar caps stay transparent.",
  "sources": [
   {
    "title": "NASA/GSFC Mars Explorer and model identity",
    "url": "https://psg.gsfc.nasa.gov/apps/mars/"
   },
   {
    "title": "NASA public wind-grid endpoint",
    "url": "https://psg.gsfc.nasa.gov/apps/mars/index.php?param=Wind"
   },
   {
    "title": "EMARS source paper · reanalysis and grid",
    "url": "https://doi.org/10.1002/gdj3.77"
   }
  ]
 },
 {
  "id": "wind-direction",
  "name": "Wind direction",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Animated model flow trails are included in Wind speed. A separate current measured wind-direction feed has not been verified.",
  "key": "wind-direction",
  "recommended": false
 },
 {
  "id": "dust-storm-extent",
  "name": "Dust storm extent",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "dust-storm-extent",
  "recommended": false
 },
 {
  "id": "atmospheric-water-ice-clouds",
  "name": "Atmospheric water-ice clouds",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "atmospheric-water-ice-clouds",
  "recommended": false
 },
 {
  "id": "uva-irradiance",
  "name": "UVA irradiance",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "uva-irradiance",
  "recommended": false
 },
 {
  "id": "uvb-irradiance",
  "name": "UVB irradiance",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "uvb-irradiance",
  "recommended": false
 },
 {
  "id": "surface-reaching-uvc-irradiance",
  "name": "Surface-reaching UVC irradiance",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "surface-reaching-uvc-irradiance",
  "recommended": false
 },
 {
  "id": "visible-solar-irradiance",
  "name": "Visible solar irradiance",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "visible-solar-irradiance",
  "recommended": false
 },
 {
  "id": "solar-infrared-irradiance",
  "name": "Solar infrared irradiance",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "solar-infrared-irradiance",
  "recommended": false
 },
 {
  "id": "thermal-infrared-emission-from-the-surface",
  "name": "Thermal infrared emission from the surface",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "thermal-infrared-emission-from-the-surface",
  "recommended": false
 },
 {
  "id": "day-night-surface-temperature-variation",
  "name": "Day/night surface temperature variation",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "day-night-surface-temperature-variation",
  "recommended": false
 },
 {
  "id": "solar-elevation-angle",
  "name": "Solar elevation angle",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "solar-elevation-angle",
  "recommended": false
 },
 {
  "id": "surface-solar-illumination",
  "name": "Surface solar illumination",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "surface-solar-illumination",
  "recommended": false
 },
 {
  "id": "seasonal-co-frost-distribution",
  "name": "Seasonal CO₂ frost distribution",
  "group": 9,
  "type": "dynamic",
  "engine": null,
  "reason": "Awaiting dynamic endpoint",
  "key": "seasonal-co-frost-distribution",
  "recommended": false
 },
 {
  "id": "earth-solar-proton-context",
  "name": "Solar proton flux · Earth context",
  "key": "earth-solar-proton-context",
  "group": 8,
  "type": "dynamic",
  "engine": "feed",
  "reason": null,
  "recommended": false,
  "feed": "goes-protons",
  "description": "NOAA GOES integral solar-proton flux at Earth orbit, shown separately from Mars observations and forecasts.",
  "reading": "Choose an energy threshold. Flux is in pfu = protons/(cm² s sr); nested integral channels overlap and are not summed.",
  "coverage": "Earth context only. Solar magnetic connectivity and transport differ at Mars; these values cannot become a Mars surface radiation map.",
  "sources": [
   {
    "title": "NOAA GOES primary proton observations",
    "url": "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-7-day.json"
   }
  ]
 }
];
for(const item of SCIENCE_CATALOG){
 const requirement=STATIC_REQUIREMENTS[item.id];if(requirement)Object.assign(item,requirement);
 const definition=DYNAMIC_DEFINITIONS[item.id];if(definition)Object.assign(item,definition,{reason:null});
 else if(item.type==='dynamic'&&!item.engine&&DYNAMIC_BLOCKERS[item.id])item.reason=DYNAMIC_BLOCKERS[item.id];
 const research=DYNAMIC_RESEARCH[item.id];if(research)Object.assign(item,research);
 const source=SOURCE_OVERLAY_DEFINITIONS[item.id];if(source)Object.assign(item,source,{reason:null});
 const extra=ADDITIONAL_STATIC_OVERLAYS[item.id];if(extra)Object.assign(item,extra,{reason:null});
}
const direction=SCIENCE_CATALOG.find(x=>x.id==='wind-direction'),wind=SCIENCE_CATALOG.find(x=>x.id==='wind-speed');Object.assign(direction,{...wind,id:direction.id,key:direction.key,name:'Wind direction · EMARS flow',recommended:false,reading:'White flow trails show the direction the air moves toward. The centre readout gives a bearing clockwise from north. Calm cells have no defined bearing.',reason:null});
export const CONSOLIDATED_OVERLAY_IDS=new Set(['olivine-abundance','pyroxene-abundance','hematite-abundance','feldspar-abundance','mafic-mineral-composition','terrain-shielding-potential-sky-obstruction']);
export const VISIBLE_SCIENCE_CATALOG=SCIENCE_CATALOG.filter(x=>!CONSOLIDATED_OVERLAY_IDS.has(x.id));
export const SCIENCE_CONTEXT_KEYS=SCIENCE_CATALOG.filter(x=>x.group===8&&x.engine).map(x=>x.key);
export const SCIENCE_HEATMAP_KEYS=SCIENCE_CATALOG.filter(x=>x.engine&&x.engine!=="contours"&&x.group!==8).map(x=>x.key);

export const consolidatedOverlayKey=key=>CONSOLIDATED_OVERLAY_IDS.has(key)?(key==='terrain-shielding-potential-sky-obstruction'?'topographic-sky-visibility':'mineral-composition'):key;

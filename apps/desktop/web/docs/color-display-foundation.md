# Color display decisions

The Color switch offers labelled NASA Ames/USGS
colorized Viking context. Native collected HiRISE color still requires the
publication checks described below. See [the implementation notes](atlas-improvements-20261019.md).

The Vercel viewer now exposes a Layers panel independent of 3D, 2D and Compare.
Grayscale is active. Color is honestly marked Preparing; no toggle can pretend
that newly archived originals are already publishable map textures.

Acquisition receipts and the account-aware publication contract live in
`pipelines/color-archive`. Website publication must later satisfy that contract:
source channel semantics, Mars registration, valid masks, tiled overviews, delivery
tests and a server-side account/shard resolver. No new storage credentials are
included in this UI release, and the private/shared archive state is not changed.

The planned color view uses global HRSC visible RGB context, with more detailed
validated color where available. Enhanced/infrared-shifted HiRISE color must be
labeled separately. A sharp grayscale image tinted with coarser color must be
labeled colorized detail; it is not newly observed high-resolution RGB.

Places, numbered measurement points, terrain and coordinates stay shared across
appearances. Source resolution and color coverage remain separate from terrain
resolution. Where usable color is unavailable, retain labeled grayscale context.

This release adds UI foundations only. It does not turn Colab into the website
backend, publish raw color assets, or compile a new planetary mosaic.

## Measurement behavior

The Measure tool places a numbered polyline in 3D, 2D and the overview. Points
can be clicked/tapped, added at the view centre, or entered by coordinates.
Undo, finish/continue, clear and a Mars-coordinate JSON export preserve the same
line through view/place changes. Enter finishes, Backspace undoes, Escape stops.

Distances sum the shortest spherical arcs between consecutive points using the
application's Mars reference radius of 3,396,190 m. They do not use Earth's
Leaflet defaults, elevated straight chords, exaggerated relief, or a guessed
walking surface. Terrain sampling, slopes, hazards, routing and elevation
profiles are separate future work. The exact antipodal shortest arc is not
unique; its length is well-defined, and the 2D display uses a deterministic arc.

Reference inspected: https://murray-lab.caltech.edu/CTX/V01/SceneView/MurrayLabCTXmosaic.html
Its Area Measurement and Elevation Profile panels use point/line placement. The
measurement tool now supports distance and simple polygon area in our existing
Cesium and Leaflet viewer, without importing ArcGIS or copying reference assets.
Live cursor previews, double-click completion and default vertex snapping follow
that drawing workflow. Snapping uses 14 CSS pixels (22 for touch) and only the
current measurement's visible vertices; Ctrl temporarily disables it. Typed
coordinates bypass snapping. Area can close at the first vertex without adding a
duplicate. Measurements persist across view changes, not page reloads or starting
a new measurement. Area reports the smaller spherical polygon and rejects
crossing boundaries; it is not the detailed terrain surface area. Elevation
profiles and path finding remain separate work.

Ground mode defaults to Explore (80 m/s), with Precise (8 m/s) and Fast
(400 m/s) choices. WASD moves along the local surface plane; Space raises
and either Shift lowers the camera. Movement is normalized across axes and
uses elapsed frame time with a 250 ms jump limit; loaded terrain clearance
still applies. This is an exploration camera, not a validated walking model.

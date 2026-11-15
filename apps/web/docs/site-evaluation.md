# Landing and base-site comparison

Open **Routes & sites → Evaluate landing & base sites**, **Missions → Landing & base sites** in Orbit, or **Plan → Sites** in Horizon. The original interface also exposes the evaluator at the top of Routes. Nothing runs until Evaluate candidate is selected.

Select Landing or Base station, take the map crosshair or enter signed east longitude / planetocentric latitude, and configure the ellipse and scenario limits. Compare up to four candidates. Recalculate all applies the current settings to every recorded centre atomically; cancellation or failure keeps previous results. Export comparison JSON or the readable Markdown report before refreshing. Results are session-only and are not included in saved Marswalk missions.

## Data and calculation

- Uses the existing prepared-HiRISE/validated-HRSC-MOLA terrain loader, separate from photographic resolution and rendered relief exaggeration. Calculation requests 50 m spacing; metric stencils and area sampling are no finer than the reported DEM sampling. Existing 513-point grid limits may increase analysis spacing.
- Samples the oriented ellipse at physical source scale; requires at least nine valid samples. Calculates source-scale slope, 95th-percentile roughness and elevation. Connected acceptable area uses four-neighbor samples and approximate cell areas; it is not a geometric fit certificate. Missing samples cannot pass screening. Footprints too small for available terrain remain unassessed.
- Landing constraints: maximum resolved slope, 95th-percentile roughness, vehicle-scenario elevation ceiling and connected area. Base mode omits the landing elevation ceiling. Limits are editable project scenarios, not NASA engineering specifications.
- Solar calculation samples 24 times per sol over the requested period, at the centre. Uses Mars24 geometry and the existing physical-DEM incidence / sunward obstruction approximation to eight source-grid spacings. Reports mean lit hours and equivalent incidence hours per sol. No atmospheric attenuation, electrical generation, panel design, full-footprint illumination or complete distant horizon. Date range must fit existing 2000–2030 geometry support.
- Samples checksum-verified original SWIM 0–1 m sensing-depth composite at the centre; no inferred depth, reserves or probability. Published thermal inertia, rock-abundance and surface-dust index are reported as context, not pad-scale hazards or extra weighted criteria.
- Nearby resource candidates require catalogue resource category and a source; coincident coordinates are deduplicated. Distances are spherical straight-line distances, not driving/walking costs. Route action loads candidate and target into the existing planner; user reviews existing mission/settings and calculates separately. Empty results do not establish resource absence.
- Optional scientific products can fail independently, leaving unknown criteria and a source error. No new bulk imagery, DEM or reference copies are created; existing cached loaders are reused.

## Scores and uncertainty

Landing default weights: slope 35, roughness 20, area 25, sun 10, ice 5, resource proximity 5. Base: 20/15/20/25/15/5. All are editable; total need not equal 100.

Slope/roughness preferences decline linearly from 100 at zero to zero at the selected limit; use their 95th percentiles. Area saturates at the required area. Solar saturates at 12 equivalent incidence hours/sol (a declared preference scale, not a physical maximum). Ice maps signed consistency −1…+1 to preference 0…100. Resource proximity declines linearly from zero-distance preference 100 to zero at the selected search radius.

Display assessed-criteria weighted mean plus weighted evidence coverage. Full-weight lower bound assigns unknown preferences zero, upper bound assigns them 100. These are missing-evidence bounds, not statistical confidence intervals; coverage is not scientific confidence. Constraint violations remain separate and cannot be erased by resources or sunlight. No automatic winner or landing probability. Different scenarios retain recorded settings; recalculate all to compare common assumptions.

Unassessed: subpixel rocks/scarps, soil/bearing strength, vehicle landing dynamics and local atmosphere. No radiation-safety, seismic-safety, extraction-yield or orbital-communications score. Equipment scenario telemetry is not used as observed evidence. Weather/dust climate scores are intentionally omitted until a defensible operating-period comparison is defined.

## Verification (2026-11-03)

Model tests cover rotated/dateline footprints, four-neighbor connectivity, missing-score bounds, source-scale analysis, slopes and elevation failures, missing/small-footprint rejection, resource evidence filtering, orchestration/cancellation and readable export. Existing suite and production build run before publication.

Live local integration check: 5 × 3 km Jezero ellipse at 77.43°E, 18.44°N, 30 sols from 2026-11-03. Validated HRSC/MOLA ≈200 m sampling, 284/284 footprint samples; original ice-consistency −0.159375, thermal inertia 278, rock abundance 24%, dust index 0.969744. Within selected resolved terrain limits; no sourced resource targets within 100 km, yielding 95% weighted criteria coverage. These are a reproducibility check, not a landing recommendation.

Local modules and source endpoints returned HTTP 200. Visual browser interaction remains unverified because only Codex and WhatsApp native windows were available to the computer-use tool; Codex UI automation is prohibited. No manual Vercel deployment or collector changes.

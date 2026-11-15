# Landing and base-site comparison

Open **Missions → Landing & base sites** or **Plan Mission → Evaluate a base station site**. The second entry selects Base station. Choose a map centre or enter coordinates, configure the footprint and evaluate up to four candidates. Export JSON or a readable Markdown report to retain results across sessions.

## Priorities and evidence

Landing weights slope, roughness, connected usable area and surrounding terrain at 35/20/25/20. The solar-supported base weights slope, roughness, area, sunlight, shallow ice evidence and resource proximity at 10/10/15/30/20/15. These are editable project assumptions informed by the research linked in the interface and reports.

The landing preset uses a 10° slope limit, 20 m roughness limit, 1 km² connected area and 1 km outer buffer. The base preset uses 5°, 10 m, 0.5 km² and no outer buffer. Landing additionally checks a vehicle-scenario elevation ceiling. Recalculation applies settings to candidates of the selected type. Cancellation or failure retains previous results.

The evaluator reuses the existing HiRISE, HRSC/MOLA, scientific reference and resource loaders. It requests 50 m analysis spacing. Upstream regional terrain retains its 200 m minimum, source-resolution limits and 513-point grid cap. Terrain metrics respect the physical DEM sampling. Small footprints with insufficient samples remain unassessed.

Sunlight samples the candidate centre 24 times per sol using Mars24 geometry and the existing local terrain-obstruction approximation. Atmospheric attenuation, electrical generation and a complete distant horizon require further models. SWIM consistency supplies shallow-ice evidence. Thermal inertia, rock abundance and dust products provide additional context. Sourced resource records supply proximity, with a separate action to calculate a terrain route.

Score cards expose raw criteria, weights, contributions, evidence coverage and full-weight bounds. Missing evidence receives zero at the lower bound and 100 at the upper bound. Terrain screening remains separate from preference scores. Subpixel obstacles, soil strength, vehicle dynamics and local atmosphere require further assessment.

## Landing–base pairs

Evaluate at least one candidate of each type, then select a 1–100 km straight-line distance budget. Both footprints must pass resolved terrain screening for pair eligibility. Each pair bound is the smaller of the corresponding site bounds. Eligible pairs sort by their lower bounds. Review recorded scenarios and calculate a terrain route separately.

## Verification

All 366 JavaScript tests and the production build passed on the upstream-based branch. Tests cover footprints, connectivity, source-scale terrain, missing-evidence bounds, distinct presets, surrounding terrain, pair eligibility and distance limits, resource filtering, cancellation and report export. Browser validation of this upstream-based branch remains pending.

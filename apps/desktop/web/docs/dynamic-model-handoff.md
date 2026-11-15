# Dynamic overlays: implementation and model handoff

This replaces the blanket explanation that pending entries lack endpoints. Sources, archive adapters, physical models, operational data and validation are different dependencies.

## Implemented in this change

| Catalogue entry | Usable product now connected | Exact limits |
| --- | --- | --- |
| Dust-storm extent | MDAD v1.1 native MARCI storm masks, five Mars years, 2,488 source frames (including empty source slots); year/sol selector and stepping | Historical MY28–32. Not current weather. Native 0.1° cells, source missing-observation pixels preserved. Transparent does not establish dust-free conditions. |
| Time-specific communications | UTC orbiter visibility footprints, minimum elevation selector, minute updates and centre readout | Geometric visibility of available MRO/Odyssey/Mars Express/TGO/MAVEN trajectories. No radio performance, operational schedule, terrain obstruction or Earth downlink is inferred. Hope is excluded. |
| UVA irradiance | Corrected REMS UV-A local history, actual sols 3401–3423 | Instrument band 315–370 nm, not full standard 315–400 nm. 2022 at Curiosity, not a current global field. |
| UVB irradiance | Corrected REMS UV-B local history, same product | Instrument band 280–320 nm, not standard 280–315 nm. |
| Surface UVC irradiance | Corrected REMS UV-C local history, same product | Instrument band 220–280 nm; does not cover all wavelengths below 280 nm. |

These are five **scoped selectable views**, bringing the catalogue from 30 to 35 of 62. They do not complete the original global/current quantities. Twenty-seven entries remain disabled. Existing enabled entries also include explicitly labelled climatology, proxies and Earth context.

Dust PNGs retain every native member-ID/missing-value pixel, are round-trip checked against the published masks and SHA-256 checked in the browser. Source tar files are checked against publisher MD5 and additionally SHA-256 hashed. No mask enlargement or invented intermediate observations is used. The source repeats some day labels for all-zero slots: each array frame retains its own index, so a later blank cannot overwrite an earlier storm mask. All-zero slots have unverified observation coverage and are not interpreted as observed clear.

The UV adapter streams all 724,717 source records, checks the source label and produces 15-minute LMST summaries. Each channel retains mean, observed min/max, count and the range/count of published systematic uncertainties. Missing `-999` and zenith >55° remain unavailable. Uncertainty is never reduced by √N. Bands are never summed. The filename and XML label nominally span sols 3401–3500, but all 724,717 retrieved rows end at sol 3423. The UI uses the actual 3401–3423 row coverage and discloses that metadata discrepancy; it does not claim observations through the label end date. Other REMS product families may extend later. The source response and label hashes are retained. The Gale marker is a regional reference, not an invented historical rover position.

## Sources you can use without inventing a new physical model

| Source | Available information | Remaining engineering / scientific boundary |
| --- | --- | --- |
| [MDAD v1.1, DOI 10.5281/zenodo.7480334](https://zenodo.org/records/7480334) | Historical daily storm masks, native nodata, member IDs, Mars-year/sol/Ls | Connected. A **current** storm product still needs newly published masks or validated image detection. Historical gaps cannot become current conditions. CC BY 4.0 attribution retained. |
| [REMS corrected UV](https://atmos.nmsu.edu/PDS/data/PDS4/msl_rems_bundle/data_uv_corrected/) and [instrument definitions](https://atmos.nmsu.edu/PDS/data/PDS4/msl_rems_bundle/document/REMS_INST.CAT) | Six calibrated instrument bands and systematic uncertainties | Three requested bands connected for a specific archival product. Other channels/products can be added as instrument-specific history; a global standard-band map is a separate model. |
| [MEDA calibrated archive](https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_calibrated_env/) | Local RDS spectral/broadband solar measurements and TIRS reflected shortwave/thermal longwave, with quality/geometry fields | Data exist. A historical instrument-channel adapter is engineering. RDS narrow bands and its panchromatic channel are not an exact 400–700 nm integral. TIRS reflected 0.3–3 μm or thermal longwave cannot be relabelled downward solar infrared. |
| [RAD science CDF archive](https://spdf.gsfc.nasa.gov/pub/data/aaa_planetary/msl/rad/cdf/obs-l2/) / [product metadata](https://hpde.io/NASA/NumericalData/MarsScienceLaboratory/RAD/Observation/Level2) | Local detector dose, LET and neutral-event histograms, flags, detector metadata | Quicklook detector dose is already connected. More science-history views need CDF decoding and calibration/quality handling. Neutral event histograms need detector-response unfolding before they become neutron/gamma flux. No global or human-tissue dose follows directly. |
| [RAD charged-particle spectra](https://doi.org/10.1002/2013JE004547) and [neutral spectra analysis](https://arxiv.org/abs/2003.06604) | Published local species spectra, detector response/selection methods, historical validation | Useful calibration/validation sources. A paper's time-averaged spectrum is not a current global species feed. Detector event classification/response still matters. |
| [MAVEN SEP calibrated archive metadata](https://data.nasa.gov/dataset/maven-sep-calibrated-ion-and-electron-spectra-data-collection-sensor-1) | Historical orbital differential/integral ion and electron flux, separate energy/direction channels | Can support an explicitly orbital historical view. It cannot replace a surface flux field or be presented as live MAVEN telemetry. |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) + SPICE | Dated orbital positions and reference frames | Connected for geometry. Coverage/trajectory warnings are enforced. A trajectory is not proof a spacecraft is operational or allocating relay time. |
| [NASA MaROS](https://ammos.nasa.gov/maros/) and [Mars Relay Network documents](https://science.nasa.gov/mars/mars-relay-network/) | Real operational-planning system, relay architecture and radio-interface requirements | A public machine-readable operational schedule endpoint was **not verified** here. Obtaining schedule access would remove a data-access dependency; it is not a reason to invent scheduled passes. |
| [Mars Climate Database 6.2](https://www-mars.lmd.jussieu.fr/mars/access) | Model climate fields and access software; surface/atmosphere dependencies | Existing climate models can be reused. Full access requires registration; web interface is intended for moderate use. Check applicable licence/permission for intensive or commercial use. Climate averages are not observations of today's weather. |
| [NASA PSG API](https://psg.gsfc.nasa.gov/helpapi.php) | Existing spectral radiative-transfer service/configuration | A candidate model engine, not a ready verified global Mars surface UVA/VIS/IR endpoint. Need correct receiver geometry, atmosphere, spectral configuration and validation first. |

## Model packages to work on

You do **not** need to build a separate model for every disabled checkbox. The packages below can generate many of them. Start with existing published models or response libraries and validate the intended configuration instead of recreating transport physics.

### 1. Particle transport and dose response — highest scientific impact

This supports GCR/SEP/total dose, protons, helium, HZE, electrons, neutron/gamma/secondary-ion/electron/positron/muon flux, upward albedo, and dose equivalent.

Established starting points: [NASA OLTARIS/HZETRN](https://oltaris.larc.nasa.gov/), [Geant4/AtRIS Mars implementation](https://doi.org/10.1051/swsc/2018051), and [published Mars dose-response functions](https://arxiv.org/abs/1902.00243). OLTARIS requires registration and administrator approval; no application/account has been submitted on your behalf. AtRIS is a physics framework requiring a defined configuration, not a drop-in live feed. Published proton/helium response functions may reduce computation for supported conditions; they do not automatically cover all HZE species, shielding or energies.

Inputs: dated, species-resolved GCR/SEP boundary spectra; energy bins and differential/integral convention; atmosphere density/composition/column; regolith composition, water fraction and depth; evaluation height; shielding/material/geometry; angular assumptions and solar modulation. Separate primary versus secondary and GCR versus SEP components. Avoid double counting overlapping populations.

Outputs: species × energy × direction flux with explicit units and solid-angle normalization; absorbed-dose rate with material (Gy/time); optional dose-equivalent rate with named quality-factor convention (Sv/time); model uncertainty and valid parameter domain. Upward and downward flux must remain distinct. A flux field is not itself human dose.

Validate against RAD **matching detector material, response, geometry, flags and observation interval**, and published species/neutral spectra. Supply withheld validation, bias/error metrics, sensitivity to atmosphere/regolith/shielding, and behaviour outside calibration coverage. Do not tune to a single headline dose number and call it globally validated.

### 2. Spectral surface radiation — UV, visible and solar IR

Supports global standard UVA/UVB/UVC, visible solar irradiance and solar infrared irradiance. REMS/MEDA provide local validation; NASA's existing relative UV field lacks calibrated band units.

Inputs: timestamped solar spectrum, atmospheric profile/pressure/composition, CO₂/ozone absorption, dust and cloud optical properties and wavelength dependence, sun/receiver geometry, albedo and terrain where supported. Define whether output is direct, diffuse or total downwelling on a horizontal or tilted receiver.

Outputs: spectral irradiance in W m⁻² nm⁻¹ plus explicitly integrated bands in W m⁻². State exact band limits. Resolve the solar-IR definition with your team before computing it. Compare model **instrument-response convolutions** with REMS/MEDA channels; do not compare an unmatched standard band directly to a detector band. Preserve the uncertainty contributed by aerosol scenarios and spectral inputs.

### 3. Subsurface thermal conduction

Supports seasonal subsurface temperature. Inputs: depth layers, density, heat capacity, conductivity/thermal inertia, rock/soil/ice properties, geothermal boundary and surface energy/temperature history, season/local time and sufficient spin-up. Outputs: T(z,t) in kelvin on declared depths with material scenario and uncertainty. Validate energy balance and surface/diurnal behaviour against available measurements, and identify the scarcity of direct deep-temperature validation. Surface EMARS temperature must not simply be copied to every depth.

### 4. Actual radio-link availability and operations

Visibility geometry is implemented. To complete communications, supply antenna patterns/attitude, supported bands/protocols, EIRP, receiver noise/sensitivity, coding/data-rate thresholds, occultation/local terrain, spacecraft operational state, scheduled relay allocations and Earth/DSN/store-and-forward constraints. Use [NASA's MRN participation materials](https://science.nasa.gov/mars/mars-relay-network/) and seek a legitimate schedule product through the existing planning system. Output separate booleans/states for geometric visibility, feasible RF link and scheduled service, plus start/end times and evidence. Unknown operational state is not available service.

This package includes **operational data and engineering**, not only a scientific model. Do not claim all of it requires new research.

### 5. Timed EVA exposure and route energy

Exposure integration is primarily engineering **after** validated fields exist. It needs departure/arrival times, walking/driving speed, stops, work/rest segments, return travel, suit/shielding scenario and coverage for every interval. Integrate each compatible quantity separately: Gy, Sv, UV J/m² and thermal load are not added into one unit. Unknown intervals give incomplete coverage and an unknown total, not zero. Time-dependent pathfinding requires arrival time in its state.

Weather-driven energy additionally needs a validated crew/suit or vehicle thermal/power model, metabolic assumptions, mass, grade, speed, cooling/heating/life-support loads, battery characteristics and equipment limits. The current terrain walking-cost model remains a separate input. Provide a component breakdown and measured/validated operating range, rather than arbitrary weather penalties.

### 6. Heliospheric connectivity and GCR modulation

Connectivity: dated heliospheric magnetic-field/solar-wind solution with field-line tracing to Mars, reference frame, source-surface assumptions and particle-transport treatment. A Parker spiral can be an explicitly approximate model, but Earth-L1 IMF must not be copied onto Mars. GCR modulation: calibrated modulation potential/boundary spectra with species, radial/temporal assumptions and uncertainty. Existing GCR model implementations may be reusable; F10.7 is only solar context.

### 7. Forecast uncertainty calibration

Supply a real ensemble or a hindcast archive matched to Mars observations, event definitions and lead times. Output probabilities/quantiles with the named statistical method, ensemble count, validity window, reliability/coverage metrics and independence assumptions. Differences between successive deterministic iPATH runs are forecast revisions, not calibrated confidence intervals. The current feed provides no justification for invented probability maps.

### 8. Current dust-storm outlines — detection only if a published product is unavailable

The historical MDAD timeline is complete for the connected release, but it is not a current storm feed. A current layer needs timestamped new storm masks or a validated MARCI image-detection pipeline with observation coverage, acquisition/publication time, cloud/ice discrimination and evaluation against independently outlined events. Prefer an authoritative current mask product if one becomes available; a new model is not automatically necessary. Do not threshold EMARS climate dust opacity and call the result an observed storm boundary.

## Integration contract for every model

Deliver runnable source or versioned lookup/response tables, an explicit licence, reproducible example inputs/outputs and validation evidence. A Python package, callable service, or precomputed geospatial tiles are all acceptable. Heavy particle transport should run offline/on suitable compute; the website should read compact dated output, not run Monte Carlo physics on each map request.

Every output must state: observation / model / forecast / climatology; observation/model time, retrieval time, issue time and valid interval separately; geographic bounds/grid/CRS and native resolution; units, species, energies, directions, detector/tissue/material/shielding; depth/evaluation height; model/version/scenario/assumptions; uncertainty type and limitations; source URLs and hashes; a validity mask with `null` outside coverage. Preserve observation times even when cached.

For routes, use physical, unexaggerated elevation and distances. The globe's **3× visual terrain exaggeration must never enter physical calculations**. No output from these research overlays should become astronaut safety clearance.

The generated [per-entry matrix](dynamic-source-matrix.csv) and [machine-readable source/model map](../public/dynamic-source-research.json) cover all 32 entries audited in this pass, including the five newly scoped views. They retain both what exists and what remains.

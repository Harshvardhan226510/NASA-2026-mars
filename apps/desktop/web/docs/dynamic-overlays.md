# Dynamic observations and forecasts

The scientific handoff was reviewed against fresh requests to
the official services before integration. Seven selectable views now connect
six source services in the initial release. The 20 October source expansion now provides **35 of 62 dynamic views**; see [weather, solar and context additions](dynamic-environment.md) and the [full remaining-dependency audit](dynamic-overlay-audit.md). Find the initial feeds in **Layers → More overlays → Radiation &
Exposure** and **Space Weather & Solar Activity**. The four recommended layers
remain a short, separate selection.

| View | Source | What appears |
| --- | --- | --- |
| Local absorbed dose rate | ISWA `msl_rad_dosimetry` | Curiosity quicklook trend; silicon B raw / RTG-corrected and plastic E selected separately |
| Mars orbital particle indicator | ISWA `mars_express_aspera3_ima_ep` | Combined penetrating-particle background and total instrument counts |
| Mars-directed SEP forecast | ISWA iPATH submissions `2806` | Latest validated Mars proton run, integral channels, predicted peaks and validity windows |
| Mars proton energy spectrum | ISWA iPATH spectra `2574` | Differential spectrum matched to that same model issue; selectable prediction times |
| Mars CME / shock arrival forecast | DONKI `WSAEnlilSimulations` | Only `impactList` entries explicitly targeting Mars, with model-run provenance |
| Solar X-ray flux — Earth context | NOAA GOES primary | Separate wavelength-band trends; satellite and contamination flags retained |
| Solar proton flux — Earth context | NOAA GOES primary | Separate integral energy thresholds; no translation into Mars measurements |

## Scientific meaning

RAD is a **local detector response**, not a worldwide radiation map. Its Gale
marker is a reference location and is explicitly not the rover ephemeris at
each measurement time. No artificial coverage perimeter is drawn. The provider
specifies that quicklook is for display, with SPDF/PDS science products required
for scientific analysis or publication. The interface links the separate
[RAD science archive](https://spdf.gsfc.nasa.gov/pub/data/aaa_planetary/msl/rad/cdf/obs-l2/).

Mars Express counts do not become calibrated flux or dose. Its feed does not
provide a spacecraft position, so no invented orbital track is drawn. iPATH
is an experimental heliospheric prediction at Mars; no atmospheric transport
or surface-dose calculation is applied. Model threshold results never become
crew clearance. DONKI arrivals are predictions from individual runs, not
confirmed arrivals, independent event counts, or SEP onset times. NOAA remains
explicitly Earth context. Overlapping bands, populations and forecast revisions
are never summed.

All unknown values remain null. Contaminated GOES samples are masked; the raw
response retains the original flags and observed flux. Charts break at missing
values and large temporal gaps. Spectrum charts omit zero values from the log
axis without changing their saved values. Units and detector materials are
retained; no universal Gy-to-Sv conversion is performed. Display terrain
exaggeration is not used anywhere in these feeds or routing physics.

Existing potassium/thorium and hydrogen reference overlays remain separate.
Th weight percent is converted to ppm by ×10,000 in the existing verified
static pipeline; no abundance-to-dose conversion was introduced.

## Time, freshness and failures

The selected view shows observation or model-issue time, retrieval time,
coverage, material/species where available, quality limitations and source
hashes. Publication time remains unknown unless actually supplied; HTTP
Last-Modified is preserved as metadata and is not treated as publication time.

Mars observations use the handoff's initial display policy: at most 24 hours
old is **delayed**, 24–72 hours is **stale**, and over 72 hours is **old**. These
are UI age labels, not radiation hazard thresholds. Endpoint health is shown
independently. An old observation does not become recent because a poll
succeeds. Each forecast expires at its own validity end, checked again every
minute in the active view. No listed arrivals means no arrivals in that query,
not an all-clear.

The active view checks for updates when visible: hourly for RAD/Mars Express,
15 minutes for iPATH/DONKI, and five minutes for NOAA. Hidden pages pause those
requests. The server and CDN cache results and coalesce simultaneous requests.
Only bounded, allowlisted public sources can be fetched; callers cannot supply
arbitrary URLs. Responses have byte limits, timeouts and bounded retries.
Rate-limited responses are not immediately retried.

If a refresh fails, the API retains a prior result from its cache or the
versioned release snapshot. Original observation/retrieval times stay intact,
and the fallback is labelled. The release snapshot is a durable fallback, not
a claim to current conditions. A completely unavailable source stays unknown.

## Delivery and archival foundation

`GET /api/space-weather?feed=rad&days=7` serves the normalized product. Registered
feed keys are `rad`, `mex`, `ipath`, `donki`, `goes-protons`, and `goes-xrays`, plus `solar-wind`, `solar-imf`, `solar-flares`, `solar-status`, `solar-euv`, and `solar-f107`.
RAD/Mars Express support 3-, 7- and 30-day history. NOAA is a seven-day source;
DONKI queries 30 days of runs. A view can save its normalized source data as
JSON, including units, flags, timestamps, raw hashes and forecast thresholds.

`node tools/refresh-space-weather.mjs` is the durable snapshot-worker entry
point. It locks concurrent local runs, saves content-addressed raw responses
before normalization, records a per-run audit, retains older good feeds when
one source fails, and atomically publishes `data/space-weather/bootstrap.json`.
The checked-in snapshot and raw files allow independent checksum verification.
Initial first-seen values describe this worker's initial backfill; they do not
establish publication latency. Metadata for all source reads is retained.

**The deployed live refresh is request-driven. No separate continuous archive
scheduler, database, object-storage account, or thirty-day latency study was
created or claimed.** Runtime Cache is an ephemeral accelerator, not the
archive. The worker is ready to run on durable scheduled infrastructure; that
deployment is separate from serving the current small public feeds. CDF/PDS
and multi-gigabyte historical archive ingestion do not run in page requests.

## Dependencies still unresolved

The following remain disabled with a model/data explanation: global GCR/SEP
surface dose, human dose equivalent, species-separated surface fields, and
cumulative route exposure. They require a response/transport model, compatible
atmosphere/material inputs, detector validation and uncertainty propagation.
Local quicklook, counts, elemental abundance and Earth readings do not supply
those products. REMS/MEDA and orbital dosimeter archives also require their
own quality, calibration, band and geometry decoders before release.

Routing algorithms are unchanged. No unvalidated radiation score was added
to the partner's route costs. A later time-dependent exposure planner needs
arrival-time state, stops/return travel and explicit unknown coverage.

## Verification and references

Contract tests cover units, detector identity, null/zero, Mars/species filtering,
forecast expiry, matching spectral windows, Earth/Mars separation, timestamps,
URL restrictions, cache failures, source checksums and chart gaps. The real
Cesium 1.145 consumer/DOM harness exercises all seven menu views, both flat
maps, the Gale reference marker, source details, and restoration of static
layers. Local and staged/production API checks use refreshed official data.
Browser visual inspection is unavailable in the current tool session; no
WebGL visual verification is claimed.

Source guidance: [NASA ISWA RAD](https://iswa.ccmc.gsfc.nasa.gov/meta/information/MSL_RAD_Timeline.html),
[NASA CCMC iPATH](https://ccmc.gsfc.nasa.gov/models/iPATH~2/),
[NASA CCMC DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/),
[NOAA primary GOES products](https://services.swpc.noaa.gov/json/goes/primary/).
Source adapter semantics derive from the supplied technical reference and its
four scientific-contract examples; additional production checks are in
`tests/space-weather.test.mjs`.

## 20 October source expansion

Five additional scoped views connect historical MARCI dust masks, local corrected REMS UV-A/B/C observations, and UTC geometric relay visibility. They are explicitly historical/local/geometric rather than current global quantities. See the [model and source handoff](dynamic-model-handoff.md) for all 32 audited entries and the work needed for their full scope.

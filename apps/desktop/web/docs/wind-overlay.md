# Atmospheric wind speed

**Layers → More overlays → Atmosphere, Solar & Thermal Environment → Wind
speed · EMARS climatology** adds NASA-style speed shading and animated white flow trails to
3D, 2D, Compare and the overview map. Metres per second and kilometres per hour
are selectable. The view-centre readout gives speed and the direction **toward
which** the air flows, measured clockwise from north. The tint range remains
0–100%; the underlying surface is visible at the default 55% tint.

## What the NASA source actually provides

The supplied [NASA/GSFC Mars Explorer](https://psg.gsfc.nasa.gov/apps/mars/)
identifies its default weather as **climatological data based on EMARS MY32
Moderate dust** at this release. Its public script forces EMARS when another
model is selected. The prototype also asks users to treat it as a test product.
It is not a live global weather-observation network. An automatically moving
clock on the site does not establish current observational coverage.

The [EMARS paper](https://doi.org/10.1002/gdj3.77) describes historical Mars
atmosphere reanalysis using observations and a dynamical model, with eastward
and northward wind components. Atlas makes a live connection to NASA's service
and requests the current UTC model hour using its default climate analogue.
The result is **time-varying climatology**, not an observed current atmosphere
or a validated storm forecast. It is labelled this way in the menu, description,
legend, saved data and server response.

No current global measured wind feed was verified from this site. NASA's
2026 planetary-mission review also describes degraded MEDA wind-sensor
capability, while REMS/PDS records do not supply a current global observation
map. An old station record is not substituted as live global weather.

## Verified numerical contract

The map's public script fetches
`https://psg.gsfc.nasa.gov/apps/mars/index.php?param=Wind`.
It returns JSON with a `header`, `data` and `vector`, despite its HTML MIME type.
The header specifies `param=Wind`, units `km/h`, longitude/latitude arrays,
`nlon=60` and `nlat=36`. The values are row-major from south to north.
`data` is eastward wind and `vector` is northward wind; the provider's rendering
code calculates magnitude from both components.

The complete form must include `location`, fixed reference latitude/longitude,
`units=SI`, `model=EMARS`, `modelmode=Optimum` and UTC date/time fields.
Without `location`, the provider ignored requested dates in our checks. Atlas
first posts the complete form to the page and verifies the echoed UTC time,
model and climate-analogue identity. It posts the same form to the wind-grid
endpoint. Distinct midnight/noon requests were independently verified to
return different fields. The fixed reference location is for the source form;
the returned field is global and the viewer's location is not sent to NASA.

The feed has no observation time, forecast issue time, publication time,
uncertainty, instrument-quality flags or wind evaluation height. Those remain
unknown. The confirmed model time, historical source Mars year and retrieval
time are stored separately. No 2 m, 10 m, surface-gust or astronaut-safety claim
is inferred from this interface.

## Display and units

Components are converted from km/h to m/s by dividing by 3.6. Atlas interpolates
the components on the actual coordinate axes and then calculates speed with
`hypot(u,v)`, rather than averaging compass angles. Longitude is periodic;
latitude uses the actual, nonuniform source coordinates. Missing components
remain unknown, not zero. A true zero remains calm wind without a direction.

The native grid has 6° longitude spacing and 36 latitude coordinates: its
support is hundreds of kilometres, regardless of map zoom. Poles beyond
±88.393° have no supplied coordinates and stay transparent. No invented polar
vectors or data are added. Interpolated display pixels do not increase the
scientific resolution. Trails show flow direction; animation is accelerated for visibility
and does not represent particle-travel time.

Both flat maps and Cesium use the same numerical field and NASA's trigonometric
blue–green–red color scale: 0–100 km/h (0–27.8 m/s). Values beyond the display
range saturate red; numeric values and exported vectors remain uncapped. Neighboring
tiles use identical edge samples. The imagery provider always
returns a Promise, including cached images, to satisfy Cesium's contract.

White particles advect through a projected screen-space vector field with fading
tails, following the visual method of NASA Mars Explorer. Each view projects the
eastward/northward tangent vectors independently, so a rotated globe and north-up
flat maps show the same physical direction. Midpoint integration follows curved
fields. Invalid/polar/horizon samples interrupt tracks rather than bridging gaps.
Trails clear during navigation and rebuild for the settled view. A bounded particle
pool and 25–30 fps canvas overlay avoid forcing continuous WebGL terrain rendering.
Inactive, hidden and zero-tint views stop animating. The animation checkbox removes
the trails; reduced-motion preferences display stationary trails. All three views
share the same source grid and opacity, without additional NASA requests.

## Refresh and provenance

`GET /api/wind` supplies the current-hour default climatology. Caller-supplied
URLs, arbitrary times and model choices are rejected. The server requests one
global field per hour when needed, shares a cached field across viewers, and
does not contact NASA for individual tiles or view-centre readouts. The active
view checks the cache every five minutes; hidden/inactive wind layers do not
poll. The NASA prototype receives two small requests per normal hourly refresh,
with timeouts and response-size bounds. No API key or account is required.

Source failures retain a labelled older result from the runtime cache or the
versioned release snapshot. The model clock and retrieval time do not advance
on failure. A completely unavailable result stays unknown. Server retries back
off for 15 minutes. Cached fallback is explicitly distinguished from a healthy
connection, even though the underlying product is climatology in both cases.

`node tools/refresh-wind.mjs` refreshes the durable release snapshot and saves
the exact page/grid responses before parsing them. SHA-256 hashes are included
with each response. Git attributes preserve the publisher's raw bytes across
Windows/Linux. The UI can save the normalized field and provenance as JSON.
The serving cache is not presented as a long-term scientific archive.

## Verification

Tests cover the source's required form trigger, echoed model time, explicit
units, component meaning, calm/missing data, native-grid values, date-line
continuity, nonuniform latitudes, masked polar caps, exact imagery edges,
NASA colors, projected vector directions, particle masks, coalesced requests, hour rollover and outage backoff. The real
Cesium 1.145/DOM harness verifies menu selection, imagery Promise consumption,
both flat layers, tint, animation controls, units, readouts and restoration of other layers.
Local, staged and public API checks confirm NASA responses and source metadata.

Additional primary source:
[NASA 2026 planetary-mission senior review](https://assets.science.nasa.gov/content/dam/science/psd/resources/senior-review/2026/2026PMSR_FinalReport_2Mar26_Public.pdf).

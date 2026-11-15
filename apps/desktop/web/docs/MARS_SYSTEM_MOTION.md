# Mars system motion

Open **Mars system → Show Mars system** to animate the planet, Phobos, Deimos,
and source-covered orbiting spacecraft. The visible **Pause motion** control freezes
the entire system and hides the rotation axis; the camera remains usable. Play
resumes from the same instant. Speeds are 1×, 60×, 600× and 3600×. Returning to Mars
pauses system motion and restores the selected surface overlays.

The map remains in IAU_MARS coordinates. In the system overview, the observer
follows the inverse body rotation relative to inertial space, using the same SPICE
frame transforms as the moon positions. This makes Mars visibly rotate without
changing surface longitude, rotating satellites twice, or affecting terrain and
route calculations. Tracked objects use Cesium's tracking frame instead. Surface
navigation and terrain clamping are suspended while exploring the space view.

## Data and display

- Moons: the existing pinned NASA/JPL MAR099 kernels, with IAU PCK00011 body frames.
- Spacecraft: server-side [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
  geometric position/velocity vectors relative to Mars centre (499), ICRF,
  kilometres/second converted to metres/second, and explicitly requested UTC time.
- Supported targets: MRO −74, Odyssey −53, Mars Express −41, TGO −143, Hope −62,
  and historical MAVEN −202. A deployed-service check returned
  361 valid samples each for the five current-date targets. These are dated
  trajectory solutions, including provider planning predictions, not live tracking.
- JPL warns that MAVEN predictions may be inaccurate beyond its published cutoff.
  The application conservatively excludes windows crossing that cutoff. Other
  catalogue spacecraft remain unplotted until their dated trajectories are sourced.
- Six-hour windows contain one-minute spacecraft states. Cubic Hermite interpolation
  uses source velocities. Outside a packet's coverage the position is unknown.
  Paths are the actual sampled trajectory, not invented circular orbits.
- Requests are serialized per service instance, coalesced across local callers,
  and cached with Vercel Runtime Cache. Each trajectory retains its request URL,
  retrieval time, solution identifier and raw-response SHA-256. Partial failures
  remain per-object unknown; successful bodies remain available. New intervals
  are prefetched; playback holds its last covered instant if the next interval
  has not arrived, rather than extrapolating or making spacecraft blink away.
- MRO, Odyssey, TGO and historical MAVEN reuse the existing NASA GLBs. The orbital
  models have a fixed enlarged display radius (15 km), with illustrative attitude.
  Their source positions and orbital distances are never enlarged. Mars Express
  and Hope use markers because a verified mesh is not bundled.
- The existing surface-localization endpoint remains unchanged unless the explicit
  `service=orbits` parameter is selected. No extra serverless function is introduced.

The interface exposes the same dated-orbit view through the Spacecraft directory.
Mission files preserve the selected object, timestamp, speed and visibility choices;
restored missions start paused.

## Validation

`tests/orbiters.test.mjs` uses a recorded official JPL MRO response to verify target,
origin, units, UTC sample times, source hashes, interpolation, strict coverage,
shared-clock pause/resume and reference-frame consistency. It also verifies
serialized requests, cache/coalescing behaviour and explicit unknowns on failure.
The existing moon/model/surface-position checks remain applicable. Browser checks
cover overview playback, pause/axis removal, dated-orbiter selection, model viewing,
and return to the surface view.

### Release status

The motion feature was published at
[Mars Field Atlas](https://mars-field-atlas.vercel.app/#moon=system). Production
deployment `dpl_3bah2igj5EN4tH2rLiPSStSaY9cQ` uses runtime source commit `f493bf8`.
All 218 tests passed. The public site serves the tested client bundle; production
moon/spacecraft services, shared playback, frozen pause/axis removal and the MRO
model were verified after release.

A long-running preview was
found with Cesium rendering stopped by an invalid array length in scene frustum
binning. The clock had continued advancing after that failure. Rendering failure
now pauses the shared clock and hides the axis. An explicit `?motion-debug=1`
preview can display camera/frustum values and up to 20 invalid command bounds at
the next failure; normal visits do not expose these support details.

The original failure has not been reproduced. A fresh test at the same September
2027 date, 3600× playback through 6 October, multiple six-hour packet transitions,
a wider camera view and sidebar resizing remained healthy. A million-step
reference-frame rotation check remained finite, with less than 0.001 m distance
drift.

Review found a concrete renderer-poisoning path in the illustrative orbiter pose:
normalizing a zero cross product for stationary or radial velocity creates a NaN
matrix. Such poses now hide the mesh while retaining its valid dated marker;
failed moon meshes also retain their marker fallback. Interpolated spacecraft
states must remain finite and within the admitted Mars-centred radius, and
unphysical source velocities are rejected. Regression tests cover these cases.
This fixes that unsafe path, without claiming it proves the cause of the earlier
one-off failure. That uncertainty was disclosed in the production approval.

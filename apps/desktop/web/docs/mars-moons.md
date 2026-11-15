# Phobos and Deimos

The Moons control opens both natural satellites as selectable 3D objects. Show Mars system opens the closer Mars-and-orbiters frame. All orbits fits the available moon and spacecraft paths at true distances. Explore Phobos / Deimos frames a supplied NASA/JPL GLB and follows its changing position. Stop following releases the camera. Return to Mars restores the selected surface layers. The 2D surface map does not plot moon positions as ground sites.

The default mesh scale uses 1,000 metres per GLB unit, consistent with the supplied kilometre-sized assets. The optional 20× visibility scale affects the meshes only; orbital centres, orbit distances and calculations retain physical metres. Models grow naturally on approach; there is no minimum-pixel mesh size. Readable point/label markers identify distant moons. Camera zoom and minimum clearance use the selected mesh bounds. The existing camera-altitude meter continues to measure distance from Mars.

Time follows current UTC at exactly real rate (1×); acceleration controls and legacy saved speeds have been removed. Pause freezes a snapshot and hides the axis. Return to now rejoins current UTC, including after a background tab suspension. A selected UTC is a clearly labeled paused snapshot. Positions are geometric modeled ephemerides, not live observations. Saved missions preserve moon selection, UTC, display scale and orbit visibility; restored live views and legacy previews rejoin current UTC; paused snapshots preserve their dated time. Explicit `#moon=phobos`, `#moon=deimos` and `#moon=system` links are honored over unrelated browser drafts.

## Science and frames

NASA/JPL MAR099 supplies states of 401 (Phobos), 402 (Deimos), and 499 (Mars) relative to the Mars barycenter. CSPICE, through SpiceyPy, computes each moon relative to Mars center with aberration `NONE`. PCK00011 supplies IAU_MARS and moon orientation frames; naif0012 supplies UTC/TDB conversion. The prepared kernel is an unmodified SPKSUB subset covering 2025–2035 plus margins for the orbit traces. It contains no Earth/solar-system ephemeris segments.

The API returns six-hour packets with 120-second J2000 position/velocity samples and time-dependent rotations. The browser uses cubic Hermite position interpolation, quaternion interpolation, and the IAU_MARS transform. The native-SPICE comparison fixtures bound interpolation differences below one metre at tested samples; this is an interpolation check, not a claim of physical orbit accuracy. An independent comparison of eight states against the original full kernel found zero difference after subsetting.

Moon orbit traces use 769 direct SPICE positions over approximately one inertial revolution, transformed as a whole into the selected Mars frame. They are not rotating surface ground tracks. Moon body orientation follows the IAU model; the artistic GLB long-axis/texture/prime-meridian registration remains approximate. These meshes are visualization models, not landing terrain or validated lunar navigation surfaces.

The API validates UTC inputs and rejects dates outside 2025–2035. Missing or invalid states are hidden rather than extrapolated. Kernel checksums are verified before loading, native CSPICE accesses are serialized, and six-hour results are cached. `/api/moons` rewrites to the existing Python function with `service=moons`, keeping the deployment within its 12-function plan limit. Route POST behavior and its no-store responses remain separate. Data provenance and original GLB byte hashes are published under `/moons/`.

## Sources

- https://science.nasa.gov/resource/phobos-mars-moon-3d-model/
- https://science.nasa.gov/resource/deimos-mars-moon-3d-model/
- https://science.nasa.gov/mars/moons/phobos/
- https://science.nasa.gov/mars/moons/deimos/
- https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/satellites/mar099s.cmt
- https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
- https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls

The original source kernel remains outside the web app. `scripts/prepare-moons.py` reproduces the bounded subset from the three official kernel downloads. Production uses pinned `spiceypy==8.3.0`; no third-party service is contacted to calculate each visitor’s moon positions.


## Current-time orbiters

The spacecraft endpoint requests NASA/JPL Horizons geometric ICRF vectors relative to Mars center 499, with UTC epochs, metre positions and metre/second velocities. Minute position/velocity samples feed cubic Hermite interpolation on the same UTC clock as the moons and IAU Mars rotation. Missing positions are hidden; there is no extrapolation or artificial circular orbit.

Longer source windows supply complete paths for eccentric orbits. The viewer clips each path to one angular revolution through the dated vector sequence. It never joins endpoints to fabricate a closed ellipse. Partial coverage stays an open arc. If a long source window fails, the service tries the smaller valid position window. Requests are serialized and cached; hashes, retrieval time, solution identifier and publisher trajectory/prediction notes are retained. The selected orbiter exposes these notes and a link to its exact source request. Current positions are interpolated continuously; path geometry refreshes every 30 seconds.

## Orbit display and rendering stability

Mars system → Orbit display offers **Path**, **Trail**, and **Hidden**. Path displays the available orbital curve; Trail displays only the previous hour of dated positions, fading toward older samples. Hidden removes both moon and orbiter lines while retaining the objects. The choice is saved with missions and browser drafts. Moon trails can load the preceding six-hour packet near a packet boundary; unavailable history stays blank. Neither display mode accelerates the clock, extrapolates positions, or turns an inertial path into a surface ground track.

The reproduced Cesium 1.145 zoom failure came from dynamic environment-map GPU cleanup being replayed during translucent depth picking. All Mars GLB viewers now use stable environment lighting, and map navigation excludes translucent paths and overlays from depth picking. Orbital navigation uses Mars terrain or the reference sphere instead of rendering another depth pass. These changes preserve opaque surface depth picking. The optional `?motion-debug=1` diagnostic records camera, canvas and invalid command bounds if an unrelated renderer failure occurs.

The current-source check returned MRO, Odyssey, Mars Express, TGO and Hope. All five have prediction portions in their JPL descriptions. They are **current-time modeled positions from published trajectory solutions**, not live tracking observations or navigation guarantees. MAVEN stays unavailable after JPL’s published reliability cutoff. This is not a complete inventory of every object at Mars. Spacecraft mesh attitudes remain illustrative and models remain enlarged; distances and position coordinates are not enlarged.

The independent ten-second MRO fixture validates minute-state interpolation to within one metre at the tested times. This checks numerical interpolation only: it does not establish equivalent physical accuracy for predicted trajectories. The existing native-SPICE tests independently check moon positions and frame transforms.

Reference presentation: [NASA Eyes](https://eyes.nasa.gov/apps/solar-system/#/mars). Source contract: [Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html) and [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html).

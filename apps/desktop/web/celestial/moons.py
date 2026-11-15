"""Geometric moon states: NAIF MAR099, no Earth-frame approximation."""
import hashlib
import json
import math
import sys
import threading
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import spiceypy as spice

ROOT = Path(__file__).resolve().parents[1] / 'data/moons'
LOCK = threading.RLock()
START = datetime(2025, 1, 1, tzinfo=timezone.utc).timestamp()
END = datetime(2036, 1, 1, tzinfo=timezone.utc).timestamp()
MOONS = {'phobos': ('401', 'IAU_PHOBOS', 27552), 'deimos': ('402', 'IAU_DEIMOS', 109123)}
loaded = False


def load_kernels():
    global loaded
    if loaded:
        return
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    for name, info in manifest['files'].items():
        path = ROOT / name
        if hashlib.sha256(path.read_bytes()).hexdigest() != info['sha256']:
            raise RuntimeError('Moon ephemeris checksum mismatch')
    for name in ('naif0012.tls', 'pck00011.tpc', 'mar099-moons-2025-2035.bsp'):
        spice.furnsh(str(ROOT / name))
    loaded = True


def window_start(at=None):
    if at is None:
        seconds = datetime.now(timezone.utc).timestamp()
    else:
        if not isinstance(at, str) or len(at) > 30 or not at.endswith('Z'):
            raise ValueError('Choose a UTC time ending in Z.')
        try:
            seconds = datetime.fromisoformat(at.replace('Z', '+00:00')).timestamp()
        except (ValueError, OverflowError):
            raise ValueError('Choose a valid UTC time.') from None
    if not START <= seconds < END:
        raise ValueError('Moon ephemerides cover 2025 through 2035.')
    return math.floor(seconds / 21600) * 21600


def iso(seconds):
    return datetime.fromtimestamp(seconds, timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def quaternion(matrix):
    q = spice.m2q(matrix)  # SPICE is scalar first; browser/Cesium is scalar last.
    return [float(v) for v in (*q[1:], q[0])]


@lru_cache(maxsize=12)
def packet(start):
    # CSPICE has a process-global kernel/error pool: serialize shared accesses.
    with LOCK:
        load_kernels()
        times = [start + 120*i for i in range(181)]
        epochs = [spice.str2et(iso(t)) for t in times]
        fixed = [quaternion(spice.pxform('J2000', 'IAU_MARS', et)) for et in epochs]
        bodies = {}
        for name, (target, frame, period) in MOONS.items():
            samples = []
            for et in epochs:
                state, _ = spice.spkezr(target, et, 'J2000', 'NONE', '499')
                samples.append([*[round(float(v)*1000, 5) for v in state], *quaternion(spice.pxform(frame, 'J2000', et))])
            # A spatial orbit trace in ONE inertial frame, not a body-fixed ground
            # track. The browser rotates the entire trace into the selected Mars frame.
            orbit = []
            for i in range(769):
                et = epochs[0] + period*i/768
                p, _ = spice.spkpos(target, et, 'J2000', 'NONE', '499')
                orbit.append([round(float(v)*1000, 3) for v in p])
            radii = spice.bodvcd(int(target), 'RADII', 3)[1]
            bodies[name] = {'samples': samples, 'orbit_j2000_m': orbit, 'reference_radii_km': [float(v) for v in radii], 'orbit_trace_seconds': period}
    return {'schema': 'mars-moons/1', 'kind': 'computed_ephemeris', 'source': 'NASA/JPL NAIF MAR099 + IAU PCK00011',
            'center': 'Mars center (499)', 'sample_frame': 'J2000', 'display_frame': 'IAU_MARS', 'aberration': 'NONE',
            'units': 'metres and metres/second', 'time_scale': 'UTC input, SPICE TDB computation',
            'start_utc': iso(start), 'end_utc': iso(start+21600), 'step_seconds': 120,
            'mars_fixed_rotation_xyzw': fixed, 'bodies': bodies, 'coverage_utc': [iso(START), iso(END)],
            'notes': 'Geometric modeled positions, not live observations. Mesh texture/prime-meridian alignment is approximate. Orbit distances are never visually exaggerated.'}


def moon_request(at=None):
    return packet(window_start(at))


if __name__ == '__main__':
    try:
        request = json.load(sys.stdin)
        print(json.dumps(moon_request(request.get('at')), separators=(',', ':'), allow_nan=False))
    except ValueError as error:
        print(json.dumps({'error': str(error)}))
        sys.exit(2)

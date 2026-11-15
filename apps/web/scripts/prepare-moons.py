"""Subset verified NAIF ephemerides; original downloads remain outside the app."""
import hashlib
import json
import shutil
import sys
from pathlib import Path

if len(sys.argv) > 2:
    sys.path.insert(0, sys.argv[2])
import spiceypy as spice

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
target = root / 'data/moons'
target.mkdir(parents=True, exist_ok=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
spice.furnsh(str(source / 'naif0012.tls'))
begin = spice.str2et('2024-12-29T00:00:00')
end = spice.str2et('2036-01-03T00:00:00')
out = target / 'mar099-moons-2025-2035.bsp'
if out.exists():
    raise SystemExit('Refusing to overwrite an existing prepared kernel.')
handle = spice.dafopr(str(source / 'mar099s.bsp'))
new = spice.spkopn(str(out), 'MAR099 moons and Mars, bounded subset', 0)
spice.dafbfs(handle)
segments = []
while spice.daffna():
    desc = spice.dafgs(5)
    dc, ic = spice.dafus(desc, 2, 6)
    if int(ic[0]) in (401, 402, 499) and dc[0] < end and dc[1] > begin:
        a, b = max(begin, dc[0]), min(end, dc[1])
        spice.spksub(handle, desc, spice.dafgn(256), a, b, new)
        segments.append({'target': int(ic[0]), 'center': int(ic[1]), 'frame': int(ic[2]), 'type': int(ic[3])})
spice.spkcls(new)
spice.dafcls(handle)
for name in ('naif0012.tls', 'pck00011.tpc'):
    shutil.copyfile(source / name, target / name)
spice.kclear()
manifest = {'schema': 'mars-moon-kernels/1', 'coverage': ['2025-01-01T00:00:00Z', '2036-01-01T00:00:00Z'],
 'calculation': 'Geometric JPL MAR099 states relative to Mars center; SPICE IAU body frames and UTC/TDB conversion.',
 'files': {p.name: {'sha256': sha(p), 'bytes': p.stat().st_size} for p in target.iterdir() if p.suffix in ('.bsp', '.tls', '.tpc')},
 'sources': [{'url': 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/'+folder+'/'+name, 'sha256': sha(source/name)} for folder,name in [('spk/satellites','mar099s.bsp'),('lsk','naif0012.tls'),('pck','pck00011.tpc')]], 'segments': segments}
(target / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
(root / 'public/moons/ephemeris-provenance.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps({'segments': segments, 'subset_bytes': out.stat().st_size}))

"""Small display overview from the publisher's colorized Viking map, unchanged RGB."""
from pathlib import Path
import sys, json, hashlib
from datetime import datetime, timezone
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]);records=json.loads((source/'sources.json').read_text())
assert len(records)==128 and len({(r['x'],r['y']) for r in records})==128
image=Image.new('RGB',(4096,2048))
for r in records:
    data=(source/r['file']).read_bytes();assert hashlib.sha256(data).hexdigest()==r['sha256']
    tile=Image.open(source/r['file']);assert tile.size==(256,256)
    image.paste(tile.convert('RGB'),(r['x']*256,r['y']*256))
assets={}
for x in range(2):
    p=root/f'public/color-overview-{x}.jpg';image.crop((x*2048,0,(x+1)*2048,2048)).save(p,quality=94,subsampling=0)
    assets[p.name]=hashlib.sha256(p.read_bytes()).hexdigest()
manifest={'schema':'mars-color-context/1','prepared_at':datetime.now(timezone.utc).isoformat(),'publisher':'NASA Ames / USGS; served by NASA Trek','color_model':'publisher-colorized-viking-mdim21','photographic_native_m':232,'color_resolution':'Coarser than the photographic base; not native high-resolution RGB','overview_sampling_equatorial_m':5210,'body':'Mars','longitude':'east-positive','latitude':'planetocentric','width':4096,'height':2048,'source_level':3,'sources':records,'assets':assets}
(root/'public/color-context-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'color_overview_bytes':sum((root/'public'/p).stat().st_size for p in assets),'source_tiles':128}))

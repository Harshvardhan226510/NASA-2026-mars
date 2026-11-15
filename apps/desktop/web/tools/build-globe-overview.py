"""Build a small, fixed display overview from verified public map tiles.
No acquisition originals or scientific elevation arrays are modified.
"""
from pathlib import Path
import argparse,hashlib,json
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('input_directory',type=Path,help='Verified display tile directory produced by fetch-globe-overview.mjs')
INPUT=parser.parse_args().input_directory.resolve()
records=json.loads((INPUT/'sources.json').read_text(encoding='utf-8'))
width,height=4096,2048
primary=Image.new('RGBA',(width,height));base=Image.new('RGB',(2048,1024))
for r in records:
 if r.get('missing'):continue
 raw=(INPUT/r['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==r['sha256']
 image=Image.open(INPUT/r['file']);size=512 if r['kind']=='imagery' else 256
 assert image.size==(size,size)
 (primary if r['kind']=='imagery' else base).paste(image.convert('RGBA' if r['kind']=='imagery' else 'RGB'),(r['x']*size,r['y']*size))
p=np.asarray(primary).astype(np.float32);b=np.asarray(base.resize((width,height),Image.Resampling.BILINEAR)).astype(np.float32)
gray=lambda rgb:rgb[:,:,0]*.2125+rgb[:,:,1]*.7154+rgb[:,:,2]*.0721
pg,bg=gray(p),gray(b);valid=p[:,:,3]>=250
# One geographic field, shared by every level and both viewers. It never
# stretches the valid CTX photographs and never uses darkness as missing data.
step=32;tw,th=width//step,height//step
counts=valid.reshape(th,step,tw,step).sum(axis=(1,3));delta=np.clip(pg-bg,-64,64)
sums=(delta*valid).reshape(th,step,tw,step).sum(axis=(1,3));known=counts>0
field=np.divide(sums,counts,out=np.zeros_like(sums),where=known)
field[~known]=field[known].mean() if known.any() else 0
fixed=field.copy()
for i in range(256):
 vertical=np.concatenate([field[:1],field[:-1]])+np.concatenate([field[1:],field[-1:]])
 field=np.where(known,fixed,(np.roll(field,1,axis=1)+np.roll(field,-1,axis=1)+vertical)/4)
# Periodic longitude interpolation, to avoid a correction jump at the dateline.
padded=np.concatenate([field[:,-1:],field,field[:,:1]],axis=1)
correction=np.asarray(Image.fromarray(padded.astype(np.float32)).resize((width+step*2,height),Image.Resampling.BILINEAR))[:,step:-step]
alpha=p[:,:,3]/255
# Feather only the immediate edge of an actual source alpha gap, across source
# tile boundaries as well. Fully opaque interiors and black shadows are retained.
distance=np.where(alpha<=0,0,3).astype(np.float32)
for i in range(3):
 distance=np.minimum(distance,np.minimum(np.roll(distance,1,axis=1),np.roll(distance,-1,axis=1))+1)
 distance=np.minimum(distance,np.minimum(np.concatenate([distance[:1],distance[:-1]]),np.concatenate([distance[1:],distance[-1:]]))+1)
t=np.clip(distance/3,0,1);alpha*=t*t*(3-2*t)
photograph=np.clip(np.rint(pg*alpha+np.clip(bg+correction,0,255)*(1-alpha)),0,255).astype(np.uint8)
for x in range(2):Image.fromarray(photograph[:,x*2048:(x+1)*2048]).save(ROOT/f'public/globe-overview-{x}.jpg',quality=94,subsampling=0)
tone={'schema':'mars-optical-tone/1','width':tw,'height':th,'wrapLongitude':True,'values':np.round(field,3).reshape(-1).tolist()}
(ROOT/'public/globe-optical-tone.json').write_text(json.dumps(tone,separators=(',',':')),encoding='utf-8')
manifest={'schema':'mars-globe-overview/1','sourceLevel':2,'width':width,'height':height,'samplingEquatorialM':5210,'description':'Fixed-scale CTX photograph with measured Viking optical context only in source-alpha gaps. Grayscale display, fixed global gap brightness reference. Display overview; not a native-detail or elevation replacement.','sourceAlphaGapFraction':float((p[:,:,3]<255).mean()),'sources':records,'assets':{f'globe-overview-{x}.jpg':hashlib.sha256((ROOT/f'public/globe-overview-{x}.jpg').read_bytes()).hexdigest() for x in range(2)}}
(ROOT/'public/globe-overview-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'alpha_gap_fraction':manifest['sourceAlphaGapFraction'],'display_bytes':sum((ROOT/f'public/globe-overview-{x}.jpg').stat().st_size for x in range(2)),'tone_bytes':(ROOT/'public/globe-optical-tone.json').stat().st_size}))

import pathlib,json,hashlib,struct,itertools,datetime,urllib.request,numpy as np
import sys
APP=pathlib.Path(__file__).resolve().parents[1]
if len(sys.argv)!=2:raise SystemExit('Usage: python scripts/prepare-spacecraft.py <extracted-handoff-directory>')
SRC=pathlib.Path(sys.argv[1]).resolve()
OUT=APP/'public/spacecraft'
OUT.mkdir(exist_ok=True)
(OUT/'models').mkdir(exist_ok=True)
(OUT/'tracks').mkdir(exist_ok=True)
(APP/'data/spacecraft').mkdir(exist_ok=True)
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
catalog=json.loads((SRC/'spacecraft_catalog.json').read_text())
assets=json.loads((SRC/'asset_catalog.json').read_text())
manifest=json.loads((SRC/'MANIFEST.json').read_text())
for m in manifest:
 assert hashlib.sha256((SRC/m['path']).read_bytes()).hexdigest()==m['sha256'],m['path']

def matrix(n):
 if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
 x,y,z,w=n.get('rotation',[0,0,0,1])
 q=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
 m=np.eye(4);m[:3,:3]=q@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m

def bounds(j):
 pts=[]
 def walk(i,parent):
  n=j['nodes'][i];m=parent@matrix(n)
  if 'mesh' in n:
   for p in j['meshes'][n['mesh']]['primitives']:
    a=j['accessors'][p['attributes']['POSITION']]
    for t in itertools.product(*zip(a['min'],a['max'])):pts.append((m@np.array([*t,1]))[:3])
  for c in n.get('children',[]):walk(c,m)
 for i in j['scenes'][j.get('scene',0)]['nodes']:walk(i,np.eye(4))
 return np.min(pts,axis=0),np.max(pts,axis=0)

models=[]
for asset in assets['nasa_models']:
 b=(SRC/asset['packaged_path']).read_bytes();assert hashlib.sha256(b).hexdigest()==asset['sha256']
 jl=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+jl]);lo,hi=bounds(j)
 # The Viking artwork uses arbitrary units. NASA's encounter press kit gives ~2 m height.
 # Other surface artwork already uses approximately metre-sized geometry; never fit its pose to a bounding-box height.
 scale=2/(hi[1]-lo[1]) if asset['id']=='viking' else 1
 centre=(lo+hi)/2;translation=[-centre[0]*scale,-lo[1]*scale,-centre[2]*scale]
 roots=j['scenes'][j.get('scene',0)]['nodes']
 wrapper=len(j['nodes']);j['nodes'].append({'name':'Atlas display normalization (Y-up base centred)', 'children':roots,'translation':translation,'scale':[scale]*3})
 j['scenes'][j.get('scene',0)]['nodes']=[wrapper]
 chunk=json.dumps(j,separators=(',',':')).encode();chunk+=b' '*((-len(chunk))%4)
 binary=b[20+jl:];body=struct.pack('<I4s',len(chunk),b'JSON')+chunk+binary
 derived=struct.pack('<4sII',b'glTF',2,len(body)+12)+body
 path=OUT/'models'/f"{asset['id']}.glb";path.write_bytes(derived)
 models.append({**asset,'url':f"/spacecraft/models/{asset['id']}.glb",'derived_sha256':hashlib.sha256(derived).hexdigest(),'derived_bytes':len(derived),'bounds_size':((hi-lo)*scale).tolist(),'normalization':{'translation':translation,'scale':scale,'up_axis':'Y','bottom_y':0},'scale_note':'Reference artwork; approximate size and pose, not surveyed geometry. Viking height normalized to approximately 2 m.' if asset['id']=='viking' else 'Reference artwork in source units, approximately metre scale for surface vehicles. Pose and attitude are illustrative.'})

def fetch(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'MarsFieldAtlas/1.0 source verification'}),timeout=55) as r:
  raw=r.read(16000000)
  if len(raw)>=16000000:raise ValueError('Source too large')
  return json.loads(raw),{'source':url,'retrieved_at':now,'file_last_modified':r.headers.get('Last-Modified'),'raw_sha256':hashlib.sha256(raw).hexdigest()},raw

feeds={
 'curiosity':('MSL','MSL_waypoints_current.json','MSL_traverse.json'),
 'perseverance':('M20','M20_waypoints_current.json','M20_traverse.json'),
 'ingenuity':('M20','m20_heli_waypoints_current.json','m20_heli_flight_path.json')}
packet={'schema':'mars-spacecraft-positions/1','retrieved_at':now,'positions':{},'health':{'state':'snapshot'}}
tracks={}
for ident,(mission,current,track) in feeds.items():
 prefix=f'https://mars.nasa.gov/mmgis-maps/{mission}/Layers/json/'
 try:
  data,meta,raw=fetch(prefix+current)
  (APP/'data/spacecraft'/f'{ident}-current.geojson').write_bytes(raw)
  f=data['features'][-1];lon,lat,*_=f['geometry']['coordinates'];props=f['properties']
  assert isinstance(lon,(int,float)) and isinstance(lat,(int,float)) and -90<=lat<=90 and -180<=lon<=360
  loc={'lon_east':(lon+180)%360-180,'lat_planetocentric':lat,'classification':'last_published_localization','uncertainty_m':None,**meta,'sol':props.get('sol',props.get('Sol')),'earth_date':props.get('Earth_Date'),'elevation_m':props.get('elev_geoid',props.get('Elev_Geoid')),'elevation_datum':'source geoid; not WGS84 ellipsoidal altitude','record_id':props.get('RMC'),'flight':props.get('Flight')}
  packet['positions'][ident]=loc
  next(x for x in catalog['objects'] if x['id']==ident)['location']=loc
  data,meta,raw=fetch(prefix+track)
  (OUT/'tracks'/f'{ident}.json').write_text(json.dumps({'schema':'mars-spacecraft-track/1',**meta,'data':data},separators=(',',':')))
  tracks[ident]={'url':f'/spacecraft/tracks/{ident}.json',**meta}
  print('REFRESHED',ident,loc['sol'],lon,lat,'track features',len(data['features']))
 except Exception as e:raise RuntimeError(f'Cannot verify NASA {ident}: {e}')

for ident,file in [('spirit','mera_traverse.geojson'),('opportunity','merb_traverse.geojson')]:
 data=json.loads((SRC/'locations'/file).read_text());lines=[]
 for f in data['features']:
  g=f.get('geometry') or {}
  if g.get('type')=='LineString':lines.append(g['coordinates'])
  elif g.get('type')=='MultiLineString':lines.extend(g['coordinates'])
 # Keep every corrected traverse vertex; strip bulky repeated attributes, never bridge source gaps.
 coordinates=[[[round((c[0]+180)%360-180,8),round(c[1],8)] for c in line] for line in lines if len(line)>1]
 source=next(x for x in catalog['objects'] if x['id']==ident)['location']['source']
 meta={'source':source,'retrieved_at':'2026-10-18','frame':'Mars_2000_Sphere','note':'Corrected science-team traverse; some interpolated positions; not a PDS-archived product.'}
 body={'schema':'mars-spacecraft-track/1',**meta,'data':{'type':'FeatureCollection','features':[{'type':'Feature','properties':{},'geometry':{'type':'MultiLineString','coordinates':coordinates}}]}}
 (OUT/'tracks'/f'{ident}.json').write_text(json.dumps(body,separators=(',',':')))
 tracks[ident]={'url':f'/spacecraft/tracks/{ident}.json',**meta}

for x in catalog['objects']:
 if x['id']=='maven':x['source']='https://www.nasa.gov/news-release/nasa-says-farewell-to-maven-mars-mission-hosts-media-call-today/'
 l=x.get('location')
 if l and isinstance(l.get('lon_east'),(int,float)):l['lon_east']=(l['lon_east']+180)%360-180
 x['track']=tracks.get(x['id'])
 # Retain source classifications; no operational-state inference from stale localization or file timestamps.
 x['status_label']={'active_rover_public_localization':'Published rover positions','historical':'Mission ended','flight_ended_2024':'Flights ended · 2024','impact_debris':'Impact debris','historical_location_unconfirmed':'Location unconfirmed','hibernation_last_reported_no_current_telemetry_verified':'Last reported in hibernation','mission_ended_2026_historical_geometry_only':'Mission ended · 2026','historical_mission_no_current_position_verified':'Historical orbiter','operational_status_and_current_ephemeris_must_be_checked':'Orbital position unavailable'}.get(x['status'],'Status unverified')
catalog.update(schema='mars-spacecraft-catalog/1',refreshed_at=now,models=models,source_commit='11ebb4ee043715aefbba6aeec8a61746fad67fa7')
(OUT/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n')
(OUT/'positions.json').write_text(json.dumps(packet,indent=2)+'\n')
(APP/'data/spacecraft/bootstrap.json').write_text(json.dumps(packet,indent=2)+'\n')
(OUT/'asset-sources.json').write_text(json.dumps(assets,indent=2)+'\n')
print('Catalog',len(catalog['objects']),'models',len(models),'total model bytes',sum(x['derived_bytes'] for x in models))

"""Prepare source-pinned additions without changing existing reference packets.

Requires numpy and pyshtools 4.13.1. --cache contains original VICAR responses
and capabilities.xml, retrieved from the URLs retained in the manifest.
"""
import argparse,gzip,hashlib,json,re,sys
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
R=3396190.0
def digest(body):return hashlib.sha256(body).hexdigest()

def read_vicar(path):
 body=path.read_bytes();header=body[:4000].decode('ascii',errors='replace')
 def get(key):
  match=re.search(r'\b'+key+r"=(?:'([^']*)'|([0-9]+))",header)
  if not match:raise ValueError('Missing VICAR field '+key)
  return match.group(1) if match.group(1) is not None else match.group(2)
 assert get('ORG')=='BSQ' and get('NB')=='1' and get('NBB')=='0' and get('NLB')=='0'
 fmt=get('FORMAT');kind={'REAL':'f4','DOUB':'f8','FULL':'i4','HALF':'i2','BYTE':'u1'}[fmt]
 endian='<' if get('REALFMT' if kind[0]=='f' else 'INTFMT') in ['RIEEE','LOW'] else '>'
 dtype=np.dtype(endian+kind);offset=int(get('LBLSIZE'));w=int(get('NS'));h=int(get('NL'))
 assert len(body)==offset+w*h*dtype.itemsize,'Incomplete VICAR response: '+path.name
 return np.frombuffer(body,dtype=dtype,offset=offset).reshape(h,w).astype('<f4'),digest(body)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--cache',type=Path,required=True);args=parser.parse_args()
 out=ROOT/'public/scientific';manifest=json.loads((out/'manifest.json').read_text('utf-8'))
 source_checks=[]
 def save(key,values,units,native,sources,processing,display=None,extra=None):
  values=np.asarray(values,dtype='<f4');raw=values.tobytes();encoded=gzip.compress(raw,mtime=0);name=key+'.f32.gz';(out/name).write_bytes(encoded)
  valid=values[np.isfinite(values)];assert valid.size and not np.isinf(values).any()
  checks=[]
  for fy,fx in [(.25,.25),(.5,.5),(.75,.75)]:
   y=int(fy*values.shape[0]);x=int(fx*values.shape[1]);v=float(values[y,x]);checks.append({'row':y,'column':x,'value':v if np.isfinite(v) else None})
  item={'file':name,'width':values.shape[1],'height':values.shape[0],'bounds':[-180,-90,180,90],'packet_sha256':digest(raw),'sha256':digest(encoded),'sources':sources,'units':units,'native_sampling':native,'processing':processing,'minimum':float(valid.min()),'maximum':float(valid.max()),'valid_pixels':int(valid.size),'verification_points':checks,'prepared':'2026-10-23'}
  if display:item['display']=display
  if extra:item.update(extra)
  manifest['layers'][key]=item
 def wms(key,name,units,native,null,url,notes,display):
  data,sha=read_vicar(args.cache/(name+'.vic'));h,w=data.shape
  if null is not None:data[data==np.float32(null)]=np.nan
  request=f'http://ms-mars.mars.asu.edu/?SERVICE=WMS&REQUEST=GetMap&FORMAT=image/vicar&WIDTH={w}&HEIGHT={h}&SRS=EPSG:4326&BBOX=-180,-90,180,90&STYLES=&VERSION=1.1.1&LAYERS={name}'
  source=[{'title':'ASU JMARS · '+name,'url':url,'download_url':request,'source_sha256':sha,'capabilities_sha256':digest((args.cache/'capabilities.xml').read_bytes())}]
  save(key,data,units,native,source,notes,display)
  source_checks.append({'key':key,'original_sha256':sha,'declared_null':null,'shape':[h,w]})
 wms('rock-abundance','tes_rock_abundance_numeric','% rock','TES 8 pixels/degree (~7.5 km); delivery 4 pixels/degree (~15 km)',0,'https://doi.org/10.1029/2006JE002798','Published TES thermal-model rock abundance. Source NullValue 0 is masked exactly; it is not interpreted as zero rocks. Nonzero integer percentages retain their original values. EPSG:4326 signed-east request is already north-up; no longitude rolling or gap filling.',{'min':0,'max':60,'title':'Rock abundance · TES reference','note':'% rock from orbital thermal modeling · ≈15 km delivery · no individual-boulder or route-safety claim'})
 wms('surface-dust-cover-index-reference-composite','TES_dust_index_16ppd_numeric','dust cover index','TES 16 pixels/degree (~3.5 km); delivery 4 pixels/degree (~15 km)',0.85000002,'https://www.mars.asu.edu/data/tes_ruffdust/','Published Ruff and Christensen (2002) dimensionless DCI. Mask only the exact float32 source sentinel 0.85000002; retain other finite source values, including outliers. No conversion to dust thickness, airborne opacity or current conditions.',{'min':.85,'max':1,'title':'Surface dust cover · TES reference','note':'Lower index: finer / dustier surface · higher: less fine dust · static reference; not atmospheric dust. Values outside the display ramp remain in the source-cell readout.'})
 wms('gravity-anomalies','grav_jgmro_120d_anom_095','mGal','JPL MRO120D degrees 2–95; ≈1° / 59 km delivery',None,'https://pds-geosciences.wustl.edu/missions/mro/gravity.htm','ASU-served JGMRO_120D_ANOM_095. Difference of model gravity on the geoid from normal gravity on the publisher reference ellipsoid (a=3397 km, GM=42828.37582 km³/s², f=0.005079304192, rotation=7.088218081e-5 rad/s). Preserve signed mGal; 1 mGal = 1e-5 m/s². Not Bouguer anomaly or total surface acceleration.',{'min':-3500,'max':3500,'title':'Gravity anomaly · JPL MRO120D','note':'Signed mGal relative to the model reference ellipsoid · degrees 2–95 · not local g or a buried-resource measurement'})

 # Catalogue density is a spherical-cap count, never a planetary resource map.
 catalogue_body=(ROOT/'public/value-sites.json').read_bytes();catalogue=json.loads(catalogue_body)
 records=[s for s in catalogue['sites'] if isinstance(s.get('center'),list) and len(s['center'])==2 and all(isinstance(v,(float,int)) and np.isfinite(v) for v in s['center']) and abs(s['center'][1])<=90]
 assert len({s['id'] for s in records})==len(records)
 coords=np.deg2rad(np.array([s['center'] for s in records]));xyz=np.column_stack([np.cos(coords[:,1])*np.cos(coords[:,0]),np.cos(coords[:,1])*np.sin(coords[:,0]),np.sin(coords[:,1])])
 lon,lat=np.meshgrid(np.deg2rad(np.arange(-179.5,180,1)),np.deg2rad(np.arange(89.5,-90,-1)))
 grid=np.column_stack([np.cos(lat.ravel())*np.cos(lon.ravel()),np.cos(lat.ravel())*np.sin(lon.ravel()),np.sin(lat.ravel())])
 for radius in [100,250]:
  threshold=np.cos(radius*1000/R);counts=np.zeros(grid.shape[0],dtype='<f4')
  for start in range(0,grid.shape[0],128):counts[start:start+128]=np.count_nonzero(grid[start:start+128]@xyz.T>=threshold,axis=1)
  data=counts.reshape(lat.shape);area=2*np.pi*R**2*(1-threshold)/1e6
  save(f'catalogue-density-{radius}km',data,f'catalogue records within {radius} km','1° evaluation grid (~59 km); fixed spherical-cap count',[{'title':'Atlas sourced target catalogue · per-record primary citations','url':'/value-sites.json','source_sha256':digest(catalogue_body)}],f'Count each of {len(records)} unique catalogue IDs once when its published representative coordinate is within {radius} km. Spherical Mars radius {R} m; cap area {area:.3f} km². Multiple records can describe the same locality; records are not equal-sized deposits. Zero means no catalogue records in this window, not absence of scientific interest. Global catalogue completeness is not established.',{'min':0,'max':float(data.max()),'title':f'Catalogue target density · {radius} km radius','note':'Counts catalogue records only · uneven research coverage · zero does not mean no science or resources'},{'record_count':len(records),'radius_km':radius,'cap_area_km2':area})

 # Synthesize signed magnetic vector components from the already pinned model.
 import pyshtools as pysh
 source=ROOT/'tools/data/Langlais2019.sh.gz';sha=digest(source.read_bytes());assert sha=='3cad9e268f0673be1702f1df504a4cbcb8dba4480c7b3f629921911488fe247b'
 radius=3393500.;model=pysh.SHMagCoeffs.from_file(str(source),lmax=134,skip=4,r0=radius,header=False,file_units='nT',units='nT');assert model.normalization=='schmidt' and model.csphase==1
 for altitude in [150000,0]:
  field=model.expand(a=radius+altitude,f=0,lmax=179,lmax_calc=134,sampling=2,extend=True)
  components=[('radial',field.rad.data,0,1,'outward'),('north',-field.theta.data,1,-1,'north'),('east',field.phi.data,2,1,'east')]
  for component,original,index,sign,positive in components:
   nodes=np.roll(original[:,:-1],360,axis=1)
   # Four neighboring 0.5° synthesis nodes form each 0.5° delivery pixel centre.
   data=(nodes[:-1]+np.roll(nodes[:-1],-1,axis=1)+nodes[1:]+np.roll(nodes[1:],-1,axis=1))/4
   if component!='radial':data[[0,-1],:]=np.nan # tangent basis at exact poles is singular
   checks=[]
   for row,col in [(2,0),(357,400),(180,0),(180,360),(140,101),(210,511),(120,170)]:
    la,lo=89.75-row*.5,-179.75+col*.5;expected=float(model.expand(lat=la,lon=lo,r=radius+altitude,lmax_calc=134)[index])*sign;actual=float(data[row,col]);error=abs(actual-expected)
    assert error<max(2,np.nanmax(np.abs(data))*.025),(component,altitude,error)
    checks.append({'lon':lo,'lat':la,'point_synthesis_nT':expected,'delivered_nT':actual,'resampling_error_nT':error})
   scale=1500 if altitude else 20000
   save(f'magnetic-{component}-{altitude//1000}km',data,'nT',f'Langlais 2019 degree 134 (~160 km surface resolving power); 0.5° delivery',[{'title':'Langlais et al. (2019) published model coefficients','url':'https://zenodo.org/records/3876714','source_sha256':sha}],f'Schmidt semi-normalized coefficients; pyshtools {pysh.__version__}. Br outward, Bnorth=-Btheta, Beast=Bphi. Evaluation radius {radius+altitude} m: {altitude/1000:g} km above the 3393.5 km model reference sphere, not terrain. Bilinear node-to-pixel-centre resampling; horizontal components masked in the two polar half-cells rather than using singular tangent limits. Not live fields, shielding or radiation dose.',{'min':-scale,'max':scale,'title':f'Crustal field · {component} · {altitude//1000} km','note':f'Positive = {positive} · nT · static model above reference sphere, not local terrain; display can saturate, readout retains the value.'},{'altitude_m':altitude,'component':component,'point_synthesis_checks':checks})
 manifest['extended']='2026-10-23';(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n','utf-8')
 (args.cache/'preparation-audit.json').write_text(json.dumps({'source_checks':source_checks,'added_assets':11,'catalogue_records':len(records),'physical_mars_radius_m':R},indent=2)+'\n')
 print(json.dumps({'reference_assets':len(manifest['layers']),'added_assets':11,'catalogue_records':len(records)}))
if __name__=='__main__':main()

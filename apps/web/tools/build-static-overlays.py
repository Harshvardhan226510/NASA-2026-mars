"""Prepare compact, checksum-pinned numeric reference overlays.
Run with --cache PATH and --swim-zip PATH. Source arrays are preserved except
for longitude reordering, documented nodata masks, and optional decimation.
No instrument products are inferred from other quantities.
"""
import argparse,gzip,hashlib,json,re,sys,urllib.request
from pathlib import Path
import numpy as np

def main():
 p=argparse.ArgumentParser();p.add_argument('--cache',required=True);p.add_argument('--swim-zip');p.add_argument('--mons-vicar');a=p.parse_args()
 cache=Path(a.cache);out=Path(__file__).resolve().parents[1]/'public/scientific';out.mkdir(exist_ok=True,parents=True)
 manifest={'schema':'mars-static-overlays/1','prepared':'2026-10-18','coordinate_convention':'planetocentric latitude; signed east longitude; pixel centres; north-to-south rows','layers':{}}
 def save(key,data,bounds,source,units,native,notes):
  data=np.asarray(data,dtype='<f4');raw=data.tobytes();encoded=gzip.compress(raw,mtime=0);file=key+'.f32.gz';(out/file).write_bytes(encoded)
  finite=data[np.isfinite(data)]
  points=[]
  for fy,fx in [(0.25,0.25),(.5,.5),(.75,.75)]:
   y=int(fy*data.shape[0]);x=int(fx*data.shape[1]);v=float(data[y,x]);points.append({'column':x,'row':y,'value':v if np.isfinite(v) else None})
  manifest['layers'][key]={'file':file,'width':data.shape[1],'height':data.shape[0],'bounds':bounds,'packet_sha256':hashlib.sha256(raw).hexdigest(),'sha256':hashlib.sha256(encoded).hexdigest(),'sources':source,'units':units,'native_sampling':native,'processing':notes,'minimum':float(finite.min()),'maximum':float(finite.max()),'valid_pixels':len(finite),'verification_points':points}
 def vicar(name,small=False):
  file=cache/(name+('-720' if small else '')+'.vic');b=file.read_bytes();h=b[:4000].decode(errors='replace');get=lambda k:next(v for v in re.search(r"\b"+k+r"=(?:'([^']*)'|(\d+))",h).groups() if v is not None)
  offset=int(get('LBLSIZE'));w=int(get('NS'));height=int(get('NL'));assert len(b)==offset+w*height*4,'Incomplete VICAR '+name
  assert get('NB')=='1' and get('NBB')=='0' and get('NLB')=='0' and get('ORG')=='BSQ'
  dtype=('<' if get('REALFMT')=='RIEEE' else '>')+'f4' if get('FORMAT')=='REAL' else ('<' if get('INTFMT')=='LOW' else '>')+'i4'
  data=np.frombuffer(b,dtype=dtype,offset=offset).reshape(height,w).astype('float32');data=np.roll(data,w//2,axis=1)
  text=(cache/(name+'.html')).read_text();url=next(l for l in re.findall('href="([^"]+)"',text) if 'FORMAT=image/vicar' in l)
  if small:url=re.sub(r'WIDTH=\d+','WIDTH=720',re.sub(r'HEIGHT=\d+','HEIGHT=360',url))
  return data,{'title':'NASA MGS/TES · ASU '+name,'url':'https://www.mars.asu.edu/data/'+name+'/','download_url':url,'source_sha256':hashlib.sha256(b).hexdigest()}
 products=[('thermal-inertia','tes_ti','J m⁻² K⁻¹ s⁻½','8 pixels/degree (~7.5 km)',True),('surface-albedo-reference-composite','tes_albedo','unitless Lambert albedo','8 pixels/degree (~7.5 km)',False),('olivine-abundance','tes_olivine','spectral fraction','4 pixels/degree (~15 km)',False),('feldspar-abundance','tes_kfeldspar','spectral fraction (K-feldspar)','4 pixels/degree (~15 km)',False),('hematite-abundance','tes_hematite','spectral fraction','4 pixels/degree (~15 km)',False),('high-ca-pyroxene','tes_clinopyroxene','spectral fraction','4 pixels/degree (~15 km)',False),('low-ca-pyroxene','tes_orthopyroxene','spectral fraction','4 pixels/degree (~15 km)',False),('glass-clay','tes_silicates','spectral fraction (glass + sheet silicates)','4 pixels/degree (~15 km)',False)]
 arrays={}
 for key,name,units,native,small in products:
  d,source=vicar(name,small);d[d<0]=np.nan;arrays[key]=(d,source)
  save(key,d,[-180,-90,180,90],[source],units,native,'As served by author-listed numeric WMS; 0–360° grid rolled to −180–180°. Negative mineral sentinels become NoData. Thermal-inertia delivery sampled at 2 pixels/degree; other arrays retain the requested native sampling. Spectral fractions are unmixing estimates, not extractable ore grades. Values have not been sharpened or filled.')
 hi,hs=arrays['high-ca-pyroxene'];lo,ls=arrays['low-ca-pyroxene'];save('pyroxene-abundance',hi+lo,[-180,-90,180,90],[hs,ls],'spectral fraction (high + low Ca)','4 pixels/degree (~15 km)','Sum of the two published pyroxene fractions only where both are valid.')
 if a.swim_zip:
  import rasterio
  z=Path(a.swim_zip).resolve();ziphash=hashlib.sha256(z.read_bytes()).hexdigest()
  for band in ['0_1','1_5','5']:
   member='SWIM4MIM_Ci_'+band+'.tif'
   with rasterio.open('/vsizip/'+z.as_posix()+'/'+member) as ds:
    d=ds.read(1).astype('float32');d[d==ds.nodata]=np.nan
    radius=ds.crs.to_dict().get('R',3396190);left,bottom,right,top=ds.bounds;bounds=[v/radius*180/np.pi for v in [left,bottom,right,top]]
    assert abs(bounds[0]+180)<.001 and abs(bounds[3]-60)<.001
   save('ice-'+band,d,[-180,-60,180,60],[{'title':'PSI/JPL SWIM4IMIM · August 2025 reference composite','url':'https://swim.psi.edu/SWIM4MIMProducts.php','source_sha256':ziphash,'member':member}],'ice consistency (−1 to +1)','20 pixels/degree (~3 km)','Original signed composite ice consistency, not probability or reserves. Sensing-depth band '+band.replace('_','–')+' m (>5 m for 5). NoData −30 remains transparent. Source projected grid maps to ±180° and ±60° within 0.001°; geographic bounds normalized to those published limits. No gap filling.')
 # PDS GRS tables retain fit uncertainty and invalid bins; no spatial smoothing.
 base='https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/unsmoothed/5x5/'
 for element,key,factor,units in [('k','potassium-abundance',1,'weight % K'),('th','thorium-abundance',10000,'ppm Th'),('h2o','water-equivalent-hydrogen',1,'weight % H₂O equivalent')]:
  table=cache/(element+'_5x5.tab');label=cache/(element+'_5x5.lbl')
  if not table.exists():continue
  rows=np.loadtxt(table);assert rows.shape==(2592,5)
  data=np.full((36,72),np.nan,dtype='float32');sigma=data.copy()
  for lat,lon,value,error,cfs in rows:
   row=int(round((87.5-lat)/5));col=int(round((((lon+180)%360)-2.5)/5))
   assert 0<=row<36 and 0<=col<72
   if abs(value)<9999:data[row,col]=value*factor
   if abs(error)<9999:sigma[row,col]=error*factor
  source=[{'title':'NASA PDS Odyssey GRS '+element.upper()+' 5° unsmoothed · v2.0','url':'https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html','download_url':base+table.name,'label_url':base+label.name,'source_sha256':hashlib.sha256(table.read_bytes()).hexdigest(),'label_sha256':hashlib.sha256(label.read_bytes()).hexdigest()}]
  notes='2002-06-04 to 2005-04-03 observations; invalid 9999.999 bins transparent. Negative peak-fit estimates retained, not interpreted as physically negative abundance. Thorium converted from weight percent to ppm by ×10,000. 5° bins are not instrument resolving power. Water equivalent does not establish extractable ice. See separate sigma asset for published statistical errors; correction-factor errors are not added.'
  save(key,data,[-180,-90,180,90],source,units,'5° bins (~296 km at equator)',notes)
  save(key+'-sigma',sigma,[-180,-90,180,90],source,units+' (1σ statistical)', '5° bins',notes)
 if a.mons_vicar:
  file=Path(a.mons_vicar);b=file.read_bytes();header=b[:5760].decode('ascii');offset=int(re.search(r'LBLSIZE=(\d+)',header).group(1))
  assert "FORMAT='DOUB'" in header and "REALFMT='RIEEE'" in header and 'NL=360 ' in header and 'NS=720 ' in header and "ORG='BSQ'" in header
  assert len(b)==offset+720*360*8
  d=np.frombuffer(b,dtype='<f8',offset=offset).reshape(360,720)
  assert np.isfinite(d).all() and d.min()>=0 and d.max()<100.0001
  # EPSG:4326 request is already signed east / north-up. Do not roll it again.
  url='http://ms-mars.mars.asu.edu/?SERVICE=WMS&REQUEST=GetMap&FORMAT=image/vicar&WIDTH=720&HEIGHT=360&SRS=EPSG:4326&BBOX=-180,-90,180,90&STYLES=&VERSION=1.1.1&LAYERS=mars_odyssey_grs_mons_perc_wt'
  save('mons-weh',d,[-180,-90,180,90],[{'title':'ASU JMARS · Mars Odyssey Neutron Spectrometer % WEH · Wilson et al. (2017)','url':'https://doi.org/10.1016/j.icarus.2017.07.028','service_url':'https://www.mars.asu.edu/data/','download_url':url,'source_sha256':hashlib.sha256(b).hexdigest()}],'wt% water-equivalent hydrogen','0.5° grid (~30 km); effective resolution ~290 km','ASU published numeric MONS reconstruction, ingested by ASU 2019-02-22; global 720×360 array including both polar regions. Source DOUB/RIEEE converted to float32 only. No SWIM merging, gap filling, saturation replacement or scientific smoothing. Values near 100 are model-limited hydrogen estimates, not confirmed pure or accessible water ice. Service registration cross-checked with MOLA Olympus Mons at 133.5°W, 17.5°N. Grid spacing is finer than the ~290 km effective resolving power in Wilson et al. (2017).')
  manifest['layers']['mons-weh']['display']={'min':0,'max':100,'title':'Global near-surface hydrogen · MONS','note':'Both polar regions covered · wt% H₂O equivalent, not ice probability · ~290 km effective resolution. High values may reach the model limit; no reserves claim.'}
 (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'layers':len(manifest['layers']),'bytes':sum(p.stat().st_size for p in out.glob('*.gz'))}))
if __name__=='__main__':main()

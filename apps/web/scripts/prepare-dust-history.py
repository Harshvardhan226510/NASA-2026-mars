"""Lossless display packaging of MDAD v1.1. Never extracts the multi-GB masks.

Requires numpy, h5py, Pillow. Supply downloaded, checksum-verified MY*.tar.gz.
The native member IDs and 255 missing-observation mask survive in PNG pixels.
"""
import argparse, hashlib, json, pathlib, tarfile, shutil
from datetime import datetime, timezone
import h5py
import numpy as np
from PIL import Image

EXPECTED = {28:'d7286d6c242f049408b6cfa6cbdc1a63',29:'cf034b22565e489b7c9b6171f9ba760f',30:'edd7a0c58113efbabe1ab13b764ea63d',31:'7b92f2c156ecb9287545887a85cb8dc7',32:'8d5be022d5e480438e3809943f931bfe'}
def prepare(source, output):
    output.mkdir(parents=True, exist_ok=True)
    frames, provenance = [], []
    old_index=output/'index.json'
    previous=json.loads(old_index.read_text(encoding='utf8')) if old_index.exists() else {'frames':[]}
    old_hashes={}
    for year, md5 in EXPECTED.items():
        archive = source / f'MY{year}.tar.gz'
        if not archive.exists():
            continue
        raw = archive.read_bytes()
        if hashlib.md5(raw).hexdigest() != md5:
            raise ValueError(f'MY{year} publisher checksum mismatch')
        provenance.append(dict(year=year,url=f'https://zenodo.org/records/7480334/files/MY{year}.tar.gz',md5=md5,sha256=hashlib.sha256(raw).hexdigest()))
        # h5py's file-object driver seeks inside the gzip stream. Only one frame
        # occupies memory; no 2–4 GB uncompressed temporary file is written.
        with tarfile.open(archive) as tar:
            member = next(m for m in tar if m.name.endswith('.nc'))
            with tar.extractfile(member) as stream, h5py.File(stream, 'r') as data:
                lons,lats=data['lon'][:],data['lat'][:]
                assert np.allclose(lons,np.arange(3600)*.1-180,atol=.00002)
                assert np.allclose(lats,np.arange(1801)*.1-90,atol=.00002)
                days,times=data['dayList'][:],data['timeList'][:]
                old_frames=[f for f in previous['frames'] if f['year']==year]
                for i, (day,time) in enumerate(zip(days,times)):
                    name=day.decode(); identifier=f'MY{year}-{name}-f{i:04d}';path=output/(identifier+'.png')
                    # The publisher repeats day labels for some all-zero slots.
                    # Use source array index as identity; never overwrite a
                    # real observation with a later empty frame of the same name.
                    prior=old_frames[i] if len(old_frames)==len(days) else None
                    candidate=output/prior['file'] if prior else None
                    if candidate and candidate.exists():
                        if candidate.name not in old_hashes:old_hashes[candidate.name]=hashlib.sha256(candidate.read_bytes()).hexdigest()
                    if candidate and candidate.exists() and old_hashes[candidate.name]==prior['sha256']:
                        if candidate!=path:shutil.copyfile(candidate,path)
                        storm,missing=prior['storm_pixels'],prior['missing_pixels']
                    else:
                        image=data['MDAD'][i].T[::-1,:]
                        if np.any((image>250)&(image!=255)):raise ValueError('Undocumented MDAD mask category')
                        Image.fromarray(image).save(path,optimize=True)
                        assert np.array_equal(np.asarray(Image.open(path)),image)
                        storm=int(np.count_nonzero((image>0)&(image<251)));missing=int(np.count_nonzero(image==255))
                    frames.append(dict(id=identifier,source_index=i,year=year,day=name,soy=round(float(time[2]),3),ls=round(float(time[6]),3),soy_interval=[round(float(x),3) for x in time[:2]],ls_interval=[round(float(x),3) for x in time[4:6]],file=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),storm_pixels=storm,missing_pixels=missing,empty_source_mask=not storm and not missing))
                    if i%100==0: print('MY',year,'frames',i+1,flush=True)
        print('Finished MY',year,flush=True)
    packet=dict(schema='mars-dust-history/1',kind='historical_observation',version='MDAD v1.1',source='Battalio, Wang, Richardson, Toigo & Saidel; MDAD v1.1 (2022), Zenodo DOI 10.5281/zenodo.7480334',source_url='https://zenodo.org/records/7480334',license='CC BY 4.0',prepared_at=datetime.now(timezone.utc).isoformat(),grid=dict(width=3600,height=1801,west=-180,north=90,step_degrees=.1,coordinates='east longitude / planetocentric latitude; native grid nodes'),categories={'0':'No outlined dust instance in the observed source pixel','1-250':'Outlined storm; native member identifier','255':'Missing MARCI observation; unknown'},limitations='Historical MY28–32 MARCI observations. Not current weather or a forecast. No storm outline is not proof of dust-free air. Missing observations stay unknown; source cells and time gaps are not interpolated.',provenance=provenance,frames=frames)
    (output/'index.json').write_text(json.dumps(packet,separators=(',',':'))+'\n',encoding='utf8')
    print('Total frames',len(frames),'PNG bytes',sum(x.stat().st_size for x in output.glob('*.png')),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('source',type=pathlib.Path);parser.add_argument('output',type=pathlib.Path);args=parser.parse_args();prepare(args.source,args.output)

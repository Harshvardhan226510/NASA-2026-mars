"""Prepare only two tiny original COG overviews for explicit developer verification."""
import argparse,copy,hashlib,json,pathlib,urllib.parse,urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--download',action='store_true',help='Explicitly authorize retrieval of less than 1 MB from the pinned catalogue source IDs');args=parser.parse_args()
if not args.download:parser.error('Use --download to explicitly retrieve the two source overviews; no bulk imagery is collected.')
original=json.loads((root/'web/map-config.json').read_text(encoding='utf-8'))['initialCatalog']['datasets'][0]
dataset=copy.deepcopy(original);dataset['id']+='_OVERVIEW'
for kind in ['terrain','imagery']:dataset[kind]=[next(asset for asset in original[kind] if asset.get('isOverview'))]
if sum(dataset[k][0]['bytes'] for k in ['terrain','imagery'])>1000000:raise RuntimeError('Fixture source exceeds the 1 MB safety limit')
dataset['dem_grid_m']=[abs(dataset['terrain'][0]['transform'][0]),abs(dataset['terrain'][0]['transform'][4])];dataset['imagery_grid_m']=[abs(dataset['imagery'][0]['transform'][0]),abs(dataset['imagery'][0]['transform'][4])];dataset['desktopCoverage']='Original source overviews only; native HiRISE detail is not installed.'
package=root/'artifacts/authentic-overview-package';package.mkdir(parents=True,exist_ok=True);files=[];mapping={}
for kind in ['terrain','imagery']:
 asset=dataset[kind][0];name=kind+'-overview.tif';target=package/name
 body=target.read_bytes() if target.exists() else b''
 if len(body)!=asset['bytes'] or hashlib.sha256(body).hexdigest()!=asset['sha256']:
  with urllib.request.urlopen('https://drive.google.com/uc?'+urllib.parse.urlencode({'export':'download','id':asset['id']}),timeout=40) as response:
   if 'text/html' in response.headers.get('Content-Type',''):raise RuntimeError('Source requires permission or reached quota; no fixture was fabricated')
   body=response.read(asset['bytes']+1)
  if len(body)!=asset['bytes'] or hashlib.sha256(body).hexdigest()!=asset['sha256']:raise RuntimeError('Source size/checksum differs from the pinned catalogue')
  target.write_bytes(body)
 files.append({'path':name,'bytes':len(body),'sha256':asset['sha256']});mapping[asset['id']]=name
manifest={'schema':'mars-map-package/1','id':'arcadia-authentic-source-overview','version':'1.0.0','minimumAppVersion':'0.1.0','name':'Arcadia source overviews (coarse; not native HiRISE detail)','coordinates':'east-positive planetocentric degrees','elevationDatum':str(dataset['height_reference']),'bounds':dataset['bounds'],'provenance':{'source':'Pinned main upstream catalogue and original Drive source files','rights':'Development verification only; public redistribution rights audit pending','credit':'NASA/JPL/University of Arizona HiRISE; original preparation credits retained'},'files':files,'sourceFiles':mapping,'dataset':dataset}
(package/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8');print(package)

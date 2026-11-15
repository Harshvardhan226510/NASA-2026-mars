import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {tileVersion,planTiles,unpackTile} from '../src/lod.js';
const origin=new URL(process.argv[2]??'http://127.0.0.1:8770');
if(!['http:','https:'].includes(origin.protocol))throw Error('Use a map origin.');
const data=await fetch(new URL('/api/catalog',origin),{signal:AbortSignal.timeout(60000)}).then(r=>{if(!r.ok)throw Error('Catalogue unavailable');return r.json();});
await mkdir('public/prepared/tiles',{recursive:true});let manifest={schema:'mars-prepared-display/1',tiles:{}};
try{manifest=JSON.parse(await readFile('public/prepared/index.json','utf8'));}catch{}
const current={};let total=0;
for(const d of data.datasets.filter(d=>d.status==='complete')){
 const [w,s,e,n]=d.bounds,focus=[(w+e)/2,(s+n)/2],bounds=[focus[0]-(e-w)*.05,focus[1]-(n-s)*.05,focus[0]+(e-w)*.05,focus[1]+(n-s)*.05];
 const ids=['overview',...planTiles(d,bounds,1,focus,2).slice(0,2).map(t=>t.id)];
 for(const id of ids){const key=`${d.id}:${tileVersion(d)}:${id}`,old=manifest.tiles[key];if(old){current[key]=old;continue;}
  const url=new URL('/api/surface',origin);url.search=new URLSearchParams({dataset:d.id,v:tileVersion(d),tile:id});
  try{const r=await fetch(url,{signal:AbortSignal.timeout(110000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const bytes=new Uint8Array(await r.arrayBuffer()),p=unpackTile(bytes.buffer);if(!Number.isFinite(p.imageryGrid)||p.imageryGrid<=0)throw Error('Invalid display sampling');
   const encoded=gzipSync(bytes,{level:6});if(total+encoded.length>18_000_000)continue;const hash=createHash('sha256').update(encoded).digest('hex'),path='/prepared/tiles/'+hash+'.bin';await writeFile('public'+path,encoded);current[key]={path,sha256:hash,bytes:encoded.length,encoding:'gzip',decoded_bytes:bytes.length,imagery_m:p.imageryGrid,terrain_m:p.terrainGrid};total+=encoded.length;console.log(JSON.stringify({stage:'display_prepared',dataset:d.id,tile:id,bytes:encoded.length}));
  }catch(error){console.warn(JSON.stringify({stage:'display_deferred',dataset:d.id,tile:id,reason:error.message}));}
 }
}
await writeFile('public/prepared/index.json',JSON.stringify({schema:'mars-prepared-display/1',prepared_at:new Date().toISOString(),tiles:current},null,2));
console.log(JSON.stringify({stage:'display_index_ready',tiles:Object.keys(current).length,new_bytes:total}));

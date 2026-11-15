import {createHash} from 'node:crypto';
import {getCache} from '@vercel/functions';
import config from '../map-config.json' with {type:'json'};
const catalogDriveId=process.env.MARS_CATALOG_DRIVE_ID??config.catalogDriveId;
const runtimeCache=getCache({namespace:'mars-native-map-v1'});
let localCatalog=null,localCatalogExpires=0,catalogPending=null;
export function parseRange(value,size){
 const m=/^bytes=(\d+)-(\d+)$/.exec(value??'');
 if(!m)throw new Error('A single bounded byte range is required.');
 const start=Number(m[1]),end=Number(m[2]);
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size||end-start+1>2_097_152)throw new Error('Range exceeds the asset bounds or 2 MiB limit.');
 return {start,end:Math.min(end,size-1)};
}
export async function boundedDriveRead(id,{range,maxBytes=2_097_152,fetcher=fetch}={}){
 if(!/^[A-Za-z0-9_-]{15,100}$/.test(id))throw new Error('Invalid Drive asset ID.');
 const response=await fetcher(`https://drive.google.com/uc?export=download&id=${id}`,{headers:range?{Range:range}:{},signal:AbortSignal.timeout(30000)});
 const type=response.headers.get('content-type')??'';
 if(!response.ok||type.includes('text/html'))throw new Error('The Drive asset is unavailable for map streaming.');
 if(range&&response.status!==206)throw new Error('Drive did not honor the requested byte range.');
 const declared=Number(response.headers.get('content-length')??0);
 if(declared>maxBytes){await response.body?.cancel();throw new Error('Drive response exceeds the map limit.');}
 const reader=response.body.getReader(),parts=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw new Error('Drive response exceeds the map limit.');parts.push(value);}}finally{reader.releaseLock();}
 return {bytes:Buffer.concat(parts.map(x=>Buffer.from(x))),type,contentRange:response.headers.get('content-range'),status:response.status};
}
import {readFileSync} from 'node:fs';
export async function catalog(){
 if(!catalogDriveId){
  try{
   const disk=JSON.parse(readFileSync(new URL('../map-config.json',import.meta.url),'utf8'));
   if(disk?.initialCatalog?.datasets?.length)return disk.initialCatalog;
  }catch{}
  return config.initialCatalog;
 }
 if(localCatalog&&Date.now()<localCatalogExpires)return localCatalog;
 if(catalogPending)return catalogPending;
 catalogPending=(async()=>{
  const key='catalog:'+catalogDriveId;
  let data;try{data=await runtimeCache.get(key);}catch{}
  if(!data){const {bytes}=await boundedDriveRead(catalogDriveId,{maxBytes:2_097_152});data=JSON.parse(bytes);
   if(data.schema!=='mars-drive-cog-catalog/1'||data.build_owner!=='Mapping_Mars'||!Array.isArray(data.datasets))throw new Error('Invalid map catalogue.');
   try{await runtimeCache.set(key,data,{ttl:20});}catch{}
  }
  localCatalog={...data,pilots:config.initialCatalog.pilots};localCatalogExpires=Date.now()+20000;return localCatalog;
 })();
 try{return await catalogPending;}finally{catalogPending=null;}
}
export async function cachedRange(asset,range,maxBytes){
 const key='range:'+asset.id+':'+(asset.sha256??asset.md5??asset.bytes)+':'+range;
 let hit;try{hit=await runtimeCache.get(key);}catch{}
 if(hit)return {...hit,bytes:Buffer.from(hit.base64,'base64')};
 const result=await boundedDriveRead(asset.id,{range,maxBytes});
 // Base64 and metadata must fit the 2 MB Runtime Cache item limit.
 if(result.bytes.length<1400000)try{await runtimeCache.set(key,{...result,bytes:undefined,base64:result.bytes.toString('base64')},{ttl:86400});}catch{}
 return result;
}
export function assets(data){
 const found=new Map();
 for(const d of [...data.datasets,...(data.pilots??[])])for(const [kind,items] of [['terrain',d.terrain],['imagery',d.imagery]])for(const a of items??[])found.set(`${d.id}/${kind}/${a.key}`,{...a,mime:'image/tiff'});
 for(const p of data.pilots??[])for(const [kind,a] of Object.entries(p.assets))found.set(`${p.id}/${kind}`,a);
 return found;
}
export const digest=b=>createHash('sha256').update(b).digest('hex');
export default function handler(_req,res){res.status(404).end();}

import {gzipSync,gunzipSync} from 'node:zlib';
import {fromCustomClient,BaseClient,BaseResponse} from 'geotiff';
import {getCache} from '@vercel/functions';
import {catalog,assets,parseRange,cachedRange} from './drive.mjs';
import {SurfaceRaster} from '../src/raster.js';
import {RasterFileCache} from '../src/recovery.js';
import {tileBounds,tileVersion,packTile,unpackTile} from '../src/lod.js';
import {terrainConfidence} from '../src/terrain-transition.js';
import {hasRecoverableNull,restoreOrthoMask} from '../src/ortho-mask.js';
const cache=getCache({namespace:'mars-display-tiles-v1'}),jobs=new Map(),memory=new Map(),versions=new Map();
class DataResponse extends BaseResponse{
 constructor(result){super();this.result=result;}
 get status(){return 206;}
 getHeader(name){return name.toLowerCase()==='content-range'?this.result.contentRange:undefined;}
 async getData(){const b=this.result.bytes;return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
}
class DriveClient extends BaseClient{
 constructor(asset){super(asset.id);this.asset=asset;}
 async request({headers}={}){
  const range=new Headers(headers).get('range'),bounds=parseRange(range,Number(this.asset.bytes));
  const result=await cachedRange(this.asset,`bytes=${bounds.start}-${bounds.end}`,bounds.end-bounds.start+1);
  if(result.contentRange!==`bytes ${bounds.start}-${bounds.end}/${this.asset.bytes}`||result.bytes.length!==bounds.end-bounds.start+1)throw new Error('Incomplete source range.');
  return new DataResponse(result);
 }
}
const files=new RasterFileCache(async key=>{
 const asset=assets(await catalog()).get(key);if(!asset)throw new Error('Unknown source asset.');
 return fromCustomClient(new DriveClient(asset),{allowFullFile:false,blockSize:131072,cacheSize:16,maxRanges:1});
});
export async function renderTile(d,bounds){
 const raster=new SurfaceRaster(d,{fileCache:files,pool:()=>undefined});
 const [heights,imagery]=await Promise.all([raster.read(bounds,129,129,{kind:'terrain',nodes:true}),raster.read(bounds,512,512)]);
 return gzipSync(packTile(heights,imagery),{level:3});
}
export function renderElevation(d,bounds){return new SurfaceRaster(d,{fileCache:files,pool:()=>undefined}).read(bounds,129,129,{kind:'terrain',nodes:true});}
export async function renderTransitionElevation(d,bounds){
 if(!d)throw new Error('Missing terrain observation.');
 const padding=4,dx=(bounds[2]-bounds[0])/128,dy=(bounds[3]-bounds[1])/128;
 const expanded=[bounds[0]-padding*dx,bounds[1]-padding*dy,bounds[2]+padding*dx,bounds[3]+padding*dy];
 const grid=await new SurfaceRaster(d,{fileCache:files,pool:()=>undefined}).read(expanded,137,137,{kind:'terrain',nodes:true});
 return {...terrainConfidence(grid,137,padding),gridMeters:grid.gridMeters};
}
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).end();
 try{
  const data=await catalog(),d=data.datasets.find(d=>d.id===req.query.dataset&&d.status==='complete');
  if(!d)return res.status(404).json({error:'Choose a completed native footprint.'});
  const version=tileVersion(d);if(req.query.v!==version)return res.status(409).json({error:'Refresh the map catalogue.'});
  if(versions.has(d.id)&&versions.get(d.id)!==version)files.clear(d.id+'/');versions.set(d.id,version);
  const root=req.query.tile==='overview',parts=root?[]:String(req.query.tile).split(':');
  if(!root&&(parts.length!==3||parts.some(p=>!/^\d{1,5}$/.test(p))))return res.status(400).json({error:'Invalid map tile.'});
  let bounds;try{bounds=root?d.bounds:tileBounds(d,...parts.map(Number));}catch{return res.status(400).json({error:'Tile outside the prepared footprint.'});}
  const key=d.id+':'+version+':'+req.query.tile;
  let bytes=memory.get(key),hit=Boolean(bytes);
  if(!bytes){let saved;try{saved=await cache.get(key);}catch{}if(saved){bytes=Buffer.from(saved,'base64');hit=true;}}
  if(!bytes){
   if(!jobs.has(key))jobs.set(key,renderTile(d,bounds));
   const job=jobs.get(key);try{bytes=await job;}finally{if(jobs.get(key)===job)jobs.delete(key);}
   if(bytes.length<1400000)try{await cache.set(key,bytes.toString('base64'),{ttl:86400});}catch{}
  }
  // Correct older cached display packets too; no multi-GB source rebuild is
  // necessary to expose their verified CORE_NULL padding as transparent.
  if(hasRecoverableNull(d)){const raw=gunzipSync(bytes),packet=unpackTile(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));if(restoreOrthoMask(packet.pixels,d)){bytes=gzipSync(packTile(Object.assign(packet.heights,{gridMeters:packet.terrainGrid}),Object.assign(new Float32Array(packet.pixels),{gridMeters:packet.imageryGrid})),{level:3});try{await cache.set(key,bytes.toString('base64'),{ttl:86400});}catch{}}}
  memory.delete(key);memory.set(key,bytes);while(memory.size>64)memory.delete(memory.keys().next().value);
  res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Encoding','gzip');res.setHeader('Content-Length',String(bytes.length));
  res.setHeader('Cache-Control','public, max-age=86400, s-maxage=86400');res.setHeader('X-Map-Tile-Cache',hit?'hit':'miss');res.setHeader('X-Map-Storage','Google Drive');res.status(200).end(bytes);
 }catch(error){console.error('surface_tile_failed',req.query.dataset,req.query.tile,error.message);res.setHeader('Cache-Control','no-store');res.status(503).json({error:'This map tile is temporarily unavailable.'});}
}

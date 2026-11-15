import {gzipSync} from 'node:zlib';
import {getCache} from '../../services/cache.mjs';
import {catalog} from './drive.mjs';
import {renderElevation,renderTransitionElevation} from './surface.mjs';
import {geographicBounds,overlaps} from '../src/planet-grid.js';
const cache=getCache({namespace:'mars-globe-elevation-v2'}),memory=new Map(),jobs=new Map();
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).end();
 try{
  const d=(await catalog()).datasets.find(d=>d.id===req.query.dataset&&d.status==='complete');if(!d)return res.status(404).json({error:'Choose a prepared observation.'});
  const v=(d.terrain[0].sha256??d.terrain[0].md5??'').slice(0,16);if(req.query.v!==v)return res.status(409).json({error:'Refresh the map catalogue.'});
  const values=['x','y','z'].map(k=>/^\d{1,6}$/.test(String(req.query[k]))?Number(req.query[k]):NaN),[x,y,z]=values;
  if(!values.every(Number.isInteger)||z<10||z>17||x>=2**(z+1)||y>=2**z)return res.status(400).json({error:'Invalid terrain tile.'});
  const bounds=geographicBounds(x,y,z);if(!overlaps(bounds,d.bounds))return res.status(400).json({error:'Tile outside the observation.'});
  const transition=req.query.g==='2';const key=`${d.id}/${v}/${transition?'2':'1'}/${z}/${y}/${x}`;let bytes=memory.get(key),hit=Boolean(bytes);
  if(!bytes){let saved;try{saved=await cache.get(key);}catch{}if(saved){bytes=Buffer.from(saved,'base64');hit=true;}}
  if(!bytes){if(!jobs.has(key))jobs.set(key,(async()=>{const data=transition&&z===10?await renderTransitionElevation(d,bounds):{heights:await renderElevation(d,bounds)};const heights=data.heights,buffer=new Uint8Array(16+129*129*(transition?8:4)),header=new DataView(buffer.buffer);header.setUint32(0,0x4d44454d,true);header.setFloat32(4,data.gridMeters??heights.gridMeters,true);header.setUint32(8,transition?2:1,true);new Float32Array(buffer.buffer,16,129*129).set(heights);if(transition)new Float32Array(buffer.buffer,16+129*129*4,129*129).set(data.confidence??heights.map(h=>Number.isFinite(h)?1:0));return gzipSync(buffer,{level:3});})());const job=jobs.get(key);try{bytes=await job;}finally{if(jobs.get(key)===job)jobs.delete(key);}try{await cache.set(key,bytes.toString('base64'),{ttl:86400});}catch{}}
  memory.set(key,bytes);while(memory.size>96)memory.delete(memory.keys().next().value);res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Encoding','gzip');res.setHeader('Cache-Control','public, max-age=86400, s-maxage=86400');res.setHeader('X-Map-Tile-Cache',hit?'hit':'miss');res.status(200).end(bytes);
 }catch(e){console.warn('native_elevation_failed',e.message);res.setHeader('Cache-Control','no-store');res.status(503).json({error:'Native terrain is temporarily unavailable; context remains available.'});}
}

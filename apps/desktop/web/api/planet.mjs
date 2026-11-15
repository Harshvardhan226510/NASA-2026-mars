import https from 'node:https';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {getCache} from '../../services/cache.mjs';
import Lerc from 'lerc';
import {geographicBounds} from '../src/planet-grid.js';
import {REGIONAL_IMAGERY,trekTile} from '../src/regional-sources.js';
const cache=getCache({namespace:'mars-planet-tiles-v5'}),memory=new Map(),jobs=new Map();
export function tileAddress(query){
 const kind=query.kind,values=['z','y','x'].map(k=>/^\d{1,6}$/.test(String(query[k]))?Number(query[k]):NaN),[z,y,x]=values;
 const regional=Object.hasOwn(REGIONAL_IMAGERY,kind)?REGIONAL_IMAGERY[kind]:null;
 if((!regional&&!['imagery','terrain','baseline','thermal'].includes(kind))||!values.every(Number.isInteger)||z>(regional?.max??(kind==='imagery'?12:kind==='thermal'?9:7))||x>=2**(z+1)||y>=2**z)throw new Error('Invalid planet tile.');
 if(regional){
  const [w,s,e,n]=geographicBounds(x,y,z),[rw,rs,re,rn]=regional.bounds;
  if(z<regional.min||e<=rw||w>=re||n<=rs||s>=rn)throw new Error('Invalid regional tile.');
  return {kind,z,y,x,url:trekTile(regional.product,z,y,x),key:`${kind}/${z}/${y}/${x}`,regional:true};
 }
 const url=kind==='thermal'?`https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/${z}/${y}/${x}.png`:kind==='baseline'?`https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/${z}/${y}/${x}.jpg`:`https://astro.arcgis.com/arcgis/rest/services/OnMars/${kind==='imagery'?'CTX1/MapServer':'MDEM200M/ImageServer'}/tile/${z}/${y}/${x}`;
 return {kind,z,y,x,url,key:`${kind}/${z}/${y}/${x}`};
}
export function normalizeTile(bytes,kind){
 // A few service tiles declare gzip while their bytes are already decoded.
 // Raw HTTPS preserves the bytes; decompress only a real gzip signature.
 if(bytes[0]===0x1f&&bytes[1]===0x8b)bytes=gunzipSync(bytes,{maxOutputLength:2097152});
 if(kind==='terrain'){const magic=bytes.subarray(0,10).toString();if(!magic.startsWith('CntZImage')&&!magic.startsWith('Lerc2'))throw new Error('The upstream elevation tile is incomplete.');const data=Lerc.decode(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));if(data.width!==513||data.height!==513||data.pixels[0].length!==513*513)throw new Error('Incomplete elevation grid.');return {bytes,type:'application/octet-stream'};}
 // The service returns this exact opaque JPEG for empty cached CTX tiles,
 // including 11/0/0 outside CTX's ±88° coverage and the Lyot 11/453/2350 gap.
 // Identify the whole encoded placeholder, never a darkness threshold: ordinary
 // dark pixels and every other source photograph remain untouched.
 if(kind==='imagery'&&bytes.length===1199&&createHash('sha256').update(bytes).digest('hex')==='b59ed58ff006f0948a5a40d41cf0ef3d4890d6522ecc2412d4d25f8759ecec16'){
  const error=new Error('The publisher has no CTX tile at this address.');error.sourceMissing=true;throw error;
 }
 const png=bytes[0]===0x89&&bytes.subarray(1,4).toString()==='PNG',jpeg=bytes[0]===0xff&&bytes[1]===0xd8;if(!png&&!jpeg||png&&(bytes.length<45||bytes.subarray(-8,-4).toString()!=='IEND')||jpeg&&(bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9))throw new Error('The upstream photograph is incomplete.');return {bytes,type:png?'image/png':'image/jpeg'};
}
function readRaw(url,kind){return new Promise((resolve,reject)=>{
 const request=https.get(url,{headers:{'Accept-Encoding':'identity'}},response=>{
  if(response.statusCode!==200){response.resume();const error=new Error('Planet source temporarily unavailable.');if(Object.hasOwn(REGIONAL_IMAGERY,kind)&&[404,410].includes(response.statusCode))error.sourceMissing=true;reject(error);return;}
  const parts=[];let size=0;response.on('data',bytes=>{size+=bytes.length;if(size>2097152){request.destroy(new Error('Planet tile exceeds its size limit.'));return;}parts.push(bytes);});response.on('end',()=>resolve(Buffer.concat(parts)));response.on('error',error=>{if(kind==='terrain'&&error.message==='aborted'){try{const tile=normalizeTile(Buffer.concat(parts),kind);console.info('planet_frame_recovered',tile.bytes.length);resolve(tile.bytes);return;}catch(e){console.warn('planet_incomplete_grid',e.message);}}reject(error);});
 });request.setTimeout(kind==='terrain'?8500:20000,()=>request.destroy(new Error('Planet tile timed out.')));request.on('error',reject);
});}
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).end();let address;try{address=tileAddress(req.query);}catch{return res.status(400).json({error:'Invalid planet tile.'});}
 try{
  const {kind,key,url}=address,ttl=address.regional?2592000:86400;
  let tile=memory.get(key);
  if(!tile){
   if(!jobs.has(key))jobs.set(key,(async()=>{
    let saved;try{saved=await cache.get(key);}catch{}
    if(saved)return {bytes:Buffer.from(saved.bytes,'base64'),type:saved.type};
    const fresh=normalizeTile(await readRaw(url,kind),kind);
    if(fresh.bytes.length<1400000)try{await cache.set(key,{bytes:fresh.bytes.toString('base64'),type:fresh.type},{ttl});}catch{}
    return fresh;
   })());
   const job=jobs.get(key);try{tile=await job;}finally{if(jobs.get(key)===job)jobs.delete(key);}
  }
  memory.delete(key);memory.set(key,tile);while(memory.size>96)memory.delete(memory.keys().next().value);res.setHeader('Content-Type',tile.type);res.setHeader('Cache-Control',`public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=604800`);res.status(200).end(tile.bytes);
 }catch(e){if(!e.sourceMissing)console.error('planet_tile_failed',address.key,e.message);res.setHeader('Cache-Control',e.sourceMissing&&address.regional?'public, max-age=300':'no-store');res.status(e.sourceMissing?404:503).json({error:e.sourceMissing?'No image at this source address.':'The planet tile is temporarily unavailable.'});}
}

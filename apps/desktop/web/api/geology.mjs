import {getCache} from '../../services/cache.mjs';
import {geologySourceAddress} from '../src/geology-grid.js';
const cache=getCache({namespace:'mars-usgs-sim3292-tiles-v1'});
export function validateGeologyPNG(bytes){
 if(bytes.length<45||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)!==256||bytes.readUInt32BE(20)!==256||bytes.subarray(-8,-4).toString()!=='IEND')throw Error('Incomplete geologic map image.');return bytes;
}
export function createGeologyService({store=cache,read=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Geologic map source unavailable.');return Buffer.from(await r.arrayBuffer());}}={}){
 const memory=new Map(),pending=new Map();
 return async address=>{
  if(memory.has(address.key))return memory.get(address.key);
  if(pending.has(address.key))return pending.get(address.key);
  const task=(async()=>{let bytes;try{const saved=await store?.get(address.key);if(saved)bytes=validateGeologyPNG(Buffer.from(saved,'base64'));}catch{}
   if(!bytes){bytes=validateGeologyPNG(await read(address.url));try{await store?.set(address.key,bytes.toString('base64'),{ttl:86400});}catch{}}
   memory.set(address.key,bytes);while(memory.size>64)memory.delete(memory.keys().next().value);return bytes;
  })();pending.set(address.key,task);try{return await task;}finally{pending.delete(address.key);}
 };
}
const load=createGeologyService();
export default async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 let address;try{address=geologySourceAddress(req.query??{});}catch{return res.status(400).json({error:'Use a valid geologic tile address.'});}
 try{const bytes=await load(address);res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','public, max-age=86400, s-maxage=86400');return res.status(200).end(bytes);}catch{res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Geologic map temporarily unavailable. Existing imagery is unchanged.'});}
}

import {getCache} from '@vercel/functions';
import {collectWind} from '../science/wind.mjs';
import {environmentTime} from '../src/environment-data.js';
import {windHour} from '../src/wind-data.js';
import bootstrap from '../data/wind/bootstrap.json' with {type:'json'};
const cache=getCache({namespace:'mars-wind-emars-v1'});
export function createWindService({store=cache,read=collectWind,seed=bootstrap,clock=()=>Date.now()}={}){
 let local,pending;
 return async()=>{
  const now=clock(),hour=windHour(now);let entry=local;if(!entry)try{entry=await store.get('current');}catch{}
  if(entry&&(entry.retry_after>now||entry.packet.model_time===hour&&entry.packet.health.state==='ok'))return entry.packet;
  if(pending)return pending;
  pending=(async()=>{
   let packet,retry_after=0;
   try{packet=await read({now});}catch{const prior=entry?.packet?.east?entry.packet:seed;retry_after=now+900000;packet=prior?{...prior,health:{state:'cached_fallback',last_attempt_at:new Date(now).toISOString()}}:{schema:'mars-wind/1',health:{state:'unavailable',last_attempt_at:new Date(now).toISOString()}};}
   local={packet,retry_after};try{await store.set('current',local,{ttl:86400});}catch{}return packet;
  })();try{return await pending;}finally{pending=null;}
 };
}
export function createDatedWindService({store=cache,read=collectWind}={}){
 const local=new Map(),pending=new Map();
 return async at=>{const time=environmentTime(at),key='hour:'+time;if(local.has(key))return local.get(key);let saved;try{saved=await store.get(key);}catch{}if(saved?.model_time===time&&saved?.health?.state==='ok'){local.set(key,saved);return saved;}if(pending.has(key))return pending.get(key);if(pending.size>=8)throw Error('Too many climate hours are loading. Try again shortly.');
  const task=(async()=>{const packet=await read({now:Date.parse(time)});if(packet?.schema!=='mars-wind/1'||packet.kind!=='modeled_climatology'||packet.model_time!==time)throw Error('NASA did not confirm the requested climate hour.');local.set(key,packet);while(local.size>48)local.delete(local.keys().next().value);try{await store.set(key,packet,{ttl:86400});}catch{}return packet;})();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
 };
}
const serve=createWindService(),serveDated=createDatedWindService();
export default async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 const query=req.query??{};if(Object.keys(query).some(k=>k!=='at')||query.at!==undefined&&(typeof query.at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(query.at)))return res.status(400).json({error:'Use one UTC at time between 2000 and 2030.'});
 let at;try{if(query.at!==undefined){if(new Date(query.at).toISOString().slice(0,19)!==query.at.slice(0,19))throw Error('Invalid time');at=environmentTime(query.at);}}catch{return res.status(400).json({error:'Choose a valid UTC climate hour between 2000 and 2030.'});}
 try{const data=at&&at!==windHour()?await serveDated(at):await serve(),ttl=Math.max(1,Math.min(300,Math.ceil((Date.parse(windHour(Date.now()))+3600000-Date.now())/1000)));res.setHeader('Cache-Control',`public, max-age=60, s-maxage=${ttl}`);return res.status(data.health.state==='unavailable'?503:200).json(data);}catch(error){return res.status(503).json({schema:'mars-wind/1',kind:'modeled_climatology',model_time:at,health:{state:'unavailable'},error:error.message});}
}

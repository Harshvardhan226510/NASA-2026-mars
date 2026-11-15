import {getCache} from '../../services/cache.mjs';
import {collectEnvironment} from '../science/environment.mjs';
import {environmentTime,ENVIRONMENT_PARAMETERS} from '../src/environment-data.js';
const cache=getCache({namespace:'mars-environment-emars-v1'});
export function createEnvironmentService({store=cache,read=collectEnvironment,clock=()=>Date.now()}={}){
 const memory=new Map(),pending=new Map();
 return async(param,at)=>{
  if(!Object.hasOwn(ENVIRONMENT_PARAMETERS,param))throw Error('Unsupported parameter');const time=environmentTime(at??clock()),key=param+':'+time,now=clock();let entry=memory.get(key);if(!entry)try{entry=await store.get(key);}catch{}
  if(entry&&now-entry.checked<3600000)return entry.packet;if(pending.has(key))return pending.get(key);
  const task=(async()=>{let packet;try{packet=await read(param,{at:time});}catch{packet=entry?.packet?.values?{...entry.packet,health:{state:'cached_fallback',last_attempt_at:new Date(now).toISOString()}}:{schema:'mars-environment/1',parameter:param,model_time:time,health:{state:'unavailable',last_attempt_at:new Date(now).toISOString()}};}
   const next={packet,checked:packet.health.state==='ok'?now:now-3300000};memory.set(key,next);if(memory.size>40)memory.delete(memory.keys().next().value);try{await store.set(key,next,{ttl:86400});}catch{}return packet;})();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
 };
}
const serve=createEnvironmentService();
export default async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 const q=req.query??{};let at;try{if(Object.keys(q).some(k=>!['parameter','at'].includes(k))||typeof q.parameter!=='string'||!Object.hasOwn(ENVIRONMENT_PARAMETERS,q.parameter)||q.at!==undefined&&(typeof q.at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{3})?)?Z$/.test(q.at)))throw Error();at=environmentTime(q.at??Date.now());}catch{return res.status(400).json({error:'Choose a registered parameter and a valid UTC model time (2000–2030).'});}
 const packet=await serve(q.parameter,at);res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');return res.status(packet.health.state==='unavailable'?503:200).json(packet);
}

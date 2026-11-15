import {getCache} from '../../services/cache.mjs';
import {createHash} from 'node:crypto';
import {SPACECRAFT_FEEDS,normalizeSpacecraftPosition} from '../src/spacecraft-data.js';
import bootstrap from '../data/spacecraft/bootstrap.json' with {type:'json'};
import {createOrbiterService} from '../science/orbiters.mjs';
const cache=getCache({namespace:'mars-spacecraft-localizations-v1'});
const orbitalService=createOrbiterService({store:getCache({namespace:'mars-orbital-ephemerides-v1'})});
export async function readPosition(id,{fetcher=fetch,now=Date.now()}={}){
 const r=await fetcher(SPACECRAFT_FEEDS[id],{signal:AbortSignal.timeout(18000),headers:{Accept:'application/geo+json, application/json'}});
 if(!r.ok)throw new Error('NASA position unavailable');
 if(Number(r.headers.get('content-length'))>65536)throw new Error('Position response too large');
 const reader=r.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw new Error('Position response too large');chunks.push(value);}}finally{await reader.cancel();}
 const raw=Buffer.concat(chunks);
 return normalizeSpacecraftPosition(id,JSON.parse(raw.toString('utf8')),{retrievedAt:new Date(now).toISOString(),lastModified:r.headers.get('last-modified'),sha256:createHash('sha256').update(raw).digest('hex')});
}
export function createSpacecraftService({store=cache,read=readPosition,seed=bootstrap,clock=()=>Date.now()}={}){
 let local,pending;
 return async()=>{
  const now=clock();let entry=local;if(!entry)try{entry=await store.get('positions');}catch{}
  if(entry?.retry_after>now)return entry.packet;if(pending)return pending;
  pending=(async()=>{
   const positions={},prior=entry?.packet?.positions??seed.positions;
   await Promise.all(Object.keys(SPACECRAFT_FEEDS).map(async id=>{try{const next=await read(id,{now});if(next.sol<prior[id]?.sol)throw new Error('Older localization');positions[id]={...next,update_state:'verified'};}catch{positions[id]={...prior[id],update_state:'cached_fallback',last_attempt_at:new Date(now).toISOString()};}}));
   const failed=Object.values(positions).some(p=>p.update_state!=='verified'),packet={schema:'mars-spacecraft-positions/1',retrieved_at:new Date(now).toISOString(),positions,health:{state:failed?'cached_fallback':'ok'}};
   local={packet,retry_after:now+(failed?900000:21600000)};try{await store.set('positions',local,{ttl:604800});}catch{}return packet;
  })();try{return await pending;}finally{pending=null;}
 };
}
const serve=createSpacecraftService();
export default async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 if(req.query?.service==='orbits'){
  res.setHeader('Cache-Control','no-store');
  if(Object.keys(req.query).some(k=>!['service','at'].includes(k))||req.query.at!==undefined&&(typeof req.query.at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(req.query.at)))return res.status(400).json({error:'Use one UTC at time ending in Z.'});
  try{const packet=await orbitalService(req.query.at);res.setHeader('Cache-Control','public, max-age=60, s-maxage=900');return res.status(200).json(packet);}catch{return res.status(400).json({error:'Choose a UTC time from 2025 through 2035.'});}
 }
 if(Object.keys(req.query??{}).length)return res.status(400).json({error:'This endpoint supplies the three verified NASA surface localizations.'});
 res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');return res.status(200).json(await serve());
}

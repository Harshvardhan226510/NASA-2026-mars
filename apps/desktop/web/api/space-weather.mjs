import {getCache} from '../../services/cache.mjs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {collectFeed} from '../science/space-weather.mjs';
import {FEEDS} from '../src/space-weather-contracts.js';
import bootstrap from '../data/space-weather/bootstrap.json' with {type:'json'};
const cache=getCache({namespace:'mars-space-weather-v1'});
const historyWindow=(packet,days,now)=>['rad','mex'].includes(packet.feed)?{...packet,display_days:days,samples:(packet.samples??[]).filter(s=>Date.parse(s.time)>=now-days*86400000)}:packet;
export function createFeedService({read=collectFeed,store=cache,seeds=bootstrap.feeds,clock=()=>Date.now()}={}){
 const local=new Map(),inflight=new Map();
 return async(feed,days=7)=>{
  if(!Object.hasOwn(FEEDS,feed)||![3,7,30].includes(days))throw Error('Unsupported feed/window');
  const key=feed+':'+(feed==='rad'||feed==='mex'?days:7),now=clock();let entry=local.get(key);
  if(!entry)try{const saved=await store.get(key);if(saved)entry={checked_at:saved.checked_at,packet:JSON.parse(gunzipSync(Buffer.from(saved.gzip,'base64'),{maxOutputLength:8_000_000}).toString())};}catch{}
  if(entry&&now-entry.checked_at<FEEDS[feed].ttl*1000){local.set(key,entry);return historyWindow(entry.packet,days,now);}
  if(inflight.has(key))return inflight.get(key);
  const task=(async()=>{
   let packet;
   try{({packet}=await read(feed,{days,now:new Date(now)}));}
   catch{
    const good=entry?.packet?.health?.state!=='unavailable'&&entry?.packet?entry.packet:seeds[feed];
    packet=good?{...good,health:{state:'cached_fallback',last_attempt_at:new Date(now).toISOString(),error:'Source refresh failed. Showing last good data with its original timestamps.',fallback_source:entry?'runtime cache':'release snapshot'}}:{schema:'mars-space-weather/1',feed,...FEEDS[feed],health:{state:'unavailable',last_attempt_at:new Date(now).toISOString(),error:'Source unavailable or its scientific contract changed.'},samples:[],channels:[],usable_for_human_route_dose:false};
   }
   const next={packet,checked_at:now};local.set(key,next);
   // Runtime Cache is an accelerator. The versioned release snapshot is durable.
   const gzip=gzipSync(JSON.stringify(packet)).toString('base64');if(gzip.length<1_950_000)try{await store.set(key,{checked_at:now,gzip},{ttl:604800});}catch{}
   return historyWindow(packet,days,now);
  })();inflight.set(key,task);try{return await task;}finally{inflight.delete(key);}
 };
}
const serve=createFeedService();
export default async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 const query=req.query??Object.fromEntries(new URL(req.url,'https://mars-field-atlas.vercel.app').searchParams),feed=query.feed,days=Number(query.days??7);
 if(typeof feed!=='string'||!Object.hasOwn(FEEDS,feed)||![3,7,30].includes(days))return res.status(400).json({error:'Choose a registered feed and a 3, 7 or 30 day history.'});
 try{
  const data=await serve(feed,days),good=data.health?.state!=='unavailable';res.setHeader('Cache-Control',good?'public, max-age=60, s-maxage=120':'public, max-age=30, s-maxage=30');res.setHeader('Content-Type','application/json');res.status(good?200:503).json(data);
 }catch{res.setHeader('Cache-Control','no-store');res.status(503).json({error:'Scientific feed temporarily unavailable.'});}
}

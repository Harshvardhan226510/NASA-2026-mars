import {createHash} from 'node:crypto';
import {ORBITERS,orbitWindow,validateOrbiters} from '../src/orbiter-data.js';

// Bounds for fetching actual paths, not assumed orbital elements. The viewer
// clips by angular travel in the returned vectors rather than drawing ellipses.
const tracePaddingHours={mro:2,odyssey:2,mars_express:5,tgo:2,hope:33,maven:3};
export function horizonsUrl(id,start,{trace=false}={}){
 if(!ORBITERS[id])throw Error('Unknown orbital target.');
 const quote=x=>`'${x}'`,settings={COMMAND:ORBITERS[id].target,OBJ_DATA:'YES',MAKE_EPHEM:'YES',EPHEM_TYPE:'VECTORS',CENTER:'500@499',REF_PLANE:'FRAME',REF_SYSTEM:'ICRF',OUT_UNITS:'KM-S',VEC_TABLE:'2',VEC_CORR:'NONE',TIME_TYPE:'UT',CSV_FORMAT:'YES',START_TIME:new Date(start).toISOString().slice(0,19).replace('T',' '),STOP_TIME:new Date(start+21600000).toISOString().slice(0,19).replace('T',' '),STEP_SIZE:'1 m'};
 if(trace){const pad=tracePaddingHours[id]*3600000;settings.START_TIME=new Date(start-pad).toISOString().slice(0,19).replace('T',' ');settings.STOP_TIME=new Date(Math.min(start+21600000+pad,Date.parse(ORBITERS[id].reliableUntil??'2037-01-01'))).toISOString().slice(0,19).replace('T',' ');}
 return 'https://ssd.jpl.nasa.gov/api/horizons.api?'+new URLSearchParams({format:'json',...Object.fromEntries(Object.entries(settings).map(([k,v])=>[k,quote(v)]))});
}
export function parseHorizons(id,raw,start,retrieved,{trace=false}={}){
 const json=JSON.parse(raw),text=json.result??'',target=ORBITERS[id].target;
 if(json.error||!text.includes(`(${target})`)||!/^Center body name:\s+Mars \(499\)/m.test(text)||!/^Center-site name:\s+BODY CENTER/m.test(text)||!/^Reference frame\s*:\s*ICRF/m.test(text)||!/^Output units\s*:\s*KM-S/m.test(text)||!/^Output type\s*:\s*GEOMETRIC cartesian states/m.test(text)||!text.includes('Calendar Date (UT )'))throw Error('JPL has no verified trajectory for this time.');
 const block=text.split('$$SOE')[1]?.split('$$EOE')[0];if(!block)throw Error('JPL has no trajectory samples for this time.');
 const samples=block.trim().split(/\r?\n/).map(line=>{const cols=line.split(',').map(v=>v.trim()),time=(Number(cols[0])-2440587.5)*86400000,values=cols.slice(2,8).map(Number);if(cols.length<8||!Number.isFinite(time)||values.length!==6||!values.every(Number.isFinite))throw Error('Invalid JPL vector.');return [Math.round(time),...values.map(v=>v*1000)];});
 const header=text.split('$$SOE')[0],core=samples.filter(s=>s[0]>=start&&s[0]<=start+21600000);
 if(core.length!==361)throw Error('JPL has no complete position window for this time.');
 return {status:'available',target,source_url:horizonsUrl(id,start,{trace}),retrieved_at:new Date(retrieved).toISOString(),raw_sha256:createHash('sha256').update(raw).digest('hex'),solution:header.match(/\{source: ([^}]+)\}/)?.[1]??'Horizons spacecraft solution',kind:'computed_ephemeris',prediction_note:'Dated JPL trajectory solution; may include planning predictions. Not live tracking or flight navigation.',source_notes:header.split('Ephemeris /')[0].trim().slice(0,16000),samples:core,...(trace?{trajectory:samples}:{})};
}
export function createOrbiterService({store,fetcher=fetch,clock=()=>Date.now()}={}){
 const local=new Map(),pending=new Map();let queue=Promise.resolve();
 async function read(id,start,trace){
  const r=await fetcher(horizonsUrl(id,start,{trace}),{signal:AbortSignal.timeout(trace?14000:6000),headers:{Accept:'application/json'}});
  if(!r.ok)throw Error('JPL trajectory service unavailable.');
  if(Number(r.headers.get('content-length'))>1200000)throw Error('JPL response exceeds its bound.');
  const reader=r.body.getReader(),parts=[];let bytes=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1200000)throw Error('JPL response exceeds its bound.');parts.push(value);}}finally{await reader.cancel();}
  return parseHorizons(id,Buffer.concat(parts).toString('utf8'),start,clock(),{trace});
 }
 return async at=>{
  const key=orbitWindow(at===undefined?clock():Date.parse(at)),start=Date.parse(key),cacheKey='paths-v2-'+key;
  let entry=local.get(key);if(!entry)try{entry=await store?.get(cacheKey);}catch{}
  if(entry?.expires>clock())try{return validateOrbiters(entry.packet);}catch{}
  if(pending.has(key))return pending.get(key);
  // Horizons asks clients to issue one request at a time. Serialize all windows
  // in this service instance as well as deduplicating concurrent viewer requests.
  const run=queue.catch(()=>{}).then(async()=>{
   const bodies={};for(const [id,info] of Object.entries(ORBITERS)){
    if(info.reliableUntil&&start+21600000>Date.parse(info.reliableUntil)){bodies[id]={target:info.target,status:'unavailable',reason:'No reliable MAVEN trajectory after 4 December 2025.'};continue;}
    try{
     try{bodies[id]=await read(id,start,true);}catch{
      // Near a provider coverage edge, a longer path may be unavailable even
      // when the current position window exists. Retain that valid open arc.
      bodies[id]=await read(id,start,false);
     }
    }catch(error){bodies[id]={target:info.target,status:'unavailable',reason:error.message};}
   }
   const packet=validateOrbiters({schema:'mars-orbiters/1',center:'Mars center (499)',frame:'ICRF',time_scale:'UTC',units:'metres and metres/second',start_utc:key,end_utc:new Date(start+21600000).toISOString(),bodies});
   const partial=Object.entries(bodies).some(([id,b])=>b.status!=='available'&&id!=='maven'),ttl=partial?900:21600;
   const next={packet,expires:clock()+ttl*1000};local.set(key,next);if(local.size>8)local.delete(local.keys().next().value);try{await store?.set(cacheKey,next,{ttl});}catch{}return packet;
  });
  queue=run;pending.set(key,run);try{return await run;}finally{pending.delete(key);}
 };
}

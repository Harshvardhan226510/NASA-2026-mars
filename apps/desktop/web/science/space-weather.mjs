import {createHash} from 'node:crypto';
import {CONTEXT_URLS,normalizeContext} from '../src/space-weather-context.js';
import {FEEDS,normalizeHapi,normalizeIpath,normalizeSpectrum,normalizeDonki,normalizeGoes,time} from '../src/space-weather-contracts.js';
const HAPI='https://iswa.ccmc.gsfc.nasa.gov/hapi/';
export function allowedSource(value){
 const u=new URL(value);if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash)throw Error('Unapproved scientific source URL');
 const allowed=u.hostname==='iswa.ccmc.gsfc.nasa.gov'&&['/hapi/','/api/','/iswa_data_tree/'].some(p=>u.pathname.startsWith(p))||u.hostname==='ccmc.gsfc.nasa.gov'&&u.pathname.startsWith('/DONKI-API/get/')||u.hostname==='services.swpc.noaa.gov'&&(u.pathname.startsWith('/json/goes/primary/')||Object.values(CONTEXT_URLS).includes(u.href));
 if(!allowed)throw Error('Unapproved scientific source URL');return u.href;
}
export async function sourceRead(url,{fetcher=fetch,attempts=2}={}){
 allowedSource(url);let error;
 for(let attempt=0;attempt<attempts;attempt++)try{
  let response=await fetcher(url,{headers:{Accept:'application/json, text/csv;q=0.9','User-Agent':'MarsFieldAtlas/1.0 (scientific indicators)'},redirect:'manual',signal:AbortSignal.timeout(8000)});
  if([301,302,303,307,308].includes(response.status)){const next=allowedSource(new URL(response.headers.get('location'),url).href);await response.body?.cancel();response=await fetcher(next,{redirect:'error',signal:AbortSignal.timeout(8000)});}
  if(!response.ok){const error=Error('Scientific source HTTP '+response.status);error.noRetry=response.status===429||response.status<500;throw error;}
  const limit=8_000_000,declared=Number(response.headers.get('content-length')??0);if(declared>limit){await response.body?.cancel();throw Error('Scientific payload too large');}
  const reader=response.body.getReader(),parts=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('Scientific payload too large');}parts.push(value);}}finally{reader.releaseLock();}
  const raw=Buffer.concat(parts),retrieved=new Date().toISOString();
  return {text:raw.toString('utf8'),raw,metadata:{url,final_url:response.url||url,retrieved_at:retrieved,sha256:createHash('sha256').update(raw).digest('hex'),bytes:size,etag:response.headers.get('etag'),last_modified:response.headers.get('last-modified'),published_at:null}};
 }catch(e){error=e;if(e.noRetry)break;if(attempt+1<attempts)await new Promise(r=>setTimeout(r,400+Math.random()*400));}
 throw error;
}
export async function collectFeed(feed,{days=7,now=new Date(),fetcher=fetch,onRaw=async()=>{}}={}){
 if(!Object.hasOwn(FEEDS,feed)||![3,7,30].includes(days))throw Error('Unsupported feed/window');
 const deadline=Date.now()+45000,raw=[],warnings=[],read=async url=>{if(Date.now()>deadline)throw Error('Source refresh deadline');const r=await sourceRead(url,{fetcher});raw.push(r);await onRaw(r);return r;},json=async url=>JSON.parse((await read(url)).text);
 let packet;
 if(Object.hasOwn(CONTEXT_URLS,feed)){
  const payload=await json(CONTEXT_URLS[feed]);packet=normalizeContext(payload,feed,raw.at(-1).metadata.retrieved_at);
 }else if(['rad','mex'].includes(feed)){
  const dataset=feed==='rad'?'msl_rad_dosimetry':'mars_express_aspera3_ima_ep',query=new URLSearchParams({id:dataset,'time.min':new Date(+now-days*86400000).toISOString().replace('.000Z','Z'),'time.max':now.toISOString().replace(/\.\d{3}Z$/,'Z'),format:'json'});
  packet=normalizeHapi(await json(HAPI+'data?'+query),feed,raw.at(-1).metadata.retrieved_at);
 }else if(feed==='ipath'){
  const discovery=await json('https://iswa.ccmc.gsfc.nasa.gov/api/recent?dataID=2806&n=5');if(!Array.isArray(discovery.files))throw Error('Forecast discovery schema changed');
  const runs=[];
  for(const file of discovery.files.slice(0,5))try{const url=allowedSource(file.url);if(!url.includes('/mars_sep_scoreboard/')||!url.includes('.Mars.'))throw Error('Wrong forecast target path');const r=await read(url),run=normalizeIpath(JSON.parse(r.text),r.metadata.retrieved_at);runs.push({...run,source_url:url,raw_sha256:r.metadata.sha256});}catch{warnings.push('One discovered run was unavailable or failed its Mars/proton contract.');}
  if(!runs.length)throw Error('No validated Mars forecasts available');runs.sort((a,b)=>b.issue_time.localeCompare(a.issue_time));
  let spectrum=null;
  try{const files=await json('https://iswa.ccmc.gsfc.nasa.gov/api/recent?dataID=2574&n=2'),run=runs[0],compact=time(run.issue_time).slice(0,19).replace(/[-:]/g,'').replace('T','_');
   const file=files.files?.find(f=>f.url.includes('/Mars/differential-flux/')&&f.url.includes(compact));
   if(file){const r=await read(allowedSource(file.url));spectrum={...normalizeSpectrum(r.text,run),source_url:file.url,raw_sha256:r.metadata.sha256};}else warnings.push('No matching spectrum for the newest issue; no older run was substituted.');
  }catch{warnings.push('The matching differential spectrum is unavailable; integral forecasts remain separate.');}
  packet={schema:'mars-space-weather/1',feed,...FEEDS[feed],dataset:'iPATH Mars submissions 2806 / spectra 2574',runs,spectrum,channels:[],samples:[],retrieved_at:raw[0].metadata.retrieved_at,latest_issue_time:runs[0].issue_time,published_at:null,usable_for_human_route_dose:false,spatial_support:'Forecast at the Mars heliospheric observer, not a surface radiation grid.'};
 }else if(feed==='donki'){
  const query=new URLSearchParams({startDate:new Date(+now-30*86400000).toISOString().slice(0,10),endDate:now.toISOString().slice(0,10)});
  packet=normalizeDonki(await json('https://ccmc.gsfc.nasa.gov/DONKI-API/get/WSAEnlilSimulations?'+query),raw.at(-1).metadata.retrieved_at);
 }else{
  const name=feed==='goes-protons'?'integral-protons':'xrays';packet=normalizeGoes(await json(`https://services.swpc.noaa.gov/json/goes/primary/${name}-7-day.json`),feed,raw.at(-1).metadata.retrieved_at);
 }
 packet.requested_days=['rad','mex'].includes(feed)?days:feed.startsWith('goes')?7:null;packet.provenance=raw.map(r=>r.metadata);packet.warnings=warnings;packet.health={state:'ok',last_attempt_at:new Date().toISOString(),error:null};
 if(Buffer.byteLength(JSON.stringify(packet))>4_200_000)throw Error('Normalized product exceeds the serving limit');
 return {packet,raw};
}

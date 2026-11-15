import {createHash} from 'node:crypto';
import {WIND_SOURCE,WIND_GRID,windHour,windForm,windMetadata,normalizeWind} from '../src/wind-data.js';
export async function collectWind({now=Date.now(),fetcher=fetch,onRaw=async()=>{}}={}){
 const modelTime=windHour(now),form=windForm(modelTime).toString(),provenance=[];
 const read=async url=>{
  const response=await fetcher(url,{method:'POST',body:form,headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'MarsFieldAtlas/1.0 (EMARS climatology display)'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('NASA wind source HTTP '+response.status);
  if(Number(response.headers.get('content-length')??0)>400000){await response.body?.cancel();throw Error('Wind source response too large');}
  const reader=response.body.getReader(),parts=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>400000){await reader.cancel();throw Error('Wind source response too large');}parts.push(value);}}finally{reader.releaseLock();}
  const raw=Buffer.concat(parts),metadata={url,method:'POST',requested_model_time:modelTime,retrieved_at:new Date().toISOString(),sha256:createHash('sha256').update(raw).digest('hex'),bytes:size,published_at:null};provenance.push(metadata);await onRaw({raw,metadata});return raw.toString('utf8');
 };
 const metadata=windMetadata(await read(WIND_SOURCE),modelTime),raw=JSON.parse(await read(WIND_GRID));
 return {...normalizeWind(raw,metadata,provenance),retrieved_at:provenance.at(-1).retrieved_at,health:{state:'ok',last_attempt_at:new Date().toISOString()}};
}

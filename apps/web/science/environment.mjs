import {createHash} from 'node:crypto';
import {WIND_SOURCE,windForm} from '../src/wind-data.js';
import {ENVIRONMENT_PARAMETERS,environmentTime,environmentMetadata,normalizeEnvironment} from '../src/environment-data.js';
export async function collectEnvironment(param,{at=Date.now(),fetcher=fetch,onRaw=async()=>{}}={}){
 if(!Object.hasOwn(ENVIRONMENT_PARAMETERS,param))throw Error('Unsupported environmental parameter');
 const time=environmentTime(at),form=windForm(time);form.set('units','Scientific');const provenance=[];
 async function read(url){
  const response=await fetcher(url,{method:'POST',body:form,redirect:'error',signal:AbortSignal.timeout(18000)});if(!response.ok)throw Error('NASA climate source HTTP '+response.status);
  const reader=response.body.getReader(),chunks=[];let bytes=0;try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>400000){await reader.cancel();throw Error('NASA climate payload exceeds limit');}chunks.push(value);}}finally{reader.releaseLock();}
  const raw=Buffer.concat(chunks),metadata={url,method:'POST',form:Object.fromEntries(form),retrieved_at:new Date().toISOString(),published_at:null,sha256:createHash('sha256').update(raw).digest('hex'),bytes};provenance.push(metadata);await onRaw({raw,metadata});return raw.toString('utf8');
 }
 const metadata=environmentMetadata(await read(WIND_SOURCE),time),packet=normalizeEnvironment(JSON.parse(await read(WIND_SOURCE+'index.php?param='+param)),param,metadata,provenance);
 return {...packet,retrieved_at:provenance.at(-1).retrieved_at,health:{state:'ok',last_attempt_at:new Date().toISOString()}};
}

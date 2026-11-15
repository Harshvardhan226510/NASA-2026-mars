import {sampleWind,windHour} from './wind-data.js';
import {sampleEnvironment} from './environment-data.js';
import {marsSun,solarAt} from './solar-geometry.js';
export function requireNASAClimate(packet,schema,at){
 if(packet?.schema!==schema||packet.kind!=='modeled_climatology'||packet.health?.state==='unavailable'||packet.model_time!==at||!packet.provenance?.length||packet.provenance.some(p=>{try{return !new URL(p.url).hostname.endsWith('.nasa.gov');}catch{return true;}}))throw Error('Verified NASA climate packet is unavailable for this hour.');return packet;
}
export async function dustInputs(point,{at=Date.now(),fetcher=fetch,elevation,signal}={}){
 if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90)throw Error('Point the map centre at Mars or enter valid coordinates.');
 const [lon,lat]=point,hour=windHour(at),sun=marsSun(at),solar=solarAt(sun,lon,lat);
 const read=async(url,schema)=>{const r=await fetcher(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});if(!r.ok)throw Error('NASA climate service unavailable');return requireNASAClimate(await r.json(),schema,hour);};
 const results=await Promise.allSettled([read('/api/wind?at='+encodeURIComponent(hour),'mars-wind/1'),read('/api/environment?parameter=Dust&at='+encodeURIComponent(hour),'mars-environment/1'),elevation?.(point)]);
 signal?.throwIfAborted();
 const wind=results[0].status==='fulfilled'?results[0].value:null,dust=results[1].status==='fulfilled'?results[1].value:null,height=results[2].status==='fulfilled'?results[2].value:null;
 return {lat,lon,ls:sun.ls,ltst:solar.local_true_hour,elevationKm:Number.isFinite(height?.height)?height.height/1000:null,windMps:wind?sampleWind(wind,lon,lat)?.speed??null:null,contextDust:dust?sampleEnvironment(dust,lon,lat):null,
  input_origins:{ls:'NASA Mars24 geometry',ltst:'NASA Mars24 geometry',windMps:wind?'NASA EMARS climatology':'unavailable',elevationKm:height?.source??'unavailable'},kind:'modeled_climatology',at:new Date(at).toISOString(),model_time:hour,provenance:[...(wind?.provenance??[]),...(dust?.provenance??[])],elevation_source:height?.source??'unavailable',inputNote:'NASA climate-model inputs at the selected map centre; not live observations. Missing coverage remains unknown. A calibrated dust forecast model is still required.'};
}
export function manualDustInputs(base,values){
 const result={...base};for(const [key,min,max] of [['lat',-90,90],['lon',-180,180],['ls',0,360],['ltst',0,24],['elevationKm',-15,30],['windMps',0,150]])if(values[key]!==undefined){const n=values[key];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error('Invalid manual '+key);result[key]=n;}
 return {...result,input_origins:{...base.input_origins,...Object.fromEntries(Object.keys(values).map(key=>[key,'user scenario']))},elevation_source:values.elevationKm!==undefined?'user scenario':base.elevation_source,kind:'manual_scenario',inputNote:'User-entered scenario inputs override the displayed source context; they are not NASA observations. No calibrated storm probability is available.'};
}

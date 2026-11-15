import {windHour,sampleWind} from './wind-data.js';
import {requireNASAClimate} from './dust-inputs.js';
// Screen existing terrain routes with explicit user limits; never infer a suit or fatigue penalty from wind.
export function assessRouteConditions(points,packets,{maxWindMps=null,minSunDegrees=null}={}){
 if(maxWindMps!==null&&(!Number.isFinite(maxWindMps)||maxWindMps<0||maxWindMps>150))throw Error('Wind scenario limit must be 0–150 m/s.');
 if(minSunDegrees!==null&&(!Number.isFinite(minSunDegrees)||Math.abs(minSunDegrees)>90))throw Error('Solar scenario limit must be −90° to 90°.');
 const samples=points.map(p=>{const hour=windHour(p.at),packet=packets.get(hour);let wind=null;try{if(packet)wind=sampleWind(requireNASAClimate(packet,'mars-wind/1',hour),p.lon,p.lat);}catch{}const violations=[],unknown=[];
  if(maxWindMps!==null){if(!wind)unknown.push('wind');else if(wind.speed>maxWindMps)violations.push('wind');}
  if(minSunDegrees!==null){if(!Number.isFinite(p.solar_elevation_deg))unknown.push('sunlight');else if(p.solar_elevation_deg<minSunDegrees||minSunDegrees>=0&&p.light==='local_shade')violations.push('sunlight');else if(minSunDegrees>=0&&!['local_shade','no_local_shadow'].includes(p.light))unknown.push('terrain shadow');}
  return {...p,wind_mps:wind?.speed??null,wind_model_time:packet?.model_time??null,violations,unknown};});
 const violationCount=samples.filter(p=>p.violations.length).length,unknownCount=samples.filter(p=>p.unknown.length).length,known=samples.filter(p=>p.wind_mps!==null);
 return {samples,violationCount,unknownCount,wind_known:known.length,wind_total:samples.length,max_wind_mps:known.length?Math.max(...known.map(p=>p.wind_mps)):null,night_count:samples.filter(p=>Number.isFinite(p.solar_elevation_deg)&&p.solar_elevation_deg<=0).length,status:!samples.length||unknownCount?'unknown':violationCount?'outside_scenario':'within_scenario',limits:{maxWindMps,minSunDegrees},note:'NASA EMARS climatology sampled at each arrival hour; solar geometry and bounded DEM shadows. User limits are scenarios, not NASA astronaut operating limits. This screens existing routes and does not prove a globally optimal weather-aware path.'};
}
export async function loadRouteWinds(points,{fetcher=fetch,signal,onProgress=()=>{}}={}){
 const hours=[...new Set(points.map(p=>windHour(p.at)))],packets=new Map();let next=0,completed=0;
 async function worker(){while(next<hours.length){signal?.throwIfAborted();const at=hours[next++];try{const r=await fetcher('/api/wind?at='+encodeURIComponent(at),{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});if(r.ok)packets.set(at,requireNASAClimate(await r.json(),'mars-wind/1',at));}catch(e){if(signal?.aborted)throw e;}onProgress(++completed,hours.length);}}
 await Promise.all([worker(),worker()]);signal?.throwIfAborted();return packets;
}

import {CREW_RESOURCES} from './mission-planning.js';
import {routeProjection} from './route-geometry.js';
import {routeProfile} from './route-profile.js';

export const RETURN_STATES={
 within:{label:'Within reserves',color:'#6be0b1',rgb:[71,217,156]},
 over:{label:'Reserve breach',color:'#ff887e',rgb:[247,104,94]},
 conditional:{label:'Depends on travel speed',color:'#ffcb72',rgb:[255,192,79]},
 blocked:{label:'No modeled return path',color:'#ff887e',rgb:[247,104,94]},
 unknown:{label:'Unknown',color:'#b2c1ca',rgb:[156,170,177]}
};
const resourceFields=[
 ['time','Time','min','time_capacity_min','time_reserve_pct','used_time_min'],
 ['oxygen','Oxygen','L','oxygen_capacity_l','oxygen_reserve_pct','used_oxygen_l'],
 ['energy','Metabolic energy','kJ','energy_capacity_kj','energy_reserve_pct','used_energy_kj']
];

export async function decodeReturnField(packet){
 if(!packet||['blocked','unknown'].includes(packet.status))return packet??null;
 const {status,format,rows,cols,center,spacing_m,data}=packet;
 const dimensions=[rows,cols].every(n=>Number.isInteger(n)&&n>=3&&n<=513);
 if(status!=='ready'||format!=='deflate-f32le-distance-kj/1'||!dimensions||typeof data!=='string'||data.length>3_000_000||!Array.isArray(center)||center.length!==2||!center.every(Number.isFinite)||!(spacing_m>0))throw Error('Invalid return feasibility grid.');
 const compressed=Uint8Array.from(atob(data),char=>char.charCodeAt(0));
 const bytes=new Uint8Array(rows*cols*8),stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate')),reader=stream.getReader();
 let offset=0;
 try{
  for(;;){
   const {value,done}=await reader.read();if(done)break;
   if(offset+value.length>bytes.length)throw Error('Return feasibility grid exceeds its declared size.');
   bytes.set(value,offset);offset+=value.length;
  }
 }finally{await reader.cancel();}
 if(offset!==bytes.length)throw Error('Incomplete return feasibility grid.');
 const {data:_,...header}=packet;
 return {...header,values:new DataView(bytes.buffer),projection:routeProjection(center)};
}

export function returnCell(field,point){
 if(field?.status!=='ready')return {status:field?.status??'unknown'};
 let x,y;try{[x,y]=field.projection.forward(point);}catch{return {status:'unknown'};}
 return localReturnCell(field,x,y);
}

export function localReturnCell(field,x,y){
 const row=Math.floor((field.rows-1)/2-y/field.spacing_m+.5),col=Math.floor((field.cols-1)/2+x/field.spacing_m+.5);
 if(row<0||row>=field.rows||col<0||col>=field.cols)return null;
 const offset=8*(row*field.cols+col),distance=field.values.getFloat32(offset,true),energy=field.values.getFloat32(offset+4,true);
 return distance===-1?{status:'blocked'}:distance>=0&&Number.isFinite(distance)&&Number.isFinite(energy)&&energy>=0?{status:'ready',distance,energy}:{status:'unknown'};
}

export function returnFixMargins(field,point,accuracy,config,spent,limits){
 const estimate=returnMargins(returnCell(field,point),config,spent,limits);
 if(field?.status!=='ready'||!Number.isFinite(accuracy)||estimate.status==='unknown')return estimate;
 let x,y;try{[x,y]=field.projection.forward(point);}catch{return estimate;}
 const {spacing_m:step,rows,cols}=field,half=step/2;
 if(Math.abs(x)+accuracy>cols*half||Math.abs(y)+accuracy>rows*half)return {...estimate,status:'unknown',positionUncertain:true};
 const x0=(cols-1)/2,y0=(rows-1)/2;
 const left=Math.max(0,Math.ceil(x0+(x-accuracy-half)/step)),right=Math.min(cols-1,Math.floor(x0+(x+accuracy+half)/step));
 const top=Math.max(0,Math.ceil(y0-(y+accuracy+half)/step)),bottom=Math.min(rows-1,Math.floor(y0-(y-accuracy-half)/step));
 for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++){
  const cx=(col-x0)*step,cy=(y0-row)*step;
  if(Math.hypot(Math.max(0,Math.abs(x-cx)-half),Math.max(0,Math.abs(y-cy)-half))>accuracy)continue;
  const candidate=returnMargins(localReturnCell(field,cx,cy),config,spent,limits);
  if(candidate.status!==estimate.status)return {...estimate,status:'unknown',positionUncertain:true};
 }
 return estimate;
}

export function routeConsumption(progress,distance){
 if(!progress?.length)return null;
 let low=0,high=progress.length-1;
 while(low<high){
  const middle=(low+high)>>1;
  if(progress[middle].distance_m<distance)low=middle+1;else high=middle;
 }
 const next=progress[low],previous=progress[low-1];
 if(!previous||Math.abs(distance-next.distance_m)<1e-6||distance>next.distance_m)return next.after;
 const ratio=(distance-previous.distance_m)/(next.distance_m-previous.distance_m);
 const spent=Object.fromEntries(['time','energy','oxygen'].map(key=>[key,previous.after[key]+ratio*(next.before[key]-previous.after[key])]));
 // If an interval includes a break, use the earlier next break until the
 // next schedule checkpoint supplies the exact active clock.
 spent.active=next.before.active<previous.after.active||next.before.time-previous.after.time>next.before.active-previous.after.active+1e-6?null:previous.after.active+ratio*(next.before.active-previous.after.active);
 return spent;
}

export function returnLimits(config,crew,spent){
 if(!spent||!config.prior_usage_known)return null;
 const limits=resourceFields.map(([key,label,unit,capacity,reserve,prior])=>({
  key,label,unit,used:spent[key]+config[prior],available:config[capacity]===null?null:config[capacity]*(1-config[reserve]/100)
 }));
 for(const [i,person] of crew.entries())for(const [key,label] of CREW_RESOURCES){
  const rate=person[key+'_rate'];
  limits.push({key:'crew',label:`Crew ${i+1} · ${label}`,unit:'',available:person[key+'_remaining'],used:rate===null?null:rate*spent.time/60,rate});
 }
 return limits;
}

function returnTrip(cell,c,active,nightFactor){
 const walk=cell.distance/1000/(c.speed_kmh*c.speed_factor*nightFactor)*60;
 const breaks=walk>1e-8?Math.max(0,Math.floor(((active??c.break_after_min)+walk-1e-8)/c.break_after_min)):0;
 const time=walk+breaks*c.break_min,energy=cell.energy*c.energy_factor+breaks*c.break_min*c.rest_w*.06;
 return {time,energy,oxygen:energy/20.9+c.oxygen_loss_l_min*time};
}

// One energy-minimizing terrain path per cell. The time bracket comes from the
// configured day/night speeds. It does not presume a different return geometry
// can meet a reserve after the evaluated path exceeds it.
export function returnMargins(cell,config,spent,limits){
 if(!cell||cell.status!=='ready')return {status:cell?.status??'unknown',margins:[]};
 const day=returnTrip(cell,config,spent?.active??0,1);
 const slow=returnTrip(cell,config,spent?.active,config.night_factor);
 const margins=(limits??[]).map(limit=>{
  const amount=trip=>limit.key==='crew'?limit.rate===null?null:trip.time*limit.rate/60:trip[limit.key];
  const margin=trip=>limit.available===null||limit.used===null||amount(trip)===null?null:limit.available-limit.used-amount(trip);
  return {...limit,best:margin(day),worst:margin(slow)};
 });
 const status=margins.some(m=>m.best!==null&&m.best<-.00001)?'over'
  :!margins.length||margins.some(m=>m.worst===null)?'unknown'
  :margins.some(m=>m.worst<-.00001)?'conditional':'within';
 return {status,margins,distance:cell.distance,day,slow};
}

export function expeditionReturns(result,profile,budget,field,state){
 const legs={outward:[],return:[]},c=state.config;
 if(!result||!c.round_trip||!budget||!field)return legs;
 for(const [leg,route] of [['outward',result.routes[profile]],['return',result.return_route]]){
  if(route?.status!=='success')continue;
  legs[leg]=routeProfile(route,result.metadata).samples.map(sample=>{
   const point=[sample.lon,sample.lat],spent=routeConsumption(budget.progress[leg],sample.distance_m),limits=returnLimits(c,state.crew??[],spent);
   return {point,spent,distance_m:sample.distance_m,...returnMargins(returnCell(field,point),c,spent,limits)};
  });
 }
 return legs;
}

export function firstReturnBreach(samples){
 const index=samples.findIndex(p=>p.status==='over'||p.status==='blocked');
 return index===-1?null:{sample:samples[index],lastWithin:samples.slice(0,index).findLast(p=>p.status==='within')??null};
}

export function forecastFromFix(samples,baseline,fix,config,crew,field){
 if(!baseline||!fix.actual||fix.offRoute)return samples;
 return samples.filter(sample=>sample.distance_m>fix.distance&&sample.spent).map(sample=>{
  const spent={active:null};
  for(const key of ['time','energy','oxygen'])spent[key]=fix.actual[key]+Math.max(0,sample.spent[key]-baseline[key]);
  return {...sample,spent,...returnMargins(returnCell(field,sample.point),config,spent,returnLimits(config,crew,spent))};
 });
}

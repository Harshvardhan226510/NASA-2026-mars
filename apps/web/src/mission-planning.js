import {routeProfile} from './route-profile.js';
import {marsDistance} from './measurement-geometry.js';
import {marsSun,solarAt} from './solar-geometry.js';
import {validateMissionAnalysis} from './mission-terrain.js';
import {EVA_SCENARIOS} from './eva-scenarios.js';

export const MISSION_REFERENCES={solar:'https://www.giss.nasa.gov/tools/mars24/help/algorithm.html',lifeSupport:'https://www.nasa.gov/reference/11-0-spacesuits-vol-2/',radio:'https://ntrs.nasa.gov/citations/20020039526'};
export const WALK_FIELDS=[
 ['speed_kmh','Travel speed · km/h',2,.1,20],['work_w','Science work · metabolic W',200,0,2000],['rest_w','Breaks · metabolic W',100,0,1000],
 ['break_after_min','Break after active minutes',60,5,600],['break_min','Break duration · min',10,0,120],['oxygen_loss_l_min','Additional O₂ loss · equivalent L/min',0,0,20],
 ['time_capacity_min','Time allocation · min',null,1,10000],['oxygen_capacity_l','O₂ allocation · equivalent L',null,1,100000],['energy_capacity_kj','Metabolic energy allocation · kJ',null,1,1000000],
 ['time_reserve_pct','Time reserve · %',20,0,95],['oxygen_reserve_pct','O₂ reserve · %',20,0,95],['energy_reserve_pct','Energy reserve · %',20,0,95],
 ['speed_factor','Scenario travel speed multiplier',1,.1,2],['energy_factor','Scenario travel energy multiplier',1,.1,5],['night_factor','Night travel speed multiplier',1,.1,1],
 ['walker_height_m','Explorer antenna height · m',1.7,0,150],['receiver_height_m','Habitat / relay antenna height · m',3,0,10000],
 ['safety_min_sun_deg','Minimum solar elevation for EVA · °',0,-90,90],
 ['used_time_min','Already elapsed · min',0,0,10000],['used_oxygen_l','Already consumed O₂ · equivalent L',0,0,100000],['used_energy_kj','Already used metabolic energy · kJ',0,0,1000000]
];
const finite=(v,min,max,name)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`Invalid ${name}.`);return v;};
const text=(v,n=1000)=>String(v??'').slice(0,n);
const point=p=>{if(!Array.isArray(p)||p.length!==2)throw Error('Invalid mission position.');return [finite(p[0],-180,180,'longitude'),finite(p[1],-90,90,'latitude')];};
const date=(v,fallback)=>{const at=Date.parse(v??fallback);if(!Number.isFinite(at)||at<Date.parse('2000-01-01')||at>Date.parse('2030-12-31T23:59:59Z'))throw Error('Mission times must be between 2000 and 2030.');return new Date(at).toISOString();};
const source=s=>s&&/^https?:\/\//.test(s.url)?{title:text(s.title,300),url:text(s.url,2000)}:null;
export function walkConfig(input={}){
 for(const key of ['round_trip','assumptions_reviewed','prior_usage_known','comms'])if(input[key]!==undefined&&typeof input[key]!=='boolean')throw Error('Invalid '+key+'.');
 const c={};for(const [id,,fallback,min,max] of WALK_FIELDS){const v=input[id]===undefined?fallback:input[id];c[id]=v===null&&fallback===null?null:finite(v,min,max,id);}
 return {...c,round_trip:input.round_trip!==false,departure:date(input.departure,new Date().toISOString().slice(0,16)+':00Z'),scenario:text(input.scenario||'User planning scenario',160),assumptions_reviewed:input.assumptions_reviewed===true,prior_usage_known:input.prior_usage_known!==false,comms:input.comms!==false,receiver_point:input.receiver_point?point(input.receiver_point):null};
}
const taskTemplates={
 science:['Which textures and contacts test the published interpretation?','Context camera; close-up imager; field notebook','Georeferenced images and notes supporting or challenging the interpretation.'],
 minerals:['Do local exposures support the published mineral interpretation?','Context camera; calibrated field spectrometer if carried','Calibrated spectra with context and location; no ore grade inferred.'],
 resources:['What observations test material accessibility and the resource hypothesis?','Context camera; mission-approved depth or material survey tools','Access, overburden and material observations; usable yield remains unverified.']
};
export function scienceTask(target){
 const [question,equipment,expected]=taskTemplates[target.category]??['What should be documented at this checkpoint?','Field notebook; context camera','A dated location, observation and supporting images.'];
 return {id:target.id,siteId:target.siteId??null,name:target.name,point:[...target.point],category:target.category??'science',evidence:target.evidence??'User-defined checkpoint',coordinateNote:target.coordinateNote??'User-defined position',source:source(target.source),question,equipment,expected,minutes:15,equipment_ready:false,status:'planned'};
}
export function walkState(input={}){
 const tasks={};if(Object.keys(input.tasks??{}).length>64)throw Error('A mission supports 64 station task records.');
 for(const [id,t] of Object.entries(input.tasks??{})){
  if(id.length>100||['__proto__','constructor','prototype'].includes(id)||!t||typeof t!=='object')throw Error('Invalid station task.');
  tasks[id]={id,siteId:t.siteId?text(t.siteId,100):null,name:text(t.name,120),point:point(t.point),category:['science','minerals','resources'].includes(t.category)?t.category:'science',evidence:text(t.evidence),coordinateNote:text(t.coordinateNote),source:source(t.source),question:text(t.question,2000),equipment:text(t.equipment,2000),expected:text(t.expected,2000),minutes:finite(t.minutes,0,1440,'station duration'),equipment_ready:t.equipment_ready===true,status:['planned','completed','skipped'].includes(t.status)?t.status:'planned'};
 }
 const entries=input.logs??[];if(!Array.isArray(entries)||entries.length>100)throw Error('A mission supports 100 field log entries. Export it before starting another log.');
 const logs=entries.map((e,i)=>({id:text(e.id||`entry-${i}`,100),at:date(e.at,new Date().toISOString()),kind:['observation','obstacle','position','station'].includes(e.kind)?e.kind:'observation',point:point(e.point),stationId:e.stationId?text(e.stationId,100):null,note:text(e.note,3000),active:e.active!==false,radius_m:finite(e.radius_m??25,0,10000,'reported obstacle radius')}));
 if(new Set(logs.map(e=>e.id)).size!==logs.length)throw Error('Each field log entry needs a different ID.');
 let climate=null;if(input.climate){const p=input.climate;if(!Array.isArray(p.samples)||p.samples.length>3)throw Error('Invalid saved climate snapshot.');climate={model_time:date(p.model_time),retrieved_at:text(p.retrieved_at,40),source:text(p.source,200),model_label:text(p.model_label,200),health:text(p.health,50),kind:'modeled_climatology',samples:p.samples.map(s=>({name:text(s.name,100),point:point(s.point),temperature_k:s.temperature_k===null?null:finite(s.temperature_k,80,400,'model temperature'),pressure_pa:s.pressure_pa===null?null:finite(s.pressure_pa,0,3000,'model pressure')}))};}
 const campSiteId=input.home&&typeof input.campSiteId==='string'&&/^user-[a-zA-Z0-9-]{1,90}$/.test(input.campSiteId)?input.campSiteId:null;
 const guided=EVA_SCENARIOS.some(s=>s.id===input.guided)?input.guided:null;
 const crew=validateCrew(input.crew);
 return {version:1,config:walkConfig(input.config),home:input.home?point(input.home):null,...(campSiteId?{campSiteId}:{}),...(guided?{guided}:{}),...(input.evaReturn?{evaReturn:point(input.evaReturn)}:{}),...(crew.length?{crew}:{}),profile:['direct_safe','apf_survey','deep_science'].includes(input.profile)?input.profile:'deep_science',tab:['plan','stations','conditions','audit','comms','log','field','guided','feasibility','replay','hazards'].includes(input.tab)?input.tab:'plan',open:input.open===true,tasks,logs,analysis:validateMissionAnalysis(input.analysis),climate};
}

export const CREW_RESOURCES=[['oxygen','O₂ · equivalent L'],['scrubber','CO₂ scrubber · rated hours'],['cooling','Cooling water · L'],['battery','Battery · Wh']];
export function validateCrew(input=[]){
 if(!Array.isArray(input)||input.length>2)throw Error('A Marswalk supports up to two suit budgets.');
 return input.map(person=>Object.fromEntries(CREW_RESOURCES.flatMap(([key])=>['remaining','rate'].map(field=>{
  const id=`${key}_${field}`,value=person?.[id];return [id,value==null?null:finite(value,field==='rate'?0:.001,100000,`${key} ${field}`)];
 }))));
}

export function crewBudget(crew,budget,{roundTrip}={}){
 if(!budget?.complete)return [];
 const totalTime=budget.checks.time.estimate;
 const travel=budget.totals.outward.minutes,returnTime=roundTrip?budget.totals.return.minutes:null;
 const returnFactor=travel>0&&Number.isFinite(returnTime)?returnTime/travel:null;
 const priorPlanStops=(budget.totals.work.minutes??0)+(budget.totals.breaks.minutes??0);
 return crew.map(person=>{
  const resources=CREW_RESOURCES.map(([key,label])=>{
   const hourly=person[key+'_rate'],available=person[key+'_remaining'];
   const used=available===null||hourly===null?null:hourly*totalTime/60;
   const endurance=available===null||!hourly?null:available*60/hourly;
   const turnback=returnFactor===null||endurance===null?null:Math.max(0,(endurance-priorPlanStops)/(1+returnFactor));
   return {label,used,remaining:used===null?null:available-used,endurance,turnback};
  });
  const known=resources.filter(r=>Number.isFinite(r.endurance));
  const limiting=known.sort((a,b)=>a.endurance-b.endurance)[0]??null;
  return {resources,limiting,complete:resources.every(r=>r.used!==null)};
 });
}
export function stationArrivals(route,metadata,targets,tasks){
 const p=routeProfile(route,metadata),limit=Math.max(5,(metadata.grid_spacing_m??0)*1.5),missed=new Set(route?.unreached_targets??[]);
 return targets.map(t=>{
  const task=tasks[t.id]??scienceTask(t);let index=-1,separation=Infinity;
  for(let i=0;i<p.samples.length;i++){const s=p.samples[i],d=marsDistance(t.point,[s.lon,s.lat]);if(d<separation){index=i;separation=d;}}
  return {...task,distance_m:index<0?null:p.samples[index].distance_m,separation_m:Number.isFinite(separation)?separation:null,reached:index>=0&&separation<=limit&&!missed.has(t.id),arrival_tolerance_m:limit};
 }).sort((a,b)=>(a.distance_m??Infinity)-(b.distance_m??Infinity));
}
const sum=values=>values.every(Number.isFinite)?values.reduce((a,b)=>a+b,0):null;
const sunlight=(at,lon,lat)=>{try{return solarAt(marsSun(at),lon,lat);}catch{return null;}};
export function allocation(used,capacity,reserve,prior=0){
 const usable=capacity===null?null:capacity*(1-reserve/100),total=used===null?null:used+prior;
 return {estimate:used,prior,total,capacity,reserve_pct:reserve,usable,remaining:usable===null||total===null?null:usable-total,status:total===null?'unknown':usable===null?'not_set':total>usable?'over':'within'};
}
export function missionBudget(result,profile,state){
 const c=walkConfig(state.config),route=result?.routes?.[profile],back=c.round_trip?result?.return_route:null,metadata=result?.metadata??{};
 const valid=r=>r?.status==='success'&&Number.isFinite(r.summary?.minetti_energy_kj)&&r.summary.minetti_energy_kj>=0&&Array.isArray(r.waypoints)&&r.waypoints.length>0;
 const outwardOK=valid(route),returnOK=!c.round_trip||valid(back),stations=stationArrivals(route,metadata,result?.targets??[],state.tasks??{});
 const missing=stations.filter(t=>t.status==='planned'&&!t.reached),scheduled=stations.filter(t=>t.status==='planned'&&t.reached),events=[],conditions=[],progress={outward:[],return:[]};
 let elapsed=0,active=0,breaks=0,consumedEnergy=0;const departure=Date.parse(c.departure),totals={outward:{minutes:outwardOK?0:null,energy_kj:outwardOK?0:null,oxygen_l:outwardOK?0:null},work:{minutes:0,energy_kj:0,oxygen_l:0},breaks:{minutes:0,energy_kj:0,oxygen_l:0},return:{minutes:returnOK?0:null,energy_kj:returnOK?0:null,oxygen_l:returnOK?0:null}};
 const event=(kind,name,minutes,p,energy,extra={})=>{const start=elapsed;elapsed+=minutes;consumedEnergy+=energy;events.push({kind,name,start_min:start,end_min:elapsed,at:new Date(departure+start*60000).toISOString(),until:new Date(departure+elapsed*60000).toISOString(),point:p,energy_kj:energy,...extra});};
 const consumption=()=>({time:elapsed,energy:consumedEnergy,oxygen:consumedEnergy/20.9+c.oxygen_loss_l_min*elapsed,active});
 const rest=p=>{const energy=c.rest_w*c.break_min*.06;event('breaks','Scheduled break',c.break_min,p,energy);totals.breaks.minutes+=c.break_min;totals.breaks.energy_kj+=energy;totals.breaks.oxygen_l+=energy/20.9+c.oxygen_loss_l_min*c.break_min;active=0;breaks++;};
 const activity=(kind,name,minutes,p,energy,extra={})=>{
  const many=Math.max(0,Math.floor((active+minutes-1e-8)/c.break_after_min));
  if(many>8){const breakMinutes=many*c.break_min,restEnergy=c.rest_w*breakMinutes*.06;event(kind,name,minutes+breakMinutes,p,energy+restEnergy,{...extra,active_minutes:minutes,aggregated_breaks:many});totals.breaks.minutes+=breakMinutes;totals.breaks.energy_kj+=restEnergy;totals.breaks.oxygen_l+=restEnergy/20.9+c.oxygen_loss_l_min*breakMinutes;breaks+=many;active=active+minutes-many*c.break_after_min;totals[kind].minutes+=minutes;totals[kind].energy_kj+=energy;totals[kind].oxygen_l+=energy/20.9+c.oxygen_loss_l_min*minutes;return;}
  let remaining=minutes;while(remaining>1e-8){if(active>=c.break_after_min-1e-8)rest(p);const part=Math.min(remaining,c.break_after_min-active),share=minutes?part/minutes:0;event(kind,name,part,p,energy*share,extra);active+=part;remaining-=part;}
  totals[kind].minutes+=minutes;totals[kind].energy_kj+=energy;totals[kind].oxygen_l+=energy/20.9+c.oxygen_loss_l_min*minutes;
 };
 const travel=(r,kind,stops)=>{
  const p=routeProfile(r,metadata),length=p.distance_m,energy=r.summary.minetti_energy_kj*c.energy_factor,profileEnergy=p.samples.at(-1)?.travel_energy_kj;let last=0,next=0,lastEnergy=0;
  const cut=[...new Set([...p.samples.filter((_,i)=>i%Math.max(1,Math.ceil(p.samples.length/96))===0).map(s=>s.distance_m),...stops.map(s=>s.distance_m),length])].sort((a,b)=>a-b);
  for(const d of cut){const sample=p.samples.find(s=>s.distance_m>=d)??p.samples.at(-1);if(!sample)continue;const at=new Date(departure+elapsed*60000).toISOString(),solar=sunlight(at,sample.lon,sample.lat),night=solar!==null&&solar.elevation<=0;
   const minutes=(d-last)/1000/(c.speed_kmh*c.speed_factor*(night?c.night_factor:1))*60;
   const atEnergy=profileEnergy>0&&Number.isFinite(sample.travel_energy_kj)?Math.max(lastEnergy,energy*sample.travel_energy_kj/profileEnergy):length?energy*d/length:0;
   activity(kind,kind==='outward'?'Outward travel':'Return to habitat',minutes,[sample.lon,sample.lat],atEnergy-lastEnergy,{distance_m:d,night});lastEnergy=atEnergy;
   conditions.push({leg:kind,distance_m:d,at:new Date(departure+elapsed*60000).toISOString(),lon:sample.lon,lat:sample.lat,solar_elevation_deg:sunlight(departure+elapsed*60000,sample.lon,sample.lat)?.elevation??null});last=d;
   const before=consumption();
   while(next<stops.length&&stops[next].distance_m<=d+1e-6){const s=stops[next++],work=s.minutes*c.work_w*.06;activity('work',s.name,s.minutes,s.point,work,{station_id:s.id});}
   progress[kind].push({distance_m:d,before,after:consumption()});
  }
 };
 if(outwardOK)travel(route,'outward',scheduled);if(c.round_trip&&valid(back))travel(back,'return',[]);
 const time=sum(Object.values(totals).map(v=>v.minutes)),oxygen=sum(Object.values(totals).map(v=>v.oxygen_l)),energy=sum(Object.values(totals).map(v=>v.energy_kj));
 const complete=outwardOK&&returnOK&&!missing.length&&c.prior_usage_known,checks={time:allocation(complete?time:null,c.time_capacity_min,c.time_reserve_pct,c.used_time_min),oxygen:allocation(complete?oxygen:null,c.oxygen_capacity_l,c.oxygen_reserve_pct,c.used_oxygen_l),energy:allocation(complete?energy:null,c.energy_capacity_kj,c.energy_reserve_pct,c.used_energy_kj)};
 return {profile,departure:c.departure,return_at:complete?new Date(departure+elapsed*60000).toISOString():null,complete,totals,checks,events,conditions,progress,stations,missing_stations:missing.map(s=>s.id),equipment_unconfirmed:scheduled.filter(s=>!s.equipment_ready).map(s=>s.id),break_count:breaks,night_samples:conditions.filter(s=>Number.isFinite(s.solar_elevation_deg)&&s.solar_elevation_deg<=0).length,status:!complete?'incomplete':Object.values(checks).some(s=>s.status==='over')?'over':Object.values(checks).some(s=>s.status==='not_set')?'allocations_needed':!c.assumptions_reviewed?'draft':'within_configured_allocations',model_note:'Scenario estimates per explorer; original partner walking energy, 20.9 kJ per equivalent litre O₂. Work/break power and suit loss are user inputs. Energy is metabolic, not battery capacity; thermal control, CO₂ removal, rescue and equipment validation are outside this budget.'};
}

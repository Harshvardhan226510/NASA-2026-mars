import {routeProfile} from './route-profile.js';
import {returnCell,returnLimits,returnMargins,routeConsumption} from './return-feasibility.js';
import {wrapRouteLongitude} from './route-geometry.js';

export const replayScenarios={
 baseline:'Planned EVA',
 rover:'Rover pickup fails',
 passage:'Passage blocked',
 supplies:'Reduced suit resources',
 radio:'Communications lost'
};

export function replayTimeline(result,budget,profile){
 if(!result||!budget?.progress?.outward.length)return null;
 const legs={outward:routeProfile(result.routes[profile],result.metadata).samples,return:routeProfile(result.return_route,result.metadata).samples};
 const duration=budget.events.at(-1)?.end_min??0;
 return duration>0?{legs,budget,duration}:null;
}

export function positionAtDistance(samples,distance){
 const i=samples.findIndex(p=>p.distance_m>=distance);
 const a=samples[Math.max(0,i-1)],b=i<0?samples.at(-1):samples[i];
 if(!a||!b)return null;
 const t=b.distance_m===a.distance_m?0:Math.max(0,Math.min(1,(distance-a.distance_m)/(b.distance_m-a.distance_m)));
 return [wrapRouteLongitude(a.lon+t*wrapRouteLongitude(b.lon-a.lon)),a.lat+t*(b.lat-a.lat)];
}

export function replayFrame(timeline,time,oxygenLoss){
 const {legs,budget}=timeline,progress=budget.progress;
 const leg=progress.return.length&&time>=progress.return[0].before.time?'return':'outward';
 const anchors=progress[leg];
 const i=anchors.findIndex(checkpoint=>time<=checkpoint.after.time);
 const end=anchors[i<0?anchors.length-1:i],start=anchors[Math.max(0,i-1)];
 const travel=i>0&&time<end.before.time;
 const t=travel?(time-start.after.time)/(end.before.time-start.after.time):0;
 const distance=travel?start.distance_m+t*(end.distance_m-start.distance_m):end.distance_m;
 let energy=travel?start.after.energy+t*(end.before.energy-start.after.energy):end.after.energy;
 let active=travel?routeConsumption(anchors,distance)?.active:end.after.active;
 if(!travel&&time<end.after.time&&end.after.time>end.before.time){
  const dwell=(time-end.before.time)/(end.after.time-end.before.time);
  energy=end.before.energy+dwell*(end.after.energy-end.before.energy);active=null;
 }
 const event=budget.events.find(e=>time<e.end_min)??budget.events.at(-1);
 return {leg,distance,point:positionAtDistance(legs[leg],distance),time,activity:event?.name??'Traverse',
  spent:{time,energy,oxygen:energy/20.9+oxygenLoss*time,active}};
}

export function incidentPosition(timeline,frame,spacing){
 const samples=timeline.legs[frame.leg],last=samples.at(-1)?.distance_m??0;
 const offset=Math.max(40,spacing*2.5);
 const target=frame.distance+offset<=last?frame.distance+offset:Math.max(0,frame.distance-offset);
 if(Math.abs(target-frame.distance)<spacing*1.1)return null;
 return {point:positionAtDistance(samples,target),distance:target,leg:frame.leg,radius:Math.max(8,spacing*.55)};
}

export function replayOutcome(frame,{config,crew,field,scenario,incident,lossPercent=30,pickupMinutes=15,passage,visibility}){
 const active=scenario!=='baseline'&&frame.time>=incident.time;
 const spent={...frame.spent};
 if(active&&scenario==='rover'){
  spent.time+=pickupMinutes;
  spent.energy+=pickupMinutes*config.rest_w*.06;
  spent.oxygen=spent.energy/20.9+config.oxygen_loss_l_min*spent.time;
  spent.active=null;
 }
 const limits=returnLimits(config,crew,spent);
 if(active&&scenario==='supplies'&&limits){
  const atIncident=returnLimits(config,crew,incident.spent);
  for(const [i,limit] of limits.entries()){
   const before=atIncident?.[i],affected=limit.key==='oxygen'||limit.key==='crew';
   if(affected&&Number.isFinite(before?.available)&&Number.isFinite(before?.used))limit.available-=Math.max(0,before.available-before.used)*lossPercent/100;
  }
 }
 const sample={point:frame.point,distance_m:frame.distance,spent,...returnMargins(returnCell(field,frame.point),config,spent,limits)};
 const comms=active&&scenario==='radio'?'lost':visibility??'unknown';
 const denied=sample.status==='over'||sample.status==='blocked'||comms==='lost'&&config.comms||comms==='blocked'&&config.comms||active&&scenario==='passage'&&passage;
 const review=sample.status!=='within'||config.comms&&comms!=='clear'||active&&(scenario==='rover'||scenario==='passage'||scenario==='radio');
 return {active,spent,limits,sample,comms,verdict:denied?'NO-GO':review?'CAUTION':'GO'};
}

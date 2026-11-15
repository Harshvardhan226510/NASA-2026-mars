import {assessEvaSafety} from './eva-safety.js';
import {MISSION_REFERENCES,missionBudget} from './mission-planning.js';
import {analyseMission} from './mission-terrain.js';
import {expeditionReturns,RETURN_STATES} from './return-feasibility.js';

const profiles={direct_safe:'Direct safe',apf_survey:'APF survey',deep_science:'Deep science'};
const resources={time:['Time','min','time_capacity_min'],oxygen:['Oxygen equivalent','L','oxygen_capacity_l'],energy:['Metabolic energy','kJ','energy_capacity_kj']};
const terrainSources={
 global:['USGS HRSC/MOLA blended terrain','https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m'],
 native:['HiRISE digital terrain catalogue','https://www.uahirise.org/hiwish/maps/dtms.jsp']
};
const value=(n,digits=1)=>Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:digits}):'unknown';
const percent=n=>Number.isFinite(n)?value(Math.floor(n*10+1e-7)/10)+'%':'unknown';

export function parseMissionQuestion(query){
 const q=String(query).toLowerCase().replace(/o₂/g,'o2');
 const station=/\b(science|stop[s]?|station[s]?|checkpoint[s]?)\b/.test(q);
 const removal=/\b(remove|drop|skip|omit|cut|cancel|leave out|give up)\b/.test(q);
 const reserve=/\b(reserve[s]?|consumables|oxygen|o2|budget|return|turnaround|life support)\b/.test(q);
 if(removal&&(station||/what if/.test(q))&&reserve){
  const raw=q.match(/(-?\d+(?:\.\d+)?)\s*(?:%|percent)/);
  const keys=Object.keys(resources).filter(key=>({
   time:/\b(time|duration)\b/,oxygen:/\b(oxygen|o2)\b/,energy:/\b(metabolic energy|energy)\b/
  })[key].test(q));
  return {type:'omit',minimum:raw?Number(raw[1]):null,keys:keys.length?keys:Object.keys(resources),query:q};
 }
 if(/\b(open|show|inspect)\b.*\b(return safety|marswalk|terrain hazards)\b/.test(q))
  return {type:'open',tab:q.includes('return safety')?'feasibility':q.includes('terrain hazards')?'hazards':'plan'};
 if(/\b(can|could|will|is it safe to|enough to)\b.*\b(return|turn back|get back|make it back|go back|get home)\b/.test(q))
  return {type:'return'};
 if(/\brisk(?: score)?\b/.test(q)&&/\b(route[s]?|path[s]?|direct safe|apf survey|deep science)\b/.test(q))
  return {type:'risk',profile:Object.keys(profiles).find(key=>q.includes(profiles[key].toLowerCase()))};
 if(/\b(mission status|mission state|mission readiness|mission assessment|eva assessment|go or no go|return reserve|return feasibility|audit consumables|point of no return)\b/.test(q)||
    (reserve||/\b(risk|safe|safety)\b/.test(q))&&/\b(current|our|this|planned|calculated)\b.*\b(mission|route|path|eva|reserve[s]?|allocation[s]?|oxygen|o2)\b/.test(q))
  return {type:'status'};
 return null;
}

// Percent of the declared initial allocation left after the scheduled finish
// and after a return from each sampled route position, using the slower speed.
export function minimumReturnReserve(budget,returns,keys){
 const samples=[...returns.outward,...returns.return];
 if(!budget?.complete||!returns.outward.length||!returns.return.length||
    samples.some(s=>s.status==='blocked'||!s.margins?.length))return null;
 let limiting=null;
 for(const key of keys){
  const check=budget.checks[key];
  if(!(check.capacity>0)||!Number.isFinite(check.total))return null;
  let minimum=(1-check.total/check.capacity)*100;
  for(const sample of samples){
   const margin=sample.margins.find(m=>m.key===key)?.worst;
   if(!Number.isFinite(margin))return null;
   minimum=Math.min(minimum,check.reserve_pct+100*margin/check.capacity);
  }
  if(!limiting||minimum<limiting.percent)limiting={key,percent:minimum};
 }
 return limiting;
}

function sources(result,station){
 const terrain=result?.metadata.source,terrainRef=terrain?.url?[terrain.label,terrain.url]:terrainSources[terrain?.kind];
 return [terrainRef,['Minetti walking cost data','https://doi.org/10.1152/japplphysiol.01177.2001'],
  ['NASA Mars24 solar geometry',MISSION_REFERENCES.solar],['NASA radio propagation context',MISSION_REFERENCES.radio],
  station?.source&&[station.source.title,station.source.url]].filter(x=>x&&/^https?:\/\//.test(x[1]));
}

function snapshot(planner){
 const w=planner.workbench,result=planner.result,state=structuredClone(w.state);
 const grid=w.resultId===result?.metadata?.mission_id?w.grid:null;
 return {w,result,state,grid,profile:state.profile,field:w.returnField,radio:planner.radio?.()};
}

function evaluate(model,result=model.result){
 const {state,grid,profile,field,radio}=model,config=state.config;
 const budget=missionBudget(result,profile,state);
 const terrain=grid?analyseMission(result,profile,state,budget,grid):model.w.analysis;
 const returns=expeditionReturns(result,profile,budget,model.w.pendingReports?null:field,state);
 const assessment=assessEvaSafety({result,profile,budget,analysis:terrain,config,pendingReports:model.w.pendingReports,returns,
  crew:state.crew??[],receiver:terrain?.receiver,radio,currentReturn:result===model.result?model.w.returnSafety.currentFix():null});
 return {budget,assessment,returns};
}

function describe(model,fromPosition){
 const {result,state,profile,w}=model,{budget,assessment,returns}=evaluate(model);
 const first=fromPosition?w.returnSafety.currentFix():null;
 const mode=state.config.round_trip?'round trip':'outward only';
 const lines=[`${profiles[profile]} · ${mode} · EVA assessment ${assessment.verdict}`];
 if(fromPosition){
  lines.push(first?`Latest recorded position: ${RETURN_STATES[first.status].label}. ${w.returnSafety.fix?.actual?'Uses entered consumption.':'Uses scheduled consumption where available.'}`:
   'No field position fix is available. The figures below refer to the planned traverse.');
  if(first)for(const margin of first.margins.filter(m=>Number.isFinite(m.worst)))lines.push(`${margin.label}: ${value(Math.abs(margin.worst))} ${margin.unit} ${margin.worst<0?'below':'above'} the configured reserve after the slower modeled return.`);
 }
 for(const [key,[label,unit]] of Object.entries(resources)){
  const check=budget.checks[key];
  lines.push(`${label}: ${value(check.total)} ${unit} projected use · ${value(check.capacity)} ${unit} allocated · ${check.reserve_pct}% configured reserve.`);
 }
 const reserve=minimumReturnReserve(budget,returns,Object.keys(resources));
 if(reserve)lines.push(`Lowest modeled reserve on the sampled traverse: ${percent(reserve.percent)} (${resources[reserve.key][0]}).`);
 const stations=budget.stations.filter(s=>s.status==='planned');
 if(stations.length)lines.push('Planned stops: '+stations.map(s=>s.name).join(', ')+'.');
 for(const check of assessment.checks.filter(c=>c.status!=='pass'))lines.push(`${check.name}: ${check.evidence}${check.action?' '+check.action:''}`);
 lines.push(terrainBasis(result));
 return {text:lines.join('\n'),sources:sources(result),tab:fromPosition?'feasibility':'plan'};
}

function terrainBasis(result){
 const m=result.metadata;
 return `Terrain: ${m.source?.label??'source unknown'} · ${value(m.source?.sample_m)} m source sampling · ${value(m.grid_spacing_m)} m planning cells. Budget inputs come from the current Marswalk plan.`;
}

function targetsForComparison(model,question){
 const {result,state,w,grid,field}=model;
 if(!state.config.round_trip||result.return_route?.status!=='success')throw Error('Calculate a complete round trip with a return point before comparing reserve scenarios.');
 if(w.pendingReports||!grid||field?.status!=='ready')throw Error('Recalculate the mission on the loaded terrain to include current obstacle reports and a return field.');
 const latest=state.logs?.filter(entry=>entry.kind==='position').sort((a,b)=>b.at.localeCompare(a.at))[0];
 if(latest&&latest.at>(result.metadata.planned_at??''))throw Error('A position fix was recorded after this plan. In Marswalk Field log, replan the remaining mission from that position and enter prior consumption.');
 if(!state.config.prior_usage_known)throw Error('Enter or confirm prior consumption in Marswalk before comparing return reserves.');
 if(question.minimum!==null&&!(question.minimum>=0&&question.minimum<=100))throw Error('Choose a return reserve between 0% and 100%.');
 const config=state.config;
 const absent=question.keys.filter(key=>!(config[resources[key][2]]>0));
 if(absent.length)throw Error('Set the following Marswalk allocations before comparing: '+absent.map(key=>resources[key][0]).join(', ')+'.');
 const planned=(result.targets??[]).filter(t=>!['completed','skipped'].includes(state.tasks[t.id]?.status));
 const named=planned.filter(t=>question.query.includes(t.name.toLowerCase()));
 const eligible=named.length?named:planned;
 if(!eligible.length)throw Error('This plan has no remaining science stops to compare.');
 return {planned,eligible};
}

export async function compareMissionStops(model,question,{fetcher=fetch,signal}={}){
 const {result,state,w,profile,grid}=model,{metadata:m}=result;
 const {planned,eligible}=targetsForComparison(model,question);
 const signature=()=>JSON.stringify([w.host.result?.metadata.mission_id,w.state.profile,w.state.config,w.state.tasks,w.state.crew,
  w.state.logs,w.returnSafety.fix]);
 const before=signature(),baseline=evaluate(model);
 const meetsTarget=({budget,returns})=>question.keys.every(key=>{
  const measure=minimumReturnReserve(budget,returns,[key]);
  return measure&&measure.percent+1e-7>=(question.minimum??budget.checks[key].reserve_pct);
 });
 const minerals=(m.mineral_attractors??[]).map(({geometry,properties})=>({point:geometry.coordinates,id:properties.id,
  name:properties.name,score:properties.science_value,radius_m:properties.radius_m}));
 const options=Object.fromEntries(['mass_kg','gravity_ratio','max_slope_deg','apf_pull','sensor_radius_m','allow_slope_traverse'].map(k=>[k,m[k]]));
 const response=await fetcher('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({schema:'mars-route-request/1',scenario_profile:profile,omit_targets:eligible.map(t=>t.id),targets:planned,minerals,
   grid,start:result.start,goal:result.goal,round_trip:true,return_to:result.return_to,obstacles:w.obstacles(),options}),
  signal});
 const data=await response.json();
 if(!response.ok||data.schema!=='mars-stop-scenarios/1'||data.profile!==profile||!Array.isArray(data.scenarios)||
   data.scenarios.length!==eligible.length||eligible.some(t=>data.scenarios.filter(s=>s.omitted===t.id&&s.route).length!==1))
  throw Error(data.error??'The route service did not return the requested comparisons.');
 signal?.throwIfAborted();
 if(before!==signature())throw Error('The mission changed during comparison. Run the question again against the current plan.');
 const tests=data.scenarios.map(({omitted,route})=>{
  const candidate={...result,routes:{...result.routes,[profile]:route},targets:planned.filter(t=>t.id!==omitted)};
  const outcome=evaluate(model,candidate),reserve=minimumReturnReserve(outcome.budget,outcome.returns,question.keys);
  const meet=Boolean(reserve&&meetsTarget(outcome));
  return {...outcome,reserve,meet,station:eligible.find(t=>t.id===omitted)};
 });
 const strongest=tests.filter(t=>t.reserve).sort((a,b)=>b.reserve.percent-a.reserve.percent);
 const qualified=strongest.filter(t=>t.meet).sort((a,b)=>Number(a.assessment.verdict==='NO-GO')-Number(b.assessment.verdict==='NO-GO')||
  (a.station.score??50)-(b.station.score??50)||b.reserve.percent-a.reserve.percent);
 const best=qualified[0]??strongest[0],initial=minimumReturnReserve(baseline.budget,baseline.returns,question.keys);
 const alreadyMeets=meetsTarget(baseline);
 const target=question.minimum===null?'the configured reserve floors':percent(question.minimum);
 const lines=[`${profiles[profile]} · omit one stop at a time · target ${target} for ${question.keys.map(k=>resources[k][0].toLowerCase()).join(', ')}.`];
 if(alreadyMeets)lines.push(`The current plan already meets the reserve target. Its EVA assessment is ${baseline.assessment.verdict}.`);
 else if(best?.meet)lines.push(`Omitting ${best.station.name} would leave ${percent(best.reserve.percent)} at the limiting sampled position (${resources[best.reserve.key][0]}). Projected EVA assessment: ${best.assessment.verdict}.`);
 else if(best)lines.push(`No tested single stop met ${target}. The best modeled result was ${percent(best.reserve.percent)} after omitting ${best.station.name}.`);
 else lines.push('The tested omissions did not establish a complete route with calculable reserves.');
 lines.push(`Current plan: ${initial?percent(initial.percent)+' limiting reserve ('+resources[initial.key][0]+')':'limiting reserve unknown'}.`);
 for(const test of tests){
  const saving=baseline.budget.checks.time.total-test.budget.checks.time.total;
  const duration=Number.isFinite(baseline.budget.checks.time.total)&&Number.isFinite(test.budget.checks.time.total)?` · ${value(saving)} min saved`:'';
  const reason=test.reserve?`${percent(test.reserve.percent)} · ${test.assessment.verdict}${duration}`:
   test.budget.missing_stations.length?'remaining planned stations not all reached':'usable return estimate unavailable';
  lines.push(`• ${test.station.name}: ${reason}.`);
 }
 const assessment=alreadyMeets?baseline.assessment:best?.assessment;
 if(assessment){
  const blocker=assessment.checks.find(c=>c.status==='stop')??assessment.checks.find(c=>c.status==='caution');
  if(blocker)lines.push(`${blocker.name}: ${blocker.evidence}${blocker.action?' '+blocker.action:''}`);
 }
 lines.push('Reserve means the percentage of the declared allocation left after the modeled return. The comparison uses the slower configured speed at sampled positions and includes planned work, breaks and prior use. This is a preview.');
 lines.push(terrainBasis(result));
 return {text:lines.join('\n'),sources:sources(result,best?.station),tab:'feasibility'};
}

export async function answerMissionQuestion(planner,question,options){
 if(!planner?.workbench||!planner.result)throw Error('Calculate a Marswalk route before asking for a mission assessment or reserve comparison.');
 const model=snapshot(planner);
 if(question.type==='omit')return compareMissionStops(model,question,options);
 if(question.type==='risk'){
  const risks=planner.risks(),lines=[];
  for(const key of question.profile?[question.profile]:Object.keys(profiles)){
   const r=risks[key]?.risk;
   lines.push(r?`${profiles[key]}: ${r.partial?'about ':''}${r.score}% terrain risk index. Peak slope ${value(r.peakSlope)}°, peak roughness ${r.peakRoughness===null?'unresolved':value(r.peakRoughness,2)+' m'}, walking effort ${value(r.effort,2)}× flat ground, ${value(r.coverage*100,0)}% measured slope coverage.`:
    `${profiles[key]}: terrain risk unknown.`);
  }
  lines.push(terrainBasis(model.result),'The score compares terrain and walking effort. Use the EVA assessment to review mission safety and return reserves.');
  return {text:lines.join('\n'),sources:sources(model.result),tab:'hazards'};
 }
 return describe(model,question.type==='return');
}

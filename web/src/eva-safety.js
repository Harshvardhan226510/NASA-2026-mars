import {crewBudget} from './mission-planning.js';
import {COVERAGE,coverageCell} from './comms-model.js';
import {marsDistance} from './measurement-geometry.js';
import {routeProjection} from './route-geometry.js';
import {firstReturnBreach} from './return-feasibility.js';

const quantity=(n,unit)=>Number.isFinite(n)?`${Number(n.toFixed(2))} ${unit}`:'unknown';
const states={pass:'GO',caution:'CAUTION',stop:'NO-GO'};
const check=(name,status,evidence,action=null)=>({name,status,evidence,action});

function terrainCheck(result,route,back,analysis,pendingReports){
 const terrain=result.metadata.source,source=`${terrain?.label??'Unknown terrain source'} · source ≈${quantity(terrain?.sample_m,'m')} · ${quantity(result.metadata.grid_spacing_m,'m')} cells`;
 if(pendingReports)return check('Terrain & obstacles','caution','Active field reports differ from the exclusions in the current route.','Recalculate to apply current obstacle reports.');
 const all=[['Outward',route],...(back?[['Return',back]]:[])];
 const failed=all.find(([,r])=>r?.status!=='success');
 if(failed)return check('Terrain & obstacles','stop',`${failed[0]} route · ${failed[1]?.reason??'No complete route was returned.'} ${source}.`,'Move the endpoints or stations, or choose a window with measured terrain.');
 const over=all.find(([,r])=>r.validation?.cliff_traverse||r.validation?.max_sampled_slope_deg>result.metadata.max_slope_deg);
 if(over)return check('Terrain & obstacles','stop',`${over[0]} route reaches ${quantity(over[1].validation.max_sampled_slope_deg,'°')} against the ${quantity(result.metadata.max_slope_deg,'°')} slope limit. ${source}.`,'Disable slope fallback and choose a route within the selected limit.');
 const gaps=(analysis?.audits??[]).flatMap(a=>a.segments).filter(s=>s.state!=='sampled').length;
 if(!analysis?.audits?.length||gaps||all.some(([,r])=>!r.validation?.corridor_checked))return check('Terrain & obstacles','caution',`${gaps?gaps+' coverage segment(s) with sparse or missing heights. ':'Terrain coverage needs verification. '}${source}.`,'Review Coverage and recalculate on the finest available measured DEM.');
 const peak=Math.max(...all.map(([,r])=>r.validation.max_sampled_slope_deg));
 return check('Terrain & obstacles','pass',`Maximum modeled slope ${quantity(peak,'°')} against ${quantity(result.metadata.max_slope_deg,'°')}. ${source}.`);
}

function budgetChecks(budget,crew,roundTrip){
 const result=[['time','Mission duration','min'],['oxygen','Oxygen reserve','L'],['energy','Metabolic energy reserve','kJ']].map(([key,label,unit])=>{
  const value=budget?.checks[key];
  if(value?.status==='over')return check(label,'stop',`Projected use ${quantity(value.total,unit)} exceeds ${quantity(value.usable,unit)} available after the ${value.reserve_pct}% reserve.`,'Shorten the route or station work, or verify and update the allocation.');
  if(value?.status!=='within')return check(label,'caution',value?.status==='not_set'?'The mission allocation is blank.':'A complete schedule and prior consumption are needed.','Review Budget assumptions & reserves and recalculate any missing legs.');
  return check(label,'pass',`${quantity(value.remaining,unit)} above the configured reserve after the planned mission.`);
 });
 if(crew.length){
  const estimates=crewBudget(crew,budget,{roundTrip}),resources=estimates.flatMap((estimate,i)=>estimate.resources.map(r=>({...r,person:i+1})));
  const shortages=resources.filter(r=>r.remaining!==null&&r.remaining<0);
  if(shortages.length)result.push(check('Crew suit supplies','stop',shortages.map(r=>`Crew ${r.person} · ${r.label} is short by ${quantity(-r.remaining,'').trim()}`).join('. '),'Shorten the plan or verify the failing crew member’s usable supplies and consumption rates.'));
  else if(!estimates.length||estimates.some(r=>!r.complete))result.push(check('Crew suit supplies','caution','One or more crew supply or rate estimates are missing.','Complete the crew entries in Field navigation.'));
  else result.push(check('Crew suit supplies','pass',`Entered usable supplies cover the schedule for ${crew.length} crew member(s).`));
 }
 return result;
}

function sunlightCheck(points,limit){
 const below=points.filter(p=>Number.isFinite(p.solar_elevation_deg)&&(p.solar_elevation_deg<limit||(limit>=0&&['night','local_shade'].includes(p.light))));
 const unknown=points.filter(p=>!Number.isFinite(p.solar_elevation_deg)||limit>=0&&!['night','local_shade','no_local_shadow'].includes(p.light));
 if(below.length){
  const first=below[0],lighting=first.light==='local_shade'?'modeled terrain shade':`Sun ${quantity(first.solar_elevation_deg,'°')}`;
  return check('Sunlight','stop',`${below.length} of ${points.length} samples breach the ${quantity(limit,'°')} solar or terrain daylight requirement. First at ${first.leg} ${quantity(first.distance_m,'m')} · ${lighting}.`,'Change the departure time, shorten the traverse or choose a better-lit route.');
 }
 if(!points.length||unknown.length)return check('Sunlight','caution',points.length?`${unknown.length} terrain-lighting samples are unresolved.`:'No dated route samples are available.','Check the departure in Conditions and recalculate the terrain analysis.');
 return check('Sunlight','pass',`${points.length} scheduled samples meet the configured ${quantity(limit,'°')} minimum.`);
}

function commsCheck(analysis,receiver,config,radio){
 const points=analysis?.points??[];
 const visibility=points.map(p=>p.visibility?.state??'unknown');
 const blocked=visibility.filter(s=>s==='blocked').length;
 if(blocked)return check('Communications','stop',`Terrain blocks the direct path to the mission receiver at ${blocked} of ${points.length} sampled positions.`,'Move or raise the receiver, add a relay, or reroute around the gap.');
 const matching=radio?.result&&receiver&&marsDistance(receiver,radio.point)<=1&&radio.settings.towerHeight===config.receiver_height_m&&radio.settings.receiverHeight===config.walker_height_m;
 if(!matching||!points.length||!config.comms)return check('Communications','caution',`${visibility.filter(s=>s==='clear').length} of ${points.length} direct terrain rays sampled clear. Matching radio coverage is unverified.`,'Calculate the coverage simulator for the mission receiver and match both antenna heights in Comms.');
 const project=routeProjection(radio.result.center).forward;
 const hits=points.map(p=>coverageCell(radio.result,project([p.lon,p.lat])));
 const weak=hits.filter(p=>p&&[COVERAGE.blocked.id,COVERAGE.weak.id].includes(p.id));
 const basis=`${quantity(radio.settings.frequency,'MHz')} · required link margin ${quantity(radio.settings.reserve,'dB')} · ≈${quantity(radio.result.cell,'m')} coverage cells`;
 if(weak.length)return check('Communications','stop',`${weak.length} of ${hits.length} sampled positions are terrain-blocked or below the required radio margin. ${basis}.`,'Move or raise the tower, configure a relay, or change the route and recalculate coverage.');
 const incomplete=hits.filter(hit=>hit?.id!==COVERAGE.covered.id).length;
 if(incomplete||visibility.includes('unknown'))return check('Communications','caution',`${incomplete} of ${hits.length} radio samples are marginal, unknown or outside the simulation. ${visibility.filter(s=>s==='unknown').length} terrain rays are unresolved. ${basis}.`,'Extend the coverage area, add a relay or choose a route with modeled clearance.');
 return check('Communications','pass',`${hits.length} sampled positions meet the simulated tower-to-crew link criteria. ${basis}.`);
}

function scienceCheck(budget){
 const stations=(budget?.stations??[]).filter(t=>t.status==='planned');
 if(!stations.length)return check('Science readiness','pass','This route has no planned science stops.');
 const missed=stations.filter(t=>!t.reached),unready=stations.filter(t=>!t.equipment_ready||!t.source||!t.question||!t.expected);
 if(missed.length)return check('Science readiness','stop',`The route misses planned station(s) ${missed.map(t=>t.name).join(', ')}.`,'Use a profile that reaches each required station, or revise the science plan.');
 if(unready.length)return check('Science readiness','caution',`Evidence, task details or equipment confirmation is missing at ${unready.map(t=>t.name).join(', ')}.`,'Review Stations, verify the published or local evidence, and confirm the required equipment.');
 return check('Science readiness','pass',`${stations.length} planned stations reached, with supporting sources, defined tasks and confirmed equipment.`);
}

function returnCheck(config,back,returns,pending){
 if(!config.round_trip)return check('Return feasibility','caution','The current plan is outward only.','Enable round trip and select a return point.');
 if(back?.status==='failed')return check('Return feasibility','stop',back.reason??'No route from the destination to the return point was found.','Change the destination or the return point and recalculate.');
 if(pending||!returns.outward.length)return check('Return feasibility','caution','Current terrain and position-by-position margins are unavailable.','Recalculate the round trip and enter the resource allocations.');
 const outward=firstReturnBreach(returns.outward),breach=outward??firstReturnBreach(returns.return);
 const positions=[...returns.outward,...returns.return],risky=positions.filter(p=>p.status==='conditional'||p.status==='unknown').length;
 if(breach){
  const failure=breach.sample.margins.find(m=>m.best!==null&&m.best<-.00001);
  const evidence=failure?` ${failure.label} is short by ${quantity(-failure.best,failure.unit).trim()} even at the configured daylight speed.`:'';
  return check('Return feasibility','stop',`First modeled ${breach.sample.status==='blocked'?'path failure':'reserve breach'} at ${quantity(breach.sample.distance_m,'m')} along the ${outward?'outward':'return'} leg.${evidence}`,'Review Return safety and shorten the traverse or reduce planned work.');
 }
 if(!back||risky)return check('Return feasibility','caution',`${risky} of ${positions.length} position checks depend on travel speed or missing inputs.`,'Inspect the margins in Return safety and revise the plan or inputs.');
 return check('Return feasibility','pass',`All ${positions.length} sampled positions can return within the modeled reserve limits.`);
}

export function assessEvaSafety({result,profile,budget,analysis,config,pendingReports=false,returns={outward:[],return:[]},crew=[],receiver,radio,currentReturn}){
 const route=result?.routes[profile],back=config.round_trip?result?.return_route:null;
 if(!result||!budget)return {verdict:'CAUTION',checks:[check('Mission setup','caution','A calculated route and schedule are needed.','Place both endpoints and calculate a round trip.')]};
 const checks=[terrainCheck(result,route,back,analysis,pendingReports),...budgetChecks(budget,crew,config.round_trip),
  sunlightCheck(analysis?.points??budget.conditions??[],config.safety_min_sun_deg),commsCheck(analysis,receiver,config,radio),scienceCheck(budget),
  returnCheck(config,back,returns,pendingReports)];
 if(currentReturn){
  const state=currentReturn.status;
  if(state==='within')checks.push(check('Return from latest fix','pass','The reported position has a modeled return within the entered or projected reserves.'));
  else if(state==='blocked'||state==='over'){
   const margin=currentReturn.margins.find(m=>m.best!==null&&m.best<-.00001);
   const evidence=margin?`${margin.label} is short by ${quantity(-margin.best,margin.unit).trim()}.`:'The model cannot establish a return path from the reported position.';
   checks.push(check('Return from latest fix','stop',evidence,'Review the reported position and use the Return safety panel to assess the return before continuing.'));
  }else checks.push(check('Return from latest fix','caution',currentReturn.positionUncertain?'The reported uncertainty crosses return zones.':'The return depends on travel speed or has missing inputs.','Verify the position and remaining resources, then inspect Return safety.'));
 }
 if(!config.assumptions_reviewed)checks.push(check('Scenario assumptions','caution','The current planning assumptions have not been confirmed.','Review the allocations and assumptions in the Mission tab.'));
 const status=checks.some(c=>c.status==='stop')?'stop':checks.some(c=>c.status==='caution')?'caution':'pass';
 return {verdict:states[status],checks};
}

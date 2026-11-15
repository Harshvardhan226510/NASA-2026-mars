import {EVA_SCENARIOS} from './eva-scenarios.js';
import {CREW_RESOURCES,crewBudget,MISSION_REFERENCES} from './mission-planning.js';
import {routeCenter,routeProjection} from './route-geometry.js';
import {gridSampler,UNSUPPORTED_HAZARDS} from './mission-terrain.js';
import {coordinateText} from './surface-readout.js';
import {firstReturnBreach} from './return-feasibility.js';
import {action,el,fmt,sourceLink} from './eva-tools-ui.js';
import {HAZARD_STATES} from './eva-hazards.js';

const profileNames={direct_safe:'Direct safe',apf_survey:'APF survey',deep_science:'Deep science'};
const labels={time:['Time','min'],oxygen:['Oxygen equivalent','L'],energy:['Metabolic energy','kJ']};
const row=(table,tag,values)=>{
 const tr=el('tr');for(const item of values)tr.append(el(tag,item));table.append(tr);
};
function table(head,rows){
 const table=el('table'),header=el('thead'),body=el('tbody');
 row(header,'th',head);for(const values of rows)row(body,'td',values);
 table.append(header,body);return table;
}
const routePoints=route=>(route?.terrain_profile?.samples??route?.waypoints??[]).map(p=>[p.lon,p.lat]);

function mapFigure(result,route,stations,grid,obstacles,breach){
 const outbound=routePoints(route),back=routePoints(result.return_route);
 const pins=[[result.start,'A'],[result.goal,'B'],...(result.return_to?[[result.return_to,'R']]:[]),...stations.map((s,i)=>[s.point,String(i+1)]),...(breach?[[breach.sample.point,'T']]:[])];
 const positions=[...outbound,...back,...pins.map(([p])=>p)],projection=routeProjection(grid?.center??routeCenter(positions));
 const xs=[],ys=[];
 for(const point of positions){const [x,y]=projection.forward(point);xs.push(x);ys.push(y);}
 const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 const width=780,height=380,pad=34,scale=Math.min((width-2*pad)/Math.max(100,x1-x0),(height-2*pad)/Math.max(100,y1-y0));
 const xm=(x0+x1)/2,ym=(y0+y1)/2;
 const pixel=point=>{const [x,y]=projection.forward(point);return [width/2+(x-xm)*scale,height/2-(y-ym)*scale];};
 const canvas=el('canvas');canvas.width=width;canvas.height=height;
 canvas.setAttribute('aria-label','Projected north-up map of the expedition and return with waypoints');
 const ctx=canvas.getContext('2d');ctx.fillStyle='#e8edf0';ctx.fillRect(0,0,width,height);
 if(grid){
  const sample=gridSampler(grid),step=Math.max(grid.resolution_meters,5),delta=6;
  for(let y=0;y<height;y+=delta)for(let x=0;x<width;x+=delta){
   const local=[xm+(x-width/2)/scale,ym-(y-height/2)/scale];
   const h=sample(...projection.inverse(local)),east=sample(...projection.inverse([local[0]+step,local[1]])),north=sample(...projection.inverse([local[0],local[1]+step]));
   if(![h,east,north].every(Number.isFinite))continue;
   const slope=((east-h)-(north-h))/step;
   const grey=Math.round(216+22*Math.max(-1,Math.min(1,slope*2)));
   ctx.fillStyle=`rgb(${grey},${grey-4},${grey-8})`;ctx.fillRect(x,y,delta,delta);
  }
 }
 function line(points,color,dashes){
  if(points.length<2)return;
  ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=3.5;ctx.setLineDash(dashes);
  points.forEach((point,i)=>{const [x,y]=pixel(point);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
  ctx.stroke();ctx.setLineDash([]);
 }
 line(outbound,'#17644c',[]);line(back,'#763e91',[8,6]);
 ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const obstacle of obstacles){
  let x,y;try{[x,y]=pixel(obstacle.point);}catch{continue;}
  const radius=Math.max(4,obstacle.radius_m*scale);
  if(x<-radius||x>width+radius||y<-radius||y>height+radius)continue;
  ctx.beginPath();ctx.arc(x,y,radius,0,2*Math.PI);ctx.fillStyle='#e79c8e';ctx.fill();ctx.strokeStyle='#ab413b';ctx.lineWidth=1;ctx.stroke();
 }
 const drawn=[];
 for(const [point,label] of pins){
  const [x,y]=pixel(point);
  const overlaps=drawn.filter(p=>Math.hypot(x-p.x,y-p.y)<20).length;drawn.push({x,y});
  const py=y-21*overlaps;
  ctx.beginPath();ctx.arc(x,py,9,0,Math.PI*2);ctx.fillStyle='#152936';ctx.fill();ctx.fillStyle='#fff';ctx.fillText(label,x,py);
  if(overlaps){ctx.beginPath();ctx.moveTo(x,py+9);ctx.lineTo(x,y-8);ctx.strokeStyle='#152936';ctx.lineWidth=1;ctx.stroke();}
 }
 ctx.fillStyle='#182a37';ctx.fillText('N',width-25,15);ctx.fillText('▲',width-25,28);
 const limit=132/scale,power=10**Math.floor(Math.log10(limit)),bar=[5,2,1].map(n=>n*power).find(n=>n<=limit)??power;
 ctx.fillRect(17,height-21,Math.max(1,bar*scale),3);ctx.textAlign='left';ctx.fillText(fmt(bar,'m',0),17,height-32);
 const figure=el('figure',null,'eva-brief-map');
 figure.append(canvas,el('figcaption',`Green · outward | Dashed purple · return | A · start | B · destination | R · return point | numbers · stations${breach?' | T · first modeled return breach':''}. ${grid?'Relief from the loaded planning DEM.':'Route geometry from the saved mission.'}`));return figure;
}

export function previewMissionBrief(workbench){
 const w=workbench,{result}=w.host,{budget,state}=w;
 const route=result?.routes[state.profile];
 if(!result||!budget||!route?.waypoints?.length)throw Error('Calculate a route before generating a mission briefing.');
 const scenario=EVA_SCENARIOS.find(s=>s.id===state.guided),meta=result.metadata,source=meta.source??{},crew=state.crew??[];
 const stations=budget.stations,obstacles=state.logs.filter(e=>e.kind==='obstacle'&&e.active),breach=firstReturnBreach(w.returns?.outward??[]);
 const briefing=el('dialog',null,'eva-print eva-mission-brief');briefing.setAttribute('aria-label','EVA mission briefing');
 const tools=el('div');tools.append(action('Close preview',()=>briefing.close()),action('Print / save as PDF',()=>window.print()));
 briefing.append(tools,el('p','PYXIS · EVA MISSION BRIEFING','eva-brief-kicker'),el('h1',scenario?.name??'Marswalk mission'),el('p',scenario?.objective??state.config.scenario));
 if(scenario?.evidence)briefing.append(el('p',scenario.evidence));
 briefing.append(el('p',`${profileNames[state.profile]} · departure ${budget.departure} · modeled finish ${budget.return_at??'unknown'} · assessment ${w.assessment?.verdict??'CAUTION'}.`));
 briefing.append(mapFigure(result,route,stations,w.resultId===meta.mission_id?w.grid:null,obstacles,breach));
 const waypoints=[['A · Start',result.start],...stations.map((s,i)=>[`${i+1} · ${s.name}`,s.point]),['B · Destination',result.goal],...(result.return_to?[['R · Return point',result.return_to]]:[])];
 briefing.append(el('h2','Route and waypoints'),
  el('p',`Outward ${fmt(route.summary?.total_distance_km,'km',2)} · planned return ${fmt(result.return_route?.summary?.total_distance_km,'km',2)} · modeled slope limit ${fmt(meta.max_slope_deg,'°')}.`),
  table(['Waypoint','Coordinates'],waypoints.map(([label,point])=>[label,coordinateText(point)])));
 const resources=Object.entries(budget.checks).map(([key,check])=>[labels[key][0],fmt(check.total,labels[key][1]),fmt(check.usable,labels[key][1]),fmt(check.remaining,labels[key][1])]);
 briefing.append(el('h2','Crew resources and timing'),table(['Per-explorer allocation','Projected use','Usable after reserve','Margin'],resources),
  table(['Activity','Minutes','O₂ equiv.','Metabolic energy'],Object.entries(budget.totals).map(([key,value])=>[key,fmt(value.minutes),fmt(value.oxygen_l,'L'),fmt(value.energy_kj,'kJ')])));
 const estimates=crewBudget(crew,budget,{roundTrip:state.config.round_trip});
 if(crew.length)briefing.append(table(['Crew and supply','Usable entered','Use per hour','Projected left'],
  crew.flatMap((person,index)=>CREW_RESOURCES.map(([key,label],i)=>[
   `Crew ${index+1} · ${label}`,fmt(person[key+'_remaining']),fmt(person[key+'_rate']),fmt(estimates[index]?.resources[i]?.remaining)
  ]))));
 briefing.append(el('h2','Scientific objectives and field tasks'));
 if(!stations.length)briefing.append(el('p','No science station is included in this plan.'));
 for(const [i,s] of stations.entries()){
  const card=el('section',null,'eva-brief-station');
  card.append(el('h3',`${i+1}. ${s.name}`),el('p',`${s.question} · ${fmt(s.minutes,'min')} · ${s.reached?'route reaches station':'station outside planned corridor'}`),el('p',`Equipment · ${s.equipment} · ${s.equipment_ready?'confirmed':'unconfirmed'}`),el('p',`Expected record · ${s.expected}`));
  briefing.append(card);
 }
 briefing.append(el('h2','Return contingencies and hazards'),
  el('p',breach?`First modeled return breach at ${fmt(breach.sample.distance_m,'m')} outward. Turnaround planning should use the last evaluated sample within reserves, ${fmt(breach.lastWithin?.distance_m,'m')}.`:
   w.returns?.outward?.length?'Review Return safety for speed-dependent and unknown portions of the route.':'Recalculate on the loaded grid to obtain position-by-position return limits.'),
  el('p',`Terrain · ${source.label??'unknown source'} · ≈${fmt(source.sample_m,'m')} source sampling · ${fmt(meta.grid_spacing_m,'m')} planning cells.`));
 for(const check of w.assessment?.checks??[])briefing.append(el('p',`${check.name} · ${check.evidence}${check.action?' '+check.action:''}`));
 const hazardRows=['outward','return'].flatMap(leg=>(w.hazards?.results(leg).segments??[]).filter(s=>s.state!=='open')
  .sort((a,b)=>Number(b.state==='blocked')-Number(a.state==='blocked')||(b.intensity??0)-(a.intensity??0)).slice(0,4).map(s=>[leg,`${fmt(s.from,'m')}–${fmt(s.to,'m')}`,HAZARD_STATES[s.state].label,fmt(s.slope,'°'),fmt(s.intensity,'J/m')]));
 if(hazardRows.length)briefing.append(table(['Leg','Route interval','Condition','Slope','Modeled cost'],hazardRows));
 for(const obstacle of obstacles)briefing.append(el('p',`Obstacle report · ${coordinateText(obstacle.point)} · ${fmt(obstacle.radius_m,'m')} radius · ${obstacle.note}`));
 briefing.append(el('p',`Remaining uncertainties include ${UNSUPPORTED_HAZARDS.join(', ')}. Review lost-link and blocked-passage responses in Mission replay.`));
 const sources=new Map();
 const add=(label,url)=>{if(/^https?:\/\//.test(url??''))sources.set(url,label);};
 add(source.label,source.url??(source.kind==='global'?'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m':null));
 add('NASA Mars24 solar geometry',MISSION_REFERENCES.solar);add('NASA spacesuit planning context',MISSION_REFERENCES.lifeSupport);add('NASA Mars radio propagation',MISSION_REFERENCES.radio);
 if(scenario?.source)add(scenario.source.title,scenario.source.url);
 for(const station of stations)add(station.source?.title,station.source?.url);
 briefing.append(el('h2','Sources and provenance'));
 for(const [url,label] of sources){const source=el('p');source.append(sourceLink(label,url),' · ',url);briefing.append(source);}
 briefing.append(el('p','Generated from the current Pyxis mission scenario. Record field verification, operator approval and actual crew status before use.'));
 briefing.addEventListener('close',()=>briefing.remove(),{once:true});document.body.append(briefing);briefing.showModal();
}

import {EVA_SCENARIOS,scenarioTargets} from './eva-scenarios.js';
import {CREW_RESOURCES,crewBudget,scienceTask,validateCrew} from './mission-planning.js';
import {routeProfile} from './route-profile.js';
import {heading,routeFix} from './eva-navigation.js';
import {RETURN_STATES} from './return-feasibility.js';
import './eva-workflow.css';

function element(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,action,cls){const b=element('button',text,cls);b.type='button';b.onclick=action;return b;}
function sourceLink(source){const a=element('a',source.title+' ↗');a.href=source.url;a.target='_blank';a.rel='noopener';return a;}
const metres=v=>v>=1000?`${(v/1000).toFixed(2)} km`:`${Math.round(v)} m`;
const number=(v,suffix='')=>Number.isFinite(v)?`${Number(v.toFixed(1))}${suffix}`:'—';
const field=(label,name,{min,max,value='',required=false}={})=>{
 const l=element('label',label),i=element('input');Object.assign(i,{type:'number',name,step:'any',min,max,value,required});l.append(i);return l;
};

export class EvaWorkflow{
 constructor(workbench){
  this.workbench=workbench;this.host=workbench.host;
  const guided=document.getElementById('walk-guided');guided.append(element('h3','Guided EVAs'),element('p','Choose a research objective. Load its proposed traverse, then calculate it on the available Mars elevation grid.','walk-note'));
  this.scenarios=EVA_SCENARIOS.map(scenario=>{
   const card=element('article',null,'eva-card'),load=button('Load EVA plan',()=>this.load(scenario),'primary');
   card.append(element('small',scenario.region),element('h4',scenario.name),element('p',scenario.objective),element('p',scenario.evidence,'walk-note'),sourceLink(scenario.source),load);guided.append(card);return {scenario,load};
  });
  const root=document.getElementById('walk-field');root.append(element('h3','Field navigation'),element('p','Enter a reported Mars position or use the map crosshair as a simulated fix.','walk-note'));
  this.evidence=element('div',null,'eva-evidence');root.append(this.evidence);
  this.controls=element('form');this.controls.innerHTML='<label>Route leg<select name="leg"><option value="outward">Outward</option><option value="return">Return</option></select></label>';
  const position=element('div',null,'walk-grid');position.append(field('Latitude','lat',{min:-90,max:90,required:true}),field('Longitude °E','lon',{min:-180,max:180,required:true}));
  this.controls.append(position,field('Reported position uncertainty · m','accuracy',{min:1,max:10000,value:25,required:true}));
  const consumption=element('details');consumption.append(element('summary','Use entered resource consumption'),element('p','Optional. Enter all three values consumed since this plan’s departure. Any earlier use stays in Budget assumptions & reserves. Leave all blank for a schedule-based estimate.','walk-note'));
  consumption.append(field('Elapsed since departure · min','fix_time',{min:0,max:10000}),field('O₂ consumed · equivalent L','fix_oxygen',{min:0,max:100000}),field('Metabolic energy expended · kJ','fix_energy',{min:0,max:1000000}));
  this.controls.append(consumption);
  this.controls.elements.leg.onchange=()=>{this.fix=null;this.renderField();};
  this.controls.onsubmit=e=>{e.preventDefault();const input=this.controls.elements;this.record([input.lon.valueAsNumber,input.lat.valueAsNumber],input.accuracy.valueAsNumber,false);};
  const submit=element('button','Record position fix','primary');submit.type='submit';this.controls.append(submit,button('Simulate from crosshair',()=>{
   const point=this.host.centre();if(!point){workbench.message('Move the crosshair onto the surface first.');return;}
   const input=this.controls.elements;input.lon.value=point[0].toFixed(6);input.lat.value=point[1].toFixed(6);if(input.accuracy.reportValidity())this.record(point,input.accuracy.valueAsNumber,true);
  }));
  this.readout=element('div',null,'eva-field-readout');this.readout.setAttribute('role','status');
  this.visor=element('dialog',null,'eva-visor');this.visor.setAttribute('aria-label','Field visor');
  this.visorBody=element('div',null,'eva-field-readout');this.visorBody.setAttribute('role','status');
  this.visor.append(button('Close visor',()=>this.visor.close()),element('h2','Field visor'),this.visorBody,button('Back to position controls',()=>this.visor.close()));document.body.append(this.visor);
  this.openVisor=button('Open field visor',()=>{this.syncVisor();this.visor.showModal();});
  this.exports=element('div',null,'eva-actions');this.replay=this.buildReplay();
  const brief=button('Open EVA mission briefing',()=>this.workbench.openBriefing()),checklist=button('Preview field checklist',()=>this.checklist()),stl=button('Export terrain STL',async()=>{
   try{const {saveTerrainSTL}=await import('./eva-print.js');saveTerrainSTL(workbench.grid,this.host.result.routes[workbench.state.profile]?.grid_path);}catch(e){workbench.message(e.message);}
  });
  this.stl=stl;this.check=checklist;this.brief=brief;this.exports.append(brief,checklist,stl);
  root.append(this.controls,this.readout,this.openVisor,button('Open return safety',()=>workbench.showTab('feasibility')),this.replay,this.exports);
  this.crew=element('details');this.crew.append(element('summary','Crew suit consumables'),element('p','Enter each crew member’s usable supply and hourly rates for this scenario. The estimate uses the scheduled duration. Scrubber rates express rated hours used per elapsed hour.','walk-note'));
  this.crewFields=element('div');this.crewStats=element('div');this.crew.append(this.crewFields,this.crewStats);root.append(this.crew);
 }

 load(scenario){
  const host=this.host,w=this.workbench,replace=host.start||host.goal||w.state.logs.length;
  if(replace&&!window.confirm('Load this EVA and replace the current route, station tasks and field log? You can save the current mission first to keep a copy.'))return;
  const targets=scenarioTargets(scenario);
  const tasks=Object.fromEntries(targets.map((target,i)=>[target.id,{...scienceTask(target),...scenario.stops[i],id:target.id,source:scenario.source,evidence:scenario.evidence,coordinateNote:'Proposed survey position in the documented area. Confirm the actual target visually.'}]));
  const next={...w.state,profile:'deep_science',guided:scenario.id,evaReturn:[...scenario.start],tasks,logs:[],analysis:null,climate:null,crew:[]};
  next.config={...next.config,round_trip:true,receiver_point:null,prior_usage_known:true,assumptions_reviewed:false,used_time_min:0,used_oxygen_l:0,used_energy_kj:0,scenario:`Guided EVA · ${scenario.name}`};
  // A preset is a local round trip. The declared camp stays available separately.
  host.cancel();host.start=[...scenario.start];host.goal=[...scenario.goal];host.targets=targets;host.siteSettings={...host.siteSettings,enabled:false};host.picking=null;host.renderPicking();
  document.getElementById('route-terrain').value='auto';
  Object.assign(w.state,next);w.tab='plan';this.fix=null;host.dirty();host.fit();w.changed();
  w.message('Guided EVA loaded. Calculate the route on measured terrain.');
 }

 samples(leg=this.controls.elements.leg.value){
  const result=this.host.result,route=leg==='return'?result?.return_route:result?.routes[this.workbench.state.profile];
  return route?.status==='success'?routeProfile(route,result.metadata).samples:[];
 }

 record(point,accuracy,simulated){
  const samples=this.samples();if(samples.length<2){this.workbench.message('Calculate a successful route for this leg first.');return;}
  try{
   const next=routeFix(samples,point,accuracy,this.fix);
   const fields=['time','oxygen','energy'].map(key=>[key,this.controls.elements['fix_'+key]]);
   const entered=fields.some(([,input])=>input.value!=='');
   if(entered&&fields.some(([,input])=>input.value===''||!input.reportValidity()))throw Error('Enter elapsed time, oxygen and energy use together, or leave all three blank.');
   const actual=entered?{...Object.fromEntries(fields.map(([key,input])=>[key,input.valueAsNumber])),active:null}:null;
   const consumption=actual?` Entered use since departure · ${actual.time} min · ${actual.oxygen} L O₂ · ${actual.energy} kJ.`:'';
   const leg=this.controls.elements.leg.value;
   this.workbench.addLog({kind:'position',point,at:new Date().toISOString(),note:`${simulated?'Simulated crosshair position':'User-entered position'} · uncertainty ${metres(accuracy)} · ${leg} route · ${metres(next.separation)} from route.${consumption}`});
   for(const [,input] of fields)input.value='';
   this.fix=next;this.workbench.returnSafety.setFix(next,leg,actual);this.renderField();
   this.host.highlightSample({lon:point[0],lat:point[1]},next.offRoute?'#f0bd60':'#78d7a3');
   this.workbench.message('Position fix saved to the field log.');
  }catch(error){this.workbench.message(error.message);}
 }

 buildReplay(){
  const box=element('details');box.append(element('summary','Preview the route on the map'));
  this.slider=element('input');Object.assign(this.slider,{type:'range',min:0,max:1000,value:0,step:1});this.slider.setAttribute('aria-label','Route rehearsal progress');
  this.replayStatus=element('p',null,'walk-note');
  this.slider.oninput=()=>this.preview();
  this.play=button('Play route',()=>{
   if(this.frame){this.stop();return;}
   const start=performance.now(),initial=Number(this.slider.value)===1000?0:Number(this.slider.value);
   const tick=now=>{
    this.frame=null;if(this.workbench.root.hidden||this.workbench.tab!=='field'){this.stop();return;}
    this.slider.value=Math.min(1000,initial+(now-start)/25);if(now-(this.lastReplayFrame??0)>45||Number(this.slider.value)===1000){this.lastReplayFrame=now;this.preview();}
    if(Number(this.slider.value)<1000)this.frame=requestAnimationFrame(tick);else this.stop();
   };
   this.play.textContent='Pause route';this.frame=requestAnimationFrame(tick);
  });
  this.follow=element('input');this.follow.type='checkbox';const follow=element('label','Follow with the 3D camera','walk-check');follow.prepend(this.follow);
  box.append(this.slider,this.replayStatus,follow,this.play);box.ontoggle=()=>{if(!box.open)this.stop();};return box;
 }

 preview(){
  const samples=this.samples(),last=samples.at(-1);if(samples.length<2)return;
  const target=last.distance_m*Number(this.slider.value)/1000;
  const end=Math.max(1,samples.findIndex(p=>p.distance_m>=target)),a=samples[end-1],b=samples[end];
  const ratio=(target-a.distance_m)/(b.distance_m-a.distance_m||1),delta=((b.lon-a.lon+540)%360)-180;
  const p={lon:((a.lon+delta*ratio+540)%360)-180,lat:a.lat+(b.lat-a.lat)*ratio};
  const returnCheck=this.workbench.returnSafety.preview(this.controls.elements.leg.value,[p.lon,p.lat],target),status=RETURN_STATES[returnCheck?.status];
  this.host.highlightSample(p,status?.color??'#73cde3');this.replayStatus.textContent=`Rehearsal · ${metres(target)} of ${metres(last.distance_m)}${status?' · Return '+status.label.toLowerCase():''}`;
  if(this.follow.checked&&this.host.view()!=='2d'&&performance.now()-(this.lastFollow??0)>140){
   this.lastFollow=performance.now();const C=window.Cesium,viewer=this.host.viewer,camera=viewer.camera,ellipsoid=viewer.scene.globe.ellipsoid;
   const where=C.Cartographic.fromDegrees(p.lon,p.lat),alt=viewer.scene.globe.getHeight(where)??a.elevation_m??0,focus=C.Cartesian3.fromDegrees(p.lon,p.lat,alt,ellipsoid);
   camera.cancelFlight();camera.lookAt(focus,new C.HeadingPitchRange(C.Math.toRadians(heading([a.lon,a.lat],[b.lon,b.lat])),-.85,1800));camera.lookAtTransform(C.Matrix4.IDENTITY);viewer.scene.requestRender();
  }
 }

 stop(){if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;this.play.textContent='Play route';}

 renderField(){
  const w=this.workbench,signature=`${this.host.result?.metadata?.mission_id??''}/${w.state.profile}/${this.controls.elements.leg.value}`;
  if(this.routeResult!==this.host.result||this.signature!==signature){this.routeResult=this.host.result;this.signature=signature;this.fix=null;this.slider.value=0;this.stop();}
  const samples=this.samples(),valid=samples.length>=2,fix=this.fix;
  for(const b of this.controls.querySelectorAll('button'))b.disabled=!valid;
  this.slider.disabled=this.play.disabled=this.openVisor.disabled=!valid;this.check.disabled=!this.host.result;this.brief.disabled=!this.host.result?.routes?.[w.state.profile]?.waypoints?.length;
  this.stl.disabled=!w.grid||w.resultId!==this.host.result?.metadata.mission_id;
  this.stl.title=this.stl.disabled?'Recalculate the route to load the elevation grid.':'Export a printable model with the selected route raised.';
  this.replayStatus.textContent=valid?`${metres(samples.at(-1).distance_m)} route · compressed playback`:'Calculate this route leg first.';
  this.readout.replaceChildren();
  if(!fix){this.readout.append(element('p',valid?'Enter a fix to see distance remaining, course and the next station.':'Calculate a route to begin field navigation.'));this.syncVisor();return;}
  const station=this.controls.elements.leg.value==='outward'?w.budget?.stations.find(t=>t.reached&&t.status==='planned'&&t.distance_m>=fix.distance-fix.accuracy):null;
  const ahead=samples.find(p=>p.distance_m>=fix.distance+Math.max(fix.accuracy,35))??samples.at(-1),target=fix.offRoute?fix.snapped:station?.point??[ahead.lon,ahead.lat];
  const caution=fix.offRoute?'Outside route corridor':fix.wrongWay>=3?'Recent fixes are moving back along this leg':'Within route corridor';
  this.readout.append(element('strong',caution),element('p',`${metres(fix.separation)} from route · ${metres(fix.remaining)} remaining along route · ${Math.round(heading(fix.position,target))%360}° ${fix.offRoute?'to the route':'bearing'}`));
  if(station)this.readout.append(element('p',`Next station — ${station.name}`),element('p',station.question,'walk-note'));
  else if(this.controls.elements.leg.value==='return')this.readout.append(element('p','Follow the independently planned return leg.','walk-note'));
  const leg=this.controls.elements.leg.value==='outward'?'outward':'return',planned=w.budget?.totals?.[leg]?.minutes;
  if(!fix.offRoute&&Number.isFinite(planned)&&samples.at(-1).distance_m>0)this.readout.append(element('p',`Estimated remaining travel · ${number(planned*fix.remaining/samples.at(-1).distance_m,' min')} at this plan’s average speed`,'walk-note'));
  const turn=this.workbench.returnSafety.currentFix();
  if(turn){
   const state=RETURN_STATES[turn.status],p=element('p',`Return to habitat · ${state.label}`);
   p.style.color=state.color;this.readout.append(p);
  }
  this.syncVisor();
 }

 syncVisor(){this.visorBody.replaceChildren(...[...this.readout.childNodes].map(n=>n.cloneNode(true)));}

 render(){
  const w=this.workbench,scenario=EVA_SCENARIOS.find(s=>s.id===w.state.guided);
  for(const entry of this.scenarios)entry.load.textContent=entry.scenario===scenario?'Reload EVA plan':'Load EVA plan';
  if(w.root.hidden||w.tab!=='field'){if(this.frame)this.stop();return;}
  if(this.evidenceId!==scenario?.id){
   this.evidenceId=scenario?.id;this.evidence.replaceChildren();
   if(scenario?.photo){
    const photo=scenario.photo,panel=element('details');panel.append(element('summary','Rover imagery & reference'));
    panel.ontoggle=()=>{
     if(!panel.open||panel.querySelector('figure'))return;
     const figure=element('figure'),image=element('img');image.src=photo.image;image.alt=photo.title;image.decoding='async';
     figure.append(image,element('figcaption',photo.credit),sourceLink(photo));panel.append(figure);
    };
    this.evidence.append(panel);
   }
  }
  this.renderField();this.renderCrew();
 }

 renderCrew(){
  const w=this.workbench,crew=w.state.crew??[],count=crew.length;
  if(this.count!==count){
   this.count=count;this.crewFields.replaceChildren();
   for(const [i,person] of crew.entries()){
    const group=element('fieldset');group.append(element('legend',`Crew ${i+1}`));
    for(const [key,label] of CREW_RESOURCES){
     const row=element('div',null,'walk-grid');
     for(const [type,text] of [['remaining','usable supply'],['rate','use per hour']]){
      const id=`${key}_${type}`,min=type==='rate'?0:.001,l=field(`${label} · ${text}`,id,{min,max:100000,value:person[id]??''}),input=l.firstElementChild;
      input.onchange=()=>{if(!input.reportValidity())return;const people=[...w.state.crew];people[i]={...people[i],[id]:input.value===''?null:input.valueAsNumber};w.state.crew=validateCrew(people);w.changed();this.renderCrew();};row.append(l);
     }
     group.append(row);
    }
    this.crewFields.append(group);
   }
   const change=offset=>{w.state.crew=validateCrew(offset>0?[...(w.state.crew??[]),{}]:(w.state.crew??[]).slice(0,-1));w.changed();this.renderCrew();};
   if(count<2)this.crewFields.append(button(count?'Add second crew member':'Enter suit supplies',()=>change(1)));
   if(count)this.crewFields.append(button('Remove last crew member',()=>change(-1)));
  }
  for(const [i,group] of [...this.crewFields.querySelectorAll('fieldset')].entries())for(const input of group.querySelectorAll('input'))if(document.activeElement!==input)input.value=crew[i][input.name]??'';
  const results=crewBudget(crew,w.budget,{roundTrip:w.state.config.round_trip});
  this.crewStats.replaceChildren();if(count&&!results.length)this.crewStats.append(element('p','A complete route schedule is needed for suit estimates.','walk-note'));
  for(const [i,model] of results.entries()){
   this.crewStats.append(element('h4',`Crew ${i+1} estimates`));
   for(const row of model.resources)this.crewStats.append(element('p',`${row.label} · ${number(row.used)} projected use · ${number(row.remaining)} remaining`,'walk-note'));
   if(model.limiting)this.crewStats.append(element('p',`${model.complete?'Limiting supply':'Tightest entered supply'}: ${model.limiting.label} · ${number(model.limiting.endurance,' min')} endurance`),element('p',Number.isFinite(model.limiting.turnback)?`Illustrative turnaround budget · ${number(model.limiting.turnback,' min')} of outward travel. Uses the average return/outward travel-time ratio and all scheduled stops and breaks.`:'Turnaround requires a timed outward and return route.','walk-note'));
  }
 }

 async checklist(){
  const {previewChecklist}=await import('./eva-print.js'),w=this.workbench,result=this.host.result;if(!result)return;
  const scenario=EVA_SCENARIOS.find(s=>s.id===w.state.guided),stations=w.budget?.stations??[],route=result.routes[w.state.profile],back=result.return_route;
  const distance=r=>Number.isFinite(r?.summary?.total_distance_km)?`${r.summary.total_distance_km} km`:'distance unavailable';
  previewChecklist({title:scenario?.name??'Pyxis Marswalk',summary:scenario?.objective??`Departure ${w.state.config.departure}`,source:`Terrain — ${result.metadata.source?.label??'unknown'} · search spacing ${result.metadata.grid_spacing_m} m`,stations,route:[`Review outward route geometry (${distance(route)}).`,`Verify return destination and route (${distance(back)}).`,'Enter supplies and confirm communications.','Review active obstacles, terrain coverage and the limits of the elevation grid.',...(scenario?[`Science evidence — ${scenario.source.url}`]:[])]});
 }
}

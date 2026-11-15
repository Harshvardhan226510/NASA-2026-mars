import {decodeReturnField,RETURN_STATES} from './return-feasibility.js';
import {incidentPosition,replayFrame,replayOutcome,replayScenarios,replayTimeline} from './eva-replay-model.js';
import {action,el,field,fmt} from './eva-tools-ui.js';

const options={
 baseline:'Play through the scheduled outbound and return legs, including station time.',
 rover:'The failed pickup adds the configured wait at rest. Walking to the habitat replaces the assumed pickup.',
 passage:'A temporary exclusion appears on the planned corridor. The return region is recalculated on the same terrain with that passage blocked.',
 supplies:'At the incident, the selected percentage of remaining usable oxygen and entered suit supplies is lost.',
 radio:'Make the planned ground link unavailable. Return geometry and consumables remain physically available where the terrain and reserves allow.'
};
const values=(min,max,value)=>Object.assign(el('input'),{type:'number',min,max,value,step:1});

export class EvaReplayPanel{
 constructor(workbench,root){
  this.w=workbench;this.host=workbench.host;
  this.scenario=el('select');
  this.scenario.replaceChildren(...Object.entries(replayScenarios).map(([id,label])=>new Option(label,id)));
  this.scenario.onchange=()=>this.changeScenario();
  this.incident=values(1,99,40);this.incident.onchange=()=>{if(this.incident.reportValidity())this.changeScenario();};
  this.loss=values(5,95,30);this.wait=values(0,180,15);
  this.loss.onchange=this.wait.onchange=()=>this.update();
  this.track=Object.assign(el('input'),{type:'range',min:0,max:1000,value:0,step:1});this.track.oninput=()=>{this.stop();this.update();};
  this.play=action('Play rehearsal',()=>this.start());
  this.zoom=action('Zoom to expedition',()=>this.host.fit());
  this.overlay=Object.assign(el('input'),{type:'checkbox',checked:true});this.overlay.onchange=()=>this.update();
  this.hint=el('p',options.baseline,'walk-note');
  this.status=el('p',null,'walk-note');this.status.setAttribute('role','status');
  this.readout=el('div',null,'eva-field-readout');
  const actions=el('div',null,'eva-tool-actions');actions.append(this.play,action('Reset replay',()=>{this.stop();this.track.value=0;this.update();}),this.zoom);
  this.incidentField=field('Incident at mission progress · %',this.incident);
  this.lossField=field('Usable suit supply loss · %',this.loss);
  this.waitField=field('Wait before declaring failed pickup · min',this.wait);
  root.append(el('h3','Mission replay'),el('p','Rehearsal uses a copy of the planned timeline. The saved route and field log stay separate.','walk-note'),
   field('Rehearsal scenario',this.scenario),this.incidentField,this.lossField,this.waitField,this.hint,this.status,field('Mission replay progress',this.track),actions,field('Show modeled return region',this.overlay),this.readout);
  this.styleControls();
 }
 styleControls(){
  const scenario=this.scenario.value;
  this.incidentField.hidden=scenario==='baseline';this.lossField.hidden=scenario!=='supplies';this.waitField.hidden=scenario!=='rover';
  this.hint.textContent=options[scenario];
 }
 render(){
  if(this.w.tab!=='replay'||this.w.root.hidden){this.stop();return;}
  const {result}=this.host,{budget,state}=this.w;
  if(result!==this.result||budget!==this.budget){
   const reset=result!==this.result||this.profile!==state.profile;
   this.result=result;this.budget=budget;this.profile=state.profile;
   this.timeline=replayTimeline(result,budget,state.profile);
   if(reset){this.stop();this.track.value=0;}
   this.changeScenario();return;
  }
  this.update();
 }
 changeScenario(){
  this.styleControls();
  const {timeline}=this,c=this.w.state.config;
  this.incidentFrame=timeline?replayFrame(timeline,timeline.duration*Number(this.incident.value)/100,c.oxygen_loss_l_min):null;
  const grid=this.w.grid;
  const passage=this.scenario.value==='passage'&&this.incidentFrame&&grid?incidentPosition(timeline,this.incidentFrame,grid.resolution_meters):null;
  const key=passage?JSON.stringify([this.result?.metadata.mission_id,passage.point,passage.radius,this.w.obstacles()]):null;
  if(key!==this.fieldKey){
   this.controller?.abort();this.fieldKey=key;this.blockedField=null;this.error=null;this.controller=null;
   this.passage=passage;
   if(passage&&this.result?.return_to&&this.w.resultId===this.result.metadata.mission_id&&!this.w.pendingReports)this.loadBlockedField(grid,key);
  }
  this.update();
 }
 async loadBlockedField(grid,key){
  const controller=this.controller=new AbortController(),result=this.result;
  this.error=null;
  try{
   const obstacles=[...this.w.obstacles(),{id:'rehearsal-passage',point:this.passage.point,radius_m:this.passage.radius}];
   const {max_slope_deg,mass_kg,gravity_ratio}=result.metadata;
   const response=await fetch('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(120000)]),
    body:JSON.stringify({schema:'mars-route-request/1',grid,start:result.start,goal:result.goal,return_to:result.return_to,round_trip:true,return_field_only:true,
     obstacles,options:{max_slope_deg,mass_kg,gravity_ratio}})});
   const data=await response.json();
   if(!response.ok||data.schema!=='mars-return-field-result/1')throw Error(data.error??'The scenario return grid could not be generated.');
   const field=await decodeReturnField(data.return_field);
   if(!controller.signal.aborted&&this.fieldKey===key)this.blockedField=field;
  }catch(error){if(!controller.signal.aborted)this.error=error.message;}
  finally{
   if(this.controller===controller){this.controller=null;this.update();}
  }
 }
 start(){
  if(this.frame){this.stop();return;}
  if(!this.timeline)return;
  const initial=Number(this.track.value)>=1000?0:Number(this.track.value),started=performance.now();
  this.play.textContent='Pause rehearsal';
  const tick=now=>{
   if(this.w.root.hidden||this.w.tab!=='replay'){this.stop();return;}
   this.track.value=Math.min(1000,initial+(now-started)/45);
   if(now-(this.lastUpdate??0)>180||Number(this.track.value)===1000){this.lastUpdate=now;this.update();}
   if(Number(this.track.value)<1000)this.frame=requestAnimationFrame(tick);else this.stop();
  };
  this.frame=requestAnimationFrame(tick);
 }
 stop(){if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;this.play.textContent='Play rehearsal';}
 update(){
  const w=this.w,{timeline}=this;
  if(w.tab!=='replay'||w.root.hidden)return;
  this.track.disabled=this.play.disabled=this.zoom.disabled=!timeline;
  this.status.textContent=timeline?'':'Calculate a successful Marswalk route first.';
  this.readout.replaceChildren();
  this.mapState=null;
  if(!timeline){w.returnSafety.draw();return;}
  const config=w.state.config,crew=w.state.crew??[],time=timeline.duration*Number(this.track.value)/1000,frame=replayFrame(timeline,time,config.oxygen_loss_l_min);
  if(!frame.point){w.returnSafety.draw();return;}
  const scenario=this.scenario.value,blocked=scenario==='passage'&&time>=this.incidentFrame.time;
  const analysis=w.analysis?.points.filter(p=>p.leg===frame.leg)??[],sampled=analysis.find(p=>p.distance_m>=frame.distance)??analysis.at(-1);
  const field=w.pendingReports?null:blocked?this.blockedField:w.returnField;
  const outcome=replayOutcome(frame,{config,crew,field,scenario,incident:this.incidentFrame,lossPercent:Number(this.loss.value),
   pickupMinutes:Number(this.wait.value),passage:this.passage,visibility:sampled?.visibility?.state});
  if(scenario==='passage')this.status.textContent=this.error??(this.controller?'Calculating return routes around the simulated blockage…':
   this.passage?`Blockage placed ${fmt(this.passage.distance,'m')} along the ${this.passage.leg} leg · ${fmt(this.passage.radius,'m')} radius.`:'Recalculate the round trip in a larger measured window to place a separate blockage.');
  if(w.pendingReports)this.status.textContent='Recalculate the plan to apply new field obstacle reports.';
  const verdict=el('strong',outcome.verdict);
  verdict.style.color=outcome.verdict==='GO'?'#82dfba':outcome.verdict==='NO-GO'?'#ff958b':'#ffca78';
  const status=RETURN_STATES[outcome.sample.status];
  const decision=outcome.active&&scenario==='passage'?'Hold at the obstruction and check the detour or return region.':
   outcome.active&&scenario==='radio'?'Suspend the traverse while attempting to re-establish the planned radio link.':
   outcome.active&&scenario==='rover'?'Review the walking fallback to habitat.':
   outcome.verdict==='NO-GO'?'Review the limiting reserve or link before proceeding.':'Review the margins at the next station.';
  this.readout.append(verdict,el('p',`${frame.activity} · ${fmt(frame.distance,'m')} along ${frame.leg} · ${fmt(outcome.spent.time,'min')} elapsed`),
   el('p',`Consumed ${fmt(outcome.spent.oxygen,'L')} O₂ equivalent · ${fmt(outcome.spent.energy,'kJ')} metabolic energy`),
   el('p',`Return · ${status.label} · Communications ${outcome.comms} · ${outcome.active?'Incident active':'Planned conditions'}`),el('p',decision,'walk-note'));
  if(outcome.sample.slow)this.readout.append(el('p',`Walking fallback · ${fmt(outcome.sample.distance,'m')} · ${fmt(outcome.sample.day.time)}–${fmt(outcome.sample.slow.time,'min')} including breaks.`,'walk-note'));
  if(outcome.sample.margins.length){
   const margins=el('dl',null,'eva-return-margins');
   for(const {label,unit,worst} of outcome.sample.margins)margins.append(el('dt',label),el('dd',fmt(worst,unit)));
   this.readout.append(el('p','Conservative margin after returning','walk-note'),margins);
  }
  if(blocked)this.readout.append(el('p','The marker follows the original route for comparison. The colored region uses the blocked terrain grid.','walk-note'));
  this.mapState={field,sample:outcome.sample,limits:outcome.limits,config,
   obstacle:blocked?this.passage:null,show:this.overlay.checked};
  this.host.highlightSample({lon:frame.point[0],lat:frame.point[1]},status.color);
  if(!this.frame||performance.now()-(this.lastOverlay??0)>480||Number(this.track.value)===1000){this.lastOverlay=performance.now();w.returnSafety.draw();}
 }
}

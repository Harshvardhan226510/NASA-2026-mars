import {closeIcon} from './close-icon.js';
import {CommsOverlay} from './comms-overlay.js';
import {COMMS_FIELDS,COVERAGE,commsParameters,commsScenario,containsCoverage,coverageCell,coverageGrid,coverageStates,coverageWindow} from './comms-model.js';
import {coordinateText,normalizedPoint} from './surface-readout.js';
import {routeProjection} from './route-geometry.js';
import {routeTerrain} from './route-terrain.js';
import {clientPoint} from './view-focus.js';
import './comms-coverage.css';

const $=id=>document.getElementById(id);

export class CommsCoverage{
 constructor(host){
  this.host=host;this.settings=commsParameters();this.visible=true;
  const panel=this.panel=document.createElement('section');panel.id='comms-panel';panel.className='map-tool-panel ui-drawer';panel.hidden=true;panel.setAttribute('aria-labelledby','comms-title');
  panel.innerHTML=`<button id="comms-close" class="tool-close" type="button" aria-label="Close communications coverage">${closeIcon}</button>
   <h2 id="comms-title">Communications coverage</h2>
   <p>Place a tower, then drag it to test a different site. The map recalculates when you release it.</p>
   <div class="comms-actions"><button id="comms-crosshair" type="button">Use crosshair</button><button id="comms-pick" type="button" aria-pressed="false">Place on map</button><button id="comms-mast" type="button" hidden>Use deployed mast</button><button id="comms-demo" type="button">Try Bright Angel</button></div>
   <p id="comms-position" class="tool-note">Tower location pending</p>
   <form id="comms-settings"><div class="comms-fields">${COMMS_FIELDS.slice(0,4).map(fieldMarkup).join('')}</div>
    <details><summary>Radio and receiver settings</summary><div class="comms-fields">${COMMS_FIELDS.slice(4).map(fieldMarkup).join('')}</div></details>
    <button id="comms-calculate" class="primary" type="submit">Calculate coverage</button>
   </form>
   <div class="comms-actions"><label><input type="checkbox" id="comms-visible" checked> Show on map</label><label>Opacity <input id="comms-opacity" type="range" min="15" max="85" value="55"></label><button id="comms-fit" type="button" disabled>Zoom to coverage</button></div>
   <p id="comms-status" class="tool-note" role="status"></p>
   <ul id="comms-key" aria-label="Coverage key">${coverageStates.map(({id,label,rgb})=>`<li><span class="comms-swatch" style="--comms-color:rgb(${rgb.join(' ')})"></span>${label} <output id="comms-stat-${id}"></output></li>`).join('')}</ul>
   <p id="comms-probe" class="tool-note">Click a colored part of the map to inspect its modeled signal.</p>
   <details><summary>Model and limits</summary><p>One-way ground link. The model uses physical elevation, Mars curvature, free-space loss and a 60% first Fresnel zone check. A blocked ray can still receive a diffracted signal in reality. This model classifies blockage and does not estimate diffraction, interference, antenna directionality, atmospheric effects or orbital relay availability.</p><a href="https://www.itu.int/rec/R-REC-P.525-5-202411-I/en" target="_blank" rel="noopener">ITU-R P.525 · free-space loss</a> · <a href="https://www.itu.int/rec/R-REC-P.526-16-202511-I/en" target="_blank" rel="noopener">ITU-R P.526 · clearance</a></details>`;
  $('workspace').append(panel);
  this.overlay=new CommsOverlay(host.viewer,[host.map,host.mini],{dragStarted:()=>this.startDrag(),dragged:(point,index)=>this.drag(point,index),dragEnded:()=>this.endDrag()});
  this.toggle=document.createElement('button');this.toggle.id='comms-toggle';this.toggle.textContent='Communications coverage';$('map-tools').append(this.toggle);
  this.toggle.onclick=()=>this.open(panel.hidden);$('comms-close').onclick=()=>this.open(false);
  new MutationObserver(()=>{
   if(panel.hidden){this.pick(false);this.cancelDrag?.();}
   this.syncVisibility();
  }).observe(panel,{attributes:true,attributeFilter:['hidden']});
  this.updateSettings();
  $('comms-crosshair').onclick=()=>{const point=host.focus();if(point)this.place(point);else this.status('Point the map crosshair at the surface.');};
  $('comms-pick').onclick=()=>this.pick(!this.picking);
  $('comms-mast').onclick=()=>{const mast=host.mast();if(mast)this.place(mast.coords);};
  $('comms-demo').onclick=()=>{const point=[77.3045,18.4955];$('comms-radius').value=.55;host.focusMap(coverageWindow(point,550));this.place(point);};
  $('comms-settings').onsubmit=event=>{event.preventDefault();this.run();};
  $('comms-settings').addEventListener('input',()=>{
   this.cancel();this.clearResult();
   if($('comms-settings').checkValidity()){
    this.settings=this.readSettings();this.changed();
   }
   this.status('Settings changed. Calculate to update coverage.');
  });
  $('comms-visible').onchange=()=>{this.visible=$('comms-visible').checked;this.syncVisibility();};
  $('comms-opacity').oninput=()=>this.overlay.setOpacity(Number($('comms-opacity').value)/100);
  $('comms-fit').onclick=()=>{if(this.result)this.host.focusMap(coverageWindow(this.point,this.result.radius));};
  new MutationObserver(()=>this.syncVisibility()).observe(document.body,{attributes:true,attributeFilter:['class']});
  this.bindGlobeDrag();
 }

 snapshot(){return this.point?commsScenario({point:this.point,settings:this.settings}):null;}
 safetySnapshot(){const scenario=this.snapshot();return scenario?{...scenario,result:this.result}:null;}
 restore(value){
  this.cancel();this.clearResult();this.point=value?.point??null;this.settings=value?.settings??commsParameters();
  this.updateSettings();this.overlay.setTower(this.point);this.updatePosition();this.syncVisibility();
  this.status(this.point?'Saved scenario loaded. Calculate to display coverage.':'');
 }
 updateSettings(){for(const [key] of COMMS_FIELDS)$('comms-'+key).value=this.settings[key];}
 readSettings(){return commsParameters(Object.fromEntries(COMMS_FIELDS.map(([key])=>[key,$('comms-'+key).valueAsNumber])));}
 open(show){
  this.panel.hidden=!show;
  if(!show)return;
  this.host.onOpen();
  $('comms-mast').hidden=!this.host.mast();
  const point=this.pendingMast??(!this.point?this.host.focus():null);this.pendingMast=null;
  if(point)this.place(point);else if(this.point&&!this.result&&!this.controller)this.run();else this.syncVisibility();
 }
 openMast(point){
  this.pendingMast=point;
  if(this.panel.hidden)this.host.openPanel();
  else{this.pendingMast=null;this.place(point);}
 }
 syncVisibility(){const shown=this.visible&&!this.host.inSpace();this.overlay.setVisibility(shown,shown&&!this.panel.hidden&&!this.picking);}
 status(message){$('comms-status').textContent=message;}
 updatePosition(){$('comms-position').textContent=this.point?'Tower · '+coordinateText(this.point):'Choose a tower location.';}
 pick(on){this.picking=on;$('comms-pick').setAttribute('aria-pressed',String(on));$('comms-pick').textContent=on?'Cancel placement':'Place on map';document.body.classList.toggle('comms-picking',on);this.syncVisibility();if(on)this.status('Click or tap the Martian surface to place the tower.');}
 click(point){
  if(this.panel.hidden||this.host.inSpace()||!point)return false;
  if(this.picking){this.place(point);return true;}
  if(!this.result||!this.visible)return false;
  const hit=coverageCell(this.result,routeProjection(this.result.center).forward(point));if(!hit)return false;
  const state=coverageStates.find(item=>item.id===hit.id),margin=Number.isFinite(hit.margin)?` · ${hit.margin.toFixed(1)} dB free-space margin`:'';
  $('comms-probe').textContent=`${state.label} · ${(hit.distance/1000).toFixed(2)} km from tower${margin}`;
  return true;
 }
 place(point,except){
  const next=normalizedPoint(point);if(!next)return;
  this.point=next;this.overlay.setTower(next,except);this.updatePosition();this.syncVisibility();
  if(this.overlay.dragging)return;
  this.pick(false);this.changed();this.run();
 }
 changed(){document.dispatchEvent(new Event('atlas-mission-change'));}
 startDrag(){this.overlay.dragging=true;this.cancel();this.clearResult();this.status('Move the tower, then release to recalculate.');}
 drag(point,index){this.place(point,index);}
 endDrag(){if(!this.overlay.dragging)return;this.overlay.dragging=false;this.overlay.positionMarkers();this.changed();this.run();}
 bindGlobeDrag(){
  const {viewer,navigation}=this.host,canvas=viewer.canvas,C=window.Cesium;let pointer,originalInputs,start;
  const screen=event=>{const p=clientPoint(canvas,event.clientX,event.clientY);return new C.Cartesian2(p.x,p.y);};
  const disable=event=>{event.preventDefault();event.stopImmediatePropagation();};
  const finish=()=>{
   if(pointer===undefined)return;
   const id=pointer;pointer=undefined;
   if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
   viewer.scene.screenSpaceCameraController.enableInputs=originalInputs;
   this.endDrag();
  };
  this.cancelDrag=finish;
  canvas.addEventListener('pointerdown',event=>{
   if(event.button!==0||this.panel.hidden||this.host.inSpace()||!this.overlay.editable||pointer!==undefined)return;
   if(viewer.scene.pick(screen(event))?.id!==this.overlay.tower)return;
   disable(event);pointer=event.pointerId;start=[event.clientX,event.clientY];canvas.setPointerCapture(pointer);navigation.drag=null;
   const controller=viewer.scene.screenSpaceCameraController;originalInputs=controller.enableInputs;controller.enableInputs=false;
  },true);
  canvas.addEventListener('pointermove',event=>{
   if(pointer!==event.pointerId)return;
   disable(event);if(!this.overlay.dragging&&Math.hypot(event.clientX-start[0],event.clientY-start[1])<4)return;
   const position=screen(event),scene=viewer.scene,ray=viewer.camera.getPickRay(position);
   const hit=ray&&scene.globe.pick(ray,scene);if(!hit)return;
   const p=scene.globe.ellipsoid.cartesianToCartographic(hit);
   if(!this.overlay.dragging)this.startDrag();
   this.drag([C.Math.toDegrees(p.longitude),C.Math.toDegrees(p.latitude)]);
  },true);
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,event=>{if(pointer===event.pointerId){disable(event);finish();}},true);
 }
 cancel(){this.controller?.abort();this.controller=null;}
 clearResult(){
  this.result=null;this.overlay.clear();
  this.host.onAnalysisChange?.();
  $('comms-fit').disabled=true;
  for(const {id} of coverageStates)$('comms-stat-'+id).textContent='';
  $('comms-probe').textContent='Click a colored part of the map to inspect its modeled signal.';
 }
 async run(){
  this.cancel();this.clearResult();
  if(!this.point){this.status('Place the tower before calculating coverage.');return;}
  const form=$('comms-settings');if(!form.reportValidity())return;
  try{this.settings=this.readSettings();}catch(error){this.status(error.message);return;}
  const scenario=this.snapshot(),radius=scenario.settings.radius*1000;
  this.changed();this.status('Loading measured elevation…');
  const controller=this.controller=new AbortController(),{signal}=controller;
  try{
   const spacing=Math.max(25,radius/52);
   if(!this.grid||!containsCoverage(this.grid,scenario.point,radius)||this.grid.source.requested_spacing_m>spacing*1.25){
    const grid=await routeTerrain(coverageWindow(scenario.point,radius),{catalog:this.host.catalog(),preferred:this.host.dataset(),spacing,signal,onProgress:message=>{if(!signal.aborted)this.status(message);}});
    signal.throwIfAborted();this.grid=grid;
   }
   signal.throwIfAborted();this.status('Tracing terrain clearance and radio margin…');
   const result=await this.solve(this.grid,scenario,signal);signal.throwIfAborted();
   this.result=result;
   this.host.onAnalysisChange?.();
   await this.overlay.draw(result,scenario.point);if(signal.aborted)return;
   $('comms-fit').disabled=false;
   const total=result.counts.reduce((x,y)=>x+y,0),km=(result.range[COVERAGE.covered.id]/1000).toFixed(2);
   for(const {id} of coverageStates)$('comms-stat-'+id).textContent=`${(100*result.counts[id]/total).toFixed(1)}%`;
   this.status(`${result.counts[COVERAGE.covered.id]?`Farthest covered cell ${km} km`:'No cells meet the coverage criteria'} · ${Math.round(result.cell)} m coverage grid · ${this.grid.source.label} (≈${this.grid.source.sample_m} m source).`);
  }catch(error){if(!signal.aborted)this.status(error.message);}
  finally{if(this.controller===controller)this.controller=null;}
 }
 solve(grid,scenario,signal){
  if(typeof Worker==='undefined')return Promise.resolve(coverageGrid(grid,scenario));
  try{this.worker??=new Worker(new URL('./comms-worker.js',import.meta.url),{type:'module'});}catch{return Promise.resolve(coverageGrid(grid,scenario));}
  return new Promise((resolve,reject)=>{
   const worker=this.worker,id=this.runId=(this.runId??0)+1;
   const clean=()=>{worker.removeEventListener('message',receive);worker.removeEventListener('error',fail);signal.removeEventListener('abort',abort);};
   const abort=()=>{clean();reject(signal.reason);};
   const receive=({data})=>{if(data.id!==id)return;clean();if(data.error)reject(Error(data.error));else resolve(data.result);};
   const fail=event=>{event.preventDefault();clean();worker.terminate();this.worker=null;this.workerGrid=null;try{resolve(coverageGrid(grid,scenario));}catch(error){reject(error);}};
   worker.addEventListener('message',receive);worker.addEventListener('error',fail);signal.addEventListener('abort',abort,{once:true});
   const terrain=this.workerGrid===grid?undefined:grid;
   try{worker.postMessage({terrain,scenario,id});this.workerGrid=grid;}catch(error){clean();reject(error);}
  });
 }
}

function fieldMarkup([key,label,initial,min,max]){
 return `<label>${label}<input id="comms-${key}" type="number" min="${min}" max="${max}" step="any" value="${initial}" required></label>`;
}

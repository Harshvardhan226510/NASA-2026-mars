import {MOONS,moonWindow,moonState,validateMoons,moonZoomRange,moonVectorSamples} from './moon-data.js';
import {requestModelReady,loadMarsModel} from './spacecraft-model.js';
import {MarsOrbiters} from './orbiters.js';
import {ORBITERS,advanceSystemTime,marsFrame,frameChange} from './orbiter-data.js';
import {pastTrail} from './orbital-path.js';
const $=id=>document.getElementById(id),utc=t=>new Date(t).toISOString().replace('T',' ').replace('.000Z',' UTC');
const motionDebug=typeof location!=='undefined'&&new URLSearchParams(location.search).has('motion-debug');
export class MarsMoons{
 constructor(viewer,{view,beforeFly,show3D,onOpen,ensureVisible,onExplore}={}){
  Object.assign(this,{viewer,view,beforeFly,show3D,onOpen,ensureVisible,onExplore,visible:true,at:Date.now(),mode:'now',enhanced:false,orbits:true,orbitDisplay:'path',showOrbiters:true,navigationVersion:0,entries:new Map(),cache:new Map()});
  const C=window.Cesium;this.source=new C.CustomDataSource('Phobos and Deimos · NASA/JPL ephemerides');viewer.dataSources.add(this.source);
  for(const [id,info] of Object.entries(MOONS)){const e=this.source.entities.add({id:'moon-'+id,position:C.Cartesian3.ZERO,show:false,point:{pixelSize:7,color:C.Color.fromCssColorString(info.color),outlineColor:C.Color.fromCssColorString('#101924'),outlineWidth:2},label:{text:info.name,font:'600 12px system-ui',fillColor:C.Color.fromCssColorString(info.color),showBackground:true,backgroundColor:C.Color.fromCssColorString('#101924e6'),backgroundPadding:new C.Cartesian2(7,4),pixelOffset:new C.Cartesian2(0,-23),outlineColor:C.Color.BLACK,outlineWidth:2,style:C.LabelStyle.FILL_AND_OUTLINE}});e.moonId=id;this.entries.set(id,{entity:e});}
  for(const [id,e] of this.entries)e.entity.position=new C.CallbackPositionProperty((_time,result)=>{const state=this.entries.get(id)?.state;return state?C.Cartesian3.fromArray(state.position,0,result):undefined;},false);
  this.axis=this.source.entities.add({id:'mars-rotation-axis',show:false,polyline:{positions:[new C.Cartesian3(0,0,-4700000),new C.Cartesian3(0,0,4700000)],arcType:C.ArcType.NONE,width:2,material:C.Color.fromCssColorString('#f1c895')}});
  this.axisLabel=this.source.entities.add({id:'mars-axis-label',show:false,position:new C.Cartesian3(0,0,4800000),label:{text:'Mars rotation axis',font:'600 11px system-ui',fillColor:C.Color.fromCssColorString('#f1c895'),showBackground:true,backgroundColor:C.Color.fromCssColorString('#101924e6'),backgroundPadding:new C.Cartesian2(6,4)}});
  this.showOrbiters=$('moons-orbiters')?.checked??true;
  this.orbiters=new MarsOrbiters(viewer,{select:id=>this.selectOrbiter(id),onReady:()=>{this.dirty=true;}});
  // A stopped renderer must not leave the shared simulation clock running.
  viewer.scene.renderError.addEventListener((scene,error)=>{this.mode='paused';this.previousFixed=null;this.axis.show=this.axisLabel.show=false;this.render();if(!motionDebug)return;
   const c=viewer.camera,bad=[];for(const command of scene.frameState.commandList){const b=command.boundingVolume;if(b&&bad.length<20){const n=b.computePlaneDistances(c.positionWC,c.directionWC,new C.Interval());if(!Number.isFinite(n.start)||!Number.isFinite(n.stop))bad.push({owner:command.owner?.constructor?.name,center:b.center,radius:b.radius,base:command.owner?._baseVolume,scale:command.owner?._maxScale,size:command.owner?._maxSize,pixels:command.owner?._maxPixelSize,matrix:command.modelMatrix,interval:n});}}
   const p=document.createElement('pre');p.id='motion-diagnostics';p.style='position:fixed;inset:100px 20px;z-index:9999;overflow:auto;background:#101924;color:white;white-space:pre-wrap;padding:20px';p.textContent=JSON.stringify({error:String(error),at:new Date(this.at).toISOString(),canvas:[scene.drawingBufferWidth,scene.drawingBufferHeight,scene.pixelRatio],camera:{position:c.position,direction:c.direction,up:c.up,right:c.right,near:c.frustum.near,far:c.frustum.far,fov:c.frustum.fov,aspect:c.frustum.aspectRatio},badCommands:bad},null,2);document.body.append(p);
  });
  $('moons-open').onclick=()=>this.open($('moons-panel').hidden);$('moons-close').onclick=()=>this.open(false);$('moons-system').onclick=()=>this.system();$('moons-release').onclick=()=>this.releaseTracking(false);$('moons-mars').onclick=()=>{this.open(false);$('home').click();};
  for(const id of ['appearance-toggle','measure-toggle','route-toggle','mission-toggle','spacecraft-open'])$(id).addEventListener('click',()=>this.open(false));
  for(const b of document.querySelectorAll('[data-moon]'))b.onclick=()=>this.select(b.dataset.moon);
  $('moons-enhance').onchange=()=>{this.enhanced=$('moons-enhance').checked;for(const e of this.entries.values())if(e.model)e.model.scale=1000*(this.enhanced?20:1);if(this.selected)this.frame(this.selected);this.draw();this.settings();};
  for(const input of document.querySelectorAll('[name="orbit-display"]'))input.onchange=()=>{if(input.checked)this.setOrbitDisplay(input.value);};
  $('moons-now').onclick=()=>this.choose(Date.now(),'now');$('moons-pause').onclick=()=>this.choose(this.at,'paused');$('moons-apply').onclick=()=>this.choose(Date.parse($('moons-time').value+'Z'),'paused');
  $('system-inner').onclick=()=>this.system();$('system-wide').onclick=()=>this.system({wide:true});
  $('system-toggle').onclick=()=>this.choose(this.mode==='paused'?Date.now():this.at,this.mode==='paused'?'now':'paused');
  $('moons-orbiters').onchange=()=>{this.showOrbiters=$('moons-orbiters').checked;if(!this.showOrbiters&&this.viewer.trackedEntity?.orbiterId)this.releaseTracking(false);this.draw();};
  viewer.camera.changed.addEventListener(()=>{this.dirty=true;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('moons-panel').hidden)this.open(false);});
  this.last=performance.now();this.timer=setInterval(()=>this.tick(),33);this.timer.unref?.();this.settings();
  this.load();if(this.showOrbiters)this.orbiters.load(this.at);
 }
 tick(){
  const now=performance.now(),dt=now-this.last;this.last=now;if(!this.visible||document.hidden||this.view?.()==='2d')return;
  if(!this.exploring&&!this.showOrbiters&&$('moons-panel').hidden)return;
  if(this.mode==='paused'&&!this.dirty&&this.lastAt===this.at&&this.packet)return;
  this.dirty=false;this.lastNow=now;
  this.at=advanceSystemTime(this.at,this.mode,dt);
  if(this.at>=Date.parse('2036-01-01T00:00:00Z')-1)this.mode='paused';
  if(!this.packet||this.at<Date.parse(this.packet.start_utc)||this.at>=Date.parse(this.packet.end_utc))this.load();
  if(this.showOrbiters&&(!this.orbiters.packet(this.at)||this.orbiters.needsRefresh(this.at)))this.orbiters.load(this.at);
  if(this.mode==='now'&&this.packet&&Date.parse(this.packet.end_utc)-this.at<300000)this.prefetch();
  this.draw();
 }
 prefetch(){
  const next=Date.parse(this.packet.end_utc);if(next>=Date.parse('2036-01-01T00:00:00Z'))return;const key=moonWindow(next);
  if(!this.cache.has(key)&&this.prefetchKey!==key&&!(this.prefetchFailedKey===key&&this.prefetchRetry>Date.now())){this.prefetchKey=key;fetch('/api/moons?'+new URLSearchParams({at:key}),{signal:AbortSignal.timeout(55000)}).then(async r=>{if(!r.ok)throw Error('Moon interval unavailable');this.cache.set(key,validateMoons(await r.json()));if(this.cache.size>4)this.cache.delete(this.cache.keys().next().value);}).catch(()=>{this.prefetchFailedKey=key;this.prefetchRetry=Date.now()+60000;}).finally(()=>{if(this.prefetchKey===key)this.prefetchKey=null;});}
  if(this.showOrbiters)this.orbiters.load(next);
 }
 settings(){$('moons-scale-note').textContent=this.enhanced?'Moon models are enlarged 20× for visibility. Orbital distances and positions remain at true scale.':'Moon models use kilometre-based asset dimensions at approximately true size. Location markers stay readable as you zoom.';}
 open(show){$('moons-panel').hidden=!show;$('moons-open').setAttribute('aria-expanded',String(show));if(show){this.onOpen?.();this.load();if(this.showOrbiters)this.orbiters.load(this.at);this.render();}}
 setVisible(show){this.visible=show;this.source.show=show;if(!show){this.releaseTracking();this.orbiters.hide();}for(const entry of this.entries.values()){if(entry.model)entry.model.show=show&&this.view?.()!=='2d';if(entry.orbit)entry.orbit.show=show&&this.orbits&&this.view?.()!=='2d';}this.draw();this.viewer.scene.requestRender();}
 choose(at,mode){if(!Number.isFinite(at)||at<Date.parse('2025-01-01T00:00:00Z')||at>=Date.parse('2036-01-01T00:00:00Z')){$('moons-status').textContent='Choose a UTC time from 2025 through 2035.';return;}this.previousFixed=null;this.at=at;this.mode=mode==='paused'?'paused':'now';this.last=performance.now();this.load();if(this.showOrbiters)this.orbiters.load(at);this.draw();document.dispatchEvent(new Event('atlas-mission-change'));}
 async load(){
  const key=moonWindow(this.at);if(this.packet?.start_utc===key.replace('.000Z','Z'))return true;if(this.pending){this.next=true;return this.pending;}
  if(this.retryAfter>Date.now()&&this.failedKey===key)return false;
  $('moons-status').textContent='Loading NASA/JPL orbital positions…';this.pending=(async()=>{
   await Promise.resolve();
   try{let p=this.cache.get(key);if(!p){const r=await fetch('/api/moons?'+new URLSearchParams({at:key}),{signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error('Moon ephemerides are unavailable.');p=validateMoons(await r.json());this.cache.set(key,p);if(this.cache.size>4)this.cache.delete(this.cache.keys().next().value);}if(moonWindow(this.at)!==key)return false;this.packet=p;this.retryAfter=0;this.failedKey=null;this.makeOrbits();this.loadTrailHistory();this.draw();return true;}
   catch(error){this.failedKey=key;this.retryAfter=Date.now()+60000;$('moons-status').textContent=error.message+' Positions are hidden outside verified time coverage.';for(const e of this.entries.values()){e.entity.show=false;if(e.model)e.model.show=false;if(e.orbit)e.orbit.show=false;}return false;}
   finally{this.pending=null;if(this.next){this.next=false;this.load();}}
  })();return this.pending;
 }
 setOrbitDisplay(value){this.orbitDisplay=['path','trail','hidden'].includes(value)?value:'path';this.orbits=this.orbitDisplay!=='hidden';for(const input of document.querySelectorAll('[name="orbit-display"]'))input.checked=input.value===this.orbitDisplay;$('orbit-display-note').textContent=this.orbitDisplay==='trail'?'Recent movement: up to the previous hour, fading toward older positions. Missing history stays blank.':this.orbitDisplay==='hidden'?'Orbit lines are hidden. The moons and spacecraft remain visible.':'The orbital curve from dated source positions. Partial coverage stays an open arc.';if(this.packet)this.makeOrbits();this.loadTrailHistory();this.draw();document.dispatchEvent(new Event('atlas-mission-change'));}
 async loadTrailHistory(){
  if(this.orbitDisplay!=='trail'||!this.packet)return;const start=Date.parse(this.packet.start_utc);if(this.at-start>=3600000||start<=Date.parse('2025-01-01T00:00:00Z'))return;const key=moonWindow(start-1);if(this.cache.has(key)||this.historyPending===key||this.historyFailed===key&&this.historyRetry>Date.now())return;
  this.historyPending=key;try{const r=await fetch('/api/moons?'+new URLSearchParams({at:key}),{signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error('Moon history unavailable');this.cache.set(key,validateMoons(await r.json()));if(this.cache.size>4)this.cache.delete(this.cache.keys().next().value);if(this.orbitDisplay==='trail'){this.makeOrbits();this.dirty=true;this.draw();}}
  catch{this.historyFailed=key;this.historyRetry=Date.now()+60000;}finally{if(this.historyPending===key)this.historyPending=null;}
 }
 makeOrbits(){if(!this.packet)return;const C=window.Cesium;this.moonOrbitAt=this.at;for(const [id,e] of this.entries){if(e.orbit)this.viewer.scene.primitives.remove(e.orbit);e.orbit=this.viewer.scene.primitives.add(new C.PolylineCollection());const color=C.Color.fromCssColorString(MOONS[id].color),add=(positions,alpha,width)=>{if(positions.length>1)e.orbit.add({positions:positions.map(v=>new C.Cartesian3(...v)),width,material:C.Material.fromType('Color',{color:color.withAlpha(alpha)})});};
   if(this.orbitDisplay!=='trail'){add(this.packet.bodies[id].orbit_j2000_m,.4,1.5);continue;}
   const previous=this.cache.get(moonWindow(Date.parse(this.packet.start_utc)-1)),trail=pastTrail(moonVectorSamples([previous,this.packet],id),this.at);if(!trail)continue;const n=trail.states.length;
   for(let i=0;i<8;i++)add(trail.states.slice(Math.floor(n*i/8),Math.min(n,Math.floor(n*(i+1)/8)+1)).map(s=>s.position),.12+.1*i,1.2+.13*i);
  }
 }
 async model(id){const e=this.entries.get(id);if(e.loading||e.model)return;e.loading=true;const C=window.Cesium,scene=this.viewer.scene;
  try{const model=await loadMarsModel(C,{url:MOONS[id].model,scene,scale:1000*(this.enhanced?20:1),minimumPixelSize:0,backFaceCulling:false,enableVerticalExaggeration:false,id:{moonId:id}});e.model=model;scene.primitives.add(model);e.stop=requestModelReady(model,scene,{current:()=>e.model===model,ready:()=>{e.ready=true;e.meshRadius=model.boundingSphere.radius/(this.enhanced?20:1);if(this.selected===id)this.minimumDistance(id);this.draw();},failed:()=>{e.failed=true;$('moons-status').textContent=MOONS[id].name+' model could not render. Its ephemeris marker remains available.';}});this.draw();}
  catch{e.failed=true;$('moons-status').textContent=MOONS[id].name+' model could not load. Its ephemeris marker remains available.';}finally{e.loading=false;}
 }
 draw(){
  const C=window.Cesium,scene=this.viewer.scene,allowed=this.visible&&this.view?.()!=='2d';let valid=false;
  const fixed=marsFrame(this.packet,this.at),moving=this.mode!=='paused'&&this.exploring&&allowed;
  if(this.orbitDisplay==='trail'&&this.packet&&Math.abs(this.at-(this.moonOrbitAt??0))>=10000)this.makeOrbits();
  if(moving&&fixed&&this.previousFixed&&!this.viewer.trackedEntity&&!this.flying&&C.Matrix4.equals(this.viewer.camera.transform,C.Matrix4.IDENTITY)){
   // Keep the observer in a nonrotating space frame while the Mars-fixed map
   // coordinates remain intact. This is the planet's physical axial rotation,
   // not an extra rotation added to moon or spacecraft positions.
   const rotation=C.Matrix3.fromQuaternion(new C.Quaternion(...frameChange(this.previousFixed,fixed))),camera=this.viewer.camera;
   for(const key of ['position','direction','up','right'])C.Matrix3.multiplyByVector(rotation,camera[key],camera[key]);
  }
  this.previousFixed=fixed;
  this.axis.show=this.axisLabel.show=Boolean(moving&&fixed);
  this.orbiters.selected=this.selectedOrbiter;this.orbiters.draw(this.at,fixed,{visible:Boolean(allowed&&this.showOrbiters&&(this.exploring||this.selectedOrbiter||fixed)),paths:this.orbits,selected:this.selectedOrbiter,display:this.orbitDisplay});
  for(const [id,e] of this.entries){const state=moonState(this.packet,id,this.at);e.state=state;e.entity.show=Boolean(allowed&&state);if(e.model)e.model.show=Boolean(allowed&&state&&!e.failed);if(e.orbit)e.orbit.show=Boolean(allowed&&state&&this.orbits);if(!state)continue;valid=true;const position=new C.Cartesian3(...state.position);
   if(allowed&&!e.model&&!e.loading&&!e.failed&&(scene.camera.positionCartographic.height>600000||this.selected===id))this.model(id);
   const scale=this.enhanced?20:1,close=e.ready&&!e.failed&&C.Cartesian3.distance(scene.camera.positionWC,position)<MOONS[id].radius*scale*35;
   // EntityView only follows entities with an active visualizer bounding sphere.
   // Keep the point anchor active when the separate GLB replaces its visible dot.
   e.entity.point.show=true;e.entity.point.pixelSize=close?0:7;e.entity.point.outlineWidth=close?0:2;e.entity.label.show=!close;
   if(e.orbit)e.orbit.show=Boolean(allowed&&this.exploring&&state&&this.orbits&&!close);
   if(e.model)e.model.modelMatrix=C.Matrix4.fromRotationTranslation(C.Matrix3.fromQuaternion(new C.Quaternion(...state.orientation)),position);
   if(e.orbit)e.orbit.modelMatrix=C.Matrix4.fromRotationTranslation(C.Matrix3.fromQuaternion(new C.Quaternion(...state.fixed)));
  }
  this.render();if(valid)this.lastAt=this.at;scene.requestRender();
 }
 render(){
  // Positions update every frame; text changes at most once per displayed
  // second, preserving focus and avoiding needless accessibility-tree churn.
  const renderKey=[Math.floor(this.at/1000),this.mode,this.exploring,this.view?.(),this.selected,this.selectedOrbiter,this.enhanced,Boolean(this.viewer.trackedEntity),Boolean(marsFrame(this.packet,this.at))].join('|');if(renderKey===this.renderKey)return;this.renderKey=renderKey;
  const clockText=`${this.mode==='paused'?'PAUSED SNAPSHOT':'CURRENT UTC · REAL RATE 1×'} · ${utc(Math.floor(this.at/1000)*1000)}`;
  $('moons-clock').textContent=clockText;$('system-clock-state').textContent=this.mode==='paused'?'PAUSED · UTC':'CURRENT UTC · 1×';$('system-clock-time').textContent=utc(Math.floor(this.at/1000)*1000).replace(' UTC','');$('system-clock-time').dateTime=new Date(this.at).toISOString();$('system-motion').hidden=!this.exploring||this.view?.()==='2d';
  $('system-motion').dataset.mode=this.mode;$('system-toggle').textContent=this.mode==='paused'?'▶ Now':'Ⅱ Pause';$('system-toggle').setAttribute('aria-pressed',String(this.mode!=='paused'));$('system-toggle').setAttribute('aria-label',this.mode==='paused'?'Return Mars, moons and spacecraft to current UTC':'Pause Mars, moon and spacecraft motion');
  if(document.activeElement!==$('moons-time'))$('moons-time').value=new Date(this.at).toISOString().slice(0,16);
  const valid=Boolean(moonState(this.packet,'phobos',this.at));if(valid)$('moons-status').textContent=this.view?.()==='2d'?'Moons are displayed in 3D. Choose a moon or Show Mars system to switch views.':'NASA/JPL geometric ephemerides · modeled positions, not live observations.';
  for(const [id,e] of this.entries){const out=$('moon-distance-'+id),s=e.state;out.textContent=s?`${(s.radius/1000).toLocaleString(undefined,{maximumFractionDigits:0})} km from Mars centre · ~${id==='phobos'?'7.7':'30.3'} h orbit`:'Orbital position unavailable';}
  for(const b of document.querySelectorAll('[data-moon]'))b.setAttribute('aria-pressed',String(b.dataset.moon===this.selected));
  $('moons-release').hidden=!this.viewer.trackedEntity;
  if(this.exploring){$('status').textContent=this.selected?`${MOONS[this.selected].name} · NASA/JPL model`:this.selectedOrbiter?`${ORBITERS[this.selectedOrbiter].name} · NASA/JPL trajectory`:'Mars · moons · orbiters';$('coverage-state').textContent=this.selected?(this.enhanced?'Moon display size 20× · orbital distances at true scale':'Moon model at approximate true size'):this.selectedOrbiter?'Orbiter models enlarged · illustrative attitude':'Orbital distances at true scale · real elapsed time';$('view-status').textContent='NASA/JPL geometric ephemerides · '+(this.mode==='paused'?'paused dated snapshot':'current-time modeled positions');if(this.selected){$('location-name').textContent=MOONS[this.selected].name;$('location-detail').textContent='Natural satellite of Mars · '+utc(Math.floor(this.at/1000)*1000);}}
 }
 prepareView(){const mode=this.mode;this.beforeFly?.();this.show3D?.();this.mode=mode;}
 setExploring(show){if(this.exploring===show)return;this.exploring=show;const fxaa=this.viewer.scene.postProcessStages.fxaa;if(show){this.previousFxaa=fxaa.enabled;fxaa.enabled=true;}else fxaa.enabled=this.previousFxaa??fxaa.enabled;if(!show){this.mode='paused';this.previousFixed=null;this.orbiters.hide();}document.body.classList.toggle('moon-view',show);this.onExplore?.(show);this.draw();}
 async select(id,{fly=true,live=!this.exploring}={}){if(!MOONS[id])return;if(live)this.choose(Date.now(),'now');const version=++this.navigationVersion;this.ensureVisible?.();this.open(true);const ok=await this.load();if(version!==this.navigationVersion||!ok&&!moonState(this.packet,id,this.at))return;this.prepareView();this.selected=id;this.selectedOrbiter=null;this.setExploring(true);this.draw();this.model(id);if(fly)this.frame(id);history.replaceState(null,'','#'+new URLSearchParams({moon:id}));}
 async selectOrbiter(id,{fly=true,live=!this.exploring}={}){if(!ORBITERS[id])return;if(live)this.choose(Date.now(),'now');const version=++this.navigationVersion;this.ensureVisible?.();this.open(true);await Promise.all([this.load(),this.orbiters.load(this.at)]);if(version!==this.navigationVersion)return;this.prepareView();this.selected=null;this.selectedOrbiter=id;this.showOrbiters=true;$('moons-orbiters').checked=true;this.setExploring(true);this.draw();if(fly&&this.orbiters.position(id)){this.orbiters.selected=id;this.orbiters.frame(id);}history.replaceState(null,'','#'+new URLSearchParams({orbiter:id}));}
 displayRadius(id){return Math.max(MOONS[id].radius,this.entries.get(id)?.meshRadius??0)*(this.enhanced?20:1);}
 minimumDistance(id){this.viewer.scene.screenSpaceCameraController.minimumZoomDistance=this.displayRadius(id)*1.03;}
 zoom(delta){if(this.viewer.trackedEntity?.orbiterId)return this.orbiters.zoom(delta);const id=this.viewer.trackedEntity?.moonId;if(!id)return false;const C=window.Cesium,e=this.entries.get(id);if(!e?.state)return false;const distance=C.Cartesian3.distance(this.viewer.camera.positionWC,new C.Cartesian3(...e.state.position)),next=moonZoomRange(distance,this.displayRadius(id),delta);this.viewer.camera.zoomIn(distance-next);this.viewer.scene.requestRender();return true;}
 frame(id){const C=window.Cesium,e=this.entries.get(id);if(!e?.state)return;this.viewer.trackedEntity=undefined;const radius=this.displayRadius(id);this.minimumDistance(id);e.entity.viewFrom=new C.Cartesian3(radius*3,-radius*3,radius*1.5);this.viewer.camera.flyToBoundingSphere(new C.BoundingSphere(new C.Cartesian3(...e.state.position),radius),{duration:1.8,offset:new C.HeadingPitchRange(.6,-.35,radius*4.5),complete:()=>{if(this.selected===id){this.viewer.trackedEntity=e.entity;this.render();}}});}
 releaseTracking(clear=true){this.navigationVersion++;const C=window.Cesium;if(this.viewer.trackedEntity?.moonId||this.viewer.trackedEntity?.orbiterId){this.viewer.trackedEntity=undefined;this.viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);}if(clear){this.selected=null;this.selectedOrbiter=null;this.viewer.scene.screenSpaceCameraController.minimumZoomDistance=100;this.setExploring(false);}this.render();}
 async system({play=true,wide=false}={}){const version=++this.navigationVersion;if(play)this.choose(Date.now(),'now');this.ensureVisible?.();this.open(true);await Promise.all([this.load(),this.showOrbiters?this.orbiters.load(this.at):null]);if(version!==this.navigationVersion)return;this.prepareView();this.selected=null;this.selectedOrbiter=null;this.setExploring(true);this.draw();const C=window.Cesium;this.viewer.trackedEntity=undefined;this.viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);this.viewer.scene.screenSpaceCameraController.minimumZoomDistance=100;this.systemWide=wide;$('system-inner').setAttribute('aria-pressed',String(!wide));$('system-wide').setAttribute('aria-pressed',String(wide));this.flying=true;this.viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.ZERO,wide?Math.max(26000000,...[...this.orbiters.entries.values()].flatMap(e=>e.arc?.states.map(s=>Math.hypot(...s.position))??[])):6000000),{duration:2,offset:new C.HeadingPitchRange(.4,-.65,0),complete:()=>{this.flying=false;this.open(false);},cancel:()=>{this.flying=false;}});history.replaceState(null,'','#moon=system');}
}

import {ORBITERS,orbitWindow,orbiterState,orbiterAxes,validateOrbiters} from './orbiter-data.js';
import {requestModelReady,loadMarsModel} from './spacecraft-model.js';
import {trajectoryArc,pastTrail} from './orbital-path.js';
import {appendSpacecraftHistory} from './spacecraft-history.js';
const $=id=>document.getElementById(id);

export class MarsOrbiters{
 constructor(viewer,{select,onReady}={}){
  Object.assign(this,{viewer,onReady,entries:new Map(),cache:new Map(),pending:new Map(),failed:new Map(),retry:new Map()});
  const C=window.Cesium;this.source=new C.CustomDataSource('Mars orbiters · dated NASA/JPL trajectories');viewer.dataSources.add(this.source);
  for(const [id,info] of Object.entries(ORBITERS)){
   const entity=this.source.entities.add({id:'orbiter-'+id,show:false,point:{pixelSize:6,color:C.Color.fromCssColorString(info.color),outlineColor:C.Color.BLACK,outlineWidth:2},label:{text:info.short,font:'600 11px system-ui',fillColor:C.Color.fromCssColorString(info.color),showBackground:true,backgroundColor:C.Color.fromCssColorString('#101924e6'),backgroundPadding:new C.Cartesian2(5,3),pixelOffset:new C.Cartesian2(0,-20),outlineColor:C.Color.BLACK,outlineWidth:2,style:C.LabelStyle.FILL_AND_OUTLINE}});
   entity.orbiterId=id;entity.position=new C.CallbackPositionProperty((_time,result)=>{const s=this.entries.get(id)?.state;return s?C.Cartesian3.fromArray(s.position,0,result):undefined;},false);
   this.entries.set(id,{entity});
   const row=document.createElement('button');row.className='orbiter-row';row.dataset.orbiter=id;row.setAttribute('aria-pressed','false');
   const name=document.createElement('strong'),status=document.createElement('small');name.textContent=info.short;row.style.setProperty('--orbit-color',info.color);status.id='orbiter-status-'+id;status.textContent='Load JPL position';row.append(name,status);row.onclick=()=>select(id);$('orbiters-list').append(row);
  }
 }
 async load(at){
  const key=orbitWindow(at);if(this.cache.has(key)&&!this.needsRefresh(at))return this.cache.get(key);if(this.pending.has(key))return this.pending.get(key);if(this.failed.get(key)>Date.now())return null;
  const task=(async()=>{try{
   const r=await fetch('/api/spacecraft?'+new URLSearchParams({service:'orbits',at:key}),{signal:AbortSignal.timeout(100000)});if(!r.ok)throw Error('Orbit service unavailable');
   const packet=validateOrbiters(await r.json());this.cache.set(key,packet);this.retry.set(key,Object.entries(packet.bodies).some(([id,b])=>id!=='maven'&&b.status!=='available')?Date.now()+900000:Infinity);if(this.cache.size>4)this.cache.delete(this.cache.keys().next().value);this.onReady?.();return packet;
  }catch{this.failed.set(key,Date.now()+60000);this.onReady?.();return null;}finally{this.pending.delete(key);}})();this.pending.set(key,task);return task;
 }
 packet(at){return this.cache.get(orbitWindow(at));}
 needsRefresh(at){return (this.retry.get(orbitWindow(at))??Infinity)<=Date.now();}
 draw(at,fixed,{visible,paths,selected,display='path'}={}){
  const C=window.Cesium,packet=this.packet(at);this.source.show=visible;
  if(packet!==this.current||selected!==this.pathSelected||display!==this.pathDisplay||Math.abs(at-(this.pathAt??0))>=30000){this.current=packet;this.pathSelected=selected;this.pathAt=at;this.pathDisplay=display;this.makePaths(packet,at,selected,display);}
  for(const [id,e] of this.entries){
   const s=orbiterState(packet,id,at,fixed);e.state=s;e.entity.show=Boolean(visible&&s);const distance=s?C.Cartesian3.distance(this.viewer.camera.positionWC,new C.Cartesian3(...s.position)):Infinity;
   if(visible&&s&&ORBITERS[id].model&&(selected===id||distance<5000000)&&!e.loading&&!e.model&&!e.failed)this.model(id);
   const axes=s?orbiterAxes(s):null;
   if(e.model){e.model.show=Boolean(visible&&s&&axes&&!e.failed);if(axes){const {x,y,z}=axes,m=new C.Matrix3(x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]);e.model.modelMatrix=C.Matrix4.fromRotationTranslation(m,new C.Cartesian3(...s.position));}}
   const close=e.ready&&axes&&!e.failed&&distance<1500000;e.entity.point.pixelSize=close?0:6;e.entity.point.outlineWidth=close?0:2;e.entity.label.show=!close;
   if(e.path){e.path.show=Boolean(visible&&s&&paths&&distance>250000);if(fixed)e.path.modelMatrix=C.Matrix4.fromRotationTranslation(C.Matrix3.fromQuaternion(new C.Quaternion(...fixed)));}
   const out=$('orbiter-status-'+id),body=packet?.bodies[id],text=s?`${Math.round((s.radius-3396190)/1000).toLocaleString()} km above Mars datum`:body?.reason??(this.pending.has(orbitWindow(at))?'Loading JPL trajectory…':'No verified trajectory loaded');if(out.textContent!==text)out.textContent=text;
   out.parentElement.setAttribute('aria-pressed',String(id===selected));
  }
  const count=[...this.entries.values()].filter(e=>e.state).length;
  const summary=packet?`${count} JPL positions available for the displayed UTC. Unavailable or unreliable objects stay hidden.`:'Loading spacecraft trajectories from NASA/JPL…';if($('orbiters-status').textContent!==summary)$('orbiters-status').textContent=summary;
  const detail=$('orbiter-source'),b=packet?.bodies[selected],entry=this.entries.get(selected);detail.hidden=!selected;
  const detailKey=[selected,b?.retrieved_at,b?.reason,entry?.arc?.complete,display].join('|');
  if(selected&&detailKey!==this.detailKey){
   this.detailKey=detailKey;detail.replaceChildren();
   const title=document.createElement('strong');title.textContent=ORBITERS[selected].name;detail.append(title);
   appendSpacecraftHistory(detail,{id:selected,kind:'orbiter'});
   const p=document.createElement('p'),traceNote=display==='hidden'?'Orbit lines are hidden.':display==='trail'?'Trail shows the previous hour where covered by source vectors.':entry?.arc?.complete?'Path shows one revolution around the displayed position.':'Path shows the available arc; it is not a complete revolution.';
   p.textContent=b?.status==='available'?`${b.solution} · retrieved ${b.retrieved_at.replace('T',' ').replace(/\.\d+Z$/,' UTC')}. ${traceNote} ${b.prediction_note}`:b?.reason??'Loading source coverage…';detail.append(p);
   if(b?.source_url){const a=document.createElement('a');a.href=b.source_url;a.target='_blank';a.rel='noopener';a.textContent='NASA/JPL source vectors ↗';detail.append(a);}
   if(b?.source_notes){const disclosure=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Trajectory dates and prediction notes';pre.textContent=b.source_notes;disclosure.append(summary,pre);detail.append(disclosure);}
  }
 }
 makePaths(packet,at,selected,display='path'){
  const C=window.Cesium;for(const [id,e] of this.entries){if(e.path)this.viewer.scene.primitives.remove(e.path);e.path=null;const b=packet?.bodies[id];if(b?.status!=='available')continue;
   const arc=display==='trail'?pastTrail(b.trajectory??b.samples,at):trajectoryArc(b.trajectory??b.samples,at);e.arc=arc;if(!arc||arc.states.length<2)continue;
   e.path=this.viewer.scene.primitives.add(new C.PolylineCollection());const color=C.Color.fromCssColorString(ORBITERS[id].color),dim=selected&&selected!==id ? .45 : 1;
   const add=(states,alpha,width)=>{if(states.length>1)e.path.add({positions:states.map(s=>new C.Cartesian3(...s.position)),width,material:C.Material.fromType('Color',{color:color.withAlpha(alpha*dim)})});};
   if(display!=='trail'){add(arc.states,.48,selected===id?2:1.4);continue;}
   const past=arc.states,n=past.length;
   // A tapered past arc indicates direction without accelerating any object.
   for(let i=0;i<8;i++)add(past.slice(Math.floor(n*i/8),Math.min(n,Math.floor(n*(i+1)/8)+1)),.22+.075*i,1.1+i*.16);
  }
 }
 async model(id){
  const C=window.Cesium,e=this.entries.get(id),scene=this.viewer.scene;e.loading=true;
  try{const model=await loadMarsModel(C,{url:ORBITERS[id].model,scene,scale:1,minimumPixelSize:0,enableVerticalExaggeration:false,backFaceCulling:false,id:{orbiterId:id}});e.model=model;model.show=false;scene.primitives.add(model);
   e.stop=requestModelReady(model,scene,{current:()=>e.model===model,ready:()=>{model.scale=15000/Math.max(.001,model.boundingSphere.radius);e.ready=true;this.onReady?.();},failed:()=>{e.failed=true;model.show=false;}});
  }catch{e.failed=true;}finally{e.loading=false;}
 }
 hide(){this.source.show=false;for(const e of this.entries.values()){if(e.path)e.path.show=false;if(e.model)e.model.show=false;}}
 position(id){return this.entries.get(id)?.state;}
 frame(id){const C=window.Cesium,e=this.entries.get(id);if(!e?.state)return;this.viewer.trackedEntity=undefined;this.viewer.scene.screenSpaceCameraController.minimumZoomDistance=20000;e.entity.viewFrom=new C.Cartesian3(120000,-120000,60000);
  this.viewer.camera.flyToBoundingSphere(new C.BoundingSphere(new C.Cartesian3(...e.state.position),20000),{duration:1.8,offset:new C.HeadingPitchRange(.6,-.35,150000),complete:()=>{if(this.selected===id)this.viewer.trackedEntity=e.entity;}});
 }
 zoom(delta){const id=this.viewer.trackedEntity?.orbiterId,s=this.position(id);if(!s)return false;const C=window.Cesium,d=C.Cartesian3.distance(this.viewer.camera.positionWC,new C.Cartesian3(...s.position)),next=Math.max(20000,d*Math.exp(-Math.max(-300,Math.min(300,delta))*.0025));this.viewer.camera.zoomIn(d-next);this.viewer.scene.requestRender();return true;}
}

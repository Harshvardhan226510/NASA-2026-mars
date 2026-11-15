import {hasSurfacePosition} from './spacecraft-data.js';
import {requestModelReady,loadMarsModel} from './spacecraft-model.js';
export const SPACECRAFT_CTX_METRES=5.2;
export function spacecraftDisplayGeometry(model){
 const size=model.bounds_size,scale=Math.max(1,600/Math.max(...size));
 return {scale,height:size[1]*scale,radius:Math.hypot(...size)*scale/2};
}
export function terrainModelEligible({located,hasModel,visible,inView,view,quality,pixelMetres,distance,forced=false,admitted=false}){
 if(!located||!hasModel||!visible||!inView||view==='2d'||!Number.isFinite(distance)||distance>20000)return false;
 if(forced)return true;
 return Number.isFinite(pixelMetres)&&pixelMetres<=16&&(admitted||quality?.source==='CTX'&&Number.isFinite(quality.metres)&&quality.metres>0&&quality.metres<=SPACECRAFT_CTX_METRES);
}

// Desired objects are independent of the menu selection. Pending GLB downloads
// are bounded, and a result for a departed view is destroyed before it can attach.
export class TerrainModelPool{
 constructor({load,dispose,watch,onChange=()=>{},clock=()=>Date.now(),concurrency=2}){Object.assign(this,{load,dispose,watch,onChange,clock,concurrency});this.entries=new Map();this.loading=0;}
 setDesired(specs){
  const desired=new Map(specs.map(s=>[s.id,s]));let changed=false;
  for(const [id,entry] of this.entries)if(!desired.has(id)||desired.get(id).signature!==entry.spec.signature){this.entries.delete(id);this.release(entry);changed=true;}
  for(const [id,spec] of desired){const entry=this.entries.get(id);if(!entry){this.entries.set(id,{spec,state:'queued'});changed=true;}else{entry.spec=spec;if(entry.state==='error'&&this.clock()>=entry.retryAt){entry.state='queued';changed=true;}}}
  this.pump();if(changed)this.onChange();
 }
 release(entry){entry.cancel?.();entry.removeError?.();if(entry.model){this.dispose(entry.model);entry.model=null;}}
 fail(entry){if(this.entries.get(entry.spec.id)!==entry||entry.state==='error')return;this.release(entry);entry.state='error';entry.retryAt=this.clock()+60000;this.onChange();}
 pump(){
  for(const entry of this.entries.values()){
   if(this.loading>=this.concurrency)break;if(entry.state!=='queued')continue;this.loading++;entry.state='loading';
   const current=()=>this.entries.get(entry.spec.id)===entry;
   Promise.resolve().then(()=>this.load(entry.spec)).then(model=>{
    if(!current()){this.dispose(model);return;}entry.model=model;
    entry.removeError=model.errorEvent?.addEventListener(()=>queueMicrotask(()=>this.fail(entry)));
    entry.cancel=this.watch(model,{current,ready:()=>{if(current()&&entry.state!=='error'){entry.state='ready';this.onChange();}},failed:()=>queueMicrotask(()=>this.fail(entry))});
   }).catch(()=>this.fail(entry)).finally(()=>{this.loading--;this.pump();});
  }
 }
 state(id){return this.entries.get(id)?.state??'waiting';}
 ready(id){const entry=this.entries.get(id);return entry?.state==='ready'?entry.model:null;}
}

export class SpacecraftTerrainModels{
 constructor(viewer,{qualityAt,view,enabled,accepts,modelFor,items,onChange}){
  Object.assign(this,{viewer,qualityAt,view,enabled,accepts,modelFor,items,onChange});this.forceId=null;
  const C=window.Cesium,scene=viewer.scene;
  this.pool=new TerrainModelPool({
   // Fixed world scale preserves perspective instead of shrinking on approach.
   load:spec=>loadMarsModel(C,{url:spec.model.url,modelMatrix:C.Transforms.eastNorthUpToFixedFrame(spec.position,scene.globe.ellipsoid),heightReference:C.HeightReference.CLAMP_TO_GROUND,scene,asynchronous:false,scale:spec.scale,minimumPixelSize:0,backFaceCulling:false,enableVerticalExaggeration:false,id:{spacecraftId:spec.id,terrainSpacecraftModel:true}}),
   dispose:model=>{if(!scene.primitives.remove(model)&&!model.isDestroyed())model.destroy();scene.requestRender();},
   watch:(model,callbacks)=>{scene.primitives.add(model);scene.requestRender();return requestModelReady(model,scene,callbacks);},
   onChange:()=>{this.onChange?.();scene.requestRender();}
  });
  viewer.camera.changed.addEventListener(()=>this.schedule());viewer.camera.moveEnd.addEventListener(()=>this.schedule());scene.globe.tileLoadProgressEvent.addEventListener(()=>this.schedule());
  this.heartbeat=setInterval(()=>{if(!document.hidden)this.schedule();},2000);this.heartbeat.unref?.();
 }
 schedule(){if(this.scheduled)return;this.scheduled=setTimeout(()=>{this.scheduled=null;this.update();},160);}
 placement(item,model=this.modelFor(item)){
  const C=window.Cesium,ellipsoid=this.viewer.scene.globe.ellipsoid,l=item.location,geometry=spacecraftDisplayGeometry(model);
  const terrain=this.viewer.scene.globe.getHeight(C.Cartographic.fromDegrees(l.lon_east,l.lat_planetocentric))??0,position=C.Cartesian3.fromDegrees(l.lon_east,l.lat_planetocentric,terrain,ellipsoid);
  const up=ellipsoid.geodeticSurfaceNormal(position,new C.Cartesian3()),center=C.Cartesian3.add(position,C.Cartesian3.multiplyByScalar(up,geometry.height/2,new C.Cartesian3()),new C.Cartesian3());
  return {...geometry,position,bounds:new C.BoundingSphere(center,geometry.radius)};
 }
 frame(item){
  const C=window.Cesium,model=this.ready(item.id),bounds=model?.boundingSphere??this.placement(item).bounds;
  this.viewer.camera.flyToBoundingSphere(bounds,{duration:1.8,offset:new C.HeadingPitchRange(.65,-.35,bounds.radius*3.2)});
 }
 update(){
  const C=window.Cesium,scene=this.viewer.scene,camera=this.viewer.camera,canvas=this.viewer.canvas,width=canvas.clientWidth,height=canvas.clientHeight;
  if(!this.enabled()||this.view()==='2d'||!width||!height){this.pool.setDesired([]);return;}
  const specs=[],culling=camera.frustum.computeCullingVolume(camera.positionWC,camera.directionWC,camera.upWC);
  for(const item of this.items()){
   const model=this.modelFor(item);if(!model||!hasSurfacePosition(item)||!this.accepts(item))continue;
   const l=item.location,placement=this.placement(item,model),{position,scale}=placement,distance=C.Cartesian3.distance(camera.positionWC,position);
   // Test the full enlarged mesh, not its ground anchor: a nearby model can
   // fill the view even with its anchor off screen or behind the camera.
   const bounds=this.ready(item.id)?.boundingSphere??placement.bounds,inView=culling.computeVisibility(bounds)!==C.Intersect.OUTSIDE;
   const pixelMetres=camera.getPixelSize(new C.BoundingSphere(position,1),width,height),quality=this.qualityAt?.(l.lon_east,l.lat_planetocentric);
   if(!terrainModelEligible({located:true,hasModel:true,visible:true,inView,view:this.view(),quality,pixelMetres,distance,forced:this.forceId===item.id,admitted:this.pool.entries.has(item.id)}))continue;
   specs.push({id:item.id,item,model,position,scale,distance,signature:`${model.id}:${l.lon_east}:${l.lat_planetocentric}:${scale}`});
  }
  specs.sort((a,b)=>(b.id===this.forceId)-(a.id===this.forceId)||a.distance-b.distance);this.pool.setDesired(specs);
 }
 focus(item){this.forceId=item.id;this.schedule();}
 clearFocus(){this.forceId=null;this.schedule();}
 state(id){return this.pool.state(id);}
 ready(id){return this.pool.ready(id);}
}

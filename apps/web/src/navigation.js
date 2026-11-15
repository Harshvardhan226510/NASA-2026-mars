import {cameraClearance} from './terrain-transition.js';
export const orbitPitch=value=>Math.max(-Math.PI/2+.02,Math.min(-.18,value));
export const groundSpeeds=Object.freeze({precise:8,explore:80,fast:400});
const WALK_EYE_HEIGHT=2, MARS_GRAVITY=3.71;
export function groundSteps(held,dt,speed=groundSpeeds.explore,vertical=true){
 const f=Number(held.has('KeyW'))-Number(held.has('KeyS')),r=Number(held.has('KeyD'))-Number(held.has('KeyA'));
 const v=vertical?Number(held.has('Space'))-Number(held.has('ShiftLeft')||held.has('ShiftRight')):0;
 const seconds=Math.max(0,Math.min(.25,Number(dt)||0)),step=speed*seconds/Math.max(1,Math.hypot(f,r,v));
 return [f*step,r*step,v*step];
}
export class MapNavigation{
 constructor(viewer,{dataset,surface,onMode}){
  this.viewer=viewer;this.dataset=dataset;this.surface=surface;this.onMode=onMode;this.mode='pan';this.drag=null;this.held=new Set();this.groundSpeed=groundSpeeds.explore;
  const C=window.Cesium,h=this.handler=new C.ScreenSpaceEventHandler(viewer.canvas);
  h.setInputAction(e=>this.begin(e.position,false),C.ScreenSpaceEventType.LEFT_DOWN);
  h.setInputAction(e=>this.begin(e.position,true),C.ScreenSpaceEventType.RIGHT_DOWN);
  h.setInputAction(()=>{this.drag=null;},C.ScreenSpaceEventType.LEFT_UP);h.setInputAction(()=>{this.drag=null;},C.ScreenSpaceEventType.RIGHT_UP);
  h.setInputAction(e=>{this.pointer=e.endPosition;this.move(e.endPosition);},C.ScreenSpaceEventType.MOUSE_MOVE);
  h.setInputAction(delta=>{if(this.regional)this.zoom(delta);},C.ScreenSpaceEventType.WHEEL);
  viewer.canvas.tabIndex=0;viewer.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  viewer.canvas.addEventListener('keydown',e=>this.key(e));
  viewer.canvas.addEventListener('keyup',e=>this.held.delete(e.code));viewer.canvas.addEventListener('blur',()=>this.held.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.held.clear();});
  // Recheck the ground even when the camera is stationary and tiles are swapping.
  viewer.scene.postRender.addEventListener(()=>{
   this.renderedRelief=viewer.scene.verticalExaggeration;
   if(this.regional)this.clamp();
  });
  let previous=performance.now();
  const tick=now=>{
   const dt=(now-previous)/1000;previous=now;
   if(this.jumpMotion)this.advanceJump(dt);
   if(this.held.size)this.walk(dt);else if(this.jumpMotion)this.clamp();
   requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
 }
 sync(){const C=window.Cesium,native=!this.spaceFocus?.()&&(this.mode==='ground'||this.viewer.camera.positionCartographic.height<800000),c=this.viewer.scene.screenSpaceCameraController;if(this.regional!==native)this.drag=null;this.regional=native;for(const key of ['enableRotate','enableTranslate','enableTilt','enableZoom','enableLook'])c[key]=!native;c.rotateEventTypes=this.mode==='rotate'?[C.CameraEventType.RIGHT_DRAG]:[C.CameraEventType.LEFT_DRAG];c.tiltEventTypes=this.mode==='rotate'?[C.CameraEventType.LEFT_DRAG]:[C.CameraEventType.RIGHT_DRAG];this.viewer.canvas.style.cursor=this.mode==='ground'?'crosshair':this.mode==='pan'?'grab':'crosshair';}
 setMode(mode){
  const wasGround=this.mode==='ground',scene=this.viewer.scene,g=scene.globe,c=scene.screenSpaceCameraController;
  this.mode=mode;this.held.clear();this.drag=null;this.jumpMotion=null;this.groundFloor=null;this.renderedFloor=null;this.sync();this.onMode?.(mode);
  if(mode==='ground'&&!wasGround){
   const target=this.point(this.centre());
   if(!target){this.setMode('pan');return;}
   this.groundRelief=scene.verticalExaggeration??1;
   this.surface()?.setExaggeration(1);scene.verticalExaggeration=1;
   this.groundGlobeSettings={tileCacheSize:g.tileCacheSize,preloadSiblings:g.preloadSiblings};
   this.groundCollisionSetting=c.enableCollisionDetection;
   c.enableCollisionDetection=false;
   g.tileCacheSize=768;g.preloadSiblings=true;
   this.land(target,this.renderedRelief??this.groundRelief);
  }else if(wasGround&&mode!=='ground'&&this.groundGlobeSettings){
   const scale=this.groundRelief;
   this.surface()?.setExaggeration(scale);scene.verticalExaggeration=scale;
   Object.assign(g,this.groundGlobeSettings);this.groundGlobeSettings=null;
   c.enableCollisionDetection=this.groundCollisionSetting;
   scene.requestRender();
  }
 }
 point(screen){
  const C=window.Cesium,scene=this.viewer.scene,camera=this.viewer.camera,ellipsoid=scene.globe.ellipsoid,d=this.dataset();
  const ground=scene.globe.pick?.(camera.getPickRay(screen),scene);if(ground&&(this.surface()?.terrain||!d))return ground;
  // Space navigation targets Mars, not the depth of a moon, an orbiter or a
  // translucent trajectory. Reuse loaded terrain without rendering a pick pass.
  if(this.spaceFocus?.())return ground??camera.pickEllipsoid(screen,ellipsoid);
  if(scene.pickPositionSupported)try{const hit=scene.pickPosition(screen);if(hit)return hit;}catch{}
  if(ground)return ground;
  if(!d)return camera.pickEllipsoid(screen,ellipsoid);
  const lon=(d.bounds[0]+d.bounds[2])/2,lat=(d.bounds[1]+d.bounds[3])/2,height=this.surface()?.sampleHeight(lon,lat)??0;
  const anchor=C.Cartesian3.fromDegrees(lon,lat,height,ellipsoid),plane=C.Plane.fromPointNormal(anchor,ellipsoid.geodeticSurfaceNormal(anchor));
  return C.IntersectionTests.rayPlane(camera.getPickRay(screen),plane)??camera.pickEllipsoid(screen,ellipsoid);
 }
 centre(){return new window.Cesium.Cartesian2(this.viewer.canvas.clientWidth/2,this.viewer.canvas.clientHeight/2);}
 begin(screen,right){
  if(!this.regional)return;const C=window.Cesium,camera=this.viewer.camera,target=this.mode==='ground'?C.Cartesian3.clone(camera.positionWC):this.point(screen);if(!target)return;
  camera.cancelFlight();this.viewer.canvas.focus({preventScroll:true});
  this.drag={target,start:C.Cartesian2.clone(screen),heading:camera.heading,pitch:camera.pitch,range:C.Cartesian3.distance(camera.positionWC,target),rotate:right||this.mode==='rotate',plane:C.Plane.fromPointNormal(target,this.viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(target))};
 }
 move(screen){
  const d=this.drag;if(!d)return;const C=window.Cesium,camera=this.viewer.camera;
  if(this.mode==='ground')camera.setView({orientation:{heading:d.heading-(screen.x-d.start.x)*.004,pitch:Math.max(-1.45,Math.min(1.1,d.pitch+(screen.y-d.start.y)*.004)),roll:0}});
  else if(d.rotate){camera.lookAt(d.target,new C.HeadingPitchRange(d.heading-(screen.x-d.start.x)*.005,orbitPitch(d.pitch+(screen.y-d.start.y)*.005),Math.max(8,d.range)));camera.lookAtTransform(C.Matrix4.IDENTITY);}
  else{const hit=C.IntersectionTests.rayPlane(camera.getPickRay(screen),d.plane);if(hit){const delta=C.Cartesian3.subtract(d.target,hit,new C.Cartesian3()),length=C.Cartesian3.magnitude(delta);if(length>0)camera.move(C.Cartesian3.normalize(delta,delta),length);}}
  this.clamp();this.viewer.scene.requestRender();
 }
 zoom(delta,centre=false){
  if(this.focusZoom?.(delta))return;
  const C=window.Cesium,camera=this.viewer.camera;camera.cancelFlight();
  if(this.mode==='ground'){
   const normal=this.viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(camera.positionWC);
   const direction=this.tangentDirection(camera.directionWC,normal);
   if(C.Cartesian3.magnitude(direction)>0)camera.move(direction,Math.sign(delta)*this.groundSpeed*.5);
   this.clamp();this.viewer.scene.requestRender();return;
  }
  if(!this.regional){delta>0?camera.zoomIn(camera.positionCartographic.height*.3):camera.zoomOut(camera.positionCartographic.height*.4);return;}
  const target=this.point(centre?this.centre():this.pointer??this.centre());if(!target)return;
  const vector=C.Cartesian3.subtract(target,camera.positionWC,new C.Cartesian3()),distance=C.Cartesian3.magnitude(vector);
  const requested=distance*(1-Math.exp(-Math.max(-300,Math.min(300,delta))*.0025)),amount=requested>0?Math.min(Math.max(0,distance-6),requested):requested;
  if(distance>0){const direction=amount<0?this.viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(camera.positionWC):C.Cartesian3.normalize(vector,vector);camera.move(direction,Math.abs(amount));}this.clamp();this.viewer.scene.requestRender();
 }
 north(){const C=window.Cesium,c=this.viewer.camera;
  if(this.mode==='ground'){c.setView({orientation:{heading:0,pitch:c.pitch,roll:0}});this.viewer.scene.requestRender();return;}
  const target=this.point(this.centre());if(!target)return;c.lookAt(target,new C.HeadingPitchRange(0,orbitPitch(c.pitch),C.Cartesian3.distance(c.positionWC,target)));c.lookAtTransform(C.Matrix4.IDENTITY);this.viewer.scene.requestRender();
 }
 focusOn(focus,metresPerPixel){
  if(!this.dataset())return;
  const C=window.Cesium,c=this.viewer.camera,surface=this.surface(),state=surface?.view();if(!state)return;
  const height=surface.sampleHeight(...focus)??0,target=C.Cartesian3.fromDegrees(...focus,height,this.viewer.scene.globe.ellipsoid);
  const range=Math.max(8,state.distance*metresPerPixel/state.perPixel);
  c.cancelFlight();c.lookAt(target,new C.HeadingPitchRange(c.heading,orbitPitch(c.pitch),range));c.lookAtTransform(C.Matrix4.IDENTITY);this.clamp();this.viewer.scene.requestRender();
 }
 terrainFloor(position){
  const C=window.Cesium,scene=this.viewer.scene,globe=scene.globe,ellipsoid=globe.ellipsoid;
  const surface=this.surface(),sample=surface?.sampleHeight(C.Math.toDegrees(position.longitude),C.Math.toDegrees(position.latitude));
  const scale=(scene.verticalExaggeration??1)/(this.renderedRelief??scene.verticalExaggeration??1);
  if(this.mode==='ground'){
   // Prefer the visible mesh over a cached tile with a different elevation.
   // The downward ray is independent of where the astronaut is looking.
   const ray=this.floorRay??=new C.Ray();
   C.Cartesian3.fromRadians(position.longitude,position.latitude,100_000,ellipsoid,ray.origin);
   ellipsoid.geodeticSurfaceNormalCartographic(position,ray.direction);
   C.Cartesian3.negate(ray.direction,ray.direction);
   const hit=globe.pick(ray,scene);
   const height=hit?ellipsoid.cartesianToCartographic(hit)?.height*scale:NaN;
   if(Number.isFinite(height))this.renderedFloor={longitude:position.longitude,latitude:position.latitude,height};
   const last=this.renderedFloor;
   const rendered=last&&Math.abs(position.longitude-last.longitude)<1e-10&&Math.abs(position.latitude-last.latitude)<1e-10?last.height:undefined;
   // Legacy observation previews are drawn as a separate mesh over the globe.
   if(Number.isFinite(rendered))return surface&&!surface.terrain&&Number.isFinite(sample)?Math.max(rendered,sample):rendered;
  }
  const heights=[globe.getHeight(position)*scale,sample];
  const floor=Math.max(...heights.filter(Number.isFinite));
  return Number.isFinite(floor)?floor:undefined;
 }
 clamp(){
  const C=window.Cesium,c=this.viewer.camera,p=c.positionCartographic,floor=this.terrainFloor(p);
  let safe=p.height;
  if(this.mode==='ground'){
   if(Number.isFinite(floor))this.groundFloor=floor;
   if(!Number.isFinite(this.groundFloor))return;
   const standing=this.groundFloor+WALK_EYE_HEIGHT,motion=this.jumpMotion;
   if(motion&&(motion.height<standing-.005||(motion.velocity<=0&&motion.height<=standing+.005)))this.jumpMotion=null;
   safe=this.jumpMotion?Math.max(standing,this.jumpMotion.height):standing;
  }else safe=cameraClearance(p.height,floor);
  if(safe===p.height||this.mode==='ground'&&Math.abs(safe-p.height)<=.005)return safe;
  c.position=C.Cartesian3.fromRadians(p.longitude,p.latitude,safe,this.viewer.scene.globe.ellipsoid);
  this.viewer.scene.requestRender();
  return safe;
 }
 land(target,renderedRelief){
  const C=window.Cesium,c=this.viewer.camera,ellipsoid=this.viewer.scene.globe.ellipsoid,p=ellipsoid.cartesianToCartographic(target);
  this.groundFloor=p.height/renderedRelief;
  c.cancelFlight();c.setView({destination:C.Cartesian3.fromRadians(p.longitude,p.latitude,this.groundFloor+WALK_EYE_HEIGHT,ellipsoid),orientation:{heading:c.heading,pitch:-.15,roll:0}});
  this.clamp();this.viewer.canvas.focus({preventScroll:true});
 }
 tangentDirection(direction,normal){
  const C=window.Cesium,projected=C.Cartesian3.subtract(direction,C.Cartesian3.multiplyByScalar(normal,C.Cartesian3.dot(direction,normal),new C.Cartesian3()),new C.Cartesian3());
  if(C.Cartesian3.magnitude(projected)>1e-5)return C.Cartesian3.normalize(projected,projected);
  return C.Cartesian3.ZERO;
 }
 walk(dt){
  const c=this.viewer.camera,ground=this.mode==='ground',speed=ground?this.groundSpeed:Math.max(this.groundSpeed,Math.abs(c.positionCartographic.height)*.2);
  const [f,r,v]=groundSteps(this.held,dt,speed,!ground);
  if(f||r||v){
   const normal=this.viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(c.positionWC);
   const forward=this.tangentDirection(c.directionWC,normal),right=this.tangentDirection(c.rightWC,normal);
   c.cancelFlight();if(f)c.move(forward,f);if(r)c.move(right,r);if(v)c.move(normal,v);
   this.viewer.scene.requestRender();
  }
  this.clamp();
 }
 advanceJump(dt){
  const motion=this.jumpMotion,seconds=Math.max(0,Math.min(.25,dt));
  motion.height+=motion.velocity*seconds-MARS_GRAVITY*seconds**2/2;
  motion.velocity-=MARS_GRAVITY*seconds;
 }
 key(e){
  if(e.key==='Escape'&&this.mode==='ground'){e.preventDefault();this.setMode('pan');return;}
  if(this.mode==='ground'&&e.code==='Space'){
   e.preventDefault();
   if(!e.repeat&&!this.jumpMotion){const height=this.clamp();if(Number.isFinite(height))this.jumpMotion={height,velocity:6};}
   return;
  }
  if(this.mode==='ground'&&(e.code==='ShiftLeft'||e.code==='ShiftRight'))return;
  if(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();if(!this.held.has(e.code)){this.held.add(e.code);this.walk(.1);}return;}
  const C=window.Cesium,c=this.viewer.camera,keys={ArrowUp:1,w:1,ArrowDown:-1,s:-1,ArrowRight:2,d:2,ArrowLeft:-2,a:-2},action=keys[e.key];
  if(e.key==='+'||e.key==='='){e.preventDefault();return this.zoom(160);}if(e.key==='-'){e.preventDefault();return this.zoom(-160);}if(!action)return;
  e.preventDefault();const target=this.point(this.centre());if(!target)return;const normal=this.viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(target),direction=action===2||action===-2?C.Cartesian3.clone(c.rightWC):C.Cartesian3.clone(c.directionWC);
  C.Cartesian3.subtract(direction,C.Cartesian3.multiplyByScalar(normal,C.Cartesian3.dot(direction,normal),new C.Cartesian3()),direction);
  c.move(C.Cartesian3.normalize(direction,direction),Math.max(2,C.Cartesian3.distance(c.positionWC,target)*.08)*Math.sign(action));this.clamp();this.viewer.scene.requestRender();
 }
}

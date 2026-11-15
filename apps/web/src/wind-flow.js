import {screenWindField,WindParticles} from './wind-flow-field.js';

class WindFlowCanvas{
 constructor({host,locate,project,position=()=>[0,0],subscribe}){
  Object.assign(this,{host,locate,project,position});this.canvas=document.createElement('canvas');this.canvas.className='wind-flow-canvas';this.canvas.setAttribute('aria-hidden','true');this.canvas.hidden=true;host.append(this.canvas);this.context=this.canvas.getContext('2d');this.opacity=.55;
  this.resize=new ResizeObserver(()=>this.invalidate());this.resize.observe(host);this.motion=matchMedia('(prefers-reduced-motion: reduce)');this.wake=()=>this.invalidate();this.motion.addEventListener('change',this.wake);document.addEventListener('visibilitychange',this.wake);this.bodyObserver=new MutationObserver(this.wake);this.bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});this.unsubscribe=subscribe(moving=>{this.moving=moving;this.invalidate();});
 }
 setData(grid){this.grid=grid;this.invalidate();}
 setOpacity(opacity){this.opacity=opacity;this.canvas.style.opacity=String(opacity);this.invalidate();}
 setEnabled(enabled){this.enabled=enabled;this.canvas.hidden=!enabled;this.invalidate();}
 invalidate(){this.dirty=true;this.last=0;this.context.clearRect(0,0,this.canvas.width,this.canvas.height);if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;if(this.enabled&&this.opacity>0&&!this.moving&&!document.hidden)this.frame=requestAnimationFrame(t=>this.tick(t));}
 visible(){return this.host.clientWidth>0&&this.host.clientHeight>0&&this.host.getClientRects().length>0&&getComputedStyle(this.host).visibility!=='hidden';}
 rebuild(){
  const width=this.host.clientWidth,height=this.host.clientHeight,ratio=Math.min(1.5,devicePixelRatio||1),[left,top]=this.position();this.canvas.width=Math.round(width*ratio);this.canvas.height=Math.round(height*ratio);Object.assign(this.canvas.style,{width:width+'px',height:height+'px',left:left+'px',top:top+'px'});this.context.setTransform(ratio,0,0,ratio,0,0);this.width=width;this.height=height;
  this.field=screenWindField(this.grid,width,height,this.locate,this.project);this.particles=new WindParticles(this.field);this.canvas.dataset.particles=String(this.particles.particles.length);this.canvas.dataset.frames='0';this.dirty=false;
  // Seed visible trails immediately, including a static rendition for reduced motion.
  for(let i=0;i<6;i++)this.paint(.04);
 }
 paint(dt){
  const c=this.context;c.globalCompositeOperation='destination-in';c.fillStyle=`rgba(0,0,0,${Math.pow(.965,dt/.04)})`;c.fillRect(0,0,this.width,this.height);c.globalCompositeOperation='source-over';c.beginPath();let segments=0;
  this.particles.advance(dt,(x,y,a,b)=>{c.moveTo(x,y);c.lineTo(a,b);segments++;});c.lineWidth=.8;c.strokeStyle='rgba(240,255,255,0.72)';c.stroke();this.canvas.dataset.segments=String(segments);
 }
 tick(time){
  this.frame=0;if(!this.enabled||this.opacity<=0||this.moving||document.hidden||!this.visible()||!this.grid)return;
  if(this.dirty)this.rebuild();if(!this.last||time-this.last>=32){if(this.last)this.paint(Math.min(.08,(time-this.last)/1000));this.last=time;this.canvas.dataset.frames=String(Number(this.canvas.dataset.frames)+1);}
  if(!this.motion.matches&&this.field.seeds.length)this.frame=requestAnimationFrame(t=>this.tick(t));
 }
}

export function createWindFlows(viewer,maps){
 const C=window.Cesium,scene=viewer.scene,ellipsoid=scene.globe.ellipsoid,scratch=new C.Cartesian2();
 const globe=new WindFlowCanvas({host:viewer.container,
  locate:(x,y)=>{scratch.x=x;scratch.y=y;const ray=viewer.camera.getPickRay(scratch),close=viewer.camera.positionCartographic.height<200000;const hit=(close&&ray?scene.globe.pick(ray,scene):null)??viewer.camera.pickEllipsoid(scratch,ellipsoid);if(!hit)return null;const p=ellipsoid.cartesianToCartographic(hit);return [C.Math.toDegrees(p.longitude),C.Math.toDegrees(p.latitude),p.height];},
  project:(lon,lat,height)=>{const p=C.SceneTransforms.worldToWindowCoordinates(scene,C.Cartesian3.fromDegrees(lon,lat,height,ellipsoid));return p?[p.x,p.y]:null;},
  subscribe:change=>{const off=[viewer.camera.moveStart.addEventListener(()=>change(true)),viewer.camera.moveEnd.addEventListener(()=>change(false)),viewer.camera.changed.addEventListener(()=>{if(!globe.moving)change(false);}),scene.postRender.addEventListener(()=>{if(globe.enabled&&globe.opacity>0&&!globe.frame&&!globe.moving&&!document.hidden&&!globe.motion.matches&&globe.visible())globe.invalidate();})];return ()=>off.forEach(f=>f());}
 });
 const flat=maps.map(map=>{
  const pane=map.getPane('windFlow')??map.createPane('windFlow');pane.style.zIndex='355';pane.style.pointerEvents='none';
  // The pane moves with Leaflet; cancel that translation at each settled view.
  const flow=new WindFlowCanvas({host:map.getContainer(),position:()=>{const p=map.containerPointToLayerPoint([0,0]);return [p.x,p.y];},locate:(x,y)=>{const p=map.containerPointToLatLng([x,y]);return [p.lng,p.lat,0];},project:(lon,lat)=>{const p=map.project([lat,lon]);return [p.x,p.y];},subscribe:change=>{const start=()=>change(true),end=()=>change(false);map.on('movestart zoomstart',start);map.on('moveend zoomend resize',end);return ()=>{map.off('movestart zoomstart',start);map.off('moveend zoomend resize',end);};}});
  pane.append(flow.canvas);return flow;
 });return [globe,...flat];
}

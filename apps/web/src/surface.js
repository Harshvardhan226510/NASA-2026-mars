import {R,intersects} from './raster.js';
import {recoverSurfaceRead} from './recovery.js';
import {planTiles} from './lod.js';
import {displayTile,packetTexture} from './display-tiles.js';
import {surfaceMaterialDefinition} from './surface-material.js';
export function spanMeters(bounds){const lat=(bounds[1]+bounds[3])/2*Math.PI/180;return [(bounds[2]-bounds[0])*Math.PI/180*R*Math.cos(lat),(bounds[3]-bounds[1])*Math.PI/180*R];}
export function distanceToFootprint(bounds,lon,lat,height){const x=Math.max(bounds[0],Math.min(bounds[2],lon)),y=Math.max(bounds[1],Math.min(bounds[3],lat));return Math.hypot((lon-x)*Math.PI/180*R*Math.cos(lat*Math.PI/180),(lat-y)*Math.PI/180*R,height);}
export function triangles(valid,width){const out=[];for(let y=0;y<width-1;y++)for(let x=0;x<width-1;x++){const a=y*width+x,b=a+1,c=a+width,d=c+1;if(valid[a]&&valid[b]&&valid[c])out.push(a,c,b);if(valid[b]&&valid[c]&&valid[d])out.push(b,c,d);}return new Uint32Array(out);}
export function splitBounds(b){const x=(b[0]+b[2])/2,y=(b[1]+b[3])/2;return [[b[0],y,x,b[3]],[x,y,b[2],b[3]],[b[0],b[1],x,y],[x,b[1],b[2],y]];}
export class Surface3D {
 constructor(viewer,raster,{onStatus,onError,onReady}={}){this.viewer=viewer;this.raster=raster;this.nodes=new Map();this.pending=0;this.generation=0;this.exaggeration=1;this.onStatus=onStatus;this.onError=onError;this.onReady=onReady;this.disposed=false;this.timer=null;this.lastMove=0;this.shown=[];this.root=this.node('overview',raster.dataset.bounds);this.removeChange=viewer.camera.changed.addEventListener(()=>{this.lastMove=performance.now();clearTimeout(this.timer);this.timer=setTimeout(()=>this.update(),120);});this.update();}
 node(id,bounds){if(!this.nodes.has(id))this.nodes.set(id,{id,bounds,state:'new',primitive:null,last:performance.now()});return this.nodes.get(id);}
 async build(node){
  if(node.state!=='new'||this.pending>=4||this.disposed)return;
  node.state='loading';this.pending++;this.onStatus?.(this.pending);
  const generation=this.generation,width=129,started=performance.now();node.controller=new AbortController();
  try{
   const [heights,texture]=await recoverSurfaceRead(async()=>{
    if(this.raster.dataset.status==='complete'){
     const packet=await displayTile(this.raster.dataset,node.id,node.controller.signal);node.pixels=packet.pixels;packet.heights.gridMeters=packet.terrainGrid;
     return [packet.heights,packetTexture(packet)];
    }
    return Promise.all([this.raster.read(node.bounds,width,width,{kind:'terrain',nodes:true}),this.raster.texture(node.bounds,512)]);
   },{alive:()=>!this.disposed&&generation===this.generation&&!node.controller.signal.aborted,onRetry:attempt=>this.onStatus?.(this.pending,{retrying:true,attempt})});
   if(this.disposed||generation!==this.generation)return;
   node.heights=heights;node.texture=texture;node.imageMeters=texture.gridMeters;node.terrainMeters=heights.gridMeters;
   const C=window.Cesium,ellipsoid=this.viewer.scene.globe.ellipsoid,positions=new Float64Array(width*width*3),st=new Float32Array(width*width*2),valid=new Uint8Array(width*width);
   for(let y=0;y<width;y++)for(let x=0;x<width;x++){
    const p=y*width+x,height=heights[p],lon=node.bounds[0]+x/(width-1)*(node.bounds[2]-node.bounds[0]),lat=node.bounds[3]-y/(width-1)*(node.bounds[3]-node.bounds[1]);valid[p]=Number.isFinite(height)?1:0;
    const h=Number.isFinite(height)?height*this.exaggeration:0;
    const v=C.Cartesian3.fromDegrees(lon,lat,h,ellipsoid);positions.set([v.x,v.y,v.z],p*3);st.set([x/(width-1),1-y/(width-1)],p*2);
   }
   const indices=triangles(valid,width);
   if(indices.length){
    const geometry=new C.Geometry({attributes:{position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values:positions}),st:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:st})},indices,primitiveType:C.PrimitiveType.TRIANGLES,boundingSphere:C.BoundingSphere.fromVertices(positions)});
    C.GeometryPipeline.computeNormal(geometry);
    const material=new C.Material(surfaceMaterialDefinition(texture));
    material.uniforms.image=texture;
    node.primitive=this.viewer.scene.primitives.add(new C.Primitive({geometryInstances:new C.GeometryInstance({geometry}),appearance:new C.MaterialAppearance({material,translucent:false,flat:true,faceForward:true}),asynchronous:false,show:false}));
   }
   node.state='ready';node.spacing=Math.max(...spanMeters(node.bounds))/(width-1);this.onReady?.();this.viewer.scene.requestRender();console.info('surface_patch_ready',node.id,Math.round(performance.now()-started)+'ms');
  }catch(error){if(!this.disposed&&generation===this.generation){node.state=node.controller.signal.aborted?'new':'error';if(node.state==='error')this.onError?.(error);}}finally{this.pending--;if(!this.disposed){this.onStatus?.(this.pending);this.update();}}
 }
 sampleHeight(lon,lat){
  const nodes=[...this.nodes.values()].filter(n=>n.heights&&lon>=n.bounds[0]&&lon<=n.bounds[2]&&lat>=n.bounds[1]&&lat<=n.bounds[3]).sort((a,b)=>a.spacing-b.spacing);
  for(const n of nodes){const x=(lon-n.bounds[0])/(n.bounds[2]-n.bounds[0])*128,y=(n.bounds[3]-lat)/(n.bounds[3]-n.bounds[1])*128,i=Math.min(127,Math.floor(x)),j=Math.min(127,Math.floor(y)),u=x-i,v=y-j;
   const h=[n.heights[j*129+i],n.heights[j*129+i+1],n.heights[(j+1)*129+i],n.heights[(j+1)*129+i+1]];
   if(h.every(Number.isFinite))return (h[0]*(1-u)*(1-v)+h[1]*u*(1-v)+h[2]*(1-u)*v+h[3]*u*v)*this.exaggeration;
  }
  return undefined;
 }
 sourceElevation(lon,lat){const height=this.sampleHeight(lon,lat);return Number.isFinite(height)?height/this.exaggeration:undefined;}
 setImageryVisible(show){this.imageryVisible=show;this.update();}
 qualityAt(lon,lat){
  const n=this.shown.find(n=>lon>=n.bounds[0]&&lon<=n.bounds[2]&&lat>=n.bounds[1]&&lat<=n.bounds[3]);
  if(!n||!Number.isFinite(this.sampleHeight(lon,lat)))return null;
  const x=Math.max(0,Math.min(511,Math.floor((lon-n.bounds[0])/(n.bounds[2]-n.bounds[0])*512))),y=Math.max(0,Math.min(511,Math.floor((n.bounds[3]-lat)/(n.bounds[3]-n.bounds[1])*512)));
  const alpha=n.pixels?n.pixels[(y*512+x)*2+1]:n.texture.getContext('2d').getImageData(x,y,1,1).data[3];
  return alpha?{imagery:n.imageMeters,terrain:n.terrainMeters,mesh:n.spacing}:null;
 }
 view(){
  const C=window.Cesium,camera=this.viewer.camera,ellipsoid=this.viewer.scene.globe.ellipsoid,rect=camera.computeViewRectangle(ellipsoid),b=this.raster.dataset.bounds;
  const centre=new C.Cartesian2(this.viewer.canvas.clientWidth/2,this.viewer.canvas.clientHeight/2);let point;
  if(this.terrain)point=this.viewer.scene.globe.pick?.(camera.getPickRay(centre),this.viewer.scene);
  if(!point&&!this.terrain&&this.viewer.scene.pickPositionSupported)try{point=this.viewer.scene.pickPosition(centre);}catch{}
  point??=this.viewer.scene.globe.pick?.(camera.getPickRay(centre),this.viewer.scene);
  point??=camera.pickEllipsoid(centre,ellipsoid);
  const carto=point?ellipsoid.cartesianToCartographic(point):camera.positionCartographic;
  const focus=[C.Math.toDegrees(carto.longitude),C.Math.toDegrees(carto.latitude)];
  let visible=rect?[C.Math.toDegrees(rect.west),C.Math.toDegrees(rect.south),C.Math.toDegrees(rect.east),C.Math.toDegrees(rect.north)]:b;
  const position=camera.positionCartographic,above=Math.max(8,position.height-(this.sampleHeight(C.Math.toDegrees(position.longitude),C.Math.toDegrees(position.latitude))??this.sampleHeight(...focus)??0));
  const distance=point?C.Cartesian3.distance(camera.positionWC,point):distanceToFootprint([focus[0]-.000001,focus[1]-.000001,focus[0]+.000001,focus[1]+.000001],C.Math.toDegrees(position.longitude),C.Math.toDegrees(position.latitude),above);
  if(point){
   const plane=C.Plane.fromPointNormal(point,ellipsoid.geodeticSurfaceNormal(point)),corners=[];
   for(const [x,y] of [[0,0],[this.viewer.canvas.clientWidth,0],[0,this.viewer.canvas.clientHeight],[this.viewer.canvas.clientWidth,this.viewer.canvas.clientHeight]]){
    const p=C.IntersectionTests.rayPlane(camera.getPickRay(new C.Cartesian2(x,y)),plane);
    if(p&&C.Cartesian3.distance(camera.positionWC,p)<distance*20){const c=ellipsoid.cartesianToCartographic(p);corners.push([C.Math.toDegrees(c.longitude),C.Math.toDegrees(c.latitude)]);}
   }
   if(corners.length>=3)visible=[Math.min(...corners.map(c=>c[0])),Math.min(...corners.map(c=>c[1])),Math.max(...corners.map(c=>c[0])),Math.max(...corners.map(c=>c[1]))];
  }
  const perPixel=2*Math.tan((camera.frustum.fovy??Math.PI/3)/2)*distance/Math.max(1,this.viewer.canvas.clientHeight);
  // Add a modest margin so ordinary pans reuse already displayed neighbours.
  const dx=(visible[2]-visible[0])*.15,dy=(visible[3]-visible[1])*.15;visible=[visible[0]-dx,visible[1]-dy,visible[2]+dx,visible[3]+dy];
  return {focus,visible,perPixel,distance};
 }
 update(){
  if(this.disposed)return;if(this.root.state==='new')this.build(this.root);
  const {visible,focus,perPixel}=this.view();
  const rootEnough=this.root.state==='ready'&&this.root.imageMeters<=perPixel*1.3&&this.root.spacing<=perPixel*4;
  const desired=rootEnough?[this.root]:planTiles(this.raster.dataset,visible,perPixel,focus).map(t=>this.node(t.id,t.bounds));
  const plan=desired.map(n=>n.id).join(',');if(plan!==this.lastPlan){this.lastPlan=plan;console.info('surface_plan',desired.length,desired[0]?.id,'screen '+perPixel.toFixed(2)+'m/px');}
  const requested=new Set(desired);for(const n of this.nodes.values())if(n!==this.root&&n.state==='loading'&&!requested.has(n)&&performance.now()-this.lastMove>=115)n.controller?.abort();
  if(this.root.state==='ready'&&performance.now()-this.lastMove>=115)for(const n of desired)if(n.state==='new'&&this.pending<4)this.build(n);
  let shown=this.shown;
  if(desired.length&&desired.every(n=>n.state==='ready'))shown=desired;
  else if(!shown.length||!shown.some(n=>intersects(n.bounds,visible)))shown=this.root.state==='ready'?[this.root]:[];
  for(const n of this.nodes.values())if(n.primitive)n.primitive.show=false;
  this.shown=shown;for(const n of shown)if(n.primitive){n.primitive.show=this.imageryVisible!==false;n.last=performance.now();}this.viewer.scene.requestRender();
  if(shown.length){const q=this.qualityAt(...focus),native=Math.max(...this.raster.dataset.imagery_grid_m);this.onStatus?.(this.pending,{meshMeters:q?.mesh??Math.max(...shown.map(n=>n.spacing)),imageMeters:q?.imagery??Math.max(...shown.map(n=>n.imageMeters)),quality:q,focus,perPixel,refining:desired.some(n=>n.state!=='ready'),highDetail:Boolean(q&&q.imagery<=native*2&&q.terrain<=Math.max(...this.raster.dataset.dem_grid_m)*2)});}
  const wanted=new Set([this.root,...shown,...desired]);const remove=[...this.nodes.values()].filter(n=>n.state!=='loading'&&!wanted.has(n)).sort((a,b)=>a.last-b.last);
  while(this.nodes.size>64&&remove.length){const n=remove.shift();if(n.primitive)this.viewer.scene.primitives.remove(n.primitive);this.nodes.delete(n.id);}
 }
 setExaggeration(value){if(this.exaggeration===value)return;this.exaggeration=value;this.generation++;this.shown=[];for(const n of this.nodes.values()){n.controller?.abort();if(n.primitive)this.viewer.scene.primitives.remove(n.primitive);n.primitive=null;n.state='new';}this.update();}
 destroy(){this.disposed=true;this.generation++;clearTimeout(this.timer);this.removeChange();for(const n of this.nodes.values()){n.controller?.abort();if(n.primitive)this.viewer.scene.primitives.remove(n.primitive);}this.nodes.clear();}
}

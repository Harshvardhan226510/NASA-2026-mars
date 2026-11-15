import {measurementRenderLegs,marsDistance} from './measurement-geometry.js';
// Render coordinates only: never change the saved points or distance model.
export function terrainMeasurementLegs(points){
 return measurementRenderLegs(points).map(leg=>{
  const out=[leg[0]];
  for(let i=1;i<leg.length;i++){
   const a=leg[i-1],b=leg[i],n=Math.min(512,Math.max(1,Math.ceil(marsDistance(a,b)/25)));
   // The existing arc sampler preserves polar/dateline geodesics. Subdivide
   // each bounded edge on the sphere instead of interpolating longitude.
   const toVector=([lon,lat])=>{lon*=Math.PI/180;lat*=Math.PI/180;return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];};
   const u=toVector(a),v=toVector(b),angle=marsDistance(a,b)/3396190,sine=Math.sin(angle);
   for(let j=1;j<n;j++){const t=j/n,left=Math.sin((1-t)*angle)/sine,right=Math.sin(t*angle)/sine,p=u.map((x,k)=>x*left+v[k]*right);out.push([Math.atan2(p[1],p[0])*180/Math.PI,Math.atan2(p[2],Math.hypot(p[0],p[1]))*180/Math.PI]);}
   out.push(b);
  }
  return out;
 });
}
export function measurementWorldPosition(C,scene,point,surface,clearanceScale=1){
 const cartographic=C.Cartographic.fromDegrees(...point);
 // getHeight returns the loaded rendered mesh height, including relief.
 // Surface3D also exposes displayed heights for its native preview mesh.
 const native=surface?.sampleHeight?.(...point),loaded=scene.globe.getHeight(cartographic);
 const height=Number.isFinite(native)?native:Number.isFinite(loaded)?loaded:0;
 const world=C.Cartesian3.fromDegrees(...point,height,scene.globe.ellipsoid),camera=scene.camera;
 const distance=camera?.positionWC&&C.Cartesian3.distance?C.Cartesian3.distance(world,camera.positionWC):0;
 // About 1.5 screen pixels avoids terrain-depth clipping at grazing angles.
 // Bounded visual clearance is shared by pins and lines, never measurements.
 const clearance=Math.max(3,Math.min(250,distance*2*Math.tan((camera?.frustum?.fovy??1)/2)/Math.max(1,scene.canvas?.clientHeight??1)*1.5));
 return C.Cartesian3.fromDegrees(...point,height+clearance*clearanceScale,scene.globe.ellipsoid);
}
export function measurementPositions(C,scene,points,surface=()=>null,clearanceScale=1){
 let positions,last=-Infinity,scale;
 return ()=>{
  const now=performance.now();
  if(!positions||now-last>250||scale!==scene.verticalExaggeration){positions=points.map(p=>measurementWorldPosition(C,scene,p,surface(),clearanceScale));last=now;scale=scene.verticalExaggeration;}
  return positions;
 };
}

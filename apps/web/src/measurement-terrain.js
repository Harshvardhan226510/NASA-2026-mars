import {measurementRenderLegs,marsDistance} from './measurement-geometry.js';
// Render coordinates only: never change the saved points or distance model.
export function terrainMeasurementLegs(points){
 return measurementRenderLegs(points).map(leg=>{
  const out=[leg[0]];
  for(let i=1;i<leg.length;i++){
   const a=leg[i-1],b=leg[i];
   const dist=marsDistance(a,b);
   const step=points.length<=2?25:100;
   const n=Math.min(512,Math.max(1,Math.ceil(dist/step)));
   // The existing arc sampler preserves polar/dateline geodesics. Subdivide
   // each bounded edge on the sphere instead of interpolating longitude.
   const toVector=([lon,lat])=>{lon*=Math.PI/180;lat*=Math.PI/180;return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];};
   const u=toVector(a),v=toVector(b),angle=dist/3396190,sine=Math.sin(angle);
   for(let j=1;j<n;j++){const t=j/n,left=Math.sin((1-t)*angle)/sine,right=Math.sin(t*angle)/sine,p=u.map((x,k)=>x*left+v[k]*right);out.push([Math.atan2(p[1],p[0])*180/Math.PI,Math.atan2(p[2],Math.hypot(p[0],p[1]))*180/Math.PI]);}
   out.push(b);
  }
  return out;
 });
}
export function measurementWorldPosition(C,scene,point,surface,clearanceScale=1,cachedHeight=null){
 const cartographic=C.Cartographic.fromDegrees(point[0],point[1]);
 const native=surface?.sampleHeight?.(point[0],point[1]);
 const loaded=Number.isFinite(cachedHeight)?cachedHeight:(Number.isFinite(native)?native:scene.globe?.getHeight?.(cartographic));
 const height=Number.isFinite(native)?native:Number.isFinite(loaded)?loaded:0;
 const world=C.Cartesian3.fromDegrees(point[0],point[1],height,scene.globe.ellipsoid),camera=scene.camera;
 const distance=camera?.positionWC&&C.Cartesian3.distance?C.Cartesian3.distance(world,camera.positionWC):0;
 // About 1.5 screen pixels avoids terrain-depth clipping at grazing angles.
 // Bounded visual clearance is shared by pins and lines, never measurements.
 const clearance=Math.max(3,Math.min(250,distance*2*Math.tan((camera?.frustum?.fovy??1)/2)/Math.max(1,scene.canvas?.clientHeight??1)*1.5));
 return C.Cartesian3.fromDegrees(point[0],point[1],height+clearance*clearanceScale,scene.globe.ellipsoid);
}
export function measurementPositions(C,scene,points,surface=()=>null,clearanceScale=1){
 let positions=null,last=-Infinity,scale=null,cachedHeights=null,lastSurf=null,allResolved=false;
 return (force=false)=>{
  const now=performance.now();
  const currentSurf=surface?.();
  const currentScale=scene?.verticalExaggeration;
  const reliefChanged=scale!==currentScale||currentSurf!==lastSurf;
  if(reliefChanged){
   cachedHeights=null;
   allResolved=false;
   scale=currentScale;
   lastSurf=currentSurf;
  }
  if(positions&&!reliefChanged&&!force&&(allResolved||now-last<500)){
   return positions;
  }
  if(!cachedHeights||cachedHeights.length!==points.length){
   cachedHeights=new Array(points.length).fill(null);
  }
  let missing=0;
  for(let i=0;i<points.length;i++){
   if(cachedHeights[i]===null){
    const p=points[i];
    const native=currentSurf?.sampleHeight?.(p[0],p[1]);
    if(Number.isFinite(native)){
     cachedHeights[i]=native;
    }else if(scene?.globe?.getHeight){
     const cartographic=C.Cartographic.fromDegrees(p[0],p[1]);
     const loaded=scene.globe.getHeight(cartographic);
     if(Number.isFinite(loaded)){
      cachedHeights[i]=loaded;
     }else{
      missing++;
     }
    }else{
     cachedHeights[i]=0;
    }
   }
  }
  allResolved=(missing===0);
  const camera=scene?.camera;
  const camPos=camera?.positionWC;
  const fovy=camera?.frustum?.fovy??1;
  const canvasHeight=Math.max(1,scene?.canvas?.clientHeight??1);
  const fovFactor=Math.tan(fovy/2)/canvasHeight*1.5;
  const ellipsoid=scene?.globe?.ellipsoid;
  positions=points.map((p,i)=>{
   const height=cachedHeights[i]??0;
   const world=C.Cartesian3.fromDegrees(p[0],p[1],height,ellipsoid);
   const distance=camPos&&C.Cartesian3.distance?C.Cartesian3.distance(world,camPos):0;
   const clearance=Math.max(3,Math.min(250,distance*2*fovFactor));
   return C.Cartesian3.fromDegrees(p[0],p[1],height+clearance*clearanceScale,ellipsoid);
  });
  last=now;
  return positions;
 };
}

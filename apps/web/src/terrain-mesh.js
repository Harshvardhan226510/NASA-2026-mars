const protectedMeshPrototypes=new WeakSet();
export function protectTerrainPickBounds(C){
 const mesh=C.TerrainMesh?.prototype;
 if(!mesh?.getTransform||protectedMeshPrototypes.has(mesh))return;
 const getTransform=mesh.getTransform,pickBox=new C.OrientedBoundingBox();
 // In Cesium 1.145, the pick transform writes exaggerated heights into the
 // same box the globe later uses to cull true-scale terrain. Give it scratch space.
 mesh.getTransform=function(mode,projection){
  const terrainBox=this.orientedBoundingBox;
  this.orientedBoundingBox=pickBox;
  try{return getTransform.call(this,mode,projection);}
  finally{this.orientedBoundingBox=terrainBox;}
 };
 protectedMeshPrototypes.add(mesh);
}

export function meshArrays(grid,width){
 const count=width*width,vertices=new Uint16Array(count*3),indices=new Uint16Array((width-1)**2*6);
 let minimumHeight=Infinity,maximumHeight=-Infinity;
 for(const h of grid){if(!Number.isFinite(h))throw new Error('Unknown mesh elevation');minimumHeight=Math.min(minimumHeight,h);maximumHeight=Math.max(maximumHeight,h);}
 const span=maximumHeight-minimumHeight||1;let k=0;
 for(let row=0;row<width;row++)for(let col=0;col<width;col++){
  const i=row*width+col;vertices[i]=Math.round(col/(width-1)*32767);vertices[count+i]=Math.round((1-row/(width-1))*32767);vertices[count*2+i]=Math.round((grid[i]-minimumHeight)/span*32767);
  if(row<width-1&&col<width-1){indices.set([i,i+width,i+1,i+1,i+width,i+width+1],k);k+=6;}
 }
 const westIndices=[],southIndices=[],eastIndices=[],northIndices=[];
 for(let i=0;i<width;i++){westIndices.push(i*width);eastIndices.push(i*width+width-1);northIndices.push(i);southIndices.push((width-1)*width+i);}
 return {quantizedVertices:vertices,indices,minimumHeight,maximumHeight,westIndices,southIndices,eastIndices,northIndices};
}
// Skirts close visual seams between adjacent elevation tiles and levels.
export function continuousMesh(C,ellipsoid,grid,bounds,childTileMask,error){
 const width=Math.sqrt(grid.length),data=meshArrays(grid,width),rectangle=C.Rectangle.fromDegrees(...bounds),positions=new Float64Array(27),p=new C.Cartesian3();
 // Bound the entire rectangle at its min/max height. A maximum-height envelope
 // is conservative for horizon culling and avoids 16,641 trig conversions/tile.
 // Bound the skirts too, otherwise a grazing view can cull the very geometry
 // that closes a crack. The source min/max still encode the physical heights.
 const skirt=Math.max(2000,Math.min(5000,data.maximumHeight-data.minimumHeight+error*4));
 const box=C.OrientedBoundingBox.fromRectangle(rectangle,data.minimumHeight-skirt,data.maximumHeight,ellipsoid);
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
  const i=row*3+col;C.Cartesian3.fromDegrees(bounds[0]+col/2*(bounds[2]-bounds[0]),bounds[3]-row/2*(bounds[3]-bounds[1]),data.maximumHeight,ellipsoid,p);positions[i*3]=p.x;positions[i*3+1]=p.y;positions[i*3+2]=p.z;
 }
 const boundingSphere=C.BoundingSphere.fromOrientedBoundingBox(box),occluder=new C.EllipsoidalOccluder(ellipsoid);
 // Cesium tests this point using the mesh's minimum surface height as the datum.
 // Skirts extend the frustum bounds only. A different datum distorts horizon culling.
 const horizonOcclusionPoint=occluder.computeHorizonCullingPointFromVerticesPossiblyUnderEllipsoid(boundingSphere.center,positions,3,C.Cartesian3.ZERO,data.minimumHeight);
 return new C.QuantizedMeshTerrainData({...data,boundingSphere,orientedBoundingBox:box,horizonOcclusionPoint,westSkirtHeight:skirt,southSkirtHeight:skirt,eastSkirtHeight:skirt,northSkirtHeight:skirt,childTileMask});
}

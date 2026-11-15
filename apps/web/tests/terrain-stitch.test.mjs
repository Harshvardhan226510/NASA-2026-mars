import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import Lerc from 'lerc';
import {stitchTerrainEdges} from '../src/terrain-stitch.js';import {decodeTopography,sampleHeight} from '../src/global-terrain.js';import {blendTerrain} from '../src/planet.js';import {geographicBounds} from '../src/planet-grid.js';
import {continuousMesh,protectTerrainPickBounds} from '../src/terrain-mesh.js';
const raw=gunzipSync(readFileSync(new URL('../public/mola-topography.dat',import.meta.url))),mola=decodeTopography(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
const reference=(lon,lat)=>sampleHeight(mola,lon,lat);
function source(y){const raw=readFileSync(new URL(`./fixtures/terrain-7-${y}-79.lerc`,import.meta.url)),d=Lerc.decode(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));return {grid:d.pixels[0],width:d.width,bounds:geographicBounds(79,y,7)};}
test('reported Sacra Mensa patches join without their 2.9 km height crack while retaining source interiors',()=>{
 const tiles=[source(47),source(48)],originals=tiles.map(t=>new Float32Array(t.grid)),grids=tiles.map(t=>blendTerrain(t,null,t.bounds)),fixed=tiles.map((t,i)=>stitchTerrainEdges(grids[i],129,t.bounds,t.bounds,reference));
 let before=0;for(let col=0;col<129;col++){before=Math.max(before,Math.abs(grids[0][128*129+col]-grids[1][col]));assert.equal(fixed[0][128*129+col],fixed[1][col]);}
 assert.ok(before>2800);for(let i=0;i<2;i++){assert.deepEqual(tiles[i].grid,originals[i]);assert.equal(fixed[i][64*129+64],grids[i][64*129+64]);assert.ok(fixed[i].every(Number.isFinite));}
});
test('source-edge reference remains identical for mixed rendered levels and children do not acquire internal fade strips',()=>{
 const tile=source(47),b=tile.bounds,midX=(b[0]+b[2])/2,midY=(b[1]+b[3])/2,child=[b[0],b[1],midX,midY],parent=stitchTerrainEdges(blendTerrain(tile,null,b),129,b,b,reference),fine=stitchTerrainEdges(blendTerrain(tile,null,child),129,child,b,reference);
 for(let col=0;col<=64;col++)assert.equal(fine[128*129+col*2],parent[128*129+col]);
 const untreated=blendTerrain(tile,null,child);assert.equal(fine[0*129+128],untreated[0*129+128],'child corner in the source interior retains fine elevation');
 const unknown=stitchTerrainEdges(untreated,129,child,b,()=>NaN);assert.deepEqual(unknown,untreated);
});
test('frustum bounds include skirts while horizon culling uses the physical height datum',()=>{
 const C={Rectangle:{fromDegrees:(...bounds)=>bounds},Cartesian3:class{static ZERO={};static fromDegrees(lon,lat,height,e,out){Object.assign(out,{x:lon,y:lat,z:height});}},OrientedBoundingBox:{fromRectangle:(bounds,min,max)=>({bounds,min,max})},BoundingSphere:{fromOrientedBoundingBox:box=>({center:{},box})},EllipsoidalOccluder:class{computeHorizonCullingPointFromVerticesPossiblyUnderEllipsoid(center,positions,stride,offset,minimumHeight){return {minimumHeight};}},QuantizedMeshTerrainData:class{constructor(options){Object.assign(this,options);}}};
 const data=continuousMesh(C,{},new Float32Array([-3200,-1000,-2500,-3000]),[-68,22,-67,23],15,50);
 assert.equal(data.minimumHeight,-3200);assert.equal(data.maximumHeight,-1000);assert.ok(data.westSkirtHeight>=2200);assert.equal(data.orientedBoundingBox.min,data.minimumHeight-data.westSkirtHeight);assert.equal(data.orientedBoundingBox.max,data.maximumHeight);
 assert.equal(data.horizonOcclusionPoint.minimumHeight,data.minimumHeight);
});
test('picking exaggerated terrain cannot overwrite a mesh’s physical visibility bounds',()=>{
 class OrientedBoundingBox{height=0;}
 class TerrainMesh{
  orientedBoundingBox={height:-3750};
  getTransform(displayHeight){this.orientedBoundingBox.height=displayHeight;return this.orientedBoundingBox.height;}
 }
 const C={TerrainMesh,OrientedBoundingBox},mesh=new TerrainMesh(),bounds=mesh.orientedBoundingBox;
 protectTerrainPickBounds(C);
 const wrapped=mesh.getTransform;
 protectTerrainPickBounds(C);
 assert.equal(mesh.getTransform,wrapped);
 assert.equal(mesh.getTransform(-11250),-11250);
 assert.equal(mesh.orientedBoundingBox,bounds);
 assert.equal(bounds.height,-3750);
});

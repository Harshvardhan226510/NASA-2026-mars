import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainMeasurementLegs,measurementWorldPosition,measurementPositions} from '../src/measurement-terrain.js';
import {lineDistances,marsDistance} from '../src/measurement-geometry.js';
const C={Cartographic:{fromDegrees:(lon,lat)=>({lon,lat})},Cartesian3:{fromDegrees:(lon,lat,height,ellipsoid)=>({lon,lat,height,ellipsoid})}};
test('local terrain-following lines keep exact endpoints and their original measured distance',()=>{
 const points=[[-99.7,23.8],[-99.6,23.7]],original=structuredClone(points),[leg]=terrainMeasurementLegs(points);
 assert.ok(marsDistance(leg[0],points[0])<1e-6);assert.ok(marsDistance(leg.at(-1),points[1])<1e-6);assert.ok(leg.length>100);
 assert.ok(lineDistances(leg).segments.every(d=>d<=25.001));
 assert.ok(Math.abs(lineDistances(leg).total-marsDistance(...points))<.001);assert.deepEqual(points,original);
});
test('pins and line endpoints share displayed terrain heights, including negative and exaggerated terrain',()=>{
 const scene={verticalExaggeration:3,globe:{ellipsoid:{},getHeight:()=>6000}},point=[-99.5,23.6];
 const pin=measurementWorldPosition(C,scene,point),positions=measurementPositions(C,scene,[point,[-99.7,23.8]])();
 assert.deepEqual(pin,positions[0]);assert.equal(pin.height,6003); // Already exaggerated: never multiply again.
 scene.globe.getHeight=()=>-12000;assert.equal(measurementWorldPosition(C,scene,point).height,-11997);
 assert.equal(measurementWorldPosition(C,scene,point,{sampleHeight:()=>7500}).height,7503);
 scene.globe.getHeight=()=>undefined;assert.equal(measurementWorldPosition(C,scene,point).height,3);
});
test('display positions update when relief changes without altering saved coordinates',()=>{
 const points=[[1,2],[2,3]],scene={verticalExaggeration:3,globe:{getHeight:()=>6000}};
 const get=measurementPositions(C,scene,points);assert.equal(get()[0].height,6003);
 scene.verticalExaggeration=1;scene.globe.getHeight=()=>2000;assert.equal(get()[0].height,2003);
 assert.deepEqual(points,[[1,2],[2,3]]);
});
test('grazing-angle depth clearance follows screen scale, stays bounded and matches pins to line ends',()=>{
 const context={...C,Cartesian3:{...C.Cartesian3,distance:()=>20000}};
 const scene={camera:{positionWC:{},frustum:{fovy:1}},canvas:{clientHeight:900},globe:{getHeight:()=>6000}};
 const point=[-99.5,23.6],pin=measurementWorldPosition(context,scene,point),line=measurementPositions(context,scene,[point])()[0];
 assert.deepEqual(pin,line);assert.ok(pin.height>6003&&pin.height<6250);
 context.Cartesian3.distance=()=>1e8;assert.equal(measurementWorldPosition(context,scene,point).height,6250);
});
test('polar and dateline display paths stay bounded and retain the shortest spherical path',()=>{
 for(const pair of [[[179.9,60],[-179.9,60]],[[0,89.9],[180,89.9]],[[0,0],[180,0]]]){
  const legs=terrainMeasurementLegs(pair);assert.ok(legs.flat().every(p=>p.every(Number.isFinite)));
  assert.ok(legs.flat().length<19000);
  assert.ok(Math.abs(legs.reduce((sum,leg)=>sum+lineDistances(leg).total,0)-marsDistance(...pair))<.1);
 }
});

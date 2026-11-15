import test from 'node:test';
import assert from 'node:assert/strict';
import {closestTriangle,terrainClearance,altitudeText} from '../src/camera-altitude.js';
import {missionWindow,routeProjection,ROUTE_MAX_CELLS,routeRenderLegs} from '../src/route-geometry.js';
const R=3396190;
test('clearance uses nearest point on a slope, rather than only the vertical height',()=>{
 const flat=terrainClearance([R+100,0,0],()=>({height:0,source:'test',spacing:1}));assert.ok(Math.abs(flat.distance-100)<.1);
 const hill=terrainClearance([R+100,0,0],lon=>({height:.5*R*lon*Math.PI/180,source:'test',spacing:1}));assert.ok(Math.abs(hill.distance-100/Math.sqrt(1.25))<.5,JSON.stringify(hill));
 assert.equal(terrainClearance([R+100,0,0],()=>null),null);
});
test('triangle distance includes edge and vertex regions',()=>{
 assert.deepEqual(closestTriangle([.25,.25,2],[0,0,0],[1,0,0],[0,1,0]),[.25,.25,0]);
 assert.deepEqual(closestTriangle([2,0,1],[0,0,0],[1,0,0],[0,1,0]),[1,0,0]);
 assert.deepEqual(closestTriangle([.5,-1,1],[0,0,0],[1,0,0],[0,1,0]),[.5,0,0]);
 assert.equal(altitudeText(2450),'2.45 km');assert.equal(altitudeText(5),'5.0 m');
});
test('local metre windows contain endpoints at high latitudes and across the dateline',()=>{
 for(const points of [[[77.4,18.48],[77.42,18.5]],[[179.99,80],[-179.99,80.01]]]){const grid=missionWindow(points,25);assert.ok(grid.size<=ROUTE_MAX_CELLS&&grid.size%2===1);for(const point of points){const xy=grid.projection.forward(point);assert.ok(xy.every(v=>Math.abs(v)<grid.half));const round=grid.projection.inverse(xy);assert.ok(Math.abs(round[0]-point[0])<1e-7);assert.ok(Math.abs(round[1]-point[1])<1e-7);}}
 const projection=routeProjection([0,0]);assert.ok(Math.abs(projection.forward([.001,0])[0]-R*Math.PI/180*.001)<1e-6);
});
test('broad route areas have no 150 km cap and disclose their adapted spacing',()=>{
 for(const points of [[[0,0],[20,0]],[[175,70],[-165,72]],[[-77,-8],[-68,-8]]]){
  const grid=missionWindow(points,100);assert.ok(grid.half*2>150000);assert.ok(grid.size<=513&&grid.size%2===1);assert.ok(grid.resolution>100);assert.ok(Number.isFinite(grid.maxScaleError));
  for(const p of points)assert.ok(grid.projection.forward(p).every(v=>Math.abs(v)<grid.half));
 }
 assert.throws(()=>missionWindow([[0,0],[1,0]],NaN),/spacing/);
 assert.throws(()=>routeProjection([0,0]).forward([180,0]),/antipode/);
});
test('regional mission windows up to 400-500 km construct valid bounded grids',()=>{
 const points=[[-76.6,-9.9],[-70.0,-9.9]];
 const grid=missionWindow(points,200);
 assert.ok(grid.size<=ROUTE_MAX_CELLS&&grid.size%2===1);
 for(const point of points){
  const xy=grid.projection.forward(point);
  assert.ok(xy.every(v=>Math.abs(v)<grid.half));
 }
});
test('routeRenderLegs generates bounded continuous geodesic chunks and eliminates duplicates',()=>{
 assert.deepEqual(routeRenderLegs([]),[]);
 assert.deepEqual(routeRenderLegs([{lon:0,lat:0}]),[]);
 assert.deepEqual(routeRenderLegs([{lon:0,lat:0},{lon:0,lat:0}]),[]);
 const simple=routeRenderLegs([{lon:10,lat:20},{lon:10.1,lat:20.1}]);
 assert.equal(simple.length,1);
 assert.equal(simple[0].length,2);
 const many=[];
 for(let i=0;i<100;i++)many.push({lon:i*0.01,lat:i*0.01});
 const chunks=routeRenderLegs(many,25);
 assert.ok(chunks.length>=4);
 for(const c of chunks){
  assert.ok(c.length<=25);
  assert.ok(c.length>=2);
  assert.ok(c.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)));
 }
});

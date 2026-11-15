import test from 'node:test';
import assert from 'node:assert/strict';
import {R} from '../src/raster.js';
import {marsDistance,lineDistances,flatMeasurementPath,MeasurementLine,nearestMeasurementPoint,polygonMetrics,measurementPins,measurementBoundary,measurementRenderLegs,areaLabel,distanceLabel} from '../src/measurement-geometry.js';
import {projectMeasurementPin} from '../src/measurement-projection.js';
test('Mars surface lengths use the application sphere, including poles and antipodes',()=>{
 assert.ok(Math.abs(marsDistance([0,0],[1,0])-R*Math.PI/180)<1e-8);
 assert.ok(Math.abs(marsDistance([0,0],[180,0])-R*Math.PI)<1e-6);
 assert.ok(marsDistance([0,90],[170,90])<1e-8);
 assert.ok(Math.abs(marsDistance([179.9,0],[-179.9,0])-R*Math.PI/900)<1e-6);
 const result=lineDistances([[0,0],[1,0],[1,1]]);assert.ok(Math.abs(result.total-2*R*Math.PI/180)<1e-7);
});
test('invalid positions cannot become measurements and wrapped map worlds normalize',()=>{
 for(const p of [[0,91],[NaN,0],[0,Infinity],[0],null])assert.throws(()=>marsDistance([0,0],p));
 const line=new MeasurementLine();line.start();line.add([437.4,18.48]);assert.ok(Math.abs(line.points[0][0]-77.4)<1e-10);
});
test('dateline and high-latitude display lines follow the measured short arc',()=>{
 const path=flatMeasurementPath([[179,80],[-179,80]],180);assert.ok(path.every(p=>p[1]>178&&p[1]<182));
 const polar=flatMeasurementPath([[-45,85],[45,85]],0);assert.ok(Math.max(...polar.map(p=>p[0]))>86);
 for(let i=1;i<polar.length;i++)assert.ok(Math.abs(polar[i][1]-polar[i-1][1])<180);
});
test('point placement, accidental duplicate clicks, finish, undo and export retain the same line',()=>{
 const line=new MeasurementLine();assert.equal(line.add([0,0]),false);line.start();assert.equal(line.add([0,0]),true);assert.equal(line.add([0,0]),false);assert.equal(line.finish(),false);line.add([1,0]);line.add([1,1]);assert.equal(line.finish(),true);assert.equal(line.add([2,1]),false);line.undo();
 const saved=line.export();assert.equal(saved.body,'Mars');assert.equal(saved.points.length,2);assert.equal(saved.referenceSphereRadiusM,R);assert.ok(Math.abs(saved.total-R*Math.PI/180)<1e-8);line.clear();assert.equal(line.points.length,0);
});

test('snapping chooses the closest visible screen point within a CSS-pixel radius',()=>{
 const first={index:0,point:[77.4,18.5],screen:{x:100,y:100}},second={index:1,point:[77.5,18.6],screen:{x:113,y:100}};
 assert.equal(nearestMeasurementPoint({x:102,y:103},[first,second]),first);
 assert.equal(nearestMeasurementPoint({x:111,y:100},[first,second]),second);
 assert.equal(nearestMeasurementPoint({x:99,y:114},[first]),null);
 assert.equal(nearestMeasurementPoint({x:100,y:114},[first]),first);
 assert.equal(nearestMeasurementPoint({x:100,y:120},[first],22),first);
 assert.equal(nearestMeasurementPoint({x:100,y:100},[{screen:null},{screen:{x:NaN,y:0}}]),null);
 assert.equal(nearestMeasurementPoint(null,[first]),null);
 // A snap carries the original coordinates unchanged, rather than the nearby click.
 const line=new MeasurementLine();line.start();line.add(first.point);line.add(second.point);line.add(nearestMeasurementPoint({x:102,y:100},[first,second]).point);
 assert.deepEqual(line.points.at(-1),line.points[0]);assert.equal(line.add(first.point),false);
});

test('spherical area is independent of winding and longitude wrap, and handles a polar boundary',()=>{
 const octant=[[0,0],[90,0],[0,90]],a=polygonMetrics(octant);
 assert.ok(Math.abs(a.area-R*R*Math.PI/2)<.02);assert.ok(Math.abs(a.perimeter-R*Math.PI*1.5)<1e-6);
 assert.ok(Math.abs(polygonMetrics([...octant].reverse()).area-a.area)<.02);
 const seam=polygonMetrics([[179,10],[-179,10],[-179,11],[179,11]]),wrapped=polygonMetrics([[539,10],[181,10],[181,11],[539,11]]);
 assert.ok(seam.area>0);assert.ok(Math.abs(seam.area-wrapped.area)<.01);
 const cap=polygonMetrics([[-135,85],[-45,85],[45,85],[135,85]]);assert.ok(cap.area>0&&cap.area<.04*R*R);assert.equal(cap.invalidReason,null);
 const tiny=polygonMetrics([[0,0],[.00001,0],[0,.00001]]);assert.ok(tiny.area>.17&&tiny.area<.18);
});

test('area rejects crossing boundaries, repeated vertices and ambiguous half-world edges',()=>{
 assert.match(polygonMetrics([[0,0],[1,1],[0,1],[1,0]]).invalidReason,/cross/);
 assert.match(polygonMetrics([[0,0],[1,0],[1,1],[0,0]]).invalidReason,/distinct/);
 assert.match(polygonMetrics([[0,0],[180,0],[90,10]]).invalidReason,/half/);
 const line=new MeasurementLine();line.mode='area';line.start();line.add([0,0]);line.add([1,0]);assert.equal(line.finish(),false);line.add([0,1]);assert.equal(line.finish(),true);
 const saved=line.export();assert.equal(saved.mode,'area');assert.equal(saved.schema,'mars-measurement/2');assert.ok(saved.area>0);assert.ok(saved.perimeter>saved.total);assert.equal(saved.points.length,3);
 line.start();for(const p of [[0,0],[1,1],[0,1],[1,0]])line.add(p);assert.throws(()=>line.finish(),/cross/);assert.equal(line.drawing,true);
});

test('measurement display units change presentation without changing the result',()=>{
 assert.equal(distanceLabel(1500,'m'),'1,500.0 m');assert.equal(distanceLabel(500,'km'),'0.50 km');
 assert.equal(areaLabel(1500000,'km'),'1.50 km²');assert.equal(areaLabel(25,'m'),'25 m²');
});
test('return visits reuse the original pin serial and include the traveled return leg',()=>{
 for(const end of [[1,0],[0,0]]){
  const line=new MeasurementLine();line.start();for(const p of [[0,0],[1,0],[2,0]])line.add(p);
  const before=lineDistances(line.points).total;assert.equal(line.add([2,0]),false);
  assert.equal(line.add(end),true);const model=measurementPins(line.points);
  assert.equal(model.pins.length,3);assert.deepEqual(model.numbers,[1,2,3,end[0]+1]);
  assert.ok(Math.abs(lineDistances(line.points).total-before-marsDistance([2,0],end))<1e-7);
  assert.equal(line.export().points.at(-1).number,end[0]+1);
 }
});
test('distance and area share open or closed triangle points without destroying the route',()=>{
 const line=new MeasurementLine();line.start();for(const p of [[0,0],[1,0],[1,1]])line.add(p);
 const original=structuredClone(line.points),openArea=polygonMetrics(measurementBoundary(line.points)).area;
 line.mode='area';assert.equal(line.finish(),true);assert.ok(openArea>0);assert.deepEqual(line.points,original);
 line.mode='distance';line.drawing=true;line.add([0,0]);const distance=lineDistances(line.points).total;
 line.mode='area';assert.equal(line.finish(),true);assert.equal(line.export().area,openArea);
 assert.deepEqual(measurementPins(line.points).numbers,[1,2,3,1]);
 line.mode='distance';assert.equal(line.export().total,distance);assert.equal(line.points.length,4);
 line.undo();assert.deepEqual(line.points,original);
});
test('two points and collinear routes cannot report a usable area',()=>{
 assert.equal(polygonMetrics([[0,0],[1,0]]).area,null);
 const line=new MeasurementLine();line.start();for(const p of [[0,0],[1,0],[2,0],[0,0]])line.add(p);line.mode='area';
 assert.throws(()=>line.finish(),/collinear/);assert.equal(line.export().area,null);
 assert.equal(measurementPins(line.points).pins.length,3);
});

test('the reported 6495 km measurement has bounded rendering edges without altering the measured path',()=>{
 const points=[[-105.64351048491807,-.1415078222548782],[130.38936077217204,53.384967966901385]],copy=structuredClone(points),legs=measurementRenderLegs(points);
 assert.equal(legs.length,1);assert.deepEqual(legs[0][0],points[0]);assert.deepEqual(legs[0].at(-1),points[1]);
 assert.ok(Math.abs(lineDistances(legs[0]).total-6495672.516479851)<1e-6);
 for(const d of lineDistances(legs[0]).segments)assert.ok(d<=R*5*Math.PI/180+1e-6);
 assert.deepEqual(points,copy);
});

test('half-world previews, polar arcs and date-line edges stay finite and bounded',()=>{
 for(const points of [[[0,0],[180,0]],[[0,0],[179.999999,.000001]],[[0,90],[180,-90]],[[179,80],[-179,80]],[[0,85],[180,85]]]){
  const [leg]=measurementRenderLegs(points);assert.ok(leg.flat().every(Number.isFinite));assert.ok(leg.length<=37);
  for(const d of lineDistances(leg).segments)assert.ok(d<=R*5*Math.PI/180+.01);
  assert.ok(Math.abs(lineDistances(leg).total-marsDistance(...points))<.01);
  const flat=flatMeasurementPath(points);assert.ok(flat.flat().every(Number.isFinite));assert.ok(Math.abs(lineDistances(flat.map(([lat,lon])=>[lon,lat])).total-marsDistance(...points))<.01);
 }
});

test('snapped endpoint previews cannot create zero-length ground geometry or 180-degree joins',()=>{
 const a=[-105.64351,-.14151],b=[130.38936,53.38497];
 assert.deepEqual(measurementRenderLegs([b,b]),[]);assert.deepEqual(measurementRenderLegs([b,[b[0]+1e-9,b[1]]]),[]);
 const legs=measurementRenderLegs([a,b,b,a]);assert.equal(legs.length,2);
 assert.deepEqual(legs[0][0],legs[1].at(-1));assert.deepEqual(legs[0].at(-1),legs[1][0]);
 assert.ok(Math.abs(legs.reduce((total,leg)=>total+lineDistances(leg).total,0)-2*marsDistance(a,b))<1e-6);
});

test('hover snapping reads loaded terrain without invoking a secondary pick render',()=>{
 let detailedPicks=0,renderedHeight,screen={x:42,y:10};
 class Cartesian3{
  static fromDegrees(lon,lat,height){renderedHeight=height;return {x:R+height,y:0,z:0};}
  static subtract(a,b){return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};}
  static dot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z;}
 }
 const C={Cartesian3,Cartographic:{fromDegrees:(lon,lat)=>({lon,lat})},SceneTransforms:{worldToWindowCoordinates:()=>screen}};
 const scene={camera:{positionWC:{x:R+10000,y:0,z:0},directionWC:{x:-1,y:0,z:0}},canvas:{clientWidth:100,clientHeight:100},globe:{ellipsoid:{},getHeight:()=>123},sampleHeightSupported:true,sampleHeight(){detailedPicks++;throw new Error('A hover must not render another pick view');}};
 assert.deepEqual(projectMeasurementPin(C,scene,[0,0]),screen);assert.equal(renderedHeight,126);
 scene.globe.getHeight=()=>undefined;assert.ok(projectMeasurementPin(C,scene,[0,0]));assert.equal(renderedHeight,3);
 screen={x:NaN,y:10};assert.equal(projectMeasurementPin(C,scene,[0,0]),null);
 assert.equal(projectMeasurementPin(C,scene,[180,0]),null);assert.equal(detailedPicks,0);
});

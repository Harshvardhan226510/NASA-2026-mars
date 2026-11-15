import test from 'node:test';
import assert from 'node:assert/strict';
import {lassoVertices,validatePerimeter,validatePerimeters,mergePerimeters} from '../src/perimeters.js';
import {encodeMission,decodeMission,MISSION_SCHEMA,validateMission} from '../src/mission-state.js';

const boundary={id:'perimeter-base',name:'Base boundary',points:[[179.99,12],[-179.99,12],[-179.99,12.01],[179.99,12.01]]};

test('lasso rejects straight gestures and bounds closed freehand strokes',()=>{
 assert.throws(()=>lassoVertices([[0,0],[40,40],[80,79],[120,120]]),/loop/);
 const loop=Array.from({length:181},(_,i)=>[100+60*Math.cos(i*Math.PI/90),100+60*Math.sin(i*Math.PI/90)]);
 const vertices=lassoVertices(loop);
 assert.equal(vertices.length,64);
 assert.deepEqual(vertices[0],loop[0]);
 assert.deepEqual(vertices.at(-1),loop.at(-2));
});

test('perimeter validation closes dateline boundaries and retains the declared camp coordinates',()=>{
 const target={kind:'camp',point:[179.995,12.005]};
 assert.deepEqual(validatePerimeter({...boundary,points:[...boundary.points,boundary.points[0]],target}),{...boundary,points:boundary.points.map(([lon,lat])=>[((lon+180)%360+360)%360-180,lat]),target:{kind:'camp',point:[((target.point[0]+180)%360+360)%360-180,target.point[1]]}});
});

test('invalid and repeated boundaries are rejected before persistence',()=>{
 const [a,b,c,d]=boundary.points;
 assert.throws(()=>validatePerimeter({...boundary,points:[a,c,b,d]}),/cross/);
 assert.throws(()=>validatePerimeter({...boundary,points:[a,b]}),/three/);
 assert.throws(()=>validatePerimeter({...boundary,target:{kind:'site',id:'invalid'}}),/marked site/);
 assert.throws(()=>validatePerimeters([boundary,boundary]),/Repeated/);
});

test('a perimeter edit replaces the same record and survives a mission share roundtrip',async()=>{
 const edited={...boundary,name:'Survey boundary',target:{kind:'site',id:'user-survey'}};
 const mission={schema:MISSION_SCHEMA,measurement:{points:[]},route:{targets:[]}};
 assert.equal(validateMission(mission).perimeters,undefined);
 const perimeters=mergePerimeters([boundary],[edited]);
 assert.deepEqual(perimeters,[validatePerimeter(edited)]);
 const restored=await decodeMission(await encodeMission({...mission,perimeters}));
 assert.deepEqual(restored.perimeters,perimeters);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {declaredCampPoint,evaluatedCampPoint,sameCampPoint,setCampDestination} from '../src/mission-camp.js';
import {walkState} from '../src/mission-planning.js';
import {MISSION_SCHEMA,validateMission,encodeMission,decodeMission} from '../src/mission-state.js';
import {EVAssistant} from '../src/eva-assistant.js';

test('using camp as route destination preserves start and independent mission home',()=>{
 const planner={start:[78,19],workbench:{state:{home:[77.43,18.44]}},setPoint(kind,point){assert.equal(kind,'goal');this.goal=point;}};
 setCampDestination(planner);assert.deepEqual(planner.start,[78,19]);assert.deepEqual(planner.goal,[77.43,18.44]);
 planner.goal[0]=0;assert.equal(planner.workbench.state.home[0],77.43);
 assert.throws(()=>setCampDestination({...planner,workbench:{state:{}}}),/Declare camp/);
});

test('only a valid evaluated base can supply camp coordinates, and declarations copy their coordinates',()=>{
 const result={options:{mode:'base',lon:77.43,lat:18.44}},p=evaluatedCampPoint(result);p[0]=0;assert.equal(result.options.lon,77.43);
 assert.throws(()=>evaluatedCampPoint({options:{...result.options,mode:'landing'}}));assert.throws(()=>evaluatedCampPoint({options:{mode:'base',lon:181,lat:0}}));
 assert.equal(declaredCampPoint({home:[NaN,0]}),null);assert.equal(declaredCampPoint({}),null);
 assert.ok(sameCampPoint([-180,0],[180,0]));assert.ok(!sameCampPoint([77,18],[78,18]));
});
test('declared evaluated camp uses the existing mission home and survives mission file/link round-trips',async()=>{
 const point=evaluatedCampPoint({options:{mode:'base',lon:77.43,lat:18.44}}),operation=walkState({home:point,campSiteId:'user-camp'});
 const mission=validateMission({schema:MISSION_SCHEMA,route:{operation,targets:[]},measurement:{points:[]}});
 assert.deepEqual(declaredCampPoint(mission.route.operation),point);
 const restored=(await decodeMission(await encodeMission(mission))).route.operation;
 assert.deepEqual(declaredCampPoint(restored),point);
 assert.equal(restored.campSiteId,'user-camp');
});
test('ARES return planning uses the declared evaluated camp rather than another route destination',async()=>{
 const home=evaluatedCampPoint({options:{mode:'base',lon:77.43,lat:18.44}}),state=walkState({home});let planned=false;
 const planner={workbench:{state},goal:[0,0],cancel(){},open(){},render(){},async plan(){planned=true;assert.deepEqual(this.goal,home);}};
 const assistant=Object.assign(Object.create(EVAssistant.prototype),{routePlanner:planner,getCurrentPosition:()=>[77.5,18.5],open(){},setStatus(){},addMessage(){}});
 await assistant.executeEmergencyReturn();assert.ok(planned);assert.deepEqual(planner.start,[77.5,18.5]);assert.deepEqual(planner.goal,home);assert.notStrictEqual(planner.goal,state.home);
});

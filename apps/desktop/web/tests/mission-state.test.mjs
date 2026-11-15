import test from 'node:test';import assert from 'node:assert/strict';
import {validateMission,encodeMission,decodeMission,MISSION_SCHEMA,matchesMissionSelection} from '../src/mission-state.js';
const state=()=>({schema:MISSION_SCHEMA,name:'Jezero survey',layers:{science:true,elevation:false},camera:{lon:77,lat:18,height:2000,heading:0,pitch:-1,roll:0},flat:{lon:77,lat:18,zoom:15},measurement:{points:[[179,80],[-179,80],[179,80]],mode:'area'},route:{start:[77,18],goal:[77.1,18],targets:[],settings:{'route-slope':'22'},result:null}});

test('explicit moon links cannot restore an unrelated moon or spacecraft draft with an empty region',()=>{
 const draft={moon:'deimos',spacecraft:null,region:null};
 assert.equal(matchesMissionSelection(new URLSearchParams('moon=phobos'),draft),false);
 assert.equal(matchesMissionSelection(new URLSearchParams('spacecraft=curiosity'),draft),false);
 assert.equal(matchesMissionSelection(new URLSearchParams('moon=deimos'),draft),true);
 assert.equal(matchesMissionSelection(new URLSearchParams(),draft),true);
 const coordinate={region:'COORDINATES',center:[77,18]};
 assert.equal(matchesMissionSelection(new URLSearchParams('region=COORDINATES&lon=77&lat=18'),coordinate),true);
 assert.equal(matchesMissionSelection(new URLSearchParams('region=COORDINATES&lon=78&lat=18'),coordinate),false);
});
test('a mission link round-trips closed/revisited pins, settings and camera without enabling drawing',async()=>{const clean=validateMission(state());assert.deepEqual(await decodeMission(await encodeMission(clean)),clean);assert.equal(clean.measurement.points.length,3);assert.equal(clean.measurement.drawing,undefined);});
test('malformed missions cannot inject unbounded or invalid geometry into render workers',async()=>{for(const patch of [{schema:'other'},{camera:{...state().camera,height:Infinity}},{measurement:{points:[[0,100]]}},{route:{targets:Array(7).fill({})}}])assert.throws(()=>validateMission({...state(),...patch}));await assert.rejects(decodeMission('bad!link'));const clean=validateMission({...state(),layers:JSON.parse('{"__proto__":true,"science":true}'),controls:JSON.parse('{"__proto__":{"x":true}}')});assert.equal(Object.getPrototypeOf(clean.controls),Object.prototype);assert.equal(clean.controls.x,undefined);});
test('saved route profiles retain every sample rather than the generic metadata array cap',()=>{const s=state(),route={status:'success',waypoints:[{lon:77,lat:18,elevation_m:-2000},{lon:77.1,lat:18,elevation_m:-1990}],terrain_profile:{samples:Array.from({length:513},(_,i)=>({lon:77+i*.0001,lat:18,elevation_m:-2000+i,distance_m:i*10}))}};s.route.result={schema:'mars-route-result/1',routes:{direct_safe:route,apf_survey:route,deep_science:route},metadata:{grid_spacing_m:200,window_width_m:1000,max_slope_deg:22,source:{label:'Measured DEM'}},start:s.route.start,goal:s.route.goal};const clean=validateMission(s);assert.equal(clean.route.result.routes.direct_safe.terrain_profile.samples.length,513);});

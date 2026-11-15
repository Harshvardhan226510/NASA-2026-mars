import test from 'node:test';
import assert from 'node:assert/strict';
import {validateUserSite} from '../src/user-sites.js';
import {validateMission,encodeMission,decodeMission,MISSION_SCHEMA} from '../src/mission-state.js';

test('a device-position site retains its exact fix and reported uncertainty in mission files and links',async()=>{
 const locationFix={sourceId:'eva-nav-1',frame:'mars-east-planetocentric',point:[77.4301234,18.4405678],at:'2026-11-08T00:00:00.000Z',accuracyMeters:null};
 const site=validateUserSite({id:'user-position-test',name:'Operator-selected site',description:'Selected from external system',center:[...locationFix.point],category:'science',isValue:false,locationFix});
 const mission=validateMission({schema:MISSION_SCHEMA,userSites:[site],measurement:{points:[]},route:{targets:[]}});
 assert.deepEqual((await decodeMission(await encodeMission(mission))).userSites[0].locationFix,locationFix);
 assert.throws(()=>validateUserSite({...site,center:[77,18]}),/match/);
 assert.throws(()=>validateUserSite({...site,locationFix:{...locationFix,frame:'wgs84'}}),/frame/);
 assert.equal(Object.hasOwn(validateUserSite({...site,center:[77,18],locationFix:undefined}),'locationFix'),false);
});

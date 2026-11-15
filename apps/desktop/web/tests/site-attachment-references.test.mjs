import test from 'node:test';
import assert from 'node:assert/strict';
import {validateUserSite} from '../src/user-sites.js';
import {MAX_SITE_ATTACHMENTS,validateSiteAttachments} from '../src/site-attachments.js';
import {validateMission,encodeMission,decodeMission,MISSION_SCHEMA} from '../src/mission-state.js';
const item={id:'attachment-12345678-1234-1234-1234-123456789abc',name:'Panorama.png',bytes:1024,sha256:'a'.repeat(64),mediaType:'image/png',addedAt:'2026-11-08T00:00:00.000Z'};
test('site attachments and their checksums survive mission serialization while legacy sites stay readable',async()=>{
 const raw={id:'user-attached-site',name:'Sampling station',center:[77.43,18.44],category:'science'};
 assert.deepEqual(validateUserSite(raw).attachments,[]);
 const site=validateUserSite({...raw,attachments:[item]}),mission=validateMission({schema:MISSION_SCHEMA,userSites:[site],measurement:{points:[]},route:{targets:[]}});
 assert.deepEqual((await decodeMission(await encodeMission(mission))).userSites[0].attachments,[item]);
 assert.throws(()=>validateSiteAttachments([item,item]),/reference/);
 assert.throws(()=>validateSiteAttachments([{...item,id:'../../private'}]),/reference/);
 assert.throws(()=>validateSiteAttachments(Array(MAX_SITE_ATTACHMENTS+1).fill(item)),/supports/);
 assert.equal(validateSiteAttachments([{...item,mediaType:'text/html'}])[0].mediaType,'application/octet-stream');
});

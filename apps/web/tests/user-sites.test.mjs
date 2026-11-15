import test from 'node:test';
import assert from 'node:assert/strict';
import {validateUserSite,validateUserSites,upsertUserSite,userValueSites,USER_SITES_KEY} from '../src/user-sites.js';
import {nearbyRouteSites} from '../src/route-sites.js';
import {siteResources} from '../src/site-evaluation-data.js';
import {MISSION_SCHEMA,validateMission,encodeMission,decodeMission} from '../src/mission-state.js';
const site=patch=>({id:'user-sample',name:'Ridge station',description:'Inspect the exposed layers.\nReturn before sunset.',center:[77.43,18.44],isValue:false,category:'science',...patch});
test('saved sites retain bounded text and exact coordinates across JSON storage; invalid records fail closed',()=>{
 const records=[site({name:' <img src=x onerror=alert(1)> '})],storage=new Map([[USER_SITES_KEY,JSON.stringify(records)]]),clean=validateUserSites(JSON.parse(storage.get(USER_SITES_KEY)));
 assert.equal(clean[0].name,'<img src=x onerror=alert(1)>');assert.deepEqual(clean[0].center,[77.43,18.44]);assert.match(clean[0].description,/\nReturn/);
 for(const patch of [{center:[180.1,0]},{center:[0,-90.1]},{center:[NaN,0]},{name:'  '},{category:'__proto__'},{id:'published-site'}])assert.throws(()=>validateUserSite(site(patch)));
 assert.throws(()=>validateUserSites([site(),site()]));assert.throws(()=>validateUserSites(Array.from({length:201},(_,i)=>site({id:'user-'+i}))));
});
test('editing, promoting and demoting a site reuses its ID and only value sites enter route selection',()=>{
 let sites=upsertUserSite([],site());assert.equal(userValueSites(sites).length,0);
 sites=upsertUserSite(sites,site({name:'Sampling station',description:'Possible exposure; needs verification.',isValue:true,category:'minerals'}));assert.equal(sites.length,1);
 const values=userValueSites(sites),route=nearbyRouteSites(values,[77.42,18.44],[77.44,18.44],[],{radiusKm:2});assert.equal(route.targets.length,1);assert.equal(route.targets[0].siteId,'user-sample');assert.match(route.targets[0].coordinateNote,/user/);assert.equal(route.targets[0].source,null);
 sites=upsertUserSite(sites,{...sites[0],isValue:false});assert.deepEqual(userValueSites(sites),[]);
});
test('user resource labels do not enter published evidence scoring, even when a link is supplied',()=>{
 const user={...userValueSites([site({isValue:true,category:'resources'})])[0],sources:[{title:'My note',url:'https://example.com'}]};
 const published={id:'published',name:'Measured target',category:'resources',center:[77.43,18.44],evidence:'Radar',sources:[{title:'Published assessment',url:'https://example.org'}]};
 assert.deepEqual(siteResources([user,published],[77.43,18.44],5).map(s=>s.id),['published']);
});
test('old missions remain readable and mission files and links round-trip personal site tags',async()=>{
 const old={schema:MISSION_SCHEMA,measurement:{points:[]},route:{targets:[]}};assert.deepEqual(validateMission(old).userSites,[]);
 assert.deepEqual(validateMission({...old,userSites:[site()]}).userSites[0].tags,[]);
 const mission=validateMission({...old,userSites:[site({isValue:true,category:'resources',tags:[' review ','Field   photos','REVIEW','field photos','']})]});
 const tags=['Review','Field photos'];
 assert.deepEqual(validateUserSites(JSON.parse(JSON.stringify(mission.userSites)))[0].tags,tags);
 assert.deepEqual(mission.userSites[0].tags,tags);
 assert.deepEqual((await decodeMission(await encodeMission(mission))).userSites,mission.userSites);
 assert.throws(()=>validateMission({...old,userSites:[site({center:[0,100]})]}));
});
test('site tag validation rejects ambiguous or oversized tag data',()=>{
 for(const tags of ['Review',[2],['Done, Review'],['a'.repeat(33)],Array.from({length:9},(_,i)=>`Tag ${i}`)])assert.throws(()=>validateUserSite(site({tags})),/tag/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {LocationInput} from '../services/location-input.mjs';
import {startDeadReckoningInput} from '../services/dead-reckoning-input.mjs';
import {freshLocation,siteLocationFix} from '../web/src/external-location.js';
import net from 'node:net';
const at='2026-11-08T00:00:00.000Z',now=Date.parse(at),fix=patch=>({sourceId:'eva-nav-1',frame:'mars-east-planetocentric',point:[77.43,18.44],at,accuracyMeters:2.5,...patch});

test('location feeds validate Mars coordinates, timestamps, accuracy and source ordering',()=>{
 const feed=new LocationInput({clock:()=>now});assert.equal(feed.accept(fix()).accepted,true);
 assert.equal(feed.accept(fix()).duplicate,true);
 assert.throws(()=>feed.accept(fix({point:[78,19]})),/timestamp/);
 for(const patch of [{frame:'wgs84'},{point:[181,0]},{point:[0,91]},{point:[NaN,0]},{accuracyMeters:-1},{at:'2026-11-08T00:00:06.000Z'},{at:'2026-11-07T23:58:00.000Z'},{sourceId:'../other'}])assert.throws(()=>feed.accept(fix(patch)));
 assert.equal(feed.status().sources.length,1);
});

test('stale fixes cannot supply a new site, while a saved location keeps its original source snapshot',()=>{
 let time=now;const feed=new LocationInput({clock:()=>time});feed.accept(fix());
 const selected=siteLocationFix(feed.status().sources[0],[77.43,18.44]);
 time+=11000;assert.equal(feed.status().sources[0].fresh,false);assert.equal(freshLocation(selected,time),false);
 feed.accept(fix({at:new Date(time).toISOString(),point:[77.44,18.45],accuracyMeters:null}));
 assert.deepEqual(selected.point,[77.43,18.44]);assert.equal(selected.accuracyMeters,2.5);
 assert.throws(()=>siteLocationFix(selected,[77.44,18.45]),/match/);
 assert.equal(new LocationInput({clock:()=>time}).status().sources.length,0,'restart must not present an old fix as current');
});

test('a separate localhost client can send fixes through the authenticated input listener',async t=>{
 const reserve=net.createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
 const feed=new LocationInput({clock:()=>now}),token='b'.repeat(64);
 const input=await startDeadReckoningInput({state:null},{port,token,routes:feed.routes});t.after(()=>input.stop());
 const url='http://127.0.0.1:'+port,headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 assert.equal((await fetch(url+'/v1/location/fixes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fix())})).status,403);
 const accepted=await fetch(url+'/v1/location/fixes',{method:'POST',headers,body:JSON.stringify(fix())});assert.equal(accepted.status,200);
 const status=await fetch(url+'/v1/location/status',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json());assert.equal(status.sources[0].sourceId,'eva-nav-1');assert.deepEqual(status.sources[0].point,[77.43,18.44]);
 assert.equal((await fetch(url+'/v1/location/fixes',{method:'POST',headers,body:JSON.stringify(fix({frame:'earth'}))})).status,422);
});

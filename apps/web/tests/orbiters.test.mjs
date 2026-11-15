import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOrbiterService,parseHorizons,horizonsUrl} from '../science/orbiters.mjs';
import {ORBITERS,orbitWindow,validateOrbiters,orbiterState,orbiterAxes,marsFrame,frameChange,advanceSystemTime,restoredSystemTime} from '../src/orbiter-data.js';
import {qRotate} from '../src/moon-data.js';
import {trajectoryArc,vectorAt,pastTrail} from '../src/orbital-path.js';
const raw=readFileSync(new URL('fixtures/mro-horizons-20261019.json',import.meta.url),'utf8'),start=Date.parse('2026-10-19T18:00:00Z'),body=parseHorizons('mro',raw,start,start);
const packet={schema:'mars-orbiters/1',center:'Mars center (499)',frame:'ICRF',time_scale:'UTC',units:'metres and metres/second',start_utc:new Date(start).toISOString(),end_utc:new Date(start+21600000).toISOString(),bodies:{mro:body}};

test('recorded JPL MRO vectors retain their target, centre, UTC epochs, velocities and source proof',()=>{
 validateOrbiters(packet);assert.equal(body.samples.length,361);assert.equal(body.samples[0][0],start);assert.ok(Math.abs(body.samples[0][1]+1717569.958545137)<1e-6);assert.ok(Math.abs(body.samples[0][4]+1874.707027510576)<1e-9);assert.match(body.raw_sha256,/^[a-f0-9]{64}$/);
 const url=new URL(horizonsUrl('mro',start));assert.equal(url.searchParams.get('CENTER'),"'500@499'");assert.equal(url.searchParams.get('TIME_TYPE'),"'UT'");assert.equal(url.searchParams.get('VEC_CORR'),"'NONE'");
});
test('shared clock freezes a snapshot or follows real UTC, ignoring every legacy acceleration',()=>{
 let at=start;for(let i=0;i<100;i++)at=advanceSystemTime(at,'paused',1000,600,start+1e6);assert.equal(at,start);
 for(const mode of ['play','now'])for(const speed of [1,60,600,3600]){assert.equal(advanceSystemTime(start,mode,33,speed,start+33),start+33);assert.equal(advanceSystemTime(start,mode,1e9,speed,start+3600000),start+3600000);}
 assert.equal(advanceSystemTime(start,'paused',1e9,3600,start+1234),start);
});
test('legacy accelerated previews and live drafts reopen at current UTC; only explicit snapshots retain past time',()=>{
 const wall=start+123456789,old={moon_at:new Date(start).toISOString(),system_speed:600};
 for(const selection of [old,{...old,system_live:true},{system_live:false,moon_at:'bad'},{system_live:false,moon_at:'2040-01-01'}])assert.deepEqual(restoredSystemTime(selection,wall),{at:wall,mode:'now'});
 assert.deepEqual(restoredSystemTime({...old,system_live:false},wall),{at:start,mode:'paused'});
});
test('trajectory geometry uses source states, spans one angular revolution and never closes partial coverage',()=>{
 const arc=trajectoryArc(body.samples,start+10800000);assert.ok(arc.complete);assert.ok(arc.end-arc.start>6000000&&arc.end-arc.start<8000000);assert.ok(arc.states.length>600);assert.ok(arc.states.some(s=>s.at===start+10800000));
 const p=vectorAt(body.samples,start+60000);assert.deepEqual(p,body.samples[1].slice(1,4));
 const partial=trajectoryArc(body.samples.slice(0,20),start+600000);assert.equal(partial.complete,false);assert.equal(partial.start,start);assert.equal(partial.end,start+1140000);
 assert.equal(trajectoryArc(body.samples,start-1),null);assert.equal(vectorAt(body.samples,start+21600001),null);
 for(const s of arc.states)assert.ok(s.position.every(Number.isFinite));
});
test('trails contain past source positions only, terminate at the displayed UTC and clip unknown history',()=>{
 const at=start+5400000,trail=pastTrail(body.samples,at);assert.equal(trail.start,at-3600000);assert.equal(trail.end,at);assert.equal(trail.complete,true);assert.deepEqual(trail.states.at(-1).position,vectorAt(body.samples,at));assert.ok(trail.states.every(s=>s.at<=at&&s.position.every(Number.isFinite)));
 const partial=pastTrail(body.samples,start+900000);assert.equal(partial.complete,false);assert.equal(partial.start,start);assert.equal(pastTrail(body.samples,start).states.length,0);assert.equal(pastTrail(body.samples,start-1),null);assert.equal(pastTrail(body.samples,at,NaN),null);
});
test('minute-state interpolation agrees within a metre with independent JPL ten-second vectors',()=>{
 const raw=JSON.parse(readFileSync(new URL('fixtures/mro-horizons-20261021-10s.json',import.meta.url)));
 assert.equal(raw.signature.source,'NASA/JPL Horizons API');assert.match(raw.result,/GEOMETRIC cartesian states/);
 const states=raw.result.split('$$SOE')[1].split('$$EOE')[0].trim().split(/\r?\n/).map(line=>{const c=line.split(',');return [Math.round((Number(c[0])-2440587.5)*86400000),...c.slice(2,8).map(v=>Number(v)*1000)];});
 assert.equal(states.length,13);const minute=[states[0],states[6],states[12]];
 for(const s of states){const p=vectorAt(minute,s[0]);assert.ok(Math.hypot(...p.map((v,i)=>v-s[i+1]))<1);}
});
test('expanded JPL paths preserve the exact minute position window and reject broken trace cadence',()=>{
 const b=parseHorizons('mro',raw,start,start,{trace:true}),p=structuredClone(packet);p.bodies.mro=b;validateOrbiters(p);assert.deepEqual(b.samples,body.samples);assert.deepEqual(b.trajectory,body.samples);
 const u=new URL(horizonsUrl('hope',start,{trace:true}));assert.equal(u.searchParams.get('START_TIME'),"'2026-10-18 09:00:00'");assert.equal(u.searchParams.get('STOP_TIME'),"'2026-10-21 09:00:00'");
 p.bodies.mro.trajectory[1][0]+=500;assert.throws(()=>validateOrbiters(p));assert.match(b.source_notes,/planning PREDICTION/);
});
test('a longer trace coverage failure falls back to the verified position window, without an invented orbit',async()=>{
 let calls=0;const serve=createOrbiterService({clock:()=>start,fetcher:async url=>{calls++;const u=new URL(url);if(u.searchParams.get('START_TIME')!=="'2026-10-19 18:00:00'")return new Response('{"error":"No extended coverage"}');const target=u.searchParams.get('COMMAND').replaceAll("'",'');return new Response(raw.replaceAll('(-74)',`(${target})`));}});
 const p=await serve(new Date(start).toISOString());assert.equal(calls,10);for(const [id,b] of Object.entries(p.bodies))if(id!=='maven'){assert.equal(b.status,'available');assert.equal(b.trajectory,undefined);assert.equal(b.samples.length,361);}
});
test('Mars observer rotation uses the same frame as moons and spacecraft without double-rotating their positions',()=>{
 const moon=JSON.parse(readFileSync(new URL('fixtures/moons.json',import.meta.url))).packet,at=Date.parse(moon.start_utc),from=marsFrame(moon,at),to=marsFrame(moon,at+120000),delta=frameChange(from,to),v=[3670000,45000,200000];
 const actual=qRotate(qRotate(v,from),delta),expected=qRotate(v,to);assert.ok(Math.hypot(...actual.map((x,i)=>x-expected[i]))<1e-8);assert.ok(Math.hypot(...delta.slice(0,3))>0);assert.equal(marsFrame(moon,at-1),null);assert.equal(marsFrame(moon,at+21600001),null);
});
test('orbiter interpolation stays on source coordinates at samples and refuses to extrapolate',()=>{
 for(const i of [0,1,180,360]){const s=orbiterState(packet,'mro',start+i*60000,[0,0,0,1]);assert.deepEqual(s.position,body.samples[i].slice(1,4));}
 const s=orbiterState(packet,'mro',start+30000,[0,0,0,1]);assert.ok(s.radius>3500000&&s.radius<4000000);
 for(const at of [start-1,start+21600001,NaN])assert.equal(orbiterState(packet,'mro',at,[0,0,0,1]),null);assert.equal(orbiterState(packet,'mro',start,null),null);assert.equal(orbiterState(packet,'hope',start,[0,0,0,1]),null);
});

test('stationary or radial velocity cannot poison a model transform or remove its valid location',()=>{
 const original=orbiterState(packet,'mro',start,[0,0,0,1]),dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
 const axes=orbiterAxes(original);assert.ok(axes);for(const a of Object.values(axes)){assert.ok(a.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...a)-1)<1e-12);}assert.ok(Math.abs(dot(axes.x,axes.y))<1e-12);assert.ok(Math.abs(dot(axes.y,axes.z))<1e-12);
 for(const velocity of [[0,0,0],original.position,original.position.map(x=>-x),[NaN,0,0]])assert.equal(orbiterAxes({...original,velocity}),null);
 const p=structuredClone(packet);p.bodies.mro.samples[0].splice(4,3,0,0,0);validateOrbiters(p);const stationary=orbiterState(p,'mro',start,[0,0,0,1]);assert.deepEqual(stationary.position,original.position);assert.equal(orbiterAxes(stationary),null);
 p.bodies.mro.samples[0][4]=1e300;assert.throws(()=>validateOrbiters(p));
 assert.equal(orbiterState(packet,'mro',start,[Infinity,0,0,1]),null);
});
test('wrong units, frame, origin, timestamps, target and broken provider responses cannot become orbital positions',()=>{
 for(const [old,next] of [['Center body name: Mars (499)','Center body name: Earth (399)'],['Reference frame : ICRF','Reference frame : ECLIPTIC'],['Output units    : KM-S','Output units    : AU-D'],['(-74)','(-99)']]){const bad=JSON.parse(raw);bad.result=bad.result.replaceAll(old,next);assert.throws(()=>parseHorizons('mro',JSON.stringify(bad),start,start));}
 for(const change of [p=>p.frame='ECLIPTIC',p=>p.bodies.mro.samples[1][0]+=100,p=>p.bodies.mro.samples[0][1]=NaN,p=>p.bodies.mro.samples.pop(),p=>p.bodies.mro.target='-53']){const p=structuredClone(packet);change(p);assert.throws(()=>validateOrbiters(p));}
 assert.throws(()=>parseHorizons('mro','{"error":"No coverage"}',start,start));assert.throws(()=>orbitWindow(NaN));assert.throws(()=>orbitWindow(Date.parse('2036-01-01')));
});
test('JPL requests are serialized, shared by concurrent viewers and cached; unreliable MAVEN is never requested',async()=>{
 let active=0,max=0,calls=0;const serve=createOrbiterService({clock:()=>start,store:{get:async()=>null,set:async()=>{}},fetcher:async url=>{active++;max=Math.max(max,active);calls++;await Promise.resolve();const target=new URL(url).searchParams.get('COMMAND').replaceAll("'",'');const r=new Response(raw.replaceAll('(-74)',`(${target})`));active--;return r;}});
 const [a,b]=await Promise.all([serve(new Date(start).toISOString()),serve(new Date(start+1000).toISOString())]);assert.equal(a,b);assert.equal(calls,5);assert.equal(max,1);assert.equal(a.bodies.maven.status,'unavailable');await serve(new Date(start).toISOString());assert.equal(calls,5);
});
test('provider failures remain explicit unknown positions without a fictional orbit',async()=>{
 const serve=createOrbiterService({clock:()=>start,fetcher:async()=>new Response('{"error":"No ephemeris"}')});const p=await serve(new Date(start).toISOString());validateOrbiters(p);for(const id of Object.keys(ORBITERS)){assert.equal(p.bodies[id].status,'unavailable');assert.equal(orbiterState(p,id,start,[0,0,0,1]),null);}
});

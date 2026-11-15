import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MOONS,validateMoons,moonState,moonWindow,qRotate,qBlend,moonZoomRange,moonVectorSamples} from '../src/moon-data.js';
import {MarsMoons} from '../src/moons.js';
const fixture=JSON.parse(readFileSync(new URL('fixtures/moons.json',import.meta.url))),packet=fixture.packet;
test('moon history joins adjacent inertial source windows once without duplicating the shared epoch',()=>{
 const start=Date.parse(packet.start_utc),previous=structuredClone(packet);previous.start_utc=new Date(start-21600000).toISOString();
 const samples=moonVectorSamples([previous,packet],'phobos');assert.equal(samples.length,361);assert.equal(samples[0][0],start-21600000);assert.equal(samples.at(-1)[0],start+21600000);assert.deepEqual(samples[180],[start,...packet.bodies.phobos.samples[0].slice(0,6)]);assert.ok(samples.every((s,i)=>!i||s[0]>samples[i-1][0]));
});
test('switching from the surface into an orbital view preserves the chosen live or snapshot clock',()=>{
 for(const mode of ['now','paused']){const host={mode,beforeFly(){this.mode='paused';},show3D(){this.mode='paused';}};MarsMoons.prototype.prepareView.call(host);assert.equal(host.mode,mode);}
});

test('returning to Mars cancels pending moon, orbiter and system navigation without discarding cached data',async()=>{
 const previous=globalThis.window;globalThis.window={Cesium:{}};
 try{for(const [method,args] of [['select',['phobos']],['selectOrbiter',['mro']],['system',[]]]){
  let ready;const loaded=new Promise(resolve=>{ready=resolve;});
  const host={navigationVersion:0,showOrbiters:true,exploring:false,choose(at,mode){assert.ok(Math.abs(at-Date.now())<1000);assert.equal(mode,'now');},ensureVisible(){},open(){},load:()=>loaded,
   orbiters:{load:()=>loaded,hide(){}},viewer:{scene:{screenSpaceCameraController:{}}},render(){},setExploring(show){this.exploring=show;},
   beforeFly(){assert.fail('A cancelled orbital selection must not change the viewpoint.');}};
  const request=MarsMoons.prototype[method].apply(host,args);MarsMoons.prototype.releaseTracking.call(host);ready(true);
  await assert.doesNotReject(request);assert.equal(host.exploring,false);assert.equal(host.selected,null);assert.equal(host.selectedOrbiter,null);
 }}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test('moon interpolation and Mars rotation agree with direct native-SPICE body-fixed positions',()=>{
 validateMoons(packet);const start=Date.parse(packet.start_utc);
 for(const check of fixture.checks)for(const id of Object.keys(MOONS)){
  const state=moonState(packet,id,start+check.offset_seconds*1000),expected=check.positions_m[id];
  assert.ok(Math.hypot(...state.position.map((v,i)=>v-expected[i]))<1,'Interpolation exceeded one metre against native SPICE');
  assert.ok(Math.abs(Math.hypot(...state.orientation)-1)<1e-12);
 }
});
test('moon positions remain unknown outside the packet and request times share a bounded UTC window',()=>{
 const start=Date.parse(packet.start_utc),end=Date.parse(packet.end_utc);
 for(const at of [start-1,end+1,NaN,Infinity])assert.equal(moonState(packet,'phobos',at),null);
 assert.equal(moonState(packet,'unknown',start),null);assert.equal(moonWindow(start+21599999),new Date(start).toISOString());
 assert.equal(moonState(null,'deimos',start),null);
});
test('moon zoom uses distance to the moon and keeps the camera outside the model at either display scale',()=>{
 for(const factor of [1,20]){const radius=14000*factor;let distance=radius*4.5;const first=moonZoomRange(distance,radius,160);assert.ok(first<distance&&first>radius);for(let i=0;i<100;i++)distance=moonZoomRange(distance,radius,160);assert.ok(distance>=radius*1.03);assert.ok(moonZoomRange(distance,radius,-160)>distance);}
});
test('changing reference frame preserves physical orbital distance, and quaternion interpolation handles equivalent signs',()=>{
 for(const q of packet.mars_fixed_rotation_xyzw){const rotated=qRotate([1000,2000,3000],q);assert.ok(Math.abs(Math.hypot(...rotated)-Math.sqrt(14)*1000)<1e-8);assert.deepEqual(qBlend(q,q.map(v=>-v),.5),qBlend(q,q,.5));}
 const start=Date.parse(packet.start_utc);for(const id of Object.keys(MOONS)){const s=moonState(packet,id,start);assert.ok(s.radius>6000000&&s.radius<30000000);const orbit=packet.bodies[id].orbit_j2000_m;assert.equal(orbit.length,193);assert.ok(orbit.every(p=>Math.hypot(...p)>6000000));}
});
test('unsupported frames, missing samples and corrupt orientations are rejected instead of plotted',()=>{
 for(const edit of [p=>p.center='Earth',p=>p.display_frame='ICRF',p=>p.aberration='LT',p=>p.bodies.phobos.samples.pop(),p=>p.mars_fixed_rotation_xyzw[0]=[0,0,0,0],p=>p.bodies.deimos.samples[0][0]=NaN]){const p=structuredClone(packet);edit(p);assert.throws(()=>validateMoons(p));}
});
test('both supplied moon models are byte-pinned, self-contained GLBs with kilometre-based visualization dimensions',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/moons/models.json',import.meta.url)));
 for(const model of manifest.models){const bytes=readFileSync(new URL('../public'+model.url,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),model.sha256);assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);assert.equal(model.units_m,1000);
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));assert.ok(gltf.images.every(i=>i.bufferView!==undefined&&!i.uri));assert.ok(gltf.buffers.every(b=>!b.uri));assert.equal(new URL(model.source_page).hostname,'science.nasa.gov');
 }
});

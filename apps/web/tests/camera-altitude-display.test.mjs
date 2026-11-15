import test from 'node:test';
import assert from 'node:assert/strict';
import {CameraAltitude} from '../src/camera-altitude.js';
test('clearance follows displayed negative-elevation relief and increases when moving away',()=>{
 const old=globalThis.document,nodes=new Map();globalThis.document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}};
 try{const host={view:()=> '3d',viewer:{terrainProvider:{qualityAt:()=>({height:-2800,terrain:200})},camera:{positionWC:{x:3396190-8400+6,y:0,z:0}},scene:{verticalExaggeration:3,verticalExaggerationRelativeHeight:0}}};CameraAltitude.prototype.update.call(host);assert.match(nodes.get('altitude-value').textContent,/6\.0 m/);assert.match(nodes.get('altitude-source').textContent,/relief 3×/);host.last=-1000;host.viewer.camera.positionWC.x+=500;CameraAltitude.prototype.update.call(host);assert.match(nodes.get('altitude-value').textContent,/506 m/);assert.equal(host.viewer.terrainProvider.qualityAt().height,-2800);}finally{globalThis.document=old;}
});

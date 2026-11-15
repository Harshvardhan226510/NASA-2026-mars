import test from 'node:test';import assert from 'node:assert/strict';
import {terrainConfidence,cameraClearance,unpackElevation} from '../src/terrain-transition.js';
import {blendTerrain,retainMeasuredTerrain} from '../src/planet.js';
test('a masked edge fades smoothly to context without altering measured elevations',()=>{
 const grid=new Float32Array(17*17).fill(-1000);for(let y=0;y<17;y++)grid.fill(NaN,y*17,y*17+5);
 const {heights,confidence}=terrainConfidence(grid,17,4);
 assert.ok(Number.isNaN(heights[0]));assert.equal(heights[1],-1000);assert.equal(confidence[1],0);assert.ok(confidence[3]>confidence[2]);assert.equal(confidence[5],1);
 const b=[0,0,8,8],native={grid:heights,width:9,bounds:b,transition:{grid:heights,confidence,width:9,bounds:b}},base={grid:new Float32Array(4).fill(-1500),width:2,bounds:b},result=blendTerrain(base,native,b,9);
 assert.equal(result[0],-1500);assert.equal(result[1],-1500);assert.equal(result[5],-1000);assert.ok(result.every(h=>Number.isFinite(h)&&h>=-1500&&h<=-1000));
});
test('adjacent coarse requests use matching padded confidence at their common edge',()=>{
 const sample=(start)=>{const g=new Float32Array(137**2);for(let y=0;y<137;y++)for(let x=0;x<137;x++)g[y*137+x]=y<23?NaN:start+x;return terrainConfidence(g,137);};
 const a=sample(0),b=sample(128);for(let row=0;row<129;row++){assert.equal(a.confidence[row*129+128],b.confidence[row*129]);assert.ok(Object.is(a.heights[row*129+128],b.heights[row*129]));}
});
test('a failed finer terrain transfer keeps the last measured parent',async()=>{
 const coarse={grid:new Float32Array([10]),gridMeters:81};let count=0;
 const a=await retainMeasuredTerrain(coarse,[15,17],async level=>{count++;if(level===17)throw new Error('503');return {grid:new Float32Array([12]),gridMeters:2.5};});
 assert.equal(a.grid[0],12);assert.equal(a.transition,coarse);assert.equal(count,2);
 const b=await retainMeasuredTerrain(coarse,[15],async()=>{throw new Error('503');});assert.equal(b.grid[0],10);
 const controller=new AbortController();controller.abort();await assert.rejects(retainMeasuredTerrain(coarse,[15],async()=>{throw new Error('cancelled');},controller.signal));
});
test('newly arrived higher terrain raises the camera even without another zoom input',()=>{
 assert.equal(cameraClearance(-1915,-1912),-1906);assert.equal(cameraClearance(-1900,-1912),-1900);assert.equal(cameraClearance(10,undefined),10);
});
test('detailed elevation packets reject old or truncated payloads',()=>{
 const buffer=new ArrayBuffer(16+129*129*8),header=new DataView(buffer);header.setUint32(0,0x4d44454d,true);header.setUint32(8,2,true);header.setFloat32(4,81,true);const packet=unpackElevation(buffer);assert.equal(packet.width,129);assert.equal(packet.gridMeters,81);assert.equal(packet.confidence.length,129*129);assert.throws(()=>unpackElevation(buffer.slice(0,-1)));header.setUint32(8,1,true);assert.throws(()=>unpackElevation(buffer));
});

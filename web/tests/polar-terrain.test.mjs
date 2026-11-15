import test from 'node:test';
import assert from 'node:assert/strict';
import {polarTerrainBase,MarsTerrain} from '../src/planet.js';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';

test('unresponsive polar elevation cannot block measured fallback or start unbounded background reads',async()=>{
 const ready=new Map(),transfers=new Map(),reads=[];
 const measured={grid:new Float32Array([-4200,-4201,-4202,-4203]),width:2,bounds:[0,80,1,81],fallback:true};
 const options={ready,transfers,load:(x,y,z)=>{reads.push([x,y,z]);return new Promise(()=>{});},fallback:async()=>measured};
 const result=await polarTerrainBase(334,3,8,options);
 assert.equal(result,measured);assert.equal(transfers.size,1);
 await polarTerrainBase(668,6,9,options);assert.equal(transfers.size,1);
 for(let x=335;x<355;x++)assert.equal(await polarTerrainBase(x,3,8,options),measured);
 assert.equal(transfers.size,4);assert.equal(reads.length,4);
});

test('new polar children use better measured terrain once the background read finishes',async()=>{
 const ready=new Map(),transfers=new Map(),parent={source:'measured parent'},fine={source:'measured fine'};
 ready.set('6/0/83',parent);
 let finish;
 const options={ready,transfers,load:()=>new Promise(resolve=>{finish=()=>{ready.set('7/1/167',fine);resolve(fine);};}),fallback:()=>assert.fail('must retain measured parent')};
 assert.equal(await polarTerrainBase(334,3,8,options),parent);
 finish();await Promise.all(transfers.values());
 assert.equal(await polarTerrainBase(668,6,9,options),fine);
 assert.equal(transfers.size,0);
});

test('a coarse ancestor intersecting the cap renders while its remote elevation is unresponsive',{timeout:1500},async()=>{
 const originalFetch=globalThis.fetch,reads=[],raw=gunzipSync(readFileSync(new URL('../public/mola-topography.dat',import.meta.url)));
 globalThis.fetch=url=>{reads.push(url);return url==='/mola-topography.dat'?Promise.resolve(new Response(raw)):new Promise(()=>{});};
 try{
  const provider=Object.create(MarsTerrain.prototype);provider.C={HeightmapTerrainData:class{constructor(options){Object.assign(this,options);}}};provider.dataset=null;provider.disposed=false;
  const tile=await provider.buildTile(1,0,1,new AbortController().signal);
  assert.equal(tile.width,129);assert.ok(tile.buffer.every(Number.isFinite));assert.ok(Math.max(...tile.buffer)>Math.min(...tile.buffer));
  assert.ok(reads.includes('/mola-topography.dat'));assert.equal(reads.filter(r=>r.startsWith('/api/planet')).length,1);
 }finally{globalThis.fetch=originalFetch;}
});

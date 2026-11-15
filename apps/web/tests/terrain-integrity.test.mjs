import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import Lerc from 'lerc';
import {auditTerrainReference} from '../src/terrain-integrity.js';
test('a narrow multi-kilometre corrupt border fails without erasing isolated edge relief',()=>{const tile={grid:new Float32Array(129*129).fill(0),width:129,bounds:[0,0,1,1]};for(let y=0;y<129;y++)tile.grid[y*129]=5000;const audit=auditTerrainReference(tile,()=>0);assert.equal(audit.medianResidual,0);assert.equal(audit.valid,false);assert.equal(audit.badEdges.length,1);tile.grid.fill(0);tile.grid[64*129]=9000;assert.equal(auditTerrainReference(tile,()=>0).valid,true);});
import {decodeTopography,sampleHeight} from '../src/global-terrain.js';
import {geographicBounds} from '../src/planet-grid.js';
import {retainedTerrainParent,invalidTerrainFallback,blendTerrain} from '../src/planet.js';

test('the actual Sacra Fossae source tile with a five kilometre offset fails independent MOLA validation',()=>{
 const raw=readFileSync(new URL('./fixtures/terrain-7-55-79.lerc',import.meta.url)),d=Lerc.decode(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
 assert.equal(createHash('sha256').update(raw).digest('hex'),'029cdcb98c447dbdff79ac659f45cdfeec91b1f8b98443cdf43f29bce6ce7b3d');
 const bytes=gunzipSync(readFileSync(new URL('../public/mola-topography.dat',import.meta.url))),mola=decodeTopography(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const audit=auditTerrainReference({grid:d.pixels[0],width:d.width,bounds:geographicBounds(79,55,7)},(lon,lat)=>sampleHeight(mola,lon,lat));
 assert.equal(audit.valid,false);assert.ok(audit.medianResidual>5000);assert.equal(audit.systematicFraction,1);
});
test('invalid fine elevation recovers one measured parent instead of keeping a coarse transient fallback',async()=>{
 const coarse={fallback:true},parent={grid:new Float32Array(81).fill(3000),width:9,bounds:[0,0,2,2]},ready=new Map([['5/12/8',coarse]]),calls=[];
 const load=async(...args)=>{calls.push(args);return parent;};
 assert.equal(await invalidTerrainFallback(35,50,7,{ready,load,reference:()=>3000}),parent);assert.deepEqual(calls,[[17,25,6]]);
 assert.equal(await invalidTerrainFallback(35,50,7,{ready,load,reference:()=>3000}),parent);assert.equal(calls.length,1);
 for(const broken of [async()=>{throw Error('source unavailable');},async()=>({...parent,grid:new Float32Array(81).fill(9000)})]){
  let reads=0;const result=await invalidTerrainFallback(35,50,7,{ready:new Map([['5/12/8',coarse]]),load:async(...args)=>{reads++;return broken(...args);},reference:()=>3000,fallback:()=>assert.fail('retain the known measured fallback')});assert.equal(result,coarse);assert.equal(reads,1);
 }
});
test('isolated real peaks and deep craters are retained while both signed systematic offsets are rejected',()=>{
 const tile={grid:new Float32Array(81).fill(-4200),width:9,bounds:[0,0,1,1]};
 tile.grid[40]=2000;tile.grid[42]=-9000;
 assert.equal(auditTerrainReference(tile,()=>-4200).valid,true);
 for(const offset of [-5500,5500]){
  tile.grid.fill(-4200+offset);assert.equal(auditTerrainReference(tile,()=>-4200).valid,false);
 }
 assert.equal(auditTerrainReference(tile,()=>NaN).valid,false);
});
test('the Olympus flat tile cannot pass on its low edge; a valid parent removes the multi-kilometre boundary step',()=>{
 const read=(name,x,y,z)=>{const bytes=readFileSync(new URL('./fixtures/'+name,import.meta.url)),d=Lerc.decode(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));return {grid:d.pixels[0],width:d.width,bounds:geographicBounds(x,y,z)};};
 // This identical wrong cached payload was served at both Sacra and Olympus.
 const bad=read('terrain-7-55-79.lerc',35,50,7),west=read('terrain-7-50-34.lerc',34,50,7),parent=read('terrain-6-25-17.lerc',17,25,6);
 const raw=gunzipSync(readFileSync(new URL('../public/mola-topography.dat',import.meta.url))),mola=decodeTopography(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),reference=(lon,lat)=>sampleHeight(mola,lon,lat);
 const audit=auditTerrainReference(bad,reference);assert.equal(audit.valid,false);assert.ok(audit.medianResidual< -2500);assert.ok(audit.systematicFraction>.6&&audit.systematicFraction<.7);
 assert.equal(auditTerrainReference(west,reference).valid,true);assert.equal(auditTerrainReference(parent,reference).valid,true);
 const ready=new Map([['5/12/8',{fallback:true}],['6/25/17',parent]]),retained=retainedTerrainParent(35,50,7,ready);assert.equal(retained,parent);
 const fixed=blendTerrain(retained,null,bad.bounds,129),neighbor=blendTerrain(west,null,west.bounds,129);let oldStep=0,newStep=0;
 for(let y=0;y<129;y++){oldStep=Math.max(oldStep,Math.abs(bad.grid[y*4*513]-neighbor[y*129+128]));newStep=Math.max(newStep,Math.abs(fixed[y*129]-neighbor[y*129+128]));}
 assert.ok(oldStep>6500);assert.ok(newStep<200,`retained parent edge discrepancy: ${newStep} m`);
 assert.ok(Math.max(...fixed)-Math.min(...fixed)>6000,'retain the measured Olympus slope, not the false flat plateau');
 assert.equal(retainedTerrainParent(35,50,7,new Map()),undefined);
});

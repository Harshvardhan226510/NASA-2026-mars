import test from 'node:test';
import assert from 'node:assert/strict';
import {geographicBounds,sampleGrid,blendTerrain,MarsTerrain} from '../src/planet.js';
test('CTX and Mars terrain share the published two-by-one geographic tile grid',()=>{
 assert.deepEqual(geographicBounds(0,0,0),[-180,-90,0,90]);assert.deepEqual(geographicBounds(1,0,0),[0,-90,180,90]);
 const a=geographicBounds(5,2,3),b=geographicBounds(6,2,3);assert.equal(a[2],b[0]);assert.equal(a[3],b[3]);
});
test('bilinear terrain samples preserve publisher elevations and unknown masks',()=>{
 const bounds=[0,0,2,2];assert.equal(sampleGrid(new Float32Array([-3000,-2900,-2800,-2700]),2,bounds,1,1),-2850);
 assert.equal(sampleGrid(new Float32Array([1,2,3,NaN]),2,bounds,1,1),undefined);assert.equal(sampleGrid(new Float32Array(4),2,bounds,3,1),undefined);
});
test('native source gaps retain known background terrain rather than filling with zero',()=>{
 const bounds=[0,0,2,2],base={grid:new Float32Array([42,42,42,42]),width:2,bounds},native={grid:new Float32Array([NaN,NaN,NaN,NaN]),width:2,bounds};
 assert.ok(blendTerrain(base,native,bounds,3).every(h=>h===42));native.grid.fill(-3000);assert.ok(blendTerrain(base,native,bounds,3).every(h=>h===-3000));
 assert.throws(()=>blendTerrain({...base,grid:native.grid.map(()=>NaN)},null,bounds,3),/unknown/);
});
test('global display subdivision allows full CTX detail but has a finite ceiling',()=>{
 assert.equal(MarsTerrain.prototype.getTileDataAvailable(0,0,14),true);
 assert.equal(MarsTerrain.prototype.getTileDataAvailable(0,0,15),false);
});
test('native terrain subdivision stops at the observation boundary and its published ceiling',()=>{const bounds=geographicBounds(180000,80000,17),provider={dataset:{status:'complete',bounds}};assert.equal(MarsTerrain.prototype.getTileDataAvailable.call(provider,180000,80000,16),true);assert.equal(MarsTerrain.prototype.getTileDataAvailable.call(provider,0,0,16),false);assert.equal(MarsTerrain.prototype.getTileDataAvailable.call(provider,360000,160000,17),false);});

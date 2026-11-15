import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainOverlayContext} from '../src/terrain-overlay-sampling.js';
import {scientificPixels} from '../src/scientific-pixels.js';
import {terrainMetrics} from '../src/terrain-metrics.js';
const item={id:'slope-steepness',engine:'terrain',metric:'slope'},style={min:0,max:40};
test('independent DEM offsets never become artificial slopes or transparent boundary strips',async()=>{
 const tile={grid:new Float32Array(129*129).fill(5000),width:129,bounds:[0,-1,2,1]},context=terrainOverlayContext(tile,tile.bounds);
 assert.equal(context(0,0),null);assert.ok(context(1,0)?.weight>0);
 // Reproduces a boundary offset that the former mixed-grid stencil treated as a cliff.
 assert.ok(terrainMetrics(lon=>lon<0?0:5000,0,0,200).slope>80);
 const pixels=await scientificPixels(item,{sample:()=>0,spacing:15000,confidence:0,style,bounds:tile.bounds,size:33,terrainContext:context});
 for(let i=0;i<pixels.length;i+=4){assert.equal(pixels[i+3],255);assert.deepEqual([...pixels.slice(i,i+4)],[...pixels.slice(0,4)]);}
 assert.equal(terrainOverlayContext({...tile,fallback:true},tile.bounds)(1,0),null);
});
test('fine derivative spacing follows retained parent bounds, not requested child dimensions',()=>{
 const tile={grid:new Float32Array(513*513),width:513,bounds:[0,-4,8,4]};
 const native=terrainOverlayContext(tile,[2,-1,4,1])(3,0);assert.ok(native);assert.ok(Math.abs(native.spacing-8*Math.PI*3396190/180/512)<1e-6);
});
test('northern and southern overlay tiles share the same equator colors and coverage',async()=>{
 const options={sample:(lon,lat)=>100*lat+20*lon,spacing:15000,confidence:0,style,size:17};
 const north=await scientificPixels(item,{...options,bounds:[0,0,10,10]}),south=await scientificPixels(item,{...options,bounds:[0,-10,10,0]});
 assert.deepEqual([...north.slice(16*17*4)],[...south.slice(0,17*4)]);
});

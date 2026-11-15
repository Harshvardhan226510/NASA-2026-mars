import test from 'node:test';
import assert from 'node:assert/strict';
import {tileBounds,planTiles,packTile,unpackTile} from '../src/lod.js';
import {selectOverview} from '../src/raster.js';
import {availableDetail,coverageText} from '../src/coverage.js';
import {orbitPitch} from '../src/navigation.js';
const d={bounds:[-76,-10,-75.9,-9.7],dem_grid_m:[1,1],imagery_grid_m:[.25,.25]};
test('a close view requests its final visible LOD directly, with a bounded tile count',()=>{
 const v=[-75.96,-9.851,-75.955,-9.848],tiles=planTiles(d,v,.2,[-75.958,-9.85]);
 assert.ok(tiles.length>0&&tiles.length<=20);assert.ok(tiles.every(t=>t.lod===0));
 assert.ok(planTiles(d,d.bounds,.2,[-75.95,-9.85]).length<=20);
 assert.throws(()=>tileBounds(d,0,10000,10000));assert.throws(()=>tileBounds(d,-1,0,0));
 const a=tileBounds(d,0,0,0),b=tileBounds(d,0,0,1);assert.equal(a[2],b[0]);assert.equal(a[1],b[1]);
});
test('combined map packets preserve source NaN gaps, elevation and image masks',()=>{
 const heights=new Float32Array(129*129).fill(-3916.9),imagery=new Float32Array(512*512*2).fill(200);heights[0]=NaN;heights.gridMeters=1;imagery.gridMeters=.25;imagery[1]=0;
 const decoded=unpackTile(packTile(heights,imagery).buffer);assert.ok(Number.isNaN(decoded.heights[0]));assert.equal(decoded.heights[1],heights[1]);assert.equal(decoded.pixels[1],0);assert.equal(decoded.imageryGrid,.25);
 assert.throws(()=>unpackTile(new ArrayBuffer(1)));const invalid=packTile(heights,imagery);invalid[0]=0;assert.throws(()=>unpackTile(invalid.buffer));
});
test('native reads do not scan all TIFF directories, while useful overviews skip masks',async()=>{
 const image=(w,mask=false)=>({getWidth:()=>w,getSamplesPerPixel:()=>2,getFileDirectory:()=>({getValue:()=>mask?4:0})});const base=image(4096),calls=[];
 const tiff={getImageCount:()=>{throw new Error('unnecessary scan');},getImage:async i=>{calls.push(i);return i===1?image(2048,true):image(4096/2**(i-1));}};
 assert.equal((await selectOverview(tiff,base,.25,.3)).image,base);assert.deepEqual(calls,[]);
 const selected=await selectOverview(tiff,base,.25,1);assert.equal(selected.scale,4);assert.deepEqual(calls,[1,2,3]);
 const noOverviews={getImage:async i=>{throw new Error(`No image at index ${i}`);}};assert.equal((await selectOverview(noOverviews,base,.25,10)).image,base);
});
test('high detail badges require prepared imagery and view-centre coverage remains explicit',()=>{
 const catalog={datasets:[{...d,region:'VALLES',status:'building',terrain:[{}],imagery:[{}]}],pilots:[]};assert.equal(availableDetail(catalog,'VALLES'),null);
 catalog.datasets[0].status='complete';assert.equal(availableDetail(catalog,'VALLES').imagery,.25);assert.equal(availableDetail(catalog,'GALE'),null);
 assert.equal(coverageText(d,[-77,-9.85],null,false).kind,'outside');assert.equal(coverageText(d,[-75.95,-9.85],null,true).kind,'loading');
 assert.equal(coverageText(d,[-75.95,-9.85],{imagery:.25,terrain:1,mesh:1},false).kind,'detail');assert.match(coverageText(d,[-75.95,-9.85],{imagery:30,terrain:120},true).text,/displayed imagery/);
 assert.ok(orbitPitch(10)<0);assert.ok(orbitPitch(-10)>-Math.PI/2);
});

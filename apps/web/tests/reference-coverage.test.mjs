import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {referencePyramid,sampleReferenceDisplay,sampleReferencePixel} from '../src/reference-display.js';
import {sampleReference} from '../src/scientific-data.js';
import {scientificPixels} from '../src/scientific-pixels.js';

test('shading stays continuous when a valid interpolation footprint first meets a survey gap',async()=>{
 const grid={width:4,height:2,bounds:[-180,-90,180,90],values:new Float32Array([0,10,NaN,30,20,30,NaN,50])};
 const levels=await referencePyramid(grid);
 const left=sampleReferenceDisplay(levels,-45-1e-5,0),right=sampleReferenceDisplay(levels,-45+1e-5,0);
 assert.ok(Math.abs(left-right)<1e-4);assert.ok(Math.abs(right-20)<1e-5);
 assert.equal(sampleReference(grid,-45,0),30);
 assert.ok(Number.isNaN(sampleReferencePixel(levels,45,0).value));
 assert.equal(sampleReferencePixel(levels,45,0).coverage,0);
 assert.ok(sampleReferencePixel(levels,-1,0).coverage<1);
});

test('overview averages weight measured area rather than giving sparse blocks a full vote',async()=>{
 const values=new Float32Array(16);values[0]=100;values[1]=values[4]=values[5]=NaN;
 const levels=await referencePyramid({width:4,height:4,bounds:[-180,-90,180,90],values});
 assert.ok(Math.abs(levels[2].values[0]-100/13)<1e-6);
 assert.equal(levels[2].coverage[0],13/16);
 assert.equal(values[0],100);assert.ok(Number.isNaN(values[1]));
});

test('all shipped mineral components retain their real masks and use finite coverage-aware shading',async()=>{
 const root=new URL('../public/scientific/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root)));
 for(const key of ['olivine-abundance','pyroxene-abundance','hematite-abundance','feldspar-abundance','glass-clay','high-ca-pyroxene','low-ca-pyroxene']){
  const asset=manifest.layers[key],bytes=gunzipSync(readFileSync(new URL(asset.file,root))),values=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const grid={...asset,values},before=Buffer.from(bytes),levels=await referencePyramid(grid);
  for(let y=80;y<grid.height-80;y+=29)for(let x=0;x<grid.width;x+=31){
   const lon=-180+(x+.5)*360/grid.width,lat=90-(y+.5)*180/grid.height;
   for(const footprint of [0,.35,1.4]){const pixel=sampleReferencePixel(levels,lon,lat,footprint);
    if(!Number.isFinite(values[y*grid.width+x])){assert.equal(pixel.coverage,0);assert.ok(Number.isNaN(pixel.value));}
    else{assert.ok(Number.isFinite(pixel.value),key);assert.ok(pixel.coverage>0&&pixel.coverage<=1,key);}
   }
  }
  assert.deepEqual(Buffer.from(values.buffer),before,key);
  assert.equal(sampleReferenceDisplay(levels,-180,36),sampleReferenceDisplay(levels,180,36));
 }
});

test('2D and 3D reference pixels use coverage alpha while missing data stays transparent',async()=>{
 const options={style:{min:0,max:1},bounds:[-180,-90,180,90],size:2};
 const pixels=await scientificPixels({engine:'reference',id:'mineral-composition'},{...options,sample:(lon)=>lon<0?{value:0,coverage:.5}:{value:NaN,coverage:0}});
 assert.equal(pixels[3],128);assert.equal(pixels[7],0);
});

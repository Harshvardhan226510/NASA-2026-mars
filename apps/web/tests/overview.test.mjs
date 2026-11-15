import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {globeDetailWeight,flatDetailWeight,elevationLayerWeights} from '../src/overview-policy.js';
import {blendOpticalGap,globalToneWindow} from '../src/optical-gaps.js';

test('a whole-view scale policy replaces tile-by-tile source transitions smoothly',()=>{
 assert.equal(globeDetailWeight(7_000_000),0);assert.equal(globeDetailWeight(3_200_000),0);assert.equal(globeDetailWeight(1_200_000),1);assert.equal(globeDetailWeight(100_000),1);
 const weights=[3_200_000,2_800_000,2_000_000,1_500_000,1_200_000].map(globeDetailWeight);assert.ok(weights.every((v,i)=>i===0||v>=weights[i-1]));
 assert.equal(flatDetailWeight(3),0);assert.equal(flatDetailWeight(4),.5);assert.equal(flatDetailWeight(5),1);
 for(let d=0;d<=1;d+=.1){const {fine,overview}=elevationLayerWeights(d);assert.ok(Math.abs(fine+(1-fine)*overview-.7)<1e-12);}
});
test('one global tone reference evaluates the same location in parent and child tiles',()=>{
 const field={width:8,height:4,wrapLongitude:true,values:Array.from({length:32},(_,i)=>10*Math.sin((i%8)*Math.PI/4))};
 const pixels=n=>new Uint8ClampedArray(Array.from({length:n},()=>[0,0,0,0]).flat());
 const base=n=>new Uint8ClampedArray(Array.from({length:n},()=>[100,100,100,255]).flat());
 const parent=blendOpticalGap(pixels(16),base(16),4,4,field,globalToneWindow({x:1,y:1,z:2})).pixels;
 const child=blendOpticalGap(pixels(4),base(4),2,2,field,globalToneWindow({x:2,y:2,z:3})).pixels;
 for(let y=0;y<2;y++)for(let x=0;x<2;x++)assert.equal(child[(y*2+x)*4],parent[(y*4+x)*4]);
 const left=blendOpticalGap(pixels(1),base(1),1,1,field,[-.001,.5,.002,.01]).pixels;
 const right=blendOpticalGap(pixels(1),base(1),1,1,field,[.999,.5,.002,.01]).pixels;assert.deepEqual(left,right);
});
test('the fixed overview and global tone are small, source-digested application display assets',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/globe-overview-provenance.json',import.meta.url)));
 assert.equal(manifest.sources.length,64);assert.ok(manifest.sources.every(s=>s.z===2));assert.ok(manifest.sourceAlphaGapFraction>0&&manifest.sourceAlphaGapFraction<.1);
 for(const [file,sha] of Object.entries(manifest.assets))assert.equal(createHash('sha256').update(readFileSync(new URL('../public/'+file,import.meta.url))).digest('hex'),sha);
 const field=JSON.parse(readFileSync(new URL('../public/globe-optical-tone.json',import.meta.url)));assert.equal(field.values.length,field.width*field.height);assert.equal(field.wrapLongitude,true);assert.ok(field.values.every(v=>Number.isFinite(v)&&Math.abs(v)<=64.01));
});

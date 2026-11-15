import test from 'node:test';
import assert from 'node:assert/strict';
import {blendOpticalGap,cropSourceMask,opticalToneField} from '../src/optical-gaps.js';
import {contextQualityRecord,contextTileQuality} from '../src/context-display.js';
const frame=(w,h,value)=>new Uint8ClampedArray(Array.from({length:w*h},()=>[value,value,value,255]).flat());

test('optical balancing changes only masked pixels and keeps real black shadows opaque',()=>{
 const w=64,h=32,primary=frame(w,h,180),base=frame(w,h,140);
 for(let y=0;y<h;y++)for(let x=20;x<44;x++)primary[(y*w+x)*4+3]=0;
 primary[0]=primary[1]=primary[2]=0;
 const before=primary.slice(),result=blendOpticalGap(primary,base,w,h);
 for(let i=0;i<primary.length;i+=4)if(primary[i+3]===255)assert.deepEqual(result.pixels.slice(i,i+4),primary.slice(i,i+4));
 assert.deepEqual(primary,before);assert.equal(result.pixels[(16*w+32)*4+3],255);
 assert.ok(Math.abs(result.pixels[(16*w+32)*4]-180)<=1);
 assert.equal(blendOpticalGap(frame(4,4,0),frame(4,4,140),4,4),null);
});
test('a display-filled gap remains absent from CTX quality and from cropped parent quality',()=>{
 const primary=frame(8,1,100);for(let x=4;x<8;x++)primary[x*4+3]=0;
 const result=blendOpticalGap(primary,frame(8,1,140),8,1),image={width:8,height:1,sourceOpacityMask:result.sourceOpacityMask};
 const record=contextQualityRecord(image,{x:0,y:0,z:0});
 assert.equal(contextTileQuality(record,{x:0,y:0,z:0},[-10,0]),null);
 assert.ok(contextTileQuality(record,{x:0,y:0,z:0},[-160,0]));
 assert.deepEqual([...cropSourceMask(image,[.5,0,.5,1],4,1)],[0]);
 assert.deepEqual([...cropSourceMask(image,[0,0,.5,1],4,1)],[15]);
});
test('missing optical support stays transparent and an entirely missing CTX tile invents no brightness/detail',()=>{
 const primary=frame(16,16,0);for(let i=3;i<primary.length;i+=4)primary[i]=0;
 const base=frame(16,16,124),result=blendOpticalGap(primary,base,16,16);
 assert.deepEqual(result.pixels,base);assert.ok(result.sourceOpacityMask.every(v=>v===0));
 base[3]=0;assert.equal(blendOpticalGap(primary,base,16,16).pixels[3],0);
});
test('adjacent fine tiles sample one shared geographic tone field without an independent brightness jump',()=>{
 const p=frame(64,32,0);for(let i=3;i<p.length;i+=4)p[i]=0;
 const field={values:new Float32Array([-20,20,-20,20]),width:2,height:2},base=frame(64,32,140);
 const left=blendOpticalGap(p,base,64,32,field,[0,0,.5,1]),right=blendOpticalGap(p,base,64,32,field,[.5,0,.5,1]);
 for(let y=0;y<32;y++)assert.ok(Math.abs(left.pixels[(y*64+63)*4]-right.pixels[y*64*4])<=1);
});
test('local gap balancing improves an interior strip without changing CTX or creating tile-edge seams',()=>{
 const w=64,h=32,p=frame(w,h,180),base=frame(w,h,140);for(let y=0;y<h;y++)for(let x=24;x<40;x++)p[(y*w+x)*4+3]=0;
 const global={values:new Float32Array(4),width:2,height:2},local=opticalToneField(p,base,w,h),result=blendOpticalGap(p,base,w,h,{...global,local});
 assert.ok(Math.abs(result.pixels[(16*w+32)*4]-180)<=1);
 for(let i=0;i<p.length;i+=4)if(p[i+3]===255)assert.deepEqual(result.pixels.slice(i,i+4),p.slice(i,i+4));
 const gap=frame(w,h,0);for(let i=3;i<gap.length;i+=4)gap[i]=0;
 const left=blendOpticalGap(gap,base,w,h,{...global,local}),right=blendOpticalGap(gap,base,w,h,{...global,local:{...local,values:new Float32Array(local.values.length).fill(-40)}});
 for(let y=0;y<h;y++)assert.equal(left.pixels[(y*w+w-1)*4],right.pixels[y*w*4]);
});

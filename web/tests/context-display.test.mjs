import test from 'node:test';
import assert from 'node:assert/strict';
import {polarOverviewOpacity,transformContextPixels,planetImageryProvider,featherMaskEdges,polarTileHidden,contextAncestor,contextTileQuality,contextQualityRecord,contextFeatherPixels} from '../src/context-display.js';

test('optical gap transitions keep a bounded physical width as CTX refines',()=>{
 assert.equal(contextFeatherPixels({z:8},512),4);
 assert.ok(contextFeatherPixels({z:10},512)>4);
 assert.equal(contextFeatherPixels({z:12},512),32);
});

test('polar overview policy is symmetric and releases original CTX at detail scale',()=>{
 for(const latitude of [-90,-84,-78,-70,0,70,78,84,90]){
  assert.equal(polarOverviewOpacity(latitude,4),polarOverviewOpacity(-latitude,4));
  assert.equal(polarOverviewOpacity(latitude,7),1);
 }
 assert.equal(polarOverviewOpacity(88,4),0);assert.equal(polarOverviewOpacity(45,4),1);
 assert.ok(polarOverviewOpacity(57,4)>0&&polarOverviewOpacity(57,4)<1);
 assert.ok(polarOverviewOpacity(88,6)>0&&polarOverviewOpacity(88,6)<1);
});
test('grayscale conversion preserves source shadows and missing-data transparency',()=>{
 const pixels=new Uint8ClampedArray([90,50,20,255,0,0,0,255,0,0,0,0,1,1,1,255]);
 transformContextPixels(pixels,4,1,{x:1,y:0,z:0},{grayscale:true});
 assert.equal(pixels[0],pixels[1]);assert.equal(pixels[1],pixels[2]);
 assert.deepEqual([...pixels.slice(4)],[0,0,0,255,0,0,0,0,1,1,1,255]);
});
test('CTX pixel values and masks stay untouched outside polar overview presentation',()=>{
 const source=new Uint8ClampedArray([0,0,0,255,100,100,100,0]);
 for(const coords of [{x:0,y:0,z:9},{x:10,y:8,z:4}]){
  const pixels=source.slice();assert.equal(transformContextPixels(pixels,2,1,coords,{polarOverview:true}),false);assert.deepEqual(pixels,source);
 }
 const pixels=source.slice();transformContextPixels(pixels,2,1,{x:0,y:0,z:4},{polarOverview:true});
 assert.deepEqual([...pixels.slice(0,3)],[0,0,0]);assert.equal(pixels[7],0);
});
test('processed imagery provider preserves Cesium request throttling',async()=>{
 class Provider{requestImage(){return undefined;}}
 const provider=planetImageryProvider({UrlTemplateImageryProvider:Provider},{},{polarOverview:true});
 assert.equal(provider.requestImage(0,0,0,{}),undefined);
});
test('known photographic gaps get a narrow transition without treating black shadows as gaps',()=>{
 const pixels=new Uint8ClampedArray(12*3*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=pixels[i+1]=pixels[i+2]=100;pixels[i+3]=255;}
 for(let y=0;y<3;y++)pixels[(y*12+5)*4+3]=0;
 // A valid black shadow far from the known gap must stay black and opaque.
 pixels[0]=pixels[1]=pixels[2]=0;
 const original=pixels.slice();assert.equal(featherMaskEdges(pixels,12,3),true);
 assert.deepEqual([...pixels.slice(0,4)],[0,0,0,255]);
 for(let i=0;i<pixels.length;i+=4)assert.deepEqual(pixels.slice(i,i+3),original.slice(i,i+3));
 assert.equal(pixels[5*4+3],0);assert.ok(pixels[4*4+3]>0&&pixels[4*4+3]<255);assert.equal(pixels[11*4+3],255);
 const dark=new Uint8ClampedArray([0,0,0,255,1,1,1,255]);assert.equal(featherMaskEdges(dark,2,1),false);assert.deepEqual([...dark],[0,0,0,255,1,1,1,255]);
});
test('infrared visual temperatures get a monotonic context ramp with unchanged source masks',()=>{
 const pixels=new Uint8ClampedArray([0,0,0,255,64,64,64,255,255,255,255,255,0,0,0,0]);
 transformContextPixels(pixels,4,1,{x:0,y:0,z:0},{infraredDisplay:true});
 assert.equal(pixels[0],32);assert.equal(pixels[8],224);assert.ok(pixels[4]>32&&pixels[4]<224);
 assert.deepEqual([pixels[3],pixels[7],pixels[11],pixels[15]],[255,255,255,0]);
});
test('only fully hidden coarse polar tiles may skip their photography transfer',()=>{
 assert.equal(polarTileHidden({x:0,y:0,z:3}),true);assert.equal(polarTileHidden({x:0,y:7,z:3}),true);
 assert.equal(polarTileHidden({x:0,y:1,z:3}),false);assert.equal(polarTileHidden({x:0,y:0,z:6}),false);
 assert.equal(polarTileHidden({x:0,y:0,z:0}),false);
});
test('infrared and fine polar coverage blend by latitude instead of ending in a circular cut',()=>{
 const make=()=>new Uint8ClampedArray(Array.from({length:90},()=>[100,100,100,255]).flat());
 const thermal=make(),detail=make();
 transformContextPixels(thermal,1,90,{x:0,y:0,z:0},{infraredDisplay:true});
 transformContextPixels(detail,1,90,{x:0,y:0,z:0},{polarDetail:true});
 const alpha=(pixels,lat)=>pixels[Math.floor((90-lat)/2)*4+3];
 assert.equal(alpha(thermal,70),0);assert.equal(alpha(thermal,50),255);assert.ok(alpha(thermal,60)>0&&alpha(thermal,60)<255);
 assert.equal(alpha(detail,55),0);assert.equal(alpha(detail,75),255);assert.ok(alpha(detail,65)>0&&alpha(detail,65)<255);
 for(let y=1;y<90;y++){assert.ok(Math.abs(thermal[y*4+3]-thermal[(y-1)*4+3])<80);assert.ok(Math.abs(detail[y*4+3]-detail[(y-1)*4+3])<80);}
});
test('recreated failed imagery objects cannot restart an unbounded source retry loop',()=>{
 let report;
 class Provider{constructor(){this.errorEvent={addEventListener:callback=>{report=callback;}};}requestImage(){return undefined;}}
 planetImageryProvider({UrlTemplateImageryProvider:Provider},{});
 const decisions=[];for(let i=0;i<6;i++){const error={x:958,y:501,level:9,timesRetried:0};report(error);decisions.push(error.retry);}
 assert.deepEqual(decisions,[true,true,false,false,false,false]);
 const other={x:959,y:501,level:9,timesRetried:0};report(other);assert.equal(other.retry,true);
});
test('a retained ancestor is cropped to the exact child geography, including both hemispheres',()=>{
 for(const child of [{x:5,y:2,z:3},{x:958,y:501,z:9},{x:0,y:0,z:1}]){
  const parent=contextAncestor(child,child.z-1),factor=2;
  assert.equal(parent.x*factor+parent.window[0]*factor,child.x);assert.equal(parent.y*factor+parent.window[1]*factor,child.y);
  assert.equal(parent.window[2],.5);assert.equal(parent.window[3],.5);
 }
 assert.deepEqual(contextAncestor({x:958,y:501,z:9},0),{x:1,y:0,z:0,window:[446/512,501/512,1/512,1/512]});
});
test('a damaged fine tile uses a complete parent and stops after a bounded fallback',async()=>{
 const originalDocument=globalThis.document,draws=[],calls=[];
 globalThis.document={createElement:()=>({width:0,height:0,dataset:{},getContext:()=>({drawImage:(...args)=>draws.push(args)})})};
 try{
  const measured={width:512,height:512};
  class Provider{requestImage(x,y,z){calls.push([x,y,z]);return z===7?Promise.resolve(measured):Promise.reject(new Error('truncated frame'));}}
  const provider=planetImageryProvider({UrlTemplateImageryProvider:Provider},{});
  const result=await provider.requestImage(293,56,8);
  assert.deepEqual(calls,[[293,56,8],[146,28,7]]);
  assert.equal(result.dataset.sourceLevel,'7');assert.equal(result.dataset.requestedLevel,'8');
  assert.deepEqual(draws[0],[measured,256,0,256,256,0,0,512,512]);
  calls.length=0;draws.length=0;
  await provider.requestImage(292,56,8);
  assert.deepEqual(calls,[[292,56,8]]);assert.equal(draws[0][1],0);
  class Unavailable{requestImage(x,y,z){calls.push([x,y,z]);return Promise.reject(new Error('unavailable'));}}
  calls.length=0;const empty=await planetImageryProvider({UrlTemplateImageryProvider:Unavailable},{}).requestImage(293,56,8);
  assert.equal(calls.length,2);assert.equal(empty.width,1);assert.equal(empty.dataset.sourceState,'unavailable');
 }finally{globalThis.document=originalDocument;}
});

test('polar quality reports the measured fallback grid, never the requested finer level',()=>{
 const samples=[];
 const image={width:512,height:512,dataset:{sourceLevel:'7'},getContext:()=>({getImageData:(x,y)=>{samples.push([x,y]);return {data:[0,0,0,255]};}})};
 const coords={x:3842,y:1972,z:11},point=[157.7,-83.35];
 const quality=contextTileQuality(image,coords,point,{source:'CTX',nativeMeters:5});
 assert.equal(quality.level,7);assert.equal(quality.fallback,true);assert.ok(quality.metres>160&&quality.metres<164);
 assert.deepEqual(samples,[[141,172]]);
 assert.equal(contextTileQuality(image,coords,[54.96,87.32]),null);
 image.dataset.sourceLevel='11';assert.ok(contextTileQuality(image,coords,point).metres<11);
});

test('transparent polar overviews and missing data cannot claim loaded photographic detail',()=>{
 const image={width:512,height:512,getContext:()=>({getImageData:()=>({data:[0,0,0,0]})})};
 assert.equal(contextTileQuality(image,{x:167,y:1,z:7},[54.96,87.32]),null);
 image.getContext=()=>({getImageData:()=>({data:[0,0,0,255]})});
 const blackShadow=contextTileQuality(image,{x:167,y:1,z:7},[54.96,87.32]);
 assert.ok(blackShadow);assert.equal(blackShadow.fallback,false);
 assert.equal(contextTileQuality({width:1,height:1},{x:0,y:0,z:0},[0,80]),null);
});

test('compact quality masks preserve exact missing pixels without retaining image canvases',()=>{
 const image={width:8,height:1,dataset:{sourceLevel:'10'},getContext:()=>({getImageData:()=>({data:new Uint8ClampedArray([0,0,0,255,100,100,100,0,1,1,1,255,1,1,1,255,1,1,1,255,1,1,1,255,1,1,1,255,1,1,1,255])})})};
 const record=contextQualityRecord(image,{x:0,y:0,z:12});
 assert.equal(record.opacityMask.length,1);assert.equal(record.opacityMask[0],253);assert.equal(record.getContext,undefined);
 assert.equal(contextTileQuality(record,{x:0,y:0,z:0},[-146.25,0]),null);
 assert.equal(contextTileQuality(record,{x:0,y:0,z:0},[-168.75,0]).level,10);
});

test('loaded polar resolution survives decoded-canvas eviction while surrounding strips finish',async()=>{
 class Provider{requestImage(){return Promise.resolve({width:512,height:512});}}
 const provider=planetImageryProvider({UrlTemplateImageryProvider:Provider},{},{source:'CTX',nativeMeters:5});
 await provider.requestImage(2673,30,11);
 for(let x=0;x<100;x++)await provider.requestImage(x,30,11);
 const quality=provider.qualityAt(54.96,87.32);assert.equal(quality.source,'CTX');assert.equal(quality.level,11);assert.ok(quality.metres<11);
});

test('a pending sharper request leaves its loaded ancestor available unchanged',async()=>{
 let finish;const parent={width:512,height:512},fine={width:512,height:512};let parentReads=0;
 class Provider{requestImage(x,y,z){if(z===7){parentReads++;return Promise.resolve(parent);}return new Promise(resolve=>{finish=resolve;});}}
 const provider=planetImageryProvider({UrlTemplateImageryProvider:Provider},{});
 assert.equal(await provider.requestImage(146,28,7),parent);let completed=false;
 const pending=provider.requestImage(293,56,8).then(v=>{completed=true;return v;});
 await Promise.resolve();assert.equal(completed,false);assert.equal(await provider.requestImage(146,28,7),parent);assert.equal(parentReads,1);
 finish(fine);assert.equal(await pending,fine);
});

test('reused imagery stays in the bounded cache while neighbouring tiles arrive',async()=>{
 const reads=new Map();class Provider{requestImage(x,y,z){const key=`${z}/${y}/${x}`;reads.set(key,(reads.get(key)??0)+1);return Promise.resolve({width:512,height:512});}}
 const provider=planetImageryProvider({UrlTemplateImageryProvider:Provider},{}),centre=await provider.requestImage(200,20,9);
 for(let x=0;x<130;x++){await provider.requestImage(x,20,9);assert.equal(await provider.requestImage(200,20,9),centre);}
 assert.equal(reads.get('9/20/200'),1);
});

test('a late failed duplicate cannot replace successfully loaded imagery with a coarse fallback',async()=>{
 let reject;let calls=0;const fine={width:512,height:512};
 class Provider{requestImage(){calls++;return calls===1?new Promise((resolve,fail)=>{reject=fail;}):Promise.resolve(fine);}}
 const provider=planetImageryProvider({UrlTemplateImageryProvider:Provider},{}),older=provider.requestImage(293,56,8);
 assert.equal(await provider.requestImage(293,56,8),fine);reject(Error('late transfer failed'));assert.equal(await older,fine);assert.equal(calls,2);
});

test('cancelled camera requests never resolve as successful coarse imagery',async()=>{
 const calls=[];class Provider{requestImage(x,y,z){calls.push(z);return Promise.reject(new DOMException('View changed','AbortError'));}}
 const provider=planetImageryProvider({UrlTemplateImageryProvider:Provider},{});
 await assert.rejects(provider.requestImage(293,56,8,{cancelled:true}),{name:'AbortError'});assert.deepEqual(calls,[8]);
});

test('an aborted transfer on a live consumer still draws a measured ancestor instead of failing blank',async()=>{
 const originalDocument=globalThis.document,draws=[],parent={width:512,height:512};
 globalThis.document={createElement:()=>({width:0,height:0,dataset:{},getContext:()=>({drawImage:(...args)=>draws.push(args)})})};
 try{
  class Provider{requestImage(x,y,z){return z===7?Promise.resolve(parent):Promise.reject(new DOMException('Transfer interrupted','AbortError'));}}
  let renders=0;const provider=planetImageryProvider({UrlTemplateImageryProvider:Provider},{},{onReady:()=>renders++});await provider.requestImage(146,28,7);renders=0;
  const image=await provider.requestImage(293,56,8,{cancelled:false});assert.equal(image.dataset.sourceLevel,'7');assert.equal(draws[0][0],parent);assert.equal(renders,1);
 }finally{globalThis.document=originalDocument;}
});

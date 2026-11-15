import test from 'node:test';
import assert from 'node:assert/strict';
import {contextImageKey,loadContextImage,cachedContextImage,croppedContextLevel,planetImageryProvider,contextTileQuality} from '../src/context-display.js';
import {MarsTerrain} from '../src/planet.js';

function fixture(){
 const saved={fetch:globalThis.fetch,document:globalThis.document,createImageBitmap:globalThis.createImageBitmap};let reads=0,decodes=0;
 globalThis.document={createElement:()=>{const canvas={width:8,height:8,dataset:{},draws:[]};canvas.getContext=()=>({drawImage:(...args)=>canvas.draws.push(args),clearRect(){},getImageData:()=>({data:new Uint8ClampedArray(Array.from({length:canvas.width*canvas.height},()=>[90,50,20,255]).flat())}),putImageData(frame){canvas.frame=frame;}});return canvas;}};
 globalThis.fetch=async()=>{reads++;return new Response(new Uint8Array([1]));};
 globalThis.createImageBitmap=async()=>{decodes++;return {width:8,height:8,close(){}};};
 return {counts:()=>({reads,decodes}),restore:()=>Object.assign(globalThis,saved)};
}
test('source/style keys agree across 2D/3D options but never mix colour with grayscale',()=>{
 const p={x:4,y:2,z:3},url='/sharing-key/{z}/{y}/{x}';assert.equal(contextImageKey(url,p,{maskEdges:true,source:'CTX',keepBuffer:2}),contextImageKey(url,p,{maskEdges:true,sharedImages:true,onReady(){}}));assert.notEqual(contextImageKey(url,p,{}),contextImageKey(url,p,{grayscale:true}));assert.equal(contextImageKey(url,p),contextImageKey(url,{...p,x:20}));
});
test('simultaneous map requests share one transfer, one decode and the same processed canvas',async()=>{
 const f=fixture();try{const url='/sharing-one/{z}/{y}/{x}',p={x:4,y:2,z:3},[a,b]=await Promise.all([loadContextImage(url,p,{grayscale:true}),loadContextImage(url,p,{grayscale:true,sharedImages:true})]);assert.equal(a,b);assert.deepEqual(f.counts(),{reads:1,decodes:1});assert.equal(a.frame.data[0],a.frame.data[1]);assert.equal(await loadContextImage(url,p,{grayscale:true}),a);}finally{f.restore();}
});
test('cancelling one view does not cancel a tile still required by the other view',async()=>{
 const f=fixture(),a=new AbortController(),b=new AbortController();try{
  const first=loadContextImage('/sharing-cancel/{z}/{y}/{x}',{x:4,y:2,z:3},{},a.signal),second=loadContextImage('/sharing-cancel/{z}/{y}/{x}',{x:4,y:2,z:3},{},b.signal);a.abort();await assert.rejects(first,{name:'AbortError'});assert.equal((await second).width,8);assert.deepEqual(f.counts(),{reads:1,decodes:1});
 }finally{f.restore();}
});
test('a complete cached child quartet preserves finer pixels and source masks without another fetch',async()=>{
 const f=fixture();try{
  const url='/sharing-detail/{z}/{y}/{x}',p={x:4,y:2,z:3},parent=await loadContextImage(url,p,{});assert.equal(cachedContextImage(url,p),parent);
  const children=[];for(let y=0;y<2;y++)for(let x=0;x<2;x++)children.push(await loadContextImage(url,{x:8+x,y:4+y,z:4},{}));
  children[0].sourceOpacityMask=new Uint8Array(8);const before=f.counts(),detail=await loadContextImage(url,p,{});assert.equal(detail.width,16);assert.equal(detail.height,16);assert.deepEqual(detail.draws.map(d=>d.slice(1)),[[0,0],[8,0],[0,8],[8,8]]);assert.deepEqual(f.counts(),before);
  assert.equal(contextTileQuality(detail,p,[-85,40]),null);assert.ok(contextTileQuality(detail,p,[-70,40]));assert.equal(cachedContextImage(url,p),detail);
 }finally{f.restore();}
});
test('a 3D provider reuses a ready 2D image and still preserves Cesium scheduling for cold tiles',async()=>{
 const f=fixture();try{
  const url='/sharing-provider/{z}/{y}/{x}',p={x:4,y:2,z:3},image=await loadContextImage(url,p,{});let scheduled=0,notify=0;
  class Provider{requestImage(){assert.fail('The shared path must not decode again');}}
  const C={UrlTemplateImageryProvider:Provider,RequestScheduler:{request(r){scheduled++;return r.requestFunction();}}};const provider=planetImageryProvider(C,{url},{sharedImages:true,onReady:()=>notify++});
  assert.equal(await provider.requestImage(4,2,3,{}),image);assert.equal(scheduled,0);assert.equal(notify,1);assert.deepEqual(f.counts(),{reads:1,decodes:1});
  assert.equal((await provider.requestImage(5,2,3,{})).width,8);assert.equal(scheduled,1);assert.deepEqual(f.counts(),{reads:2,decodes:2});
 }finally{f.restore();}
});
test('native geometric error never rises across a child level or regresses photographic selection',()=>{
 const provider=Object.create(MarsTerrain.prototype);provider.error0=1024;for(const dataset of [null,{status:'complete'}]){provider.dataset=dataset;for(let level=0;level<17;level++)assert.ok(provider.getLevelMaximumGeometricError(level+1)<provider.getLevelMaximumGeometricError(level));}provider.dataset={};assert.equal(provider.getLevelMaximumGeometricError(11),2);assert.equal(provider.getLevelMaximumGeometricError(15),.125);
});
test('cropped shared detail retains its actual sampling instead of claiming the coarse parent spacing',()=>{assert.equal(croppedContextLevel({width:1024},8,512),9);assert.equal(croppedContextLevel({width:512},8,512),8);});
test('slow photographic baselines cannot occupy all transfer slots needed by CTX detail',async()=>{
 const f=fixture(),abort=new AbortController();let baselines=0;
 try{
  globalThis.fetch=async(url,{signal}={})=>{if(url.includes('kind=baseline')){baselines++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}return new Response(new Uint8Array([1]));};
  const waiting=Array.from({length:6},(_,x)=>loadContextImage('/api/planet?kind=baseline&sharing-isolation=1&z={z}&y={y}&x={x}',{x,y:0,z:3},{},abort.signal));const caught=Promise.allSettled(waiting);
  const detail=await loadContextImage('/sharing-fast-detail/{z}/{y}/{x}',{x:4,y:2,z:3},{});assert.equal(detail.width,8);assert.equal(baselines,2);abort.abort();await caught;
 }finally{abort.abort();f.restore();}
});
test('coarse CTX bootstrap uses bundled photography, not serial remote ancestors, with honest sampling',async()=>{
 const f=fixture(),urls=[];try{
  globalThis.fetch=async url=>{urls.push(url);return new Response(new Uint8Array([1]));};globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
  const image=await loadContextImage('/bootstrap-test?kind=imagery&z={z}&y={y}&x={x}',{x:8,y:4,z:4},{bootstrapOverview:true});assert.deepEqual(urls,['/globe-overview-0.jpg']);assert.equal(image.dataset.sourceLevel,'2');assert.equal(image.dataset.sourceState,'overview');const q=contextTileQuality(image,{x:8,y:4,z:4},[-85,40]);assert.equal(q.source,'CTX / Viking overview');assert.ok(q.metres>5200&&q.metres<5220);assert.equal(q.fallback,true);
 }finally{f.restore();}
});

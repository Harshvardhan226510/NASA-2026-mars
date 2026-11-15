import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {stableGlobeDetail,imageryReadyCallback,GLOBE_OVERVIEW,CtxDetailPrefetch,mapLoadingMessage} from '../src/globe-loading.js';
import {MarsTerrain} from '../src/planet.js';
import {planetImageryProvider} from '../src/context-display.js';

test('ready image pixels wake an idle render immediately; UI updates alone are coalesced',()=>{
 let renders=0,updates=0;const frames=[],viewer={scene:{requestRender(){renders++;}}},ready=imageryReadyCallback(viewer,()=>updates++,fn=>frames.push(fn));
 ready();assert.equal(renders,1);assert.equal(updates,0);ready();assert.equal(renders,2);assert.equal(frames.length,1);frames.shift()();assert.equal(updates,1);
 ready();assert.equal(renders,3);assert.equal(frames.length,1);
});

test('delayed provider completion requests a new render after the original network frame is idle',async()=>{
 let finish,renders=0;const frames=[],viewer={scene:{requestRender(){renders++;}}};
 class Provider{requestImage(){return new Promise(resolve=>{finish=resolve;});}}
 const provider=planetImageryProvider({UrlTemplateImageryProvider:Provider},{},{onReady:imageryReadyCallback(viewer,()=>{},fn=>frames.push(fn))});
 const pending=provider.requestImage(20,10,6);assert.equal(renders,0);finish({width:512,height:512});await pending;assert.equal(renders,1);assert.equal(frames.length,1);
});
test('detail tolerance stays fixed through camera motion without delayed quality downgrades',()=>{
 const callbacks={start:[],end:[]};const event=k=>({addEventListener(fn){callbacks[k].push(fn);return ()=>{};}});
 const viewer={camera:{moveStart:event('start'),moveEnd:event('end')},scene:{globe:{maximumScreenSpaceError:2.4}}};stableGlobeDetail(viewer);
 for(let i=0;i<10;i++){callbacks.start.forEach(fn=>fn());assert.equal(viewer.scene.globe.maximumScreenSpaceError,.6);callbacks.end.forEach(fn=>fn());assert.equal(viewer.scene.globe.maximumScreenSpaceError,.6);}
 assert.deepEqual(callbacks,{start:[],end:[]});assert.equal(viewer.scene.globe.tileCacheSize,256);assert.equal(viewer.scene.globe.preloadAncestors,true);assert.equal(viewer.scene.globe.preloadSiblings,false);
});
test('bootstrap photographs are existing local assets with explicit coarse resolution',()=>{
 assert.equal(GLOBE_OVERVIEW.maximumLevel,0);assert.equal(GLOBE_OVERVIEW.tileWidth,2048);
 for(const x of [0,1])assert.ok(existsSync(new URL('../public'+GLOBE_OVERVIEW.url.replace('{x}',x),import.meta.url)));
});
test('the native CTX tile begins warming at 100 km and stale view requests are cancelled',()=>{
 let point=[-180,0];const calls=[];
 const provider=mode=>({prefetch(coords,signal){calls.push({mode,coords,signal});return Promise.resolve();}});
 const color=provider('color'),grayscale=provider('gray'),prefetch=new CtxDetailPrefetch(()=>point);
 prefetch.update(100_001,color);assert.equal(calls.length,0);
 prefetch.update(100_000,color);assert.deepEqual(calls[0].coords,{x:0,y:2048,z:12});
 prefetch.update(95_000,color);assert.equal(calls.length,1);
 point=[180,0];prefetch.update(90_000,color);assert.equal(calls.length,1);
 point=[179.98,0];prefetch.update(90_000,grayscale);
 assert.equal(calls[0].signal.aborted,true);assert.equal(calls[1].mode,'gray');
 assert.equal(calls[1].coords.x,8191);
 prefetch.update(110_000,grayscale);assert.equal(calls[1].signal.aborted,true);
 point=[0,89];prefetch.update(90_000,color);assert.equal(calls.length,2);
});
test('map loading status reports active work only in visible surface views',()=>{
 const work={native:3,retrying:true,prefetch:true,globe:4,flat:true};
 assert.equal(mapLoadingMessage({...work,showGlobe:true,showFlat:true}),'Retrying surface data…');
 assert.equal(mapLoadingMessage({...work,native:0,showGlobe:true}),'Loading 5 m/px CTX imagery…');
 assert.equal(mapLoadingMessage({showGlobe:true,globe:1}),'Loading map detail…');
 assert.equal(mapLoadingMessage({...work,showFlat:true}),'Loading 2D imagery…');
 assert.equal(mapLoadingMessage(work),'');
 assert.equal(mapLoadingMessage({showGlobe:true,showFlat:true}),'');
});
test('completion of an older CTX preload cannot clear the current loading status',async()=>{
 let point=[0,0];const pending=[],settle=[];
 const prefetch=new CtxDetailPrefetch(()=>point,value=>pending.push(value));
 const provider={prefetch:()=>new Promise((resolve,reject)=>settle.push({resolve,reject}))};
 prefetch.update(80_000,provider);
 point=[1,0];prefetch.update(80_000,provider);
 settle[0].resolve();await new Promise(setImmediate);
 assert.deepEqual(pending,[true,true]);
 settle[1].reject(Error('Tile unavailable'));await new Promise(setImmediate);
 assert.deepEqual(pending,[true,true,false]);
});
test('world-scale nonpolar geometry does not wait for a remote terrain service; local refinement still requests it',{timeout:2500},async()=>{
 const previous=globalThis.fetch,reads=[],raw=gunzipSync(readFileSync(new URL('../public/mola-topography.dat',import.meta.url)));
 globalThis.fetch=async url=>{reads.push(url);return url==='/mola-topography.dat'?new Response(raw):new Response('',{status:503});};
 try{
  const provider=Object.create(MarsTerrain.prototype);provider.C={HeightmapTerrainData:class{constructor(o){Object.assign(this,o);}}};provider.dataset=null;provider.disposed=false;
  for(const [x,y,level] of [[1,1,1],[3,3,2],[7,7,3]]){const tile=await provider.buildTile(x,y,level,new AbortController().signal);assert.equal(tile.width,129);assert.ok(tile.buffer.every(Number.isFinite));assert.ok(Math.max(...tile.buffer)>Math.min(...tile.buffer));}
  assert.deepEqual(reads,['/mola-topography.dat']);
  const fine=await provider.buildTile(15,15,4,new AbortController().signal);assert.ok(fine.buffer.every(Number.isFinite));assert.ok(reads.some(url=>url.includes('kind=terrain&z=5')));
 }finally{globalThis.fetch=previous;}
});

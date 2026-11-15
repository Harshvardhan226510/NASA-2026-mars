import test from 'node:test';
import assert from 'node:assert/strict';
import {RangeClient} from '../src/range-client.js';
import {pixelStencil} from '../src/raster.js';
test('duplicate TIFF range requests share one transfer and retry a transient failure',async()=>{
 let count=0;const client=new RangeClient('https://test.invalid/api/raster?asset=example',{fetcher:async()=>{count++;await new Promise(resolve=>setImmediate(resolve));return count===1?new Response('unavailable',{status:503}):new Response(new Uint8Array([1,2,3]),{status:206});},wait:async()=>{}});
 const [a,b]=await Promise.all([client.request({headers:{Range:'bytes=0-2'}}),client.request({headers:{Range:'bytes=0-2'}})]);
 assert.equal(count,2);assert.equal(a,b);assert.deepEqual([...new Uint8Array(await a.getData())],[1,2,3]);
});
test('TIFF transfers stay bounded even when the decoder asks for many blocks',async()=>{
 let running=0,peak=0;const client=new RangeClient('https://test.invalid/bounded',{fetcher:async()=>{peak=Math.max(peak,++running);await new Promise(resolve=>setTimeout(resolve,3));running--;return new Response(new Uint8Array([1]),{status:206});}});
 await Promise.all(Array.from({length:12},(_,i)=>client.request({headers:{Range:`bytes=${i}-${i}`}})));assert.ok(peak<=4);
});
test('prepared raster edge pixels remain sampleable without filling outside the footprint',()=>{
 assert.deepEqual(pixelStencil(-.25,.5,2,2).indices,[0,1,2,3]);assert.equal(pixelStencil(-.25,.5,2,2).u,0);
 assert.deepEqual(pixelStencil(1.25,.5,2,2).indices,[1,1,3,3]);assert.equal(pixelStencil(-.51,.5,2,2),null);
});
test('the supplied fetch function is called without a client-object receiver',async()=>{
 const client=new RangeClient('https://test.invalid/receiver',{fetcher:async function(){assert.equal(this,undefined);return new Response(new Uint8Array([1]),{status:206});}});
 assert.equal((await client.request({headers:{Range:'bytes=0-0'}})).status,206);
});

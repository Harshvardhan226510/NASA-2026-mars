import test from 'node:test';
import assert from 'node:assert/strict';
import {RasterFileCache,recoverSurfaceRead,mapErrorMessage} from '../src/recovery.js';

test('a failed decoded block is reopened before a surface retry',async()=>{
 let opens=0;const retries=[];
 const cache=new RasterFileCache(()=>({attempt:++opens}));
 const result=await recoverSurfaceRead(()=>cache.read('terrain',file=>{
  if(file.attempt===1)throw new AggregateError([undefined],'Request failed');
  return 'decoded terrain';
 }),{wait:async()=>{},onRetry:attempt=>retries.push(attempt)});
 assert.equal(result,'decoded terrain');assert.equal(opens,2);assert.deepEqual(retries,[1]);
 await cache.read('terrain',()=>{});assert.equal(opens,2);
});

test('failed opening and a stale failed reader do not poison replacement files',async()=>{
 let opens=0,rejectOld;const cache=new RasterFileCache(()=>++opens);
 await assert.rejects(cache.read('a',()=>{throw new Error('opening failed');}));
 assert.equal(await cache.read('a',file=>file),2);
 const old=cache.read('a',()=>new Promise((_,reject)=>{rejectOld=reject;}));
 await new Promise(resolve=>setImmediate(resolve));cache.clear();
 assert.equal(await cache.read('a',file=>file),3);rejectOld(new Error('stale failure'));
 await assert.rejects(old);assert.equal(await cache.read('a',file=>file),3);
});

test('surface recovery stops after three attempts and stops when the view changes',async()=>{
 let attempts=0;
 await assert.rejects(recoverSurfaceRead(()=>{attempts++;throw new Error('offline');},{wait:async()=>{}}));
 assert.equal(attempts,3);
 let alive=true;attempts=0;
 await assert.rejects(recoverSurfaceRead(()=>{attempts++;throw new Error('offline');},{alive:()=>alive,wait:async()=>{alive=false;}}),{name:'AbortError'});
 assert.equal(attempts,1);
 assert.match(mapErrorMessage(new AggregateError([undefined],'Request failed')),/Refresh available data/);
});

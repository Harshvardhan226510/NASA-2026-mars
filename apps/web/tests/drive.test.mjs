import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRange,boundedDriveRead,assets} from '../api/drive.mjs';
test('a final partial TIFF block is clamped to the actual file length',()=>assert.deepEqual(parseRange('bytes=65536-131071',80000),{start:65536,end:79999}));
test('range limits reject full-file, suffix, multi-range, beyond-EOF and oversized requests',()=>{for(const value of ['',undefined,'bytes=-30','bytes=0-10,20-30','bytes=90-10','bytes=100-101','bytes=0-2097152'])assert.throws(()=>parseRange(value,100));});
test('Drive ignores a range: refuse the full response before consuming it',async()=>{await assert.rejects(boundedDriveRead('1234567890abcdefghijk',{range:'bytes=0-10',fetcher:async()=>new Response('unsafe',{status:200,headers:{'content-type':'image/tiff'}})}),/did not honor/);});
test('Drive interstitials are reported as unavailable data, never decoded as imagery',async()=>{await assert.rejects(boundedDriveRead('1234567890abcdefghijk',{range:'bytes=0-10',fetcher:async()=>new Response('<html>approval</html>',{headers:{'content-type':'text/html'}})}),/unavailable/);});
test('partial raster response keeps exact bytes and range identity',async()=>{const r=await boundedDriveRead('1234567890abcdefghijk',{range:'bytes=4-7',maxBytes:4,fetcher:async()=>new Response(new Uint8Array([1,2,3,4]),{status:206,headers:{'content-type':'image/tiff','content-range':'bytes 4-7/100','content-length':'4'}})});assert.deepEqual([...r.bytes],[1,2,3,4]);assert.equal(r.contentRange,'bytes 4-7/100');});
test('only catalogue-published assets can be addressed',()=>{const list=assets({datasets:[{id:'known',terrain:[{key:'tile',id:'drive-id'}]}],pilots:[]});assert.ok(list.has('known/terrain/tile'));assert.equal(list.get('arbitrary/drive-id'),undefined);});

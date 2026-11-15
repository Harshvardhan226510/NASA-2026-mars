import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {normalizeTile,tileAddress} from '../api/planet.mjs';
test('planet delivery accepts only bounded tiles from the fixed public Mars sources',()=>{
 assert.ok(tileAddress({kind:'terrain',z:'0',x:'1',y:'0'}).url.endsWith('MDEM200M/ImageServer/tile/0/0/1'));
 for(const query of [{kind:'terrain',z:8,x:0,y:0},{kind:'imagery',z:0,x:2,y:0},{kind:'imagery',z:0,x:0,y:1},{kind:'imagery',z:-1,x:0,y:0},{kind:'https://evil.example',z:0,x:0,y:0}])assert.throws(()=>tileAddress(query));
});
test('mislabelled and genuinely compressed planet tiles yield identical source bytes',()=>{
 const raw=Buffer.from([0xff,0xd8,0xff,0xd9]);assert.deepEqual(normalizeTile(raw,'imagery').bytes,raw);assert.deepEqual(normalizeTile(gzipSync(raw),'imagery').bytes,raw);
 assert.throws(()=>normalizeTile(Buffer.from('CntZImage incomplete'),'terrain'));
 assert.throws(()=>normalizeTile(Buffer.from('<html>not terrain</html>'),'terrain'),/incomplete/);
 assert.throws(()=>normalizeTile(Buffer.from('<html>not an image</html>'),'imagery'),/incomplete/);
 assert.throws(()=>normalizeTile(Buffer.from([0x89,0x50,0x4e,0x47,0,0]),'imagery'),/incomplete/);
 assert.throws(()=>normalizeTile(Buffer.from([0xff,0xd8,0,0]),'imagery'),/incomplete/);
});
test('the exact publisher empty CTX JPEG cannot cover valid parent photography',()=>{
 const empty=readFileSync(new URL('./fixtures/ctx-publisher-empty.jpg',import.meta.url));
 assert.equal(empty.length,1199);assert.throws(()=>normalizeTile(empty,'imagery'),error=>error.sourceMissing===true);
 assert.throws(()=>normalizeTile(gzipSync(empty),'imagery'),error=>error.sourceMissing===true);
 // This rule is source-specific; it does not discard arbitrary dark JPEGs.
 assert.deepEqual(normalizeTile(empty,'baseline').bytes,empty);
});

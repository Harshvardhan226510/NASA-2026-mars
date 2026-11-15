import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeTopography,sampleHeight} from '../src/global-terrain.js';
import {blendTerrain,MarsTerrain,geographicBounds} from '../src/planet.js';
test('bundled MOLA matches the source digest and closes both poles and longitude seam',()=>{const raw=gunzipSync(readFileSync(new URL('../public/mola-topography.dat',import.meta.url))),provenance=JSON.parse(readFileSync(new URL('../public/mola-provenance.json',import.meta.url)));assert.equal(createHash('sha256').update(raw).digest('hex'),provenance.source_sha256);const v=decodeTopography(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));for(const lat of [-90,0,90])for(const lon of [-180,0,180])assert.ok(Number.isFinite(sampleHeight(v,lon,lat)));assert.equal(sampleHeight(v,-180,90),sampleHeight(v,180,90));assert.ok(Math.min(...v.slice(0,1440))>-10000);});
test('a missing terrain pixel uses real fallback elevation rather than rejecting the whole tile',()=>{const bounds=[0,0,2,2],base={bounds,width:2,grid:new Float32Array([NaN,NaN,NaN,NaN])};assert.ok(blendTerrain(base,null,bounds,3,()=>-4275).every(v=>v===-4275));});
test('all longitudes meet at one terrain height at each pole',()=>{const b=gunzipSync(readFileSync(new URL('../public/mola-topography.dat',import.meta.url))),v=decodeTopography(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));for(const lat of [-90,90])for(const lon of [-170,-90,0,45,170])assert.equal(sampleHeight(v,lon,lat),sampleHeight(v,0,lat));});
test('a failed global elevation transfer does not start a blocking chain of parent requests',async()=>{
 const originalFetch=globalThis.fetch,reads=[],raw=gunzipSync(readFileSync(new URL('../public/mola-topography.dat',import.meta.url)));
 globalThis.fetch=async url=>{reads.push(url);return url==='/mola-topography.dat'?new Response(raw):new Response('',{status:503});};
 try{
  const provider=Object.create(MarsTerrain.prototype);
  provider.C={HeightmapTerrainData:class{constructor(options){Object.assign(this,options);}}};
  provider.disposed=false;provider.dataset=null;
  // Coarse levels now use bundled MOLA directly. Exercise a local level that
  // still requests the service, so this retains its failed-transfer coverage.
  const tile=await provider.buildTile(16,12,4,new AbortController().signal),bounds=geographicBounds(16,12,5);
  assert.deepEqual(reads,['/api/planet?kind=terrain&z=5&y=12&x=16','/mola-topography.dat']);
  assert.ok(tile.buffer.every(Number.isFinite));
  const values=decodeTopography(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
  assert.ok(Math.abs(tile.buffer[64*129+64]-sampleHeight(values,(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2))<.005);
 }finally{globalThis.fetch=originalFetch;}
});

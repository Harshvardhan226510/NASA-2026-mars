import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {MagneticModelData,MAGNETIC_MODEL,decodeMagneticGrid,sampleMagnetic,magneticColor,magneticPixels,magneticFraction} from '../src/magnetic-data.js';
import {layerSelection,allLayerSelection} from '../src/layers.js';
import {magneticImageryProvider} from '../src/magnetic-provider.js';
const root=new URL('../public/magnetic/',import.meta.url),metadata=JSON.parse(readFileSync(new URL('model.json',root))),hash=b=>createHash('sha256').update(b).digest('hex');
const packet=altitude=>{const item=metadata.layers.find(l=>l.altitude_m===altitude),encoded=readFileSync(new URL(item.file,root)),raw=gunzipSync(encoded);return {item,encoded,raw,grid:decodeMagneticGrid(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),altitude)};};

test('published coefficients and derived packets match their digests, physical units and independent point synthesis',()=>{
 assert.equal(hash(readFileSync(new URL('../tools/data/Langlais2019.sh.gz',import.meta.url))),MAGNETIC_MODEL.sourceHash);
 assert.equal(metadata.sources.coefficients_sha256,MAGNETIC_MODEL.sourceHash);assert.equal(metadata.calculation.normalization,'Schmidt semi-normalized');assert.equal(metadata.units,'nT');assert.equal(metadata.degree,134);
 for(const altitude of [0,150000]){const {item,encoded,raw,grid}=packet(altitude);assert.equal(hash(encoded),item.sha256);assert.equal(hash(raw),item.packet_sha256);assert.equal(grid.radius,3393500);assert.equal(grid.altitude,altitude);assert.equal(grid.values.length,720*361);
  for(const p of item.verification_points)assert.ok(Math.abs(sampleMagnetic(grid,p.lon,p.lat)-p.expected_nT)<=Math.max(.001,p.expected_nT*1e-6));
  for(const p of item.pole_verification){assert.ok(Math.abs(sampleMagnetic(grid,10,p.lat)-p.analytic_nT)<.001);assert.ok(Math.abs(p.analytic_nT-p.near_pole_nT)<Math.max(.5,p.analytic_nT*.001));}
 }
 const low=packet(0).grid,high=packet(150000).grid;assert.ok(Math.max(...high.values.subarray(0,720))<Math.max(...low.values.subarray(0,720)));
});
test('magnetic interpolation is periodic at the date line and invariant at each pole',()=>{
 const grid=packet(150000).grid;
 for(const lat of [-90,-53.5,0,61,90]){assert.equal(sampleMagnetic(grid,-180,lat),sampleMagnetic(grid,180,lat));assert.equal(sampleMagnetic(grid,360,lat),sampleMagnetic(grid,0,lat));assert.ok(Math.abs(sampleMagnetic(grid,179.999999,lat)-sampleMagnetic(grid,-180.000001,lat))<1e-6);}
 for(const lat of [-90,90])for(const lon of [-179,-90,0,135,180])assert.equal(sampleMagnetic(grid,lon,lat),sampleMagnetic(grid,0,lat));
 assert.ok(Number.isNaN(sampleMagnetic(grid,0,91)));assert.ok(Number.isNaN(sampleMagnetic(grid,NaN,0)));
 assert.equal(grid.values[180*720+360],sampleMagnetic(grid,0,0));assert.equal(grid.values[180*720],sampleMagnetic(grid,-180,0));
});
test('magnetic colors use one stated logarithmic scale, do not invent values, and orient pixels north to south',()=>{
 assert.equal(magneticFraction(0,2000),0);assert.equal(magneticFraction(2000,2000),1);assert.ok(magneticFraction(100,2000)>magneticFraction(10,2000));
 assert.deepEqual(magneticColor(NaN),[0,0,0,0]);assert.deepEqual(magneticColor(-1),[0,0,0,0]);assert.deepEqual(magneticColor(3000),magneticColor(2000));
 const grid=packet(150000).grid,a=magneticPixels(grid,[-1,-1,1,1],2);assert.deepEqual([...a.subarray(0,4)],magneticColor(sampleMagnetic(grid,-.5,.5)));
 assert.deepEqual(magneticPixels(grid,[-180,0,-179,1],8),magneticPixels(grid,[180,0,181,1],8));
 const {raw}=packet(0),broken=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);new DataView(broken).setFloat32(32,-1,true);assert.throws(()=>decodeMagneticGrid(broken,0),/invalid values/);
 assert.throws(()=>decodeMagneticGrid(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength-1),0),/geometry/);
});
test('the model loader validates the downloaded data, shares reads and permits a failed read to retry',async()=>{
 let reads=0,breakData=true;const {encoded}=packet(150000),fetchImpl=async url=>{reads++;if(url.endsWith('model.json'))return Response.json(metadata);const bytes=Buffer.from(encoded);if(breakData){breakData=false;bytes[bytes.length-10]^=1;}return new Response(bytes);};
 const data=new MagneticModelData({fetchImpl});await assert.rejects(data.load(150000));const before=reads;
 const [a,b]=await Promise.all([data.load(150000),data.load(150000)]);assert.equal(a,b);assert.equal(reads,before+1);
 await assert.rejects(data.load(100000),/altitude/);
 const incorrect=new MagneticModelData({fetchImpl:async()=>Response.json({...metadata,degree:1})});await assert.rejects(incorrect.load(0),/identity/);
});
test('color overlays are exclusive while hide/show controls preserve independent markers and drawings',()=>{
 const state={regions:true,science:true,elevation:true,magnetic:false},magnetic=layerSelection(state,'magnetic',true);assert.equal(magnetic.elevation,false);assert.equal(magnetic.magnetic,true);assert.equal(state.elevation,true);assert.equal(magnetic.science,true);
 const elevation=layerSelection(magnetic,'elevation',true);assert.equal(elevation.elevation,true);assert.equal(elevation.magnetic,false);
 const shown=allLayerSelection(magnetic,true);assert.equal(shown.magnetic,true);assert.equal(shown.elevation,false);assert.equal(shown.routes,true);
 const hidden=allLayerSelection(shown,false);assert.ok(Object.values(hidden).every(v=>v===false));assert.deepEqual(layerSelection(state,'unknown',true),state);
});

test('prepared magnetic images satisfy Cesium’s asynchronous requestImage contract on every read',async()=>{
 const C={GeographicTilingScheme:class{constructor({ellipsoid}){this.ellipsoid=ellipsoid;this.rectangle={};}},Event:class{},Credit:class{}},ellipsoid={},images=[{width:512,height:512,side:'west'},{width:512,height:512,side:'east'}],provider=magneticImageryProvider(C,ellipsoid,images);
 assert.equal(provider.tilingScheme.ellipsoid,ellipsoid);assert.equal(provider.maximumLevel,0);assert.equal(provider.hasAlphaChannel,true);
 // Mirror the consumer's then/catch calls, rather than awaiting a value (which
 // would also accept the broken synchronous canvas return).
 for(const x of [0,1,0,1]){const request=provider.requestImage(x,0,0);assert.equal(typeof request.then,'function');assert.equal(typeof request.catch,'function');let received;await request.then(image=>{received=image;}).catch(error=>assert.fail(error));assert.equal(received,images[x]);}
});

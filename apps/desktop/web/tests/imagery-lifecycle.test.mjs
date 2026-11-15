import test from 'node:test';
import assert from 'node:assert/strict';
import {ContinuousSurface} from '../src/continuous-surface.js';
import {packTile} from '../src/lod.js';
test('native imagery retains its layer handle and removes it when leaving the footprint',()=>{
 const oldWindow=globalThis.window,added=[],removed=[];
 globalThis.window={Cesium:{GeographicTilingScheme:class{},Ellipsoid:{default:{}},Rectangle:{fromDegrees:(...p)=>p},Event:class{},Credit:class{},ImageryLayer:class{constructor(provider){this.provider=provider;}}}};
 try{
  const surface={raster:{dataset:{id:'test',bounds:[77,18,77.1,18.2]}},viewer:{imageryLayers:{add(layer){added.push(layer);},remove(layer){removed.push(layer);}},scene:{requestRender(){}}},retirePrevious(){},setWindow:ContinuousSurface.prototype.setWindow};
  surface.setWindow({});assert.equal(surface.layer,added[0]);assert.ok(surface.layer);
  const provider=surface.imagery;surface.setWindow(null);
  assert.equal(provider.disposed,true);assert.deepEqual(removed,added);assert.equal(surface.layer,null);
 }finally{globalThis.window=oldWindow;}
});
test('a failed uncached fine transfer resolves to the measured overview without a map error',async()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document,oldFetch=globalThis.fetch,errors=[];let failed=0,overviews=0;
 globalThis.window={Cesium:{GeographicTilingScheme:class{},Ellipsoid:{default:{}},Rectangle:{fromDegrees:(...p)=>p},Event:class{},Credit:class{},ImageryLayer:class{constructor(provider){this.provider=provider;}}}};
 globalThis.document={createElement:()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},drawImage(){}})})};
 const heights=Object.assign(new Float32Array(129*129).fill(123),{gridMeters:25}),pixels=Object.assign(new Float32Array(512*512*2).fill(120),{gridMeters:25});
 globalThis.fetch=async url=>{if(String(url).includes('/prepared/index.json'))return Response.json({schema:'mars-prepared-display/1',tiles:{}});if(String(url).includes('tile=overview')){overviews++;return new Response(packTile(heights,pixels));}failed++;return new Response('',{status:503});};
 let surface;
 try{surface={raster:{dataset:{id:'fallback-test',bounds:[0,0,1,1],dem_grid_m:[1,1],imagery:[{transform:[1,0,0,0,-1,0]}],terrain:[{}]}},viewer:{imageryLayers:{add(){},remove(){}},scene:{requestRender(){}}},schedule(){},onError:e=>errors.push(e),retirePrevious(){},setWindow:ContinuousSurface.prototype.setWindow};surface.setWindow({});const image=await surface.imagery.requestImage(16384,8191,14);assert.equal(image.gridMeters,25);assert.ok(failed>0&&failed<=27);assert.equal(overviews,1);assert.deepEqual(errors,[]);}finally{surface?.imagery?.destroy();globalThis.window=oldWindow;globalThis.document=oldDocument;globalThis.fetch=oldFetch;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {geologyTileParts,geologySourceAddress,validateGeologyLegend} from '../src/geology-grid.js';
import {geographicBounds} from '../src/planet-grid.js';
import {geologyImage} from '../src/geology-tiles.js';
import {TileQueue} from '../src/tile-queue.js';
import {createGeologyService,validateGeologyPNG} from '../api/geology.mjs';
import {SCIENCE_CATALOG} from '../src/science-catalog.js';
import {layerSelection,restoreLayerSelection} from '../src/layers.js';

test('source grid matches Atlas geography in both hemispheres without a 90-degree latitude offset',()=>{
 for(let z=1;z<=5;z++)for(const x of [0,2**(z+1)-1])for(const y of [0,2**z-1]){
  const [p]=geologyTileParts(x,y,z),span=360/2**p.z;
  assert.deepEqual([-180+p.x*span,180-(p.y+1)*span,-180+(p.x+1)*span,180-p.y*span],geographicBounds(x,y,z));
 }
 assert.deepEqual(geologyTileParts(-1,0,2),geologyTileParts(7,0,2));assert.throws(()=>geologyTileParts(0,0,6));
});
test('root imagery stitches north and south at the equator and retains exact hemisphere longitudes',()=>{
 const north=geologyTileParts(0,0,0),east=geologyTileParts(1,0,0);assert.deepEqual(north.map(p=>[p.z,p.y,p.x]),[[1,0,0],[1,1,0]]);assert.deepEqual(east.map(p=>p.x),[1,1]);assert.deepEqual(north[0].source,[0,128,256,128]);assert.deepEqual(north[1].destination,[0,128,256,128]);
});
test('source addresses accept only the fixed published cache and bounded integer parameters',()=>{
 assert.match(geologySourceAddress({x:'2',y:'1',z:'2'}).url,/\/tile\/2\/1\/2$/);
 for(const q of [{x:'0',y:'0',z:'0'},{x:'0',y:'0',z:'7'},{x:'4',y:'1',z:'2'},{x:'0',y:'-1',z:'2'},{x:'0',y:'0',z:'2',url:'https://example.com'}])assert.throws(()=>geologySourceAddress(q));
});
test('legend contains all 44 attributed units with distinct codes and categorical colors',()=>{
 const legend=JSON.parse(readFileSync(new URL('../public/geology/legend.json',import.meta.url)));validateGeologyLegend(legend);assert.equal(legend.units.find(x=>x.code==='lApc').name,'Late Amazonian polar cap unit');assert.equal(legend.units.find(x=>x.code==='lApc').color,'#f5f5f5');assert.throws(()=>validateGeologyLegend({...legend,units:legend.units.slice(1)}));
});
test('geologic map participates in the existing one-color-overlay selection and restoration',()=>{
 const item=SCIENCE_CATALOG.find(x=>x.key==='geological-units');assert.equal(item.engine,'geology');assert.equal(item.recommended,true);const selected=layerSelection(restoreLayerSelection({slope:true,'slope-steepness':true}),'geological-units',true);assert.equal(selected['geological-units'],true);assert.equal(selected['slope-steepness'],false);assert.equal(restoreLayerSelection(selected)['geological-units'],true);
});
test('latitude/longitude grid is unique and directly beneath the appearance choices',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),appearance=html.slice(html.indexOf('<fieldset class="appearance-switch">'),html.indexOf('<fieldset class="terrain-relief-control">'));assert.ok(appearance.indexOf('map-grid-control')>appearance.indexOf('appearance-choices'));assert.ok(appearance.indexOf('map-grid-control')<appearance.indexOf('<p id="color-availability"'));assert.equal((html.match(/data-map-layer="graticule"/g)??[]).length,1);assert.ok(!appearance.includes('class="layer-list"'));
});
test('tile composer draws the correct source subrectangles with no extra source fetch on reuse',async()=>{
 const reads=[],draws=[];const opts={sourceCache:new TileQueue(4,8),imageCache:new TileQueue(3,8),fetcher:async url=>{reads.push(url);return new Response('fixture');},decode:async()=>({width:256,height:256,close(){}}),canvas:()=>({width:0,height:0,getContext:()=>({drawImage:(...args)=>draws.push(args)})})};
 await geologyImage(0,0,0,undefined,opts);assert.equal(reads.length,2);assert.deepEqual(draws.slice(-2).map(a=>a.slice(1)),[[0,128,256,128,0,0,256,128],[0,0,256,128,0,128,256,128]]);await geologyImage(0,0,0,undefined,opts);assert.equal(reads.length,2);
});
test('proxy coalesces valid imagery, rejects incomplete PNGs and retries failed transfers',async()=>{
 const png=Buffer.alloc(45);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(256,16);png.writeUInt32BE(256,20);png.write('IEND',37);validateGeologyPNG(png);assert.throws(()=>validateGeologyPNG(png.subarray(0,30)));
 let calls=0;const serve=createGeologyService({store:null,read:async()=>{calls++;return png;}}),address=geologySourceAddress({x:'0',y:'0',z:'1'});await Promise.all([serve(address),serve(address)]);assert.equal(calls,1);
 let attempts=0;const retry=createGeologyService({store:null,read:async()=>{if(++attempts===1)throw Error('offline');return png;}});await assert.rejects(retry(address));assert.equal(await retry(address),png);assert.equal(attempts,2);
});

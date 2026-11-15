import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {TerrainRelief,RELIEF_STORAGE_KEY} from '../src/terrain-relief.js';
import {MarsTerrain} from '../src/planet.js';
import {ContinuousSurface} from '../src/continuous-surface.js';
import {Surface3D} from '../src/surface.js';

function control(){return {checked:false,addEventListener(type,listener){this[type]=listener;}};}
test('global relief survives observation changes and shares controls without touching physical terrain or camera',t=>{
 const previousWindow=globalThis.window;globalThis.window={Cesium:{}};t.after(()=>{globalThis.window=previousWindow;});
 const physical={height:21200},camera={height:8000000},viewer={camera,terrainProvider:physical,scene:{requestRender(){}}},controls=[control(),control()],saved=new Map();let surface;
 const relief=new TerrainRelief(viewer,{surface:()=>surface,controls,storage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)}});
 assert.equal(viewer.scene.verticalExaggeration,3);assert.ok(controls.every(c=>c.checked));
 const observation=Object.create(ContinuousSurface.prototype);Object.assign(observation,{viewer,schedule(){},terrain:{displayHeightAt:()=>21200},raster:{dataset:{display_height_offset_m:19000}}});surface=observation;relief.apply();
 assert.equal(viewer.scene.verticalExaggerationRelativeHeight,0,'selection cannot shift the globe datum');assert.equal(observation.sampleHeight(0,0),63600);
 controls[1].checked=false;controls[1].change();assert.ok(controls.every(c=>!c.checked));assert.equal(observation.sampleHeight(0,0),21200);assert.equal(saved.get(RELIEF_STORAGE_KEY),'false');
 surface=null;relief.apply();assert.equal(viewer.scene.verticalExaggeration,1);relief.set(true);assert.equal(viewer.scene.verticalExaggeration,3);
 assert.deepEqual(viewer.terrainProvider,{height:21200});assert.deepEqual(camera,{height:8000000});
});
test('true-scale preference restores and denied storage cannot prevent terrain rendering',()=>{
 const cases=[{storage:{getItem:()=> 'false',setItem(){}},expected:1},{storage:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}},expected:3}];
 for(const {storage,expected} of cases){const viewer={scene:{requestRender(){}}},relief=new TerrainRelief(viewer,{storage});assert.equal(relief.scale,expected);relief.set(false);assert.equal(viewer.scene.verticalExaggeration,1);}
});
test('real MOLA root terrain carries Olympus relief, shared borders and finite poles without a network dependency',{timeout:2500},async()=>{
 const originalFetch=globalThis.fetch,raw=gunzipSync(readFileSync(new URL('../public/mola-topography.dat',import.meta.url)));
 globalThis.fetch=async url=>{assert.equal(url,'/mola-topography.dat');return new Response(raw);};
 try{
  const provider=Object.create(MarsTerrain.prototype);Object.assign(provider,{C:{HeightmapTerrainData:class{constructor(options){Object.assign(this,options);}}},dataset:null,disposed:false});
  const tiles=await Promise.all([[0,0],[1,0],[2,0],[3,0],[0,1],[1,1],[2,1],[3,1]].map(([x,y])=>provider.buildTile(x,y,0,new AbortController().signal)));
  assert.ok(tiles.every(t=>t.buffer.length===129*129&&t.buffer.every(Number.isFinite)));
  const heights=tiles[0].buffer;assert.ok(Math.max(...heights)>20000,'Olympus rises above the reference sphere in physical geometry');assert.ok(Math.min(...heights)<0,'do not flatten negative elevations');
  for(let y=0;y<2;y++)for(let x=0;x<4;x++)for(let row=0;row<129;row++)assert.equal(tiles[y*4+x].buffer[row*129+128],tiles[y*4+(x+1)%4].buffer[row*129]);
  for(let x=0;x<4;x++){assert.equal(new Set(tiles[x].buffer.slice(0,129)).size,1);assert.equal(new Set(tiles[x+4].buffer.slice(-129)).size,1);assert.deepEqual(tiles[x].buffer.slice(-129),tiles[x+4].buffer.slice(0,129));}
 }finally{globalThis.fetch=originalFetch;}
});

test('legacy observation meshes retain the same global datum and return physical negative elevations',()=>{
 const surface=Object.create(Surface3D.prototype),heights=new Float32Array(129*129).fill(-4200);
 Object.assign(surface,{raster:{dataset:{display_height_offset_m:-4000}},exaggeration:3,nodes:new Map([['tile',{bounds:[0,0,1,1],spacing:10,heights}]])});
 assert.equal(surface.sampleHeight(.5,.5),-12600);assert.equal(surface.sourceElevation(.5,.5),-4200);surface.exaggeration=1;assert.equal(surface.sampleHeight(.5,.5),-4200);assert.equal(surface.sourceElevation(.5,.5),-4200);
});

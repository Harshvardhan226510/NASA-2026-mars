import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {tileAddress} from '../api/planet.mjs';
import {preparedTexturePath} from '../src/display-tiles.js';
import {tintOpticalTile} from '../src/viking-tint.js';
import {routeFix} from '../src/eva-navigation.js';
import {EVA_SCENARIOS,scenarioTargets} from '../src/eva-scenarios.js';
import {missionWindow} from '../src/route-geometry.js';
import {evaElevationWindow,sampleEvaHeight} from '../src/eva-elevation.js';
import {binaryTerrainSTL} from '../src/eva-print.js';
import {crewBudget,walkState} from '../src/mission-planning.js';

test('regional proxy accepts only an allowlisted source footprint and level',()=>{
 const tile=tileAddress({kind:'jezero-hirise',z:17,y:52108,x:187454});
 assert.equal(new URL(tile.url).hostname,'trek.nasa.gov');assert.match(tile.url,/25cm.*\/17\/52108\/187454\.png$/);
 assert.throws(()=>tileAddress({kind:'jezero-hirise',z:17,y:0,x:0}));
 assert.throws(()=>tileAddress({kind:'jezero-hirise',z:18,y:104216,x:374908}));
 assert.throws(()=>tileAddress({kind:'constructor',z:0,y:0,x:0}));
});

test('prepared WebP is content addressed and keeps the same imagery resolution',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../public/prepared/index.json',import.meta.url),'utf8'));
 for(const [key,entry] of Object.entries(manifest.tiles)){
  const info=preparedTexturePath(manifest,key,false);assert.equal(info.metres,entry.imagery_m);
  const bytes=await readFile(new URL('../public'+info.path,import.meta.url));
  assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(bytes.length<entry.bytes);
  if(entry.masked_webp)assert.equal(preparedTexturePath(manifest,key,true).path,entry.masked_webp);
 }
});

test('Viking tint retains no-data alpha and grayscale texture ordering',()=>{
 const pixels=new Uint8ClampedArray([90,90,90,255,160,160,160,255,0,0,0,0]);
 tintOpticalTile(pixels,3,1,[180,130,90,255],1);
 assert.equal(pixels[7],255);assert.equal(pixels[11],0);
 assert.ok(pixels[4]>pixels[0]&&pixels[0]>pixels[2]);
});

test('guided plans have bundled regional terrain at every planning window and remain separate from camp',async()=>{
 for(const scenario of EVA_SCENARIOS){
  const points=[scenario.start,scenario.goal,...scenarioTargets(scenario).map(s=>s.point)];
  const entry=evaElevationWindow(missionWindow(points,50).bounds);assert.ok(entry,scenario.id);
  const bytes=await readFile(new URL(`../public/eva-elevation/${entry.id}.bin`,import.meta.url));
  assert.equal(bytes.length,entry.width*entry.height*2);
  const elevations=Int16Array.from({length:bytes.length/2},(_,i)=>bytes.readInt16LE(i*2));
  assert.ok(points.every(p=>Number.isFinite(sampleEvaHeight(elevations,entry,...p))));
  const state=walkState({guided:scenario.id,home:[20,20],campSiteId:'user-camp',evaReturn:scenario.start,tab:'field'});
  assert.deepEqual(state.home,[20,20]);assert.deepEqual(state.evaReturn,scenario.start);assert.equal(state.campSiteId,'user-camp');assert.equal(state.tab,'field');
 }
});

test('a field fix handles a dateline crossing and uncertainty',()=>{
 const path=[{lon:179.99,lat:5,distance_m:0},{lon:-179.99,lat:5,distance_m:1200}];
 const hit=routeFix(path,[180,5.0001],20);assert.ok(Math.abs(hit.distance-600)<.1);assert.equal(hit.offRoute,false);
 assert.equal(routeFix(path,[180,5.01],20).offRoute,true);
 assert.throws(()=>routeFix(path,[0,0],NaN));
});

test('crew resources have explicit unknowns and STL is a closed simple terrain solid',()=>{
 const state=walkState({crew:[{battery_remaining:40,battery_rate:50}]});
 const [crew]=crewBudget(state.crew,{complete:true,checks:{time:{estimate:60}},totals:{outward:{minutes:20},return:{minutes:20},work:{minutes:20},breaks:{minutes:0}}},{roundTrip:true});
 assert.equal(crew.complete,false);assert.equal(crew.limiting.label,'Battery · Wh');assert.equal(crew.limiting.remaining,-10);assert.equal(crew.limiting.turnback,14);
 const file=binaryTerrainSTL([0,0,0,1],{rows:2,cols:2});assert.equal(new DataView(file).getUint32(80,true),12);assert.equal(file.byteLength,684);
});

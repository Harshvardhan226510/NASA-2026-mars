import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createMissionApi} from '../services/mission-api.mjs';
import {sourceMapPlan, sourceMeters} from '../web/src/source-map-plan.js';

test('map API preserves provenance and checks route segments, observations and weather coverage', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'atlas-mission-api-'));
  const webRoot = path.resolve('web');
  const api = createMissionApi({directory, webRoot});
  const invoke = (name, body, query = '') => api.routes.get(name)(new URLSearchParams(query), body);
  const heights = await invoke('POST /v1/terrain/query', {points: [[77.43, 18.44], [0, 90]]});
  assert.ok(Number.isFinite(heights.samples[0].elevationMeters));
  assert.ok(heights.samples[0].source.gridMeters > 14000);
  assert.equal(heights.samples[1].slopeDegrees, null);
  const result = await invoke('POST /v1/routes/evaluate', {start: [179.7, 0], destination: [-179.7, 0], exclusions: [
    {id: 'east-edge', polygon: [[179.8, -.1], [179.9, -.1], [179.9, .1], [179.8, .1]]},
    {id: 'far-side', polygon: [[-1, -.1], [1, -.1], [1, .1], [-1, .1]]},
  ]});
  assert.deepEqual(result.intersectingExclusions, ['east-edge']);
  assert.ok(result.distanceMeters > 35000 && result.distanceMeters < 36000);
  const reading = {id: 'temp-1', kind: 'measurement', label: 'Temperature', frame: 'mars-east-planetocentric',
    point: [77.43, 18.44], at: '2026-11-05T12:00:00Z', source: 'test sensor', parameter: 'Tair', value: 219, units: 'K', dataKind: 'measured'};
  await invoke('POST /v1/observations', reading);
  await invoke('POST /v1/observations', reading);
  await assert.rejects(async () => invoke('POST /v1/observations', {...reading, value: 220}), error => error.status === 409);
  const restored = createMissionApi({directory, webRoot});
  const saved = await restored.list(new URLSearchParams({bounds: '77,18,78,19'}));
  assert.equal(saved.features.length, 1);
  assert.equal(saved.features[0].properties.value, 219);
  const base = 'lon=77.43&lat=18.44&parameter=Tair';
  const measured = await invoke('GET /v1/environment', undefined, base + '&kind=measured&at=2026-11-05T12:01:00Z');
  assert.equal(measured.observations[0].ageSeconds, 60);
  const old = await invoke('GET /v1/environment', undefined, base + '&kind=measured&at=2026-11-05T12:01:00Z&maxAgeSeconds=1');
  assert.equal(old.coverage, 'unavailable');
  const unavailable = await invoke('GET /v1/environment', undefined, base + '&at=2026-11-05T12:01:00Z');
  assert.equal(unavailable.coverage, 'unavailable');
  const archived = await invoke('GET /v1/environment', undefined, base + '&at=' + encodeURIComponent(unavailable.availableModelTime));
  assert.ok(Number.isFinite(archived.value));
  assert.equal(archived.kind, 'modeled_climatology');
});

test('source tiles include only intersecting selection tiles and their ancestors', () => {
  const crossing = sourceMapPlan({bounds: [179.99, -.01, -179.99, .01]}, 7, 'color');
  const final = crossing.tiles.filter(tile => tile.z === 7);
  assert.deepEqual([...new Set(final.map(tile => tile.x))], [0, 255]);
  assert.ok(crossing.tiles.some(tile => tile.z === 0));
  const polygon = [[10, 10], [13, 10], [10, 13]];
  assert.ok(sourceMapPlan({polygon}, 7, 'grayscale').tiles.length < sourceMapPlan({bounds: [10, 10, 13, 13]}, 7, 'grayscale').tiles.length);
  assert.equal(sourceMapPlan({bounds: [-180, -90, 180, 90]}, 5, 'color').tiles.length, 2730);
  assert.equal(sourceMapPlan({bounds: [-180, -90, 180, 90]}, 6, 'color').tiles.length,10922);
});


test('source products use their own tile sizes, footprints, and elevation roots', () => {
  const region={bounds:[77.4299,18.4399,77.4301,18.4401]};
  const ctx=sourceMapPlan(region,12,'color','ctx');
  const hirise=sourceMapPlan(region,17,'color','hirise-jezero');
  assert.equal(ctx.appearance,'grayscale');
  assert.ok(ctx.metresPerPixel>5&&ctx.metresPerPixel<6);
  assert.ok(hirise.metresPerPixel>.31&&hirise.metresPerPixel<.33);
  assert.throws(()=>sourceMapPlan({bounds:[20,10,21,11]},17,'grayscale','hirise-jezero'), /coverage/);
  const elevation=sourceMapPlan(region,7,'color','hrsc-elevation');
  assert.equal(elevation.metresPerPixel,200);
  assert.equal(elevation.tiles[0].z,1);
  assert.equal(sourceMeters(8,'hrsc-relief'),200);
  const partial=sourceMapPlan({bounds:[77.19,18.45,77.24,18.5]},11,'grayscale','hirise-jezero');
  assert.equal(partial.partial,true);
  assert.ok(partial.boxes.every(box=>box[0]>=77.2229331));
});test('location downloads offer real resolutions finer than the chosen global base', async () => {
  const {worldDownloadOptions,locationDownloadOptions}=await import('../web/src/desktop-location-downloads.js');
  const global=worldDownloadOptions('color');
  assert.ok(global.some(option=>option.sourceId==='viking'));
  assert.ok(global.some(option=>option.sourceId==='ctx'));
  assert.ok(global.every(option=>option.tileCount>0));
  assert.ok(global.some(option=>option.tileCount>4000));
  const groups=locationDownloadOptions(651.21,'color');
  assert.ok(groups.length>0);
  assert.ok(groups.every(group=>group.resolution<651.21*.999&&group.places.length>0));
  assert.equal(new Set(groups.flatMap(group=>group.places.map(place=>place.placeId))).size,11);
  for(const group of groups)for(const place of group.places){
    const plan=sourceMapPlan(place.selection,place.level,place.appearance,place.sourceId);
    assert.equal(plan.maximumBytes,place.maximumBytes);
    if(place.sourceId.startsWith('hirise-'))assert.equal(place.appearance,'grayscale');
  }
});test('repeating a verified source download reactivates its files without another transfer', async t => {
  const {SourceMaps}=await import('../services/source-maps.mjs');
  const {PackageRegistry}=await import('../services/packages.mjs');
  const {rm,writeFile}=await import('node:fs/promises');
  const directory=await mkdtemp(path.join(os.tmpdir(),'atlas-source-repeat-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const registry=await new PackageRegistry(directory).load();
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
  let requests=0;
  const maps=new SourceMaps({registry,policy:{mode:'online'},directory:()=>path.join(directory,'maps'),
    fetcher:async()=>{requests++;return requests===1?new Response(null,{status:503}):new Response(image,{headers:{'Content-Type':'image/jpeg'}});},
    prepareTile:source=>source.bytes,notify:()=>{}});
  const input={selection:{bounds:[77.42,18.43,77.43,18.44]},sourceId:'viking',level:0,appearance:'color'};
  const first=await maps.start(input);
  assert.equal(requests,2,'a transient upstream error is retried');
  await registry.setActive(first.id,false);
  const before=requests;
  const again=await maps.start(input);
  assert.equal(again.id,first.id);
  assert.equal(again.state,'installed');
  assert.equal(requests,before);
  assert.equal(registry.entries[0].active,true);
  const entry=registry.entries[0];
  await writeFile(path.join(entry.root,entry.manifest.files[0].path),'changed');
  await assert.rejects(()=>maps.start(input),/missing or changed/);
  assert.equal(requests,before);
});
test('large selections retain high resolutions when they fit the drive budget',async()=>{
  const {sourceMapEstimate,sourceStorageRequired,sourceMapTiles,MAP_SOURCES}=await import('../web/src/source-map-plan.js');
  const budget=228*1024**3;
  const jezero=sourceMapEstimate({bounds:MAP_SOURCES['hirise-jezero'].coverage},17,'grayscale','hirise-jezero');
  assert.ok(jezero.tileCount>4000);
  assert.ok(sourceStorageRequired(jezero)<budget);
  assert.ok(jezero.metresPerPixel<.33);
  const world=sourceMapEstimate({bounds:[-180,-90,180,90]},12,'grayscale','ctx');
  assert.ok(world.tileCount>1000000);
  assert.ok(sourceStorageRequired(world)>budget);
  const shapes=[{bounds:[-10,-10,-20,10]},{bounds:[77.2,18.3,77.6,18.7]},
    {circle:{center:[77,18],radiusMeters:200000}},
    {polygon:[[10,10],[15,10],[15,15],[12,13],[10,15]]}];
  for(const selection of shapes){
    const estimate=sourceMapEstimate(selection,7,'grayscale','viking');
    assert.equal(estimate.tileCount,[...sourceMapTiles(estimate)].length);
  }
});

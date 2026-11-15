import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hasSurfacePosition,normalizeSpacecraftPosition,trackLines,positionSummary} from '../src/spacecraft-data.js';
import {createSpacecraftService,readPosition} from '../api/spacecraft.mjs';
import {requestModelReady} from '../src/spacecraft-model.js';
const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const catalog=json('../public/spacecraft/catalog.json'),seed=json('../data/spacecraft/bootstrap.json');
const now=Date.parse('2026-10-19T12:00:00Z');
test('catalogue preserves separate hardware, unlocated missions, and only sourced surface pins',()=>{
 assert.equal(catalog.objects.length,41);assert.equal(catalog.objects.filter(hasSurfacePosition).length,15);
 assert.equal(new Set(catalog.objects.map(x=>x.id)).size,41);
 for(const x of catalog.objects.filter(hasSurfacePosition)){assert.match(x.location.source,/^https:\/\//);assert.ok(x.location.lon_east>=-180&&x.location.lon_east<=180);}
 for(const id of ['sojourner','zhurong','mars3','ds2_scott','mro'])assert.equal(hasSurfacePosition(catalog.objects.find(x=>x.id===id)),false);
 const mer=catalog.objects.find(x=>x.id==='opportunity'),platform=catalog.objects.find(x=>x.id==='opportunity_platform');assert.notEqual(mer.location.lat_planetocentric,platform.location.lat_planetocentric);
 assert.match(positionSummary(catalog.objects.find(x=>x.id==='ingenuity')),/2024/);
 assert.equal(hasSurfacePosition({domain:'mars_surface',location:{lon_east:null,lat_planetocentric:null}}),false);
});
test('NASA localizations retain Sol, record identity, geoid and timestamps without inventing an observation date',()=>{
 const source=json('../data/spacecraft/perseverance-current.geojson');
 const p=normalizeSpacecraftPosition('perseverance',source,{retrievedAt:new Date(now).toISOString(),lastModified:'Sun, 18 Oct 2026 10:00:00 GMT'});
 assert.equal(p.sol,2009);assert.equal(p.record_id,'92_0');assert.equal(p.earth_date,null);assert.equal(p.lon_east,77.23287536);assert.notEqual(p.retrieved_at,p.file_last_modified);assert.match(p.elevation_datum,/geoid/);
 for(const coordinates of [[null,18],[77,NaN],[0,90],[77,91]])assert.throws(()=>normalizeSpacecraftPosition('perseverance',{...source,features:[{...source.features[0],geometry:{type:'Point',coordinates}}]},{retrievedAt:new Date(now).toISOString()}));
 assert.throws(()=>normalizeSpacecraftPosition('mro',source));
 assert.throws(()=>normalizeSpacecraftPosition('perseverance',{...source,features:[...source.features,...source.features]},{retrievedAt:new Date(now).toISOString()}));
});
test('recorded tracks retain gaps and antimeridian cuts, remove stationary repeats and bound geometry work',()=>{
 const data={features:[{geometry:{type:'MultiLineString',coordinates:[[[0,0],[0,0],[1,1]],[[1,1],[2,2]],[[4,4],[5,5]],[[179,0],[-179,0],[-178,0]]]}}]};
 assert.deepEqual(trackLines(data),[[[0,0],[1,1],[2,2]],[[4,4],[5,5]],[[-179,0],[-178,0]]]);
 for(const id of ['curiosity','perseverance','ingenuity','spirit','opportunity']){
  const p=json('../public/spacecraft/tracks/'+id+'.json'),lines=trackLines(p.data);assert.ok(lines.length>0&&lines.length<300);assert.ok(lines.every(l=>l.length<=2048));
 }
});
test('all bundled model derivatives retain pinned provenance and valid embedded GLB buffers',()=>{
 for(const m of catalog.models){
  const b=readFileSync(new URL('../public'+m.url,import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),m.derived_sha256);assert.equal(b.readUInt32LE(8),b.length);
  const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());assert.equal(j.asset.version,'2.0');const wrapper=j.nodes[j.scenes[j.scene??0].nodes[0]];assert.match(wrapper.name,/normalization/);assert.ok(m.bounds_size.every(n=>Number.isFinite(n)&&n>0));
  for(const asset of [...j.buffers,...(j.images??[])])assert.ok(!asset.uri||asset.uri.startsWith('data:'));
 }
});
test('position refresh is deduplicated, cached and preserves per-mission last good positions on partial failure',async()=>{
 let calls=0,entry,time=now,fail=false;
 const store={get:async()=>entry,set:async(k,v)=>{entry=v;}};
 const serve=createSpacecraftService({store,seed,clock:()=>time,read:async id=>{calls++;await Promise.resolve();if(fail&&id==='curiosity')throw Error('outage');return {...seed.positions[id],retrieved_at:new Date(time).toISOString()};}});
 const [a,b]=await Promise.all([serve(),serve()]);assert.equal(a,b);assert.equal(calls,3);await serve();assert.equal(calls,3);
 time+=21600001;fail=true;const p=await serve();assert.equal(calls,6);assert.equal(p.positions.curiosity.update_state,'cached_fallback');assert.equal(p.positions.curiosity.retrieved_at,a.positions.curiosity.retrieved_at);assert.equal(p.positions.perseverance.update_state,'verified');assert.equal(p.health.state,'cached_fallback');
});
test('an earlier source record never rolls a rover backwards; first outage serves the dated bootstrap',async()=>{
 const serve=createSpacecraftService({store:{get:async()=>null,set:async()=>{}},seed,clock:()=>now,read:async id=>({...seed.positions[id],sol:0})});
 const p=await serve();assert.equal(p.positions.curiosity.sol,5045);assert.equal(p.positions.perseverance.sol,2009);assert.equal(p.positions.ingenuity.flight,72);assert.equal(p.health.state,'cached_fallback');
});
test('source reader checks bounded JSON rather than accepting a provider error page',async()=>{
 const source=readFileSync(new URL('../data/spacecraft/curiosity-current.geojson',import.meta.url));
 const p=await readPosition('curiosity',{now,fetcher:async()=>new Response(source,{headers:{'last-modified':'Sun, 18 Oct 2026 10:00:00 GMT'}})});assert.equal(p.sol,5045);assert.match(p.raw_sha256,/^[a-f0-9]{64}$/);
 await assert.rejects(readPosition('curiosity',{fetcher:async()=>new Response('x'.repeat(65537))}));
 await assert.rejects(readPosition('curiosity',{fetcher:async()=>new Response('<html>Unavailable</html>')}));
});
test('an idle on-demand scene keeps rendering a loading model and stops after ready',()=>{
 const event=()=>{const listeners=new Set();return {addEventListener(fn){listeners.add(fn);return()=>listeners.delete(fn);},raise(){for(const fn of [...listeners])fn();}};};
 const model={ready:false,readyEvent:event(),errorEvent:event()};let tick,renders=0,cleared=0,done=0;
 requestModelReady(model,{requestRender:()=>renders++},{current:()=>true,ready:()=>done++,failed:()=>assert.fail('Unexpected failure'),interval:fn=>{tick=fn;return 3;},clear:id=>{assert.equal(id,3);cleared++;}});
 tick();assert.equal(renders,2);model.ready=true;model.readyEvent.raise();assert.equal(done,1);assert.equal(cleared,1);model.readyEvent.raise();assert.equal(done,1);
});
test('cancelled or timed-out model loads cannot leave a permanent render timer',()=>{
 const event=()=>({addEventListener:()=>()=>{}});
 for(const cancelled of [true,false]){let time=0,tick,cleared=0,failed=0,current=true;
  const model={ready:false,readyEvent:event(),errorEvent:event()};requestModelReady(model,{requestRender(){}},{current:()=>current,ready:()=>assert.fail('Unexpected ready'),failed:()=>failed++,clock:()=>time,timeout:100,interval:fn=>{tick=fn;return 1;},clear:()=>cleared++});
  if(cancelled)current=false;else time=101;tick();assert.equal(cleared,1);assert.equal(failed,cancelled?0:1);
 }
});

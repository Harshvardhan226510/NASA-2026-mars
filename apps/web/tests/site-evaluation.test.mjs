import test from 'node:test';
import assert from 'node:assert/strict';
import {SITE_WEIGHTS,validateSiteOptions,siteFootprint,insideFootprint,largestConnected,weightedSiteScore,analyseSiteTerrain,analyseSiteSun,evaluateSite,compareSitePairs} from '../src/site-evaluation.js';
import {collectSiteEvaluation,siteResources} from '../src/site-evaluation-data.js';
import {routeProjection} from '../src/route-geometry.js';
import {siteComparisonReport} from '../src/site-evaluation-report.js';
const options=()=>({mode:'landing',lon:0,lat:0,length:5000,width:3000,heading:0,slope:10,roughness:20,maxElevation:0,requiredArea:1,sols:1,radius:100,at:'2026-11-03T00:00:00Z',weights:{...SITE_WEIGHTS.landing}});
const grid=()=>({center:[0,0],rows:41,cols:41,resolution_meters:200,elevation_matrix:Array.from({length:41},()=>Array(41).fill(-1000)),source:{sample_m:200,label:'Fixture physical DEM',warning:'Fixture'}});
test('footprints rotate about north and remain local across the dateline',()=>{
 const o={...options(),lon:179.99,heading:90},p=routeProjection([o.lon,o.lat]);for(const q of siteFootprint(o)){const [x,y]=p.forward(q);assert.ok(Math.abs(x)<=2500.001);assert.ok(Math.abs(y)<=1500.001);}
 assert.equal(insideFootprint(2000,0,o),true);assert.equal(insideFootprint(0,2000,o),false);
});
test('connected area excludes diagonal-only contacts and missing cells',()=>{assert.equal(largestConnected([1,0,0,1],2,2),1);assert.equal(largestConnected([1,1,0,1],2,2),3);});
test('missing evidence lowers coverage and expands bounds, never becomes a measured zero',()=>{
 const score=weightedSiteScore({slope:80,roughness:null,area:null,sun:null,ice:null,resources:null},SITE_WEIGHTS.landing);assert.equal(score.score,80);assert.equal(score.coverage,.35);assert.equal(score.lower,28);assert.equal(score.upper,93);
 const none=weightedSiteScore({},SITE_WEIGHTS.landing);assert.equal(none.score,null);assert.equal(none.upper,100);
});
test('terrain stencil respects source sampling even on a finer analysis grid',()=>{
 const g=grid();g.resolution_meters=50;const result=analyseSiteTerrain(g,options(),()=>-1000);assert.equal(result.sample_m,200);assert.equal(result.area_sampling_m,200);assert.equal(result.slope_max,0);assert.ok(result.known<200);assert.equal(result.coverage,1);
});
test('flat physical terrain passes resolved limits while a steep plane fails',()=>{
 const o=options(),t=analyseSiteTerrain(grid(),o,()=>-1000),sun=analyseSiteSun(o,()=>-1000,200);assert.ok(t.connected_km2>1);assert.equal(t.slope_p95,0);assert.ok(sun.lit_hours_per_sol>0&&sun.lit_hours_per_sol<24.66);
 const result=evaluateSite(o,t,sun,{ice:0});assert.equal(result.constraint_status,'within resolved terrain limits');assert.equal(result.criteria.ice,50);assert.equal(result.criteria.resources,null);
 const project=routeProjection([0,0]),steep=analyseSiteTerrain(grid(),o,(lon,lat)=>project.forward([lon,lat])[0]);const fail=evaluateSite(o,steep,sun);assert.equal(fail.constraint_status,'outside scenario');assert.ok(fail.violations.some(v=>v.includes('slope')));
});
test('missing footprint terrain cannot pass screening or receive slope/roughness scores',()=>{
 const o=options(),t=analyseSiteTerrain(grid(),o,()=>NaN),s=analyseSiteSun(o,()=>NaN,200),r=evaluateSite(o,t,s);assert.equal(r.constraint_status,'unknown');assert.equal(r.criteria.slope,null);assert.equal(r.criteria.roughness,null);assert.equal(r.criteria.area,null);assert.equal(r.criteria.sun,null);
 const partial={...analyseSiteTerrain(grid(),o,()=>-1000),coverage:.9};assert.equal(evaluateSite(o,partial,s).constraint_status,'unknown');
});
test('small footprints do not gain confidence from interpolated samples',()=>{const o={...options(),length:200,width:200};const t=analyseSiteTerrain(grid(),o,()=>-1000);assert.equal(t.adequate,false);assert.equal(evaluateSite(o,t,{}).constraint_status,'unknown');});
test('vehicle elevation is a landing constraint only and resource value cannot erase violations',()=>{
 const o=options(),t=analyseSiteTerrain(grid(),o,()=>1000),s=analyseSiteSun(o,()=>1000,200);assert.equal(evaluateSite(o,t,s,{ice:1,resources:{nearest_km:0}}).constraint_status,'outside scenario');
 assert.equal(evaluateSite({...o,mode:'base'},analyseSiteTerrain(grid(),{...o,mode:'base'},()=>1000),s).constraint_status,'within resolved terrain limits');
});
test('input validation rejects invalid coordinates, weights and unsupported date ranges',()=>{for(const bad of [{lat:90},{weights:{}},{length:0},{at:'not-a-date'},{at:'2030-12-30T00:00:00Z',sols:668}])assert.throws(()=>validateSiteOptions({...options(),...bad}));assert.doesNotThrow(()=>validateSiteOptions(options()));});
test('resource proximity uses sourced resources only and deduplicates coincident records',()=>{
 const source=[{title:'Evidence',url:'https://nasa.gov'}],s={id:'1',name:'Ice',category:'resources',center:[.1,0],sources:source};const found=siteResources([s,{...s,id:'2'},{...s,id:'3',category:'science'},{...s,id:'4',center:[0,0],sources:[]}],[0,0],100);assert.equal(found.length,1);assert.ok(found[0].distance_km>5);assert.equal(siteResources(null,[0,0],100),null);
});
test('complete collection preserves source provenance, missing references and independent terrain metrics',async()=>{
 const r=await collectSiteEvaluation(options(),{terrainLoader:async()=>grid(),references:async()=>[{key:'ice-0_1',value:0,sources:[]}],sites:[]});assert.equal(r.constraint_status,'within resolved terrain limits');assert.equal(r.source.sample_m,200);assert.equal(r.ice,0);assert.equal(r.criteria.ice,50);assert.equal(r.resources,null);assert.ok(r.sun.equivalent_hours_per_sol>0);
 const unavailable=await collectSiteEvaluation(options(),{terrainLoader:async()=>grid(),references:async()=>{throw Error('Offline');}});assert.equal(unavailable.criteria.ice,null);assert.match(unavailable.source.reference[0].note,/Offline/);
});
test('cancelled collection never returns a result',async()=>{const c=new AbortController();await assert.rejects(()=>collectSiteEvaluation(options(),{signal:c.signal,terrainLoader:async()=>{c.abort();return grid();},references:async()=>[]}),{name:'AbortError'});});
test('readable export records settings, missing evidence, source resolution and score bounds',async()=>{
 const result=await collectSiteEvaluation(options(),{terrainLoader:async()=>grid(),references:async()=>[]});result.name='Candidate A';const report=siteComparisonReport([result]);assert.match(report,/Candidate A/);assert.match(report,/Full-weight bounds/);assert.match(report,/200.00 m/);assert.match(report,/Unknown/);assert.match(report,/not probability/);assert.match(report,/2026-11-03T00:00:00Z/);assert.match(report,/Topography:/);assert.doesNotMatch(report,/```json/);
});
test('a steep outer buffer changes landing suitability while leaving the flat footprint intact',()=>{
 const o=options(),project=routeProjection([o.lon,o.lat]);
 const terrain=analyseSiteTerrain(grid(),o,(lon,lat)=>-1000+Math.max(0,project.forward([lon,lat])[0]-1900));
 const landing=evaluateSite(o,terrain,{});
 assert.equal(terrain.slope_max,0);
 assert.equal(landing.constraint_status,'within resolved terrain limits');
 assert.ok(landing.criteria.surroundings>0&&landing.criteria.surroundings<100);
 const partial={...terrain,surroundings:{...terrain.surroundings,known:terrain.surroundings.known-1}};
 const result=evaluateSite(o,partial,{});
 assert.equal(result.criteria.surroundings,null);
 assert.equal(result.coverage,.8);
});
test('landing scores ignore power and resources by default while base scores respond to them',()=>{
 const landing=options(),terrain=analyseSiteTerrain(grid(),landing,()=>-1000);
 const favorable={ice:1,resources:{nearest_km:0}},unfavorable={ice:-1,resources:{nearest_km:100}};
 assert.equal(evaluateSite(landing,terrain,{equivalent_hours_per_sol:12},favorable).score,evaluateSite(landing,terrain,{equivalent_hours_per_sol:0},unfavorable).score);
 const base={...landing,mode:'base',weights:SITE_WEIGHTS.base};
 assert.equal(evaluateSite(base,terrain,{equivalent_hours_per_sol:12},favorable).score-evaluateSite(base,terrain,{equivalent_hours_per_sol:0},unfavorable).score,65);
});
test('pair shortlist respects the radius, terrain eligibility and the weaker component range',()=>{
 const within='within resolved terrain limits';
 const candidate=(mode,lon,lower,upper,constraint_status=within)=>({options:{mode,lon,lat:0},lower,upper,constraint_status});
 const results=[candidate('landing',179.99,78,90),candidate('base',-179.99,64,96),candidate('base',179.98,99,100,'outside scenario'),candidate('base',179.6,90,99)];
 const pairs=compareSitePairs(results,5);
 assert.deepEqual(pairs.map(p=>[p.baseIndex,p.eligible,p.lower,p.upper]),[[1,true,64,90],[2,false,78,90]]);
 assert.ok(pairs[0].distanceKm>1&&pairs[0].distanceKm<2);
});

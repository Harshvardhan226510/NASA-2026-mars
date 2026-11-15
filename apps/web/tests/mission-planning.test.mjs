import test from 'node:test';
import assert from 'node:assert/strict';
import {walkState,scienceTask,missionBudget,allocation} from '../src/mission-planning.js';
import {terrainLineOfSight,routeAudit,analyseMission,validateMissionAnalysis,visibilityGaps,analysisSignature} from '../src/mission-terrain.js';
import {validateMission} from '../src/mission-state.js';
import {routeGeoJSON} from '../src/route-geometry.js';
import {marsSun} from '../src/solar-geometry.js';
const degrees=m=>m/3396190*180/Math.PI;
const path=(a,b,energy=209)=>({status:'success',summary:{minetti_energy_kj:energy},waypoints:[{lon:a[0],lat:a[1],elevation_m:0},{lon:b[0],lat:b[1],elevation_m:0}],terrain_profile:{samples:[{lon:a[0],lat:a[1],elevation_m:0},{lon:b[0],lat:b[1],elevation_m:0}]}});
function fixture(){const a=[0,0],b=[degrees(1000),0],route=path(a,b),target={id:'delta',name:'Delta',point:b,score:50,category:'science',evidence:'Published interpretation',source:{title:'Evidence',url:'https://science.nasa.gov/'}};return {schema:'mars-route-result/1',start:a,goal:b,return_to:a,return_route:path(b,a,104.5),targets:[target],routes:{direct_safe:route,apf_survey:route,deep_science:route},metadata:{mission_id:'test',grid_spacing_m:25,window_width_m:3000,max_slope_deg:22,unknown_cells:0,source:{sample_m:10,label:'Measured test DEM'}}};}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('round trip accounts separately for directed travel, station work, breaks, prior usage and reserves',()=>{
 const r=fixture(),state=walkState({config:{departure:'2026-10-20T12:00:00Z',speed_kmh:2,break_after_min:10,break_min:5,time_capacity_min:200,oxygen_capacity_l:100,energy_capacity_kj:1000,assumptions_reviewed:true}});state.tasks.delta=scienceTask(r.targets[0]);
 const b=missionBudget(r,'deep_science',state);assert.equal(b.complete,true);close(b.totals.outward.minutes,30);close(b.totals.return.minutes,30);close(b.totals.work.minutes,15);assert.equal(b.break_count,7);close(b.totals.breaks.minutes,35);close(b.checks.time.total,110);close(b.checks.energy.total,703.5);close(b.checks.oxygen.total,703.5/20.9);close(b.checks.time.usable,160);assert.equal(b.status,'within_configured_allocations');
 state.config.used_time_min=10;state.config.used_oxygen_l=5;state.config.used_energy_kj=100;const used=missionBudget(r,'deep_science',state);close(used.checks.time.total,120);assert.equal(used.checks.energy.status,'over');assert.equal(used.status,'over');close(Date.parse(used.return_at)-Date.parse(state.config.departure),110*60000);
});
test('missing return, unreached work, failed profiles and unentered prior use stay incomplete rather than zero exposure',()=>{
 const r=fixture(),state=walkState();delete r.return_route;let b=missionBudget(r,'deep_science',state);assert.equal(b.complete,false);assert.equal(b.checks.oxygen.estimate,null);assert.equal(b.checks.time.status,'unknown');
 r.return_route=fixture().return_route;r.targets[0].point=[1,1];b=missionBudget(r,'deep_science',state);assert.deepEqual(b.missing_stations,['delta']);assert.equal(b.checks.energy.total,null);
 r.targets=[];state.config.prior_usage_known=false;assert.equal(missionBudget(r,'deep_science',state).complete,false);
 state.config.prior_usage_known=true;r.routes.deep_science.status='partial';assert.equal(missionBudget(r,'deep_science',state).complete,false);
 assert.equal(allocation(10,null,20).status,'not_set');
});
test('departure lighting and declared night/scenario factors change the schedule without inventing weather measurements',()=>{
 const r=fixture(),at='2026-10-20T12:00:00Z',sun=marsSun(at),lon=((sun.subsolar_lon+360)%360)-180,a=[lon,0],b=[lon+degrees(1000),0];r.start=a;r.goal=b;r.targets=[];r.return_to=a;r.routes.deep_science=path(a,b);r.return_route=path(b,a,104.5);
 const state=walkState({config:{departure:at,break_after_min:600,break_min:0}}),normal=missionBudget(r,'deep_science',state);assert.ok(normal.night_samples>0);state.config.night_factor=.5;state.config.energy_factor=1.5;const slow=missionBudget(r,'deep_science',state);close(slow.checks.time.estimate,normal.checks.time.estimate*2);close(slow.checks.energy.estimate,normal.checks.energy.estimate*1.5);
});
test('broad-area schedules aggregate very numerous breaks without unbounded event arrays',()=>{
 const r=fixture();r.goal=[170,0];r.routes.deep_science=path(r.start,r.goal);r.return_route=path(r.goal,r.start);r.targets=[];const state=walkState({config:{speed_kmh:.1,speed_factor:.1,night_factor:.1,break_after_min:5}}),b=missionBudget(r,'deep_science',state);assert.ok(b.events.length<1000);assert.ok(b.break_count>10000);assert.ok(Number.isFinite(b.checks.time.estimate));
});
test('geometric comms detect a ridge, antenna height, missing coverage and Mars curvature',()=>{
 const a=[0,0],b=[degrees(2000),0];assert.equal(terrainLineOfSight(()=>0,a,b,1.7,3,50).state,'clear');
 const ridge=(lon)=>Math.abs(lon-degrees(1000))<degrees(100)?100:0;assert.equal(terrainLineOfSight(ridge,a,b,1.7,3,50).state,'blocked');assert.equal(terrainLineOfSight(ridge,a,b,150,150,50).state,'clear');
 const missing=(lon)=>Math.abs(lon-degrees(1000))<degrees(100)?NaN:0;assert.equal(terrainLineOfSight(missing,a,b,1.7,3,50).state,'unknown');assert.equal(terrainLineOfSight(()=>0,a,[degrees(10000),0],1,1,100).state,'blocked');
});
test('coverage reports source, resolution, sparse profiles and missing data without a confidence percentage',()=>{
 const r=fixture(),audit=routeAudit(r.routes.deep_science,r.metadata);assert.equal(audit.segments[0].state,'gap');assert.equal(audit.segments[0].analysis_spacing_m,25);assert.equal(audit.segments[0].source_sample_m,10);r.routes.deep_science.terrain_profile.samples[1].elevation_m=null;assert.equal(routeAudit(r.routes.deep_science,r.metadata).segments[0].state,'missing');assert.ok(audit.unsupported.includes('Soil strength / traction'));
});
test('clear samples split distinct geometric communication gaps instead of merging them',()=>{
 const samples=['blocked','blocked','clear','blocked','unknown','unknown','clear'].map((state,i)=>({leg:'outward',distance_m:i*25,visibility:{state}}));
 assert.deepEqual(visibilityGaps(samples),[{leg:'outward',state:'blocked',from:0,to:25,count:2},{leg:'outward',state:'blocked',from:75,to:75,count:1},{leg:'outward',state:'unknown',from:100,to:125,count:2}]);
});
test('return geometry, field history, tasks, settings and terrain snapshots survive refresh / mission serialization',()=>{
 const r=fixture(),state=walkState({tab:'log',open:true,config:{departure:'2026-10-20T12:00:00Z'},logs:[{id:'report',kind:'obstacle',point:[0,0],at:'2026-10-20T12:00Z',radius_m:20,note:'Reported loose material'}]});state.tasks.delta=scienceTask(r.targets[0]);
 const grid={rows:121,cols:121,center:[degrees(500),0],resolution_meters:25,elevation_matrix:Array.from({length:121},()=>Array(121).fill(0))};state.analysis=analyseMission(r,'deep_science',state,missionBudget(r,'deep_science',state),grid);assert.deepEqual(validateMissionAnalysis(state.analysis),state.analysis);
 const mission={schema:'mars-atlas-mission/1',measurement:{points:[]},route:{start:r.start,goal:r.goal,targets:[],operation:state,result:r}},clean=validateMission(mission);assert.deepEqual(validateMission(JSON.parse(JSON.stringify(clean))),clean);assert.equal(clean.route.operation.logs[0].note,'Reported loose material');assert.equal(clean.route.operation.open,true);assert.equal(clean.route.result.return_route.waypoints.length,2);
 assert.equal(analysisSignature(clean.route.result,'deep_science',clean.route.operation),state.analysis.signature);
 const geo=routeGeoJSON({...r,mission_operation:state});assert.ok(geo.features.some(f=>f.properties.role==='return_to_habitat'));assert.ok(geo.features.some(f=>f.properties.role==='field_log'));assert.equal(geo.mission_operation.tasks.delta.evidence,'Published interpretation');
});
test('invalid field coordinates, unbounded logs, invalid capacities and malformed cached geometry are rejected',()=>{
 assert.throws(()=>walkState({logs:[{point:[0,100]}]}));assert.throws(()=>walkState({logs:Array(101).fill({})}));assert.throws(()=>walkState({config:{speed_kmh:Infinity}}));assert.throws(()=>walkState({config:{time_reserve_pct:100}}));assert.throws(()=>validateMissionAnalysis({version:1,profile:'deep_science',audits:[],points:[{lon:NaN}]}));
 assert.throws(()=>walkState({tasks:JSON.parse('{"__proto__":{}}')}));assert.equal({}.equipment_ready,undefined);
});

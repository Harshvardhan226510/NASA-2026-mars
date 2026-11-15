import test from 'node:test';
import assert from 'node:assert/strict';
import {hazardInspector,routeHazardSegments} from '../src/eva-hazards.js';
import {incidentPosition,replayFrame,replayOutcome,replayTimeline} from '../src/eva-replay-model.js';
import {missionBudget,walkState} from '../src/mission-planning.js';
import {routeProjection} from '../src/route-geometry.js';

const projection=routeProjection([0,0]);
const point=(x,y)=>projection.inverse([x,y]);
const node=([lon,lat],elevation_m,travel_energy_kj)=>({lon,lat,elevation_m,travel_energy_kj});
const grid=(spacing=2)=>({center:[0,0],rows:11,cols:11,resolution_meters:spacing,elevation_matrix:Array.from({length:11},()=>Array(11).fill(0))});
const limits={slope:22,roughness:.75};

test('hazard inspection separates fine relief, field rocks and missing terrain',()=>{
 const data=grid();data.elevation_matrix[5][5]=.7;
 const a=hazardInspector(data,{sample_m:2},limits);
 assert.equal(a.inspect([0,0]).raisedCandidate,true);
 assert.equal(a.inspect([0,0]).state,'caution');
 assert.equal(a.inspect(point(1000,0)).state,'unknown');
 const report={point:[0,0],radius_m:1,note:'Field rock'};
 const coarse=hazardInspector(data,{sample_m:200},limits,[report]);
 assert.equal(coarse.fine,false);
 assert.equal(coarse.inspect([0,0]).report,report);
 assert.equal(hazardInspector(grid(200),{sample_m:200},limits).inspect([0,0]).state,'limited');
 const route={terrain_profile:{samples:[node(point(-3,0),0,0),node(point(3,0),0,3)]}};
 const [segment]=routeHazardSegments(route,{grid_spacing_m:5},hazardInspector(data,{sample_m:2},limits,[report]),limits);
 assert.equal(segment.state,'blocked');
 assert.equal(segment.report,report);
 assert.equal(segment.energy,3);
 assert.ok(segment.intensity>499&&segment.intensity<501);
});

test('timeline preserves station dwell and replay changes remaining resources without rewriting the plan',()=>{
 const a=point(0,0),b=point(200,0),stop=point(100,0);
 const path=(start,middle,end)=>({status:'success',summary:{minetti_energy_kj:60},waypoints:[node(start,0,0),node(end,0,60)],
  terrain_profile:{samples:[node(start,0,0),node(middle,0,30),node(end,0,60)]}});
 const out=path(a,stop,b),back=path(b,stop,a);
 const result={routes:{deep_science:out},return_route:back,metadata:{grid_spacing_m:25},targets:[{name:'Station',id:'one',point:stop}]};
 const state=walkState({config:{departure:'2026-11-15T00:00:00Z',speed_kmh:3,oxygen_capacity_l:80,time_capacity_min:120,energy_capacity_kj:800}});
 const budget=missionBudget(result,'deep_science',state),timeline=replayTimeline(result,budget,'deep_science');
 const midway=replayFrame(timeline,5,0);
 assert.equal(midway.leg,'outward');
 assert.equal(midway.activity,'Station');
 assert.ok(Math.abs(midway.distance-100)<.001);
 assert.equal(replayFrame(timeline,timeline.duration,0).leg,'return');
 assert.ok(incidentPosition(timeline,midway,25)?.radius>0);
 const settings={config:state.config,crew:[],field:null,incident:replayFrame(timeline,1,0),visibility:'clear'};
 const baseline=replayOutcome(midway,{...settings,scenario:'baseline'});
 const fewer=replayOutcome(midway,{...settings,scenario:'supplies',lossPercent:50});
 assert.ok(fewer.limits.find(x=>x.key==='oxygen').available<baseline.limits.find(x=>x.key==='oxygen').available);
 assert.equal(replayOutcome(midway,{...settings,scenario:'radio'}).verdict,'NO-GO');
 assert.equal(replayOutcome(midway,{...settings,scenario:'passage',passage:incidentPosition(timeline,midway,25)}).verdict,'NO-GO');
 const rover=replayOutcome(midway,{...settings,scenario:'rover',pickupMinutes:12});
 assert.equal(rover.spent.time,17);assert.ok(rover.spent.oxygen>baseline.spent.oxygen);
 assert.equal(state.config.oxygen_capacity_l,80);
});

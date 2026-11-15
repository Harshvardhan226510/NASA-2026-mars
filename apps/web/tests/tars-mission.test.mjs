import test from 'node:test';
import assert from 'node:assert/strict';
import {compareMissionStops,minimumReturnReserve,parseMissionQuestion} from '../src/tars-mission.js';
import {scienceTask,walkState} from '../src/mission-planning.js';
import {routeProjection} from '../src/route-geometry.js';
import {routeRisk} from '../src/route-risk.js';

const center=[77.40,18.45],projection=routeProjection(center);
const position=(x,y=0)=>projection.inverse([x,y]);
const point=(x,z)=>{const [lon,lat]=position(x);return {lon,lat,elevation_m:z};};

test('scores measured grades and roughness, and marks unresolved terrain without a low-risk default',()=>{
 const grid={center,rows:41,cols:41,resolution_meters:10,elevation_matrix:Array.from({length:41},()=>Array(41).fill(0))};
 const metadata={source:{sample_m:10},grid_spacing_m:10,max_slope_deg:22,mass_kg:125,gravity_ratio:.38};
 const route=z=>({status:'success',terrain_profile:{samples:[point(-10,0),point(0,z),point(10,0)]},
  validation:{corridor_checked:true},summary:{minetti_energy_kj:4.24}});
 const flat=routeRisk(route(0),metadata,grid);
 assert.equal(flat.score,0);
 assert.equal(flat.partial,false);
 grid.elevation_matrix[20][20]=1.5;
 const uneven=routeRisk(route(1.5),metadata,grid);
 assert.ok(uneven.score>flat.score&&uneven.terms.roughness>0);
 const coarse=routeRisk(route(0),{...metadata,source:{sample_m:200}},grid);
 assert.ok(coarse.partial&&coarse.score>flat.score);
 assert.equal(coarse.peakRoughness,null);
 assert.ok(routeRisk(route(8),metadata,grid).score>=85);
 assert.ok(routeRisk(route(0),metadata,grid,[{point:center,radius_m:1}]).score>=85);
 assert.equal(routeRisk({waypoints:[point(0,null),point(10,null)]},metadata,grid),null);
});

test('the requested reserve counts declared capacity, conservative returns, and unknown inputs',()=>{
 const budget={complete:true,checks:{oxygen:{capacity:100,total:67,reserve_pct:20}}};
 const sample={status:'within',margins:[{key:'oxygen',worst:7,best:15}]};
 const returns={outward:[sample],return:[sample]};
 assert.deepEqual(minimumReturnReserve(budget,returns,['oxygen']),{key:'oxygen',percent:27});
 assert.equal(minimumReturnReserve(budget,{...returns,return:[{status:'blocked',margins:[]}]},['oxygen']),null);
 assert.equal(parseMissionQuestion('Which science stop can we remove to recover a 25% return reserve?').minimum,25);
 assert.deepEqual(parseMissionQuestion('Which checkpoint can we drop to leave 25 percent O₂?').keys,['oxygen']);
 assert.equal(parseMissionQuestion('Return to camp'),null);
});

test('TARS compares exact planned omissions on the same grid and leaves the plan intact',async()=>{
 const leg=xs=>({status:'success',validation:{corridor_checked:true,max_sampled_slope_deg:0},summary:{minetti_energy_kj:127.2},
  waypoints:xs.map(x=>point(x,0)),terrain_profile:{samples:xs.map(x=>point(x,0))}});
 const targets=[{id:'alpha',name:'Alpha ridge',point:position(200),score:30},{id:'beta',name:'Beta outcrop',point:position(400),score:90}];
 const result={start:position(0),goal:position(600),return_to:position(0),targets,
  routes:{deep_science:leg([0,100,200,300,400,500,600])},return_route:leg([600,500,400,300,200,100,0]),
  metadata:{mission_id:'test',source:{label:'Test terrain',kind:'global',sample_m:100},grid_spacing_m:100,max_slope_deg:22,
   mass_kg:125,gravity_ratio:.38,apf_pull:1,sensor_radius_m:900}};
 const state=walkState({config:{round_trip:true,departure:'2026-11-15T00:00:00Z',comms:false,
  time_capacity_min:75,oxygen_capacity_l:100,energy_capacity_kj:1500,break_after_min:600},tasks:Object.fromEntries(targets.map((t,i)=>[
  t.id,{...scienceTask(t),minutes:i===0?25:5}
 ]))});
 const grid={center,rows:21,cols:21,resolution_meters:100,elevation_matrix:Array.from({length:21},()=>Array(21).fill(0))};
 const values=new DataView(new ArrayBuffer(grid.rows*grid.cols*8));
 for(let i=0;i<grid.rows*grid.cols;i++){
  const d=Math.abs(i%grid.cols-10)*100;values.setFloat32(i*8,d,true);values.setFloat32(i*8+4,d*.212,true);
 }
 const field={status:'ready',values,projection,rows:grid.rows,cols:grid.cols,spacing_m:100};
 const w={state,host:{result},pendingReports:false,obstacles:()=>[],returnSafety:{currentFix:()=>null}};
 const model={w,result,state,profile:'deep_science',grid,field};
 const before=JSON.stringify({state,result}),question=parseMissionQuestion('Which science stop can we remove to recover a 25% return reserve?');
 const answer=await compareMissionStops(model,question,{fetcher:async(url,options)=>{
  assert.equal(url,'/api/route');
  const request=JSON.parse(options.body);
  assert.deepEqual(request.omit_targets,['alpha','beta']);
  assert.deepEqual(request.return_to,result.return_to);
  assert.equal(request.scenario_profile,'deep_science');
  assert.deepEqual(request.grid,grid);
  return {ok:true,json:async()=>({schema:'mars-stop-scenarios/1',profile:'deep_science',
   scenarios:targets.map(t=>({omitted:t.id,route:result.routes.deep_science}))})};
 }});
 assert.match(answer.text,/Omitting Alpha ridge/);
 assert.match(answer.text,/Beta outcrop: /);
 assert.ok(answer.sources.some(([label])=>label.includes('USGS')));
 assert.equal(JSON.stringify({state,result}),before);
 await assert.rejects(()=>compareMissionStops({...model,field:null},question),/Recalculate/);
});

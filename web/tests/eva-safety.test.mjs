import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {COVERAGE} from '../src/comms-model.js';
import {assessEvaSafety} from '../src/eva-safety.js';
import {walkConfig} from '../src/mission-planning.js';
import {decodeReturnField,firstReturnBreach,forecastFromFix,returnCell,returnFixMargins,returnLimits,returnMargins,routeConsumption} from '../src/return-feasibility.js';
import {routeProjection} from '../src/route-geometry.js';

test('return grid preserves barriers and lengths and handles dateline positions',async()=>{
 const center=[179.9999,0],buffer=Buffer.alloc(72);
 for(let i=0;i<9;i++){buffer.writeFloatLE(i===0?-2:i===1?-1:i*50,8*i);buffer.writeFloatLE(i*5,8*i+4);}
 const packet={status:'ready',format:'deflate-f32le-distance-kj/1',rows:3,cols:3,spacing_m:50,center,data:deflateSync(buffer).toString('base64')};
 const field=await decodeReturnField(packet),projection=routeProjection(center);
 assert.deepEqual(returnCell(field,projection.inverse([50,0])),{status:'ready',distance:250,energy:25});
 assert.equal(returnCell(field,projection.inverse([0,50])).status,'blocked');
 assert.equal(returnCell(field,projection.inverse([-50,50])).status,'unknown');
 assert.equal(returnCell(field,projection.inverse([300,0])),null);
 const config=walkConfig({time_capacity_min:480,oxygen_capacity_l:100,energy_capacity_kj:1000}),spent={time:0,energy:0,oxygen:0,active:0};
 const limits=returnLimits(config,[],spent);
 assert.equal(returnFixMargins(field,center,10,config,spent,limits).status,'within');
 assert.equal(returnFixMargins(field,center,30,config,spent,limits).positionUncertain,true);
 const after={time:8,energy:30,oxygen:2,active:8},actual={time:12,energy:60,oxygen:6,active:null};
 const forecast=forecastFromFix([{distance_m:0,point:center,spent},{distance_m:100,point:center,spent:after}],spent,{actual,distance:0},config,[],field);
 assert.deepEqual(forecast.map(p=>p.spent),[{time:20,energy:90,oxygen:8,active:null}]);
 await assert.rejects(decodeReturnField({...packet,rows:4}),/Incomplete/);
});

test('return margin brackets night speed, counts work at stops and surfaces missing inputs',()=>{
 const c=walkConfig({time_capacity_min:120,oxygen_capacity_l:100,energy_capacity_kj:2000,speed_kmh:3,night_factor:.5});
 const before={time:10,oxygen:4,energy:80,active:10},after={time:30,oxygen:12,energy:240,active:30};
 const progress=[{distance_m:0,before:{time:0,oxygen:0,energy:0,active:0},after:{time:0,oxygen:0,energy:0,active:0}},{distance_m:500,before,after}];
 assert.equal(routeConsumption(progress,250).time,5);
 assert.equal(routeConsumption(progress,500).time,30);
 const cell={status:'ready',distance:2000,energy:300},limits=returnLimits(c,[],after);
 const margin=returnMargins(cell,c,after,limits);
 assert.equal(margin.status,'conditional');
 assert.equal(margin.margins[0].best,16);
 assert.equal(margin.margins[0].worst,-24);
 const reserve={...c,oxygen_capacity_l:10,energy_capacity_kj:null};
 assert.equal(returnMargins(cell,reserve,after,returnLimits(reserve,[],after)).status,'over');
 assert.equal(returnMargins(cell,c,null,null).status,'unknown');
 const samples=[{status:'within',distance_m:0},{status:'unknown',distance_m:10},{status:'over',distance_m:20},{status:'within',distance_m:30}];
 assert.deepEqual(firstReturnBreach(samples),{sample:samples[2],lastWithin:samples[0]});
});

test('integrated assessment separates known failures from incomplete evidence',()=>{
 const route={status:'success',validation:{corridor_checked:true,max_sampled_slope_deg:12}};
 const point={lon:0,lat:0,leg:'outward',distance_m:0,solar_elevation_deg:15,light:'no_local_shadow',visibility:{state:'clear'}};
 const config=walkConfig({assumptions_reviewed:true,receiver_height_m:12});
 const budget={checks:Object.fromEntries(['time','oxygen','energy'].map(k=>[k,{status:'within',remaining:10}])),stations:[]};
 const analysis={audits:[{segments:[{state:'sampled'}]}],points:[point]};
 const radio={point:[0,0],settings:{towerHeight:12,receiverHeight:1.7,frequency:450,reserve:10},result:{center:[0,0],tx:0,ty:0,radius:1000,cell:50,half:0,width:1,states:[COVERAGE.covered.id],margins:[20]}};
 const args={result:{routes:{direct_safe:route},return_route:route,metadata:{source:{label:'Fixture DEM',sample_m:20},grid_spacing_m:25,max_slope_deg:22}},
  config,budget,analysis,radio,receiver:[0,0],profile:'direct_safe',returns:{outward:[{status:'within'}],return:[{status:'within'}]}};
 assert.equal(assessEvaSafety(args).verdict,'GO');
 assert.equal(assessEvaSafety({...args,radio:null}).verdict,'CAUTION');
 assert.equal(assessEvaSafety({...args,currentReturn:{status:'over',margins:[{label:'Oxygen',unit:'L',best:-2}]}}).verdict,'NO-GO');
 const failed=assessEvaSafety({...args,analysis:{...analysis,points:[{...point,light:'local_shade',visibility:{state:'unknown'}}]},radio:null});
 assert.equal(failed.verdict,'NO-GO');
 assert.ok(failed.checks.filter(check=>check.status!=='pass').every(check=>check.evidence&&check.action));
 assert.equal(failed.checks.find(check=>check.name==='Sunlight').status,'stop');
 assert.equal(failed.checks.find(check=>check.name==='Communications').status,'caution');
 radio.result.states[0]=COVERAGE.weak.id;
 assert.equal(assessEvaSafety(args).checks.find(check=>check.name==='Communications').status,'stop');
});

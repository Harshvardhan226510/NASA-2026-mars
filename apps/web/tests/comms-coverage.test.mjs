import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {COVERAGE,commsParameters,commsScenario,containsCoverage,coverageBounds,coverageCell,coverageGrid,coverageWindow,freeSpaceLoss,predictLink} from '../src/comms-model.js';
import {routeTerrain} from '../src/route-terrain.js';

test('link classification separates radio budget, blockage, Fresnel clearance and unknown terrain',()=>{
 const settings=commsParameters({towerHeight:18,receiverHeight:18});
 const calc=(h,options={})=>predictLink({...settings,...options},0,0,1000,h,60).id;
 assert.ok(Math.abs(freeSpaceLoss(1000,450)-85.51)<.1);
 assert.equal(calc(()=>0),COVERAGE.covered.id);
 assert.equal(calc(t=>t>.4&&t<.6?30:0),COVERAGE.blocked.id);
 assert.equal(calc(t=>t>.4&&t<.6?12:0),COVERAGE.marginal.id);
 assert.equal(calc(()=>0,{power:.001,sensitivity:-70}),COVERAGE.weak.id);
 assert.equal(calc(t=>t>.2&&t<.3?NaN:0),COVERAGE.unknown.id);
 assert.equal(calc(t=>t<.3?NaN:t>.4&&t<.6?30:0),COVERAGE.blocked.id);
 assert.equal(predictLink(settings,0,NaN,1000,()=>0,60).id,COVERAGE.unknown.id);
});

test('planet curvature can obscure a low receiver even above flat datum terrain',()=>{
 const settings=commsParameters({towerHeight:1,receiverHeight:1,power:1000});
 assert.equal(predictLink(settings,0,0,30000,()=>0,100).id,COVERAGE.blocked.id);
});

test('normalizes mission settings, checks coordinates, and supports antimeridian and polar windows',()=>{
 assert.equal(commsScenario({point:[-180,90],settings:{frequency:600}}).settings.frequency,600);
 assert.throws(()=>commsScenario({point:[200,0]}));
 assert.throws(()=>commsParameters({power:-1}));
 assert.ok(coverageBounds([179.99,0],60000)[2]>180);
 assert.equal(coverageBounds([150,89.9],60000)[2]-coverageBounds([150,89.9],60000)[0],360);
});

test('Bright Angel runs with bundled terrain and moving the tower recomputes a different footprint',async()=>{
 const original=globalThis.fetch,point=[77.3045,18.4955],settings=commsParameters({radius:.55});
 globalThis.fetch=async address=>new Response(await readFile(new URL(`../public${address.split('?')[0]}`,import.meta.url)));
 try{
  const grid=await routeTerrain(coverageWindow(point,550),{spacing:25});
  assert.equal(grid.source.sample_m,20);
  assert.equal(containsCoverage(grid,point,550),true);
  const result=coverageGrid(grid,{point,settings});
  assert.ok(result.counts[COVERAGE.covered.id]>0);
  assert.ok(result.counts[COVERAGE.blocked.id]>0);
  assert.equal(coverageCell(result,[result.tx,result.ty]).id,COVERAGE.covered.id);
  assert.equal(coverageCell(result,[result.tx+1400,result.ty]),null);
  const moved=[point[0]+.001,point[1]];
  assert.equal(containsCoverage(grid,moved,550),true);
  const next=coverageGrid(grid,{point:moved,settings});
  assert.notDeepEqual(next.counts,result.counts);
 }finally{globalThis.fetch=original;}
});

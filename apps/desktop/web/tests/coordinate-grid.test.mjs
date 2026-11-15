import test from 'node:test';
import assert from 'node:assert/strict';
import {gridInterval,coordinateLabel,coordinateGrid} from '../src/coordinate-grid.js';
import {layerSelection,allLayerSelection} from '../src/layers.js';

test('Mars grid labels use signed east longitude, N/S latitude and enough decimal precision',()=>{
 assert.equal(coordinateLabel(-77.4,'lon',.1),'77.4°W');assert.equal(coordinateLabel(282.6,'lon',.1),'77.4°W');
 assert.equal(coordinateLabel(-18.45,'lat',.01),'18.45°S');assert.equal(coordinateLabel(.00002,'lat',.00001),'0.00002°N');
 assert.equal(coordinateLabel(180,'lon'),'180°');assert.equal(coordinateLabel(-180,'lon'),'180°');assert.equal(coordinateLabel(0,'lat'),'Equator · 0°');
 assert.equal(gridInterval(180),30);assert.equal(gridInterval(360),60);assert.ok(gridInterval(.01)<gridInterval(1));
});

test('grid plans align at shared tile borders and remain bounded at extreme zoom and polar extents',()=>{
 const spacing={latStep:10,lonStep:10},west=coordinateGrid([-40,0,0,40],spacing),east=coordinateGrid([0,0,40,40],spacing);
 const primeWest=west.lines.find(x=>x.axis==='lon'&&x.coordinate===0),primeEast=east.lines.find(x=>x.axis==='lon'&&x.coordinate===0);
 assert.deepEqual(primeWest.from,[256,0]);assert.deepEqual(primeEast.from,[0,0]);assert.ok(primeWest.major&&primeEast.major);
 const detail=coordinateGrid([0,0,10,10],spacing);assert.ok(detail.labels.some(x=>x.text==='10°N'));assert.ok(detail.labels.some(x=>x.text==='10°E'));
 assert.deepEqual(coordinateGrid([-180,-90,180,90],{latStep:1e-6,lonStep:1e-6}),{lines:[],labels:[]});
 for(const latitude of [-90,0,85])for(const step of [1e-6,.01,10,30]){
  const plan=coordinateGrid([-180,latitude,180,Math.min(90,latitude+5)],{latStep:step,lonStep:step});
  assert.ok(plan.lines.length<=82);assert.ok(plan.labels.length<=3362);assert.ok(plan.lines.every(x=>x.axis!=='lat'||Math.abs(x.coordinate)<90));
 }
});

test('coordinate guides remain independent of heatmaps, contours and pin visibility',()=>{
 const state=layerSelection({graticule:false,elevation:true,contours:true,regions:false},'graticule',true);assert.equal(state.graticule,true);assert.equal(state.elevation,true);assert.equal(state.contours,true);assert.equal(state.regions,false);
 assert.equal(layerSelection(state,'thermal-inertia',true).graticule,true);assert.equal(allLayerSelection(state,false).graticule,false);assert.equal(allLayerSelection({...state,graticule:false},true).graticule,false);
});

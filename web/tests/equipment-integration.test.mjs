import test from 'node:test';import assert from 'node:assert/strict';
import {MissionDeployer} from '../src/mission-deployer.js';
test('equipment preserves relief preference and uses physical native elevations rather than display heights',()=>{
 const pins=[];const leaflet={divIcon:o=>o,marker:point=>({addTo(){pins.push(point);return this;},on(){return this;}})};
 const host={viewer:{scene:{requestRender(){},globe:{getHeight:()=>-7500}}},map:{setView(){}},leaflet,terrainRelief:{enabled:true,scale:3,set(){assert.fail('Do not overwrite the user relief preference');}},surface:()=>({sourceElevation:()=>-2500})};
 const d=new MissionDeployer(host);d.startPlacement('weather_station');const record=d.deployAt([77.4,18.45],-7500);
 assert.equal(record.elevation,-2500);assert.equal(record.terrainSource,'HiRISE physical DEM');assert.equal(record.slopeDeg,0);assert.equal(record.slopeSource,'Physical DEM stencil');assert.equal(host.terrainRelief.enabled,true);assert.deepEqual(pins,[[18.45,77.4]]);
});
test('zero supplied elevation remains valid and missing terrain assumptions are explicitly labeled',()=>{
 const d=new MissionDeployer({});const a=d.deployAt([77,18],0,'solar_array');assert.equal(a.elevation,0);assert.equal(a.terrainSource,'Supplied scenario elevation');
 const b=d.deployAt([77,18],undefined,'weather_station');assert.match(b.terrainSource,/Assumed regional elevation/);assert.match(b.slopeSource,/Scenario/);
});

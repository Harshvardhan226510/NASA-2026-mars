import test from 'node:test';
import assert from 'node:assert/strict';
import {MissionDeployer} from '../src/mission-deployer.js';

test('opening and reopening Plan Mission keeps the current map location, while explicit target selection still flies',()=>{
 let flights=0,refreshes=0,cancelled=0;
 const attributes={},root={hidden:true,querySelector:()=>null};
 const tool=Object.assign(Object.create(MissionDeployer.prototype),{
  root,toggle:{setAttribute:(key,value)=>attributes[key]=value},deployed:[],host:{onOpen:()=>{}},
  fetchInAppWeather:()=>refreshes++,updateAllTelemetry:()=>{},syncDeployedList:()=>{},renderBaseOperationsHUD:()=>{},renderLocations:()=>{},renderEquipmentPalette:()=>{},
  flyToCurrentLocation:()=>flights++,cancelPlacement:()=>cancelled++
 });
 tool.open(true);
 assert.equal(root.hidden,false);assert.equal(attributes['aria-expanded'],'true');assert.equal(flights,0);assert.equal(refreshes,1);
 tool.open(false);assert.equal(root.hidden,true);assert.equal(cancelled,1);
 tool.open(true);assert.equal(flights,0);
 tool.startPlacement('solar_array');assert.equal(tool.picking,true);assert.equal(tool.selectedEquipmentType,'solar_array');assert.equal(flights,0);
 tool.selectLocation('JEZERO_CRATER');assert.equal(tool.currentLocationId,'JEZERO_CRATER');assert.equal(flights,1);
 tool.deployed=[{id:'existing'}];tool.open(true);assert.equal(flights,1);
});

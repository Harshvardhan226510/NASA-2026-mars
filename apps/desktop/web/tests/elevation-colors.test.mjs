import test from 'node:test';
import assert from 'node:assert/strict';
import {elevationColor,elevationPixels,ELEVATION_STOPS} from '../src/elevation-colors.js';
test('height colors use a fixed scale and missing heights stay transparent',()=>{
 for(const [h,rgb] of ELEVATION_STOPS)assert.deepEqual(elevationColor(h),[...rgb,255]);
 assert.deepEqual(elevationColor(-10000),elevationColor(-8000));assert.deepEqual(elevationColor(26000),elevationColor(22000));
 assert.deepEqual(elevationColor(NaN),[0,0,0,0]);assert.deepEqual(elevationColor(undefined),[0,0,0,0]);
 assert.deepEqual(elevationColor(-6000),[42,96,146,255]);
});
test('tiles use geographic pixel centres in north-to-south order and agree at the dateline',()=>{
 const observed=[];elevationPixels([0,0,2,2],2,(lon,lat)=>{observed.push([lon,lat]);return 0;});
 assert.deepEqual(observed,[[.5,1.5],[1.5,1.5],[.5,.5],[1.5,.5]]);
 const field=(lon,lat)=>Math.cos(lon*Math.PI/180)*1000+lat*100;
 assert.deepEqual(elevationPixels([-180,0,-179,1],2,field),elevationPixels([180,0,181,1],2,field));
 const a=elevationPixels([0,0,2,2],2,()=>4000),b=elevationPixels([10,10,11,11],1,()=>4000);
 assert.deepEqual(a.slice(0,4),b);assert.equal(elevationPixels([0,0,1,1],1,()=>NaN)[3],0);
});

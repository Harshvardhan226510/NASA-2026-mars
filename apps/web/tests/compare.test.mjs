import test from 'node:test';
import assert from 'node:assert/strict';
import {CompareViews,groundMetresPerPixel,zoomForGroundScale} from '../src/compare.js';

test('linked map scale uses Mars geographic pixels and round trips at different latitudes',()=>{
 assert.ok(Math.abs(groundMetresPerPixel(0,0)-41677.52)<.01);
 for(const lat of [-70,-10,18.48,40])for(const metres of [.25,1,14,400])assert.ok(Math.abs(groundMetresPerPixel(lat,zoomForGroundScale(lat,metres))-metres)<1e-10);
 assert.equal(zoomForGroundScale(0,.0001),23);
});

test('a camera-driven comparison update cannot move the camera through a map feedback event',()=>{
 let centre={lng:77,lat:18},zoom=6,moves=0,changes=0,link;
 const map={getCenter:()=>centre,getZoom:()=>zoom,distance:()=>100,setView(point,z){centre={lat:point[0],lng:point[1]};zoom=z;changes++;link.from2D();}};
 link=new CompareViews(map,{active:()=>true,move3D:()=>moves++});
 link.from3D({focus:[77.4,18.48],perPixel:14});assert.equal(moves,0);assert.equal(changes,1);assert.deepEqual(centre,{lat:18.48,lng:77.4});
 link.from2D();assert.equal(moves,1);
});

test('independent and standalone views leave the other map untouched',()=>{
 let touched=0;const map={getCenter:()=>({lng:77.4,lat:18.48}),getZoom:()=>14,distance:()=>100,setView:()=>touched++};
 const link=new CompareViews(map,{active:()=>false,move3D:()=>touched++});
 link.from3D({focus:[77.4,18.48],perPixel:14});link.from2D();assert.equal(touched,0);
});
test('resizing a newly visible map cannot reposition the camera at its old hidden-map centre',()=>{
 let moved=0;const map={getCenter:()=>({lng:0,lat:0}),getZoom:()=>0};
 const link=new CompareViews(map,{active:()=>true,move3D:()=>moved++});
 link.programmatic(()=>{link.from2D();link.programmatic(()=>link.from2D());link.from2D();});
 assert.equal(moved,0);assert.equal(link.syncing,false);link.from2D();assert.equal(moved,1);
});
test('terrain data finishing during a 2D pan cannot snap the map back to the old camera centre',()=>{const handlers=new Map();let changes=0,moved;const map={on(events,handler){for(const e of events.split(' '))handlers.set(e,handler);},getCenter:()=>({lng:77.45,lat:18.49}),getZoom:()=>17,distance:()=>100,setView:()=>changes++};const link=new CompareViews(map,{active:()=>true,move3D:focus=>moved=focus});handlers.get('movestart')();link.from3D({focus:[77.4,18.48],perPixel:1});assert.equal(changes,0);handlers.get('moveend')();link.from2D();assert.deepEqual(moved,[77.45,18.49]);});
test('from3D cannot recursively re-enter from3D when map.setView triggers synchronous feedback',()=>{
 let count=0;
 let link;
 const map={
  getCenter:()=>({lng:0,lat:0}),
  getZoom:()=>5,
  distance:()=>100,
  setView(pt,z){
   count++;
   if(count>50)throw new RangeError('Maximum call stack size exceeded');
   link.from3D({focus:[pt[1]+0.1,pt[0]+0.1],perPixel:10});
  }
 };
 link=new CompareViews(map,{active:()=>true,move3D:()=>{}});
 link.from3D({focus:[10,20],perPixel:10});
 assert.equal(count,1);
});


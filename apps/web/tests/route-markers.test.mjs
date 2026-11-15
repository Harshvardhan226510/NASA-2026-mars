import test from 'node:test';import assert from 'node:assert/strict';
import {routeMarkers} from '../src/route-markers.js';
test('endpoint pins follow actual searched endpoints while target coordinates stay exact',()=>{
 const target={point:[179.999,10],origin:'catalogue'},result={routes:{deep_science:{waypoints:[{lon:179.9,lat:10},{lon:-179.9,lat:11}]}}};
 const saved=JSON.stringify([result,target]);const markers=routeMarkers(result,[179.8,10],[-179.8,11],[target]);
 assert.deepEqual(markers.map(m=>m.label),['A','B','V1']);assert.deepEqual(markers[0].point,[179.9,10]);assert.deepEqual(markers[1].point,[-179.9,11]);assert.equal(markers[2].point,target.point);assert.equal(JSON.stringify([result,target]),saved);
});
test('before a calculation endpoint pins retain requested coordinates',()=>{assert.deepEqual(routeMarkers(null,[1,2],[3,4]),[{point:[1,2],label:'A'},{point:[3,4],label:'B'}]);});

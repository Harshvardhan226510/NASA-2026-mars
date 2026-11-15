import test from 'node:test';import assert from 'node:assert/strict';
import {routeProfile,profileChartPath,walkingTimeText} from '../src/route-profile.js';
test('profiles use unexaggerated measured heights and preserve gaps as unknown',()=>{const r=routeProfile({terrain_profile:{samples:[{lon:0,lat:0,elevation_m:-100},{lon:.001,lat:0,elevation_m:-80},{lon:.002,lat:0,elevation_m:null},{lon:.003,lat:0,elevation_m:-90}] }},{grid_spacing_m:200,source:{sample_m:200},max_slope_deg:22});assert.equal(r.ascent_m,20);assert.equal(r.descent_m,0);assert.equal(r.known_fraction,.75);assert.ok(r.distance_m>177&&r.distance_m<179);assert.ok(r.max_slope_deg>18);assert.equal(profileChartPath(r.samples,'elevation_m').path.match(/M/g).length,2);assert.equal(r.source_sample_m,200);});
test('short and dateline routes produce bounded chart geometry',()=>{for(const points of [[],[{lon:0,lat:90,elevation_m:100}],[{lon:179.99,lat:80,elevation_m:10},{lon:-179.99,lat:80,elevation_m:20}]]){const p=routeProfile({waypoints:points});assert.ok(!profileChartPath(p.samples,'elevation_m').path.includes('NaN'));assert.ok(p.distance_m<1000);}});
test('walking estimates handle short legs, hour boundaries and a changed pace',()=>{
 assert.equal(walkingTimeText(.02,2),'<1 min');
 assert.equal(walkingTimeText(0,2),'0 min');
 assert.equal(walkingTimeText(1.99,2),'1 h');
 assert.equal(walkingTimeText(2.5,2),'1 h 15 min');
 assert.equal(walkingTimeText(2.5,3),'50 min');
 assert.equal(walkingTimeText(2.5,0),'—');
});

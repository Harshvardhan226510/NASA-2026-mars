import test from 'node:test';
import assert from 'node:assert/strict';
import {returnRouteEntry,RETURN_ROUTE} from '../src/return-route.js';
test('return detail card receives the actual return telemetry, never an outbound route',()=>{
 const back={status:'success',summary:{total_distance_km:2},terrain_profile:{samples:[]}};
 const entry=returnRouteEntry({return_route:back,routes:{direct_safe:{summary:{total_distance_km:1}}}});
 assert.equal(entry[0],'return_route');assert.equal(entry[2],back);assert.match(entry[1].description,/Purple dashed/);assert.match(entry[1].description,/B →/);
 assert.equal(entry[1].color,'#d1a5ed');assert.equal(entry[1],RETURN_ROUTE);
});
test('missing return is explicit for older round trips and one-way plans',()=>{
 assert.equal(returnRouteEntry(null),null);
 assert.equal(returnRouteEntry({metadata:{round_trip:false}})[2].status,'not_included');
 const entry=returnRouteEntry({metadata:{round_trip:true}});assert.equal(entry[2].status,'failed');assert.match(entry[2].reason,/Recalculate/);
});

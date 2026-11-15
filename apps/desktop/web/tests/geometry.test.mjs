import test from 'node:test';
import assert from 'node:assert/strict';
// These tests exercise masked surface topology, not a synthetic route claim.
import {triangles,splitBounds,spanMeters,distanceToFootprint} from '../src/surface.js';
test('missing elevation does not produce a bridged terrain triangle',()=>{assert.deepEqual([...triangles([1,1,0,1],2)],[]);assert.deepEqual([...triangles([1,1,1,0],2)],[0,2,1]);});
test('adjacent quadtree children have exactly shared edges and preserve bounds',()=>{const children=splitBounds([-76,-10,-75,-9]);assert.deepEqual(children[0],[-76,-9.5,-75.5,-9]);assert.equal(children[0][2],children[1][0]);assert.equal(children[0][1],children[2][3]);});
test('map extent measurements use Mars circumference',()=>{assert.ok(Math.abs(spanMeters([0,0,1,0])[0]-59274.6975)<1);});
test('close zoom near a large patch corner uses surface distance rather than a distant centre',()=>{assert.equal(distanceToFootprint([-76,-10,-75,-9],-75.999,-9.999,30),30);assert.ok(distanceToFootprint([-76,-10,-75,-9],-77,-9.5,30)>58000);});

import test from 'node:test';
import assert from 'node:assert/strict';
import {SKY_FACES,cubeDirection,skyColor,skyPhase,skyStars} from '../src/ground-sky-colors.js';

test('sky cube directions are normalized and adjoining face edges meet',()=>{
 for(const face of SKY_FACES)for(const u of [-1,0,1])for(const v of [-1,0,1])assert.ok(Math.abs(Math.hypot(...cubeDirection(face,u,v))-1)<1e-12);
 assert.deepEqual(cubeDirection('positiveX',-1,0),cubeDirection('positiveZ',1,0));
 assert.deepEqual(cubeDirection('positiveX',1,0),cubeDirection('negativeZ',-1,0));
 assert.throws(()=>cubeDirection('invalid',0,0));
});
test('daylight is warm, night dark, and stars fade before daylight',()=>{
 const day=skyColor(1,0,60),night=skyColor(1,0,-30);
 assert.ok(day[0]>day[2]);assert.ok(day.reduce((a,b)=>a+b)>night.reduce((a,b)=>a+b)*5);
 assert.equal(skyPhase(10).stars,0);assert.equal(skyPhase(-20).stars,1);
 assert.ok(skyPhase(-10).stars>0&&skyPhase(-10).stars<1);
 for(const elevation of [-90,-10,0,10,90])for(const altitude of [-1,0,1])for(const sun of [-1,0,1])assert.ok(skyColor(altitude,sun,elevation).every(c=>Number.isInteger(c)&&c>=0&&c<=255));
});
test('illustrative star positions are stable unit vectors, without random flicker',()=>{
 const stars=skyStars();assert.equal(stars.length,700);assert.deepEqual(stars,skyStars());
 for(const star of stars){assert.ok(Math.abs(Math.hypot(...star.direction)-1)<1e-12);assert.ok(star.brightness>=.35&&star.brightness<=1);}
});

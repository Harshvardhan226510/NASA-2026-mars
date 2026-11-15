import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {locatePlace,inFeature,distanceKm,placeRegion,coordinateRegion,parseCoordinateSearch} from '../src/place-context.js';
const features=JSON.parse(readFileSync(new URL('../public/mars-gazetteer.json',import.meta.url))).features;
test('view-centre naming covers published Jezero and named features far outside our marked regions',()=>{for(const name of ['Jezero','Hellas Planitia','Gusev','Olympus Mons']){const f=features.find(f=>f.name===name);assert.ok(f,name);assert.ok(locatePlace(f.center,f.diameterKm,features).title.includes(name));}});
test('longitude seam and polar catalogue extents do not turn small features into global regions',()=>{const f={id:'test',name:'Seam crater',type:'Crater',center:[0,0],diameterKm:118,bounds360:[359,-1,1,1]};assert.ok(inFeature([-.5,0],f));assert.ok(inFeature([.5,0],f));assert.equal(inFeature([180,0],f),false);assert.deepEqual(placeRegion(f).bbox,[-1,-1,1,1]);assert.ok(distanceKm([179,0],[-179,0])<120);});
test('near a landing study reports distance to the study centre',()=>{const study={name:'AP1',category:'Landing studies',center:[-160,40]};const context=locatePlace([-160.1,40],10,[],[study]);assert.match(context.title,/Near AP1/);assert.ok(context.detail.includes('study centre'));});
test('place search accepts latitude-first decimal or integer coordinate pairs',()=>{
 for(const [query,expected] of [['18.44, 77.43',[77.43,18.44]],['18 77',[77,18]],[' -23.5   +99.6 ',[99.6,-23.5]],['−7,−72',[-72,-7]],['.5, -180',[-180,.5]]]){
  const point=parseCoordinateSearch(query);
  assert.deepEqual(coordinateRegion(...point)?.center,expected);
 }
 for(const query of ['Jezero','AP1','18','18,77,0','18,,77','18 77 km'])assert.equal(parseCoordinateSearch(query),null);
 for(const query of ['91 0','0 -181'])assert.equal(coordinateRegion(...parseCoordinateSearch(query)),null);
});

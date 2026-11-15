import {routeAttractors} from '../src/route-sites.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {corridorDistanceKm,nearbyRouteSites,routeSiteSettings} from '../src/route-sites.js';
import {routeGeoJSON} from '../src/route-geometry.js';
import {validateMission} from '../src/mission-state.js';
const site=(id,point,category='science')=>({id,name:id,center:point,category,evidence:'Published research',coordinateNote:'Approximate research location',sources:[{title:'Catalogue source',url:'https://science.nasa.gov/'}]});

test('nearby selection covers the entire corridor, including date-line and polar arcs',()=>{
 assert.ok(corridorDistanceKm([179.99,.01],[179,0],[-179,0])<.6);
 assert.ok(corridorDistanceKm([45,90],[0,89],[180,89])<1e-7);
 assert.ok(corridorDistanceKm([0,2],[0,0],[1,0])>100);
 const selected=nearbyRouteSites([site('middle',[.5,.01]),site('far',[.5,2])],[0,0],[1,0],[],{radiusKm:1});
 assert.deepEqual(selected.targets.map(t=>t.siteId),['middle']);
 assert.equal(selected.targets[0].score,50);assert.equal(selected.targets[0].source.url,'https://science.nasa.gov/');
});

test('manual stops reserve the exact-order budget; colocated and duplicate research pins do not create duplicate stops',()=>{
 const sites=Array.from({length:10},(_,i)=>site('s'+i,[.1+i*.08,.01+i*.001]));
 sites.push({...sites[0]},site('colocated',[.1,.01]),site('manual-match',[.5,0]));
 const manual=[{id:'manual',point:[.5,0],score:90}];
 const selection=nearbyRouteSites(sites,[0,0],[1,0],manual,{radiusKm:2});
 assert.equal(selection.targets.length,5);assert.equal(selection.available,10);assert.equal(selection.omitted,5);
 assert.equal(new Set(selection.targets.map(t=>t.siteId)).size,5);
 assert.equal(selection.targets.some(t=>t.siteId==='manual-match'),false);
 assert.equal(selection.targets.filter(t=>['s0','colocated'].includes(t.siteId)).length,1);
 assert.equal(nearbyRouteSites(sites,[0,0],[1,0],Array(6).fill(manual[0])).targets.length,0);
});

test('category choices, exclusions, priority overrides and disabling are explicit preferences',()=>{
 const sites=[site('a',[.2,.01]),site('b',[.4,.02],'minerals'),site('c',[.6,.03],'resources')];
 const settings={radiusKm:3,categories:['minerals','resources'],excluded:['c'],priorities:{b:85}};
 const selection=nearbyRouteSites(sites,[0,0],[1,0],[],settings);
 assert.deepEqual(selection.targets.map(t=>[t.siteId,t.score]),[['b',85]]);
 assert.equal(nearbyRouteSites(sites,[0,0],[1,0],[],{enabled:false}).targets.length,0);
 assert.equal(nearbyRouteSites(sites,null,[1,0]).targets.length,0);
 assert.deepEqual(routeSiteSettings({radiusKm:Infinity,categories:['unknown'],priorities:{bad:NaN}}),{enabled:true,radiusKm:5,categories:[],excluded:[],priorities:{}});
});

test('the real Jezero research catalogue contributes a sourced delta stop without using map visibility filters',()=>{
 const sites=JSON.parse(readFileSync(new URL('../public/value-sites.json',import.meta.url))).sites;
 const selection=nearbyRouteSites(sites,[77.44221,18.42],[77.44221,18.47]);
 assert.ok(selection.targets.some(t=>t.siteId==='JEZERO_DELTA'));
 assert.ok(selection.targets.every(t=>t.source?.url&&t.origin==='catalogue'&&t.score===50));
});

test('mission round trips and GeoJSON preserve the actual automatic stops, provenance and preferences',()=>{
 const [target]=nearbyRouteSites([site('delta',[77.41,18.46])],[77.44,18.42],[77.44,18.48]).targets;
 const route={status:'success',waypoints:[]},result={schema:'mars-route-result/1',routes:{direct_safe:route,apf_survey:route,deep_science:route},metadata:{grid_spacing_m:25,window_width_m:5000,max_slope_deg:22},start:[77.44,18.42],goal:[77.44,18.48],targets:[target]};
 const mission={schema:'mars-atlas-mission/1',measurement:{points:[]},route:{start:result.start,goal:result.goal,targets:[],sites:{radiusKm:8,excluded:['other'],priorities:{delta:80}},result}};
 const clean=validateMission(mission);assert.equal(clean.route.targets.length,0);assert.deepEqual(clean.route.result.targets,[target]);
 assert.deepEqual(validateMission(JSON.parse(JSON.stringify(clean))),clean);
 assert.equal(clean.route.sites.priorities.delta,80);assert.equal(clean.route.sites.radiusKm,8);
 const feature=routeGeoJSON(clean.route.result).features.find(f=>f.properties.siteId==='delta');
 assert.equal(feature.properties.origin,'catalogue');assert.equal(feature.properties.source.url,target.source.url);
 assert.deepEqual(feature.geometry.coordinates,target.point);
});


test('regional attraction uses the actual projected mission window across the date line and shares selection controls',()=>{
 const grid={center:[179.99,10],rows:31,cols:31,resolution_meters:1000};
 const sites=[site('east',[-179.99,10],'minerals'),site('excluded',[179.98,10],'minerals'),site('wrong-category',[179.99,10],'science'),site('outside',[170,10],'minerals')];
 const settings={enabled:true,categories:['minerals'],excluded:['excluded'],priorities:{east:90}};
 const result=routeAttractors(sites,grid,settings);assert.equal(result.length,1);assert.equal(result[0].id,'site:east');assert.equal(result[0].score,90);assert.ok(result[0].source.url);
 assert.deepEqual(routeAttractors(sites,grid,{...settings,enabled:false}),[]);
});

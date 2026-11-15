import test from 'node:test';
import assert from 'node:assert/strict';
import {addTerrainRoute,ROUTE_WIDTHS,simplifyRouteDisplay,ROUTE_PRIORITY,routeVisible,orderedRouteKeys,routePane} from '../src/route-display.js';
test('3D routes follow the displayed terrain with shared clearance, not ground clamping',()=>{
 const C={Color:{fromCssColorString:x=>x,BLACK:'black'},Cartographic:{fromDegrees:(lon,lat)=>({lon,lat})},Cartesian3:{fromDegrees:(lon,lat,height)=>({lon,lat,height})},ArcType:{NONE:'none'},CallbackProperty:class{constructor(get){this.getValue=get;}},PolylineOutlineMaterialProperty:class{constructor(o){Object.assign(this,o);}},PolylineDashMaterialProperty:class{constructor(o){Object.assign(this,o);}}};
 const entities=[],source={entities:{add:e=>entities.push(e)}},viewer={scene:{globe:{getHeight:()=>50,ellipsoid:{}},canvas:{clientHeight:1000}}};
 const points=[[0,0],[.001,0]],saved=JSON.stringify(points);
 addTerrainRoute(C,viewer,source,points,{surface:()=>({sampleHeight:()=>150}),color:'green',width:12});
 assert.equal(entities.length,1);const line=entities[0].polyline;
 assert.equal(line.clampToGround,false);assert.equal(line.arcType,'none');assert.equal(line.width,12);
 const p=line.positions.getValue();assert.ok(p.length>2);assert.ok(p.every(x=>x.height===153));assert.equal(p[0].lon,0);assert.ok(Math.abs(p.at(-1).lon-.001)<1e-12);
 assert.equal(JSON.stringify(points),saved);
 addTerrainRoute(C,viewer,source,points,{color:'purple',dashed:true,width:3});assert.equal(entities[1].polyline.material.dashLength,16);
 addTerrainRoute(C,viewer,source,points,{surface:()=>({sampleHeight:()=>150}),color:'green',priority:ROUTE_PRIORITY.direct_safe});
 assert.ok(entities[2].polyline.positions.getValue().every(p=>p.height>153));
 assert.deepEqual(ROUTE_WIDTHS,[3,3,3]);
});
test('overlapping routes have stable visual precedence and isolation includes the return',()=>{
 const keys=['direct_safe','return_route','apf_survey','deep_science'];
 assert.deepEqual(orderedRouteKeys(keys),['return_route','deep_science','apf_survey','direct_safe']);assert.deepEqual(keys,['direct_safe','return_route','apf_survey','deep_science']);
 assert.ok(keys.every(k=>routeVisible('all',k)));assert.deepEqual(keys.filter(k=>routeVisible('return_route',k)),['return_route']);assert.deepEqual(keys.filter(k=>routeVisible('apf_survey',k)),['apf_survey']);
 const panes=new Map(),map={getPane:k=>panes.get(k),createPane:k=>{const p={style:{}};panes.set(k,p);return p;}};
 for(const key of keys)routePane(map,key);assert.equal(panes.get(routePane(map,'direct_safe')).style.zIndex,'413');assert.equal(panes.get(routePane(map,'return_route')).style.zIndex,'410');assert.equal(panes.size,4);
});
test('distant display removes tiny bends while preserving endpoints and resolved terrain relief',()=>{
 const p=[{x:0,y:0,z:0},{x:1,y:.1,z:0},{x:2,y:0,z:0},{x:3,y:0,z:2},{x:4,y:0,z:0}],saved=JSON.stringify(p);
 const far=simplifyRouteDisplay(p,.5);assert.equal(far[0],p[0]);assert.equal(far.at(-1),p.at(-1));assert.ok(far.includes(p[3]));assert.ok(!far.includes(p[1]));
 assert.ok(simplifyRouteDisplay(p,.01).includes(p[1]));assert.equal(JSON.stringify(p),saved);
});

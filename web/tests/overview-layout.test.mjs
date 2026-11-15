import test from 'node:test';
import assert from 'node:assert/strict';
import {showOverview,walkOverviewTarget,watchOverviewLayout} from '../src/overview-layout.js';
test('the walk overview follows position at a stable scale across look changes and the date line',()=>{
 const C={Math:{toDegrees:radians=>radians*180/Math.PI}},rad=degrees=>degrees*Math.PI/180;
 const camera={positionCartographic:{longitude:rad(-179.99),latitude:rad(18.44)},heading:0,pitch:-.15};
 let centre={lng:180.01,lat:18.44},moved=0;
 const map={getCenter:()=>centre,getZoom:()=>13,distance:()=>moved};
 const first=walkOverviewTarget(camera,C,map);
 assert.ok(Math.abs(first.point[1]-180.01)<1e-9);
 assert.equal(first.zoom,13);
 assert.equal(first.unchanged,true);
 camera.heading=2;camera.pitch=1;
 assert.deepEqual(walkOverviewTarget(camera,C,map),first);
 camera.positionCartographic.longitude=rad(-179.98);moved=560;
 const next=walkOverviewTarget(camera,C,map);
 assert.ok(next.point[1]>first.point[1]);assert.equal(next.unchanged,false);
});
test('an overview is revealed before Leaflet measures it for tile and marker placement',()=>{
 const container={hidden:true},calls=[];
 showOverview({invalidateSize:options=>{assert.equal(container.hidden,false);calls.push(options);}},container);
 assert.deepEqual(calls,[{pan:false,animate:false}]);
});
test('hidden, resized and restored overviews preserve their centre and zoom without a pan',()=>{
 const node={clientWidth:0,clientHeight:0},centre={lat:23.6,lng:-99.6},calls=[];let resize,disconnected=false;
 class Observer{constructor(cb){resize=cb;}observe(){}disconnect(){disconnected=true;}}
 const map={getContainer:()=>node,getCenter:()=>centre,getZoom:()=>9,invalidateSize:options=>calls.push(['size',options]),setView:(...args)=>calls.push(['view',...args])};
 const detach=watchOverviewLayout(map,{}, {Observer});resize();assert.equal(calls.length,0);
 Object.assign(node,{clientWidth:220,clientHeight:151});resize();
 assert.deepEqual(calls,[['size',{pan:false,animate:false}],['view',centre,9,{animate:false,reset:true}]]);
 resize();assert.equal(calls.length,2);
 node.clientWidth=0;resize();node.clientWidth=220;resize();assert.equal(calls.length,4);
 node.clientWidth=150;resize();assert.equal(calls.length,6);detach();assert.equal(disconnected,true);
});

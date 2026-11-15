import test from 'node:test';
import assert from 'node:assert/strict';
import {reticlePoint,clientPoint,pickViewFocus} from '../src/view-focus.js';
import {overlayExplanation,MINERAL_SURVEY_GAPS} from '../src/overlay-explanations.js';

function canvas(bounds,marker,width,height){return {clientWidth:width,clientHeight:height,getBoundingClientRect:()=>bounds,closest:()=>({querySelector:()=>marker?{getBoundingClientRect:()=>marker}:null})};}
test('reticle and pointer use the same canvas coordinates through split layouts and CSS scaling',()=>{
 const c=canvas({left:500,top:80,width:400,height:300},{left:690,top:215,width:20,height:20},800,600);
 const point=reticlePoint(c);assert.deepEqual(point,{x:400,y:290});
 assert.deepEqual(clientPoint(c,700,225),point);
 assert.deepEqual(reticlePoint(canvas({left:0,top:0,width:400,height:300},null,400,300)),{x:200,y:150});
});
test('the crosshair ray selects displayed preview terrain consistently and does not use drawing-buffer size',()=>{
 const c=canvas({left:0,top:0,width:1000,height:600},{left:390,top:290,width:20,height:20},1000,600);c.width=500;c.height=300;
 const rays=[],C={Cartesian2:class{constructor(x,y){Object.assign(this,{x,y});}},Cartesian3:{distance:()=>1000},Math:{toDegrees:x=>x}};
 const viewer={canvas:c,camera:{getPickRay:p=>{rays.push(p);return p;},pickEllipsoid:()=>null,positionWC:{},frustum:{fovy:1}},scene:{globe:{pick:p=>({longitude:p.x,latitude:p.y}),ellipsoid:{cartesianToCartographic:p=>p}}}};
 assert.deepEqual(pickViewFocus(viewer,{C}).point,[400,300]);
 assert.deepEqual(pickViewFocus(viewer,{C,pickPreview:()=>({longitude:42,latitude:18})}).point,[42,18]);
 viewer.scene.globe.pick=()=>null;assert.equal(pickViewFocus(viewer,{C}),null);
});
test('every selectable TES mineral explanation describes survey gaps, including ambiguous glass/clay',()=>{
 for(const asset of ['olivine-abundance','pyroxene-abundance','hematite-abundance','feldspar-abundance','glass-clay']){
  assert.ok(overlayExplanation({id:'mineral-composition',engine:'reference',asset},asset).limits.includes(MINERAL_SURVEY_GAPS));
 }
});

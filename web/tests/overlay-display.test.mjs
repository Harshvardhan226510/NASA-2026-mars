import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detectionClusters,detectionBadge,detectionAt} from '../src/detection-display.js';
import {overlayColor,overlayScale} from '../src/science-style.js';
import {SCIENCE_CATALOG} from '../src/science-catalog.js';
import {referenceVariant} from '../src/reference-display.js';
import {applyLayerVisibility} from '../src/layers.js';

test('hiding moons restores selected surface overlays after the synchronous orbital-mode transition',()=>{
 const selected={moons:false,elevation:true,measurements:true,routes:true},applied=[];
 const apply=state=>applied.push(state),moons={exploring:true,setVisible(show){if(!show&&this.exploring){this.exploring=false;applyLayerVisibility(selected,this,apply);}}};
 applyLayerVisibility(selected,moons,apply);
 assert.ok(applied.length>1);for(const state of applied)assert.deepEqual(state,selected);
 const orbital={...selected,moons:true};moons.exploring=true;applyLayerVisibility(orbital,moons,apply);
 assert.deepEqual(applied.at(-1),{moons:true,elevation:false,measurements:false,routes:false});
 assert.equal(selected.elevation,true);applyLayerVisibility(selected,undefined,apply);assert.equal(applied.at(-1),selected);
});

test('dense detection catalogues keep all visible records with compact, nonoverlapping real-location anchors',()=>{
 const records=JSON.parse(readFileSync(new URL('../public/scientific/hydrated-sites.json',import.meta.url))).points;
 const project=p=>({x:(p.lon+180)*2+25,y:(90-p.lat)*2+25}),groups=detectionClusters(records,project,{width:770,height:410});
 assert.equal(groups.reduce((n,g)=>n+g.points.length,0),records.length);
 assert.deepEqual(new Set(groups.flatMap(g=>g.points)),new Set(records));
 for(let i=0;i<groups.length;i++){
  const group=groups[i],p=project(group.points[0]);assert.equal(group.x,p.x);assert.equal(group.y,p.y);
  const radius=detectionBadge(group.points.length).radius+2;assert.ok(radius<=20);
  for(const other of groups.slice(i+1)){const otherRadius=detectionBadge(other.points.length).radius+2;assert.ok(Math.hypot(group.x-other.x,group.y-other.y)>radius+otherRadius);}
 }
 const zoomed=detectionClusters(records,p=>{const v=project(p);return {x:v.x*10,y:v.y*10};},{width:7700,height:4100});assert.ok(zoomed.length>groups.length);
});
test('hidden, invalid and edge-clipped detections never produce offscreen badges',()=>{
 const points=[null,{x:NaN,y:50},{x:5,y:50},{x:50,y:1},{x:199,y:99},{x:40,y:40},{x:48,y:41}];
 const groups=detectionClusters(points,p=>p,{width:200,height:100});assert.equal(groups.length,1);assert.equal(groups[0].points.length,2);assert.deepEqual(detectionBadge(10000),{radius:18,label:'999+'});
 assert.equal(detectionAt(groups,40,40),groups[0]);assert.equal(detectionAt(groups,100,90),undefined);
});
test('scientific color scales stay fixed, preserve unknowns, and separate classes from continuous measurements',()=>{
 for(const item of SCIENCE_CATALOG.filter(x=>Number.isFinite(x.min))){
  const {min,max,id}=item;for(const v of [min,min+(max-min)/2,max]){const rgb=overlayColor(v,min,max,id);assert.equal(rgb[3],255);assert.ok(rgb.every(v=>Number.isInteger(v)&&v>=0&&v<=255));}
  assert.deepEqual(overlayColor(NaN,min,max,id),[0,0,0,0]);
  const scale=overlayScale(id,min,max);assert.ok(scale.classes||scale.background.startsWith('linear-gradient'));
 }
 assert.deepEqual(overlayColor(0,0,360,'slope-aspect'),overlayColor(360,0,360,'slope-aspect'));
 assert.deepEqual(overlayScale('slope-aspect',0,360).ticks,['N','E','S','W','N']);
 assert.deepEqual(overlayScale('terrain-data-confidence',0,1).classes.map(x=>x.label),['MOLA fallback','HRSC / MOLA']);
 assert.equal(overlayScale('terrain-accessibility-classification',0,3).classes.length,4);
 assert.deepEqual(overlayScale('relay-visibility',0,5).classes.map(x=>x.label),['0','1','2','3','4','5']);
 assert.deepEqual(overlayColor(-999,0,40,'slope-steepness'),overlayColor(0,0,40,'slope-steepness'));
 assert.deepEqual(overlayColor(999,0,40,'slope-steepness'),overlayColor(40,0,40,'slope-steepness'));
});

test('restoring a hidden component control cannot turn mineral points, feeds or other overlays into a raster',()=>{
 for(const item of SCIENCE_CATALOG){if(item.engine!=='reference'){assert.equal(referenceVariant(item,''),null);assert.equal(referenceVariant(item,'mons-weh'),null);}else if(item.variants){for(const variant of item.variants)assert.equal(referenceVariant(item,variant),variant);assert.equal(referenceVariant(item,'unpublished-component'),null);}}
 assert.equal(referenceVariant(null,''),null);
});

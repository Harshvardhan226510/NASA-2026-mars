import test from 'node:test';
import assert from 'node:assert/strict';
import {mapPinSVG,renderScale,sharpenMap} from '../src/map-marker-style.js';

test('markers use distinct vector glyphs without platform-dependent text icons',()=>{
 const kinds=['region','science','minerals','resources','rover','helicopter','lander','failed_lander','camp'];
 const icons=kinds.map(kind=>decodeURIComponent(mapPinSVG(kind).split(',')[1]));
 assert.equal(new Set(icons).size,kinds.length);
 for(const svg of icons){assert.match(svg,/viewBox="0 0 40 48"/);assert.doesNotMatch(svg,/<text|<script|https?:\/\/(?!www.w3.org)/);}
 assert.notEqual(mapPinSVG('region'),mapPinSVG('region',true));
});

test('map rendering uses laptop pixel density with a bounded canvas budget',()=>{
 assert.equal(renderScale(1440,900,1),1);
 assert.equal(renderScale(1440,900,2),2);
 assert.ok(renderScale(3840,2160,3)<=2);
 assert.ok(1920*1080*renderScale(1920,1080,3)**2<=6000001);
 for(const dpr of [NaN,Infinity,0,-1])assert.equal(renderScale(1440,900,dpr),1);
});

test('moving to another density or resizing updates rendering and can detach cleanly',()=>{
 let listener,requested=0;
 const host={devicePixelRatio:1,addEventListener:(name,fn)=>{assert.equal(name,'resize');listener=fn;},removeEventListener:(name,fn)=>{assert.equal(name,'resize');assert.equal(fn,listener);}};
 const viewer={canvas:{clientWidth:1440,clientHeight:900},scene:{requestRender:()=>requested++}};
 const detach=sharpenMap(viewer,host);
 assert.equal(viewer.resolutionScale,1);host.devicePixelRatio=2;listener();assert.equal(viewer.resolutionScale,2);assert.equal(requested,2);detach();
});

test('compatibility graphics keep a lower drawing-buffer budget after resizing',()=>{
 let resize;const host={devicePixelRatio:3,addEventListener:(_name,fn)=>resize=fn,removeEventListener:()=>{}};
 const viewer={canvas:{clientWidth:1440,clientHeight:900},scene:{postProcessStages:{fxaa:{enabled:false}},requestRender:()=>{}}};
 sharpenMap(viewer,host,{maxScale:1});assert.equal(viewer.resolutionScale,1);viewer.canvas.clientWidth=3840;resize();assert.equal(viewer.resolutionScale,1);
 assert.equal(viewer.scene.postProcessStages.fxaa.enabled,true);
});

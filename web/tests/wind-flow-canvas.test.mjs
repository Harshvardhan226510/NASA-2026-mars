import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {screenWindField,WindParticles} from '../src/wind-flow-field.js';

test('animated canvas follows visibility, pause, tint and reduced-motion lifecycle without changing source data',()=>{
 const frames=new Map();let id=0,strokes=0,moving;const context={clearRect(){},setTransform(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes++;}},canvas={style:{},dataset:{},setAttribute(){},getContext:()=>context},host={clientWidth:160,clientHeight:120,append(){},getClientRects:()=>[{}]},document={hidden:false,body:{},createElement:()=>canvas,addEventListener(){}},motion={matches:false,addEventListener(){}},observer=class{observe(){}};
 const source=readFileSync(new URL('../src/wind-flow.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function createWindFlows','function createWindFlows');
 const Flow=new Function('screenWindField','WindParticles','document','ResizeObserver','MutationObserver','matchMedia','getComputedStyle','devicePixelRatio','requestAnimationFrame','cancelAnimationFrame',source+';return WindFlowCanvas;')(screenWindField,WindParticles,document,observer,observer,()=>motion,()=>({visibility:'visible'}),1,fn=>{frames.set(++id,fn);return id;},key=>frames.delete(key));
 const grid={nlon:4,nlat:3,lons:[45,135,225,315],lats:[-60,0,60],east:Array(12).fill(6),north:Array(12).fill(8)},original=JSON.stringify(grid),flow=new Flow({host,locate:(x,y)=>[x-80,60-y],project:(lon,lat)=>[lon+80,60-lat],subscribe:fn=>{moving=fn;}}),step=time=>{const [key,fn]=frames.entries().next().value;frames.delete(key);fn(time);};
 flow.setData(grid);flow.setEnabled(true);step(100);assert.ok(Number(canvas.dataset.particles)>0);assert.ok(Number(canvas.dataset.segments)>0);assert.ok(strokes>=6&&strokes<28);step(150);assert.equal(canvas.dataset.frames,'2');assert.equal(frames.size,1);
 moving(true);assert.equal(frames.size,0);moving(false);assert.equal(frames.size,1);step(200);flow.setOpacity(0);assert.equal(frames.size,0);flow.setOpacity(.65);assert.equal(frames.size,1);step(250);
 document.hidden=true;flow.invalidate();assert.equal(frames.size,0);document.hidden=false;motion.matches=true;flow.invalidate();step(300);assert.equal(frames.size,0);assert.ok(Number(canvas.dataset.segments)>0);
 flow.setEnabled(false);assert.equal(canvas.hidden,true);assert.equal(frames.size,0);assert.equal(JSON.stringify(grid),original);
});

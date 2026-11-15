import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {graphicsOptions,startGraphics,GraphicsStartupError,recoveryURL,watchGraphics,showGraphicsRecovery} from '../src/graphics-startup.js';
import {basicDestinations,basicSelection} from '../src/basic-map-data.js';

test('a failed graphics allocation retries lighter contexts, cleaning each failed canvas',async()=>{
 const tried=[],delays=[];let cleared=0;const viewer={id:1};
 const result=await startGraphics((options,mode)=>{tried.push(mode);assert.equal(options.showRenderLoopErrors,false);if(mode!=='webgl1')throw Error('The browser supports WebGL, but initialization failed.');return viewer;},{clear:()=>cleared++,wait:async ms=>delays.push(ms)});
 assert.deepEqual(tried,['standard','compatible','webgl1']);assert.equal(cleared,2);assert.deepEqual(delays,[250,250]);assert.equal(result.viewer,viewer);assert.equal(result.mode,'webgl1');
 assert.equal(graphicsOptions('compatible').contextOptions.webgl.antialias,false);assert.equal(graphicsOptions('compatible').contextOptions.webgl.stencil,true);assert.equal(graphicsOptions('webgl1').contextOptions.requestWebgl1,true);
});

test('unsupported graphics have a bounded failure, while programming errors are not retried',async()=>{
 let attempts=0,cleared=0;
 await assert.rejects(startGraphics(()=>{attempts++;throw Error('WebGL unavailable');},{clear:()=>cleared++,wait:async()=>{}}),e=>e instanceof GraphicsStartupError&&e.attempts.length===3&&e.cause.message==='WebGL unavailable');
 assert.equal(attempts,3);assert.equal(cleared,3);
 const bug=new TypeError('Invalid map configuration');attempts=0;
 await assert.rejects(startGraphics(()=>{attempts++;throw bug;},{wait:async()=>{}}),e=>e===bug);assert.equal(attempts,1);
 const modes=[];await startGraphics((_options,mode)=>{modes.push(mode);return {};},{compatible:true});assert.deepEqual(modes,['compatible']);
});

test('retry and basic-map links preserve saved mission hashes and other URL parameters',()=>{
 const url='https://mars-atlas-orbit.vercel.app/?example=1#mission=abc123';
 const basic=new URL(recoveryURL(url,true));assert.equal(basic.searchParams.get('map'),'basic2d');assert.equal(basic.hash,'#mission=abc123');assert.equal(basic.searchParams.get('example'),'1');
 const retry=new URL(recoveryURL(basic.href));assert.equal(retry.searchParams.has('map'),false);assert.equal(retry.searchParams.get('graphics'),'compatible');assert.equal(retry.hash,basic.hash);assert.equal(retry.origin,basic.origin);
});

test('context loss stops the render loop once and gives the application a recovery signal',()=>{
 let contextListener,renderListener,prevented=0,failures=0,detached=0;
 const viewer={useDefaultRenderLoop:true,canvas:{addEventListener:(_name,fn)=>contextListener=fn,removeEventListener:(_name,fn)=>{assert.equal(fn,contextListener);detached++;}},scene:{renderError:{addEventListener:fn=>{renderListener=fn;return()=>detached++;}}}};
 const remove=watchGraphics(viewer,e=>{assert.match(e.message,/WebGL/);failures++;});
 contextListener({preventDefault:()=>prevented++});renderListener(null,Error('Later render error'));assert.equal(viewer.useDefaultRenderLoop,false);assert.equal(prevented,1);assert.equal(failures,1);remove();assert.equal(detached,2);
});

test('the recovery panel clears pending startup, offers real recovery links and treats diagnostics as text',()=>{
 class Node{
  constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.classList={add:()=>{}};}
  append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this.attributes[k]=v;}get firstElementChild(){return this.children[0];}focus(){this.focused=true;}
 }
 const body=new Node('body'),workspace=new Node('main');workspace.id='workspace';body.append(workspace);
 const walk=n=>[n,...n.children.flatMap(walk)];let signals=0;
 const doc={body,createElement:tag=>new Node(tag),getElementById:id=>walk(body).find(n=>n.id===id),dispatchEvent:e=>{assert.equal(e.type,'atlas-startup-error');signals++;}};
 const old=console.error;console.error=()=>{};
 try{showGraphicsRecovery(Error('WebGL <script> must remain text'),{document:doc,location:{href:'https://mars-atlas-orbit.vercel.app/#region=JEZERO'}});showGraphicsRecovery(Error('again'),{document:doc,location:{href:'https://mars-atlas-orbit.vercel.app/'}});}
 finally{console.error=old;}
 assert.equal(signals,1);assert.equal(workspace.children.length,1);
 const nodes=walk(workspace),links=nodes.filter(n=>n.tagName==='a');assert.equal(links.length,2);assert.equal(links[0].focused,true);assert.match(links[1].href,/map=basic2d/);assert.match(links[0].href,/#region=JEZERO/);assert.equal(nodes.find(n=>n.tagName==='pre').textContent,'WebGL <script> must remain text');
});

test('the basic map retains valid places and sourced spacecraft, including saved selection',()=>{
 const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
 const entries=basicDestinations(json('../public/regions.json'),json('../public/spacecraft/catalog.json').objects);
 assert.equal(entries.filter(e=>e.item).length,15);
 assert.equal(basicSelection('#spacecraft=curiosity',entries).name,'Curiosity');assert.ok(basicSelection('#region=JEZERO',entries));
 assert.deepEqual(basicSelection('#region=COORDINATES&lon=497&lat=-4.8',entries),{point:[137,-4.8],zoom:7});
 for(const hash of ['#region=COORDINATES&lon=0&lat=95','#region=COORDINATES&lon=&lat=0','#spacecraft=mro'])assert.equal(basicSelection(hash,entries),null);
 assert.deepEqual(basicDestinations({regions:[null,{id:'bad',name:'Bad',center:[NaN,0]}]},[null,{domain:'mars_orbit'}]),[]);
});

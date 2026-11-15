import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseAtlasCommand,runAtlasCommand} from '../src/atlas-commands.js';
import {atlasDataDescription} from '../src/atlas-context.js';
import {dustInputs,manualDustInputs,requireNASAClimate} from '../src/dust-inputs.js';
import {assessRouteConditions,loadRouteWinds} from '../src/route-conditions.js';
import {loadReference} from '../src/scientific-data.js';
import {referencePyramid} from '../src/reference-display.js';
import {scientificPixels} from '../src/scientific-pixels.js';
import {scienceTile} from '../src/science-tile-cache.js';
import {geographicDetectionGroups,projectDetectionGroups} from '../src/detection-display.js';
import {VISIBLE_SCIENCE_CATALOG} from '../src/science-catalog.js';
const at='2026-10-26T10:00:00.000Z';
const wind=(time=at)=>({schema:'mars-wind/1',kind:'modeled_climatology',model_time:time,provenance:[{url:'https://psg.gsfc.nasa.gov/apps/mars/'}],lons:[0,120,240],lats:[-60,0,60],nlon:3,nlat:3,east:Array(9).fill(3),north:Array(9).fill(4)});
const environment=()=>({...wind(),schema:'mars-environment/1',parameter:'Dust',values:Array(9).fill(.35)});

test('Ares layer commands share bounded actions and consolidate mineral variants',async()=>{
 assert.deepEqual(parseAtlasCommand('Please apply wind speed layer'),{type:'layer',key:'wind-speed',variant:undefined,show:true,label:'Wind speed · EMARS climatology'});
 assert.equal(parseAtlasCommand('Turn off slope steepness overlay').show,false);
 assert.equal(parseAtlasCommand('Apply olivine').key,'mineral-composition');assert.equal(parseAtlasCommand('Apply olivine').variant,'olivine-abundance');
 assert.equal(parseAtlasCommand('Apply interplanetary magnetic field').key,'interplanetary-magnetic-field');
 assert.equal(parseAtlasCommand('Apply heliospheric magnetic connectivity').type,'unavailable');assert.equal(parseAtlasCommand('eval window.location'),null);
 const calls=[];await runAtlasCommand(parseAtlasCommand('Hide pins'),{layer:(...v)=>calls.push(v)});assert.equal(calls.length,7);assert.ok(calls.every(v=>v[1]===false));
 const command=parseAtlasCommand('Run dust model latitude -42.5 longitude 70 wind 20 elevation -7 ls 250 ltst 15');assert.deepEqual(command.target,{lat:-42.5,lon:70,windMps:20,elevationKm:-7,ls:250,ltst:15});
 assert.equal(VISIBLE_SCIENCE_CATALOG.some(x=>['olivine-abundance','mafic-mineral-composition','terrain-shielding-potential-sky-obstruction'].includes(x.id)),false);
});

test('dust inputs use exact NASA source hours and leave unavailable polar wind and elevation unknown',async()=>{
 const paths=[];const fetcher=async url=>{paths.push(url);return Response.json(url.startsWith('/api/wind')?wind():environment());};
 const p=await dustInputs([70,-42],{at,fetcher,elevation:async()=>({height:-7000,source:'NASA MOLA'})});
 assert.equal(p.windMps,5);assert.equal(p.elevationKm,-7);assert.equal(p.contextDust,.35);assert.ok(Number.isFinite(p.ls)&&Number.isFinite(p.ltst));assert.ok(paths.every(x=>x.includes(encodeURIComponent(at))));assert.match(p.inputNote,/not live observations/);
 const polar=await dustInputs([70,-90],{at,fetcher});assert.equal(polar.windMps,null);assert.equal(polar.elevationKm,null);assert.equal(polar.contextDust,null);
 const outage=await dustInputs([70,0],{at,fetcher:async()=>{throw Error('offline');}});assert.equal(outage.windMps,null);assert.equal(outage.contextDust,null);
 assert.throws(()=>requireNASAClimate({...wind(),kind:'observation'},'mars-wind/1',at));assert.throws(()=>requireNASAClimate({...wind(),model_time:'2020-01-01'},'mars-wind/1',at));assert.throws(()=>requireNASAClimate({...wind(),provenance:[{url:'https://nasa.gov.evil.test/'}]},'mars-wind/1',at));
 const c=new AbortController();c.abort();await assert.rejects(dustInputs([0,0],{at,fetcher,signal:c.signal}),e=>e.name==='AbortError');
});

test('manual dust scenarios validate every override and keep model context distinct',()=>{
 assert.throws(()=>manualDustInputs({}, {lat:91}));assert.throws(()=>manualDustInputs({}, {windMps:'20'}));assert.throws(()=>manualDustInputs({}, {windMps:NaN}));
 const p=manualDustInputs({contextDust:.35},{lat:-42,lon:70,windMps:20});assert.equal(p.kind,'manual_scenario');assert.equal(p.input_origins.windMps,'user scenario');assert.equal(p.contextDust,.35);assert.match(p.inputNote,/not NASA observations/);
});

test('arrival-condition screening uses matching source hours and explicit scenario limits, never a zero for missing wind',async()=>{
 const points=[{lon:0,lat:0,at,solar_elevation_deg:35,light:'no_local_shadow'},{lon:0,lat:90,at,solar_elevation_deg:null,light:'unknown'}];
 const r=assessRouteConditions(points,new Map([[at,wind()]]),{maxWindMps:4,minSunDegrees:0});assert.equal(r.samples[0].wind_mps,5);assert.deepEqual(r.samples[0].violations,['wind']);assert.equal(r.samples[1].wind_mps,null);assert.equal(r.unknownCount,1);assert.equal(r.night_count,0);assert.equal(r.status,'unknown');
 assert.equal(assessRouteConditions(points.slice(0,1),new Map([[at,wind()]]),{maxWindMps:6,minSunDegrees:0}).status,'within_scenario');
 assert.equal(assessRouteConditions([{...points[0],light:'local_shade'}],new Map([[at,wind()]]),{minSunDegrees:0}).violationCount,1);
 assert.throws(()=>assessRouteConditions([],new Map(),{maxWindMps:-1}));
 let calls=0;const loaded=await loadRouteWinds([points[0],points[0]],{fetcher:async()=>{calls++;return Response.json(wind());}});assert.equal(calls,1);assert.equal(loaded.size,1);
 const failed=await loadRouteWinds(points,{fetcher:async()=>Response.json({...wind(),model_time:'2026-10-25T10:00:00.000Z'})});assert.equal(failed.size,0);
});

test('Ares describes the loaded measurement rather than fabricating telemetry',()=>{
 const text=atlasDataDescription({query:'what is wind speed here',point:[70,-42],wind:wind()});assert.match(text,/5.00 m\/s/);assert.match(text,/modeled climatology/);assert.match(text,/not continuous rover telemetry/);
 assert.match(atlasDataDescription({query:'wind speed',point:[70,-90],wind:wind()}),/no model coverage/);
});

test('raster pixels have identical shared edges and preserve unknown source masks',async()=>{
 const item={id:'test',engine:'reference'},make=bounds=>scientificPixels(item,{sample:(x,y)=>x>2?NaN:x+y,style:{min:-10,max:10},bounds,size:33});
 const a=await make([-1,-1,1,1]),b=await make([1,-1,3,1]);for(let y=0;y<33;y++)assert.deepEqual(a.slice((y*33+32)*4,(y*33+33)*4),b.slice(y*33*4,y*33*4+4));
 assert.equal(b[(16*33+32)*4+3],0);assert.equal(a[(16*33+16)*4+3],255);
 const plane=await scientificPixels({id:'slope-steepness',engine:'terrain',metric:'slope'},{sample:(x,y)=>x*100+y*40,spacing:15000,style:{min:0,max:40},bounds:[-180,-90,0,90],size:65});assert.ok(plane.filter((v,i)=>i%4===3&&v===255).length>3900);
 const c=new AbortController();c.abort();await assert.rejects(make([0,0,1,1]).then(()=>scientificPixels(item,{signal:c.signal})),e=>e.name==='AbortError');
});

test('verified reference and display caches reuse completed data and still honour cancellation',async()=>{
 const raw=new Float32Array([1,2,3,4]).buffer,item={file:'test.f32',packet_sha256:createHash('sha256').update(new Uint8Array(raw)).digest('hex'),width:2,height:2,bounds:[-180,-90,180,90]};let calls=0;
 const fetchImpl=async()=>{calls++;return new Response(raw);};const grid=await loadReference(item,{fetchImpl,cache:true});assert.equal(await loadReference(item,{fetchImpl,cache:true}),grid);assert.equal(calls,1);
 const levels=await referencePyramid(grid);assert.equal(await referencePyramid(grid),levels);const c=new AbortController();c.abort();await assert.rejects(referencePyramid(grid,c.signal),e=>e.name==='AbortError');await assert.rejects(loadReference(item,{fetchImpl,cache:true,signal:c.signal}),e=>e.name==='AbortError');
 let rendered=false;await assert.rejects(scienceTile('x',()=>{rendered=true;},{signal:c.signal}),e=>e.name==='AbortError');assert.equal(rendered,false);
});

test('globe detection cells keep their membership when the projection rotates',()=>{
 const records=[{lon:10,lat:10,id:1},{lon:11,lat:11,id:2},{lon:21,lat:10,id:3}],groups=geographicDetectionGroups(records);
 const a=projectDetectionGroups(groups,p=>({x:p.lon+40,y:p.lat+40}),{width:500,height:500}),b=projectDetectionGroups(groups,p=>({x:p.lon+90,y:p.lat+40}),{width:500,height:500});assert.deepEqual(a.map(g=>g.points.map(p=>p.id)),b.map(g=>g.points.map(p=>p.id)));assert.equal(a.flatMap(g=>g.points).length,records.length);
});

test('cancelled Cesium imagery releases its consumer without waiting on an obsolete source transfer',async()=>{
 const {scheduledImage,abortableResult}=await import('../src/scheduled-image.js');const request={},C={RequestScheduler:{request:r=>r.requestFunction()}};let complete;
 const result=scheduledImage(C,request,'https://local.test/tile',signal=>abortableResult(new Promise(resolve=>complete=resolve),signal));request.cancelFunction();await assert.rejects(result,e=>e.name==='AbortError');complete('shared source still usable');
});

test('a pending fine overlay keeps measured coarse shading and cannot be overwritten by a late coarse result',async()=>{
 const {progressiveImage}=await import('../src/progressive-image.js');let finish;const images=[];const pending=progressiveImage(new Promise(resolve=>finish=resolve),Promise.resolve('MOLA'),(...x)=>images.push(x));await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(images,[['MOLA',true]]);finish('HRSC');await pending;assert.deepEqual(images,[['MOLA',true],['HRSC',false]]);
 const later=[];await progressiveImage(Promise.resolve('HRSC'),new Promise(resolve=>setImmediate(()=>resolve('MOLA'))),x=>later.push(x));assert.deepEqual(later,['HRSC']);
 const fallback=[];await progressiveImage(Promise.reject(Error('fine source outage')),Promise.resolve('MOLA'),x=>fallback.push(x));assert.deepEqual(fallback,['MOLA']);
});


test('old saved standalone overlays migrate into the visible combined controls',async()=>{
 const {restoreLayerSelection,layerSelection}=await import('../src/layers.js');const minerals=restoreLayerSelection({'pyroxene-abundance':true});assert.equal(minerals['mineral-composition'],true);assert.equal(minerals['pyroxene-abundance'],false);assert.equal(layerSelection(minerals,'mineral-composition',false)['mineral-composition'],false);
 const sky=restoreLayerSelection({'terrain-shielding-potential-sky-obstruction':true});assert.equal(sky['topographic-sky-visibility'],true);assert.equal(sky['terrain-shielding-potential-sky-obstruction'],false);
});

test('Sunlight space-weather context can remain selected with a surface raster',async()=>{
 const {layerSelection,allLayerSelection}=await import('../src/layers.js');let state=layerSelection({},'slope-steepness',true);state=layerSelection(state,'solar-flare-observations',true);assert.equal(state['slope-steepness'],true);assert.equal(state['solar-flare-observations'],true);state=layerSelection(state,'solar-wind-speed',true);assert.equal(state['solar-flare-observations'],false);assert.equal(state['slope-steepness'],true);assert.equal(allLayerSelection(state,false)['solar-wind-speed'],false);
});


test('background PNG encoding never blocks a visible science tile',async()=>{
 const old={caches:globalThis.caches,location:globalThis.location,bitmap:globalThis.createImageBitmap};globalThis.caches={open:async()=>({match:async()=>null})};globalThis.location={origin:'http://local.test'};globalThis.createImageBitmap=()=>{};let encode;const canvas={toBlob:callback=>encode=callback};
 try{assert.equal(await scienceTile('nonblocking-png',async()=>canvas,{persistent:true}),canvas);assert.equal(typeof encode,'function');encode(null);}finally{for(const [key,value]of [['caches',old.caches],['location',old.location],['createImageBitmap',old.bitmap]]){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('dated wind service coalesces the requested hour and rejects a mismatched source clock',async()=>{
 const {createDatedWindService}=await import('../api/wind.mjs');let calls=0;const store={get:async()=>null,set:async()=>{}};const serve=createDatedWindService({store,read:async({now})=>{calls++;await new Promise(resolve=>setImmediate(resolve));return {...wind(new Date(now).toISOString()),health:{state:'ok'}};}});const [a,b]=await Promise.all([serve(at),serve(at)]);assert.equal(a,b);assert.equal(calls,1);assert.equal((await serve(at)).model_time,at);assert.equal(calls,1);
 const wrong=createDatedWindService({store,read:async()=>wind('2020-01-01T00:00:00.000Z')});await assert.rejects(wrong(at),/confirm/);
});

test('signed display scales reveal small curvature without whitening zero or changing source values',async()=>{
 const {overlayColor}=await import('../src/science-style.js');const zero=overlayColor(0,-1,1,'terrain-curvature'),small=overlayColor(.0001,-1,1,'terrain-curvature');assert.ok(Math.max(...zero.slice(0,3))<120);assert.ok(small.slice(0,3).some((v,i)=>Math.abs(v-zero[i])>35));assert.deepEqual(overlayColor(NaN,-1,1,'terrain-curvature'),[0,0,0,0]);
});

test('contour raster paths preserve measured levels and never bridge missing elevations',async()=>{
 const {contourPaths,contourInterval}=await import('../src/contour-raster.js');const grid=new Float32Array([0,100,200,0,100,200,0,100,200]),paths=contourPaths(grid,3,[0,0,2,2],100,512);assert.ok(paths.length);for(const path of paths)for(const [x,y]of path.points){assert.ok(x>=0&&x<=511&&y>=0&&y<=511);assert.ok(Math.abs(x/511*200-path.height)<1e-8);}assert.deepEqual(contourPaths(new Float32Array(9).fill(NaN),3,[0,0,2,2],100),[]);assert.equal(contourInterval(100,0),2000);assert.equal(contourInterval(100,7),100);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {windHour,windForm,windMetadata,normalizeWind,sampleWind,windStatus,WIND_SOURCE,WIND_GRID} from '../src/wind-data.js';
import {windImage} from '../src/wind-image.js';
import {windColor,projectedWind,screenWindField,sampleFlow,WindParticles} from '../src/wind-flow-field.js';
import {collectWind} from '../science/wind.mjs';
import {createWindService} from '../api/wind.mjs';
import {SCIENCE_CATALOG} from '../src/science-catalog.js';
const root=new URL('../data/wind/',import.meta.url),seed=JSON.parse(readFileSync(new URL('bootstrap.json',root))),NOW=Date.parse('2026-10-18T17:20:00Z');
const fixture=()=>({header:{param:'Wind',unit:'km/h',nlon:4,nlat:3,lons:[45,135,225,315],lats:[-60,0,60]},data:new Array(12).fill(10.8),vector:new Array(12).fill(14.4)});
const imageData=class{constructor(data,width,height){Object.assign(this,{data,width,height});}};
const canvas=()=>{const c={width:0,height:0,strokes:0},ctx={putImageData:image=>{c.image=image;},beginPath(){},moveTo(){},lineTo(){},stroke(){c.strokes++;}};c.getContext=()=>ctx;return c;};
test('wind time/form contract includes the location trigger and verifies the provider echo',()=>{
 assert.equal(windHour(NOW),'2026-10-18T17:00:00.000Z');const form=windForm(windHour(NOW));assert.equal(form.get('location'),'Syrtis Major');assert.equal(form.get('model'),'EMARS');assert.equal(form.get('datetime'),'17:00');
 const source=seed.provenance.find(p=>p.url===WIND_SOURCE),html=readFileSync(new URL('raw/'+source.sha256+'.txt',root),'utf8'),meta=windMetadata(html,seed.model_time);assert.equal(meta.source_mars_year,32);assert.equal(meta.observation_time,null);assert.equal(meta.height_m,null);assert.throws(()=>windMetadata(html,'2000-01-01T00:00:00.000Z'),/confirm/);assert.throws(()=>windMetadata(html.replace('Climatological data based on','Unknown product'),seed.model_time),/identity/);
});
test('units and vector components remain physical; missing values never become calm wind',()=>{
 const packet=normalizeWind(fixture(),{model_time:windHour(NOW)}),value=sampleWind(packet,45,0);assert.ok(Math.abs(value.speed-5)<1e-12);assert.ok(Math.abs(value.bearing_to-36.8698976458)<1e-8);assert.equal(packet.kind,'modeled_climatology');
 const calm=fixture();calm.data.fill(0);calm.vector.fill(0);assert.deepEqual(sampleWind(normalizeWind(calm,{}),45,0),{east:0,north:0,speed:0,bearing_to:null});
 const missing=fixture();missing.data[4]=null;const unknown=normalizeWind(missing,{});assert.equal(unknown.east[4],null);assert.equal(sampleWind(unknown,45,0),null);assert.ok(sampleWind(unknown,135,0));
 const wrong=fixture();wrong.header.unit='m/s';assert.throws(()=>normalizeWind(wrong,{}),/units/);wrong.header.unit='km/h';wrong.header.lats.reverse();assert.throws(()=>normalizeWind(wrong,{}),/axis/);
});
test('wind interpolation is periodic, uses actual latitude coordinates and never extrapolates polar caps',()=>{
 const packet=normalizeWind(fixture(),{});for(let i=0;i<packet.east.length;i++)packet.east[i]=(i%4)+1;
 assert.deepEqual(sampleWind(packet,-180,12),sampleWind(packet,180,12));assert.deepEqual(sampleWind(packet,0,12),sampleWind(packet,360,12));assert.ok(sampleWind(packet,0,60));assert.equal(sampleWind(packet,0,60.001),null);assert.equal(sampleWind(packet,0,-90),null);
 for(const [i,lon] of seed.lons.entries())for(const [j,lat] of seed.lats.entries()){const value=sampleWind(seed,lon,lat),k=j*seed.nlon+i;assert.ok(Math.abs(value.east-seed.east[k])<1e-10);assert.ok(Math.abs(value.north-seed.north[k])<1e-10);}
});
test('wind image tiles share exact edge pixels, preserve source masks and use NASA speed colors',()=>{
 const west=windImage(seed,0,0,0,{arrows:false,canvas:canvas(),ImageDataClass:imageData}),east=windImage(seed,1,0,0,{arrows:false,canvas:canvas(),ImageDataClass:imageData});
 for(let row=0;row<256;row++)for(let ch=0;ch<4;ch++)assert.equal(west.image.data[(row*256+255)*4+ch],east.image.data[row*256*4+ch]);
 assert.equal(west.image.data[3],0);assert.ok(west.image.data.some((v,i)=>i%4===3&&v===255));assert.equal(west.strokes,0);
 const value=sampleWind(seed,-90,0),pixel=windImage(seed,0,0,1,{canvas:canvas(),ImageDataClass:imageData});assert.ok(value);assert.ok(pixel.image.data.some((v,i)=>i%4===3&&v===255));
});

test('NASA wind colors match its trigonometric scale without clipping numerical data',()=>{
 assert.deepEqual(windColor(0),[0,0,255,255]);assert.deepEqual(windColor(50/3.6),[0,255,0,255]);assert.deepEqual(windColor(100/3.6),[255,0,0,255]);assert.deepEqual(windColor(200/3.6),windColor(100/3.6));assert.deepEqual(windColor(NaN),[0,0,0,0]);assert.ok(seed.maximum_speed*3.6>100);
});

test('flow projection follows east/north vectors under map rotation and keeps missing poles unknown',()=>{
 const grid=normalizeWind(fixture(),{}),p=projectedWind(grid,[0,0],(lon,lat)=>[lon,-lat]);assert.ok(Math.abs(p[0]-4.95)<1e-10);assert.ok(Math.abs(p[1]+6.6)<1e-10);
 const rotated=projectedWind(grid,[0,0],(lon,lat)=>[lat,lon]);assert.ok(Math.abs(rotated[0]-6.6)<1e-10);assert.ok(Math.abs(rotated[1]-4.95)<1e-10);assert.equal(projectedWind(grid,[0,80],(x,y)=>[x,y]),null);assert.equal(projectedWind(grid,[0,0],()=>null),null);
});

test('screen-space particles follow the vector field and never bridge unknown pixels or the limb',()=>{
 const grid=normalizeWind(fixture(),{}),locate=(x,y)=>x>10&&x<150&&y>10&&y<110?[x-80,60-y]:null,field=screenWindField(grid,160,120,locate,(lon,lat)=>[lon+80,60-lat],10);
 assert.equal(sampleFlow(field,0,0),null);assert.equal(sampleFlow(field,159,119),null);assert.ok(sampleFlow(field,80,60));
 let seedValue=42;const random=()=>((seedValue=(seedValue*1664525+1013904223)>>>0)/2**32),particles=new WindParticles(field,random);let count=0;
 for(let i=0;i<200;i++)particles.advance(.04,(x,y,a,b)=>{count++;assert.ok(a>x&&b<y);assert.ok(sampleFlow(field,x,y));assert.ok(sampleFlow(field,a,b));assert.ok(Math.hypot(a-x,b-y)<1);});assert.ok(count>1000);assert.ok(particles.particles.length<=5500);
 const missing={...grid,east:grid.east.map(()=>null),north:grid.north.map(()=>null)},empty=screenWindField(missing,160,120,locate,(x,y)=>[x,y]);assert.equal(new WindParticles(empty).particles.length,0);
});
test('fresh NASA requests send the same explicit form to metadata and grid routes',async()=>{
 const html=readFileSync(new URL('raw/'+seed.provenance[0].sha256+'.txt',root),'utf8'),raw=readFileSync(new URL('raw/'+seed.provenance[1].sha256+'.txt',root),'utf8'),calls=[],saved=[];
 const packet=await collectWind({now:Date.parse(seed.model_time),fetcher:async(url,options)=>{calls.push({url,options});return new Response(url===WIND_SOURCE?html:raw);},onRaw:async item=>saved.push(item)});
 assert.deepEqual(calls.map(c=>c.url),[WIND_SOURCE,WIND_GRID]);assert.equal(calls[0].options.body,calls[1].options.body);assert.equal(calls[0].options.redirect,'error');assert.equal(saved.length,2);assert.equal(packet.kind,'modeled_climatology');assert.equal(packet.observation_time,null);assert.equal(packet.model_time,seed.model_time);
});
test('current-hour caching coalesces callers; outages preserve the original model clock and back off',async()=>{
 let calls=0,now=NOW,fail=false;const entries=new Map(),store={get:async k=>entries.get(k),set:async(k,v)=>entries.set(k,v)},read=async()=>{calls++;await new Promise(r=>setTimeout(r,1));if(fail)throw Error('source unavailable');return {...seed,model_time:windHour(now),health:{state:'ok'}};},serve=createWindService({store,read,seed,clock:()=>now});
 const [a,b]=await Promise.all([serve(),serve()]);assert.equal(calls,1);assert.equal(a.model_time,b.model_time);now+=100000;await serve();assert.equal(calls,1);now+=3600000;fail=true;const fallback=await serve();assert.equal(fallback.model_time,a.model_time);assert.equal(fallback.health.state,'cached_fallback');assert.match(windStatus(fallback,now),/Cached/);await serve();assert.equal(calls,2);
 const unavailable=createWindService({store:{get:async()=>null,set:async()=>{}},read,seed:null,clock:()=>now});assert.equal((await unavailable()).health.state,'unavailable');now+=901000;assert.equal((await unavailable()).health.state,'unavailable');
});
test('wind release evidence is byte-pinned, correctly labelled, and independent of radiation forecasts',()=>{
 for(const p of seed.provenance){const raw=readFileSync(new URL('raw/'+p.sha256+'.txt',root));assert.equal(createHash('sha256').update(raw).digest('hex'),p.sha256);}
 const item=SCIENCE_CATALOG.find(i=>i.id==='wind-speed');assert.equal(item.engine,'wind');assert.equal(item.group,9);assert.equal(item.type,'dynamic');assert.match(item.coverage,/not live weather measurements/);assert.equal(item.recommended,false);assert.equal(seed.usable_for_mission_safety,false);assert.equal(seed.nlon*seed.nlat,2160);
});

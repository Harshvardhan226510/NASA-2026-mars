import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeEnvironment,sampleEnvironment,deriveEnvironment,environmentTime,environmentMetadata} from '../src/environment-data.js';
import {marsSun,solarAt} from '../src/solar-geometry.js';
import {solarTerrain} from '../src/terrain-metrics.js';
import {normalizeContext,CONTEXT_URLS} from '../src/space-weather-context.js';
import {allowedSource,collectFeed} from '../science/space-weather.mjs';
import {createEnvironmentService} from '../api/environment.mjs';
import {SCIENCE_CATALOG} from '../src/science-catalog.js';
const at='2026-10-18T21:00:00.000Z',meta={model_time:at,model_label:'EMARS MY32 Moderate dust'},fixture=(parameter,unit,value)=>({header:{param:parameter,unit,nlon:4,nlat:3,lons:[45,135,225,315],lats:[-60,0,60]},data:new Array(12).fill(value)});
test('environment grids preserve source units, missing neighbors, periodic longitude and unsampled polar caps',()=>{
 const grid=normalizeEnvironment(fixture('Psurf','Pa',700),'Psurf',meta);assert.equal(sampleEnvironment(grid,-1,0),700);assert.equal(sampleEnvironment(grid,359,0),700);assert.equal(sampleEnvironment(grid,0,89),null);grid.values[0]=null;assert.equal(sampleEnvironment(grid,0,-50),null);assert.throws(()=>normalizeEnvironment(fixture('Psurf','mbar',7),'Psurf',meta),/units/);assert.throws(()=>environmentTime('2035-01-01'),/2000/);assert.equal(grid.kind,'modeled_climatology');assert.equal(grid.usable_for_mission_safety,false);
});
test('derived quantities require matching model/time and retain dimensional assumptions',()=>{
 const pressure=normalizeEnvironment(fixture('Psurf','Pa',744.152),'Psurf',meta),air=normalizeEnvironment(fixture('Tair','K',200),'Tair',meta),surface=normalizeEnvironment(fixture('Tsurf','K',250),'Tsurf',meta);
 assert.ok(Math.abs(deriveEnvironment('column',[pressure]).values[0]-200)<1e-9);assert.ok(Math.abs(deriveEnvironment('density',[pressure,air]).values[0]-.019694897311)<1e-8);assert.ok(Math.abs(deriveEnvironment('thermal',[surface]).values[0]-221.4990007)<1e-6);
 assert.throws(()=>deriveEnvironment('density',[pressure,{...air,model_time:'2026-10-18T20:00:00.000Z'}]),/match/);pressure.values[0]=null;assert.equal(deriveEnvironment('column',[pressure]).values[0],null);assert.match(deriveEnvironment('density',[pressure,air]).assumptions,/unspecified/);
});
test('solar geometry reproduces both published NASA Mars24 worked examples',()=>{
 const sun=marsSun('2000-01-06T00:00:00Z');assert.ok(Math.abs(sun.mst-23.99425)<1e-5);assert.ok(Math.abs(sun.ls-277.18758)<1e-4);assert.ok(Math.abs(sun.declination+25.22825)<1e-4);assert.ok(Math.abs(sun.distance_au-1.39358)<1e-5);assert.ok(Math.abs(solarAt(sun,0,0).elevation-(90-154.26182))<1e-4);assert.ok(Math.abs(solarAt(sun,0,0).azimuth-191.03905)<1e-4);
 const spirit=marsSun('2004-01-03T13:46:31Z');assert.ok(Math.abs(spirit.mst-13.16537)<1e-5);assert.ok(Math.abs(spirit.ls-327.32416)<1e-4);
 const p=solarAt(spirit,175.298,-14.64);assert.ok(p.illumination===0);const day=solarAt(sun,sun.subsolar_lon,sun.declination);assert.ok(day.elevation>89);assert.ok(Math.abs(solarAt(sun,-180,0).elevation-solarAt(sun,180,0).elevation)<1e-10);
});
test('solar terrain uses physical elevations and a bounded horizon; missing elevations remain unknown',()=>{
 const sun={subsolar_lon:0,declination:0,mst:12,eot:0};assert.ok(solarTerrain(()=>0,0,0,100,sun)>.999);assert.equal(solarTerrain(()=>0,180,0,100,sun),0);assert.ok(Number.isNaN(solarTerrain(()=>NaN,0,0,100,sun)));
 const lowSun={...sun,subsolar_lon:85};assert.equal(solarTerrain(lon=>lon>.001?1000:0,0,0,100,lowSun),0);
});
test('environment service coalesces requests, keeps failed-time coverage unknown and never substitutes another hour',async()=>{
 let count=0;const store={async get(){},async set(){}},packet=normalizeEnvironment(fixture('Psurf','Pa',700),'Psurf',meta),serve=createEnvironmentService({store,clock:()=>Date.parse(at),read:async(_,{at:time})=>{count++;await new Promise(r=>setTimeout(r,5));if(time!==at)throw Error();return {...packet,health:{state:'ok'}};}});
 const [a,b]=await Promise.all([serve('Psurf',at),serve('Psurf',at)]);assert.equal(count,1);assert.equal(a,b);const missing=await serve('Psurf','2026-10-18T20:00:00Z');assert.equal(missing.health.state,'unavailable');assert.equal(missing.values,undefined);assert.equal(missing.model_time,'2026-10-18T20:00:00.000Z');
});
test('NOAA adapters separate Earth context, preserve flags and reject unqualified measurements',()=>{
 const rows=[{time_tag:'2026-10-18T20:00:00',active:true,source:'SOLAR1',overall_quality:0,proton_speed:400,proton_density:2,proton_temperature:100000,max_data_flag:0},{time_tag:'2026-10-18T20:01:00',active:true,source:'SOLAR1',overall_quality:1,proton_speed:450,proton_density:3,proton_temperature:120000}];
 const p=normalizeContext(rows,'solar-wind',at);assert.equal(p.kind,'earth_context');assert.equal(p.samples[0].values.proton_speed,400);assert.equal(p.samples[1].values.proton_speed,null);assert.equal(p.samples[0].flags.max_data_flag,0);assert.equal(p.usable_for_human_route_dose,false);assert.equal(p.latest_observed_at,'2026-10-18T20:00:00.000Z');
 const euv=normalizeContext([{time_tag:'2026-10-18T20:00:00Z',line:'256',value:.0001,satellite:19,flags:{eclipse:false,lunar_transit:false,geocorona:false}},{time_tag:'2026-10-18T20:01:00Z',line:'256',value:.0002,satellite:19,flags:{eclipse:true,lunar_transit:false,geocorona:false}},{time_tag:'2026-10-18T20:00:00Z',line:'mgii_index',value:.27}], 'solar-euv',at);assert.equal(euv.channels.length,1);assert.equal(euv.channels[0].unit,'W/m²');assert.equal(euv.samples[1].values['256'],null);assert.throws(()=>normalizeContext([{...rows[0],time_tag:'2030-01-01'}],'solar-wind',at),/Future/);
});
test('status categories and flare events keep original record times and are not converted to exposure',()=>{
 const scales=normalizeContext({'0':{DateStamp:'2026-10-18',TimeStamp:'20:00:00',S:{Scale:'1'},R:{Scale:'0'},G:{Scale:'2'}}},'solar-status',at);assert.equal(scales.samples[0].values.S,1);
 const flare=normalizeContext([{begin_time:'2026-10-18T20:00:00Z',max_time:'2026-10-18T20:05:00Z',end_time:null,max_class:'M1.0',max_xrlong:1e-5,satellite:19}],'solar-flares',at);assert.equal(flare.events[0].end,null);assert.equal(flare.events[0].classification,'M1.0');assert.equal(flare.events[0].peak,1e-5);
});
test('new feed requests stay on fixed primary sources; catalogue distinguishes products from scientific prerequisites',async()=>{
 for(const url of Object.values(CONTEXT_URLS))assert.equal(allowedSource(url),url);assert.throws(()=>allowedSource('https://services.swpc.noaa.gov/arbitrary-file'),/Unapproved/);let requested;
 const {packet}=await collectFeed('solar-status',{now:new Date(at),fetcher:async url=>{requested=url;return new Response(JSON.stringify({'0':{DateStamp:'2026-10-18',TimeStamp:'20:00:00',S:{Scale:'0'},R:{Scale:'0'},G:{Scale:'0'}}}));}});assert.equal(requested,CONTEXT_URLS['solar-status']);assert.match(packet.provenance[0].sha256,/^[a-f0-9]{64}$/);
 assert.equal(SCIENCE_CATALOG.filter(x=>x.type==='dynamic'&&x.engine).length,35);for(const item of SCIENCE_CATALOG.filter(x=>x.type==='dynamic')){if(item.engine){assert.ok(item.description?.length>20);assert.ok(item.sources?.every(x=>x.url.startsWith('https://')));}else{assert.ok(item.reason?.length>60);assert.doesNotMatch(item.reason,/Awaiting dynamic endpoint/);}}
});
test('verified NASA grids can be reconstructed from byte-pinned source responses and the echoed model time',()=>{
 const root=new URL('../data/environment/',import.meta.url),snapshot=JSON.parse(readFileSync(new URL('verified-snapshot.json',root)));
 assert.equal(Object.keys(snapshot.fields).length,9);
 for(const [param,packet] of Object.entries(snapshot.fields)){
  for(const source of packet.provenance){const raw=readFileSync(new URL('raw/'+source.sha256+'.txt',root));assert.equal(createHash('sha256').update(raw).digest('hex'),source.sha256);assert.equal(source.form.units,'Scientific');assert.equal(source.form.model,'EMARS');}
  const html=readFileSync(new URL('raw/'+packet.provenance[0].sha256+'.txt',root),'utf8'),metadata=environmentMetadata(html,packet.model_time),raw=JSON.parse(readFileSync(new URL('raw/'+packet.provenance[1].sha256+'.txt',root),'utf8'));
  assert.deepEqual(normalizeEnvironment(raw,param,metadata).values,packet.values);assert.equal(metadata.observation_time,null);assert.equal(packet.uncertainty,null);assert.throws(()=>environmentMetadata(html,'2025-01-01T00:00:00.000Z'),/confirm/);
 }
});

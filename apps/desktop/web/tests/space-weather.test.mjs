import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FEEDS,normalizeHapi,normalizeIpath,normalizeSpectrum,normalizeDonki,normalizeGoes,observationState,forecastState} from '../src/space-weather-contracts.js';
import {allowedSource,sourceRead,collectFeed} from '../science/space-weather.mjs';
import {createFeedService} from '../api/space-weather.mjs';
import {seriesPath} from '../src/space-weather-view.js';
import {SCIENCE_CATALOG} from '../src/science-catalog.js';
const NOW='2026-10-18T13:00:00.000Z';
const hapi=()=>({status:{code:1200},parameters:[{name:'Time',type:'isotime'},{name:'dose_e_total',units:'uGy/day',fill:'null'},{name:'dose_b_rtg',units:'uGy/day',fill:'null'},{name:'dose_b_raw',units:'uGy/day',fill:'null'}],data:[['2026-10-17T11:00:00Z',null,0,180],['2026-10-17T11:17:00Z',190,123,181]]});
const forecast=()=>({sep_forecast_submission:{model:{short_name:'ZEUS+iPATH_CME',spase_id:'spase://CCMC/SimulationModel/iPATH/2'},issue_time:'2026-10-17T12:00:00Z',forecasts:[{location:'mars',species:'proton',energy_channel:{min:10,max:-1,units:'MeV'},prediction_window:{start_time:'2026-10-17T00:00:00Z',end_time:'2026-10-20T00:00:00Z'},peak_intensity_max:{intensity:0,units:'pfu',time:'2026-10-19T00:00:00Z'},all_clear:{all_clear_boolean:true}}]}});
test('RAD uses named channels, preserves null versus zero and separates detector material',()=>{
 const packet=normalizeHapi(hapi(),'rad',NOW);assert.equal(packet.samples[0].values.dose_e_total,null);assert.equal(packet.samples[0].values.dose_b_rtg,0);assert.equal(packet.channels.find(c=>c.id==='dose_b_raw').material,'silicon');assert.equal(packet.channels.find(c=>c.id==='dose_e_total').material,'tissue-equivalent plastic');assert.equal(packet.usable_for_human_route_dose,false);assert.equal(packet.published_at,null);
 const bad=hapi();bad.parameters[1].units='mSv/day';assert.throws(()=>normalizeHapi(bad,'rad',NOW),/unit/);bad.parameters[1].units='uGy/day';bad.data[0][0]='2026-10-20T00:00:00Z';assert.throws(()=>normalizeHapi(bad,'rad',NOW),/future/);
});
test('MEX rejects a silent counts-to-flux schema change',()=>{
 const p={status:{code:1200},parameters:[{name:'Time',type:'isotime'},{name:'TotalCount',units:'counts'},{name:'BackgroundCounts',units:'counts'}],data:[['2026-10-17T00:00:00Z',100,2]]};const packet=normalizeHapi(p,'mex',NOW);assert.equal(packet.domain,FEEDS.mex.domain);assert.match(packet.channels[0].species,/combined/);p.parameters[1].units='counts/s';assert.throws(()=>normalizeHapi(p,'mex',NOW),/unit/);
});
test('a forecast must target Mars protons and expiration never becomes clearance',()=>{
 const run=normalizeIpath(forecast(),NOW);assert.equal(run.channels[0].peak,0);assert.equal(run.channels[0].human_eva_clearance,false);assert.equal(forecastState(run.channels[0],Date.parse('2026-10-21T00:00Z')),'Expired');assert.equal(forecastState(run.channels[0],Date.parse('2026-10-16T00:00Z')),'Upcoming');
 const wrong=forecast();wrong.sep_forecast_submission.forecasts[0].location='earth';assert.throws(()=>normalizeIpath(wrong,NOW),/No Mars/);wrong.sep_forecast_submission.forecasts[0].location='mars';wrong.sep_forecast_submission.forecasts[0].peak_intensity_max.units='uSv/h';assert.throws(()=>normalizeIpath(wrong,NOW),/channel/);
});
test('spectrum CSV uses explicit UTC and rejects incompatible energy/time contracts',()=>{
 const run=normalizeIpath(forecast(),NOW),text='#time(h),differential flux[protons/(cm^2 s sr MeV)] at the energy [MeV]\n#,0.1,1,10\n2026-10-17 04:00:00,0,2,1\n2026-10-18 04:00:00,1,4,2';
 const spectrum=normalizeSpectrum(text,run);assert.equal(spectrum.samples[0].time,'2026-10-17T04:00:00.000Z');assert.equal(spectrum.samples[0].values[0],0);assert.throws(()=>normalizeSpectrum(text.replace('2026-10-17 04:00:00','2026-10-21 04:00:00'),run),/window/);assert.throws(()=>normalizeSpectrum(text.replace('protons/(cm^2 s sr MeV)','mSv'),run),/units/);
});
test('DONKI uses Mars impactList rather than Earth arrival fields',()=>{
 const p=[{simulationID:'test/1',modelCompletionTime:'2026-10-17T00:00:00Z',estimatedShockArrivalTime:'2026-10-18T01:00:00Z',impactList:[{location:'Earth',arrivalTime:'2026-10-18T02:00:00Z'},{location:'Mars',arrivalTime:'2026-10-19T03:00:00Z'}],link:'https://ccmc.gsfc.nasa.gov/DONKI/'}];const result=normalizeDonki(p,NOW);assert.equal(result.events.length,1);assert.equal(result.events[0].predicted_arrival,'2026-10-19T03:00:00.000Z');assert.equal(result.events[0].is_sep_onset,false);assert.equal(normalizeDonki([],NOW).events.length,0);
});
test('GOES stays Earth context, keeps channel flags and masks contaminated readings',()=>{
 const p=[{time_tag:'2026-10-18T12:00:00Z',satellite:18,energy:'0.1-0.8nm',flux:0,observed_flux:2,electron_correction:true,electron_contaminaton:false},{time_tag:'2026-10-18T12:01:00Z',satellite:19,energy:'0.1-0.8nm',flux:3,electron_contaminaton:true}];const packet=normalizeGoes(p,'goes-xrays',NOW);assert.equal(packet.kind,'earth_context');assert.equal(packet.samples[0].values['0.1-0.8nm'],0);assert.equal(packet.samples[1].values['0.1-0.8nm'],null);assert.equal(packet.samples[1].satellite,19);assert.equal(packet.samples[0].flags['0.1-0.8nm'].electron_correction,true);assert.equal(packet.latest_observed_at,'2026-10-18T12:00:00.000Z');
});
test('chart gaps, missing samples and log zeros are never silently joined',()=>{
 const points=[{x:0,y:1},{x:1,y:null},{x:2,y:0},{x:100,y:4}];const chart=seriesPath(points,{gap:5});assert.equal((chart.path.match(/M/g)??[]).length,3);assert.equal(chart.path.includes('L'),false);assert.equal(seriesPath([{x:1,y:0}],{logY:true}).path,'');assert.equal(observationState('2026-10-14T00:00:00Z',Date.parse(NOW)).label,'Old observation');
});
test('provider URL validation rejects arbitrary hosts, credentials, ports and private targets',async()=>{
 for(const url of ['http://iswa.ccmc.gsfc.nasa.gov/hapi/','https://evil.example/','https://127.0.0.1/hapi/','https://iswa.ccmc.gsfc.nasa.gov:444/hapi/','https://user:secret@iswa.ccmc.gsfc.nasa.gov/hapi/'])assert.throws(()=>allowedSource(url));
 await assert.rejects(sourceRead('https://iswa.ccmc.gsfc.nasa.gov/api/recent',{fetcher:async()=>new Response(null,{status:302,headers:{location:'http://169.254.169.254/'}}),attempts:1}),/Unapproved/);
 const good=await sourceRead('https://iswa.ccmc.gsfc.nasa.gov/hapi/info',{fetcher:async()=>new Response('{"test":0}'),attempts:1});assert.equal(good.metadata.sha256,createHash('sha256').update(good.raw).digest('hex'));
});
test('cache coalesces callers, preserves last good observation clocks on failure and never manufactures zero',async()=>{
 let calls=0,now=Date.parse(NOW),fail=false;const cached=new Map(),store={get:async k=>cached.get(k),set:async(k,v)=>cached.set(k,v)},packet=normalizeHapi(hapi(),'rad',NOW);
 const read=async()=>{calls++;await new Promise(r=>setTimeout(r,1));if(fail)throw Error('upstream unavailable');return {packet:{...packet,health:{state:'ok'}}};};const serve=createFeedService({store,read,clock:()=>now,seeds:{}});
 const [a,b]=await Promise.all([serve('rad'),serve('rad')]);assert.equal(calls,1);assert.equal(a.latest_observed_at,b.latest_observed_at);assert.ok(cached.get('rad:7').gzip);
 fail=true;now+=3601000;const fallback=await serve('rad');assert.equal(fallback.health.state,'cached_fallback');assert.equal(fallback.latest_observed_at,packet.latest_observed_at);assert.equal(fallback.retrieved_at,NOW);assert.equal(fallback.samples[0].values.dose_e_total,null);
 const freshInstance=createFeedService({store,read,clock:()=>now,seeds:{}});assert.equal((await freshInstance('rad')).health.state,'cached_fallback');
 const empty=createFeedService({store:{get:async()=>null,set:async()=>{}},read,clock:()=>now,seeds:{}});assert.equal((await empty('mex')).health.state,'unavailable');now+=3601000;assert.equal((await empty('mex')).health.state,'unavailable');await assert.rejects(serve('__proto__'),/Unsupported/);
});
test('the durable worker can save raw evidence before a schema is rejected',async()=>{
 const bad=hapi();bad.parameters[1].units='mSv/day';let captured=null;
 await assert.rejects(collectFeed('rad',{now:new Date(NOW),fetcher:async()=>new Response(JSON.stringify(bad)),onRaw:async r=>{captured=r;}}),/unit/);
 assert.equal(captured.metadata.sha256,createHash('sha256').update(captured.raw).digest('hex'));
});
test('release snapshots retain independently verifiable raw sources for every connected feed',()=>{
 const root=new URL('../data/space-weather/',import.meta.url),bootstrap=JSON.parse(readFileSync(new URL('bootstrap.json',root)));
 assert.deepEqual(Object.keys(bootstrap.feeds).sort(),Object.keys(FEEDS).sort());
 for(const packet of Object.values(bootstrap.feeds)){assert.equal(packet.usable_for_human_route_dose,false);for(const source of packet.provenance){const raw=readFileSync(new URL('raw/'+source.sha256+'.txt',root));assert.equal(createHash('sha256').update(raw).digest('hex'),source.sha256);}assert.equal(packet.published_at,null);}
 const live=SCIENCE_CATALOG.filter(i=>i.engine==='feed');assert.equal(live.length,13);assert.ok(live.every(i=>FEEDS[i.feed]));assert.equal(new Set(SCIENCE_CATALOG.filter(i=>i.recommended).map(i=>i.group)).size,5);for(const id of ['gcr-surface-dose-estimate','dose-equivalent-rate-sv-time','cumulative-marswalk-radiation-exposure'])assert.equal(SCIENCE_CATALOG.find(i=>i.id===id).engine,null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {relayVisibility,relayStates,relaySampler,RELAY_ORBITERS,MARS_REFERENCE_RADIUS,dustPixel,dustStatus,dustFocus,validateDustIndex,validateUvHistory} from '../src/source-overlay-data.js';
import {uvRow,addUvRow,finishUvBins} from '../scripts/prepare-rems-history.mjs';
import {SCIENCE_CATALOG} from '../src/science-catalog.js';
import {DYNAMIC_RESEARCH} from '../src/dynamic-source-research.js';

test('relay visibility respects the physical horizon, elevation mask, poles and dateline',()=>{
 const R=MARS_REFERENCE_RADIUS,states=[{id:'test',name:'Test relay',position:[R+400000,0,0]}];
 assert.equal(relayVisibility(states,0,0,10)[0].elevation,90);
 assert.equal(relayVisibility(states,180,0,0)[0].visible,false);
 assert.equal(relayVisibility(states,0,90,0)[0].visible,false);
 const horizon=Math.acos(R/(R+400000))*180/Math.PI;
 assert.ok(Math.abs(relayVisibility(states,horizon,0,0)[0].elevation)<1e-10);
 assert.equal(relayVisibility(states,horizon-1,0,10)[0].visible,false);
 assert.equal(relayVisibility(states,360,0,10)[0].visible,true);
 assert.deepEqual(relayVisibility(states,-180,0),relayVisibility(states,180,0));
 assert.equal(relayVisibility([],0,0),null);assert.equal(relayVisibility(states,0,91),null);
 assert.equal(RELAY_ORBITERS.includes('hope'),false);assert.equal(relayStates(null,null,Date.now()).length,0);
 for(const angle of [0,5,10,20,30]){const sample=relaySampler(states,angle);for(let lat=-90;lat<=90;lat+=3)for(let lon=-180;lon<=180;lon+=5)assert.equal(sample(lon,lat),relayVisibility(states,lon,lat,angle).filter(s=>s.visible).length);assert.equal(sample(0,91),null);}assert.equal(relaySampler([])(0,0),null);
});

test('missing native dust pixels stay unknown; nearest sampling wraps the dateline and covers both poles',()=>{
 const pixels=new Uint8ClampedArray(3600*1801*4);pixels[0]=255;pixels[((1800*3600)+1800)*4]=19;pixels[1800*4]=7;
 assert.equal(dustPixel(pixels,-180,90),null);assert.equal(dustPixel(pixels,180,90),null);
 assert.equal(dustPixel(pixels,0,-90),19);assert.equal(dustPixel(pixels,0,90),7);
 assert.equal(dustPixel(pixels,0,0),0);assert.equal(dustPixel(null,0,0),null);
 const focus=dustFocus(pixels);assert.ok(dustPixel(pixels,...focus)>0);assert.equal(dustFocus(new Uint8ClampedArray(16)),null);
 assert.match(dustStatus(null),/unknown/);assert.doesNotMatch(dustStatus(0),/dust.free|clear/i);
 assert.throws(()=>validateDustIndex({}),/Unknown/);
});

test('all published MDAD frames are checksum pinned, native-sized and retained without invented dates',()=>{
 const root=new URL('../public/science/history/dust/',import.meta.url),p=validateDustIndex(JSON.parse(readFileSync(new URL('index.json',root))));
 assert.equal(p.frames.length,2488);assert.deepEqual([...new Set(p.frames.map(f=>f.year))],[28,29,30,31,32]);assert.equal(p.frames.filter(f=>f.empty_source_mask).length,116);
 const repeated=p.frames.filter(f=>f.year===28&&f.day==='P08_day16');assert.equal(repeated.length,2);assert.equal(new Set(repeated.map(f=>f.id)).size,2);assert.equal(repeated.filter(f=>f.empty_source_mask).length,1);assert.notEqual(repeated[0].sha256,repeated[1].sha256);
 for(const f of p.frames){const b=readFileSync(new URL(f.file,root));assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);assert.equal(b.readUInt32BE(16),3600);assert.equal(b.readUInt32BE(20),1801);assert.equal(b[24],8);assert.equal(b[25],0);}
 assert.match(p.limitations,/Not current/);assert.equal(p.license,'CC BY 4.0');
 assert.throws(()=>validateDustIndex({...p,frames:[{...p.frames[0],file:'../../escape.png'}]}),/Invalid/);
});

test('UV binning retains observed range, missing uncertainty and systematic uncertainty without sqrt-N reduction',()=>{
 const bins=new Map(),row={sol:3401,lmst:12.04,zenith:30,values:[1,null,-.01,0,0,0],uncertainties:[.4,null,null,0,0,0]};
 addUvRow(bins,row);addUvRow(bins,{...row,values:[3,null,-.02,0,0,0],uncertainties:[.6,null,null,0,0,0]});
 addUvRow(bins,{...row,zenith:60});
 const b=finishUvBins(bins)[0];assert.equal(b.channels[0].mean,2);assert.equal(b.channels[0].count,2);assert.equal(b.channels[0].uncertainty_min,.4);assert.equal(b.channels[0].uncertainty_max,.6);
 assert.equal(b.channels[1].mean,null);assert.equal(b.channels[1].uncertainty_min,null);assert.ok(b.channels[2].mean<0);
 const source=[3401,12,30,0,0,0,0,0,0,0,1,1,...new Array(12).fill(-999)].join(',');assert.ok(uvRow(source).values.every(x=>x===null));assert.throws(()=>uvRow('3401,12,0'),/schema/);
});

test('UV archive has the actual PDS date, physical units, original bands and provenance rather than a live label',()=>{
 const p=validateUvHistory(JSON.parse(readFileSync(new URL('../public/science/history/rems-uv.json',import.meta.url))));assert.match(p.label_time_bounds.start,/^2022-/);assert.deepEqual(p.observed_sol_range,[3401,3423]);assert.equal(Math.max(...p.bins.map(b=>b.sol)),3423);assert.match(p.coverage_warning,/nominal/);assert.equal(p.provenance[0].rows,724717);assert.equal(p.units,'W/m²');assert.deepEqual(p.channels.slice(0,3).map(x=>x.band_nm),[[315,370],[280,320],[220,280]]);
 assert.ok(p.bins.some(b=>b.channels.some(c=>c.count)));assert.match(p.limitations,/not live/);assert.match(p.aggregation,/systematic/);
});

test('every newly scoped or pending quantity has a specific source/model handoff',()=>{
 assert.equal(Object.keys(DYNAMIC_RESEARCH).length,32);
 for(const item of SCIENCE_CATALOG.filter(x=>x.type==='dynamic'&&(!x.engine||x.completion))){assert.ok(item.modelPackage);assert.ok(item.researchSources.length);assert.ok(item.dependencyLabel);for(const s of item.researchSources)assert.equal(new URL(s.url).protocol,'https:');}
 assert.equal(SCIENCE_CATALOG.filter(x=>x.type==='dynamic'&&x.completion).length,5);
 assert.match(SCIENCE_CATALOG.find(x=>x.engine==='relay').coverage,/not a scheduled/);
});

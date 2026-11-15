import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {SCIENCE_CATALOG} from '../src/science-catalog.js';
import {horizonMetric} from '../src/terrain-metrics.js';
const manifest=JSON.parse(readFileSync(new URL('../public/scientific/manifest.json',import.meta.url))),hash=b=>createHash('sha256').update(b).digest('hex');
const values=key=>{const b=gunzipSync(readFileSync(new URL('../public/scientific/'+manifest.layers[key].file,import.meta.url)));return {buffer:b,at:i=>b.readFloatLE(i*4)};};

test('new orbital references retain every valid source value and exactly mask publisher sentinels',()=>{
 for(const [key,name,sentinel] of [['rock-abundance','tes_rock_abundance_numeric',0],['surface-dust-cover-index-reference-composite','TES_dust_index_16ppd_numeric',Math.fround(.85000002)],['gravity-anomalies','grav_jgmro_120d_anom_095',null]]){
  const source=gunzipSync(readFileSync(new URL('../tools/data/extended/'+name+'.vic.gz',import.meta.url))),header=source.subarray(0,4000).toString('ascii'),get=k=>header.match(new RegExp('\\b'+k+"=(?:'([^']*)'|([0-9]+))")).slice(1).find(x=>x!==undefined),asset=manifest.layers[key],decoded=values(key);
  assert.equal(hash(source),asset.sources[0].source_sha256);assert.equal(get('INTFMT'),'LOW');assert.equal(get('REALFMT'),'RIEEE');assert.equal(Number(get('NS')),asset.width);assert.equal(Number(get('NL')),asset.height);assert.equal(get('NB'),'1');
  const offset=Number(get('LBLSIZE')),real=get('FORMAT')==='REAL';assert.ok(real||get('FORMAT')==='FULL');assert.equal(source.length,offset+asset.width*asset.height*4);
  let valid=0;for(let i=0;i<asset.width*asset.height;i++){const original=real?source.readFloatLE(offset+i*4):source.readInt32LE(offset+i*4),actual=decoded.at(i);if(original===sentinel)assert.ok(Number.isNaN(actual));else{assert.equal(actual,original);valid++;}}assert.equal(valid,asset.valid_pixels);
 }
 const gravity=manifest.layers['gravity-anomalies'];assert.ok(gravity.minimum<0&&gravity.maximum>0);assert.equal(gravity.width,360);assert.match(gravity.units,/mGal/);assert.match(gravity.processing,/not.*total surface acceleration/i);
});

test('magnetic components preserve physical signs, synthesis checks, evaluation height and polar unknowns',()=>{
 for(const h of [0,150])for(const component of ['radial','north','east']){
  const key=`magnetic-${component}-${h}km`,asset=manifest.layers[key],v=values(key);assert.equal(asset.altitude_m,h*1000);assert.equal(asset.component,component);assert.ok(asset.minimum<0&&asset.maximum>0);assert.match(asset.processing,/Bnorth=-Btheta, Beast=Bphi/);
  for(const p of asset.point_synthesis_checks){const x=Math.round((p.lon+179.75)/.5),y=Math.round((89.75-p.lat)/.5),actual=v.at(y*720+x);assert.ok(Math.abs(actual-p.delivered_nT)<.001);assert.ok(Math.abs(actual-p.point_synthesis_nT)<Math.max(2,Math.max(-asset.minimum,asset.maximum)*.025));}
  for(const i of [0,719,359*720,360*720-1])assert.equal(Number.isNaN(v.at(i)),component!=='radial');
 }
});

test('catalogue counts agree with independent spherical distances at the date line and high latitudes',()=>{
 const body=readFileSync(new URL('../public/value-sites.json',import.meta.url)),records=JSON.parse(body).sites,rad=Math.PI/180;
 for(const r of [100,250]){const asset=manifest.layers[`catalogue-density-${r}km`],v=values(`catalogue-density-${r}km`);assert.equal(hash(body),asset.sources[0].source_sha256);assert.equal(asset.record_count,records.length);assert.equal(asset.radius_km,r);assert.ok(Math.abs(asset.cap_area_km2-Math.PI*r*r)<Math.PI*r*r*.001);
  for(const [row,col] of [[0,0],[179,359],[45,0],[90,359],[49,23],[71,257]]){const lat=89.5-row,lon=-179.5+col;const count=records.filter(s=>{const [x,y]=s.center,a=Math.sin((y-lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(y*rad)*Math.sin((x-lon)*rad/2)**2;return 2*3396190*Math.asin(Math.min(1,Math.sqrt(a)))<=r*1000;}).length;assert.equal(v.at(row*360+col),count);}
  for(let i=0;i<360*180;i++)assert.ok(Number.isInteger(v.at(i))&&v.at(i)>=0);
 }
});

test('local horizon uses physical Mars curvature and keeps unsupported samples unknown',()=>{
 assert.equal(horizonMetric(()=>0,0,0,100,'horizon'),0);
 const radius=3396190,expected=Math.atan2((radius+100)*Math.cos(100/radius)-radius,(radius+100)*Math.sin(100/radius))*180/Math.PI;
 const raised=(lon,lat)=>Math.hypot(lon,lat)<1e-12?0:100;assert.ok(Math.abs(horizonMetric(raised,0,0,100,'horizon')-expected)<1e-7);
 assert.ok(Number.isNaN(horizonMetric(()=>NaN,0,0,100,'horizon')));assert.ok(Number.isNaN(horizonMetric(()=>0,0,90,100,'horizon')));assert.ok(Number.isNaN(horizonMetric(()=>0,0,0,0,'horizon')));
});

test('the runtime catalogue retains specific dependencies without publishing the planning report',()=>{
 for(const ext of ['html','md','csv','json'])assert.equal(existsSync(new URL('../public/overlay-readiness.'+ext,import.meta.url)),false,'Planning report must stay outside website assets');
 assert.doesNotMatch(readFileSync(new URL('../src/science-menu.js',import.meta.url),'utf8'),/science-readiness-link|overlay-readiness\.html/);
 for(const item of SCIENCE_CATALOG.filter(x=>!x.engine)){
  assert.ok(item.reason.length>80,item.id);assert.ok(item.modelPackage,item.id);
  assert.ok(item.sources?.length||item.researchSources?.length,item.id);
  assert.doesNotMatch(item.reason,/awaiting dynamic endpoint|published spatial product or defensible model still required/i,item.id);
 }
 assert.ok(SCIENCE_CATALOG.some(x=>x.workClass==='engineering_with_runtime_inputs'));
 assert.ok(SCIENCE_CATALOG.some(x=>x.workClass==='owner_scenario_and_model'));
 for(const item of SCIENCE_CATALOG.filter(x=>x.engine==='reference'))for(const key of item.variants??[item.asset])assert.ok(manifest.layers[key],key);
});

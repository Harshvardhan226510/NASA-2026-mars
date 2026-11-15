import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {studyRing,leafletStudyRing,discoveryBounds,siteCoverage,aboveHorizon} from '../src/value-geometry.js';
import {tileAddress} from '../api/planet.mjs';
const data=JSON.parse(readFileSync(new URL('../public/value-sites.json',import.meta.url)));
test('researched sites retain evidence, explicit location basis and safe source links',()=>{
 assert.ok(data.sites.length>2000);assert.equal(new Set(data.sites.map(s=>s.id)).size,data.sites.length);
 for(const s of data.sites){assert.ok(s.evidence&&s.coordinateNote&&s.summary&&s.perimeterMeaning&&s.validation);assert.ok(s.radiusKm>0&&s.radiusKm<=80);assert.ok(s.center[0]>=-180&&s.center[0]<=180&&Math.abs(s.center[1])<=90);for(const r of s.sources){const u=new URL(r.url);assert.equal(u.protocol,'https:');assert.ok(/(^|\.)(nasa\.gov|esa\.int|usgs\.gov|uahirise\.org|wiley\.com|usra\.edu|wustl\.edu|zenodo\.org)$/.test(u.hostname),u.hostname);}}
 assert.equal(data.sites.find(s=>s.id==='MEDUSAE_ICE').category,'science');assert.match(data.sites.find(s=>s.id==='ACIDALIA_THORIUM').summary,/does not locate ore/);
});
test('study circles keep their stated radius at high latitude and across the date line',()=>{
 for(const center of [[-180,-2],[92.8,87.1],[77.41,18.46]]){const s={center,radiusKm:30},ring=studyRing(s);assert.deepEqual(ring[0],ring.at(-1));for(const [lon,lat] of ring){const rad=Math.PI/180,p=center[1]*rad,q=lat*rad,h=Math.sin((q-p)/2)**2+Math.cos(p)*Math.cos(q)*Math.sin((lon-center[0])*rad/2)**2,d=2*3396190*Math.asin(Math.sqrt(h));assert.ok(Math.abs(d-30000)<.0001);}const planar=leafletStudyRing(s);for(let i=1;i<planar.length;i++)assert.ok(Math.abs(planar[i][1]-planar[i-1][1])<180);for(const b of discoveryBounds(s)){assert.ok(b[0]>=-180&&b[2]<=180&&b[0]<b[2]);}}
 assert.equal(discoveryBounds({center:[-180,-2],radiusKm:30}).length,2);
});
test('prepared anchor coverage never claims an unprepared or partial study window is fully mapped',()=>{
 const s={center:[1,1],radiusKm:2},d={status:'complete',bounds:[.99,.99,1.05,1.05],terrain:[{}],imagery:[{}],imagery_grid_m:[.25,.25]};assert.equal(siteCoverage({datasets:[]},s).kind,'pending');assert.equal(siteCoverage({datasets:[d]},s).kind,'partial');assert.match(siteCoverage({datasets:[{...d,bounds:[0,0,2,2]}]},s).text,/pixel audit pending/);assert.equal(siteCoverage({datasets:[{...d,status:'building'}]},s).kind,'pending');
});
test('global gap layer uses only the official bounded Mars Viking tile service',()=>{
 assert.match(tileAddress({kind:'baseline',z:'0',x:'1',y:'0'}).url,/trek\.nasa\.gov\/tiles\/Mars\/EQ\/Mars_Viking/);assert.throws(()=>tileAddress({kind:'baseline',z:'8',x:'0',y:'0'}));assert.throws(()=>tileAddress({kind:'baseline',z:'0',x:'2',y:'0'}));
});
test('infrared gap context is bounded to the documented NASA THEMIS source and levels',()=>{
 const address=tileAddress({kind:'thermal',z:'8',x:'293',y:'56'});
 assert.equal(address.url,'https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/8/56/293.png');
 assert.throws(()=>tileAddress({kind:'thermal',z:'10',x:'0',y:'0'}));assert.throws(()=>tileAddress({kind:'https://untrusted.example',z:'0',x:'0',y:'0'}));
});
test('markers on the far hemisphere cannot appear over a close polar view',()=>{const camera={x:0,y:0,z:3416190};assert.equal(aboveHorizon([92.8,87.1],camera),true);assert.equal(aboveHorizon([-76.4,-9.8],camera),false);assert.equal(aboveHorizon([0,-90],camera),false);assert.equal(aboveHorizon([0,0],{x:11000000,y:0,z:0}),true);});

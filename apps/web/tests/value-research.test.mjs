import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {filterValueSites,screenClusters,measuredEvidence} from '../src/value-filter.js';
import {distanceKm} from '../src/place-context.js';
import {studyRing,studyRings,leafletStudyRings,studyBounds} from '../src/value-geometry.js';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const data=json('../public/value-sites.json'),audit=json('../public/value-site-research.json');
test('imported spectral points preserve every original row, coordinates and product identifier while merging coordinate duplicates',()=>{
 const rows=readFileSync(new URL('../data/value-sources/hydrous_sites_geo_map.csv',import.meta.url),'utf8').trim().split(/\r?\n/).map(r=>r.split(',').map(v=>v.replace(/^"|"$/g,'')));
 const points=data.sites.filter(s=>s.sourceRecord?.product==='HYDROUS_SITES_GEO_MAP'),used=new Set(),coords=new Set();
 for(const s of points){const r=s.sourceRecord;assert.equal(s.evidenceClass,'spectral_detection');assert.equal(s.category,'minerals');assert.match(s.type,/species unspecified/);assert.match(s.summary,/not specified/);assert.ok(r.rows.length);assert.ok(r.omega.length||r.crism.length);
  for(const row of r.rows){assert.ok(!used.has(row));used.add(row);const src=rows[row-1];assert.deepEqual(s.center,src.slice(0,2).map(Number));for(const [idx,key] of [[2,'omega'],[3,'crism']])for(const id of src[idx].split(/[;\s]+/).filter(Boolean))assert.ok(r[key].includes(id));}
  const key=s.center.join(',');assert.ok(!coords.has(key));coords.add(key);
 }
 assert.equal(used.size,rows.length);assert.equal(points.length,new Set(rows.map(r=>r.slice(0,2).join(','))).size);assert.ok(points.length<rows.length);
});
test('offline source inputs are pinned by checksum and report totals follow the actual generated catalogue',()=>{
 for(const [name,sha] of Object.entries(audit.checksums))assert.equal(createHash('sha256').update(readFileSync(new URL('../data/value-sources/'+name,import.meta.url))).digest('hex'),sha);
 assert.equal(audit.total,data.sites.length);for(const [c,n] of Object.entries(audit.categories))assert.equal(n,data.sites.filter(s=>s.category===c).length);
 for(const l of audit.landings)for(const [key,radiusKm] of [['within100Km',100],['within300Km',300]])for(const [category,n] of Object.entries(l[key]))assert.equal(n,filterValueSites(data.sites,{landing:l,radiusKm,category}).length);
 assert.match(audit.landingOrigin.meaning,/not NASA-selected/);
});
function ringContains(p,ring){let found=false;for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])found=!found;}return found;}
test('mapped feature centres lie inside actual polygons, outside holes, and AP9 metre coordinates resolve to its landing vicinity',()=>{
 const records=data.sites.filter(s=>s.geometry);assert.equal(records.length,audit.sources.find(s=>s.id==='AP_GEOMORPHIC').features);
 const ids=new Set();for(const s of records){const r=s.sourceRecord,key=`${r.file}:${r.fid}`;assert.ok(!ids.has(key));ids.add(key);assert.equal(r.layer,'final_map');assert.equal(s.geometry.type,'Polygon');
  assert.equal(studyRing(s),s.geometry.coordinates[0]);assert.deepEqual(studyRings(s),s.geometry.coordinates);assert.equal(leafletStudyRings(s).length,s.geometry.coordinates.length);
  for(const ring of s.geometry.coordinates){assert.ok(ring.length>=4);assert.deepEqual(ring[0],ring.at(-1));for(const p of ring){assert.ok(p.every(Number.isFinite));assert.ok(Math.abs(p[0])<=180&&Math.abs(p[1])<=90);}}
  assert.ok(ringContains(s.center,s.geometry.coordinates[0]),s.id);assert.ok(!s.geometry.coordinates.slice(1).some(r=>ringContains(s.center,r)),s.id);
  const landing=audit.landings.find(l=>l.id===s.landingStudy);assert.ok(distanceKm(s.center,landing.center)<15,s.id);
  const b=studyBounds(s);for(const p of s.geometry.coordinates[0])assert.ok(p[0]>=b[0]-.00001&&p[0]<=b[2]+.00001&&p[1]>=b[1]-.00001&&p[1]<=b[3]+.00001,s.id);
 }
 const ap9=records.filter(s=>s.landingStudy==='AP9');assert.ok(ap9.every(s=>s.sourceRecord.srsId===100000&&s.center[0]<-156&&s.center[0]>-157));
});
test('uncertain morphology and null radar findings do not become confirmed resource detections',()=>{
 const pingos=data.sites.filter(s=>s.sourceRecord?.unit?.toLowerCase().includes('pingo'));assert.ok(pingos.length>20);
 for(const s of pingos){assert.equal(s.category,'resources');assert.equal(s.evidenceClass,'morphologic_candidate');assert.match(s.summary,/has not been confirmed/);assert.ok(!measuredEvidence.has(s.evidenceClass));}
 for(const id of ['PHLEGRA_SHARAD_EASTERN_MIXED','PHLEGRA_SHARAD_NORTHERN_NULL']){const s=data.sites.find(s=>s.id===id);assert.equal(s.category,'science');assert.equal(s.evidenceClass,'mixed_or_null');}
 const pm1=audit.landings.find(l=>l.id==='PM1'),main=data.sites.find(s=>s.id==='PHLEGRA_SHARAD_MAIN_LDA');assert.equal(main.category,'resources');assert.ok(distanceKm(main.center,pm1.center)<30);
});
test('landing filters use Mars distances across longitude wrap and combine with evidence/category/search filters',()=>{
 const sites=[{id:'near',category:'resources',center:[-179.9,40],name:'Ice survey',type:'radar',summary:'',evidence:'',evidenceClass:'radar_assessment'},{id:'far',category:'resources',center:[-175,40],name:'Ice survey',type:'radar',summary:'',evidence:'',evidenceClass:'morphologic_candidate'}],landing={center:[179.9,40]};
 assert.deepEqual(filterValueSites(sites,{landing,radiusKm:100,category:'resources',evidence:'measurements',query:'ice'}).map(s=>s.id),['near']);
 assert.deepEqual(filterValueSites(sites,{landing,radiusKm:300,evidence:'targets'}).map(s=>s.id),['far']);assert.equal(filterValueSites(sites,{category:'minerals'}).length,0);
});
test('screen clusters keep science, resources and minerals distinct and include each visible record once',()=>{
 const sites=[{id:'a',category:'science'},{id:'b',category:'science'},{id:'c',category:'resources'},{id:'d',category:'science'}];const groups=screenClusters(sites,s=>s.id==='d'?{x:100,y:100}:{x:1,y:1});assert.equal(groups.length,3);assert.equal(new Set(groups.flat().map(s=>s.id)).size,sites.length);assert.ok(groups.every(g=>new Set(g.map(s=>s.category)).size===1));
});

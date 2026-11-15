import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {SCIENCE_CATALOG,SCIENCE_GROUPS} from '../src/science-catalog.js';
import {layerSelection,allLayerSelection} from '../src/layers.js';
import {destination,terrainMetrics,terrainMetricValue,horizonMetric,contourSegments} from '../src/terrain-metrics.js';
import {loadReference,sampleReference,scienceColor} from '../src/scientific-data.js';
import {referencePyramid,sampleReferenceDisplay,referenceStyle} from '../src/reference-display.js';
const root=new URL('../public/scientific/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root))),hash=b=>createHash('sha256').update(b).digest('hex');

test('the owner catalog keeps nine categories and only connects verified dynamic products',()=>{
 assert.equal(SCIENCE_GROUPS.length,9);assert.equal(SCIENCE_CATALOG.length,126);assert.equal(new Set(SCIENCE_CATALOG.map(x=>x.id)).size,126);
 assert.equal(SCIENCE_CATALOG.filter(x=>x.type==='dynamic').length,62);
 for(const item of SCIENCE_CATALOG){assert.ok(SCIENCE_GROUPS.some(g=>g.id===item.group));if(item.type==='dynamic'&&item.engine)assert.ok(['feed','wind','environment','solar','solar-terrain','history-dust','history-uv','relay'].includes(item.engine));if(item.engine){assert.ok(item.description&&item.coverage&&item.sources.length);for(const source of item.sources)assert.equal(new URL(source.url).protocol,'https:');}else assert.ok(item.reason);}
 const selected=layerSelection({magnetic:true,contours:true,science:true},'slope-steepness',true);assert.equal(selected.magnetic,false);assert.equal(selected['slope-steepness'],true);assert.equal(selected.contours,true);assert.equal(selected.science,true);
 const next=layerSelection(selected,'thermal-inertia',true);assert.equal(next['slope-steepness'],false);assert.equal(next['thermal-inertia'],true);assert.equal(next.contours,true);
 assert.ok(Object.values(allLayerSelection(next,false)).every(x=>x===false));assert.deepEqual(layerSelection(next,'gcr-surface-dose-estimate',true),next);
});
test('spherical offsets wrap longitude and terrain derivatives recover a known plane with the correct aspect',()=>{
 const p=destination(179.99,0,2000,0);assert.ok(p[0]<-179.9);assert.ok(Math.abs(p[1])<1e-9);
 const metres=Math.PI/180*3396190,plane=(lon,lat)=>.2*lon*metres+.1*lat*metres;
 const m=terrainMetrics(plane,0,0,1000);assert.ok(Math.abs(m.slope-Math.atan(Math.hypot(.2,.1))*180/Math.PI)<1e-5);assert.ok(Math.abs(m.aspect-243.4349488)<1e-5);assert.ok(m.roughness<.001);assert.ok(Math.abs(m.curvature)<1e-8);
 assert.equal(terrainMetrics(()=>NaN,0,0,1000),null);assert.equal(terrainMetrics(plane,0,90,1000),null);assert.ok(Number.isNaN(terrainMetrics(()=>100,0,0,1000).aspect));
 const bowl=(lon,lat)=>.001*((lon*metres)**2+(lat*metres)**2);assert.ok(Math.abs(terrainMetrics(bowl,0,0,1000).curvature-4)<.001);
 assert.equal(horizonMetric(()=>0,0,0,1000),1);assert.equal(horizonMetric(()=>0,0,0,1000,true),0);assert.ok(Number.isNaN(horizonMetric(()=>NaN,0,0,1000)));
 const flat=terrainMetrics(()=>100,0,0,1000);assert.ok(Math.abs(flat.hillshade-Math.SQRT1_2)<1e-10);
});
test('mission surfaces disclose heuristics while baseline energy retains the partner polynomial and clamp',()=>{
 const flat=terrainMetrics(()=>100,0,0,1000);assert.equal(terrainMetricValue(flat,'energy'),3.2);assert.equal(terrainMetricValue(flat,'difficulty'),0);assert.equal(terrainMetricValue(flat,'suitability'),100);
 const cost=i=>280.5*i**5-58.7*i**4-289.8*i**3+74.3*i**2+19.1*i+3.2;
 assert.ok(Math.abs(terrainMetricValue({slope:60,roughness:100},'energy')-cost(.45))<1e-10);assert.equal(terrainMetricValue({slope:40,roughness:300},'difficulty'),100);assert.equal(terrainMetricValue({slope:31,roughness:0},'accessibility'),3);
 assert.ok(Number.isNaN(terrainMetricValue(null,'energy')));
});
test('contours cross the exact level, never bridge unknown cells and have a bounded output count',()=>{
 const width=4,grid=Float32Array.from({length:16},(_,i)=>(i%4)*100),segments=contourSegments(grid,width,[0,0,3,3],150);
 assert.ok(segments.length>0);for(const line of segments)for(const p of line.points)assert.ok(Math.abs(p[0]*100-line.height)<1e-9);
 assert.equal(contourSegments(new Float32Array(9).fill(1),3,[0,0,2,2],100).length,0);assert.equal(contourSegments(new Float32Array(9).fill(NaN),3,[0,0,2,2],100).length,0);assert.equal(contourSegments(grid,width,[0,0,3,3],50,2).length,2);assert.throws(()=>contourSegments(grid,width,[0,0,3,3],0));
 const corner=contourSegments(new Float32Array([0,0,0,100]),2,[0,0,1,1],100);assert.equal(corner.length,0);
});
test('all shipped reference grids preserve pinned bytes, source pixels, nodata and geographic orientation',async()=>{
 for(const item of Object.values(manifest.layers)){
  const encoded=readFileSync(new URL(item.file,root)),raw=gunzipSync(encoded);assert.equal(hash(encoded),item.sha256);assert.equal(hash(raw),item.packet_sha256);assert.equal(raw.length,item.width*item.height*4);
  for(const source of item.sources)if(source.label_sha256){const file=source.download_url.split('/').pop();assert.equal(hash(readFileSync(new URL('../tools/data/grs/'+file,import.meta.url))),source.source_sha256);assert.equal(hash(readFileSync(new URL('../tools/data/grs/'+file.replace('.tab','.lbl'),import.meta.url))),source.label_sha256);}
  const grid=await loadReference(item,{fetchImpl:async()=>new Response(encoded)});
  for(const p of item.verification_points){const lon=item.bounds[0]+(p.column+.5)/item.width*(item.bounds[2]-item.bounds[0]),lat=item.bounds[3]-(p.row+.5)/item.height*(item.bounds[3]-item.bounds[1]),value=sampleReference(grid,lon,lat);if(p.value===null)assert.ok(Number.isNaN(value));else assert.equal(value,p.value);}
  assert.equal(sampleReference(grid,-180,0),sampleReference(grid,180,0));if(item.bounds[3]<90)assert.ok(Number.isNaN(sampleReference(grid,0,80)));
  if(item.file==='thermal-inertia.f32.gz'){
   assert.ok(Number.isNaN(sampleReference(grid,0,80)));
   assert.ok(Number.isNaN(sampleReference(grid,0,-85)));
   assert.ok(Number.isFinite(sampleReference(grid,0,-76.5)));
   assert.ok(grid.valid_pixels<item.valid_pixels);
  }
 }
 const th=manifest.layers['thorium-abundance'],raw=gunzipSync(readFileSync(new URL(th.file,root)));assert.ok(Math.abs(raw.readFloatLE((35*72+36)*4)-(-.08))<1e-6); // Original âˆ’0.000008 weight % Ã— 10,000.
});
test('reference loading rejects a changed packet and color rendering never fills absent values',async()=>{
 const item=manifest.layers['potassium-abundance'],bytes=gunzipSync(readFileSync(new URL(item.file,root))),broken=Buffer.from(bytes);broken[0]^=1;
 await assert.rejects(loadReference(item,{fetchImpl:async()=>new Response(broken)}),/checksum/);await assert.rejects(loadReference(item,{fetchImpl:async()=>new Response(bytes.subarray(0,100))}),/incomplete/);
 assert.deepEqual(scienceColor(NaN,0,1),[0,0,0,0]);assert.notDeepEqual(scienceColor(0,0,1),[0,0,0,0]);const grid={bounds:[-180,-60,180,60],width:2,height:2,values:new Float32Array([1,NaN,2,3])};assert.ok(Number.isNaN(sampleReference(grid,90,30)));assert.ok(Number.isNaN(sampleReference(grid,0,80)));
});

test('reference display averages aliasing, interpolates across tile edges and preserves native measurements and masks',async()=>{
 const values=new Float32Array([0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0]),grid={width:4,height:4,bounds:[-180,-60,180,60],values};
 const levels=await referencePyramid(grid);assert.equal(levels.length,3);assert.ok(levels[1].values.every(v=>v===.5));
 assert.equal(sampleReferenceDisplay(levels,0,0,180),.5);assert.equal(sampleReference(grid,45,15),1);assert.deepEqual(values,new Float32Array([0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0]));
 assert.equal(sampleReferenceDisplay(levels,-180,20,90),sampleReferenceDisplay(levels,180,20,90));
 assert.ok(Math.abs(sampleReferenceDisplay(levels,-1e-7,0,90)-sampleReferenceDisplay(levels,1e-7,0,90))<1e-6);
 assert.ok(Math.abs(sampleReferenceDisplay(levels,10,5,179.999)-sampleReferenceDisplay(levels,10,5,180.001))<1e-4);
 assert.ok(Number.isNaN(sampleReferenceDisplay(levels,0,80,180)));
 const missing={width:2,height:2,bounds:[-180,-60,180,60],values:new Float32Array([1,NaN,2,3])},masked=await referencePyramid(missing);
 assert.ok(Number.isNaN(sampleReferenceDisplay(masked,90,30,180)));assert.equal(sampleReferenceDisplay(masked,-.001,30),1);
 const controller=new AbortController();controller.abort();await assert.rejects(referencePyramid(grid,controller.signal),e=>e.name==='AbortError');
});

test('global hydrogen is distinct from SWIM, covers both poles and has a longitude-independent display at each pole',async()=>{
 const item=SCIENCE_CATALOG.find(x=>x.id==='subsurface-water-ice-likelihood');assert.equal(item.asset,'mons-weh');assert.equal(item.variants.length,4);
 const asset=manifest.layers['mons-weh'],encoded=readFileSync(new URL(asset.file,root)),grid=await loadReference(asset,{fetchImpl:async()=>new Response(encoded)}),levels=await referencePyramid(grid);
 assert.equal(grid.valid_pixels,720*360);assert.equal(grid.minimum>0,true);assert.ok(grid.maximum<=100);assert.equal(referenceStyle(item,grid).max,100);assert.equal(referenceStyle(item,manifest.layers['ice-0_1']).max,1);
 for(const latitude of [-90,-89.9,-80,-70,70,80,89.9,90])for(const longitude of [-180,-90,0,90,180])assert.ok(Number.isFinite(sampleReferenceDisplay(levels,longitude,latitude)));
 for(const lat of [-90,90]){const value=sampleReferenceDisplay(levels,0,lat);for(const lon of [-180,-90,45,90,180])assert.ok(Math.abs(sampleReferenceDisplay(levels,lon,lat)-value)<1e-10);}
 // Pin native source values so display smoothing cannot silently change science.
 assert.equal(sampleReference(grid,0,89.75),100);assert.ok(sampleReference(grid,0,-70)>20);
});

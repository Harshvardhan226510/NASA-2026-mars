import {routeTerrain} from './route-terrain.js';
import {gridSampler} from './mission-terrain.js';
import {validateSiteOptions,expandedSite,siteFootprint,analyseSiteTerrain,analyseSiteSun,evaluateSite} from './site-evaluation.js';
import {loadReference,sampleReference} from './scientific-data.js';
import {corridorDistanceKm} from './route-sites.js';

export async function siteReferenceEvidence(point,{signal,fetcher=fetch}={}){
 const response=await fetcher('/scientific/manifest.json',{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});if(!response.ok)throw Error('Reference metadata unavailable.');const manifest=await response.json();
 const keys=['ice-0_1','thermal-inertia','rock-abundance','surface-dust-cover-index-reference-composite'];
 return Promise.all(keys.map(async key=>{const asset=manifest.layers[key];if(!asset)return {key,value:null,note:'Product unavailable'};try{const grid=await loadReference(asset,{signal,fetchImpl:fetcher}),v=sampleReference(grid,...point);return {key,value:Number.isFinite(v)?v:null,units:asset.units,sampling:asset.native_sampling,sources:asset.sources,packet_sha256:asset.packet_sha256,note:Number.isFinite(v)?'Original source cell at candidate centre':'No valid source cell at candidate centre'};}catch(e){if(signal?.aborted)throw e;return {key,value:null,note:e.message};}}));
}
export function siteResources(sites,point,radius){
 if(!Array.isArray(sites))return null;const seen=new Set();return sites.filter(s=>!s.userDefined&&s.category==='resources'&&Array.isArray(s.center)&&s.center.length===2&&s.center.every(Number.isFinite)&&s.sources?.length).map(s=>({...s,distance_km:corridorDistanceKm(s.center,point,point)})).filter(s=>s.distance_km<=radius).sort((a,b)=>a.distance_km-b.distance_km).filter(s=>{const key=s.center.map(v=>v.toFixed(3)).join(',');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,8).map(s=>({id:s.id,name:s.name,point:s.center,distance_km:s.distance_km,evidence:s.evidence,sources:s.sources}));
}
export async function collectSiteEvaluation(o,{catalog,preferred,sites,signal,onProgress=()=>{},terrainLoader=routeTerrain,references=siteReferenceEvidence}={}){
 validateSiteOptions(o);
 const evidence=references([o.lon,o.lat],{signal}).catch(e=>{if(signal?.aborted)throw e;return [{key:'ice-0_1',value:null,note:e.message}];});
 // Observe immediately so a cancelled reference read cannot become unhandled while terrain loads.
 evidence.catch(()=>{});
 const grid=await terrainLoader(siteFootprint(expandedSite(o),72).slice(0,-1),{catalog,preferred,spacing:50,signal,onProgress});signal?.throwIfAborted();
 const sample=gridSampler(grid);onProgress('Assessing footprint terrain and operating-period sunlight…');
 const terrain=analyseSiteTerrain(grid,o,sample),sun=analyseSiteSun(o,sample,Math.max(grid.resolution_meters,grid.source.sample_m)),reference=await evidence;signal?.throwIfAborted();
 const nearby=siteResources(sites,[o.lon,o.lat],o.radius),result=evaluateSite(o,terrain,sun,{ice:reference.find(r=>r.key==='ice-0_1')?.value??null,resources:nearby?.length?{nearest_km:nearby[0].distance_km,targets:nearby}:null});
 result.source={...grid.source,analysis_spacing_m:grid.resolution_meters,bounds:grid.bounds,reference,terrain_url:'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m',solar_url:'https://www.giss.nasa.gov/tools/mars24/help/algorithm.html'};
 result.resource_catalogue_available=Array.isArray(sites);return result;
}

import {missionWindow,wrapRouteLongitude} from './route-geometry.js';
import {globalElevationTile,sampleGrid} from './planet.js';
import {SurfaceRaster,R} from './raster.js';
import {TileQueue} from './tile-queue.js';
import {routeTilePlan} from './route-tile-plan.js';
import {evaElevationWindow,loadEvaElevation} from './eva-elevation.js';

const globalReads=new TileQueue(3,48);
const covers=(a,b)=>a[0]<=b[0]&&a[1]<=b[1]&&a[2]>=b[2]&&a[3]>=b[3];
const aborted=signal=>{if(signal?.aborted)throw new DOMException('Planning cancelled.','AbortError');};
export async function globalRouteGrid(points,spacing,signal,onProgress,{loadTile=globalElevationTile,queue=globalReads}={}){
 // Search spacing and measured source resolution are separate quantities.
 // A 50 m regional grid interpolates the validated DEM; it adds no observations.
 let spec=missionWindow(points,Math.max(50,spacing)),tiles=[],plan,byAddress;
 const load=async()=>{aborted(signal);plan=routeTilePlan(spec);let finished=0;onProgress?.(`Loading route area · ${plan.tiles.length} terrain tiles · ${(spec.resolution/1000).toFixed(2)} km cells`);tiles=await Promise.all(plan.tiles.map(({x,y,z})=>queue.get(`${z}/${y}/${x}`,()=>loadTile(x,y,z),signal).then(tile=>{onProgress?.(`Reading measured terrain · ${++finished}/${plan.tiles.length} tiles`);return tile;})));aborted(signal);byAddress=new Map(plan.tiles.map((a,i)=>[`${a.z}/${a.y}/${a.x}`,tiles[i]]));};
 await load();
 const valid=()=>tiles.filter(t=>!t.fallback),sourceSpacing=()=>Math.max(200,...valid().map(t=>(t.bounds[3]-t.bounds[1])*Math.PI/180*R/(t.width-1)));
 if(!valid().length)throw new Error('Only coarse MOLA fallback is available here. Choose a prepared HiRISE observation or try this terrain source again later.');
 const sample=(lon,lat)=>{const tile=byAddress.get(plan.key([lon,lat]));return tile&&!tile.fallback?sampleGrid(tile.grid,tile.width,tile.bounds,wrapRouteLongitude(lon),lat):NaN;};
 const sourceMetres=Math.ceil(sourceSpacing()),interpolated=spec.resolution<sourceMetres;
 return pack(spec,sample,{kind:'global',label:'Validated HRSC/MOLA terrain',sample_m:sourceMetres,requested_spacing_m:spacing,terrain_tiles:plan.tiles.length,interpolated,warning:(interpolated?`${spec.resolution} m search cells interpolate the ≈${sourceMetres} m elevation source; they do not provide ${spec.resolution} m measured terrain detail. `:'')+'Regional elevation model; small obstacles and local ground conditions are not resolved.'});
}
function pack(spec,sample,source){
 let missing=0;const matrix=Array.from({length:spec.size},(_,r)=>Array.from({length:spec.size},(_,c)=>{const h=sample(...spec.point(r,c));if(!Number.isFinite(h)){missing++;return null;}return Math.round(h*100)/100;}));
 if(missing>spec.size**2*.65)throw new Error('Too much elevation is unavailable in this window. Choose a smaller area within measured terrain coverage.');
 return {rows:spec.size,cols:spec.size,resolution_meters:spec.resolution,center:spec.center,elevation_matrix:matrix,source:{...source,unknown_cells:missing,window_width_m:spec.half*2,projection_max_scale_error:spec.maxScaleError},bounds:spec.bounds};
}
export async function routeTerrain(points,{catalog,preferred,mode='auto',spacing=50,signal,onProgress}={}){
 let spec=missionWindow(points,spacing);
 const complete=(catalog?.datasets??[]).filter(d=>d.status==='complete'&&d.terrain?.length&&covers(d.bounds,spec.bounds));
 const native=complete.find(d=>d.id===preferred?.id)??complete[0];
 if(mode==='native'&&!native)throw new Error('This mission window is outside a prepared HiRISE DEM. Move both endpoints inside an available observation or choose regional terrain.');
 const published=mode==='auto'?evaElevationWindow(spec.bounds):null;
 if(published){
  let source;try{source=await loadEvaElevation(published);}catch{onProgress?.('Local EVA terrain could not load. Trying other measured terrain…');}
  aborted(signal);
  if(source){
   spec=missionWindow(points,Math.max(source.metres,spacing));
   if(covers(published.bounds,spec.bounds))return pack(spec,source.sample,{kind:'regional',label:source.label,url:source.url,sample_m:source.metres,requested_spacing_m:spacing,warning:'Published regional terrain sampled at approximately 20 m. Small obstacles and material conditions remain unresolved.'});
  }
 }
 if(native&&mode!=='global'){
  onProgress?.('Reading the prepared HiRISE DEM from Drive…');
  const raster=new SurfaceRaster(native);let buffer=await raster.read(spec.bounds,513,513,{kind:'terrain',nodes:true});aborted(signal);
  if(buffer.gridMeters>spec.resolution){spec=missionWindow(points,buffer.gridMeters);if(!covers(native.bounds,spec.bounds))throw new Error('The available DEM overview is too coarse for this mission window. Choose regional terrain or a smaller prepared window.');buffer=await raster.read(spec.bounds,513,513,{kind:'terrain',nodes:true});aborted(signal);}
  // Never substitute global heights into missing native cells: they stay blocked.
  return pack(spec,(lon,lat)=>sampleGrid(buffer,513,spec.bounds,lon,lat),{kind:'native',dataset:native.id,label:'HiRISE DEM · Google Drive',sample_m:Math.ceil(buffer.gridMeters*10)/10,requested_spacing_m:spacing,warning:'Missing native elevation remains blocked; imagery resolution does not determine route accuracy.'});
 }
 return globalRouteGrid(points,spacing,signal,onProgress);
}

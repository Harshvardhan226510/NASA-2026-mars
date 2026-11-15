import Lerc from 'lerc';
import {TileQueue} from './tile-queue.js';
import {recoverSurfaceRead} from './recovery.js';
import {geographicBounds,overlaps} from './planet-grid.js';
import {decodeTopography,sampleHeight} from './global-terrain.js';
import {continuousMesh} from './terrain-mesh.js';
import {stitchTerrainEdges} from './terrain-stitch.js';
import {unpackElevation} from './terrain-transition.js';
import {auditTerrainReference} from './terrain-integrity.js';
export {geographicBounds,overlaps};
export const CTX_URL='/api/planet?kind=imagery&z={z}&y={y}&x={x}&v=4';
export const BASE_URL='/api/planet?kind=baseline&z={z}&y={y}&x={x}&v=3';
export const THERMAL_URL='/api/planet?kind=thermal&z={z}&y={y}&x={x}&v=3';
export const THERMAL_CREDIT='NASA/JPL/ASU/USGS · THEMIS daytime infrared 100 m · gap context';
export const BASE_CREDIT='NASA/Ames/USGS · Viking MDIM 2.1 · grayscale display · gap/polar context';
export const CTX_CREDIT='NASA/JPL/MSSS · Caltech Murray Lab · Esri CTX';
export const DEM_CREDIT='NASA/ESA/USGS · HRSC/MOLA 200 m · Esri';
export function sampleGrid(grid,width,b,lon,lat){
 if(lon<b[0]||lon>b[2]||lat<b[1]||lat>b[3])return undefined;
 const x=Math.max(0,Math.min(width-1,(lon-b[0])/(b[2]-b[0])*(width-1))),y=Math.max(0,Math.min(width-1,(b[3]-lat)/(b[3]-b[1])*(width-1)));
 const i=Math.min(width-2,Math.floor(x)),j=Math.min(width-2,Math.floor(y)),u=x-i,v=y-j,a=[grid[j*width+i],grid[j*width+i+1],grid[(j+1)*width+i],grid[(j+1)*width+i+1]];
 return a.every(Number.isFinite)?a[0]*(1-u)*(1-v)+a[1]*u*(1-v)+a[2]*(1-u)*v+a[3]*u*v:undefined;
}
export function blendTerrain(base,native,bounds,width=129,fallback){
 const out=new Float32Array(width*width);for(let row=0;row<width;row++)for(let col=0;col<width;col++){
  const lon=bounds[0]+col/(width-1)*(bounds[2]-bounds[0]),lat=bounds[3]-row/(width-1)*(bounds[3]-bounds[1]);
  const detail=native?(sampleGrid(native.grid,native.width,native.bounds,lon,lat)??(native.transition?sampleGrid(native.transition.grid,native.transition.width,native.transition.bounds,lon,lat):undefined)):undefined,context=sampleGrid(base.grid,base.width,base.bounds,lon,lat)??fallback?.(lon,lat);
  if(!Number.isFinite(detail)&&!Number.isFinite(context))throw new Error('Elevation is unknown at this position.');
  const weight=native?.transition?sampleGrid(native.transition.confidence,native.transition.width,native.transition.bounds,lon,lat)??0:1;
  out[row*width+col]=Number.isFinite(detail)&&Number.isFinite(context)?context+(detail-context)*weight:detail??context;
 }return out;
}
const globalTiles=new Map(),globalReady=new Map(),polarTransfers=new Map(),sourceTransfers=new Map(),nativeTransfers=new TileQueue(3,96);
let molaPromise,molaValues;
function molaBase(){if(!molaPromise)molaPromise=fetch('/mola-topography.dat',{signal:AbortSignal.timeout(25000)}).then(async r=>{if(!r.ok)throw new Error('Global MOLA fallback is unavailable.');const body=await r.arrayBuffer(),magic=new Uint8Array(body);const bytes=magic[0]===0x1f&&magic[1]===0x8b?await new Response(new Blob([body]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():body;return molaValues=decodeTopography(bytes);}).catch(e=>{molaPromise=null;throw e;});return molaPromise;}
async function molaTile(x,y,z){const bounds=geographicBounds(x,y,z),values=await molaBase(),grid=new Float32Array(129*129);for(let row=0;row<129;row++)for(let col=0;col<129;col++)grid[row*129+col]=sampleHeight(values,bounds[0]+(bounds[2]-bounds[0])*col/128,bounds[3]-(bounds[3]-bounds[1])*row/128);return {grid,width:129,bounds,fallback:true};}
let requests=0;const queue=[];
export async function terrainRequest(task){if(requests<4)requests++;else await new Promise(r=>queue.push(r));try{return await task();}finally{const next=queue.shift();if(next)next();else requests--;}}
export function retainedTerrainParent(x,y,z,ready=globalReady){
 for(let parent=z-1;parent>=0;parent--){const factor=2**(z-parent),tile=ready.get(`${parent}/${Math.floor(y/factor)}/${Math.floor(x/factor)}`);if(tile)return tile;}
 return undefined;
}
function sourceTerrain(x,y,z){
 const key=`${z}/${y}/${x}`;if(sourceTransfers.has(key))return sourceTransfers.get(key);
 const task=terrainRequest(async()=>{const r=await fetch(`/api/planet?kind=terrain&z=${z}&y=${y}&x=${x}`,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Global terrain is temporarily unavailable.');const data=Lerc.decode(await r.arrayBuffer());if(data.width!==513||data.height!==513)throw new Error('The global terrain tile format changed.');const grid=data.pixels[0];if(data.mask)for(let i=0;i<grid.length;i++)if(!data.mask[i])grid[i]=NaN;return {grid,width:513,bounds:geographicBounds(x,y,z)};});
 sourceTransfers.set(key,task);const release=()=>{if(sourceTransfers.get(key)===task)sourceTransfers.delete(key);};task.then(release,release);return task;
}
export async function invalidTerrainFallback(x,y,z,{ready=globalReady,load=sourceTerrain,reference,fallback=molaTile}={}){
 const retained=retainedTerrainParent(x,y,z,ready);if(retained&&!retained.fallback)return retained;
 // Recover at most one independently validated parent, without a serial chain
 // of remote ancestors. A coarse transient fallback must not become permanent
 // when the real, much finer parent grid is available.
 if(z>1){const px=Math.floor(x/2),py=Math.floor(y/2),key=`${z-1}/${py}/${px}`;
  try{const parent=await load(px,py,z-1);if(!reference){const mola=await molaBase();reference=(lon,lat)=>sampleHeight(mola,lon,lat);}
   if(auditTerrainReference(parent,reference).valid){ready.set(key,parent);if(ready===globalReady)globalTiles.set(key,Promise.resolve(parent));return parent;}
  }catch{}
 }
 return retained??fallback(x,y,z);
}
async function globalTile(x,y,z){
 const level=Math.min(7,z),factor=2**(z-level),px=Math.floor(x/factor),py=Math.floor(y/factor),key=`${level}/${py}/${px}`;
 if(!globalTiles.has(key)){
  const promise=sourceTerrain(px,py,level).catch(error=>{
   // A damaged upstream tile must not stop the globe's entire quadtree.
   // Retain a verified coarser parent; never decode partial data or invent heights.
   console.warn('planet_coarser_terrain',key,error.message);
   // A failed chain of new parent transfers holds up Cesium's quadtree and
   // therefore sharp photography too. Reuse an already decoded measured parent,
   // otherwise sample the bundled measured MOLA grid without another remote read.
   return retainedTerrainParent(px,py,level)??molaTile(px,py,level);
  }).then(async result=>{
   if(!result.fallback){const reference=await molaBase(),audit=auditTerrainReference(result,(lon,lat)=>sampleHeight(reference,lon,lat));
    if(!audit.valid){console.warn('planet_inconsistent_elevation',key,audit);result=await invalidTerrainFallback(px,py,level);}
   }
   globalReady.set(key,result);while(globalReady.size>96)globalReady.delete(globalReady.keys().next().value);return result;
  });
  globalTiles.set(key,promise);promise.catch(()=>{if(globalTiles.get(key)===promise)globalTiles.delete(key);});while(globalTiles.size>96)globalTiles.delete(globalTiles.keys().next().value);
 }return globalTiles.get(key);
}
// Analysis overlays share the validated, bounded terrain cache with the globe.
// Avoid the known truncated level-zero service tile, as the geometry does.
const overlayDisplayGrids=new WeakMap();
export async function globalElevationTile(x,y,z){
 const tile=await(z===0?molaTile(x,y,z):globalTile(x,y,z).catch(()=>molaTile(x,y,z))),fallback=await molaBase();
 const reference=(lon,lat)=>sampleHeight(fallback,lon,lat);
 let display=overlayDisplayGrids.get(tile);if(!display){display=tile.fallback?tile.grid:stitchTerrainEdges(tile.grid,tile.width,tile.bounds,tile.bounds,reference);overlayDisplayGrids.set(tile,display);}
 return {...tile,heightAt:(lon,lat)=>sampleGrid(tile.grid,tile.width,tile.bounds,lon,lat)??reference(lon,lat),displayHeightAt:(lon,lat)=>sampleGrid(display,tile.width,tile.bounds,lon,lat)??reference(lon,lat)};
}
// Read-only display lookup: contour painting must not fan out terrain transfers.
export function cachedElevationTile(x,y,z){return globalReady.get(`${z}/${y}/${x}`)??retainedTerrainParent(x,y,z);}
export async function overviewElevation(){const values=await molaBase();return {heightAt:(lon,lat)=>sampleHeight(values,lon,lat)};}
// A read-only height lookup for camera clearance. It never initiates transfers.
export function knownTerrainHeight(lon,lat,provider){
 const native=provider?.qualityAt?.(lon,lat);
 if(native&&Number.isFinite(native.height)&&!native.transitioned)return {height:native.height,source:'HiRISE DEM',spacing:native.terrain};
 const tile=[...globalReady.values()].filter(t=>!t.fallback&&lon>=t.bounds[0]&&lon<=t.bounds[2]&&lat>=t.bounds[1]&&lat<=t.bounds[3]).sort((a,b)=>(a.bounds[2]-a.bounds[0])-(b.bounds[2]-b.bounds[0]))[0];
 const height=tile&&sampleGrid(tile.grid,tile.width,tile.bounds,lon,lat);
 if(Number.isFinite(height))return {height,source:'HRSC/MOLA',spacing:Math.max(200,(tile.bounds[3]-tile.bounds[1])*Math.PI/180*3396190/(tile.width-1))};
 return molaValues?{height:sampleHeight(molaValues,lon,lat),source:'MOLA overview',spacing:Math.PI*3396190/720}:null;
}
export async function polarTerrainBase(x,y,z,{ready=globalReady,transfers=polarTransfers,load=globalTile,fallback=molaTile}={}){
 const level=Math.min(7,z),factor=2**(z-level),px=Math.floor(x/factor),py=Math.floor(y/factor),key=`${level}/${py}/${px}`;
 // A source timeout must not hold the polar quadtree (and its photographs)
 // on a coarse ancestor. Geometry uses already measured elevation immediately;
 // subsequent children can pick up better grids as their bounded reads finish.
 const exact=ready.get(key);if(exact)return exact;
 if(!transfers.has(key)&&transfers.size<4){const task=Promise.resolve().then(()=>load(x,y,z)).catch(()=>undefined).finally(()=>{if(transfers.get(key)===task)transfers.delete(key);});transfers.set(key,task);}
 for(let parent=level-1;parent>=0;parent--){const scale=2**(level-parent),known=ready.get(`${parent}/${Math.floor(py/scale)}/${Math.floor(px/scale)}`);if(known)return known;}
 return fallback(x,y,z);
}
async function nativeLevel(dataset,x,y,z,sourceLevel,signal){
 const factor=2**(z-sourceLevel),sx=Math.floor(x/factor),sy=Math.floor(y/factor),version=(dataset.terrain[0].sha256??dataset.terrain[0].md5??'').slice(0,16),key=`${dataset.id}/${version}/2/${sourceLevel}/${sy}/${sx}`;
 return nativeTransfers.get(key,sharedSignal=>recoverSurfaceRead(async()=>{const r=await fetch(`/api/elevation?dataset=${encodeURIComponent(dataset.id)}&v=${version}&g=2&z=${sourceLevel}&y=${sy}&x=${sx}`,{signal:AbortSignal.any([sharedSignal,AbortSignal.timeout(45000)])});if(!r.ok)throw new Error('Detailed terrain is temporarily unavailable.');const data=unpackElevation(await r.arrayBuffer());return {...data,bounds:geographicBounds(sx,sy,sourceLevel)};},{alive:()=>!sharedSignal.aborted}),signal);
}
export async function retainMeasuredTerrain(coarse,levels,load,signal){
 let previous=coarse;
 for(const level of levels){try{previous=await load(level);}catch(error){if(signal?.aborted)throw error;console.warn('native_coarser_terrain',level,error.message);break;}}
 return {...previous,transition:coarse};
}
async function nativeTile(dataset,x,y,z,signal){
 const coarse=await nativeLevel(dataset,x,y,z,10,signal);
 return retainMeasuredTerrain(coarse,z>=17?[15,17]:z>=15?[15]:[],level=>nativeLevel(dataset,x,y,z,level,signal),signal);
}
export class MarsTerrain{
 constructor(C,ellipsoid,{dataset=null,onReady=()=>{},onError=()=>{}}={}){
  // Start from the eight valid level-one service tiles. The published eastern
  // level-zero tile is truncated; its children retain the original elevations.
  this.C=C;this.tilingScheme=new C.GeographicTilingScheme({ellipsoid,numberOfLevelZeroTilesX:4,numberOfLevelZeroTilesY:2});this.errorEvent=new C.Event();this.credit=new C.Credit(DEM_CREDIT);this.hasWaterMask=false;this.hasVertexNormals=false;this.dataset=dataset;this.samples=new Map();this.displaySamples=new Map();this.controllers=new Set();this.onReady=onReady;this.onError=onError;this.disposed=false;
  this.error0=C.TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(ellipsoid,129,4);
 }
 getLevelMaximumGeometricError(level){
  // A sudden 4× jump at level 9 also made Cesium select coarser photographic
  // tiles on a finer mesh. Ramp native refinement without increasing child error.
  const native=this.dataset?Math.min(4,2**(Math.max(0,level-7)/2)):1;
  return this.error0*native/2**level;
 }
 getTileDataAvailable(x,y,level){return level<=14||(level<=16&&this.dataset?.status==='complete'&&overlaps(geographicBounds(x,y,level+1),this.dataset.bounds));}
 loadTileDataAvailability(){return undefined;}
 requestTileGeometry(x,y,level,request){
  const controller=new AbortController();const run=async()=>{this.controllers.add(controller);try{return await this.buildTile(x,y,level,controller.signal);}catch(error){if(!controller.signal.aborted)console.warn('mars_geometry_failed',level,y,x,error.stack??error.message);throw error;}finally{this.controllers.delete(controller);}};
  if(request){request.url=new URL(`/api/planet?view=geometry/${level}/${y}/${x}`,location.href).href;request.requestFunction=run;request.cancelFunction=()=>controller.abort();return this.C.RequestScheduler.request(request);}return run();
 }
 async buildTile(x,y,level,signal){
  const z=level+1;
  // Include coarse ancestors that intersect the cap. Waiting on a 45°–90°
  // parent would otherwise block all of its finer polar children first.
  const b=geographicBounds(x,y,z),polar=b[3]>75||b[1]<-75;
  // Coarse ancestors gate all their imagery children. The bundled measured
  // MOLA grid already resolves these world-scale meshes: do not serialize
  // remote terrain round trips before CTX can refine. Local levels retain the
  // existing validated HRSC/MOLA and native observation paths.
  const base=level===0?await molaTile(x,y,z):polar?await polarTerrainBase(x,y,z):z<=4?await molaTile(x,y,z):await globalTile(x,y,z);let native;
  if(signal.aborted)throw new DOMException('View changed.','AbortError');
  if(z>=10&&this.dataset?.status==='complete'&&overlaps(b,this.dataset.bounds)){try{native=await nativeTile(this.dataset,x,y,z,signal);if(!this.disposed){this.samples.set(`${z}/${y}/${x}`,native);while(this.samples.size>64)this.samples.delete(this.samples.keys().next().value);this.onReady();}}catch(e){if(signal.aborted)throw e;if(!this.disposed)this.onError(e);}}
  const mola=await molaBase(),reference=(lon,lat)=>sampleHeight(mola,lon,lat),sourceLevel=Math.min(z,7),factor=2**(z-sourceLevel);
  const sourceBounds=geographicBounds(Math.floor(x/factor),Math.floor(y/factor),sourceLevel);
  // Mesh resolution is independent of the publisher grid used for readouts
  // and routing. Nested 65/129 grids keep common border samples coincident.
  const meshWidth=z>=7&&!native?65:129;
  const context=stitchTerrainEdges(blendTerrain(base,null,b,meshWidth,reference),meshWidth,b,sourceBounds,reference);
  const grid=native?blendTerrain({grid:context,width:meshWidth,bounds:b},native,b,meshWidth,reference):context;
  if(native&&!this.disposed){this.displaySamples.set(`${z}/${y}/${x}`,{grid,width:129,bounds:b});while(this.displaySamples.size>96)this.displaySamples.delete(this.displaySamples.keys().next().value);}
  let mask=0;for(const [dx,dy,bit] of [[0,1,1],[1,1,2],[0,0,4],[1,0,8]])if(this.getTileDataAvailable(x*2+dx,y*2+dy,level+1))mask|=bit;
  if(b[3]===90)grid.fill(sampleHeight(mola,0,90),0,meshWidth);
  if(b[1]===-90)grid.fill(sampleHeight(mola,0,-90),(meshWidth-1)*meshWidth);
  return z>=7?continuousMesh(this.C,this.tilingScheme.ellipsoid,grid,b,mask,this.getLevelMaximumGeometricError(level)):new this.C.HeightmapTerrainData({buffer:grid,width:meshWidth,height:meshWidth,childTileMask:mask});
 }
 qualityAt(lon,lat){for(const n of [...this.samples.values()].sort((a,b)=>(a.bounds[2]-a.bounds[0])-(b.bounds[2]-b.bounds[0]))){const height=sampleGrid(n.grid,n.width,n.bounds,lon,lat);if(Number.isFinite(height))return {height,terrain:n.gridMeters,mesh:(n.bounds[3]-n.bounds[1])*Math.PI/180*3396190/128,transitioned:n.transition?((sampleGrid(n.transition.confidence,n.transition.width,n.transition.bounds,lon,lat)??0)<.999):false};}return null;}
 backgroundQualityAt(lon,lat){
  const tile=[...globalReady.values()].filter(t=>lon>=t.bounds[0]&&lon<=t.bounds[2]&&lat>=t.bounds[1]&&lat<=t.bounds[3]).sort((a,b)=>(a.bounds[2]-a.bounds[0])-(b.bounds[2]-b.bounds[0]))[0];
  return tile?{source:tile.fallback?'MOLA fallback':'HRSC/MOLA',metres:tile.fallback?Math.PI*3396190/720:200}:null;
 }
 displayHeightAt(lon,lat){for(const n of [...this.displaySamples.values()].sort((a,b)=>(a.bounds[2]-a.bounds[0])-(b.bounds[2]-b.bounds[0]))){const h=sampleGrid(n.grid,n.width,n.bounds,lon,lat);if(Number.isFinite(h))return h;}return undefined;}
 dispose(){this.disposed=true;for(const c of this.controllers)c.abort();this.samples.clear();this.displaySamples.clear();}
}

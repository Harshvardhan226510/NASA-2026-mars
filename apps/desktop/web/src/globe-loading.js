// Keep one LOD tolerance throughout a pan/zoom. Raising it on moveStart selected
// coarser terrain AND coarser attached imagery, even when sharper tiles were ready.
// Cesium's normal refinement keeps loaded ancestors until children are renderable.
export function stableGlobeDetail(viewer,{compatible=false}={}){
 const globe=viewer.scene.globe;
 // Keep the tolerance fixed for each renderer, including while the camera moves.
 // Compatible graphics trade some mesh refinement for lower software-GPU cost.
 globe.maximumScreenSpaceError=compatible?1.15:.6;
 globe.tileCacheSize=256;
 globe.preloadAncestors=true;
 globe.preloadSiblings=false;
}
// Custom image processing can outlive Cesium's network-completion render.
// Wake requestRenderMode as soon as pixels are ready; debounce only UI readouts.
export function imageryReadyCallback(viewer,update=()=>{},requestFrame=requestAnimationFrame){
 let pending=false;
 return ()=>{
  viewer.scene.requestRender();
  if(!pending){pending=true;requestFrame(()=>{pending=false;update();});}
 };
}
export const GLOBE_OVERVIEW={url:'/globe-overview-{x}.jpg',tileWidth:2048,tileHeight:2048,maximumLevel:0};

export const CTX_PREFETCH_ALTITUDE_M=100_000;
const CTX_DETAIL_LEVEL=12;

export function mapLoadingMessage({showGlobe,showFlat,native,retrying,prefetch,globe,flat}){
 if(showGlobe&&native)return retrying?'Retrying surface data…':'Loading HiRISE detail…';
 if(showGlobe&&prefetch)return 'Loading 5 m/px CTX imagery…';
 if(showGlobe&&globe)return 'Loading map detail…';
 if(showFlat&&flat)return 'Loading 2D imagery…';
 return '';
}

// Warm one native-resolution tile near the reticle. Normal Cesium LOD still
// chooses what to draw across the viewport, so a 100 km view stays progressive.
export class CtxDetailPrefetch{
 constructor(focus,onPending=()=>{}){this.focus=focus;this.onPending=onPending;}
 update(altitude,provider){
  const point=provider&&Number.isFinite(altitude)&&altitude<=CTX_PREFETCH_ALTITUDE_M?this.focus():null;
  const [lon,lat]=point??[];
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>88){
   if(this.controller){this.controller.abort();this.onPending(false);}
   this.controller=null;this.provider=null;this.tile=null;return;
  }
  const span=180/2**CTX_DETAIL_LEVEL,wrapped=((lon+180)%360+360)%360;
  const x=Math.floor(wrapped/span),y=Math.floor((90-lat)/span),tile=x+'/'+y;
  if(this.provider===provider&&this.tile===tile)return;
  this.controller?.abort();
  const controller=this.controller=new AbortController();this.provider=provider;this.tile=tile;
  this.onPending(true);
  // A failed warmup leaves the normal renderer free to retry the source.
  provider.prefetch({x,y,z:CTX_DETAIL_LEVEL},controller.signal).catch(()=>{}).finally(()=>{
   if(this.controller===controller){this.controller=null;this.onPending(false);}
  });
 }
}

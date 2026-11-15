import {MarsTerrain,geographicBounds} from './planet.js';
import {imageryWindow,imageryRootLevel} from './imagery-window.js';
import {displayTexture,prefetchDisplay,overviewTexture} from './display-tiles.js';
import {retainedImagery,cropMeasuredImage} from './imagery-fallback.js';
import {Surface3D} from './surface.js';
import {recoverSurfaceRead} from './recovery.js';
class NativeImagery{
 constructor(C,dataset,spec,{onReady,onError,onPending}){this.C=C;this.dataset=dataset;this.onReady=onReady;this.onError=onError;this.onPending=onPending;this.tilingScheme=new C.GeographicTilingScheme({ellipsoid:C.Ellipsoid.default});const b=dataset.bounds,epsilon=Math.min(b[2]-b[0],b[3]-b[1])*1e-6;
  // Avoid zero-area intersections with cached terrain neighbours at exactly
  // matching tile edges. The sub-pixel inset affects display clipping only.
  // A stable observation rectangle lets Cesium refine its normal imagery tree.
  // Replacing very high minimum-level windows while zooming produced clipped
  // texture strips. Visible requests are still bounded by Cesium and TileQueue.
  this.rectangle=C.Rectangle.fromDegrees(b[0]+epsilon,b[1]+epsilon,b[2]-epsilon,b[3]-epsilon);this.tileWidth=512;this.tileHeight=512;this.minimumLevel=imageryRootLevel(b);this.maximumLevel=17;this.hasAlphaChannel=true;this.errorEvent=new C.Event();this.credit=new C.Credit('NASA/HiRISE · prepared observations from Google Drive');this.samples=new Map();this.controllers=new Set();this.pending=0;this.disposed=false;}
 getTileCredits(){return undefined;}
 pickFeatures(){return undefined;}
 cancelStale(all=false){for(const item of this.controllers)if(all||item.request?.cancelled){item.request?.cancel();item.controller.abort();}}
 requestImage(x,y,z,request){
  this.cancelStale();const bounds=geographicBounds(x,y,z),key=`${z}/${y}/${x}`,controller=new AbortController(),consumer={controller,request};
  const run=()=>{const started=performance.now();this.controllers.add(consumer);this.pending++;this.onPending();return recoverSurfaceRead(()=>displayTexture(this.dataset,bounds,512,controller.signal),{alive:()=>!this.disposed&&!controller.signal.aborted}).catch(async error=>{if(this.disposed||controller.signal.aborted)throw error;const parent=retainedImagery(this.samples.values(),bounds);console.info('native_retained_imagery',key,parent?'loaded parent':'prepared overview');return parent?cropMeasuredImage(parent,bounds):overviewTexture(this.dataset,bounds,512,controller.signal);}).then(image=>{if(!this.disposed){this.samples.set(key,{image,bounds});while(this.samples.size>48)this.samples.delete(this.samples.keys().next().value);this.onReady();console.info('native_imagery_ready',key,Math.round(performance.now()-started)+'ms');}return image;}).catch(e=>{if(!this.disposed&&!controller.signal.aborted)this.onError(e);throw e;}).finally(()=>{this.controllers.delete(consumer);this.pending--;if(!this.disposed)this.onPending();});};
  if(request){request.url=new URL(`/api/surface?observation=${this.dataset.id}&view=${key}`,location.href).href;request.requestFunction=run;request.cancelFunction=()=>controller.abort();return this.C.RequestScheduler.request(request);}return run();
 }
 checkedAt(lon,lat){return [...this.samples.values()].some(({bounds:b})=>lon>=b[0]&&lon<=b[2]&&lat>=b[1]&&lat<=b[3]);}
 qualityAt(lon,lat){for(const {image,bounds:b} of [...this.samples.values()].sort((a,b)=>(a.bounds[2]-a.bounds[0])-(b.bounds[2]-b.bounds[0]))){if(lon<b[0]||lon>b[2]||lat<b[1]||lat>b[3])continue;const x=Math.min(511,Math.max(0,Math.floor((lon-b[0])/(b[2]-b[0])*512))),y=Math.min(511,Math.max(0,Math.floor((b[3]-lat)/(b[3]-b[1])*512)));if(image.getContext('2d').getImageData(x,y,1,1).data[3])return {imagery:image.gridMeters};}return null;}
 destroy(){this.disposed=true;this.cancelStale(true);}
}
export class ContinuousSurface{
 constructor(viewer,raster,{onStatus,onError,onReady}={}){this.viewer=viewer;this.raster=raster;this.onStatus=onStatus;this.onError=onError;this.onReady=onReady;this.disposed=false;this.timer=null;this.exaggeration=1;const C=window.Cesium,schedule=()=>this.schedule();this.terrain=new MarsTerrain(C,viewer.scene.globe.ellipsoid,{dataset:raster.dataset,onReady:schedule,onError});viewer.terrainProvider=this.terrain;this.removeChange=viewer.camera.changed.addEventListener(schedule);this.removeProgress=viewer.scene.globe.tileLoadProgressEvent.addEventListener(schedule);this.update();}
 schedule(){if(this.disposed)return;this.imagery?.cancelStale();clearTimeout(this.timer);this.timer=setTimeout(()=>{this.viewer.scene.requestRender();const remove=this.viewer.scene.postRender.addEventListener(()=>{remove();this.update();});},100);}
 retirePrevious(){this.previousImagery?.destroy();if(this.previousLayer)this.viewer.imageryLayers.remove(this.previousLayer);this.previousImagery=this.previousLayer=null;}
 setWindow(spec){const key=spec?this.raster.dataset.id:null;if(this.windowKey===key)return;this.windowKey=key;this.retirePrevious();this.imagery?.destroy();if(this.layer)this.viewer.imageryLayers.remove(this.layer);this.imagery=this.layer=null;if(!spec)return;const C=window.Cesium;this.imagery=new NativeImagery(C,this.raster.dataset,spec,{onReady:()=>{this.onReady?.();this.schedule();},onError:this.onError,onPending:()=>this.schedule()});this.layer=new C.ImageryLayer(this.imagery,{minimumTerrainLevel:8});this.viewer.imageryLayers.add(this.layer);this.viewer.scene.requestRender();console.info('native_observation_layer',this.raster.dataset.id);}
 sourceElevation(lon,lat){return this.terrain.qualityAt(lon,lat)?.height;}
 setImageryVisible(show){this.imageryVisible=show;if(!show)this.setWindow(null);this.update();}
 sampleHeight(lon,lat){const C=window.Cesium,height=this.terrain.displayHeightAt(lon,lat);return Number.isFinite(height)?height*this.exaggeration:this.viewer.scene.globe.getHeight(C.Cartographic.fromDegrees(lon,lat));}
 view(){return Surface3D.prototype.view.call(this);}
 qualityAt(lon,lat){const image=this.imagery?.qualityAt(lon,lat)??this.previousImagery?.qualityAt(lon,lat),elevation=this.terrain.qualityAt(lon,lat);return image?{...image,terrain:elevation?.terrain??200,mesh:elevation?.mesh??200,nativeTerrain:Boolean(elevation),terrainTransition:Boolean(elevation?.transitioned)}:null;}
 update(){if(this.disposed)return;const {focus,perPixel,visible}=this.view(),limit=this.imagery?11:8;this.setWindow(this.imageryVisible!==false&&(perPixel<=limit||this.viewer.camera.positionCartographic.height-(this.sampleHeight(window.Cesium.Math.toDegrees(this.viewer.camera.positionCartographic.longitude),window.Cesium.Math.toDegrees(this.viewer.camera.positionCartographic.latitude))??0)<1000)?imageryWindow(this.raster.dataset,visible,focus,perPixel,this.viewer.canvas.clientWidth,this.viewer.canvas.clientHeight):null);if(this.imagery?.qualityAt(...focus))this.retirePrevious();const q=this.qualityAt(...focus),pending=this.imagery?.pending??0,nativeChecked=this.imagery?.checkedAt(...focus)??false;this.onStatus?.(pending,{focus,perPixel,quality:q,imageMeters:q?.imagery??5,meshMeters:q?.mesh??200,refining:pending>0||Boolean(this.imagery&&!nativeChecked),context:!q,nativeChecked});
  const key=perPixel<=8?focus.map(v=>Math.floor(v*100)).join('/'):null;if(key!==this.prefetchKey){this.prefetchKey=key;clearTimeout(this.prefetchTimer);this.prefetchController?.abort();if(key){const controller=this.prefetchController=new AbortController();this.prefetchTimer=setTimeout(()=>prefetchDisplay(this.raster.dataset,focus,controller.signal),900);}}
 }
 setExaggeration(value){this.exaggeration=value;this.viewer.scene.verticalExaggeration=value;this.viewer.scene.verticalExaggerationRelativeHeight=0;this.viewer.scene.requestRender();this.schedule();}
 destroy(){this.disposed=true;clearTimeout(this.timer);clearTimeout(this.prefetchTimer);this.prefetchController?.abort();this.removeChange();this.removeProgress();this.terrain.dispose();this.retirePrevious();this.imagery?.destroy();if(this.layer)this.viewer.imageryLayers.remove(this.layer);this.viewer.terrainProvider=new MarsTerrain(window.Cesium,this.viewer.scene.globe.ellipsoid);}
}

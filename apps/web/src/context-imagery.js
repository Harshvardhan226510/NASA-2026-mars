import L from 'leaflet';
import {loadContextImage,cachedContextImage,croppedContextLevel,contextAncestor,contextTileQuality} from './context-display.js';
import {geographicBounds} from './planet-grid.js';
import {recoverSurfaceRead} from './recovery.js';
import {cropSourceMask} from './optical-gaps.js';

// Preserve the publisher's pixels and alpha; black shadows are not NoData.
export const PlanetImageLayer=L.GridLayer.extend({
 createTile(coords,done){
  const tile=document.createElement('canvas');tile.width=tile.height=this.options.tilePixels??512;
  tile.dataset.address=`${coords.z}/${coords.y}/${coords.x}`;
  const controller=new AbortController();tile.detailPending=true;tile.abort=()=>controller.abort();
  const ready=this._readyContext??=new Map();
  const read=address=>loadContextImage(this.options.url,address,this.options,controller.signal);
  let delivered=false;const deliver=()=>{if(!delivered){delivered=true;done(null,tile);}};
  const paint=async(canvas,image,address)=>{
   canvas.width=image.width;canvas.height=image.height;
   const c=canvas.getContext('2d',{willReadFrequently:true});c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0,canvas.width,canvas.height);
   canvas.sourceOpacityMask=image.sourceOpacityMask;canvas.dataset.sourceLevel=String(image.dataset?.sourceLevel??address.z);canvas.dataset.sourceState=image.dataset?.sourceState;
   ready.set(`${address.z}/${address.y}/${address.x}`,canvas);if(ready.size>32)ready.delete(ready.keys().next().value);
  };
  const parentFallback=async()=>{
   if(controller.signal.aborted)return;
   let parent,image;
   for(let z=coords.z-1;z>=0;z--){parent=contextAncestor(coords,z);image=cachedContextImage(this.options.url,parent,this.options)??ready.get(`${z}/${parent.y}/${parent.x}`);if(image)break;}
   if(!image&&coords.z>(this.options.minimumSourceLevel??0)&&!this.options.immediateFallback){parent=contextAncestor(coords,coords.z-1);image=await read(parent);if(controller.signal.aborted)return;}
   if(image){const [x,y,w,h]=parent.window;tile.getContext('2d').drawImage(image,x*image.width,y*image.height,w*image.width,h*image.height,0,0,tile.width,tile.height);tile.sourceOpacityMask=cropSourceMask(image,parent.window,tile.width,tile.height);tile.dataset.sourceLevel=String(croppedContextLevel(image,parent.z,tile.width));tile.dataset.sourceState=image.dataset?.sourceState;}
  };
  // A ready ancestor from either map can paint immediately, without starting a
  // second download or replacing it with an empty canvas while detail loads.
  for(let z=coords.z-1;z>=0;z--){const parent=contextAncestor(coords,z),image=cachedContextImage(this.options.url,parent,this.options);if(!image)continue;const [x,y,w,h]=parent.window;tile.getContext('2d').drawImage(image,x*image.width,y*image.height,w*image.width,h*image.height,0,0,tile.width,tile.height);tile.sourceOpacityMask=cropSourceMask(image,parent.window,tile.width,tile.height);tile.dataset.sourceLevel=String(croppedContextLevel(image,z,tile.width));tile.dataset.sourceState=image.dataset?.sourceState;queueMicrotask(()=>{if(!controller.signal.aborted)deliver();});break;}
  recoverSurfaceRead(()=>read(coords),{alive:()=>!controller.signal.aborted}).then(async image=>{
   if(controller.signal.aborted)return;
   await paint(tile,image,coords);if(controller.signal.aborted)return;
   deliver();
  }).catch(async()=>{if(!delivered)try{await parentFallback();}catch{}if(!controller.signal.aborted)deliver();}).finally(()=>{tile.detailPending=false;});
  return tile;
 },
 onAdd(map){L.GridLayer.prototype.onAdd.call(this,map);this.on('tileunload',e=>e.tile.abort?.());},
 qualityAt(lon,lat){let best=null;for(const t of Object.values(this._tiles??{})){if(!t.loaded)continue;const q=contextTileQuality(t.el,t.coords,[lon,lat],this.options);if(q&&(!best||q.metres<best.metres))best=q;}return best;},
 loadingAt(lon,lat){return Object.values(this._tiles??{}).some(t=>{const b=geographicBounds(t.coords.x,t.coords.y,t.coords.z);return !t.loaded&&lon>=b[0]&&lon<=b[2]&&lat>=b[1]&&lat<=b[3];});},
 hasPendingDetail(){return Object.values(this._tiles??{}).some(tile=>tile.current&&tile.el.detailPending);}
});
export const CTXLayer=PlanetImageLayer.extend({options:{tilePixels:512,polarOverview:true,maskEdges:true,bootstrapOverview:true,source:'CTX',nativeMeters:5}});
export const ThermalContextLayer=PlanetImageLayer.extend({options:{tilePixels:256,infraredDisplay:true,source:'THEMIS infrared',nativeMeters:100}});
export const GrayscaleBaseLayer=PlanetImageLayer.extend({options:{tilePixels:256,grayscale:true,source:'Viking',nativeMeters:232}});

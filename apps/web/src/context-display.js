import {geographicBounds} from './planet-grid.js';
import {composeOpticalGaps,cropSourceMask} from './optical-gaps.js';
import {TileQueue} from './tile-queue.js';
import {scheduledImage} from './scheduled-image.js';
import {tintOpticalTile} from './viking-tint.js';

// One canonical north-up processed image per source/style, shared by Cesium,
// the full Leaflet map and the overview. Cancelling one view leaves others alive.
const contextImages=new TileQueue(6,64);
const contextBackground=new TileQueue(2,16);
const contextQueue=url=>/kind=baseline|\/(?:globe|color)-overview-/.test(url)?contextBackground:contextImages;
const detailComposites=new Map();
const colourReference=new TileQueue(3,24);
const colourJobs=new Map();let colourWorker,nextColourId=0;

function tintFrame({data,width,height},tone,side,signal){
 signal.throwIfAborted();
 if(typeof Worker!=='undefined'&&colourWorker===undefined){
  try{
   colourWorker=new Worker(new URL('./viking-worker.js',import.meta.url),{type:'module'});
   colourWorker.onmessage=({data:{id,pixels}})=>colourJobs.get(id)?.finish(pixels);
   colourWorker.onerror=event=>{
    event.preventDefault();
    colourWorker.terminate();colourWorker=null;
    for(const job of colourJobs.values())job.finish(null);
   };
  }catch{colourWorker=null;}
 }
 const local=()=>{signal.throwIfAborted();tintOpticalTile(data,width,height,tone,side);return data;};
 if(!colourWorker)return Promise.resolve(local());
 return new Promise((resolve,reject)=>{
  const id=++nextColourId,cleanup=()=>{signal.removeEventListener('abort',abort);colourJobs.delete(id);};
  const abort=()=>{cleanup();reject(signal.reason);};
  const finish=pixels=>{cleanup();try{resolve(pixels??local());}catch(error){reject(error);}};
  signal.addEventListener('abort',abort,{once:true});colourJobs.set(id,{finish});
  try{const copy=data.slice();colourWorker.postMessage({id,pixels:copy,width,height,tone,side},[copy.buffer]);}catch{finish(null);}
 });
}
export const croppedContextLevel=(image,level,outputWidth)=>Number(image.dataset?.sourceLevel??level)+Math.log2(image.width/outputWidth);
export function contextImageKey(url,coords,options={}){
 const x=((coords.x%2**(coords.z+1))+2**(coords.z+1))%2**(coords.z+1);
 const address=url.replace('{z}',coords.z).replace('{x}',x).replace('{y}',coords.y);
 return address+JSON.stringify([Boolean(options.grayscale),Boolean(options.polarOverview),Boolean(options.maskEdges),Boolean(options.infraredDisplay),Boolean(options.polarDetail),options.opticalGaps?.base??null,options.opticalGaps?.primary??null,Boolean(options.bootstrapOverview),options.colourReference??null]);
}
export function cachedContextImage(url,coords,options={}){
 const cache=contextQueue(url).cache;
 // A complete ready child quartet can supply real finer pixels when a coarser
 // view asks for its parent again. Never fetch extra children for this reuse.
 if(options.reuseDetail!==false){
  const children=[];for(let y=0;y<2;y++)for(let x=0;x<2;x++)children.push(cache.get(contextImageKey(url,{x:coords.x*2+x,y:coords.y*2+y,z:coords.z+1},options)));
  if(children.every(Boolean)&&children.every(c=>c.width===children[0].width&&c.height===children[0].height)&&children[0].width<=512){
   const key=contextImageKey(url,coords,options),existing=detailComposites.get(key);
   if(existing&&existing.children.every((c,i)=>c===children[i]))return existing.canvas;
   const size=children[0].width,out=document.createElement('canvas');out.width=size*2;out.height=children[0].height*2;
   const ctx=out.getContext('2d'),mask=new Uint8Array(Math.ceil(out.width*out.height/8));
   children.forEach((image,i)=>{const x=i%2*size,y=Math.floor(i/2)*image.height;ctx.drawImage(image,x,y);const record=contextQualityRecord(image,{z:coords.z+1});for(let row=0;row<image.height;row++)for(let col=0;col<image.width;col++){const p=row*image.width+col,j=(y+row)*out.width+x+col;if(!record.opacityMask||(record.opacityMask[p>>3]&(1<<(p&7))))mask[j>>3]|=1<<(j&7);}});
   out.sourceOpacityMask=mask;out.dataset.sourceLevel=String(Math.min(coords.z,...children.map(c=>Number(c.dataset?.sourceLevel??coords.z+1)-1)));if(children.some(c=>c.dataset?.sourceState==='overview'))out.dataset.sourceState='overview';detailComposites.delete(key);detailComposites.set(key,{children,canvas:out});while(detailComposites.size>8)detailComposites.delete(detailComposites.keys().next().value);return out;
  }
  const retained=detailComposites.get(contextImageKey(url,coords,options));if(retained){const key=contextImageKey(url,coords,options);detailComposites.delete(key);detailComposites.set(key,retained);return retained.canvas;}
 }
 const key=contextImageKey(url,coords,options),image=cache.get(key);
 if(image){cache.delete(key);cache.set(key,image);}return image;
}
export function loadContextImage(url,coords,options={},signal){
 if(signal?.aborted)return Promise.reject(signal.reason??new DOMException('View changed','AbortError'));
 const cached=cachedContextImage(url,coords,options);if(cached)return Promise.resolve(cached);
 const key=contextImageKey(url,coords,options);
 return contextQueue(url).get(key,async sharedSignal=>{
  if(options.bootstrapOverview&&coords.z<=4){
   const parent=contextAncestor(coords,0),root=await loadContextImage('/globe-overview-{x}.jpg',parent,{},sharedSignal),canvas=document.createElement('canvas');canvas.width=canvas.height=512;const [x,y,w,h]=parent.window;
   canvas.getContext('2d').drawImage(root,x*root.width,y*root.height,w*root.width,h*root.height,0,0,512,512);canvas.dataset.sourceLevel=String(Math.min(coords.z,croppedContextLevel(root,0,512)));canvas.dataset.sourceState='overview';return canvas;
  }
  const x=((coords.x%2**(coords.z+1))+2**(coords.z+1))%2**(coords.z+1),address=url.replace('{z}',coords.z).replace('{x}',x).replace('{y}',coords.y);
  const response=await fetch(address,{signal:AbortSignal.any([sharedSignal,AbortSignal.timeout(20000)])});
  if(!response.ok){const error=Error('Planet tile unavailable');error.permanent=response.status===400||response.status===404;throw error;}
  const bitmap=await createImageBitmap(await response.blob()),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(bitmap,0,0);bitmap.close();
  if(needsContextTransform(coords,options)){const frame=c.getImageData(0,0,canvas.width,canvas.height);transformContextPixels(frame.data,canvas.width,canvas.height,coords,options);c.putImageData(frame,0,0);}
  if(options.opticalGaps)await composeOpticalGaps(canvas,coords,options.opticalGaps);
  if(options.colourReference)await applyVikingColour(canvas,{...coords,x},options.colourReference,sharedSignal);
  sharedSignal.throwIfAborted();return canvas;
 },signal);
}

async function applyVikingColour(canvas,coords,url,signal){
 const {x,y,z,window:[u,v,w,h]}=contextAncestor(coords,Math.min(7,coords.z));
 const address=url.replace('{z}',z).replace('{x}',x).replace('{y}',y);
 const reference=await colourReference.get(address,async sharedSignal=>{
  const response=await fetch(address,{signal:AbortSignal.any([sharedSignal,AbortSignal.timeout(6500)])});
  if(!response.ok)throw Error('Viking colour reference unavailable.');
  return createImageBitmap(await response.blob());
 },signal);
 const sample=document.createElement('canvas');sample.width=Math.min(canvas.width,Math.max(8,Math.ceil(w*reference.width*2)));sample.height=sample.width;
 const sc=sample.getContext('2d',{willReadFrequently:true});
 sc.drawImage(reference,u*reference.width,v*reference.height,w*reference.width,h*reference.height,0,0,sample.width,sample.height);
 const tone=sc.getImageData(0,0,sample.width,sample.height).data;
 const ctx=canvas.getContext('2d'),frame=ctx.getImageData(0,0,canvas.width,canvas.height);
 const pixels=await tintFrame(frame,tone,sample.width,signal);
 frame.data.set(pixels);signal.throwIfAborted();
 ctx.putImageData(frame,0,0);
}

const smooth=(a,b,value)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);};
// The published CTX polar overviews contain radiating photographic-strip seams.
// Use measured Viking context at overview scale; reveal CTX as its cached
// sampling becomes finer than that context. This is display LOD, not new data.
export function polarOverviewOpacity(latitude,level){
 return 1-smooth(50,64,Math.abs(latitude))*(1-smooth(5,7,level));
}
export function polarTileHidden(coords){
 const bounds=geographicBounds(coords.x,coords.y,coords.z);
 return coords.z<=5&&(bounds[1]>=64||bounds[3]<=-64);
}
export function needsContextTransform(coords,options={}){
 if(options.grayscale||options.maskEdges||options.infraredDisplay||options.polarDetail)return true;
 if(!options.polarOverview||coords.z>=7)return false;
 const bounds=geographicBounds(coords.x,coords.y,coords.z);return Math.max(Math.abs(bounds[1]),Math.abs(bounds[3]))>50;
}
// Feather only verified missing-data boundaries. Darkness never identifies a
// gap: valid black shadows retain their original colour and opaque interiors.
export function featherMaskEdges(pixels,width,height,radius=4){
 let missing=false;for(let i=3;i<pixels.length;i+=4)if(pixels[i]===0){missing=true;break;}
 if(!missing)return false;
 const distance=new Uint8Array(width*height);distance.fill(radius);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x;if(!pixels[i*4+3])distance[i]=0;
  else distance[i]=Math.min(distance[i],x?distance[i-1]+1:radius,y?distance[i-width]+1:radius);
 }
 for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){const i=y*width+x;distance[i]=Math.min(distance[i],x+1<width?distance[i+1]+1:radius,y+1<height?distance[i+width]+1:radius);}
 for(let i=0;i<distance.length;i++)if(distance[i]<radius)pixels[i*4+3]=Math.round(pixels[i*4+3]*smooth(0,radius,distance[i]));
 return true;
}
export function contextFeatherPixels(coords,width){
 // Match the transition to the coarse optical support, rather than shrinking
 // it to a few metres when zooming into 5 m CTX. Keep work bounded per tile.
 const metresPerPixel=Math.PI*3396190/(width*2**coords.z);
 return Math.max(4,Math.min(32,Math.round(300/metresPerPixel)));
}
export function transformContextPixels(pixels,width,height,coords,{grayscale=false,polarOverview=false,maskEdges=false,infraredDisplay=false,polarDetail=false}={}){
 const bounds=geographicBounds(coords.x,coords.y,coords.z);
 const polar=polarOverview&&coords.z<7&&Math.max(Math.abs(bounds[1]),Math.abs(bounds[3]))>50;
 const feathered=maskEdges&&featherMaskEdges(pixels,width,height,contextFeatherPixels(coords,width));
 if(!grayscale&&!polar&&!infraredDisplay&&!polarDetail)return Boolean(feathered);
 for(let row=0;row<height;row++){
  const latitude=bounds[3]-(row+.5)/height*(bounds[3]-bounds[1]);let opacity=polar?polarOverviewOpacity(latitude,coords.z):1;
  if(infraredDisplay)opacity*=1-smooth(55,65,Math.abs(latitude));
  if(polarDetail)opacity*=smooth(60,72,Math.abs(latitude));
  for(let col=0;col<width;col++){
   const i=(row*width+col)*4;
   if(grayscale||infraredDisplay){let gray=Math.round(pixels[i]*.2125+pixels[i+1]*.7154+pixels[i+2]*.0721);
    // THEMIS mosaic DNs are already stretched visual temperatures, not calibrated
    // measurements. A restrained display ramp prevents cold terrain from looking
    // like an empty black rectangle. Original source bytes and masks stay intact.
    if(infraredDisplay)gray=Math.round(32+192*(gray/255)**.75);
    pixels[i]=pixels[i+1]=pixels[i+2]=gray;
   }
   if(opacity!==1)pixels[i+3]=Math.round(pixels[i+3]*opacity);
  }
 }
 return true;
}
export function contextCanvas(image,coords,options={}){
 if(!needsContextTransform(coords,options))return image;
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const context=canvas.getContext('2d',{willReadFrequently:true});
 // Cesium 1.145 requests ImageBitmap with flipY:true. Canvas uploads are
 // flipped again by its texture loader, so restore north-up before conversion.
 context.save();if(typeof ImageBitmap!=='undefined'&&image instanceof ImageBitmap){context.translate(0,canvas.height);context.scale(1,-1);}context.drawImage(image,0,0);context.restore();
 const frame=context.getImageData(0,0,canvas.width,canvas.height);transformContextPixels(frame.data,canvas.width,canvas.height,coords,options);context.putImageData(frame,0,0);
 image.close?.();return canvas;
}
export function contextAncestor(coords,level){
 const factor=2**(coords.z-level),x=Math.floor(coords.x/factor),y=Math.floor(coords.y/factor);
 return {x,y,z:level,window:[(coords.x-x*factor)/factor,(coords.y-y*factor)/factor,1/factor,1/factor]};
}
export function contextQualityRecord(image,coords){
 const {width,height}=image,record={width,height,dataset:{sourceLevel:String(image.dataset?.sourceLevel??coords.z),sourceState:image.dataset?.sourceState}};
 if(image.sourceOpacityMask){record.opacityMask=image.sourceOpacityMask;return record;}
 const frame=image.getContext?.('2d',{willReadFrequently:true})?.getImageData?.(0,0,width,height);
 if(frame){let opaque=true;const mask=new Uint8Array(Math.ceil(width*height/8));for(let i=0;i<width*height;i++){if(frame.data[i*4+3]>=128)mask[i>>3]|=1<<(i&7);else opaque=false;}if(!opaque)record.opacityMask=mask;}
 return record;
}
export function contextTileQuality(image,coords,point,{source='CTX',nativeMeters=5}={}){
 const bounds=geographicBounds(coords.x,coords.y,coords.z),[lon,lat]=point;
 if(image.width<=1||lon<bounds[0]||lon>bounds[2]||lat<bounds[1]||lat>bounds[3])return null;
 const x=Math.min(image.width-1,Math.max(0,Math.floor((lon-bounds[0])/(bounds[2]-bounds[0])*image.width)));
 const y=Math.min(image.height-1,Math.max(0,Math.floor((bounds[3]-lat)/(bounds[3]-bounds[1])*image.height)));
 // Test the publisher's mask, including our overview fade, at the query point.
 // A successfully downloaded transparent tile is not high-resolution coverage.
 const i=y*image.width+x,mask=image.opacityMask??image.sourceOpacityMask,alpha=mask?(mask[i>>3]&(1<<(i&7))?255:0):image.getContext?.('2d',{willReadFrequently:true})?.getImageData(x,y,1,1).data[3]??255;
 if(alpha<128)return null;
 const level=Number(image.dataset?.sourceLevel??coords.z);
 return {source:image.dataset?.sourceState==='overview'?'CTX / Viking overview':source,level,metres:Math.max(nativeMeters,Math.PI*3396190/(image.width*2**level)),fallback:level<coords.z};
}
export function planetImageryProvider(C,options,display={}){
 const provider=new C.UrlTemplateImageryProvider(options),requestImage=provider.requestImage.bind(provider);
 const failures=new Map(),ready=new Map(),observed=new Map(),pendingTiles=new Map();
 const retained=key=>{const image=ready.get(key);if(image){ready.delete(key);ready.set(key,image);}return image;};
 const observe=(key,image,coords)=>{observed.delete(key);observed.set(key,{coords,image:contextQualityRecord(image,coords)});if(observed.size>1024)observed.delete(observed.keys().next().value);display.onReady?.();};
 provider.errorEvent?.addEventListener(error=>{
  // Recreated imagery objects can report timesRetried=0 repeatedly. Count by
  // source address instead, so a damaged persistent tile cannot retry forever.
  const key=`${error.level}/${error.y}/${error.x}`,count=(failures.get(key)??0)+1;
  failures.set(key,count);error.retry=count<=2;
  if(failures.size>4096)failures.delete(failures.keys().next().value);
 });
 const load=(coords,request)=>{
  const key=`${coords.z}/${coords.y}/${coords.x}`,own=retained(key),shared=display.sharedImages?cachedContextImage(options.url,coords,display):null,cached=shared&&(!own||shared.width>own.width)?shared:own;
  if(cached)return Promise.resolve(cached).then(image=>{if(image!==own)observe(key,image,coords);else display.onReady?.();return image;});
  const address=display.sharedImages?options.url.replace('{z}',coords.z).replace('{x}',coords.x).replace('{y}',coords.y):null;
  const pending=display.sharedImages?scheduledImage(C,request,typeof location==='undefined'?address:new URL(address,location.href).href,signal=>loadContextImage(options.url,coords,display,signal)):requestImage(coords.x,coords.y,coords.z,request);if(!pending)return undefined;
  pendingTiles.set(key,coords);
  return Promise.resolve(pending).then(async image=>{let result=display.sharedImages?image:contextCanvas(image,coords,display);if(display.opticalGaps&&!display.sharedImages)result=await composeOpticalGaps(result,coords,display.opticalGaps);ready.set(key,result);if(ready.size>64)ready.delete(ready.keys().next().value);observe(key,result,coords);failures.delete(key);return result;}).finally(()=>pendingTiles.delete(key));
 };
 const empty=()=>{const image=document.createElement('canvas');image.width=image.height=1;image.dataset.sourceState='unavailable';return image;};
 const crop=(image,parent,coords)=>{
  const out=document.createElement('canvas');out.width=out.height=image.width;
  const [x,y,w,h]=parent.window;
  out.getContext('2d').drawImage(image,x*image.width,y*image.height,w*image.width,h*image.height,0,0,out.width,out.height);
  out.sourceOpacityMask=cropSourceMask(image,parent.window,out.width,out.height);
  out.dataset.sourceLevel=String(croppedContextLevel(image,parent.z,out.width));out.dataset.sourceState=image.dataset?.sourceState;out.dataset.requestedLevel=String(coords.z);return out;
 };
 const fallback=async coords=>{
  // Retain measured, geographically cropped ancestors when a finer transfer
  // is damaged. A ready transparent overlay lets the lower genuine layers draw;
  // leaving a failed overlay unresolved can expose the globe's flat base colour.
  for(let level=coords.z-1;level>=0;level--){const parent=contextAncestor(coords,level),image=retained(`${level}/${parent.y}/${parent.x}`)??(display.sharedImages?cachedContextImage(options.url,parent,display):null);if(image?.width>1)return crop(image,parent,coords);}
  if(coords.z>(display.minimumSourceLevel??0)&&!display.immediateFallback){const parent=contextAncestor(coords,coords.z-1);try{const pending=load(parent);if(pending)return crop(await pending,parent,coords);}catch{}}
  if(display.grayscale&&coords.z>2){const root=contextAncestor(coords,0);try{const pending=load(root);if(pending)return crop(await pending,root,coords);}catch{}}
  return empty();
 };
 provider.requestImage=(x,y,z,request)=>{const coords={x,y,z};
  if(z<(display.minimumSourceLevel??0))return Promise.resolve(empty());
  // Hidden polar overviews do not need a transfer; the genuine Viking layer
  // remains visible until the CTX source sampling becomes useful.
  if(display.polarOverview&&polarTileHidden(coords))return Promise.resolve(empty());
  const pending=load(coords,request);return pending?pending.catch(async error=>{
   // A cancelled consumer must not turn a pan into a successful coarse tile.
   if(request?.cancelled)throw error;
   const key=`${z}/${y}/${x}`,completed=retained(key);if(completed)return completed;
   const image=await fallback(coords),newer=retained(key);if(newer)return newer;
   observe(key,image,coords);return image;
  }):undefined;
 };
 provider.qualityAt=(lon,lat)=>{
  let best=null;const point=[lon,lat];
  let selected;
  for(const [key,{coords,image}] of observed){const quality=contextTileQuality(image,coords,point,display);if(quality&&(!best||quality.metres<best.metres)){best=quality;selected=key;}}
  // Metadata outlives decoded canvas eviction: Cesium still owns those GPU
  // textures. Retain the centre's record while neighbouring strips load.
  if(selected){const record=observed.get(selected);observed.delete(selected);observed.set(selected,record);}
  return best;
 };
 provider.loadingAt=(lon,lat)=>[...pendingTiles.values()].some(c=>{const b=geographicBounds(c.x,c.y,c.z);return lon>=b[0]&&lon<=b[2]&&lat>=b[1]&&lat<=b[3];});
 // Warm the same decoded cache used by requestImage without claiming that
 // the sharper image has already been attached to the globe.
 provider.prefetch=(coords,signal)=>loadContextImage(options.url,coords,display,signal);
 return provider;
}

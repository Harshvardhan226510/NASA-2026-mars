import {unpackTile,tileVersion,planTiles,dimensions} from './lod.js';
import {TileQueue} from './tile-queue.js';
import {hasRecoverableNull,restoreOrthoMask} from './ortho-mask.js';
import {cropMeasuredImage} from './imagery-fallback.js';
const transfers=new TileQueue();
const textures=new TileQueue(5,48);
let index;
export function preparedTilePath(manifest,key){const entry=manifest?.schema==='mars-prepared-display/1'?manifest.tiles?.[key]:null;return entry&&/^\/prepared\/tiles\/[a-f0-9]{64}\.bin$/.test(entry.path)?entry.path:null;}
export function preparedTexturePath(manifest,key,masked){
 if(!preparedTilePath(manifest,key))return null;
 const entry=manifest.tiles[key],path=masked?entry.masked_webp:entry.webp;
 return /^\/prepared\/tiles\/[a-f0-9]{64}\.webp$/.test(path??'')&&entry.imagery_m>0?{path,metres:entry.imagery_m}:null;
}
async function displayIndex(){if(!index)index=fetch('/prepared/index.json',{signal:AbortSignal.timeout(3000)}).then(r=>r.ok?r.json():null).catch(()=>null);return index;}
export async function preparedPacket(buffer){const bytes=new Uint8Array(buffer);if(bytes[0]===0x1f&&bytes[1]===0x8b)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();return unpackTile(buffer);}
export async function displayTile(dataset,tile,signal){
 const url='/api/surface?dataset='+encodeURIComponent(dataset.id)+'&v='+tileVersion(dataset)+'&tile='+encodeURIComponent(tile);
 return transfers.get(url,async sharedSignal=>{
  const timeout=AbortSignal.timeout(55000),requestSignal=AbortSignal.any([sharedSignal,timeout]);
  const path=preparedTilePath(await displayIndex(),`${dataset.id}:${tileVersion(dataset)}:${tile}`);
  if(path){try{const r=await fetch(path,{signal:requestSignal});if(!r.ok)throw Error();const packet=await preparedPacket(await r.arrayBuffer());restoreOrthoMask(packet.pixels,dataset);return packet;}catch(error){if(requestSignal.aborted)throw error;}}
  const response=await fetch(url,{signal:requestSignal});if(!response.ok)throw new Error('The detailed surface tile is temporarily unavailable.');
  const packet=unpackTile(await response.arrayBuffer());restoreOrthoMask(packet.pixels,dataset);return packet;
 },signal);
}
function sourceTexture(dataset,tile,signal){
 const key=`${dataset.id}:${tileVersion(dataset)}:${tile}`;
 return textures.get(key,async sharedSignal=>{
  const prepared=preparedTexturePath(await displayIndex(),key,hasRecoverableNull(dataset));
  if(prepared){try{
   const response=await fetch(prepared.path,{signal:AbortSignal.any([sharedSignal,AbortSignal.timeout(4500)])});
   if(!response.ok||!response.headers.get('Content-Type')?.startsWith('image/webp'))throw Error('Prepared texture unavailable.');
   const image=await createImageBitmap(await response.blob());if(sharedSignal.aborted){image.close();sharedSignal.throwIfAborted();}
   if(image.width!==512||image.height!==512){image.close();throw Error('Invalid prepared texture size.');}
   return {image,metres:prepared.metres};
  }catch(error){if(sharedSignal.aborted)throw error;}}
  const packet=await displayTile(dataset,tile,sharedSignal);
  return {image:packetTexture(packet),metres:packet.imageryGrid};
 },signal);
}
export async function prefetchDisplay(dataset,focus,signal,{preparedOnly=false}={}){
 const b=dataset.bounds;if(focus[0]<b[0]||focus[0]>b[2]||focus[1]<b[1]||focus[1]>b[3])return;
 const dx=(b[2]-b[0])*.04,dy=(b[3]-b[1])*.04;
 const tiles=planTiles(dataset,[focus[0]-dx,focus[1]-dy,focus[0]+dx,focus[1]+dy],1,focus,4).slice(0,2);
 const manifest=preparedOnly?await displayIndex():null,masked=hasRecoverableNull(dataset);
 for(const id of ['overview',...tiles.map(tile=>tile.id)]){
  if(signal.aborted||textures.active>1||transfers.active>1)return;
  if(preparedOnly&&!preparedTexturePath(manifest,`${dataset.id}:${tileVersion(dataset)}:${id}`,masked))continue;
  try{await sourceTexture(dataset,id,signal);}catch{return;}
 }
}
export async function overviewTexture(dataset,bounds,size,signal){const {image,metres}=await sourceTexture(dataset,'overview',signal);return cropMeasuredImage({image,bounds:dataset.bounds,metres},bounds,size);}
export async function displayTexture(dataset,bounds,size=256,signal){
 const wanted=Math.max(...dimensions(bounds))/size,overview=dataset.imagery.find(a=>a.isOverview),overviewGrid=overview?Math.max(Math.abs(overview.transform[0]),Math.abs(overview.transform[4]),...dimensions(dataset.bounds).map(x=>x/512)):Infinity;
 const tiles=overviewGrid<=wanted*1.3?[{id:'overview',bounds:dataset.bounds}]:planTiles(dataset,bounds,wanted,[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2],9);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.gridMeters=0;const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';
 await Promise.all(tiles.map(async tile=>{
  const {image,metres}=await sourceTexture(dataset,tile.id,signal),b=tile.bounds;canvas.gridMeters=Math.max(canvas.gridMeters,wanted,metres);
  ctx.drawImage(image,(b[0]-bounds[0])/(bounds[2]-bounds[0])*size,(bounds[3]-b[3])/(bounds[3]-bounds[1])*size,(b[2]-b[0])/(bounds[2]-bounds[0])*size,(b[3]-b[1])/(bounds[3]-bounds[1])*size);
 }));return canvas;
}
export function packetTexture(packet){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;canvas.gridMeters=packet.imageryGrid;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(512,512);
 for(let i=0;i<512*512;i++){const value=packet.pixels[i*2];image.data[i*4]=image.data[i*4+1]=image.data[i*4+2]=value;image.data[i*4+3]=packet.pixels[i*2+1];}
 ctx.putImageData(image,0,0);return canvas;
}

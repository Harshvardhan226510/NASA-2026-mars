import {TileQueue} from './tile-queue.js';
import {geologyTileParts} from './geology-grid.js';
const sources=new TileQueue(4,64),images=new TileQueue(3,48);
export function geologyImage(x,y,z,signal,{fetcher=fetch,decode=createImageBitmap,canvas=()=>document.createElement('canvas'),sourceCache=sources,imageCache=images}={}){
 const parts=geologyTileParts(x,y,z),key=JSON.stringify(parts);
 return imageCache.get(key,async taskSignal=>{
  const loaded=await Promise.all(parts.map(p=>sourceCache.get(`${p.z}/${p.y}/${p.x}`,async sourceSignal=>{
   const r=await fetcher(`/api/geology?z=${p.z}&y=${p.y}&x=${p.x}`,{signal:AbortSignal.any([sourceSignal,AbortSignal.timeout(15000)])});if(!r.ok)throw Error('The geologic map source is unavailable.');const image=await decode(await r.blob());
   if(image.width!==256||image.height!==256){image.close?.();throw Error('Unexpected geology tile size.');}const out=canvas();out.width=out.height=256;out.getContext('2d').drawImage(image,0,0);image.close?.();return out;
  },taskSignal)));
  taskSignal.throwIfAborted();const out=canvas();out.width=out.height=256;const c=out.getContext('2d');c.imageSmoothingEnabled=false;parts.forEach((p,i)=>c.drawImage(loaded[i],...p.source,...p.destination));return out;
 },signal);
}

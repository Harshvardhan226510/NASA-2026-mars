import {overlayColor} from './science-style.js';
const referenceCache=new Map();
export async function loadReference(item,{fetchImpl=fetch,signal,cache=fetchImpl===globalThis.fetch}={}){
 signal?.throwIfAborted();
 const key=item.file+':'+item.packet_sha256;if(cache&&referenceCache.has(key)){const grid=referenceCache.get(key);referenceCache.delete(key);referenceCache.set(key,grid);return grid;}
 const r=await fetchImpl('/scientific/'+item.file,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(40000)]):AbortSignal.timeout(40000)});if(!r.ok)throw new Error('This published reference map could not load.');let buffer=await r.arrayBuffer();const signature=new Uint8Array(buffer,0,2);
 if(signature[0]===31&&signature[1]===139)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 if(buffer.byteLength!==item.width*item.height*4)throw new Error('The reference map is incomplete.');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==item.packet_sha256)throw new Error('The reference map checksum does not match.');
 const values=new Float32Array(item.width*item.height),view=new DataView(buffer);for(let i=0;i<values.length;i++){values[i]=view.getFloat32(i*4,true);if(!Number.isNaN(values[i])&&!Number.isFinite(values[i]))throw new Error('The reference map has invalid values.');}
 let validPixels=item.valid_pixels,nativeSampling=item.native_sampling;
 if(item.file==='thermal-inertia.f32.gz'){
  // ASU's 2 ppd delivery fills the uncovered polar rows with a constant 25.
  // Preserve measurements in mixed rows, and keep the original packet hash.
  for(let row=0;row<item.height;row++){
   const start=row*item.width,end=start+item.width;
   const latitude=item.bounds[3]-(row+.5)*(item.bounds[3]-item.bounds[1])/item.height;
   if((latitude>60||latitude< -75)&&values.subarray(start,end).every(value=>value===25))values.fill(NaN,start,end);
  }
  validPixels=values.reduce((count,value)=>count+Number.isFinite(value),0);
  nativeSampling='2 pixels/degree delivered (~30 km)';
 }
 const grid={...item,values,valid_pixels:validPixels,native_sampling:nativeSampling};if(cache)referenceCache.set(key,grid);while(referenceCache.size>2)referenceCache.delete(referenceCache.keys().next().value);return grid;
}
export function sampleReference(grid,lon,lat){
 const [west,south,east,north]=grid.bounds;if(!Number.isFinite(lon)||!Number.isFinite(lat)||lat<south||lat>north)return NaN;
 lon=((lon-west)%360+360)%360+west;if(lon>east)return NaN;
 // Nearest source pixel retains nodata edges and never blends into an unknown cell.
 const x=Math.min(grid.width-1,Math.floor((lon-west)/(east-west)*grid.width)),y=Math.min(grid.height-1,Math.floor((north-lat)/(north-south)*grid.height));return grid.values[y*grid.width+x];
}
export const scienceColor=overlayColor;

// Display cache only. Scientific values and unknown coverage remain in source grids.
const NAME='mars-science-display-v7',LIMIT=64;let pendingWrites=0;
async function remember(request,canvas){
 try{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)return;const cache=await caches.open(NAME);await cache.put(request,new Response(blob));const keys=await cache.keys();for(const old of keys.slice(0,Math.max(0,keys.length-LIMIT)))await cache.delete(old);}catch{}
}
export async function scienceTile(key,render,{persistent=false,signal}={}){
 const supported=persistent&&typeof caches!=='undefined'&&typeof createImageBitmap==='function'&&typeof location!=='undefined';
 const request=supported?new Request(new URL('/__science_display__/'+encodeURIComponent(key),location.origin)):null;
 if(supported)try{const cache=await caches.open(NAME),hit=await cache.match(request);if(hit){signal?.throwIfAborted();const bitmap=await createImageBitmap(await hit.blob());if(signal?.aborted){bitmap.close?.();signal.throwIfAborted();}if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close?.();return canvas;}return bitmap;}}catch{}
 signal?.throwIfAborted();const canvas=await render();signal?.throwIfAborted();
 // PNG encoding is an idle/background task in browsers. It must never delay a
 // visible tile or hold either raster calculation slot while the globe renders.
 if(supported&&canvas.toBlob&&pendingWrites<2){pendingWrites++;void remember(request,canvas).finally(()=>pendingWrites--);}
 return canvas;
}

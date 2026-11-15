// Yield heavy raster work without a chain of zero-delay timers. Chromium can
// throttle such timer chains to one per minute in background map tabs.
export async function yieldToBrowser(signal){
 signal?.throwIfAborted();
 if(typeof MessageChannel!=='undefined')await new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};channel.port2.postMessage(null);});
 else if(globalThis.scheduler?.yield)await globalThis.scheduler.yield();
 else await new Promise(resolve=>setTimeout(resolve,0));
 signal?.throwIfAborted();
}

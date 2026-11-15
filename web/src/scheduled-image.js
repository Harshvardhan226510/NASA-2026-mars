// Cesium may discard a tile while its shared raster calculation is queued.
// Cancel only this consumer; another map can still need the same image.
export function scheduledImage(C,request,url,render){
 const controller=new AbortController();if(!request)return render(controller.signal);
 request.url=url;request.requestFunction=()=>render(controller.signal);request.cancelFunction=()=>controller.abort();return C.RequestScheduler.request(request);
}
export function abortableResult(promise,signal){
 if(!signal)return promise;signal.throwIfAborted();return new Promise((resolve,reject)=>{const abort=()=>reject(signal.reason??new DOMException('View changed.','AbortError'));signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});
}

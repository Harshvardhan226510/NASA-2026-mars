// These are Mars visualization assets, not Earth-atmosphere environment probes.
// Cesium 1.145 can replay pending environment-map compute commands during a
// translucent depth pick and release their shared GPU resources twice.
export function loadMarsModel(C,options){
 return C.Model.fromGltfAsync({...options,environmentMapOptions:{...options.environmentMapOptions,enabled:false}});
}

// On-demand scenes can become idle while a model still needs GPU creation frames.
// Keep only the selected loading model awake; stop on readiness, cancellation or timeout.
export function requestModelReady(model,scene,{current,ready,failed,interval=setInterval,clear=clearInterval,clock=()=>Date.now(),timeout=45000}){
 let timer,removeReady,removeError,finished=false;const started=clock();
 const stop=()=>{if(finished)return;finished=true;if(timer!==undefined)clear(timer);removeReady?.();removeError?.();};
 const finish=success=>{if(finished)return;stop();if(current())(success?ready:failed)();};
 removeReady=model.readyEvent.addEventListener(()=>finish(true));removeError=model.errorEvent.addEventListener(()=>finish(false));
 const tick=()=>{if(!current()){stop();return;}if(model.ready){finish(true);return;}if(clock()-started>=timeout){finish(false);return;}scene.requestRender();};
 timer=interval(tick,100);tick();return stop;
}

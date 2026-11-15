import {MODE_DRAWS,resolvePreset} from './vendor/thinking-orbs/engine.js';

// Framework-free binding for the upstream engine; geometry/tunings are unchanged.
export function mountThinkingOrb(canvas){
 const ctx=canvas?.getContext?.('2d');
 if(!ctx)return {setState(){},destroy(){}};
 const size=64,dpr=Math.min(2,globalThis.devicePixelRatio||1);
 canvas.width=size*dpr;canvas.height=size*dpr;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let preset=resolvePreset('breathing',size),paused=true,visible=true,raf=0,destroyed=false;
 let dark=!document.body.classList.contains('ui-expedition');
 const frame=t=>{ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);MODE_DRAWS[preset.mode](ctx,size,t,dark,preset.opts);};
 const stop=()=>{cancelAnimationFrame(raf);raf=0;};
 const loop=()=>{raf=0;if(!canvas.isConnected){destroy();return;}frame(performance.now()/1000*preset.speed);raf=requestAnimationFrame(loop);};
 const refresh=()=>{stop();if(destroyed)return;frame((paused||reduced.matches)?0.6:performance.now()/1000*preset.speed);if(!paused&&!reduced.matches&&visible&&document.visibilityState!=='hidden')raf=requestAnimationFrame(loop);};
 const io=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;refresh();});io?.observe(canvas);
 const theme=new MutationObserver(()=>{const next=!document.body.classList.contains('ui-expedition');if(next!==dark){dark=next;refresh();}});theme.observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',refresh);reduced.addEventListener('change',refresh);
 function destroy(){destroyed=true;stop();io?.disconnect();theme.disconnect();document.removeEventListener('visibilitychange',refresh);reduced.removeEventListener('change',refresh);}
 refresh();
 return {setState(state,pause=false){preset=resolvePreset(state,size);paused=pause;refresh();},destroy};
}

// Geometry is interpolated only between dated source states. A complete trace
// spans one angular revolution; partial coverage stays an open arc.
export function vectorAt(samples,at){
 if(!samples?.length||!Number.isFinite(at)||at<samples[0][0]||at>samples.at(-1)[0])return null;
 let lo=0,hi=samples.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(samples[mid][0]<=at)lo=mid;else hi=mid;}
 const a=samples[lo],b=samples[hi],dt=(b[0]-a[0])/1000;if(!(dt>0))return null;
 const t=(at-a[0])/(dt*1000),t2=t*t,t3=t2*t;
 return a.slice(1,4).map((v,c)=>(2*t3-3*t2+1)*v+(t3-2*t2+t)*dt*a[c+4]+(-2*t3+3*t2)*b[c+1]+(t3-t2)*dt*b[c+4]);
}
export function pastTrail(samples,at,duration=3600000){
 if(!Number.isFinite(duration)||duration<=0||!vectorAt(samples,at))return null;
 const start=Math.max(samples[0][0],at-duration);if(at<=start)return {states:[],start,end:at,complete:false};
 const count=Math.max(1,Math.ceil((at-start)/15000));
 const states=Array.from({length:count+1},(_,i)=>{const time=start+(at-start)*i/count;return {at:time,position:vectorAt(samples,time)};});
 return {states,start,end:at,complete:start===at-duration};
}
export function trajectoryArc(samples,at){
 const current=vectorAt(samples,at);if(!current)return null;
 const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((s,v,i)=>s+v*b[i],0)/(Math.hypot(...a)*Math.hypot(...b)))));
 const walk=(direction,target=Math.PI)=>{
  const values=direction<0?samples.filter(s=>s[0]<at).reverse():samples.filter(s=>s[0]>at);let swept=0,prior=current,priorTime=at;
  for(const s of values){const p=s.slice(1,4),delta=angle(prior,p);if(swept+delta>=target)return {time:priorTime+(s[0]-priorTime)*(target-swept)/delta,swept:target,complete:true};swept+=delta;prior=p;priorTime=s[0];}
  return {time:priorTime,swept,complete:false};
 };
 let past=walk(-1),future=walk(1);
 // Eccentric orbits do not spend half their period on each side of the
 // current radius. Use the other covered side when needed, without inventing
 // a closing segment or extending beyond the provider's samples.
 if(!past.complete)future=walk(1,2*Math.PI-past.swept);
 if(!future.complete)past=walk(-1,2*Math.PI-future.swept);
 const start=past.time,end=future.time;
 // At most ten-second steps for low orbiters; bounded for long eccentric arcs.
 const count=Math.max(2,Math.min(3600,Math.ceil((end-start)/10000))),times=Array.from({length:count+1},(_,i)=>start+(end-start)*i/count);
 times.push(at);times.sort((a,b)=>a-b);
 const states=times.filter((t,i)=>!i||t-times[i-1]>.001).map(t=>({at:t,position:vectorAt(samples,t)}));
 return {states,start,end,complete:past.swept+future.swept>=2*Math.PI-1e-9};
}

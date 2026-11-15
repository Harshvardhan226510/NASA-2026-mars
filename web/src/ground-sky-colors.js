const clamp=x=>Math.max(0,Math.min(1,x)),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export const SKY_FACES=['positiveX','negativeX','positiveY','negativeY','positiveZ','negativeZ'];
export function cubeDirection(face,u,v){
 let p;switch(face){case 'positiveX':p=[1,-v,-u];break;case 'negativeX':p=[-1,-v,u];break;case 'positiveY':p=[u,1,v];break;case 'negativeY':p=[u,-1,-v];break;case 'positiveZ':p=[u,-v,1];break;case 'negativeZ':p=[-u,-v,-1];}
 if(!p)throw Error('Unknown sky face');const n=Math.hypot(...p);return p.map(x=>x/n);
}
export function skyPhase(elevation){return {day:clamp((elevation+10)/18),stars:clamp((-elevation-6)/10),twilight:clamp(1-Math.abs(elevation)/14)};}
export function skyColor(altitude,sunDot,elevation){
 const p=skyPhase(elevation),h=clamp(1-Math.max(0,altitude));
 const day=mix([137,93,66],[201,158,119],h*h),night=mix([3,6,12],[23,19,24],h**5);
 let color=mix(night,day,p.day);
 const glow=Math.exp(-Math.max(0,1-sunDot)*65)*p.twilight;
 color=mix(color,[126,161,183],glow*.7);
 const disc=clamp((sunDot-.99994)/.00005)*clamp((elevation+1)/2);
 return mix(color,[255,246,218],disc).map(v=>Math.round(v));
}
export function skyStars(count=700){let seed=194015;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};return Array.from({length:count},()=>{const z=rand()*2-1,a=rand()*2*Math.PI,r=Math.sqrt(1-z*z);return {direction:[r*Math.cos(a),r*Math.sin(a),z],brightness:.35+.65*rand()};});}

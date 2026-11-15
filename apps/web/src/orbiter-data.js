import {qRotate,qMultiply,qBlend} from './moon-data.js';

export const ORBITERS=Object.freeze({
 mro:{name:'Mars Reconnaissance Orbiter',short:'MRO',target:'-74',color:'#ffd292',model:'/spacecraft/models/mro.glb'},
 odyssey:{name:'2001 Mars Odyssey',short:'Odyssey',target:'-53',color:'#92d9ed',model:'/spacecraft/models/odyssey.glb'},
 mars_express:{name:'Mars Express',short:'Mars Express',target:'-41',color:'#bba8ff'},
 tgo:{name:'ExoMars Trace Gas Orbiter',short:'TGO',target:'-143',color:'#9de5af',model:'/spacecraft/models/tgo.glb'},
 hope:{name:'Hope / Emirates Mars Mission',short:'Hope',target:'-62',color:'#ffabbb'},
 maven:{name:'MAVEN',short:'MAVEN',target:'-202',color:'#b9cdeb',model:'/spacecraft/models/maven.glb',reliableUntil:'2025-12-04T00:00:00Z'}
});
export const ORBIT_WINDOW=21600000;
export function orbitWindow(at){if(!Number.isFinite(at)||at<Date.parse('2025-01-01T00:00:00Z')||at>=Date.parse('2036-01-01T00:00:00Z'))throw Error('Choose a UTC time from 2025 through 2035.');return new Date(Math.floor(at/ORBIT_WINDOW)*ORBIT_WINDOW).toISOString();}
export function advanceSystemTime(at,mode,_elapsed,_legacySpeed,wall=Date.now()){
 // Resuming always rejoins UTC, including after a suspended/background tab.
 // Legacy saved speed settings must never accelerate physical motion.
 return mode==='now'||mode==='play'?wall:at;
}
export function restoredSystemTime(selection,wall=Date.now()){
 const at=Date.parse(selection?.moon_at);
 return selection?.system_live===false&&Number.isFinite(at)&&at>=Date.parse('2025-01-01T00:00:00Z')&&at<Date.parse('2036-01-01T00:00:00Z')?{at,mode:'paused'}:{at:wall,mode:'now'};
}
export function marsFrame(packet,at){
 if(!packet)return null;const n=(at-Date.parse(packet.start_utc))/120000;
 if(!Number.isFinite(n)||n<0||n>180)return null;const i=Math.min(179,Math.floor(n));
 return qBlend(packet.mars_fixed_rotation_xyzw[i],packet.mars_fixed_rotation_xyzw[i+1],n-i);
}
export function frameChange(from,to){return qMultiply(to,[-from[0],-from[1],-from[2],from[3]]);}
export function validateOrbiters(packet){
 const start=Date.parse(packet?.start_utc),end=Date.parse(packet?.end_utc);
 if(packet?.schema!=='mars-orbiters/1'||packet.center!=='Mars center (499)'||packet.frame!=='ICRF'||packet.time_scale!=='UTC'||packet.units!=='metres and metres/second'||end-start!==ORBIT_WINDOW||!packet.bodies)throw Error('Unknown spacecraft ephemeris format.');
 for(const [id,b] of Object.entries(packet.bodies)){
  if(!ORBITERS[id]||b.target!==ORBITERS[id].target)throw Error('Unknown orbital target.');
  if(b.status!=='available'){if(b.status!=='unavailable')throw Error('Unknown orbital coverage.');continue;}
  if(b.samples?.length!==361||!b.samples.every((s,i)=>Array.isArray(s)&&s.length===7&&s.every(Number.isFinite)&&Math.abs(s[0]-(start+i*60000))<2&&Math.hypot(...s.slice(1,4))>3400000&&Math.hypot(...s.slice(1,4))<100000000&&Math.hypot(...s.slice(4,7))<100000)||!/^https:\/\/ssd\.jpl\.nasa\.gov\/api\/horizons\.api\?/.test(b.source_url)||!/^[a-f0-9]{64}$/.test(b.raw_sha256))throw Error('Invalid spacecraft trajectory.');
  if(ORBITERS[id].reliableUntil&&end>Date.parse(ORBITERS[id].reliableUntil))throw Error('Unreliable spacecraft prediction.');
  if(b.trajectory){const s=b.trajectory;if(!Array.isArray(s)||s.length<361||s.length>5000||!s.every((v,i)=>Array.isArray(v)&&v.length===7&&v.every(Number.isFinite)&&Math.hypot(...v.slice(1,4))>3400000&&Math.hypot(...v.slice(1,4))<100000000&&Math.hypot(...v.slice(4,7))<100000&&(!i||Math.abs(v[0]-s[i-1][0]-60000)<2))||s[0][0]>start||s.at(-1)[0]<end)throw Error('Invalid spacecraft path coverage.');}
 }
 return packet;
}
export function orbiterState(packet,id,at,fixed){
 const b=packet?.bodies?.[id],start=Date.parse(packet?.start_utc),end=Date.parse(packet?.end_utc);
 if(!fixed||b?.status!=='available'||!Number.isFinite(at)||at<start||at>end)return null;
 const n=(at-start)/60000,i=Math.min(359,Math.floor(n)),t=n-i,a=b.samples[i],z=b.samples[i+1],t2=t*t,t3=t2*t;
 const p=a.slice(1,4).map((v,c)=>(2*t3-3*t2+1)*v+(t3-2*t2+t)*60*a[c+4]+(-2*t3+3*t2)*z[c+1]+(t3-t2)*60*z[c+4]);
 const v=a.slice(1,4).map((v,c)=>(6*t2-6*t)*v/60+(3*t2-4*t+1)*a[c+4]+(-6*t2+6*t)*z[c+1]/60+(3*t2-2*t)*z[c+4]);
 const position=qRotate(p,fixed),velocity=qRotate(v,fixed),radius=Math.hypot(...p);
 if(![...position,...velocity,radius].every(Number.isFinite)||radius<=3400000||radius>=100000000)return null;
 return {position,velocity,radius};
}

// The pose is illustrative. Degenerate velocity must never become a NaN matrix
// in Cesium's command bounds; the dated position remains independently usable.
export function orbiterAxes(state){
 if(!state||![...state.position,...state.velocity].every(Number.isFinite))return null;
 const unit=v=>{const n=Math.hypot(...v);return n>1e-8&&Number.isFinite(n)?v.map(x=>x/n):null;},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const z=unit(state.position);if(!z)return null;const y=unit(cross(z,state.velocity));if(!y)return null;const x=unit(cross(y,z));
 return x?{x,y,z}:null;
}

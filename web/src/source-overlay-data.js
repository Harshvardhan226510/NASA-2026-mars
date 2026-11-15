import {ORBITERS,orbiterState,marsFrame} from './orbiter-data.js';
export const RELAY_ORBITERS=['mro','odyssey','mars_express','tgo','maven'];
export const MARS_REFERENCE_RADIUS=3396190;
export function relayStates(orbits,frames,at){
 const fixed=marsFrame(frames,at);if(!fixed)return [];
 return RELAY_ORBITERS.flatMap(id=>{const state=orbiterState(orbits,id,at,fixed);return state?[{id,name:ORBITERS[id].short,...state}]:[];});
}
// Local horizontal on the unexaggerated reference sphere. Radio performance,
// local terrain, spacecraft attitude and network scheduling are not inferred.
export function relayVisibility(states,lon,lat,minElevation=10){
 if(!states.length||![lon,lat,minElevation].every(Number.isFinite)||Math.abs(lat)>90||minElevation<0||minElevation>90)return null;
 const rad=Math.PI/180,l=lon*rad,p=lat*rad,n=[Math.cos(p)*Math.cos(l),Math.cos(p)*Math.sin(l),Math.sin(p)];
 return states.map(s=>{const delta=s.position.map((v,i)=>v-MARS_REFERENCE_RADIUS*n[i]),distance=Math.hypot(...delta),dot=delta.reduce((sum,v,i)=>sum+v*n[i],0);const elevation=Math.asin(Math.max(-1,Math.min(1,dot/distance)))/rad;return {id:s.id,name:s.name,elevation,distance_m:distance,visible:elevation>=minElevation};});
}
// Compile a raster sampler once per snapshot. Avoid millions of temporary
// vectors/objects and inverse trigonometric operations while drawing tiles.
export function relaySampler(states,minElevation=10){
 if(!states.length||!Number.isFinite(minElevation)||minElevation<0||minElevation>90)return ()=>null;
 const R=MARS_REFERENCE_RADIUS,rad=Math.PI/180,threshold=Math.sin(minElevation*rad),bodies=states.map(s=>{const [x,y,z]=s.position;return {x,y,z,r2:x*x+y*y+z*z};});
 return (lon,lat)=>{if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>90)return null;const p=lat*rad,l=lon*rad,cp=Math.cos(p),nx=cp*Math.cos(l),ny=cp*Math.sin(l),nz=Math.sin(p);let count=0;for(const s of bodies){const dot=s.x*nx+s.y*ny+s.z*nz,distance=Math.sqrt(s.r2+R*R-2*R*dot);if((dot-R)/distance>=threshold)count++;}return count;};
}
export function validateDustIndex(p){
 if(p?.schema!=='mars-dust-history/1'||p.kind!=='historical_observation'||p.grid?.width!==3600||p.grid?.height!==1801||p.grid?.step_degrees!==.1||!p.frames?.length)throw Error('Unknown dust archive');
 const names=new Set();for(const f of p.frames){if(!/^MY(28|29|30|31|32)-[A-Z]\d\d_day\d\d-f\d{4}$/.test(f.id)||f.file!==f.id+'.png'||names.has(f.id)||!Number.isFinite(f.ls)||!Number.isFinite(f.soy)||!/^[a-f0-9]{64}$/.test(f.sha256)||typeof f.empty_source_mask!=='boolean')throw Error('Invalid dust frame');names.add(f.id);}
 return p;
}
export function dustPixel(pixels,lon,lat){
 if(!pixels||!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>90)return null;
 const x=Math.round((((lon+180)%360+360)%360)*10)%3600,y=Math.max(0,Math.min(1800,Math.round((90-lat)*10))),value=pixels[(y*3600+x)*4];
 return value===255||value>250?null:value;
}
export function dustStatus(value){return value===null?'Missing source observation · unknown':value===0?'No outlined storm in this source pixel':`Observed dust-storm mask · native ID ${value}`;}
export function dustFocus(pixels){
 if(!pixels)return null;const counts=new Uint32Array(251);for(let i=0;i<pixels.length;i+=4){const v=pixels[i];if(v>0&&v<=250)counts[v]++;}
 let member=0;for(let i=1;i<counts.length;i++)if(counts[i]>counts[member])member=i;if(!member)return null;
 let remaining=Math.ceil(counts[member]/2);for(let i=0;i<pixels.length;i+=4)if(pixels[i]===member&&!--remaining){const p=i/4;return [-180+(p%3600)*.1,90-Math.floor(p/3600)*.1];}return null;
}
export function validateUvHistory(p){
 if(p?.schema!=='mars-rems-uv-history/1'||p.kind!=='historical_local_observation'||p.channels?.length!==6||JSON.stringify(p.channels.slice(0,3).map(c=>c.band_nm))!=='[[315,370],[280,320],[220,280]]'||p.observed_sol_range?.length!==2||!p.observed_sol_range.every(x=>Number.isInteger(x)&&x>=3401&&x<=3500)||!p.bins?.length||!p.provenance?.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)))throw Error('Unknown UV archive');
 for(const b of p.bins){if(!Number.isInteger(b.sol)||b.sol<3401||b.sol>3500||!Number.isFinite(b.lmst)||b.lmst<0||b.lmst>=24||b.channels?.length!==6)throw Error('Invalid UV sample');for(const c of b.channels){if(!Number.isInteger(c.count)||c.count<0||c.count&&![c.mean,c.min,c.max].every(Number.isFinite)||!c.count&&[c.mean,c.min,c.max].some(x=>x!==null)||c.uncertainty_count>c.count||c.uncertainty_count&&![c.uncertainty_min,c.uncertainty_max].every(x=>Number.isFinite(x)&&x>=0))throw Error('Invalid UV values');}}
 return p;
}

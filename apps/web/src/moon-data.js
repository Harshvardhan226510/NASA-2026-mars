export const MOONS={phobos:{name:'Phobos',radius:14000,color:'#e9c797',description:'The larger, inner moon. Stickney is its largest crater.',source:'https://science.nasa.gov/mars/moons/phobos/',model:'/moons/phobos.glb',pose:[0,0,Math.SQRT1_2,Math.SQRT1_2]},deimos:{name:'Deimos',radius:8000,color:'#afc8e8',description:'The smaller, outer moon, with a smoother-looking surface.',source:'https://science.nasa.gov/mars/moons/deimos/',model:'/moons/deimos.glb',pose:[0,0,0,1]}};
export const moonWindow=at=>new Date(Math.floor(at/21600000)*21600000).toISOString();
export function moonVectorSamples(packets,id){
 const points=new Map();for(const packet of packets){if(!packet?.bodies?.[id])continue;const start=Date.parse(packet.start_utc);packet.bodies[id].samples.forEach((s,i)=>points.set(start+i*120000,[start+i*120000,...s.slice(0,6)]));}
 return [...points.values()].sort((a,b)=>a[0]-b[0]);
}
export function moonZoomRange(distance,radius,delta){return Math.max(radius*1.03,distance*Math.exp(-Math.max(-300,Math.min(300,delta))*.0025));}
export function qMultiply([x,y,z,w],[a,b,c,d]){return [w*a+x*d+y*c-z*b,w*b-x*c+y*d+z*a,w*c+x*b-y*a+z*d,w*d-x*a-y*b-z*c];}
export function qRotate(v,q){return qMultiply(qMultiply(q,[...v,0]),[-q[0],-q[1],-q[2],q[3]]).slice(0,3);}
export function qBlend(a,b,t){let dot=a.reduce((s,v,i)=>s+v*b[i],0),target=b;if(dot<0){target=b.map(v=>-v);dot=-dot;}let q;if(dot>.9995)q=a.map((v,i)=>v+(target[i]-v)*t);else{const angle=Math.acos(Math.min(1,dot)),s=Math.sin(angle);q=a.map((v,i)=>(v*Math.sin((1-t)*angle)+target[i]*Math.sin(t*angle))/s);}const n=Math.hypot(...q);return q.map(v=>v/n);}
export function validateMoons(p){
 if(p?.schema!=='mars-moons/1'||p.center!=='Mars center (499)'||p.sample_frame!=='J2000'||p.display_frame!=='IAU_MARS'||p.aberration!=='NONE'||p.step_seconds!==120||Date.parse(p.end_utc)-Date.parse(p.start_utc)!==21600000)throw Error('Unknown moon ephemeris format.');
 const finite=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite),quaternion=q=>finite(q,4)&&Math.abs(Math.hypot(...q)-1)<1e-6;
 if(p.mars_fixed_rotation_xyzw?.length!==181||!p.mars_fixed_rotation_xyzw.every(quaternion))throw Error('Invalid Mars reference frame.');
 for(const id of Object.keys(MOONS)){const b=p.bodies?.[id];if(!b||b.samples?.length!==181||![193,769].includes(b.orbit_j2000_m?.length)||!b.samples.every(s=>finite(s,10)&&quaternion(s.slice(6))&&Math.hypot(...s.slice(0,3))>6000000&&Math.hypot(...s.slice(0,3))<30000000)||!b.orbit_j2000_m.every(s=>finite(s,3)&&Math.hypot(...s)>6000000&&Math.hypot(...s)<30000000))throw Error('Invalid moon states.');}
 return p;
}
export function moonState(packet,id,at){
 if(!MOONS[id]||!packet)return null;const start=Date.parse(packet.start_utc),end=Date.parse(packet.end_utc);if(!Number.isFinite(at)||at<start||at>end)return null;
 const n=(at-start)/120000,i=Math.min(179,Math.floor(n)),t=n-i,body=packet.bodies[id],a=body.samples[i],b=body.samples[i+1],t2=t*t,t3=t2*t;
 const position=a.slice(0,3).map((p,c)=>(2*t3-3*t2+1)*p+(t3-2*t2+t)*120*a[c+3]+(-2*t3+3*t2)*b[c]+(t3-t2)*120*b[c+3]);
 const fixed=qBlend(packet.mars_fixed_rotation_xyzw[i],packet.mars_fixed_rotation_xyzw[i+1],t),bodyToJ2000=qBlend(a.slice(6),b.slice(6),t);
 return {position:qRotate(position,fixed),orientation:qMultiply(qMultiply(fixed,bodyToJ2000),MOONS[id].pose),fixed,radius:Math.hypot(...position)};
}

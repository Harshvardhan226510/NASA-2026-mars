import {marsDistance,measurementPoint} from './measurement-geometry.js';

const deg=Math.PI/180;
const wrap=x=>((x+180)%360+360)%360-180;
export function heading(a,b){
 const delta=wrap(b[0]-a[0])*deg,p=a[1]*deg,q=b[1]*deg;
 return (360+Math.atan2(Math.sin(delta)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(delta))/deg)%360;
}

export function routeFix(samples,position,accuracy,previous){
 if(samples.length<2)return null;
 if(!Number.isFinite(accuracy)||accuracy<1||accuracy>10000)throw Error('Enter position uncertainty between 1 and 10,000 m.');
 const [lon,lat]=measurementPoint(position),metric=Math.max(.001,Math.cos(lat*deg));
 let best=null;
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i],u=wrap(a.lon-lon),v=u+wrap(b.lon-a.lon),x=(v-u)*metric,y=b.lat-a.lat;
  const t=Math.max(0,Math.min(1,(-(u*metric)*x+(lat-a.lat)*y)/(x*x+y*y||1)));
  const snapped=[wrap(lon+u+(v-u)*t),a.lat+y*t],separation=marsDistance(position,snapped),distance=a.distance_m+(b.distance_m-a.distance_m)*t;
  if(!best||separation<best.separation-1||Math.abs(separation-best.separation)<=1&&Math.abs(distance-(previous?.distance??0))<Math.abs(best.distance-(previous?.distance??0)))best={snapped,separation,distance};
 }
 const corridor=Math.max(35,accuracy*2),offRoute=best.separation>corridor;
 const backwards=!offRoute&&previous&&!previous.offRoute&&best.distance<previous.distance-Math.max(corridor,previous.accuracy*2);
 const wrongWay=offRoute?0:backwards?(previous.wrongWay??0)+1:0;
 return {...best,position,accuracy,corridor,offRoute,wrongWay,remaining:Math.max(0,samples.at(-1).distance_m-best.distance)};
}

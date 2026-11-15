import {solarAt} from './solar-geometry.js';
const deg=Math.PI/180,R=3396190;
export function solarTerrain(sample,lon,lat,spacing,sun){
 const solar=solarAt(sun,lon,lat);if(!solar||Math.abs(lat)>89.5)return NaN;if(solar.elevation<=0)return 0;
 const c=sample(lon,lat),east=sample(...destination(lon,lat,spacing,0)),west=sample(...destination(lon,lat,-spacing,0)),north=sample(...destination(lon,lat,0,spacing)),south=sample(...destination(lon,lat,0,-spacing));if(![c,east,west,north,south].every(Number.isFinite))return NaN;
 const b=solar.azimuth*deg,a=solar.elevation*deg,p=(east-west)/(2*spacing),q=(north-south)/(2*spacing),incidence=(Math.sin(a)-p*Math.sin(b)*Math.cos(a)-q*Math.cos(b)*Math.cos(a))/Math.sqrt(1+p*p+q*q);if(incidence<=0)return 0;
 for(const step of [1,2,4,8]){const distance=spacing*step,h=sample(...destination(lon,lat,Math.sin(b)*distance,Math.cos(b)*distance));if(!Number.isFinite(h))return NaN;if(Math.atan2(h-c-distance*distance/(2*R),distance)>a)return 0;}
 return Math.min(1,incidence);
}
export function destination(lon,lat,east,north){
 const length=Math.hypot(east,north);if(!length)return [lon,lat];const d=length/R,b=Math.atan2(east,north),p=lat*deg,l=lon*deg;
 const q=Math.asin(Math.max(-1,Math.min(1,Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(b))));
 return [((l+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(q)))/deg+540)%360-180,q/deg];
}
export function terrainMetrics(sample,lon,lat,spacing){
 if(!Number.isFinite(spacing)||spacing<=0||Math.abs(lat)>89.5)return null;
 const values=[];for(const n of [1,0,-1])for(const e of [-1,0,1])values.push(sample(...destination(lon,lat,e*spacing,n*spacing)));
 if(!values.every(Number.isFinite))return null;
 const [nw,n,ne,w,c,e,sw,s,se]=values,p=(ne+2*e+se-nw-2*w-sw)/(8*spacing),q=(nw+2*n+ne-sw-2*s-se)/(8*spacing),slope=Math.atan(Math.hypot(p,q))/deg;
 const residual=values.map((v,i)=>v-c-p*((i%3)-1)*spacing-q*(1-Math.floor(i/3))*spacing);
 const roughness=Math.sqrt(residual.reduce((a,v)=>a+v*v,0)/9),ruggedness=Math.sqrt(values.reduce((a,v)=>a+(v-c)**2,0)/8),relief=Math.max(...values)-Math.min(...values),curvature=(n+s+e+w-4*c)/spacing**2*1000;
 const aspect=slope<1e-6?NaN:(Math.atan2(-p,-q)/deg+360)%360,tpi=c-(nw+n+ne+w+e+sw+s+se)/8;
 const hillshade=Math.max(0,(Math.sin(45*deg)-p*Math.sin(315*deg)*Math.cos(45*deg)-q*Math.cos(315*deg)*Math.cos(45*deg))/Math.sqrt(1+p*p+q*q));
 return {slope,roughness,ruggedness,relief,curvature,aspect,hillshade,tpi,landform:tpi>Math.max(10,relief*.2)?2:tpi< -Math.max(10,relief*.2)?0:slope>5?3:1};
}
export function horizonMetric(sample,lon,lat,spacing,mode=false){
 const c=sample(lon,lat);if(!Number.isFinite(c)||Math.abs(lat)>89.5||!Number.isFinite(spacing)||spacing<=0)return NaN;let visibility=0,maxAngle=0;
 for(let direction=0;direction<8;direction++){let angle=0;for(const step of [1,2,4]){const d=spacing*step,b=direction*Math.PI/4,h=sample(...destination(lon,lat,Math.sin(b)*d,Math.cos(b)*d));if(!Number.isFinite(h))return NaN;const elevation=mode==='horizon'?Math.atan2((R+h)*Math.cos(d/R)-(R+c),(R+h)*Math.sin(d/R)):Math.atan2(h-c,d);angle=Math.max(angle,elevation);}visibility+=Math.cos(angle)**2/8;maxAngle=Math.max(maxAngle,angle);}
 return mode==='horizon'?maxAngle/deg:mode?1-visibility:visibility;
}
export function terrainMetricValue(m,key){
 if(!m)return NaN;if(key in m)return m[key];const difficulty=100*Math.min(1,.7*m.slope/40+.3*m.roughness/300);
 if(key==='difficulty')return difficulty;if(key==='suitability')return 100-difficulty;
 if(key==='accessibility')return m.slope<5?0:m.slope<15?1:m.slope<30?2:3;
 if(key==='energy'){const i=Math.min(.45,Math.tan(m.slope*deg));return Math.max(1.2,280.5*i**5-58.7*i**4-289.8*i**3+74.3*i**2+19.1*i+3.2);}
 return NaN;
}
export function contourSegments(values,width,bounds,interval,limit=5000){
 if(!(interval>0)||!Number.isInteger(width)||values.length!==width*width)throw new Error('Invalid contour grid.');const out=[];
 const pos=(x,y)=>[bounds[0]+x/(width-1)*(bounds[2]-bounds[0]),bounds[3]-y/(width-1)*(bounds[3]-bounds[1])];
 for(let y=0;y<width-1;y++)for(let x=0;x<width-1;x++){
  const v=[values[y*width+x],values[y*width+x+1],values[(y+1)*width+x+1],values[(y+1)*width+x]];if(!v.every(Number.isFinite))continue;
  const lo=Math.min(...v),hi=Math.max(...v);if(hi===lo)continue;
  for(let level=Math.ceil(lo/interval)*interval;level<=hi;level+=interval){
   const points=[],xy=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
   for(let i=0;i<4;i++){const j=(i+1)%4;if((v[i]<level)===(v[j]<level))continue;const t=(level-v[i])/(v[j]-v[i]);points.push(pos(xy[i][0]+t*(xy[j][0]-xy[i][0]),xy[i][1]+t*(xy[j][1]-xy[i][1])));}
   // Resolve saddle ambiguity by the cell centre; no line crosses missing data.
   if(points.length===4&&(v.reduce((a,b)=>a+b,0)/4>=level))points.push(points.shift());
   for(let i=0;i+1<points.length;i+=2){if(Math.hypot(points[i][0]-points[i+1][0],points[i][1]-points[i+1][1])<1e-10)continue;out.push({height:level,points:[points[i],points[i+1]]});if(out.length>=limit)return out;}
  }
 }return out;
}

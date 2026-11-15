import {routeProjection} from './route-geometry.js';
import {terrainMetrics,solarTerrain} from './terrain-metrics.js';
import {marsSun,solarAt} from './solar-geometry.js';
import {corridorDistanceKm} from './route-sites.js';

export const SITE_WEIGHTS={landing:{slope:35,roughness:20,area:25,surroundings:20,sun:0,ice:0,resources:0},base:{slope:10,roughness:10,area:15,surroundings:0,sun:30,ice:20,resources:15}};
export const SITE_CRITERIA={slope:'Footprint slope',roughness:'Footprint roughness',area:'Connected usable area',surroundings:'Surrounding terrain',sun:'Solar opportunity',ice:'Ice evidence',resources:'Resource proximity'};
export const SITE_PROFILES={
 landing:{slope:10,roughness:20,requiredArea:1,surroundingBuffer:1000,description:'Landing gives all default weight to terrain inside and around the ellipse. The vehicle elevation ceiling and footprint limits are checked separately.'},
 base:{slope:5,roughness:10,requiredArea:.5,surroundingBuffer:0,description:'The solar-supported base preset gives 65% of the weight to sunlight, ice evidence and nearby resources. The remaining 35% scores buildable terrain, which must also meet the footprint limits.'}
};
export const SITE_METHOD_SOURCES=[
 ['NASA Mars 2020 landing safety assessment','https://ntrs.nasa.gov/citations/20200002978'],
 ['NASA InSight engineering constraints','https://www.jpl.nasa.gov/news/press_kits/insight/landing/mission/landing-site/'],
 ['NASA Mars surface power study','https://ntrs.nasa.gov/citations/20160002628'],
 ['NASA resource and ice science objectives','https://science.nasa.gov/planetary-science/programs/mars-exploration/mars-science-objectives/'],
 ['SWIM shallow ice consistency product','https://swim.psi.edu/SWIM4MIMProducts.php'],
 ['National Academies Mars exploration-zone study','https://www.nationalacademies.org/read/28594/chapter/5']
];
const finite=Number.isFinite,clamp=x=>Math.max(0,Math.min(100,x));
export function validateSiteOptions(o){
 const limits={lon:[-180,180],lat:[-89,89],length:[200,50000],width:[200,50000],heading:[0,360],slope:[1,40],roughness:[1,500],maxElevation:[-9000,22000],requiredArea:[.01,2000],sols:[1,668],radius:[1,500]};
 for(const [key,[min,max]] of Object.entries(limits))if(!finite(o[key])||o[key]<min||o[key]>max)throw Error(`Check ${key}: expected ${min}–${max}.`);
 if(!['landing','base'].includes(o.mode))throw Error('Choose landing or base evaluation.');
 marsSun(o.at);marsSun(new Date(Date.parse(o.at)+o.sols*88775244).toISOString());
 const buffer=o.surroundingBuffer??SITE_PROFILES[o.mode].surroundingBuffer;
 if(!finite(buffer)||buffer<0||buffer>5000)throw Error('Set the surrounding buffer between 0 and 5,000 m.');
 const keys=Object.keys(SITE_CRITERIA);
 if(keys.some(k=>{const w=siteWeight(o.weights,k);return !finite(w)||w<0||w>100;})||!keys.some(k=>siteWeight(o.weights,k)>0))throw Error('Set nonnegative weights and at least one positive weight.');
 return o;
}
export function siteWeight(weights,key){return key==='surroundings'&&!Object.hasOwn(weights??{},key)?0:weights?.[key];}
export function expandedSite(o){
 const buffer=o.surroundingBuffer??SITE_PROFILES[o.mode].surroundingBuffer;
 return {...o,length:o.length+2*buffer,width:o.width+2*buffer,surroundingBuffer:buffer};
}
export function siteFootprint(o,count=72){
 const project=routeProjection([o.lon,o.lat]),angle=o.heading*Math.PI/180;
 return Array.from({length:count+1},(_,i)=>{const t=i/count*2*Math.PI,x=o.width/2*Math.cos(t),y=o.length/2*Math.sin(t);return project.inverse([x*Math.cos(angle)+y*Math.sin(angle),-x*Math.sin(angle)+y*Math.cos(angle)]);});
}
export function insideFootprint(x,y,o){const a=o.heading*Math.PI/180,e=x*Math.cos(a)-y*Math.sin(a),n=x*Math.sin(a)+y*Math.cos(a);return (e/(o.width/2))**2+(n/(o.length/2))**2<=1;}
export function largestConnected(mask,rows,cols){
 const seen=new Uint8Array(mask.length);let largest=0;
 for(let i=0;i<mask.length;i++)if(mask[i]&&!seen[i]){const queue=[i];seen[i]=1;for(let q=0;q<queue.length;q++){const at=queue[q],r=Math.floor(at/cols),c=at%cols;for(const [rr,cc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]){const j=rr*cols+cc;if(rr>=0&&rr<rows&&cc>=0&&cc<cols&&mask[j]&&!seen[j]){seen[j]=1;queue.push(j);}}}largest=Math.max(largest,queue.length);}
 return largest;
}
export function weightedSiteScore(criteria,weights){
 let total=0,known=0,sum=0;for(const k of Object.keys(SITE_CRITERIA)){const w=siteWeight(weights,k);total+=w;if(finite(criteria[k])){known+=w;sum+=clamp(criteria[k])*w;}}
 return {score:known?sum/known:null,coverage:total?known/total:0,lower:total?sum/total:0,upper:total?(sum+100*(total-known))/total:100};
}
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.ceil((values.length-1)*p)]:null;
// Terrain metrics use a physical source-scale stencil, never camera/display detail.
export function analyseSiteTerrain(grid,o,sample){
 const spacing=Math.max(grid.resolution_meters,grid.source.sample_m),project=routeProjection([o.lon,o.lat]),gridProject=routeProjection(grid.center),halfX=(grid.cols-1)*grid.resolution_meters/2,halfY=(grid.rows-1)*grid.resolution_meters/2;
 const step=Math.max(1,Math.ceil(spacing/grid.resolution_meters)),rows=Math.ceil(grid.rows/step),cols=Math.ceil(grid.cols/step),mask=new Uint8Array(rows*cols),slopes=[],roughness=[],heights=[];
 const outer=expandedSite(o),surroundings={buffer_m:outer.surroundingBuffer,total:0,known:0,within_limits:0};
 let total=0,known=0;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const point=gridProject.inverse([c*step*grid.resolution_meters-halfX,halfY-r*step*grid.resolution_meters]);
  const [x,y]=project.forward(point),inside=insideFootprint(x,y,o);
  if(!inside&&(!outer.surroundingBuffer||!insideFootprint(x,y,outer)))continue;
  if(inside)total++;else surroundings.total++;
  const h=sample(...point),m=terrainMetrics(sample,...point,spacing);
  if(!finite(h)||!m)continue;
  const within=m.slope<=o.slope&&m.roughness<=o.roughness;
  if(!inside){surroundings.known++;if(within)surroundings.within_limits++;continue;}
  known++;heights.push(h);slopes.push(m.slope);roughness.push(m.roughness);
  if(within&&(o.mode!=='landing'||h<=o.maxElevation))mask[r*cols+c]=1;
 }
 const cellArea=(step*grid.resolution_meters)**2,largest=largestConnected(mask,rows,cols)*cellArea/1e6,adequate=total>=9&&known>=9;
 return {total,known,coverage:total?known/total:0,adequate,sample_m:spacing,area_sampling_m:step*grid.resolution_meters,slope_p95:percentile(slopes,.95),slope_max:percentile(slopes,1),roughness_p95:percentile(roughness,.95),elevation_min:percentile(heights,0),elevation_max:percentile(heights,1),connected_km2:largest,footprint_km2:Math.PI*o.length*o.width/4e6,surroundings};
}
export function analyseSiteSun(o,sample,spacing){
 let geometric=0,illuminated=0,energy=0,unknown=0;const count=Math.ceil(o.sols*24),dt=o.sols*88775244/count;
 for(let i=0;i<count;i++){const sun=marsSun(new Date(Date.parse(o.at)+(i+.5)*dt).toISOString()),s=solarAt(sun,o.lon,o.lat);if(s.elevation<=0)continue;geometric++;const f=solarTerrain(sample,o.lon,o.lat,spacing,sun);if(!finite(f)){unknown++;continue;}if(f>0)illuminated++;energy+=f;}
 const hours=dt/3600000/o.sols;return {samples:count,geometric_hours_per_sol:geometric*hours,lit_hours_per_sol:unknown?null:illuminated*hours,equivalent_hours_per_sol:unknown?null:energy*hours,unknown,shadow_radius_m:8*spacing};
}
export function evaluateSite(o,terrain,sun,{ice=null,resources=null}={}){
 validateSiteOptions(o);const complete=terrain.adequate&&terrain.coverage===1;
 const ring=terrain.surroundings;
 const criteria={
  slope:complete?clamp(100*(1-terrain.slope_p95/o.slope)):null,
  roughness:complete?clamp(100*(1-terrain.roughness_p95/o.roughness)):null,
  area:complete?clamp(100*terrain.connected_km2/o.requiredArea):null,
  surroundings:ring?.known>=9&&ring.known===ring.total?100*ring.within_limits/ring.total:null,
  sun:finite(sun.equivalent_hours_per_sol)?clamp(100*sun.equivalent_hours_per_sol/12):null,
  ice:finite(ice)?clamp(50*(ice+1)):null,
  resources:finite(resources?.nearest_km)?clamp(100*(1-resources.nearest_km/o.radius)):null
 };
 const violations=[];if(terrain.adequate){if(terrain.slope_max>o.slope)violations.push('Resolved slope exceeds scenario limit');if(terrain.roughness_p95>o.roughness)violations.push('95th-percentile roughness exceeds scenario limit');if(o.mode==='landing'&&terrain.elevation_max>o.maxElevation)violations.push('Elevation exceeds vehicle scenario limit');if(complete&&terrain.connected_km2<o.requiredArea)violations.push('Insufficient connected usable area');}
 const unknown=['Individual rocks and small scarps','Soil strength and bearing capacity','Vehicle-specific landing dynamics','Local atmospheric conditions'];if(!complete)unknown.unshift('Insufficient or missing footprint terrain samples');
 return {schema:'mars-site-evaluation/1',evaluated_at:new Date().toISOString(),options:structuredClone(o),terrain,sun,ice,resources,criteria,...weightedSiteScore(criteria,o.weights),constraint_status:violations.length?'outside scenario':complete?'within resolved terrain limits':'unknown',violations,unassessed:unknown,notes:['Project preference score, not landing success probability or NASA certification.','Scores normalized over assessed criteria; coverage and full-weight bounds must be compared alongside them.','Solar score uses 12 equivalent incidence hours/sol as a preference normalization; no atmospheric attenuation, panel efficiency or electrical yield.','Ice score maps signed SWIM consistency −1…+1 to preference 0…100; it is not probability, depth or reserves.','Resource proximity uses straight-line distance to catalogue evidence, not terrain route cost.','Connected area uses four-neighbor source-scale samples; area is approximate and does not prove a vehicle or building fits.']};
}

export function compareSitePairs(results,radiusKm){
 const pairs=[];
 for(const [landingIndex,landing] of results.entries()){
  if(landing.options.mode!=='landing')continue;
  for(const [baseIndex,base] of results.entries()){
   if(base.options.mode!=='base')continue;
   const centre=[landing.options.lon,landing.options.lat];
   const distanceKm=corridorDistanceKm([base.options.lon,base.options.lat],centre,centre);
   if(distanceKm>radiusKm)continue;
   pairs.push({landingIndex,baseIndex,distanceKm,eligible:[landing,base].every(r=>r.constraint_status==='within resolved terrain limits'),lower:Math.min(landing.lower,base.lower),upper:Math.min(landing.upper,base.upper)});
  }
 }
 return pairs.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.lower-a.lower||a.distanceKm-b.distanceKm);
}

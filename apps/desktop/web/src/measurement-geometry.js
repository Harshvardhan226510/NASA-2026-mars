import {R} from './raster.js';
const rad=Math.PI/180;
export const MAX_MEASURE_POINTS=64;
export function measurementPoint(point){
 if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||Math.abs(point[1])>90)throw new Error('Use a valid longitude and a latitude from −90 to 90.');
 return [((point[0]+180)%360+360)%360-180,point[1]];
}
export function marsDistance(a,b){
 a=measurementPoint(a);b=measurementPoint(b);
 // atan2 of unit-vector cross/dot stays accurate next to both zero and pi;
 // haversine loses the small separation from pi for nearly opposite points.
 return R*angle(vector(a),vector(b));
}
export function lineDistances(points){let total=0;const segments=points.slice(1).map((p,i)=>{const d=marsDistance(points[i],p);total+=d;return d;});return {segments,total};}
// A route may revisit a pin. Visits add distance, but do not create new labels.
export function measurementPins(points){
 const pins=[],numbers=points.map((point,index)=>{let pin=pins.find(p=>marsDistance(p.point,point)<.1);if(!pin){pin={point,index,number:pins.length+1};pins.push(pin);}return pin.number;});return {pins,numbers};
}
// Distance retains the closing leg; area uses the same boundary without listing
// its start twice. Interior revisits remain invalid rather than changing the route.
export function measurementBoundary(points){return points.length>2&&marsDistance(points[0],points.at(-1))<.1?points.slice(0,-1):points;}
export function distanceLabel(metres,unit='auto'){return unit==='m'||(unit==='auto'&&metres<1000)?metres.toLocaleString('en',{minimumFractionDigits:1,maximumFractionDigits:1})+' m':(metres/1000).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2})+' km';}
export function areaLabel(area,unit='auto'){return unit==='m'||(unit==='auto'&&area<1e6)?area.toLocaleString('en',{maximumFractionDigits:1})+' m²':(area/1e6).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2})+' km²';}
// Use CSS pixels, not a geographic radius: snapping must feel the same at any zoom.
// Callers supply only points that are visible in the active map.
export function nearestMeasurementPoint(screen,candidates,radius=14){
 if(!screen||!Number.isFinite(screen.x)||!Number.isFinite(screen.y))return null;
 let nearest=null,best=radius*radius;
 for(const candidate of candidates){const p=candidate.screen;if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;const d=(p.x-screen.x)**2+(p.y-screen.y)**2;if(d<=best&&(nearest===null||d<best)){nearest=candidate;best=d;}}
 return nearest;
}
const vector=p=>[Math.cos(p[1]*rad)*Math.cos(p[0]*rad),Math.cos(p[1]*rad)*Math.sin(p[0]*rad),Math.sin(p[1]*rad)];
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const angle=(a,b)=>Math.atan2(Math.hypot(...cross(a,b)),dot(a,b));
// Ground-polyline workers must never receive a near-antipodal edge or a
// zero-length preview. Split in our Mars sphere before Cesium computes its
// shadow volumes. Separate visits also avoid undefined 180-degree joins.
export function measurementRenderLegs(points){
 const legs=[];
 for(let i=1;i<points.length;i++){
  const a=measurementPoint(points[i-1]),b=measurementPoint(points[i]);
  if(marsDistance(a,b)<.1)continue;
  legs.push(sphericalArc(a,b,5*rad));
 }
 return legs;
}
export function sphericalArc(a,b,step,minimum=1){
 const u=vector(a),v=vector(b),cos=Math.max(-1,Math.min(1,dot(u,v))),theta=angle(u,v),n=Math.max(minimum,Math.ceil(theta/step));
 let tangent=v.map((x,i)=>x-cos*u[i]),length=Math.hypot(...tangent);
 if(length<1e-10){const basis=Math.abs(u[2])<.9?[0,0,1]:[1,0,0],d=dot(basis,u);tangent=basis.map((x,i)=>x-d*u[i]);length=Math.hypot(...tangent);}
 tangent=tangent.map(x=>x/length);
 const out=[a];
 for(let j=1;j<n;j++){const t=theta*j/n,w=u.map((x,k)=>x*Math.cos(t)+tangent[k]*Math.sin(t));out.push([Math.atan2(w[1],w[0])/rad,Math.atan2(w[2],Math.hypot(w[0],w[1]))/rad]);}
 out.push(b);return out;
}
export function polygonMetrics(points){
 const ring=points.map(measurementPoint),perimeter=lineDistances(ring.length>1?[...ring,ring[0]]:ring).total;
 if(ring.length<3)return {area:null,perimeter,invalidReason:'Place at least three points for an area.'};
 const vectors=ring.map(vector),onArc=(a,b,p)=>Math.abs(angle(a,p)+angle(p,b)-angle(a,b))<1e-9;
 for(let i=0;i<ring.length;i++)for(let j=i+1;j<ring.length;j++)if(marsDistance(ring[i],ring[j])<.1)return {area:null,perimeter,invalidReason:'Use distinct boundary points; click the first point to close.'};
 for(let i=0;i<ring.length;i++){
  const a=vectors[i],b=vectors[(i+1)%ring.length];
  if(angle(a,b)>Math.PI-1e-8)return {area:null,perimeter,invalidReason:'Split edges that span half the planet into shorter segments.'};
  for(let j=i+1;j<ring.length;j++){
   if(j===i+1||(i===0&&j===ring.length-1))continue;
   const c=vectors[j],d=vectors[(j+1)%ring.length],axis=cross(cross(a,b),cross(c,d)),length=Math.hypot(...axis);
   const intersections=length>1e-12?[axis.map(x=>x/length),axis.map(x=>-x/length)]:[a,b,c,d];
   if(intersections.some(p=>onArc(a,b,p)&&onArc(c,d,p)))return {area:null,perimeter,invalidReason:'Boundary edges cross. Undo a point to make a simple area.'};
  }
 }
 // Signed spherical triangle excess. Unlike a flat projection this also works
 // across the longitude seam and around a pole. Report the smaller enclosed area.
 let excess=0;
 for(let i=1;i<vectors.length-1;i++){const a=vectors[0],b=vectors[i],c=vectors[i+1],det=dot(a,cross(b,c)),denominator=1+dot(a,b)+dot(b,c)+dot(c,a);if(Math.abs(det)+Math.abs(denominator)<1e-12)return {area:null,perimeter,invalidReason:'Split this planet-scale boundary into smaller areas.'};excess+=2*Math.atan2(det,denominator);}
 const sphere=4*Math.PI;let steradians=Math.abs(excess)%sphere;steradians=Math.min(steradians,sphere-steradians);
 const area=steradians*R*R;
 if(area<=Math.max(1e-6,perimeter*.001))return {area:null,perimeter,invalidReason:'These points are collinear and enclose no area. Add a point away from the line.'};
 return {area,perimeter,invalidReason:null};
}
// Densify the same shortest spherical arcs used for distance, then unwrap for
// Leaflet's geographic projection. Dateline crossings must not circle the map.
export function flatMeasurementPath(points,reference=0){
 const out=[];let longitude=reference;
 for(let index=0;index<points.length;index++){
  const a=measurementPoint(points[Math.max(0,index-1)]),b=measurementPoint(points[index]),arc=index?sphericalArc(a,b,.5*rad,16).slice(1):[b];
  for(const [lon,lat] of arc){
   longitude=lon+360*Math.round((longitude-lon)/360);out.push([lat,longitude]);
  }
 }
 return out;
}
export class MeasurementLine{
 constructor(){this.points=[];this.drawing=false;this.mode='distance';}
 add(point){if(!this.drawing)return false;const p=measurementPoint(point);if(this.points.length&&marsDistance(this.points.at(-1),p)<.1)return false;if(this.points.length>=MAX_MEASURE_POINTS)throw new Error('This line has 64 placements. Finish it or start a new line.');this.points.push(this.points.find(old=>marsDistance(old,p)<.1)??p);return true;}
 start(){this.points=[];this.drawing=true;}
 finish(){if(this.points.length<(this.mode==='area'?3:2))return false;if(this.mode==='area'){const {invalidReason}=polygonMetrics(measurementBoundary(this.points));if(invalidReason)throw new Error(invalidReason);}this.drawing=false;return true;}
 undo(){return this.points.pop();}
 clear(){this.points=[];this.drawing=false;}
 export(){const {numbers}=measurementPins(this.points);return {schema:this.mode==='area'?'mars-measurement/2':'mars-measurement/1',mode:this.mode,body:'Mars',longitude:'east-positive',latitude:'planetocentric',referenceSphereRadiusM:R,metric:'shortest spherical surface arcs; area is the smaller simple spherical polygon; excludes slope, hazards and route feasibility',points:this.points.map((p,i)=>({number:numbers[i],longitude:p[0],latitude:p[1]})),...lineDistances(this.points),...(this.mode==='area'?polygonMetrics(measurementBoundary(this.points)):{})};}
}

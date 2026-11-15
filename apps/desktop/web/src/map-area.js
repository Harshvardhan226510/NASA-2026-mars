// Selection geometry only. Catalogue footprints may contain source NoData gaps.
export function validArea(b) {
 return Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]>=-180&&b[0]<=180&&b[2]>=-180&&b[2]<=180&&b[0]!==b[2]&&b[1]>=-90&&b[3]<=90&&b[1]<b[3];
}
export function splitArea(b) {
 if(!validArea(b))throw Error('Enter west/east from −180 to 180 and south/north from −90 to 90. South must be below north; west and east must differ.');
 return b[0]<b[2]?[b]:[[b[0],b[1],180,b[3]],[-180,b[1],b[2],b[3]]].filter(r=>r[0]<r[2]);
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const onSegment=(p,a,b)=>Math.abs(cross(a,b,p))<1e-9&&p[0]>=Math.min(a[0],b[0])-1e-9&&p[0]<=Math.max(a[0],b[0])+1e-9&&p[1]>=Math.min(a[1],b[1])-1e-9&&p[1]<=Math.max(a[1],b[1])+1e-9;
export function segmentsIntersect(a,b,c,d){return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||onSegment(c,a,b)||onSegment(d,a,b)||onSegment(a,c,d)||onSegment(b,c,d);}
const MARS_RADIUS=3396190,rad=Math.PI/180;
export function marsRadiusBetween(a,b){
 const lat1=a[1]*rad,lat2=b[1]*rad,dlat=lat2-lat1,dlon=(b[0]-a[0])*rad;
 return 2*MARS_RADIUS*Math.asin(Math.sqrt(Math.min(1,Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2)));
}
export function circleOutline(circle){
 const c=circle?.center,radius=circle?.radiusMeters;
 if(!Array.isArray(c)||c.length!==2||!c.every(Number.isFinite)||Math.abs(c[0])>180||Math.abs(c[1])>=90||!Number.isFinite(radius)||radius<=0||radius>=Math.PI*MARS_RADIUS/2)throw Error('Enter a valid circle centre and positive radius smaller than a hemisphere.');
 const distance=radius/MARS_RADIUS,lat=c[1]*rad,lon=c[0]*rad;
 if(Math.abs(lat)+distance>=Math.PI/2)throw Error('This circle reaches a pole. Use a smaller radius or coordinate bounds.');
 return Array.from({length:128},(_,i)=>{const bearing=i/128*2*Math.PI,p=Math.asin(Math.max(-1,Math.min(1,Math.sin(lat)*Math.cos(distance)+Math.cos(lat)*Math.sin(distance)*Math.cos(bearing)))),l=lon+Math.atan2(Math.sin(bearing)*Math.sin(distance)*Math.cos(lat),Math.cos(distance)-Math.sin(lat)*Math.sin(p));return [((l/rad+180)%360+360)%360-180,p/rad];});
}
export function selectionShape(value) {
 if(value?.circle!=null){const polygon=circleOutline(value.circle);return {...selectionShape({polygon}),circle:{center:[...value.circle.center],radiusMeters:value.circle.radiusMeters}};}
 if(!value||value.polygon==null){const rectangles=splitArea(value?.bounds);return {bounds:[...value.bounds],polygons:rectangles.map(([w,s,e,n])=>[[w,s],[e,s],[e,n],[w,n]])};}
 const p=value.polygon;
 if(!Array.isArray(p)||p.length<3||p.length>256||p.some(v=>!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite)||Math.abs(v[0])>180||Math.abs(v[1])>90))throw Error('Draw a lasso with 3–256 valid points.');
 let area=0;
 for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length];if(Math.abs(a[0]-b[0])>180)throw Error('Use coordinate bounds for an area crossing the ±180° boundary.');
  if(a[0]===b[0]&&a[1]===b[1])throw Error('Lasso contains repeated points. Draw it again.');
  area+=a[0]*b[1]-b[0]*a[1];
  for(let j=i+2;j<p.length;j++){if(i===0&&j===p.length-1)continue;if(segmentsIntersect(a,b,p[j],p[(j+1)%p.length]))throw Error('The lasso crosses itself. Draw a single outline without crossing it.');}
 }
 if(Math.abs(area)<1e-8)throw Error('Select an area, rather than a line.');
 const bounds=[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
 return {bounds,polygon:p.map(v=>[...v]),polygons:[p]};
}
function inside(p,polygon){
 let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];if(onSegment(p,a,b))return true;
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
 }return yes;
}
function intersects(p,b){
 const corners=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]];
 if(p.some(v=>v[0]>=b[0]&&v[0]<=b[2]&&v[1]>=b[1]&&v[1]<=b[3])||corners.some(v=>inside(v,p)))return true;
 return p.some((a,i)=>corners.some((c,j)=>segmentsIntersect(a,p[(i+1)%p.length],c,corners[(j+1)%4])));
}
export function selectionIntersectsBounds(shape,bounds){
 const [w,s,e,n]=bounds;
 return splitArea(shape.bounds).some(b=>b[0]<e&&b[2]>w&&b[1]<n&&b[3]>s)
  && (!shape.polygon||intersects(shape.polygon,bounds));
}
// A fully contained tile can be counted with its descendants without visiting every pixel tile.
export function selectionContainsBounds(shape,bounds){
 const [w,s,e,n]=bounds;
 if(!shape.polygon)return splitArea(shape.bounds).some(b=>b[0]<=w&&b[1]<=s&&b[2]>=e&&b[3]>=n);
 const corners=[[w,s],[e,s],[e,n],[w,n]],polygon=shape.polygon;
 if(!corners.every(point=>inside(point,polygon)))return false;
 if(polygon.some(point=>point[0]>w&&point[0]<e&&point[1]>s&&point[1]<n))return false;
 return !polygon.some((point,i)=>corners.some((corner,j)=>segmentsIntersect(point,polygon[(i+1)%polygon.length],corner,corners[(j+1)%4])));
}
function covered(p,boxes){
 const west=Math.min(...p.map(v=>v[0])),east=Math.max(...p.map(v=>v[0]));
 const xs=[...new Set([...p.map(v=>v[0]),...boxes.flatMap(b=>[b[0],b[2]]).filter(x=>x>west&&x<east)])].sort((a,b)=>a-b);
 for(let i=1;i<xs.length;i++){
  const left=xs[i-1],right=xs[i];if(right-left<1e-12)continue;
  for(const x of [left+(right-left)*1e-7,(left+right)/2,right-(right-left)*1e-7]){
   const hits=[];for(let j=0;j<p.length;j++){const a=p[j],b=p[(j+1)%p.length];if((a[0]>x)!==(b[0]>x))hits.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}hits.sort((a,b)=>a-b);
   const intervals=boxes.filter(b=>b[0]<=x&&b[2]>=x).map(b=>[b[1],b[3]]).sort((a,b)=>a[0]-b[0]);
   for(let j=0;j+1<hits.length;j+=2){let top=hits[j];for(const [low,high] of intervals){if(high<top)continue;if(low>top+1e-8)break;top=Math.max(top,high);}if(top<hits[j+1]-1e-8)return false;}
  }
 }return true;
}
export function areaQualities(options,baseId,value) {
 const shape=selectionShape(Array.isArray(value)?{bounds:value}:value),base=options.find(o=>o.id===baseId),groups=new Map();
 for(const option of options){
  if(option.scope!=='regional'||option.imageryMetersPerPixel>=base.imageryMetersPerPixel||!shape.polygons.some(p=>intersects(p,option.bounds)))continue;
  const key=option.imageryMetersPerPixel;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(option);
 }
 return [...groups].sort(([a],[b])=>b-a).map(([resolution,packages])=>({
  resolution,packages,bytes:packages.reduce((sum,o)=>sum+o.bytes,0),
  complete:packages.length<=512&&shape.polygons.every(p=>covered(p,packages.map(o=>o.bounds))),
 }));
}
export function resolveArea(options,baseId,selection) {
 try{
  if(!selection||!Number.isFinite(selection.resolution))return null;
  const shape=selectionShape(selection),quality=areaQualities(options,baseId,selection).find(q=>q.resolution===selection.resolution&&q.complete);
  return quality?{bounds:shape.bounds,...(shape.polygon?{polygon:shape.polygon}:{}),...(shape.circle?{circle:shape.circle}:{}),resolution:selection.resolution,packageIds:quality.packages.map(o=>o.id)}:null;
 }catch{return null;}
}
export function pointInSelection(point,selection){const shape=selectionShape(selection);return shape.polygons.some(p=>inside(point,p));}

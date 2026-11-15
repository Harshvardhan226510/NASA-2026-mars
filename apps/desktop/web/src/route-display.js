import {terrainMeasurementLegs,measurementPositions} from './measurement-terrain.js';
// World-space simplification keeps terrain relief, unlike flattening the path.
// Only subpixel bends are removed; scientific route data is never edited.
export function simplifyRouteDisplay(points,tolerance){
 if(points.length<3||!(tolerance>0)||!points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)))return points;
 const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]],limit=tolerance*tolerance;
 while(stack.length){const [first,last]=stack.pop(),a=points[first],b=points[last],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,len=dx*dx+dy*dy+dz*dz;let far=limit,index=-1;
  for(let i=first+1;i<last;i++){const p=points[i],t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/len)):0,d=(p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2+(p.z-a.z-t*dz)**2;if(d>far){far=d;index=i;}}
  if(index>=0){keep.add(index);stack.push([first,index],[index,last]);}
 }
 return [...keep].sort((a,b)=>a-b).map(i=>points[i]);
}
// Display geometry only. Scientific route coordinates and costs stay unchanged.
export function addTerrainRoute(C,viewer,source,points,{surface=()=>null,color,width=3,dashed=false,priority=0}={}){
 const ink=C.Color.fromCssColorString(color);
 const legs=terrainMeasurementLegs(points);
 const combined=[];
 for(const leg of legs){
  if(!combined.length){combined.push(...leg);}
  else{combined.push(...leg.slice(1));}
 }
 const getPositions=measurementPositions(C,viewer.scene,combined,surface,1+priority*.5);
 const display=()=>getPositions();
 source.entities.add({polyline:{
  positions:new C.CallbackProperty(display,false),
  arcType:C.ArcType.NONE,clampToGround:false,width,
  material:dashed?new C.PolylineDashMaterialProperty({color:ink,dashLength:16}):ink
 }});
}
export const ROUTE_WIDTHS=[3,3,3];
// Visual precedence only; not a ranking of route safety or scientific value.
export const ROUTE_PRIORITY={return_route:0,deep_science:1,apf_survey:2,direct_safe:3};
export function routeVisible(shown='all',key){return shown==='all'||shown===key;}
export function orderedRouteKeys(keys){return [...keys].sort((a,b)=>(ROUTE_PRIORITY[a]??0)-(ROUTE_PRIORITY[b]??0));}
export function routePane(map,key){const name='route-priority-'+(ROUTE_PRIORITY[key]??0),pane=map.getPane(name)??map.createPane(name);pane.style.zIndex=String(410+(ROUTE_PRIORITY[key]??0));pane.style.pointerEvents='none';return name;}

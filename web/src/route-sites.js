import {R} from './raster.js';
import {routeProjection} from './route-geometry.js';

export const ROUTE_SITE_CATEGORIES={science:'Science',minerals:'Minerals',resources:'Resources'};
export const ROUTE_TARGET_LIMIT=6;
const valid=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const vector=([lon,lat])=>{lon*=Math.PI/180;lat*=Math.PI/180;return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];};
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const angle=(a,b)=>Math.atan2(Math.hypot(...cross(a,b)),Math.max(-1,Math.min(1,dot(a,b))));
export function corridorDistanceKm(point,start,goal){
 const p=vector(point),a=vector(start),b=vector(goal),ab=angle(a,b),normal=cross(a,b),length=Math.hypot(...normal);
 let nearest=Math.min(angle(p,a),angle(p,b));
 if(length>1e-12){
  const n=normal.map(v=>v/length),projection=p.map((v,i)=>v-dot(p,n)*n[i]),size=Math.hypot(...projection);
  if(size>1e-12)for(const sign of [1,-1]){const q=projection.map(v=>sign*v/size);if(angle(a,q)+angle(q,b)<=ab+1e-10)nearest=Math.min(nearest,angle(p,q));}
 }
 return nearest*R/1000;
}
export function routeSiteSettings(input){
 const value=input&&typeof input==='object'?input:{};
 return {enabled:value.enabled!==false,radiusKm:Number.isFinite(value.radiusKm)?Math.max(.1,Math.min(100,value.radiusKm)):5,
  categories:Array.isArray(value.categories)?Object.keys(ROUTE_SITE_CATEGORIES).filter(c=>value.categories.includes(c)):Object.keys(ROUTE_SITE_CATEGORIES),
  excluded:[...new Set((Array.isArray(value.excluded)?value.excluded:[]).filter(v=>typeof v==='string'&&v.length<=100))].slice(0,256),
  priorities:Object.fromEntries(Object.entries(value.priorities??{}).filter(([id,score])=>id.length<=100&&Number.isFinite(score)&&score>=0&&score<=100).slice(0,256))};
}
export function nearbyRouteSites(sites,start,goal,manual=[],input){
 const settings=routeSiteSettings(input),empty={targets:[],available:0,omitted:0};
 if(!settings.enabled||!valid(start)||!valid(goal))return empty;
 const anchors=[start,...manual.map(t=>t.point).filter(valid),goal],excluded=new Set(settings.excluded),seen=new Set(manual.map(t=>t.siteId??t.id));
 const candidates=(sites??[]).filter(s=>typeof s.id==='string'&&valid(s.center)&&settings.categories.includes(s.category)&&!excluded.has(s.id)&&!seen.has(s.id))
  .map(site=>({site,distance:Math.min(...anchors.slice(1).map((p,i)=>corridorDistanceKm(site.center,anchors[i],p)))}))
  .filter(t=>t.distance<=settings.radiusKm).sort((a,b)=>a.distance-b.distance||a.site.id.localeCompare(b.site.id));
 const targets=[],occupied=manual.map(t=>t.point).filter(valid);let available=0;
 for(const {site,distance} of candidates){
  if(seen.has(site.id)||occupied.some(p=>corridorDistanceKm(site.center,p,p)<.001))continue;
  seen.add(site.id);occupied.push(site.center);available++;
  if(targets.length>=Math.max(0,ROUTE_TARGET_LIMIT-manual.length))continue;
  targets.push({id:'site:'+site.id,siteId:site.id,name:site.name,point:[...site.center],score:Object.hasOwn(settings.priorities,site.id)?settings.priorities[site.id]:50,
   origin:'catalogue',category:site.category,evidence:site.evidence,coordinateNote:site.coordinateNote,source:site.sources?.[0]??null,distanceFromCorridorKm:distance});
 }
 return {targets,available,omitted:available-targets.length};
}

// Regional APF hints share the user's category, exclusion and priority controls.
export function routeAttractors(sites,grid,input){
 const settings=routeSiteSettings(input);if(!settings.enabled||!grid?.center)return [];
 const projection=routeProjection(grid.center),halfX=(grid.cols-1)*grid.resolution_meters/2,halfY=(grid.rows-1)*grid.resolution_meters/2;
 if(!Number.isFinite(halfX)||!Number.isFinite(halfY))return [];
 const seen=new Set(),result=[];
 for(const site of sites??[]){
  if(typeof site.id!=='string'||seen.has(site.id)||!valid(site.center)||!settings.categories.includes(site.category)||settings.excluded.includes(site.id))continue;
  let xy;try{xy=projection.forward(site.center);}catch{continue;}
  if(Math.abs(xy[0])>halfX||Math.abs(xy[1])>halfY)continue;
  seen.add(site.id);result.push({id:'site:'+site.id,siteId:site.id,name:site.name,point:[...site.center],category:site.category,origin:'catalogue',source:site.sources?.[0]??null,score:Object.hasOwn(settings.priorities,site.id)?settings.priorities[site.id]:50,radius_m:Math.max(10,Math.min(50000,(site.radiusKm??5)*1000)),distance:Math.hypot(...xy)});
 }
 return result.sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id)).slice(0,20).map(({distance,...site})=>site);
}

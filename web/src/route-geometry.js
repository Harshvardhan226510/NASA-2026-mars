import {R} from './raster.js';
import {measurementRenderLegs} from './measurement-geometry.js';
const rad=Math.PI/180;
export const ROUTE_MAX_CELLS=513;
export const wrapRouteLongitude=lon=>((lon+180)%360+360)%360-180;
export function routeRenderLegs(waypoints,maxPointsPerChunk=32){
 if(!waypoints||waypoints.length<2)return [];
 const points=waypoints.map(p=>Array.isArray(p)?p:[p.lon,p.lat]);
 const rawLegs=measurementRenderLegs(points);
 if(!rawLegs.length)return [];
 const chunks=[];let current=[...rawLegs[0]];
 for(let i=1;i<rawLegs.length;i++){
  const leg=rawLegs[i];if(!leg||leg.length<2)continue;
  const last=current[current.length-1],first=leg[0];
  const isContinuous=Math.abs(first[0]-last[0])<1e-6&&Math.abs(first[1]-last[1])<1e-6;
  if(isContinuous&&current.length+leg.length-1<=maxPointsPerChunk){
   current.push(...leg.slice(1));
  }else{
   chunks.push(current);current=[...leg];
  }
 }
 if(current.length>=2)chunks.push(current);
 return chunks;
}
export function routeProjection(center){
 const [lon0,lat0]=center.map(x=>x*rad);
 return {
  forward([lon,lat]){lon*=rad;lat*=rad;const dl=((lon-lon0+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI,angle=Math.acos(Math.max(-1,Math.min(1,Math.sin(lat0)*Math.sin(lat)+Math.cos(lat0)*Math.cos(lat)*Math.cos(dl))));if(Math.PI-angle<1e-7)throw new Error('These points include the grid centre’s antipode. Plan that journey in separate sections.');const k=angle>1e-10?angle/Math.sin(angle):1;return [R*k*Math.cos(lat)*Math.sin(dl),R*k*(Math.cos(lat0)*Math.sin(lat)-Math.sin(lat0)*Math.cos(lat)*Math.cos(dl))];},
  inverse([x,y]){const distance=Math.hypot(x,y);if(distance<1e-9)return [...center];const a=distance/R,lat=Math.asin(Math.max(-1,Math.min(1,Math.cos(a)*Math.sin(lat0)+y*Math.sin(a)*Math.cos(lat0)/distance))),lon=lon0+Math.atan2(x*Math.sin(a),distance*Math.cos(lat0)*Math.cos(a)-y*Math.sin(lat0)*Math.sin(a));return [wrapRouteLongitude(lon/rad),lat/rad];}
 };
}
export function routeCenter(points){
 const xyz=points.reduce((sum,[lon,lat])=>{lon*=rad;lat*=rad;return sum.map((v,i)=>v+[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)][i]);},[0,0,0]);
 return [Math.atan2(xyz[1],xyz[0])/rad,Math.atan2(xyz[2],Math.hypot(xyz[0],xyz[1]))/rad];
}
export function missionWindow(points,spacing=25){
 if(points.length<2||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[1])>90||Math.abs(p[0])>180))throw new Error('Choose valid start and destination coordinates.');
 if(!Number.isFinite(spacing)||spacing<.5)throw new Error('Choose a positive terrain spacing of at least 0.5 m.');
 const center=routeCenter(points),projection=routeProjection(center),local=points.map(projection.forward),radius=Math.max(...local.flatMap(([x,y])=>[Math.abs(x),Math.abs(y)]));
 const extent=radius*2,padding=Math.max(300,extent*.15),side=extent+padding*2;
 const resolution=Math.max(spacing,Math.ceil(side/(ROUTE_MAX_CELLS-1))),size=Math.min(ROUTE_MAX_CELLS,Math.max(9,Math.ceil(Math.ceil(side/resolution)/2)*2+1)),half=(size-1)/2*resolution;
 // AEQD has a real singularity at the antipode, rather than a kilometre cap.
 const angle=Math.SQRT2*half/R;if(angle>=Math.PI-1e-7)throw new Error('This area wraps around the grid centre’s antipode. Plan it in separate sections.');
 const samples=[];for(let i=0;i<=64;i++){const v=-half+i*half/32;for(const [x,y] of [[v,-half],[v,half],[-half,v],[half,v]])samples.push(projection.inverse([x,y]));}
 const lons=samples.map(p=>p[0]+360*Math.round((center[0]-p[0])/360)),lats=samples.map(p=>p[1]);
 const bounds=[Math.min(...lons),Math.min(...lats),Math.max(...lons),Math.max(...lats)];
 for(const pole of [-90,90]){let xy;try{xy=projection.forward([center[0],pole]);}catch{continue;}if(xy.every(v=>Math.abs(v)<=half)){bounds[0]=center[0]-180;bounds[2]=center[0]+180;bounds[pole<0?1:3]=pole;}}
 return {center,projection,size,resolution,half,bounds,requestedSpacing:spacing,maxScaleError:angle/Math.sin(angle)-1,point:(r,c)=>projection.inverse([(c-(size-1)/2)*resolution,((size-1)/2-r)*resolution])};
}
export function routeGeoJSON(result){
 const features=[];
 for(const [name,route] of Object.entries(result.routes)){if(!route.waypoints?.length)continue;features.push({type:'Feature',properties:{profile:name,status:route.status,...route.summary,validation:route.validation,unreached_targets:route.unreached_targets??[]},geometry:{type:'LineString',coordinates:route.waypoints.map(p=>[p.lon,p.lat,p.elevation_m])}});}
 if(result.return_route?.waypoints?.length)features.push({type:'Feature',properties:{role:'return_to_habitat',profile:'direct_safe',status:result.return_route.status,...result.return_route.summary},geometry:{type:'LineString',coordinates:result.return_route.waypoints.map(p=>[p.lon,p.lat,p.elevation_m])}});
 for(const [name,point] of [['Start',result.start],['Destination',result.goal]])features.push({type:'Feature',properties:{name},geometry:{type:'Point',coordinates:point}});
 for(const target of result.targets)features.push({type:'Feature',properties:{name:target.name,priority:target.score,id:target.id,...(target.origin==='catalogue'?{origin:target.origin,siteId:target.siteId,category:target.category,evidence:target.evidence,coordinateNote:target.coordinateNote,source:target.source}:{} )},geometry:{type:'Point',coordinates:target.point}});
 for(const entry of result.mission_operation?.logs??[])features.push({type:'Feature',properties:{role:'field_log',kind:entry.kind,at:entry.at,note:entry.note,stationId:entry.stationId,active:entry.active,radius_m:entry.radius_m,basis:'user_report'},geometry:{type:'Point',coordinates:entry.point}});
 return {type:'FeatureCollection',name:'Mars mission routes',planet:'Mars',coordinate_system:'east-positive longitude, planetocentric latitude; source elevation datum',metadata:result.metadata,...(result.mission_operation?{mission_operation:result.mission_operation,mission_budget:result.mission_budget}:{}),features};
}

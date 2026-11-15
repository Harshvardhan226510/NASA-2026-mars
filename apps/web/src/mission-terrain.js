import {routeProjection} from './route-geometry.js';
import {routeProfile} from './route-profile.js';
import {marsDistance} from './measurement-geometry.js';
import {marsSun} from './solar-geometry.js';
import {solarTerrain} from './terrain-metrics.js';
const R=3396190,rad=Math.PI/180;
export const UNSUPPORTED_HAZARDS=['Rocks below DEM sampling','Soil strength / traction','Unmapped cliffs and overhangs','Radiation exposure','Suit thermal control and rescue','Radio link budget / Fresnel clearance'];
export function gridSampler(grid){
 const projection=routeProjection(grid.center),halfR=(grid.rows-1)/2,halfC=(grid.cols-1)/2,spacing=grid.resolution_meters;
 return (lon,lat)=>{
  let xy;try{xy=projection.forward([lon,lat]);}catch{return NaN;}
  const x=xy[0]/spacing+halfC,y=halfR-xy[1]/spacing;if(x<0||y<0||x>grid.cols-1||y>grid.rows-1)return NaN;
  const col=Math.min(grid.cols-2,Math.floor(x)),row=Math.min(grid.rows-2,Math.floor(y)),u=x-col,v=y-row;
  const values=[grid.elevation_matrix[row]?.[col],grid.elevation_matrix[row]?.[col+1],grid.elevation_matrix[row+1]?.[col],grid.elevation_matrix[row+1]?.[col+1]];
  if(!values.every(Number.isFinite))return NaN;
  return values[0]*(1-u)*(1-v)+values[1]*u*(1-v)+values[2]*(1-u)*v+values[3]*u*v;
 };
}
const xyz=([lon,lat],height)=>{const r=R+height,p=lat*rad,l=lon*rad;return [r*Math.cos(p)*Math.cos(l),r*Math.cos(p)*Math.sin(l),r*Math.sin(p)];};
export function terrainLineOfSight(sample,from,to,fromHeight,toHeight,spacing){
 const aHeight=sample(...from),bHeight=sample(...to),distance=marsDistance(from,to);
 if(![aHeight,bHeight].every(Number.isFinite))return {state:'unknown',distance_m:distance,reason:'Endpoint terrain is unavailable.'};
 const a=xyz(from,aHeight+fromHeight),b=xyz(to,bHeight+toHeight),count=Math.min(2048,Math.max(2,Math.ceil(distance/Math.max(1,spacing)))),actual=distance/count;
 let clearance=Infinity,missing=0,blocked=false;
 for(let i=0;i<=count;i++){
  const p=a.map((v,j)=>v+(b[j]-v)*i/count),height=Math.hypot(...p)-R,lon=Math.atan2(p[1],p[0])/rad,lat=Math.atan2(p[2],Math.hypot(p[0],p[1]))/rad,h=sample(lon,lat);
  if(!Number.isFinite(h)){missing++;continue;}clearance=Math.min(clearance,height-h);if(height<h-.02)blocked=true;
 }
 return {state:blocked?'blocked':missing||actual>spacing*2?'unknown':'clear',distance_m:distance,min_clearance_m:Number.isFinite(clearance)?clearance:null,sampling_m:actual,unknown_samples:missing,reason:blocked?'Sampled terrain intersects the straight ray.':missing?'Terrain is unavailable along the ray.':actual>spacing*2?'Ray sampling is too coarse.':'No terrain intersection found at sampled intervals; not a radio-link guarantee.'};
}
export function routeAudit(route,metadata,leg='outward'){
 const p=routeProfile(route,metadata),stride=Math.max(1,Math.ceil((p.samples.length-1)/96)),segments=[];
 for(let from=0;from<p.samples.length-1;from+=stride){const to=Math.min(p.samples.length-1,from+stride),slice=p.samples.slice(from,to+1),a=slice[0],b=slice.at(-1),missing=slice.filter(s=>s.elevation_m===null).length,maxInterval=Math.max(0,...slice.slice(1).map((s,i)=>s.distance_m-slice[i].distance_m)),spacing=metadata.grid_spacing_m??null;
  segments.push({leg,index:segments.length,a:[a.lon,a.lat],b:[b.lon,b.lat],from_m:a.distance_m,to_m:b.distance_m,source:metadata.source?.label??'Unknown terrain source',source_sample_m:metadata.source?.sample_m??null,analysis_spacing_m:spacing,profile_interval_m:maxInterval,missing_samples:missing,sample_count:slice.length,state:missing?'missing':p.legacy||spacing===null||maxInterval>spacing*Math.SQRT2*1.02?'gap':'sampled'});
 }
 return {segments,legacy:p.legacy,unknown_grid_cells:metadata.unknown_cells??null,unsupported:UNSUPPORTED_HAZARDS};
}
export function analysisSignature(result,profile,state){
 const c=state.config,temporal=Object.fromEntries(['departure','speed_kmh','speed_factor','night_factor','break_after_min','break_min','round_trip','comms','receiver_point','walker_height_m','receiver_height_m'].map(k=>[k,c[k]])),targets=(result?.targets??[]).map(t=>[t.id,t.point]),tasks=(result?.targets??[]).map(t=>[t.id,state.tasks[t.id]?.minutes??15,state.tasks[t.id]?.status??'planned']).sort((a,b)=>a[0].localeCompare(b[0])),geometry=r=>(r?.terrain_profile?.samples??r?.waypoints??[]).map(p=>[p.lon,p.lat,p.elevation_m]);
 const value=JSON.stringify([result?.metadata?.mission_id??result?.metadata?.elapsed_ms,result?.start,result?.goal,targets,profile,temporal,state.evaReturn??state.home,tasks,geometry(result?.routes?.[profile]),geometry(result?.return_route),result?.metadata?.grid_spacing_m,result?.metadata?.source?.sample_m]);let hash=2166136261;
 for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);return (hash>>>0).toString(16);
}
export function visibilityGaps(points){
 const groups=[];let current=null;
 for(const p of points){const state=p.visibility?.state??'unknown';if(state==='clear'){current=null;continue;}if(current&&current.leg===p.leg&&current.state===state){current.to=p.distance_m;current.count++;}else{current={leg:p.leg,state,from:p.distance_m,to:p.distance_m,count:1};groups.push(current);}}
 return groups;
}
export function analyseMission(result,profile,state,budget,grid){
 const metadata=result.metadata,sample=gridSampler(grid),receiver=state.config.receiver_point??state.evaReturn??state.home??result.return_to??result.start,points=[];
 for(const p of budget.conditions){
  let light='unknown',factor=null;
  if(Number.isFinite(p.solar_elevation_deg)&&p.solar_elevation_deg<=0){light='night';factor=0;}
  else try{const value=solarTerrain(sample,p.lon,p.lat,grid.resolution_meters,marsSun(p.at));if(Number.isFinite(value)){factor=value;light=value<=0?'local_shade':'no_local_shadow';}}catch{}
  const visibility=state.config.comms?terrainLineOfSight(sample,[p.lon,p.lat],receiver,state.config.walker_height_m,state.config.receiver_height_m,grid.resolution_meters):null;
  points.push({...p,light,illumination_factor:factor,visibility});
 }
 return {version:1,profile,signature:analysisSignature(result,profile,state),at:new Date().toISOString(),receiver,source:metadata.source?.label??'Unknown',analysis_spacing_m:grid.resolution_meters,
  audits:[routeAudit(result.routes[profile],metadata),...(state.config.round_trip&&result.return_route?[routeAudit(result.return_route,metadata,'return')]:[])],points,
  horizon_note:'Local slope and sunward horizon sampled to 8 analysis cells. Distant terrain shadows may be missed. Atmospheric attenuation is excluded.',comms_note:'Straight-ray terrain visibility on the Mars reference sphere using physical DEM heights. Endpoint heights are declared scenario inputs. No diffraction, Fresnel zone, antenna pattern, power, frequency or relay schedule is modeled.'};
}
export function validateMissionAnalysis(value){
 if(value===null||value===undefined)return null;
 const n=(v,min,max,nullable=false)=>{if(nullable&&v===null)return null;if(!Number.isFinite(v)||v<min||v>max)throw Error('Invalid saved mission terrain analysis.');return v;};
 const coord=p=>{if(!Array.isArray(p)||p.length!==2)throw Error('Invalid analysis coordinates.');return [n(p[0],-180,180),n(p[1],-90,90)];},str=(s,max=1000)=>String(s??'').slice(0,max);
 if(value.version!==1||!['direct_safe','apf_survey','deep_science'].includes(value.profile)||!Array.isArray(value.audits)||value.audits.length>2||!Array.isArray(value.points)||value.points.length>224)throw Error('Unsupported saved terrain analysis.');
 return {version:1,profile:value.profile,signature:str(value.signature,32),at:str(value.at,40),receiver:coord(value.receiver),source:str(value.source,300),analysis_spacing_m:n(value.analysis_spacing_m,.5,1e8),horizon_note:str(value.horizon_note),comms_note:str(value.comms_note),
  audits:value.audits.map(a=>{if(!Array.isArray(a.segments)||a.segments.length>96)throw Error('Too many saved audit segments.');return {legacy:a.legacy===true,unknown_grid_cells:a.unknown_grid_cells===null?null:n(a.unknown_grid_cells,0,263169),unsupported:UNSUPPORTED_HAZARDS,segments:a.segments.map((s,i)=>({leg:s.leg==='return'?'return':'outward',index:i,a:coord(s.a),b:coord(s.b),from_m:n(s.from_m,0,1e9),to_m:n(s.to_m,0,1e9),source:str(s.source,300),source_sample_m:n(s.source_sample_m,0,1e8,true),analysis_spacing_m:n(s.analysis_spacing_m,.5,1e8,true),profile_interval_m:n(s.profile_interval_m,0,1e9),missing_samples:n(s.missing_samples,0,7000),sample_count:n(s.sample_count,1,7000),state:['sampled','gap','missing'].includes(s.state)?s.state:'missing'}))};}),
  points:value.points.map(p=>({leg:p.leg==='return'?'return':'outward',distance_m:n(p.distance_m,0,1e9),at:str(p.at,40),lon:n(p.lon,-180,180),lat:n(p.lat,-90,90),solar_elevation_deg:n(p.solar_elevation_deg,-90,90,true),light:['night','local_shade','no_local_shadow','unknown'].includes(p.light)?p.light:'unknown',illumination_factor:n(p.illumination_factor,0,1,true),visibility:p.visibility?{state:['clear','blocked','unknown'].includes(p.visibility.state)?p.visibility.state:'unknown',distance_m:n(p.visibility.distance_m,0,1e9),min_clearance_m:p.visibility.min_clearance_m===undefined?null:n(p.visibility.min_clearance_m,-1e8,1e8,true),sampling_m:p.visibility.sampling_m===undefined?null:n(p.visibility.sampling_m,0,1e9,true),unknown_samples:n(p.visibility.unknown_samples??0,0,2049),reason:str(p.visibility.reason)}:null}))};
}

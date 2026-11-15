import {routeSiteSettings,ROUTE_SITE_CATEGORIES} from './route-sites.js';
import {walkState} from './mission-planning.js';
import {validateUserSites} from './user-sites.js';
import {validatePerimeters} from './perimeters.js';
import {commsScenario} from './comms-model.js';
const profiles=['direct_safe','apf_survey','deep_science'];
export const MISSION_SCHEMA='mars-atlas-mission/1',MAX_MISSION_BYTES=2_000_000;
export function matchesMissionSelection(params,selection){
 for(const key of ['orbiter','moon','spacecraft','region'])if(params.has(key)){
  if(params.get(key)!==selection[key])return false;
  if(key!=='region'||params.get(key)!=='COORDINATES')return true;
  return Array.isArray(selection.center)&&Math.abs(Number(params.get('lon'))-selection.center[0])<1e-7&&Math.abs(Number(params.get('lat'))-selection.center[1])<1e-7;
 }
 return true;
}
const finite=(v,min,max,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`Invalid ${label} in this mission.`);return v;};
const text=(v,max=160)=>String(v??'').slice(0,max);
export function missionPoint(p){if(!Array.isArray(p)||p.length!==2)throw new Error('Invalid mission coordinates.');return [finite(p[0],-180,180,'longitude'),finite(p[1],-90,90,'latitude')];}
function record(value,depth=0){
 if(depth>5)return null;if(value===null||typeof value==='boolean')return value;
 if(typeof value==='number')return Number.isFinite(value)?value:null;if(typeof value==='string')return value.slice(0,1000);
 if(Array.isArray(value))return value.slice(0,128).map(v=>record(v,depth+1));
 if(!value||typeof value!=='object')return null;return Object.fromEntries(Object.entries(value).filter(([key])=>!['__proto__','constructor','prototype'].includes(key)).slice(0,100).map(([k,v])=>[k,record(v,depth+1)]));
}
function sample(p){const [lon,lat]=missionPoint([p?.lon,p?.lat]);return {lon,lat,elevation_m:p.elevation_m===null?null:finite(p.elevation_m,-15000,30000,'source height'),...(p.distance_m!==undefined?{distance_m:finite(p.distance_m,0,1e10,'profile distance')}:{} )};}
function checkpoints(values){
 if(!Array.isArray(values)||values.length>6)throw new Error('A mission supports up to six route checkpoints.');
 return values.map((t,i)=>{
  const target={id:text(t.id||`checkpoint-${i}`,100),name:text(t.name,120),point:missionPoint(t.point),score:finite(t.score,0,100,'checkpoint priority')};
  if(t.origin==='catalogue')Object.assign(target,{origin:'catalogue',siteId:text(t.siteId,100),category:Object.hasOwn(ROUTE_SITE_CATEGORIES,t.category)?t.category:'science',evidence:text(t.evidence,500),coordinateNote:text(t.coordinateNote,1000),source:t.source&&/^https?:\/\//.test(t.source.url)?{title:text(t.source.title,300),url:text(t.source.url,2000)}:null,distanceFromCorridorKm:finite(t.distanceFromCorridorKm??0,0,100,'site corridor distance')});
  return target;
 });
}
function savedRoute(r){
 if(!r||typeof r.status!=='string')throw new Error('Missing route profile.');
 if((r.waypoints?.length??0)>6000||(r.terrain_profile?.samples?.length??0)>7000)throw new Error('This saved profile exceeds the supported size.');
 const route={...record({...r,waypoints:undefined,grid_path:undefined,terrain_profile:undefined}),waypoints:(r.waypoints??[]).map(sample)};
 if(r.terrain_profile)route.terrain_profile={...record({...r.terrain_profile,samples:undefined}),samples:r.terrain_profile.samples.map(p=>({...sample(p),...(p.travel_energy_kj===undefined?{}:{travel_energy_kj:finite(p.travel_energy_kj,0,1e15,'profile travel energy')})}))};
 return route;
}
export function validateMission(input){
 if(!input||input.schema!==MISSION_SCHEMA)throw new Error('Choose a Mars Field Atlas mission file.');
 const measurement=input.measurement??{},route=input.route??{},result=route.result;
 if(!Array.isArray(measurement.points)||measurement.points.length>64)throw new Error('A mission supports up to 64 measurement placements.');
 if(!Array.isArray(route.targets)||route.targets.length>6)throw new Error('A mission supports up to six route checkpoints.');
 const settings=record(route.settings??{}),layers=Object.fromEntries(Object.entries(input.layers??{}).filter(([k,v])=>/^[a-zA-Z][\w-]{0,70}$/.test(k)&&typeof v==='boolean'));
 const c=input.camera,flat=input.flat;
 const clean={schema:MISSION_SCHEMA,name:text(input.name||'Untitled mission',80),saved_at:text(input.saved_at,60),view:['3d','2d','split'].includes(input.view)?input.view:'3d',appearance:input.appearance==='color'?'color':'grayscale',layers,controls:record(input.controls??{}),relief:input.relief===true,compareLinked:input.compareLinked!==false,selection:record(input.selection??{}),measurement:{points:measurement.points.map(missionPoint),mode:measurement.mode==='area'?'area':'distance',unit:['auto','m','km'].includes(measurement.unit)?measurement.unit:'auto',snap:measurement.snap!==false},route:{start:route.start?missionPoint(route.start):null,goal:route.goal?missionPoint(route.goal):null,targets:checkpoints(route.targets),sites:routeSiteSettings(route.sites),settings,shown:['all',...profiles].includes(route.shown)?route.shown:'all',result:null}};
 clean.userSites=validateUserSites(input.userSites);
 if(input.commsCoverage)clean.commsCoverage=commsScenario(input.commsCoverage);
 if(input.perimeters!==undefined)clean.perimeters=validatePerimeters(input.perimeters);
 if(c){const [lon,lat]=missionPoint([c.lon,c.lat]);clean.camera={lon,lat,height:finite(c.height,-15000,1_000_000_000,'camera height'),heading:finite(c.heading,-10,10,'heading'),pitch:finite(c.pitch,-Math.PI/2,Math.PI/2,'pitch'),roll:finite(c.roll,-10,10,'roll')};}
 if(flat){const [lon,lat]=missionPoint([flat.lon,flat.lat]);clean.flat={lon,lat,zoom:finite(flat.zoom,0,23,'map zoom')};}
 if(result){
  if(result.schema!=='mars-route-result/1'||!result.routes||!result.metadata)throw new Error('Invalid saved route results.');
  const routes={};for(const key of profiles)routes[key]=savedRoute(result.routes[key]);
  const m=record(result.metadata);for(const key of ['grid_spacing_m','window_width_m','max_slope_deg'])finite(m[key],0,100_000_000,key);
  const source={...m.source,label:text(m.source?.label||'Saved terrain source'),sample_m:Number.isFinite(m.source?.sample_m)?Math.max(.5,m.source.sample_m):m.grid_spacing_m,requested_spacing_m:Number.isFinite(m.source?.requested_spacing_m)?Math.max(.5,m.source.requested_spacing_m):m.grid_spacing_m,warning:text(m.source?.warning||'Saved source; recalculate to check current availability.',1000)};
  clean.route.result={schema:'mars-route-result/1',status:'success',routes,return_route:result.return_route?savedRoute(result.return_route):null,return_to:result.return_to?missionPoint(result.return_to):null,metadata:{...m,unknown_cells:Number.isFinite(m.unknown_cells)?m.unknown_cells:0,projection_max_scale_error:Number.isFinite(m.projection_max_scale_error)?m.projection_max_scale_error:0,source},start:missionPoint(result.start),goal:missionPoint(result.goal),targets:result.targets===undefined?clean.route.targets:checkpoints(result.targets)};
 }
 clean.route.operation=walkState(route.operation);
 if(JSON.stringify(clean).length>MAX_MISSION_BYTES)throw new Error('This mission exceeds the 2 MB file limit.');return clean;
}
export async function encodeMission(mission){
 const bytes=new TextEncoder().encode(JSON.stringify(validateMission(mission))),compressed=await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
 let binary='';for(const n of new Uint8Array(compressed))binary+=String.fromCharCode(n);const encoded=btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');if(encoded.length>60000)throw new Error('This mission is too detailed for a link. Download the mission file to share its complete profiles.');return encoded;
}
export async function decodeMission(encoded){
 if(!/^[\w-]+$/.test(encoded)||encoded.length>60000)throw new Error('This mission link is invalid or too large.');
 const binary=atob(encoded.replaceAll('-','+').replaceAll('_','/')),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();let size=0,parts=[];
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_MISSION_BYTES){await reader.cancel();throw new Error('This mission link exceeds the supported size.');}parts.push(value);}
 return validateMission(JSON.parse(await new Blob(parts).text()));
}

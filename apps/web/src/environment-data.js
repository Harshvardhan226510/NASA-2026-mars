import {sampleWind,windMetadata,windHour} from './wind-data.js';
export {windHour as environmentHour};
export const ENVIRONMENT_PARAMETERS={Tsurf:{unit:'K',min:100,max:400},Tair:{unit:'K',min:80,max:400},Psurf:{unit:'Pa',min:0,max:3000},Dust:{unit:'tau',min:0,max:100},Ice:{unit:'tau',min:0,max:100},Vapor:{unit:'pr-um',min:0,max:1000},Frost:{unit:'cm',min:0,max:100000},Snow:{unit:'cm',min:0,max:100000},Rad:{unit:'level',min:0,max:10000}};
export function environmentTime(value=Date.now()){
 const at=windHour(value),year=new Date(at).getUTCFullYear();if(year<2000||year>2030)throw Error('Choose a model time between 2000 and 2030.');return at;
}
export function environmentMetadata(html,at){const meta=windMetadata(html,at);delete meta.height_note;return {...meta,height_note:'The grid endpoint does not document an exact air-temperature evaluation height.'};}
export function normalizeEnvironment(raw,param,metadata,provenance=[]){
 const spec=ENVIRONMENT_PARAMETERS[param],h=raw?.header;if(!spec||h?.param!==param||h.unit!==spec.unit)throw Error('NASA environment parameter/units changed');
 const {nlon,nlat,lons,lats}=h;if(!Number.isInteger(nlon)||!Number.isInteger(nlat)||nlon<3||nlat<3||nlon>360||nlat>181||lons?.length!==nlon||lats?.length!==nlat||raw.data?.length!==nlon*nlat)throw Error('NASA environment dimensions changed');
 for(const [axis,lo,hi] of [[lons,0,360],[lats,-90,90]])if(axis.some((v,i)=>!Number.isFinite(v)||v<lo||v>hi||(i&&v<=axis[i-1])))throw Error('Invalid environment axis');
 const step=lons[1]-lons[0];if(Math.abs(step*nlon-360)>.01||lons.some((v,i)=>i&&Math.abs(v-lons[i-1]-step)>.01))throw Error('Environment longitude grid does not wrap');
 const values=raw.data.map(v=>typeof v==='number'&&Number.isFinite(v)&&v>=spec.min&&v<=spec.max?v:null);if(!values.some(v=>v!==null))throw Error('No valid environment cells');
 return {schema:'mars-environment/1',parameter:param,kind:'modeled_climatology',source:'NASA GSFC Mars Explorer / EMARS',...metadata,units:spec.unit,nlon,nlat,lons,lats,values,quality_flags:null,uncertainty:null,spatial_support:`${nlon} × ${nlat} climate grid; ${step}° longitude; no extrapolation beyond ${lats[0]}° to ${lats.at(-1)}° latitude.`,provenance,usable_for_mission_safety:false};
}
export function sampleEnvironment(grid,lon,lat){
 // Reuse the tested periodic interpolation and strict missing-neighbor mask.
 const v=sampleWind({...grid,east:grid.values,north:grid.values},lon,lat);return v?.east??null;
}
export function matchingGrids(grids){const g=grids[0];if(!g||grids.some(x=>x.model_time!==g.model_time||x.model_label!==g.model_label||JSON.stringify(x.lons)!==JSON.stringify(g.lons)||JSON.stringify(x.lats)!==JSON.stringify(g.lats)))throw Error('Environment source grids do not match');}
export function deriveEnvironment(field,grids){
 matchingGrids(grids);const g=grids[0];let units,values;
 if(field==='column'){units='kg/m²';values=g.values.map(p=>p===null?null:p/3.72076);}
 else if(field==='density'){units='kg/m³';const t=grids[1];if(g.parameter!=='Psurf'||t?.parameter!=='Tair')throw Error('Density requires pressure and air temperature');values=g.values.map((p,i)=>p===null||t.values[i]===null?null:p/(188.92*t.values[i]));}
 else if(field==='thermal'){units='W/m²';values=g.values.map(t=>t===null?null:5.670374419e-8*t**4);}
 else throw Error('Unknown environment derivation');
 return {...g,parameter:field,units,values,kind:'derived_climatology',derived_from:grids.map(x=>x.parameter),assumptions:field==='column'?'Hydrostatic column P/g, g = 3.72076 m/s².':field==='density'?'Ideal pure-CO₂ gas; R = 188.92 J/(kg K). Tair evaluation height is unspecified, so this is a density proxy, not a validated surface density.':'Bolometric blackbody reference ε = 1; σT⁴. Not a measured band radiance or actual material emissivity.',provenance:grids.flatMap(x=>x.provenance)};
}

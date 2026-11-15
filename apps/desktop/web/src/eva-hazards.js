import {gridSampler} from './mission-terrain.js';
import {terrainMetrics} from './terrain-metrics.js';
import {routeProfile} from './route-profile.js';
import {marsDistance} from './measurement-geometry.js';
import {routeFix} from './eva-navigation.js';

export const HAZARD_STATES={
 open:{label:'Within selected thresholds',color:'#7ddbb1'},
 caution:{label:'Steep or rough ground',color:'#ffc773'},
 blocked:{label:'Outside limits or reported obstacle',color:'#ff8c83'},
 limited:{label:'Regional slope only · local hazards unresolved',color:'#a4c6cf'},
 unknown:{label:'Coverage unavailable',color:'#8a9da8'}
};

export function obstacleAt(point,reports=[]){
 return reports.find(report=>marsDistance(point,report.point)<=report.radius_m+.01);
}

export function hazardInspector(grid,source,limits,reports=[]){
 const measured=source?.sample_m??null;
 const spacing=Math.max(grid?.resolution_meters??0,measured??0);
 const fine=Boolean(grid&&measured&&spacing<=30);
 const sample=grid?gridSampler(grid):null;
 return {fine,spacing,inspect(point){
  const report=obstacleAt(point,reports),metrics=sample&&spacing>0?terrainMetrics(sample,...point,spacing):null;
  if(report)return {state:'blocked',report,metrics,fine};
  if(!metrics)return {state:'unknown',metrics:null,fine};
  const raisedCandidate=fine&&spacing<=2&&metrics.tpi>=Math.max(.4,spacing*.3);
  if(metrics.slope>limits.slope||fine&&metrics.roughness>limits.roughness)return {state:'blocked',metrics,fine,raisedCandidate};
  if(raisedCandidate||metrics.slope>=limits.slope*.75||fine&&metrics.roughness>=limits.roughness*.65)return {state:'caution',metrics,fine,raisedCandidate};
  return {state:fine?'open':'limited',metrics,fine};
 },reports};
}

export function routeHazardSegments(route,metadata,inspector,limits){
 const points=routeProfile(route,metadata).samples,segments=[];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],p=[b.lon,b.lat],hit=inspector.inspect(p);
  const distance=b.distance_m-a.distance_m,energy=Number.isFinite(a.travel_energy_kj)&&Number.isFinite(b.travel_energy_kj)?Math.max(0,b.travel_energy_kj-a.travel_energy_kj):null;
  const gradient=b.slope_deg;
  const slope=Number.isFinite(gradient)||hit.metrics?Math.max(Math.abs(gradient??0),hit.metrics?.slope??0):null;
  const gap=distance>(metadata.grid_spacing_m??Infinity)*Math.SQRT2*1.02;
  const missing=a.elevation_m===null||b.elevation_m===null||gap;
  const report=hit.report??inspector.reports.find(report=>routeFix([a,b],report.point,1)?.separation<=report.radius_m+.01);
  let state=hit.state;
  if(report||slope>limits.slope)state='blocked';
  else if(missing||state==='unknown')state='unknown';
  else if(slope>=limits.slope*.75&&(state==='open'||state==='limited'))state='caution';
  segments.push({state,a:[a.lon,a.lat],b:p,from:a.distance_m,to:b.distance_m,slope,gradient,missing,gap,energy,
   intensity:energy!==null&&distance>0?energy*1000/distance:null,roughness:hit.fine?hit.metrics?.roughness:null,raisedCandidate:hit.raisedCandidate,report:report??null});
 }
 return segments;
}

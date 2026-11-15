import {hazardInspector,routeHazardSegments} from './eva-hazards.js';
import {routeProfile} from './route-profile.js';

const roughnessReference=0.75;
const clamp=value=>Math.max(0,Math.min(1,value));
export const ROUTE_RISK_METHOD='Comparative planning index. Higher scores indicate greater modeled concern. Maximum contributions are 40 for slope, 25 for roughness, 15 for effort and 20 for coverage. Slope uses the selected limit. Roughness uses a 0.75 m reference and requires DEM and grid sampling of 30 m or finer. Missing roughness receives half weight as uncertainty. Reported obstacles, slope exceedances and incomplete routes raise the score to at least 85.';

export function routeRisk(route,metadata={},grid=null,reports=[]){
 const source=metadata.source??{},profile=routeProfile(route,metadata);
 const distance=profile.distance_m;
 if(!(distance>0)||profile.min===null)return null;
 const limits={slope:metadata.max_slope_deg??22,roughness:roughnessReference};
 const spacing=Math.max(grid?.resolution_meters??0,metadata.grid_spacing_m??0,source.sample_m??0);
 const inspector=hazardInspector(spacing<=30?grid:null,source,limits,reports);
 const segments=routeHazardSegments(route,metadata,inspector,limits);
 let measured=0,roughnessDistance=0,slopeSum=0,roughnessSum=0,peakRoughness=null,obstacle=false;
 let peakSlope=Math.max(profile.max_slope_deg,route.validation?.max_sampled_slope_deg??0);
 for(const segment of segments){
  const length=segment.to-segment.from;
  obstacle||=Boolean(segment.report);
  if(!Number.isFinite(segment.gradient)||segment.missing)continue;
  measured+=length;
  if(inspector.fine)peakSlope=Math.max(peakSlope,segment.slope);
  slopeSum+=clamp(Math.abs(segment.gradient)/limits.slope)*length;
  if(Number.isFinite(segment.roughness)){
   roughnessDistance+=length;
   peakRoughness=Math.max(peakRoughness??0,segment.roughness);
   roughnessSum+=clamp(segment.roughness/roughnessReference)*length;
  }
 }
 const energy=route.summary?.minetti_energy_kj;
 const flat=3.2*metadata.mass_kg*(metadata.gravity_ratio+.15);
 const effort=Number.isFinite(energy)&&flat>0?energy*1000/distance/flat:null;
 const coverage=clamp(measured/distance),roughnessCoverage=clamp(roughnessDistance/distance);
 const uncertainty=Math.max(1-coverage,spacing?clamp(1-30/spacing):1,route.validation?.corridor_checked ? 0 : .5);
 const terms={
  slope:40*(.65*clamp(peakSlope/limits.slope)+.35*(slopeSum/distance+.5*(1-coverage))),
  roughness:25*(roughnessSum/distance+.5*(1-roughnessCoverage)),
  effort:15*(effort===null?.5:clamp((effort-1)/2)),
  coverage:20*uncertainty
 };
 const limitExceeded=obstacle||route.validation?.cliff_traverse||peakSlope>limits.slope||route.status!=='success';
 const score=Math.round(Math.max(limitExceeded?85:0,Object.values(terms).reduce((sum,value)=>sum+value,0)));
 return {score,peakSlope,peakRoughness,effort,spacing,coverage,roughnessCoverage,terms,limitExceeded,partial:roughnessCoverage<.999||uncertainty>0||effort===null};
}

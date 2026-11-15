import {SITE_WEIGHTS,SITE_PROFILES} from './site-evaluation.js';
import {validateUserSite} from './user-sites.js';

export const SITE_EDITOR_FIELDS={
 landing:['lon','lat','length','width','heading','slope','roughness','maxElevation','requiredArea','surroundingBuffer'],
 base:['lon','lat','length','width','heading','slope','roughness','requiredArea','sols','radius']
};
// Editable project scenarios, not mission design or vehicle certification limits.
export function siteEditorDefaults(mode,at=new Date().toISOString()){
 if(!Object.hasOwn(SITE_EDITOR_FIELDS,mode))throw Error('Choose landing or base evaluation.');
 const profile=SITE_PROFILES[mode];
 return {mode,lon:77.43,lat:18.44,length:mode==='landing'?5000:2000,width:mode==='landing'?3000:2000,heading:0,
  slope:profile.slope,roughness:profile.roughness,maxElevation:0,requiredArea:profile.requiredArea,surroundingBuffer:profile.surroundingBuffer,
  sols:mode==='landing'?1:30,radius:100,at,weights:{...SITE_WEIGHTS[mode]}};
}
export function evaluatedSiteDraft(result,id,{isValue=false,tags}={}){
 const o=result.options,kind=o.mode==='landing'?'landing':'base',n=v=>Number.isFinite(v)?Number(v.toFixed(2)):'unknown';
 return validateUserSite({id,name:result.name,center:[o.lon,o.lat],isValue,tags,category:'science',evaluationKind:kind,
  description:[`Evaluated ${kind==='landing'?'landing site':'base station'} candidate · ${result.evaluated_at}`,
   `Score bounds: ${n(result.lower)}–${n(result.upper)} / 100; weighted evidence coverage: ${n(result.coverage*100)}%.`,
   `Terrain screening: ${result.constraint_status}. Footprint: ${o.length} × ${o.width} m; heading ${o.heading}°.`,
   `Limits: slope ${o.slope}°; roughness ${o.roughness} m; connected area ${o.requiredArea} km².` ,
   kind==='landing'?`Vehicle elevation ceiling: ${o.maxElevation} m; outer terrain buffer: ${o.surroundingBuffer} m.`:`Sunlight interval: ${o.at}, ${o.sols} sols; resource search radius: ${o.radius} km.`,
   `Terrain source: ${result.source.label}; source sampling ≈${n(result.source.sample_m)} m; analysis grid ≈${n(result.source.analysis_spacing_m)} m.`,
   'Project preference estimate; unresolved hazards remain. This saved marker is a planning note, not verified landing or construction safety. Export the evaluation report for the full evidence and settings.'
  ].join('\n')});
}

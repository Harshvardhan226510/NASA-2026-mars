export function declaredCampPoint(state){
 const p=state?.home;
 return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90?[...p]:null;
}
export function evaluatedCampPoint(result){
 if(result?.options?.mode!=='base')throw Error('Declare camp from a base station evaluation.');
 const point=declaredCampPoint({home:[result.options.lon,result.options.lat]});
 if(!point)throw Error('The evaluated base has invalid coordinates.');
 return point;
}
export function sameCampPoint(a,b){return Boolean(a&&b&&a.length===2&&b.length===2&&a.every(Number.isFinite)&&b.every(Number.isFinite)&&Math.abs(a[1]-b[1])<1e-8&&Math.abs(((a[0]-b[0]+540)%360)-180)<1e-8);}
export function setCampDestination(planner){const point=declaredCampPoint(planner?.workbench?.state);if(!point)throw Error('Declare camp from a base evaluation or set a return habitat in Marswalk first.');planner.setPoint('goal',point);return point;}

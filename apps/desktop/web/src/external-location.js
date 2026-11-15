export const LOCATION_FRAME='mars-east-planetocentric',LOCATION_MAX_AGE_MS=10000;

export function locationFix(input){
 if(!input||input.frame!==LOCATION_FRAME||typeof input.sourceId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(input.sourceId))throw Error('Provide a sourceId and the mars-east-planetocentric frame.');
 const point=input.point;
 if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90)throw Error('Provide [east longitude, planetocentric latitude] in Mars degrees.');
 if(typeof input.at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input.at)||!Number.isFinite(Date.parse(input.at)))throw Error('Provide a valid UTC ISO timestamp.');
 const at=new Date(input.at).toISOString();if(at!==input.at.replace(/(?<=:\d{2})Z$/,'.000Z'))throw Error('Invalid UTC calendar time.');
 const accuracyMeters=input.accuracyMeters??null;
 if(accuracyMeters!==null&&(!Number.isFinite(accuracyMeters)||accuracyMeters<0||accuracyMeters>10000000))throw Error('accuracyMeters must be null or a nonnegative number up to 10000000.');
 return {sourceId:input.sourceId,frame:LOCATION_FRAME,point:[...point],at,accuracyMeters};
}

export function freshLocation(fix,now=Date.now()){
 const age=now-Date.parse(fix.at);return age>=-5000&&age<=LOCATION_MAX_AGE_MS;
}

export function siteLocationFix(input,center){
 if(input==null)return;
 const clean=locationFix(input);
 if(clean.point.some((value,index)=>value!==center[index]))throw Error('Location-source coordinates must match the saved site.');
 return clean;
}

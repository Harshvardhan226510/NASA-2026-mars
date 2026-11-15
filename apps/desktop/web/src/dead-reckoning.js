// Horizontal prototype dead reckoning on the app's Mars reference sphere.
// The map camera and planned route are never position measurements.
export const DR_RADIUS_METERS=3396190;
export const DR_MAX_POINTS=10000;
const rad=Math.PI/180;
const finite=(value,min,max,label)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error('Invalid '+label);return value;};
export function drPoint(point){if(!Array.isArray(point)||point.length!==2)throw Error('Expected longitude and latitude');return [finite(point[0],-180,180,'east longitude'),finite(point[1],-89.9,89.9,'planetocentric latitude (polar operation is not supported)')];}
const optional=(value,min,max,label)=>value===null||value===undefined?null:finite(value,min,max,label);
export function drOptions(value={}){
 const mode=value.mode??'manual';if(!['manual','readings','positions'].includes(mode))throw Error('Unknown position input mode');
 const sourceId=value.sourceId??(mode==='manual'?'manual':'gear-1');if(typeof sourceId!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(sourceId))throw Error('Use a simple source ID (letters, digits, hyphen or underscore)');
 return {mode,sourceId,metersPerTick:optional(value.metersPerTick,0.000001,10,'metres per encoder tick'),strideMeters:optional(value.strideMeters,0.1,3,'stride length'),headingOffsetDegrees:finite(value.headingOffsetDegrees??0,-360,360,'heading calibration offset'),initialErrorMeters:optional(value.initialErrorMeters,0,100000,'starting error bound'),distanceErrorFraction:optional(value.distanceErrorFraction,0,1,'distance error fraction'),headingErrorDegrees:optional(value.headingErrorDegrees,0,180,'heading error bound'),maxSpeedMetersPerSecond:finite(value.maxSpeedMetersPerSecond??10,0.1,100,'maximum plausible speed')};
}
export function drDistance(a,b){const p=a[1]*rad,q=b[1]*rad,dl=(b[0]-a[0])*rad,h=Math.sin((q-p)/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(dl/2)**2;return 2*DR_RADIUS_METERS*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));}
export function drAdvance(point,distanceMeters,headingDegrees){
 drPoint(point);finite(distanceMeters,-1000,1000,'signed travel distance');finite(headingDegrees,-720,720,'heading');
 const lat=point[1]*rad,lon=point[0]*rad,bearing=headingDegrees*rad,distance=distanceMeters/DR_RADIUS_METERS;
 const nextLat=Math.asin(Math.max(-1,Math.min(1,Math.sin(lat)*Math.cos(distance)+Math.cos(lat)*Math.sin(distance)*Math.cos(bearing))));
 const nextLon=lon+Math.atan2(Math.sin(bearing)*Math.sin(distance)*Math.cos(lat),Math.cos(distance)-Math.sin(lat)*Math.sin(nextLat));
 return drPoint([((nextLon/rad+180)%360+360)%360-180,nextLat/rad]);
}
export function createDRSession(point,options,id,now=Date.now()){
 if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid session identity');
 const anchor=drPoint(point),config=drOptions(options);finite(now,0,Number.MAX_SAFE_INTEGER,'time');
 return {schema:'mars-dead-reckoning/1',id,frame:'mars-east-planetocentric',radiusMeters:DR_RADIUS_METERS,anchor,options:config,phase:'ready',runId:null,engagedAt:null,lastSequence:0,lastTimestamp:null,distanceMeters:0,trail:[{point:anchor,timestampMs:now,errorMeters:config.initialErrorMeters,source:'manual-anchor'}]};
}
export function engageDR(state,runId,now=Date.now()){
 if(!state)throw Error('Set a starting location first');if(state.phase==='engaged')throw Error('Dead reckoning is already engaged');if(state.trail.length>=DR_MAX_POINTS)throw Error('Session full. Export it and choose a new start.');
 if(typeof runId!=='string'||!/^[a-f0-9-]{36}$/.test(runId))throw Error('Invalid run identity');
 return {...state,phase:'engaged',runId,engagedAt:now,lastSequence:0,lastTimestamp:null};
}
export function pauseDR(state){return state?{...state,phase:'paused',runId:null}:null;}
// Mutates only a service-owned candidate copy; a whole submitted batch is committed or rejected.
export function acceptDRSample(state,sample,now=Date.now()){
 if(!state||state.phase!=='engaged')throw Error('Engage dead reckoning before supplying samples');
 if(!sample||sample.sessionId!==state.id||sample.runId!==state.runId||sample.sourceId!==state.options.sourceId)throw Error('Sample belongs to another session, run or source');
 if(!Number.isSafeInteger(sample.sequence)||sample.sequence<=state.lastSequence)throw Error('Duplicate or out-of-order sample sequence');
 const timestamp=finite(sample.timestampMs,state.engagedAt,now+5000,'UTC sample timestamp');if(timestamp<=state.trail.at(-1).timestampMs)throw Error('Sample timestamps must increase');
 if(state.trail.length>=DR_MAX_POINTS)throw Error('Session full. Pause, export and start a new session.');
 const previous=state.trail.at(-1),o=state.options;let point,distance,error=null,measurement;
 if(sample.kind==='imu')throw Error('Raw IMU fusion requires the prototype sensor frame, calibration and gravity/attitude adapter. No position was updated.');
 if(o.mode==='positions'){
  if(sample.kind!=='position'||sample.frame!==state.frame)throw Error('Expected a processed position in the Mars coordinate frame');
  point=drPoint(sample.point);distance=drDistance(previous.point,point);error=optional(sample.errorMeters,0,100000,'reported position error');measurement={kind:'position'};
 }else{
  if(sample.headingReference!=='map-north')throw Error('Heading must be calibrated clockwise from map north; magnetic yaw is not accepted directly');
  const heading=finite(sample.headingDegrees,0,360,'heading');let signed;
  if(sample.kind==='motion')signed=finite(sample.distanceMeters,-1000,1000,'travel distance');
  else if(o.mode==='readings'&&sample.kind==='encoder'){if(o.metersPerTick===null||!Number.isSafeInteger(sample.deltaTicks))throw Error('Set metres per tick and provide integer deltaTicks');signed=finite(sample.deltaTicks*o.metersPerTick,-1000,1000,'encoder travel');}
  else if(o.mode==='readings'&&sample.kind==='steps'){if(o.strideMeters===null||!Number.isSafeInteger(sample.deltaSteps)||sample.deltaSteps<0)throw Error('Set stride length and provide nonnegative integer deltaSteps');signed=finite(sample.deltaSteps*o.strideMeters,0,1000,'step travel');}
  else throw Error('Expected a motion, encoder or step reading for this input mode');
  point=drAdvance(previous.point,signed,heading+o.headingOffsetDegrees);distance=Math.abs(signed);
  if(previous.errorMeters!==null&&o.distanceErrorFraction!==null&&o.headingErrorDegrees!==null)error=previous.errorMeters+distance*o.distanceErrorFraction+2*distance*Math.sin(o.headingErrorDegrees*rad/2);
  measurement={kind:sample.kind,distanceMeters:signed,headingDegrees:heading,headingReference:'map-north',deltaTicks:sample.kind==='encoder'?sample.deltaTicks:undefined,deltaSteps:sample.kind==='steps'?sample.deltaSteps:undefined};
 }
 if(distance>1000)throw Error('Position jump exceeds the 1 km per-sample prototype limit');
 if(o.mode!=='manual'){const seconds=(timestamp-(state.lastTimestamp??state.engagedAt))/1000;if(seconds<=0&&distance>0||seconds>0&&distance/seconds>o.maxSpeedMetersPerSecond)throw Error('Movement exceeds the configured plausible speed; check units, timestamps and calibration');}
 state.trail.push({point,timestampMs:timestamp,errorMeters:error,source:o.sourceId,sequence:sample.sequence,...measurement});state.distanceMeters+=distance;state.lastSequence=sample.sequence;state.lastTimestamp=timestamp;return state;
}
export function restoreDRSession(value){
 if(value?.schema!=='mars-dead-reckoning/1'||value.frame!=='mars-east-planetocentric'||value.radiusMeters!==DR_RADIUS_METERS||!Array.isArray(value.trail)||!value.trail.length||value.trail.length>DR_MAX_POINTS)throw Error('Invalid saved dead-reckoning session');
 const state=createDRSession(value.anchor,value.options,value.id,value.trail[0].timestampMs);
 state.trail=value.trail.map(item=>({point:drPoint(item.point),timestampMs:finite(item.timestampMs,0,Number.MAX_SAFE_INTEGER,'saved timestamp'),errorMeters:optional(item.errorMeters,0,1000000000,'saved error bound'),source:typeof item.source==='string'?item.source.slice(0,64):'unknown',kind:['motion','encoder','steps','position'].includes(item.kind)?item.kind:undefined,sequence:Number.isSafeInteger(item.sequence)?item.sequence:undefined,distanceMeters:optional(item.distanceMeters,-1000,1000,'saved distance'),headingDegrees:optional(item.headingDegrees,0,360,'saved heading'),headingReference:item.headingReference==='map-north'?'map-north':undefined,deltaTicks:Number.isSafeInteger(item.deltaTicks)?item.deltaTicks:undefined,deltaSteps:Number.isSafeInteger(item.deltaSteps)?item.deltaSteps:undefined}));
 if(drDistance(state.anchor,state.trail[0].point)>0.001)throw Error('Saved start does not match the track');
 state.distanceMeters=finite(value.distanceMeters,0,100000000,'saved travel total');state.lastTimestamp=state.trail.length>1?state.trail.at(-1).timestampMs:null;return pauseDR(state);
}

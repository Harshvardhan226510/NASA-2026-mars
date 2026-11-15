import {marsDistance} from './measurement-geometry.js';
export function routeProfile(route,metadata={}){
 const input=route?.terrain_profile?.samples??route?.waypoints??[];
 let distance=0,ascent=0,descent=0,known=0,maxSlope=0;
 const samples=input.map((p,i)=>{
  if(i)distance+=marsDistance([input[i-1].lon,input[i-1].lat],[p.lon,p.lat]);
  const height=Number.isFinite(p.elevation_m)?p.elevation_m:null,previous=i?input[i-1]:null;
  const run=previous?marsDistance([previous.lon,previous.lat],[p.lon,p.lat]):0;
  const rise=previous&&height!==null&&Number.isFinite(previous.elevation_m)?height-previous.elevation_m:null;
  const slope=rise!==null&&run>.01?Math.atan2(rise,run)*180/Math.PI:null;
  if(height!==null)known++;if(rise!==null){ascent+=Math.max(0,rise);descent+=Math.max(0,-rise);}if(slope!==null)maxSlope=Math.max(maxSlope,Math.abs(slope));
  return {lon:p.lon,lat:p.lat,distance_m:distance,elevation_m:height,slope_deg:slope,...(Number.isFinite(p.travel_energy_kj)?{travel_energy_kj:p.travel_energy_kj}:{})};
 });
 const heights=samples.filter(s=>s.elevation_m!==null).map(s=>s.elevation_m),source=metadata.source??{},threshold=(metadata.max_slope_deg??22)*.75;
 return {samples,distance_m:distance,ascent_m:ascent,descent_m:descent,max_slope_deg:maxSlope,min:heights.length?Math.min(...heights):null,max:heights.length?Math.max(...heights):null,known_fraction:samples.length?known/samples.length:0,source_sample_m:source.sample_m??metadata.grid_spacing_m??null,profile_sample_m:samples.reduce((m,p,i)=>Math.max(m,i?p.distance_m-samples[i-1].distance_m:0),0),difficult:samples.filter(p=>p.slope_deg!==null&&Math.abs(p.slope_deg)>=threshold),legacy:!route?.terrain_profile};
}

export function profileChartPath(samples,key,width=280,height=100){
 const valid=samples.filter(p=>Number.isFinite(p[key]));if(!valid.length)return {path:'',min:null,max:null};
 const min=Math.min(...valid.map(p=>p[key])),max=Math.max(...valid.map(p=>p[key])),span=Math.max(1,max-min),length=samples.at(-1)?.distance_m||1;
 let pen=false;const path=samples.map(p=>{if(!Number.isFinite(p[key])){pen=false;return '';}const command=pen?'L':'M';pen=true;return `${command}${(p.distance_m/length*width).toFixed(2)},${(height-(p[key]-min)/span*height).toFixed(2)}`;}).join(' ');
 return {path,min,max};
}

export function calculateTraverseRiskIndex(route,metadata={}){
 const profile=routeProfile(route,metadata);
 const s=route?.summary||{};
 const maxSlope=profile.max_slope_deg||route?.validation?.max_sampled_slope_deg||s.max_slope_deg||0;
 const difficultCount=profile.difficult?.length||0;
 const totalSamples=profile.samples?.length||1;
 const difficultFraction=difficultCount/totalSamples;

 // 1. Peak Slope Hazard (0 - 40 pts) - NASA HLS2: Nominal walking <= 15°, impassable barrier > 22°
 const slopeHazard=Math.min(40,(maxSlope/22)*32+(difficultFraction*8));

 // 2. Minetti Metabolic Energy & Fatigue (0 - 30 pts) - NASA Minetti model kJ & distance
 const distKm=s.total_distance_km||(profile.distance_m/1000)||0;
 const energyKj=s.minetti_energy_kj||(distKm*250);
 const metabolicStrain=Math.min(30,(distKm/12)*15+(energyKj/6000)*15);

 // 3. Elevation Provenance & Data Confidence (0 - 20 pts) - DEM coverage percentage
 const knownFraction=profile.known_fraction||1.0;
 const confidencePenalty=Math.max(0,Math.min(20,(1-knownFraction)*20));

 // 4. Corridor Waypoints & Turn Complexity (0 - 10 pts)
 const waypoints=route?.waypoints||[];
 const complexity=Math.min(10,Math.max(1,waypoints.length*0.25));

 const totalRisk=Math.min(100,Math.max(0,Math.round(slopeHazard+metabolicStrain+confidencePenalty+complexity)));
 const safetyPercentage=Math.max(0,Math.min(100,100-totalRisk));

 let rating='NOMINAL';
 let color='#4ade80'; // Green
 if(totalRisk>=60){
  rating='CRITICAL HAZARD';
  color='#f87171'; // Red
 }else if(totalRisk>=30){
  rating='CAUTION';
  color='#fbbf24'; // Amber
 }

 return {
  risk_index:totalRisk,
  safety_percentage:safetyPercentage,
  rating,
  color,
  components:{
   slope_hazard:Math.round(slopeHazard),
   metabolic_strain:Math.round(metabolicStrain),
   confidence_penalty:Math.round(confidencePenalty),
   complexity:Math.round(complexity)
  }
 };
}

export function walkingTimeText(distanceKm,speedKmh){
 if(!Number.isFinite(distanceKm)||distanceKm<0||!Number.isFinite(speedKmh)||speedKmh<=0)return '—';
 const minutes=distanceKm/speedKmh*60;
 if(minutes>0&&minutes<1)return '<1 min';
 const rounded=Math.round(minutes),hours=Math.floor(rounded/60),remainder=rounded%60;
 if(!hours)return `${remainder} min`;
 return remainder?`${hours} h ${remainder} min`:`${hours} h`;
}

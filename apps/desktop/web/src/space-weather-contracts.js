// Adapted from the supplied 2026-10-18 research contracts. No dose conversion.
import {CONTEXT_FEEDS} from './space-weather-context.js';
export const FEEDS={
 ...CONTEXT_FEEDS,
 rad:{name:'Curiosity RAD',ttl:3600,domain:'Mars surface · local to Curiosity',kind:'measured_quicklook',gap:3600},
 mex:{name:'Mars Express ASPERA-3/IMA',ttl:3600,domain:'Mars orbit · spacecraft indicator',kind:'measured_indicator',gap:600},
 ipath:{name:'ZEUS+iPATH at Mars',ttl:900,domain:'Mars heliospheric observer · outside the surface',kind:'forecast',gap:7200},
 donki:{name:'DONKI WSA-ENLIL',ttl:900,domain:'Predicted arrival at Mars',kind:'forecast',gap:0},
 'goes-protons':{name:'NOAA GOES protons',ttl:300,domain:'Earth orbit · solar context only',kind:'earth_context',gap:600},
 'goes-xrays':{name:'NOAA GOES X-rays',ttl:300,domain:'Earth orbit · solar context only',kind:'earth_context',gap:600}
};
export function time(value){
 if(typeof value!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('Invalid UTC timestamp');
 return new Date(value).toISOString();
}
const numeric=value=>value===null||value===undefined||value===''?null:(typeof value==='number'||typeof value==='string')&&Number.isFinite(Number(value))?Number(value):null;
const after=(date,now)=>Date.parse(date)>Date.parse(now)+300000;
const base=(feed,retrieved)=>({schema:'mars-space-weather/1',feed,source_id:feed,...FEEDS[feed],retrieved_at:time(retrieved),published_at:null,usable_for_human_route_dose:false});
export function normalizeHapi(payload,feed,retrieved){
 if(!['rad','mex'].includes(feed))throw Error('Unregistered HAPI dataset');
 const code=payload.status?.code;if(![1200,1201].includes(code))throw Error('HAPI source rejected the request');
 const expected=feed==='rad'?['dose_b_raw','dose_b_rtg','dose_e_total']:['BackgroundCounts','TotalCount'];
 const parameters=payload.parameters??[],names=parameters.map(p=>p.name);
 if(parameters[0]?.type!=='isotime'||new Set(names).size!==names.length||!expected.every(n=>names.includes(n)))throw Error('HAPI parameter schema changed');
 const unit=feed==='rad'?'uGy/day':'counts';
 for(const name of expected)if(parameters[names.indexOf(name)].units!==unit)throw Error('Unexpected HAPI measurement unit');
 let previous=-Infinity;
 const samples=(payload.data??[]).map(row=>{
  if(row.length!==parameters.length)throw Error('HAPI row length changed');
  const observed=time(row[0]),millis=Date.parse(observed);
  if(millis<previous||after(observed,retrieved))throw Error('Out-of-order or future observation');previous=millis;
  const values={},flags={};
  for(const name of expected){const i=names.indexOf(name),p=parameters[i],raw=row[i];let value=raw===null||String(raw)===String(p.fill)?null:numeric(raw);if(value!==null&&value<0){value=null;flags[name]='negative response';}values[name]=value;}
  return {time:observed,values,...(Object.keys(flags).length?{flags}:{})};
 });
 return {...base(feed,retrieved),dataset:feed==='rad'?'msl_rad_dosimetry':'mars_express_aspera3_ima_ep',version:'provider quicklook; calibration version not supplied',channels:expected.map(id=>({id,unit,label:({dose_b_raw:'B · silicon · raw',dose_b_rtg:'B · silicon · RTG-corrected',dose_e_total:'E · tissue-equivalent plastic',BackgroundCounts:'Combined penetrating-particle background',TotalCount:'Total instrument counts'})[id],material:id.startsWith('dose_b')?'silicon':id==='dose_e_total'?'tissue-equivalent plastic':null,species:feed==='mex'?'combined protons >20 MeV and electrons >1 MeV':null,quality:'Provider quality flags not supplied in this feed',uncertainty:null})),samples,default_channel:feed==='rad'?'dose_b_rtg':'BackgroundCounts',spatial_support:feed==='rad'?'Local rover detector. Gale marker is a reference location, not observation ephemeris.':'Spacecraft detector; no orbit coordinates are supplied by this feed.',latest_observed_at:lastValidTime(samples)};
}
export function lastValidTime(samples){return [...samples].reverse().find(s=>Object.values(s.values).some(v=>v!==null&&Number.isFinite(v)))?.time??null;}
export function normalizeIpath(payload,retrieved){
 const root=payload.sep_forecast_submission;if(!root||!String(root.model?.short_name).includes('iPATH')||!String(root.model?.spase_id).includes('/iPATH/'))throw Error('Unrecognized forecast model');
 const issue=time(root.issue_time);if(after(issue,retrieved))throw Error('Future forecast issue time');
 const channels=[];
 for(const forecast of root.forecasts??[]){
  if(forecast.location?.toLowerCase()!=='mars'||forecast.species?.toLowerCase()!=='proton')continue;
  const energy=forecast.energy_channel,window=forecast.prediction_window,peak=forecast.peak_intensity_max;
  if(energy?.units!=='MeV'||!(numeric(energy.min)>0)||!(energy.max===-1||numeric(energy.max)>energy.min)||peak?.units!=='pfu')throw Error('Unrecognized Mars proton channel');
  const start=time(window?.start_time),end=time(window?.end_time),value=numeric(peak.intensity);
  if(end<=start||value===null||value<0)throw Error('Invalid forecast range or intensity');
  const peakTime=peak.time?time(peak.time):null;if(peakTime&&(peakTime<start||peakTime>end))throw Error('Peak outside forecast window');
  channels.push({energy:{min:energy.min,max:energy.max,unit:'MeV'},species:'proton',start,end,peak:value,peak_time:peakTime,unit:'pfu',threshold_result:forecast.all_clear??null,human_eva_clearance:false});
 }
 if(!channels.length)throw Error('No Mars proton predictions');
 return {id:root.model.short_name+'@'+issue,issue_time:issue,model:root.model,channels,triggers:root.triggers??[],mode:root.mode??null,human_eva_clearance:false};
}
export function normalizeSpectrum(text,run){
 const lines=text.trim().split(/\r?\n/);
 if(!lines[0]?.includes('protons/(cm^2 s sr MeV)')||!lines[1]?.startsWith('#,'))throw Error('Unrecognized differential-spectrum units');
 const energies=lines[1].slice(2).split(',').map(s=>numeric(s.trim()));
 if(!energies.length||energies.length>100||energies.some((v,i)=>v===null||v<=0||(i&&v<=energies[i-1])))throw Error('Invalid energy grid');
 let previous='';const start=run.channels.reduce((a,c)=>a<c.start?a:c.start,run.channels[0].start),end=run.channels.reduce((a,c)=>a>c.end?a:c.end,run.channels[0].end);
 const samples=lines.slice(2).filter(l=>l.trim()&&!l.startsWith('#')).map(line=>{
  const [date,...raw]=line.split(',');const observed=time(date.trim().replace(' ','T')+'Z');
  if(raw.length!==energies.length||observed<previous||observed<start||observed>end)throw Error('Spectrum grid/window changed');previous=observed;
  const values=raw.map(x=>numeric(x.trim()));if(values.some(x=>x===null||x<0))throw Error('Invalid spectrum intensity');
  return {time:observed,values};
 });
 return {run_id:run.id,energies,energy_unit:'MeV',unit:'protons/(cm² s sr MeV)',species:'proton',samples};
}
export function normalizeDonki(payload,retrieved){
 if(!Array.isArray(payload))throw Error('DONKI schema changed');const events=[];
 for(const simulation of payload){
  const completed=time(simulation.modelCompletionTime);if(after(completed,retrieved))throw Error('Future simulation completion');
  for(const impact of simulation.impactList??[]){if(impact.location?.toLowerCase()!=='mars')continue;
   events.push({id:simulation.simulationID+'@'+completed,simulation_id:simulation.simulationID,model_completion_time:completed,predicted_arrival:time(impact.arrivalTime),glancing:impact.isGlancingBlow??null,minor:impact.isMinorImpact??null,cme_ids:(simulation.cmeInputs??[]).map(c=>c.CMEID).filter(Boolean),link:safeScienceLink(simulation.link),quantity:'CME or shock arrival',is_sep_onset:false});
  }
 }
 return {...base('donki',retrieved),dataset:'WSAEnlilSimulations',events:[...new Map(events.map(e=>[e.id+'@'+e.predicted_arrival,e])).values()].sort((a,b)=>b.model_completion_time.localeCompare(a.model_completion_time)),simulation_count:payload.length,latest_model_completion:payload.map(s=>time(s.modelCompletionTime)).sort().at(-1)??null,spatial_support:'Mars-target arrival forecast; no surface impact footprint or particle dose.',samples:[],channels:[]};
}
export function safeScienceLink(value){try{const u=new URL(value);return u.protocol==='https:'&&['ccmc.gsfc.nasa.gov','iswa.ccmc.gsfc.nasa.gov'].includes(u.hostname)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function normalizeGoes(payload,feed,retrieved){
 if(!Array.isArray(payload)||!['goes-protons','goes-xrays'].includes(feed))throw Error('GOES schema changed');
 const rows=new Map(),channels=new Map();
 for(const row of payload){
  const observed=time(row.time_tag);if(after(observed,retrieved))throw Error('Future GOES observation');
  if(typeof row.energy!=='string'||!Number.isInteger(row.satellite))throw Error('GOES energy/satellite schema changed');
  const id=row.energy,unit=feed==='goes-protons'?'pfu':'W/m²';
  channels.set(id,{id,label:id,unit,material:null,species:feed==='goes-protons'?'proton':'photon',quality:'Quicklook; source flags retained',uncertainty:null});
  const key=observed+'@'+row.satellite,sample=rows.get(key)??{time:observed,satellite:row.satellite,values:{},flags:{}};
  let value=numeric(row.flux);if(value!==null&&value<0)value=null;
  const flags={};for(const k of ['electron_correction','electron_contaminaton','observed_flux'])if(k in row)flags[k]=row[k];
  if(row.electron_contaminaton===true)value=null;
  sample.values[id]=value;if(Object.keys(flags).length)sample.flags[id]=flags;rows.set(key,sample);
 }
 const samples=[...rows.values()].sort((a,b)=>a.time.localeCompare(b.time));
 return {...base(feed,retrieved),dataset:'GOES primary '+(feed==='goes-protons'?'integral protons':'X-ray flux'),channels:[...channels.values()].sort((a,b)=>a.id.localeCompare(b.id)),samples,default_channel:feed==='goes-protons'?'>=10 MeV':'0.1-0.8nm',spatial_support:'Earth-orbit spacecraft. No measurement coverage at Mars.',latest_observed_at:lastValidTime(samples)};
}
export function observationState(observed,now=Date.now(),earth=false){
 if(!observed)return {label:'No valid observations',age_hours:null};const age=Math.max(0,(Number(now)-Date.parse(observed))/3600000);
 return {label:earth?(age<=.5?'Recent Earth observation':age<=24?'Delayed Earth observation':'Old Earth observation'):(age<=24?'Delayed observation':age<=72?'Stale observation':'Old observation'),age_hours:age};
}
export function forecastState(channel,now=Date.now()){
 if(now>=Date.parse(channel.end))return 'Expired';if(now<Date.parse(channel.start))return 'Upcoming';return 'Within prediction window';
}

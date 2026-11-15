export const CONTEXT_FEEDS={
 'solar-wind':{name:'NOAA real-time solar wind',ttl:300,domain:'Sun–Earth L1 · Earth context only',kind:'earth_context',gap:300},
 'solar-imf':{name:'NOAA real-time interplanetary magnetic field',ttl:300,domain:'Sun–Earth L1 · Earth context only',kind:'earth_context',gap:300},
 'solar-flares':{name:'NOAA GOES flare catalogue',ttl:300,domain:'Earth-view Sun · not Mars surface conditions',kind:'earth_context',gap:600},
 'solar-status':{name:'NOAA space-weather scales',ttl:300,domain:'Earth impacts · not Mars warning levels',kind:'earth_context',gap:0},
 'solar-euv':{name:'NOAA GOES EUVS',ttl:300,domain:'Earth orbit · not Mars UV exposure',kind:'earth_context',gap:300},
 'solar-f107':{name:'NOAA F10.7 solar radio flux',ttl:3600,domain:'Earth-view Sun · solar-activity proxy',kind:'earth_context',gap:129600}
};
export const CONTEXT_URLS={
 'solar-wind':'https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json',
 'solar-imf':'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json',
 'solar-flares':'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json',
 'solar-status':'https://services.swpc.noaa.gov/products/noaa-scales.json',
 'solar-euv':'https://services.swpc.noaa.gov/json/goes/primary/euvs-6-hour.json',
 'solar-f107':'https://services.swpc.noaa.gov/json/f107_cm_flux.json'
};
const n=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const stamp=v=>{if(typeof v!=='string')throw Error('Missing context timestamp');const x=/(Z|[+-]\d\d:\d\d)$/.test(v)?v:v+'Z';if(!Number.isFinite(Date.parse(x)))throw Error('Invalid context timestamp');return new Date(x).toISOString();};
export function normalizeContext(payload,feed,retrieved){
 if(!Object.hasOwn(CONTEXT_FEEDS,feed))throw Error('Unsupported context feed');
 const result={schema:'mars-space-weather/1',feed,...CONTEXT_FEEDS[feed],retrieved_at:stamp(retrieved),published_at:null,usable_for_human_route_dose:false,spatial_support:'Earth-view observations; no spatial measurement coverage at Mars.',samples:[],channels:[],events:[]};
 const channel=(id,label,unit)=>({id,label,unit,material:null,species:null,quality:'Provider quicklook; source and quality fields retained; no uncertainty supplied',uncertainty:null});
 const add=(at,values,extra={})=>{const time=stamp(at);if(Date.parse(time)>Date.parse(retrieved)+300000)throw Error('Future context observation');result.samples.push({time,values,...extra});};
 if(feed==='solar-status'){
  const current=payload?.['0'];if(!current?.S||!current?.R||!current?.G)throw Error('NOAA scales schema changed');
  result.channels=[channel('S','Solar radiation storm scale · Earth','S0–S5'),channel('R','Radio blackout scale · Earth','R0–R5'),channel('G','Geomagnetic storm scale · Earth','G0–G5')];
  const values={};for(const c of result.channels){const value=n(current[c.id].Scale);values[c.id]=value!==null&&Number.isInteger(value)&&value>=0&&value<=5?value:null;}
  add(current.DateStamp+'T'+current.TimeStamp,values,{source_record:current});result.default_channel='S';
 }else{
  if(!Array.isArray(payload))throw Error('NOAA context schema changed');
  if(feed==='solar-wind'||feed==='solar-imf'){
   const fields=feed==='solar-wind'?[['proton_speed','Solar-wind proton speed','km/s'],['proton_density','Solar-wind proton density','cm⁻³'],['proton_temperature','Solar-wind proton temperature','K']]:[['bt','IMF magnitude','nT'],['bx_gsm','Bx · GSM','nT'],['by_gsm','By · GSM','nT'],['bz_gsm','Bz · GSM','nT']];result.channels=fields.map(x=>channel(...x));result.default_channel=fields[0][0];
   for(const row of payload){if(row.active!==true)continue;const valid=row.overall_quality===0,values={};for(const [id] of fields){const value=n(row[id]);values[id]=valid&&value!==null&&Math.abs(value)<1e8&&(id.includes('_gsm')||value>=0)?value:null;}
    add(row.time_tag,values,{source:row.source,overall_quality:row.overall_quality,flags:Object.fromEntries(Object.entries(row).filter(([key])=>key.endsWith('_flag')))});}
  }else if(feed==='solar-flares'){
   result.channels=[channel('peak','GOES 0.1–0.8 nm flare peak','W/m²')];result.default_channel='peak';
   for(const row of payload){const peak=n(row.max_xrlong);if(!row.begin_time||!row.max_time||peak===null||peak<0)continue;add(row.max_time,{peak},{satellite:row.satellite});result.events.push({begin:stamp(row.begin_time),peak_time:stamp(row.max_time),end:row.end_time?stamp(row.end_time):null,classification:String(row.max_class??'Unknown'),peak,satellite:row.satellite});}
  }else if(feed==='solar-f107'){
   result.channels=[channel('flux','F10.7 · solar radio activity proxy','sfu'),channel('mean','90-day F10.7 mean','sfu')];result.default_channel='flux';
   for(const row of payload){if(row.frequency!==2800)continue;const flux=n(row.flux),mean=n(row.ninety_day_mean);add(row.time_tag,{flux:flux!==null&&flux>=0?flux:null,mean:mean!==null&&mean>=0?mean:null},{reporting_schedule:row.reporting_schedule});}
  }else if(feed==='solar-euv'){
   const channels=new Map(),samples=new Map();for(const row of payload){if(typeof row.line!=='string')throw Error('EUV line schema changed');if(!['256','284','304'].includes(row.line))continue;const id=row.line;channels.set(id,channel(id,`${Number(id)/10} nm solar line irradiance`,'W/m²'));const at=stamp(row.time_tag),key=at+'@'+row.satellite,sample=samples.get(key)??{time:at,values:{},flags:{},satellite:row.satellite},v=n(row.value),valid=row.flags&&['eclipse','lunar_transit','geocorona'].every(k=>row.flags[k]===false);sample.values[id]=v!==null&&v>=0&&valid?v:null;sample.flags[id]={...row.flags,au_factor:row.au_factor};samples.set(key,sample);}
   result.channels=[...channels.values()];for(const row of samples.values())add(row.time,row.values,{flags:row.flags,satellite:row.satellite});result.default_channel=result.channels[0]?.id;
  }
 }
 result.samples.sort((a,b)=>a.time.localeCompare(b.time));result.latest_observed_at=[...result.samples].reverse().find(s=>Object.values(s.values).some(Number.isFinite))?.time??null;result.dataset=CONTEXT_FEEDS[feed].name;
 return result;
}

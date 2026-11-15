import {SPACECRAFT_MISSIONS,SPACECRAFT_MISSION_IDS,SPACECRAFT_TRAVEL,MISSION_CRUISES} from './spacecraft-history-data.js';
import {SPACECRAFT_FEEDS,normalizeSpacecraftPosition} from './spacecraft-data.js';

export const missionFor=id=>SPACECRAFT_MISSIONS[SPACECRAFT_MISSION_IDS[id]];
export const launchDate=iso=>new Date(iso+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
export function travelDistance(km){return km>=1000000?`${(km/1000000).toLocaleString('en',{maximumFractionDigits:1})} million km`:km<1?`${(km*1000).toLocaleString('en',{maximumFractionDigits:0})} m`:`${km.toLocaleString('en',{maximumFractionDigits:km<10?3:2})} km`;}
export function normalizeOdometer(id,data,checked=new Date().toISOString()){
 if(!['curiosity','perseverance'].includes(id))throw Error('No supported rover odometer');
 const position=normalizeSpacecraftPosition(id,data,{retrievedAt:checked}),metres=data.features[0].properties.dist_total_m;
 if(!Number.isFinite(metres)||metres<0||metres>10000000)throw Error('Invalid cumulative rover distance');
 return {kind:'surface',km:metres/1000,sol:position.sol,source:SPACECRAFT_FEEDS[id],qualifier:`Published odometer · Sol ${position.sol}`,checked:checked.slice(0,10)};
}
export function travelFor(item,overrides){
 const distance=overrides?.get?.(item.id)??SPACECRAFT_TRAVEL[item.id];
 if(distance)return distance;
 const cruise=MISSION_CRUISES[SPACECRAFT_MISSION_IDS[item.id]];
 if(cruise&&(item.kind==='orbiter'||['beagle2','schiaparelli','tianwen1_lander'].includes(item.id)))return cruise;
 return null;
}
export function mergeOdometers(previous,records){
 const next=new Map(previous??Object.entries(SPACECRAFT_TRAVEL));
 for(const [id,record] of records){
  const retained=next.get(id)??SPACECRAFT_TRAVEL[id];
  if(['curiosity','perseverance'].includes(id)&&Number.isInteger(record.sol)&&Number.isFinite(record.km)&&record.km>=0&&(!retained||record.sol>=retained.sol))next.set(id,record);
 }
 return next;
}
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function appendSpacecraftHistory(root,item,overrides){
 const mission=missionFor(item.id);if(!mission)return;
 const section=el('section',undefined,'spacecraft-history');section.setAttribute('aria-label','Mission history');
 section.append(el('h4','Mission history'),el('p',mission.summary));
 const dl=el('dl'),detail=(key,value,note)=>{const dd=el('dd',value);if(note)dd.append(el('small',note));dl.append(el('dt',key),dd);};
 detail('Mission',mission.name);detail('Led by',mission.lead);detail('Launched · UTC',launchDate(mission.launch));
 if(item.id==='hope')detail('Launch service','Mitsubishi Heavy Industries · H-IIA · Japan');
 const travel=travelFor(item,overrides);
 if(travel)detail({surface:'Surface travel',flight:'Flight distance',cruise:'Earth → Mars cruise'}[travel.kind],(travel.kind==='cruise'||item.id==='ingenuity'?'≈ ':'')+travelDistance(travel.km),travel.qualifier+(travel.checked?' · checked '+launchDate(travel.checked):''));
 else detail(item.kind==='orbiter'?'Distance travelled':'Surface travel',item.kind==='orbiter'?'No verified cumulative travel total published.':['lander','landing_platform'].includes(item.kind)?'Fixed landing hardware; no rover traverse.':'No separate surface-travel total verified.');
 if(item.kind==='orbiter'&&travel)detail('Orbital travel','Cumulative orbital distance is not included in the cruise figure.');
 if(item.id==='ingenuity')detail('Launch carried by','Mars 2020 spacecraft, with Perseverance');
 if(['spirit_platform','opportunity_platform'].includes(item.id))detail('Hardware','Landing platform; the rover’s driving total belongs to its separate entry.');
 section.append(dl);
 const sources=el('details'),summary=el('summary','Mission and distance sources');sources.append(summary);
 for(const [i,url] of [...new Set([mission.source,travel?.source].filter(Boolean))].entries()){const a=el('a',i?'Distance record ↗':'Mission source ↗');a.href=url;a.target='_blank';a.rel='noopener';sources.append(a,el('br'));}
 if(travel?.sol)sources.append(el('p','Travel total uses NASA’s published cumulative-distance record for the stated sol. It is not continuous live telemetry.'));
 if(item.id==='opportunity'||item.id==='opportunity_platform')sources.append(el('p','Launch was 7 July 2003 in US local time, which was 8 July in UTC.'));
 if(item.id==='hope')sources.append(el('p','Launch was 20 July 2020 in Japan, which was 19 July in UTC.'));
 sources.append(el('p','Launch dates are in UTC. Cruise lengths, flights and surface driving are different measures and are not added together.'));
 section.append(sources);root.append(section);
}

export async function fetchOdometers(fetcher=fetch,checked=new Date().toISOString()){
 const results=await Promise.allSettled(['curiosity','perseverance'].map(async id=>{
  const r=await fetcher(SPACECRAFT_FEEDS[id],{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('NASA odometer unavailable');
  const text=await r.text();if(text.length>65536)throw Error('Odometer record too large');
  return [id,normalizeOdometer(id,JSON.parse(text),checked)];
 }));return results.filter(r=>r.status==='fulfilled').map(r=>r.value);
}

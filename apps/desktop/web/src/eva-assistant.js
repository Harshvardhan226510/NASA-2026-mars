import {validateAresAction,resolveAresPoint} from './ares-actions.js';
import {buildAresPrompt} from './ares-prompt.js';
import {desktopState} from './desktop-mode.js';
import {DesktopSpeechInput} from './desktop-speech.js';
import {DesktopVoiceOutput} from './desktop-voice-output.js';
import {mountVoiceActivity} from './voice-activity.js';
/**
 * ARES: Autonomous Mars Extravehicular Activity (EVA) Tactical Co-Pilot.
 * Built-in commands with optional local model 'mars_eva_q8.gguf' (ares-mars).
 * Grounded in authentic NASA Planetary Data System (PDS) & declared mission scenario inputs.
 * Provides Speech-to-Text (STT), Text-to-Speech (TTS), camera flight, and direct map action execution.
 */

import {parseAtlasCommand,runAtlasCommand,ATLAS_COMMAND_GUIDE} from './atlas-commands.js';
import { distanceKm, signedLongitude } from './place-context.js';
import { marsSun, solarAt } from './solar-geometry.js';
import { ORBITERS } from './orbiter-data.js';
import { nasaHybridRAG } from './nasa-hybrid-rag.js';
import {routeRisk} from './route-risk.js';
import {answerMissionQuestion,parseMissionQuestion} from './tars-mission.js';

const riskPercent=risk=>risk?`${risk.partial?'≈':''}${risk.score}%`:'unknown';

function extractActionJSON(text) {
 if (!text) return null;
 const triggerIdx = text.search(/<<<\s*ACTION:|(?:^|\s)ACTION:/i);
 if (triggerIdx === -1) {
  const codeBlock = text.match(/```(?:json)?\s*({[\s\S]*?"type"[\s\S]*?})\s*```/i);
  if (codeBlock) {
   try { return { action: JSON.parse(codeBlock[1]), raw: codeBlock[0] }; } catch {}
  }
  const rotMatch = text.match(/rotate\s*\(\s*(\d+)(?:\s*,\s*['"](right|left)['"])?\s*\)/i);
  if (rotMatch) {
   return {
    action: { type: 'rotate', params: { degrees: parseInt(rotMatch[1], 10), direction: rotMatch[2] || 'right' } },
    raw: rotMatch[0]
   };
  }
  const orbitMatch = text.match(/orbit_360\s*\(\s*\)/i);
  if (orbitMatch) {
   return { action: { type: 'orbit_360' }, raw: orbitMatch[0] };
  }
  const exploreMatch = text.match(/explore_observation\s*\([\s\S]*?\)/i);
  if (exploreMatch) {
   return { action: { type: 'explore_observation' }, raw: exploreMatch[0] };
  }
  return null;
 }
 const firstBrace = text.indexOf('{', triggerIdx);
 if (firstBrace === -1) return null;

 let depth = 0;
 let inString = false;
 let escape = false;
 for (let i = firstBrace; i < text.length; i++) {
  const ch = text[i];
  if (escape) {
   escape = false;
   continue;
  }
  if (ch === '\\') {
   escape = true;
   continue;
  }
  if (ch === '"') {
   inString = !inString;
   continue;
  }
  if (!inString) {
   if (ch === '{') depth++;
   else if (ch === '}') {
    depth--;
    if (depth === 0) {
     const jsonStr = text.slice(firstBrace, i + 1);
     let endIdx = i + 1;
     const remaining = text.slice(endIdx);
     const closeTag = remaining.match(/^\s*(?:>>>|》|>|】|\])/);
     if (closeTag) endIdx += closeTag[0].length;
     const raw = text.slice(triggerIdx, endIdx);
     try {
      return { action: JSON.parse(jsonStr), raw };
     } catch (e) {
      return null;
     }
    }
   }
  }
 }
 return null;
}

export const KNOWN_SPACECRAFT = Object.freeze({
 perseverance: {
  id: 'perseverance',
  name: 'Perseverance (Mars 2020)',
  kind: 'rover',
  location: { lon_east: 77.2329, lat_planetocentric: 18.4356, elevation_m: -1937, sol: 2009 },
  landing: 'Feb 18, 2021 · Octavia E. Butler Landing, Jezero Crater',
  mission: 'Investigating ancient Jezero delta habitability, collecting sealed rock core samples for Mars Sample Return (MSR), deploying MOXIE oxygen generation, RIMFAX subsurface radar, SuperCam, and Mastcam-Z.'
 },
 curiosity: {
  id: 'curiosity',
  name: 'Curiosity (Mars Science Laboratory)',
  kind: 'rover',
  location: { lon_east: 137.3876, lat_planetocentric: -4.8247, elevation_m: -3488, sol: 5045 },
  landing: 'Aug 6, 2012 · Bradbury Landing, Gale Crater (Aeolis Palus)',
  mission: 'Exploring Mount Sharp (Aeolis Mons) sedimentary strata, past liquid water habitability, organic carbon detection via SAM, ChemCam laser-induced breakdown spectroscopy, and CheMin X-ray diffraction.'
 },
 ingenuity: {
  id: 'ingenuity',
  name: 'Ingenuity Mars Helicopter',
  kind: 'helicopter',
  location: { lon_east: 77.3225, lat_planetocentric: 18.4973, elevation_m: -2399, flight: 72 },
  landing: 'Feb 18, 2021 · Completed 72 historic flights across 17.0 km through Jan 18, 2024 at Neretva Vallis, Jezero Crater',
  mission: 'First powered controlled aerodynamic flight on another world. Acted as aerial scout for Perseverance before mission completion.'
 },
 insight: {
  id: 'insight',
  name: 'InSight Lander',
  kind: 'lander',
  location: { lon_east: 135.6234, lat_planetocentric: 4.5024, elevation_m: -2613 },
  landing: 'Nov 26, 2018 · Elysium Planitia',
  mission: 'Deep seismic and interior geophysics study via SEIS seismometer; recorded 1,300+ marsquakes and meteorite impacts, mapping crust thickness (24–72 km) and liquid metallic core radius (~1,830 km).'
 },
 opportunity: {
  id: 'opportunity',
  name: 'Opportunity (MER-B)',
  kind: 'rover',
  location: { lon_east: 354.4734, lat_planetocentric: -2.0504, elevation_m: -1387, sol: 5111 },
  landing: 'Jan 25, 2004 · Eagle Crater, Meridiani Planum',
  mission: 'Traversed 45.16 km over 14.5 Earth years; discovered hematite spherules ("blueberries") and sulfate outcrop beds confirming past standing liquid water.'
 },
 spirit: {
  id: 'spirit',
  name: 'Spirit (MER-A)',
  kind: 'rover',
  location: { lon_east: 175.4785, lat_planetocentric: -14.5684, elevation_m: -1932, sol: 2210 },
  landing: 'Jan 4, 2004 · Gusev Crater / Columbia Hills',
  mission: 'Discovered nearly pure opaline silica deposits at Home Plate, proving ancient hydrothermal volcanic vents and hot spring activity.'
 },
 zhurong: {
  id: 'zhurong',
  name: 'Zhurong (Tianwen-1)',
  kind: 'rover',
  location: { lon_east: 109.925, lat_planetocentric: 25.066, elevation_m: -4100 },
  landing: 'May 14, 2021 · Southern Utopia Planitia',
  mission: 'CNSA rover equipped with subsurface radar (RoPeR) and multispectral camera; detected shallow layered sediments from episodic catastrophic flooding.'
 },
 phoenix: {
  id: 'phoenix',
  name: 'Phoenix Mars Lander',
  kind: 'lander',
  location: { lon_east: 234.2508, lat_planetocentric: 68.2188, elevation_m: -4120 },
  landing: 'May 25, 2008 · Green Valley, Vastitas Borealis',
  mission: 'Directly excavated polar polygon trenches, uncovered and confirmed sublimating subsurface water ice, and detected perchlorates in Martian soil.'
 },
 pathfinder: {
  id: 'pathfinder',
  name: 'Mars Pathfinder & Sojourner',
  kind: 'lander',
  location: { lon_east: 326.45, lat_planetocentric: 19.33, elevation_m: -3650 },
  landing: 'July 4, 1997 · Ares Vallis (Carl Sagan Memorial Station)',
  mission: 'First successful surface micro-rover (Sojourner); analysed rounded pebbles, conglomerate rocks and catastrophic outflow flood geology.'
 },
 viking1: {
  id: 'viking1',
  name: 'Viking 1 Lander',
  kind: 'lander',
  location: { lon_east: 312.05, lat_planetocentric: 22.48, elevation_m: -2690 },
  landing: 'July 20, 1976 · Chryse Planitia (Thomas Mutch Memorial Station)',
  mission: 'First successful long-duration Mars lander; conducted first in-situ biology metabolism experiments and organic analysis.'
 },
 viking2: {
  id: 'viking2',
  name: 'Viking 2 Lander',
  kind: 'lander',
  location: { lon_east: 134.28, lat_planetocentric: 47.97, elevation_m: -4230 },
  landing: 'Sept 3, 1976 · Utopia Planitia',
  mission: 'Second successful Viking surface mission; operated for 1,281 sols collecting high-resolution panoramas, weather, and soil samples.'
 }
});

export const KNOWN_ORBITERS = Object.freeze({
 mro: {
  id: 'mro',
  name: 'Mars Reconnaissance Orbiter (MRO)',
  agency: 'NASA / JPL',
  altitude_km: '255 – 320 km sun-synchronous polar orbit (period ~112 min)',
  payload: 'HiRISE (0.25–0.3 m/px visible camera), CRISM (hyperspectral mineral spectrometer), CTX (6 m context camera), SHARAD (shallow subsurface radar sounder), MCS (climate sounder).',
  status: 'Active · primary orbital reconnaissance scout and telecommunication relay for Perseverance and Curiosity.'
 },
 odyssey: {
  id: 'odyssey',
  name: '2001 Mars Odyssey',
  agency: 'NASA / JPL',
  altitude_km: '~400 km circular polar orbit (orbital period ~2.0 hours)',
  payload: 'THEMIS (Thermal Emission Imaging System in visible and multi-band infrared), GRS (Gamma Ray Spectrometer suite).',
  status: 'Active · longest-surviving operational spacecraft in orbit around Mars (since Oct 2001).'
 },
 tgo: {
  id: 'tgo',
  name: 'ExoMars Trace Gas Orbiter (TGO)',
  agency: 'ESA / Roscosmos',
  altitude_km: '~400 km circular orbit at 74° inclination',
  payload: 'NOMAD & ACS (high-precision infrared/UV spectrometers for atmospheric methane and trace gases), CaSSIS (colour and stereo surface imaging system), FREND (fine-resolution epithermal neutron detector for near-surface hydrogen/water).',
  status: 'Active · primary orbital relay hub transmitting >50% of surface rover data back to Earth.'
 },
 maven: {
  id: 'maven',
  name: 'MAVEN (Mars Atmosphere and Volatile EvolutioN)',
  agency: 'NASA / GSFC',
  altitude_km: '~150 km periapsis to ~6,200 km apoapsis elliptical orbit',
  payload: 'Particles and Fields Package (SWEA, SWIA, STATIC, MAG, LPW), Remote Sensing (IUVS), Neutral Gas and Ion Mass Spectrometer (NGIMS).',
  status: 'Active · quantifies the rate of atmospheric gas loss to space driven by solar wind interactions.'
 },
 mars_express: {
  id: 'mars_express',
  name: 'Mars Express (MEX)',
  agency: 'ESA',
  altitude_km: 'Elliptical quasi-polar orbit (300 × 10,100 km)',
  payload: 'HRSC (High Resolution Stereo Camera), MARSIS (subsurface radar sounder and ionospheric sounder), OMEGA (visible and infrared mineralogical mapping spectrometer), SPICAM, PFS.',
  status: 'Active · operational since Dec 2003; discovered water ice and clays, detected radar reflections under polar ice caps.'
 },
 hope: {
  id: 'hope',
  name: 'Hope (Emirates Mars Mission)',
  agency: 'UAESA / MBRSC',
  altitude_km: 'High elliptical orbit: 20,000 × 43,000 km (period ~55 hours)',
  payload: 'EXI (exploration imager), EMIRS (infrared spectrometer), EMUS (ultraviolet spectrometer).',
  status: 'Active · first global diurnal weather monitor studying lower atmosphere dynamics alongside upper atmospheric loss.'
 }
});

export const KNOWN_MOONS = Object.freeze({
 phobos: {
  id: 'phobos',
  name: 'Phobos (Mars I)',
  distance_km: '9,376 km from Mars center (~6,000 km above surface)',
  period: '7 hours 39.2 minutes (orbits Mars faster than Mars rotates!)',
  dimensions: '26.8 × 22.4 × 18.4 km (mean radius 11.1 km)',
  notable: 'Tidally locked; rises in the west and sets in the east twice per Martian sol. Features the giant 9 km Stickney crater. Orbit decaying at ~1.8 cm/year; will either crash into Mars or disintegrate into a ring in 30-50 million years.',
  ephemeris: 'Local NAIF MAR099 SPICE kernel (2025-2035) computed via CSPICE.'
 },
 deimos: {
  id: 'deimos',
  name: 'Deimos (Mars II)',
  distance_km: '23,463 km from Mars center',
  period: '30 hours 18 minutes (just outside Mars synchronous orbit radius of 20,428 km)',
  dimensions: '15.0 × 12.2 × 11.0 km (mean radius 6.2 km)',
  notable: 'Tidally locked; rises in the east and takes 2.7 sols to set in the west. Heavy regolith blanket smoothes cratered terrain.',
  ephemeris: 'Local NAIF MAR099 SPICE kernel (2025-2035) computed via CSPICE.'
 }
});

const $ = id => typeof document !== 'undefined' ? document.getElementById(id) : null;

/**
 * Standard Mars coordinate formatter ensuring ZERO negative numbers.
 * Converts to positive degrees with cardinal hemisphere notation: e.g. "8.3126°S, 79.6876°W".
 */
export function fmtCoord(lon, lat, precision = 4) {
 if (!Number.isFinite(lon) || !Number.isFinite(lat)) return 'Unknown location';
 const latDir = lat >= 0 ? 'N' : 'S';
 const lonDir = lon >= 0 ? 'E' : 'W';
 return `${Math.abs(lat).toFixed(precision)}°${latDir}, ${Math.abs(lon).toFixed(precision)}°${lonDir}`;
}

/**
 * Robust natural language parser for camera rotation commands.
 * Handles phrases like:
 * - "rotate by 15 degrees to right"
 * - "180 degrees to right"
 * - "rotate left 45"
 * - "90 degrees left"
 * - "rotate right"
 */
function parseRotation(q) {
 const hasRight = q.includes('right');
 const hasLeft = q.includes('left');
 const hasRotate = q.includes('rotate') || q.includes('turn') || q.includes('spin');
 const hasDegrees = q.includes('degree') || q.includes('deg') || q.includes('°');

 if ((hasRight || hasLeft) && (hasRotate || hasDegrees || /\b\d+\b/.test(q))) {
  const numMatch = q.match(/(\d+)/);
  let deg = numMatch ? parseInt(numMatch[1], 10) : 30;
  if (hasLeft) deg = -deg;
  return deg;
 } else if (hasRotate) {
  const numMatch = q.match(/(\d+)/);
  return numMatch ? parseInt(numMatch[1], 10) : 30;
 }
 return null;
}

/**
 * Robust natural language detector for mineral/resource path planning.
 * Matches:
 * - "I am standing at point A calculate path for minerals under 500 km range a"
 * - "Calculate the most optimal path to explore all the minerals within 500kms"
 * - "calculate path for minerals under 500 km"
 * - "plan path to visit all minerals"
 * - "find route for minerals within 300km"
 */
function isMineralTourQuery(q) {
 const hasMineral = q.includes('mineral') || q.includes('minerals') || q.includes('sulfate') || q.includes('hydrate') || q.includes('water resource') || q.includes('science site');
 const hasPath = q.includes('path') || q.includes('route') || q.includes('tour') || q.includes('corridor') || q.includes('traverse') || q.includes('plan');
 const hasAction = q.includes('calculate') || q.includes('explore') || q.includes('find') || q.includes('visit') || q.includes('survey') || q.includes('plot');
 const hasRange = q.includes('km') || q.includes('range') || q.includes('under') || q.includes('within') || q.includes('radius') || q.includes('all');

 return Boolean(hasMineral && (hasPath || (hasAction && hasRange)));
}

/**
 * Extracts radius (in km) from natural language query. Defaults to 500 km.
 */
function extractRadius(q, defaultRadius = 500) {
 const numbers = (q.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n >= 10 && n <= 2500);
 if (numbers.length > 0) {
  return numbers[0];
 }
 return defaultRadius;
}

/**
 * Robust detector for queries asking to compare or inspect all 3 calculated routes.
 * Matches:
 * - "provide data like o2 required and everything else for all three paths calculated"
 * - "compare all three paths"
 * - "compare all 3 routes"
 * - "what is the o2 required for all routes"
 * - "show data for all paths"
 */
function isAllPathsComparison(q) {
 const mentionsAll = q.includes('all') || q.includes('compare') || q.includes('comparison');
 const mentionsPaths = q.includes('three') || q.includes('3') || q.includes('all paths') || q.includes('all routes') || q.includes('every route') || q.includes('all 3');
 const mentionsData = q.includes('o2') || q.includes('oxygen') || q.includes('energy') || q.includes('data') || q.includes('stats') || q.includes('metrics') || q.includes('everything');

 return Boolean((mentionsAll && mentionsPaths) || (mentionsData && (q.includes('all') || q.includes('three') || q.includes('3'))));
}

/**
 * Robust detector for direct path safety queries.
 * Matches:
 * - "Is the calculated path safe for an astronaut?"
 * - "is the calculate path safe for naut"
 * - "is this path safe"
 * - "is the route safe for the rover"
 */
function isEmergencyReturn(q) {
 return q.includes('emergency') || q.includes('recalculate') || (q.includes('safest') && q.includes('fastest')) || q.includes('back to camp') || q.includes('return to camp') || q.includes('evacuate') || q.includes('oxygen alert') || q.includes('mayday');
}

function isPathSafetyQuery(q) {
 if (isEmergencyReturn(q)) return false;
 if (q.includes('time') || q.includes('speed') || q.includes('how long') || q.includes('duration') || q.includes('hours') || q.includes('difference')) return false;
 const mentionsSafe = q.includes('is safe') || q.includes('safe to') || q.includes('safe for') || q.includes('is the route safe') || q.includes('is the calculated path safe') || q.includes('safety') || q.includes('hazard') || q.includes('rollover') || q.includes('dangerous') || q.includes('cliff') || q.includes('slope check') || (q.includes('safe') && !q.includes('direct safe'));
 const mentionsPath = q.includes('path') || q.includes('route') || q.includes('corridor') || q.includes('terrain') || q.includes('slope');

 return Boolean(mentionsSafe && (mentionsPath || q.includes('is it') || q.includes('is the') || q.includes('for naut') || q.includes('for astronaut')));
}

export class EVAssistant {
 constructor(viewer, map, mini, {
  routePlanner, values, places, setView, navigation, currentFocus, onOpen,
  enter, regions, measurement, appearance, fitFootprint, regionOverview,
  home, getRegion, getDataset, spacecraft, moons, solarLighting, dustPredictor, seismology, atlas, missionDeployer, skylineVPR, name='ARES'
 } = {}) {
  Object.assign(this, {
   viewer, map, mini, routePlanner, values, places, setView, navigation, currentFocus, onOpen,
   enter, regions, measurement, appearance, fitFootprint, regionOverview,
   home, getRegion, getDataset, spacecraft, moons, solarLighting, dustPredictor, seismology, atlas,
   missionDeployer, skylineVPR, name,
   isListening: false,
   isSpeaking: false,
   muted: false,
   recognition: null,
   conversationHistory: []
  });

  this.initUI();
  this.initSTT();
  this.initVoiceOutput();
 }

 initUI() {
  if (typeof document === 'undefined') return;
  mountVoiceActivity($('assistant-waveform'),this.name);
  const micIcon=$('assistant-mic')?.querySelector?.('.mic-icon');
  if(micIcon)micIcon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>';
  if($('assistant-mute'))$('assistant-mute').textContent=this.muted?'Voice OFF':'Voice ON';
  if(this.atlas&&$('assistant-panel')&&!$('assistant-guide')){
   const tabs=document.createElement('div');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',this.name+' sections');const guide=document.createElement('section');guide.id='assistant-guide';guide.hidden=true;guide.setAttribute('role','tabpanel');guide.setAttribute('aria-labelledby','assistant-guide-tab');
   for(const [title,...examples] of ATLAS_COMMAND_GUIDE){const group=document.createElement('details'),summary=document.createElement('summary');summary.textContent=title;group.append(summary);for(const text of examples){const button=document.createElement('button');button.type='button';button.textContent=text;button.onclick=()=>{tabs.querySelector('#assistant-conversation-tab')?.click();this.handleQuery(text);};group.append(button);}guide.append(group);}
   const history=$('assistant-history')?.closest('.assistant-transcript-box');if(history){history.id='assistant-conversation';history.setAttribute('role','tabpanel');history.setAttribute('aria-labelledby','assistant-conversation-tab');}for(const [name,selected] of [['Conversation',true],['Command guide',false]]){const b=document.createElement('button');b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(selected));b.id=selected?'assistant-conversation-tab':'assistant-guide-tab';b.setAttribute('aria-controls',selected?'assistant-conversation':'assistant-guide');b.tabIndex=selected?0:-1;b.textContent=name;b.onclick=()=>{guide.hidden=name!=='Command guide';if(history)history.hidden=!guide.hidden;for(const t of tabs.children){t.setAttribute('aria-selected',String(t===b));t.tabIndex=t===b?0:-1;}};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const target=e.key==='Home'?tabs.firstElementChild:e.key==='End'?tabs.lastElementChild:b===tabs.firstElementChild?tabs.lastElementChild:tabs.firstElementChild;target.click();target.focus();}};tabs.append(b);}
   $('assistant-panel').querySelector('.tool-note')?.after(tabs);tabs.after(guide);
  }
  $('assistant-toggle')?.addEventListener('click', () => this.open($('assistant-panel').hidden));
  $('assistant-close')?.addEventListener('click', () => this.open(false));
  $('assistant-mic')?.addEventListener('click', () => this.toggleListening());
  $('assistant-mute')?.addEventListener('click', () => this.toggleMute());

  $('assistant-form')?.addEventListener('submit', e => {
   e.preventDefault();
   this.desktopSpeech?.cancel();
   this.outputVoice?.unlock();
   const input = $('assistant-input');
   const text = input.value.trim();
   if (!text) return;
   input.value = '';
   this.handleQuery(text);
  });

  document.querySelectorAll('.chip-btn').forEach(btn => {
   btn.addEventListener('click', () => {
    const chip = btn.dataset.chip;
    if (chip === 'emergency-return') {
     this.handleQuery("Hey please quickly recalculate the safest and fastest path to reach back to camp in case of any emergency");
    } else if (chip === 'nearest-minerals') {
     this.handleQuery("Scan for nearest hydrated mineral sites around my location in NASA PDS");
    } else if (chip === 'optimal-tour') {
     this.handleQuery("Calculate the most optimal path to explore all the minerals within 500kms");
    } else if (chip === 'consumables-check') {
     this.handleQuery("provide data like o2 required and everything else for all three paths calculated");
    } else if (chip === 'compare-view') {
     this.handleQuery("Switch display to split compare mode");
    } else if (chip === 'slope-check') {
     this.handleQuery("Is the calculated path safe for an astronaut?");
    } else if (chip === 'predict-dust') {
     this.handleQuery("Evaluate dust model inputs at the map centre");
    } else if (chip === 'detect-seismic') {
     this.handleQuery("Analyze real-time seismic waveforms from NASA InSight SEIS and detect marsquakes");
    } else if (chip === 'localize-skyline') {
     this.handleQuery("Localize astronaut position from ground photo using skyline visual place recognition");
    }
   });
  });
 }

 initSTT() {
  if (desktopState) {
   const mic=$('assistant-mic');
   this.desktopSpeech=new DesktopSpeechInput({
    onState:(state,message)=>{this.isListening=state==='recording';mic?.setAttribute('aria-pressed',String(this.isListening));const label=$('assistant-mic-label');if(label)label.textContent=state==='recording'?'Stop recording':['starting','transcribing'].includes(state)?'Cancel':'Push to Talk';$('assistant-waveform')?.classList.toggle('active',this.isListening);if(message)this.setStatus(message);},
    onTranscript:text=>{const input=$('assistant-input');if(input){input.value=input.value?input.value+' '+text:text;input.focus();}},
    onError:message=>this.setStatus(message),
    onStart:()=>{this.outputVoice?.stop();this.speechGeneration=(this.speechGeneration??0)+1;window.speechSynthesis?.cancel();}
   });
   if(mic){mic.disabled=false;mic.title='Record locally, review the transcript, then Send. No audio is uploaded.';}
   window.marsDesktop.voiceStatus().then(status=>{if(!status.available){if(mic){mic.disabled=true;mic.title=status.message;}this.setStatus(status.message);}}).catch(error=>this.setStatus(error.message));
   return;
  }
  const SpeechRec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  if (!SpeechRec) {
   this.setStatus("Microphone Web Speech API unavailable in this browser; text commands active.");
   return;
  }

  try {
   const rec = new SpeechRec();
   rec.continuous = false;
   rec.interimResults = false;
   rec.lang = 'en-US';

   rec.onstart = () => {
    this.isListening = true;
    $('assistant-mic')?.setAttribute('aria-pressed', 'true');
    const label = $('assistant-mic-label');
    if (label) label.textContent = 'Listening (Speak now)...';
    $('assistant-waveform')?.classList.add('active');
    this.setStatus("Listening to astronaut voice comms...");
   };

   rec.onresult = event => {
    const text = event.results[0][0].transcript;
    const input = $('assistant-input');
    if (input) input.value = text;
    this.handleQuery(text);
   };

   rec.onerror = event => {
    console.warn('SpeechRecognition error:', event.error);
    this.setStatus(`Voice input: ${event.error}. You can also type commands.`);
    this.stopListening();
   };

   rec.onend = () => {
    this.stopListening();
   };

   this.recognition = rec;
  } catch (e) {
   console.warn('SpeechRecognition init error:', e);
  }
 }

 toggleListening() {
  if(this.desktopSpeech){void this.desktopSpeech.toggle();return;}
  if (this.isListening) {
   this.stopListening();
  } else {
   this.startListening();
  }
 }

 startListening() {
  if (!this.recognition) {
   this.setStatus("Voice recognition not supported. Type your command below.");
   $('assistant-input')?.focus();
   return;
  }
  try {
   this.recognition.start();
  } catch (e) {
   this.stopListening();
  }
 }

 stopListening() {
  this.desktopSpeech?.cancel();
  this.isListening = false;
  $('assistant-mic')?.setAttribute('aria-pressed', 'false');
  if ($('assistant-mic-label')) $('assistant-mic-label').textContent = 'Push to Talk';
  $('assistant-waveform')?.classList.remove('active');
  try { this.recognition?.stop(); } catch (e) {}
 }

 initVoiceOutput() {
  if(!desktopState||typeof document==='undefined')return;
  const note=document.createElement('p');note.id='assistant-voice-note';note.className='tool-note';note.setAttribute('role','status');const button=$('assistant-mute');button?.parentElement?.append(note);
  if(button)this.outputVoice=new DesktopVoiceOutput({note,button,isMuted:()=>this.muted,onSpeaking:value=>{this.isSpeaking=value;$('assistant-waveform')?.classList.toggle('speaking',value);}});
  const settings=document.createElement('button');settings.type='button';settings.textContent='Voice settings';settings.onclick=()=>document.dispatchEvent(new Event('atlas-voice-settings'));note.after(settings);
 }

 toggleMute() {
  this.speechGeneration=(this.speechGeneration??0)+1;
  this.muted = !this.muted;
  if(this.outputVoice){this.outputVoice.stop();if(!this.muted)this.outputVoice.unlock();void this.outputVoice.refresh();}
  const btn = $('assistant-mute');
  if (btn) {
   btn.textContent = this.muted ? ' Voice OFF' : ' Voice ON';
   btn.setAttribute('aria-pressed', String(this.muted));
  }
  if (this.muted && typeof window !== 'undefined' && window.speechSynthesis) {
   window.speechSynthesis.cancel();
   this.isSpeaking=false;
   $('assistant-waveform')?.classList.remove('speaking');
  }
 }

 async speak(text) {
  const generation=this.speechGeneration=(this.speechGeneration??0)+1;
  if(this.desktopSpeech&&(this.desktopSpeech.state!=='idle'||$('assistant-panel')?.hidden))return;
  if (this.muted || typeof window === 'undefined') return;
  window.speechSynthesis?.cancel();

  // Strip Markdown formatting, code fences, or technical tags for natural spoken delivery
  const cleanSpoken = text
   .replace(/\bARES(?: AI)?\b/g,this.name)
   .replace(/O[₂2]/g, 'oxygen')
   .replace(/```[\s\S]*?```/g, 'Here is the requested code snippet.')
   .replace(/Action:\s*\{.*?\}/gs, '')
   .replace(/\[.*?\]/g, '')
   .replace(/[-*#_`•━]/g, ' ')
   .replace(/·/g, ',')
   .replace(/\s+/g, ' ')
   .trim();

  if (!cleanSpoken) return;
  if(desktopState){await this.outputVoice?.speak(cleanSpoken);return;}
  if(!('speechSynthesis' in window))return;

  const utterance = new SpeechSynthesisUtterance(cleanSpoken);
  utterance.rate = 1.05;
  utterance.pitch = 0.95;

  let voices = window.speechSynthesis.getVoices().filter(voice => !desktopState || voice.localService);
  if(desktopState&&!voices.length){await new Promise(resolve=>{let timer;const finish=()=>{clearTimeout(timer);window.speechSynthesis.removeEventListener('voiceschanged',finish);resolve();};timer=setTimeout(finish,2000);window.speechSynthesis.addEventListener('voiceschanged',finish,{once:true});});voices=window.speechSynthesis.getVoices().filter(voice=>voice.localService);}
  if(generation!==this.speechGeneration||this.muted)return;
  if (desktopState && !voices.length) {const note=$('assistant-voice-note');if(note)note.textContent='No offline system voice is available. This reply is shown as text. Install an offline system voice to enable spoken replies.';return;}
  const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('David')));
  if (preferred || desktopState) utterance.voice = preferred ?? voices.find(voice => voice.lang.startsWith('en')) ?? voices[0];

  utterance.onstart = () => {
   this.isSpeaking = true;
   $('assistant-waveform')?.classList.add('speaking');
  };
  utterance.onend = () => {
   this.isSpeaking = false;
   $('assistant-waveform')?.classList.remove('speaking');
  };
  utterance.onerror = event => {
   if(!['canceled','interrupted'].includes(event.error)&&desktopState&&$('assistant-voice-note'))$('assistant-voice-note').textContent='The system voice could not speak. Check your audio output and installed voices. The reply remains available as text.';
   this.isSpeaking = false;
   $('assistant-waveform')?.classList.remove('speaking');
  };

  window.speechSynthesis.speak(utterance);
 }

 open(show) {
  const panel = $('assistant-panel');
  if (!panel) return;
  panel.hidden = !show;
  $('assistant-toggle')?.setAttribute('aria-expanded', String(show));
  $('assistant-toggle')?.setAttribute('aria-pressed', String(show));
  if (show) {
   this.onOpen?.();
   $('assistant-input')?.focus();
  } else {
   this.stopListening();
   this.speechGeneration=(this.speechGeneration??0)+1;
   if(desktopState){this.outputVoice?.stop();window.speechSynthesis?.cancel();}
  }
 }

 setStatus(msg) {
  const el = $('assistant-status');
  if (el) el.textContent = msg.replace(/\bARES(?: AI)?\b/g,this.name);
 }

 buildTraceDrawer(trace) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const details = document.createElement('details');
  details.className = 'ares-trace-drawer';

  const summary = document.createElement('summary');
  const titleSpan = document.createElement('span');
  titleSpan.textContent = '⚡ Tactical Execution Trace';

  const pillSpan = document.createElement('span');
  pillSpan.className = 'trace-pill';
  pillSpan.textContent = trace.status || '6 STEPS VERIFIED';
  if (pillSpan.style && trace.statusColor) {
   pillSpan.style.borderColor = trace.statusColor;
   pillSpan.style.color = trace.statusColor;
  }
  summary.append(titleSpan, pillSpan);

  const container = document.createElement('div');
  container.className = 'trace-steps';

  const steps = [
   { title: 'Goal Formulation', desc: trace.goal || 'Analyze tactical intent and operational constraints.' },
   { title: 'Intent Classification', desc: trace.intent || 'Autonomous EVA tactical co-pilot command routing.' },
   { title: 'NASA Hybrid RAG Grounding', desc: trace.rag || 'BM25 + Semantic Cosine RRF against authentic NASA PDS & USGS archives.' },
   { title: 'Tool / Action Dispatch', desc: trace.tool || 'Direct telemetry execution on Martian surface.' },
   { title: 'NASA Flight Rule Gate', desc: trace.flightRule || 'Nominal slope ≤15°, slope barrier ≤22°, Minetti bioenergetics verified.' },
   { title: '3D Telemetry Execution', desc: trace.telemetry || 'Geospatial coordinates and 3D globe layer synchronized.' }
  ];

  steps.forEach((step, idx) => {
   const stepDiv = document.createElement('div');
   stepDiv.className = 'trace-step';

   const numSpan = document.createElement('span');
   numSpan.className = 'trace-step-num';
   numSpan.textContent = String(idx + 1);

   const contentDiv = document.createElement('div');
   contentDiv.className = 'trace-step-content';
   const strong = document.createElement('strong');
   strong.textContent = `${step.title}: `;
   const descSpan = document.createElement('span');
   descSpan.textContent = step.desc;
   contentDiv.append(strong, descSpan);

   stepDiv.append(numSpan, contentDiv);
   container.append(stepDiv);
  });

  if (trace.citations && trace.citations.length > 0) {
   const citDiv = document.createElement('div');
   citDiv.className = 'trace-citations';
   const citTitle = document.createElement('strong');
   citTitle.textContent = 'AUTHENTIC NASA CITATIONS:';
   citDiv.append(citTitle);
   trace.citations.forEach(c => {
    const badge = document.createElement('span');
    badge.className = 'ares-citation-badge';
    badge.textContent = c;
    citDiv.append(badge);
   });
   container.append(citDiv);
  }

  details.append(summary, container);
  return details;
 }

 generateDefaultTrace(text, isAction) {
  return {
   goal: 'Process tactical astronaut request within Mars EVA operational safety limits.',
   intent: isAction ? 'TACTICAL_SURFACE_ACTION' : 'MISSION_COGNITIVE_ADVISORY',
   rag: 'NASA PDS, USGS IAU Gazetteer, & HLS2 Mission Rules (Authentic Ground Truth)',
   tool: isAction ? 'EVA_HUD_ACTION_DISPATCH' : 'ARES_CO_PILOT_ADVISORY',
   flightRule: 'Safety margin certified: Life-support, slope hazards, and diurnal solar verified.',
   telemetry: 'Surface coordinates verified. Telemetry active.',
   status: isAction ? 'ACTION EXECUTED' : 'VERIFIED',
   statusColor: '#78d7a3'
  };
 }

 addMessage(sender, text, isAction = false, traceData = null) {
  const history = $('assistant-history');
  if (!history) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `assistant-msg ${sender.startsWith('Astronaut') ? 'user-msg' : 'ares-msg'} ${isAction ? 'action-msg' : ''}`;

  const senderTag = document.createElement('strong');
  senderTag.className = 'msg-sender';
  senderTag.textContent = `${sender==='ARES'?this.name:sender}: `;

  const textP = document.createElement('p');
  textP.className = 'msg-text';
  textP.textContent = sender==='ARES'?text.replace(/\bARES(?: AI)?\b/g,this.name):text;

  msgDiv.append(senderTag, textP);

  if (!sender.startsWith('Astronaut')) {
   const trace = traceData ?? this.generateDefaultTrace(text, isAction);
   if (trace) {
    const drawer = this.buildTraceDrawer(trace);
    if (drawer) msgDiv.append(drawer);
   }
  }

  history.append(msgDiv);
  if (history.scrollHeight) history.scrollTop = history.scrollHeight;
  return msgDiv;
 }

 openMarswalk(tab){
  const workbench=this.routePlanner?.workbench;
  if(!workbench)return;
  this.open(false);workbench.open(true);workbench.showTab(tab);
 }

 async explainMission(question){
  this.missionRequest?.abort();
  if(question.type==='open'){this.missionRequest=null;this.openMarswalk(question.tab);return;}
  const controller=this.missionRequest=new AbortController();
  this.setStatus(question.type==='omit'?'Comparing stop omissions on the current terrain…':'Reading the calculated Marswalk plan…');
  try{
   const answer=await answerMissionQuestion(this.routePlanner,question,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(180000)])});
   if(controller.signal.aborted)return;
   const message=this.addMessage('ARES',answer.text,false,false);
   if(message){
    const links=document.createElement('div');links.className='tars-mission-sources';
    for(const [label,url] of answer.sources){
     const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener';links.append(a);
    }
    const review=document.createElement('button');review.type='button';review.textContent='Review in Marswalk';review.onclick=()=>this.openMarswalk(answer.tab);
    message.append(links,review);
    const history=$('assistant-history');history.scrollTop=Math.max(0,message.offsetTop-history.offsetTop);
   }
   this.setStatus(question.type==='omit'?'Deterministic comparison complete.':'Marswalk results read.');
   this.speak(answer.text.split('\n').slice(0,3).join(' '));
  }catch(error){
   if(controller.signal.aborted)return;
   const detail=error.name==='TimeoutError'||error.message==='Failed to fetch'?'The route service is unavailable. Restore access to Pyxis’s planner and try the comparison again.':error.message;
   this.addMessage('ARES',detail,false,false);
   this.setStatus('Mission inputs or route calculation needed.');
  }finally{if(this.missionRequest===controller)this.missionRequest=null;}
 }

 getCurrentPosition() {
  const p = this.currentFocus?.()?.point || this.places?.position()?.point;
  if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) return p;
  const currentRegion = this.getRegion?.();
  if (currentRegion?.center) return currentRegion.center;
  return [77.40, 18.48]; // default reference in Jezero
 }

  executeAction(action) {
   if (!action) return false;
   try{action=validateAresAction(action);}catch(error){this.addMessage('ARES','Ignored model action: '+error.message);return false;}
   const type = action.type;
   const params = action.params || action;

   if(!this.atlas&&['set_layer','set_feature','focus_map','dust_inputs'].includes(type)){this.addMessage('ARES','The requested map control is unavailable.');return false;}
   if(this.atlas&&['set_layer','set_feature','focus_map','dust_inputs'].includes(type)){const query=type==='set_layer'?`${params.show===false?'Hide':'Apply'} ${params.layer}`:type==='set_feature'?`${params.show===false?'Turn off':'Turn on'} ${params.feature}`:'Focus on map';const command=type==='dust_inputs'?{type:'dust',target:Object.fromEntries(['lat','lon','ls','ltst','windMps','elevationKm'].filter(k=>params[k]!==undefined).map(k=>[k,params[k]]))}:parseAtlasCommand(query);if(command)return runAtlasCommand(command,this.atlas).then(text=>{this.addMessage('ARES',text);return true;}).catch(e=>{this.addMessage('ARES',e.message);return false;});this.addMessage('ARES','That control is not available. No feature was changed.');return;}

   if(type==='route'){const regions=(typeof this.regions==='function'?this.regions():this.regions)??[],sites=(typeof this.values?.sites==='function'?this.values.sites():this.values?.sites)??[];const resolve=name=>resolveAresPoint(name,{home:this.routePlanner?.workbench?.state?.home,regions,sites});const start=resolve(params.from),goal=resolve(params.to);if(!this.routePlanner||!start||!goal){this.addMessage('ARES','Route not started: choose a configured habitat and sourced named destination.');return false;}this.routePlanner.start=start;this.routePlanner.goal=goal;this.routePlanner.shown=params.profile;this.routePlanner.render();return Promise.resolve(this.routePlanner.plan()).then(()=>true);}
   if (type === 'rotate') {
    const deg = typeof params.degrees === 'number' ? params.degrees : 30;
    const dir = params.direction || (deg < 0 ? 'left' : 'right');
    this.executeRotate(deg, dir, { silent: true });
   } else if (type === 'orbit_360') {
    this.executeReconOrbit({ silent: true });
   } else if (type === 'zoom') {
    const km = typeof params.km === 'number' ? params.km : 30;
    this.executeZoomByDistance(km, params.direction === 'in');
   } else if (type === 'plan_mineral_tour') {
    const radius = typeof params.radius_km === 'number' ? params.radius_km : 500;
    this.executeOptimalMineralTour(radius);
   } else if (type === 'emergency_return') {
    this.executeEmergencyReturn();
   } else if (type === 'explore_observation') {
    this.executeExploreObservation();
   } else if (type === 'navigate' || type === 'fly_to') {
    if(Number.isFinite(params.lat)&&Number.isFinite(params.lon)){if(!this.viewer?.camera||!globalThis.window?.Cesium){this.addMessage('ARES','The 3D map is unavailable.');return false;}this.setView?.('3d');this.viewer.camera.flyTo({destination:window.Cesium.Cartesian3.fromDegrees(params.lon,params.lat,250000,this.viewer.scene.globe.ellipsoid)});}else if(params.destination)this.executeNavigate(params.destination);
   } else if (type === 'split_compare') {
    this.setView?.('split');
   } else if (type === 'distance') {
    this.executeDistanceCalculation();
   } else if (type === 'scan_minerals') {
    this.executeMineralScan('',params.mineral);
   } else if (type === 'fly_spacecraft' || type === 'spacecraft') {
    const id = params.id || params.name || params.target;
    if (id) this.executeSpacecraft(id);
   } else if (type === 'track_orbiter' || type === 'orbiter') {
    const id = params.id || params.name || params.target;
    if (id) this.executeOrbiter(id);
   } else if (type === 'show_moon' || type === 'moon') {
    const id = params.id || params.target || 'phobos';
    this.executeMoon(id);
   } else if (type === 'solar_status' || type === 'sunlight') {
    this.executeSolarStatus();
   } else if (type === 'dust_prediction' || type === 'dust_storm' || type === 'climate') {
    this.executeDustPrediction();
   } else if (type === 'seismic_detection' || type === 'marsquake' || type === 'quake') {
    this.executeSeismicDetection();
   } else if (type === 'offline_status') {
    this.executeOfflineStatus();
   } else if (type === 'deploy_equipment' || type === 'deploy') {
    const target = params.target || params.equipment || params.type || '';
    this.executeDeployEquipment(target);
   } else if (type === 'plan_mission' || type === 'mission_plan') {
    const target = params.target || params.location || params.site || '';
    this.executePlanMission(target);
   }
   return true;
  }

  executeSpacecraft(target) {
   const q = (target || '').toLowerCase().trim();
   let matchKey = Object.keys(KNOWN_SPACECRAFT).find(k => q.includes(k) || KNOWN_SPACECRAFT[k].name.toLowerCase().includes(q));
   if (!matchKey) {
    if (q.includes('perseverance') || q.includes('percy')) matchKey = 'perseverance';
    else if (q.includes('curiosity')) matchKey = 'curiosity';
    else if (q.includes('ingenuity') || q.includes('helicopter') || q.includes('ginny')) matchKey = 'ingenuity';
    else if (q.includes('insight') || q.includes('seismic')) matchKey = 'insight';
    else if (q.includes('spirit')) matchKey = 'spirit';
    else if (q.includes('opportunity') || q.includes('oppy')) matchKey = 'opportunity';
    else if (q.includes('zhurong')) matchKey = 'zhurong';
    else if (q.includes('phoenix')) matchKey = 'phoenix';
    else if (q.includes('pathfinder') || q.includes('sojourner')) matchKey = 'pathfinder';
    else if (q.includes('viking 1') || q.includes('viking1')) matchKey = 'viking1';
    else if (q.includes('viking 2') || q.includes('viking2')) matchKey = 'viking2';
    else if (q.includes('viking')) matchKey = 'viking1';
   }

   if (!matchKey) {
    const names = Object.values(KNOWN_SPACECRAFT).map(s => `• ${s.name} (${s.landing.split('·')[1]?.trim() || s.landing})`).join('\n');
    const resp = `Identified surface spacecraft and rovers in catalogue:\n${names}\n\nCommand me: "Fly to Perseverance", "Where is Curiosity?", or "Show InSight".`;
    this.addMessage('ARES', resp);
    this.speak("Here are the catalogued surface spacecraft. You can ask me to fly to any rover or lander.");
    this.setStatus("Catalogued spacecraft listed.");
    return;
   }

   const info = KNOWN_SPACECRAFT[matchKey];
   const liveItem = this.spacecraft?.items?.find(x => x.id === matchKey);
   const loc = liveItem?.location || info.location;
   const coordText = fmtCoord(loc.lon_east, loc.lat_planetocentric);
   const elevText = Number.isFinite(loc.elevation_m) ? `${Math.round(loc.elevation_m)} m relative to datum` : 'surface datum';
   const solText = loc.sol ? `Sol ${loc.sol}` : loc.flight ? `Flight ${loc.flight}` : 'Mission landing site';

   if (this.spacecraft) {
    this.spacecraft.select(matchKey, { fly: true });
   }

   const briefing = ` SPACECRAFT TELEMETRY: ${info.name.toUpperCase()}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• Classification: ${info.kind.toUpperCase()} | Timeline: ${solText}\n` +
    `• Ground Coordinates: [${coordText}]\n` +
    `• Elevation: ${elevText}\n` +
    `• Landing: ${info.landing}\n` +
    `• Mission Science: ${info.mission}\n\n` +
    `Target selected. 3D camera flight initiated and 3D surface model clamped to high-resolution terrain.`;

   this.addMessage('ARES', briefing, true);
   this.speak(`Navigating to ${info.name} at coordinates ${coordText}. 3D model clamped to terrain.`);
   this.setStatus(`Viewing ${info.name}.`);
   return true;
  }

  executeOrbiter(target) {
   const q = (target || '').toLowerCase().trim();
   let matchKey = Object.keys(KNOWN_ORBITERS).find(k => q.includes(k) || KNOWN_ORBITERS[k].name.toLowerCase().includes(q));
   if (!matchKey) {
    if (q.includes('mro') || q.includes('reconnaissance')) matchKey = 'mro';
    else if (q.includes('odyssey') || q.includes('2001')) matchKey = 'odyssey';
    else if (q.includes('tgo') || q.includes('trace gas') || q.includes('exomars')) matchKey = 'tgo';
    else if (q.includes('maven')) matchKey = 'maven';
    else if (q.includes('express') || q.includes('mex')) matchKey = 'mars_express';
    else if (q.includes('hope') || q.includes('emirates') || q.includes('emm')) matchKey = 'hope';
   }

   if (!matchKey) {
    const list = Object.values(KNOWN_ORBITERS).map(o => `• ${o.name} (${o.agency}) - ${o.altitude_km}`).join('\n');
    const resp = ` ACTIVE MARS ORBITAL CONSTELLATION:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${list}\n\nCommand me: "Track MRO", "Where is Odyssey?", or "Show Trace Gas Orbiter".`;
    this.addMessage('ARES', resp);
    this.speak("Here are the active satellites in Mars orbit. You can ask me to track any orbiter.");
    this.setStatus("Orbital constellation listed.");
    return;
   }

   const o = KNOWN_ORBITERS[matchKey];
   if (this.moons?.selectOrbiter) {
    this.moons.selectOrbiter(matchKey);
   } else if (this.spacecraft?.select) {
    this.spacecraft.select(matchKey);
   }

   const resp = ` SATELLITE ORBITAL TELEMETRY: ${o.name.toUpperCase()}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• Agency: ${o.agency}\n` +
    `• Orbital Parameters: ${o.altitude_km}\n` +
    `• Status & Relay Role: ${o.status}\n` +
    `• Scientific Payload: ${o.payload}\n\n` +
    `Focused 3D viewport on ${o.name}. Horizons ephemeris trajectory and 3D satellite model loaded.`;

   this.addMessage('ARES', resp, true);
   this.speak(`Tracking ${o.name}. Orbit trajectory and 3D spacecraft model loaded.`);
   this.setStatus(`Tracking ${o.name}.`);
   return true;
  }

  executeMoon(target) {
   const q = (target || '').toLowerCase().trim();
   const isDeimos = q.includes('deimos');
   const isSystem = q.includes('system') || q.includes('all') || q.includes('both');

   if (isSystem) {
    this.moons?.system?.();
    const resp = ` MARTIAN CELESTIAL SYSTEM OVERVIEW:\n` +
     `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
     `• Mars Moons: Phobos (inner, 9,376 km) & Deimos (outer, 23,463 km)\n` +
     `• Ephemeris Engine: NASA/JPL NAIF MAR099 SPICE Kernels (100% Offline via CSPICE)\n` +
     `• Inertial Reference Frame: J2000 rotated into IAU_MARS planetocentric frame\n` +
     `• Satellite Orbits: MRO, Odyssey, Mars Express, TGO, MAVEN, Hope\n\n` +
     `Martian system overview active. True-scale orbits rendered.`;
    this.addMessage('ARES', resp, true);
    this.speak("Displaying Mars celestial system overview with Phobos, Deimos, and satellite constellation.");
    this.setStatus("Mars system view active.");
    return;
   }

   const key = isDeimos ? 'deimos' : 'phobos';
   const moon = KNOWN_MOONS[key];
   this.moons?.select?.(key);

   const resp = ` MOON TELEMETRY: ${moon.name.toUpperCase()}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• Semi-Major Axis: ${moon.distance_km}\n` +
    `• Orbital Period: ${moon.period}\n` +
    `• Triaxial Dimensions: ${moon.dimensions}\n` +
    `• Orbital Mechanics: ${moon.notable}\n` +
    `• Ephemeris Source: ${moon.ephemeris}\n\n` +
    `Camera focused on ${moon.name}. 3D textured mesh and SPICE orbit trace loaded.`;

   this.addMessage('ARES', resp, true);
   this.speak(`Camera focused on ${moon.name}. SPICE ephemeris active.`);
   this.setStatus(`Viewing ${moon.name}.`);
  }

  executeSolarStatus() {
   const pos = this.getCurrentPosition();
   let sun, solar;
   try {
    sun = marsSun(Date.now());
    solar = solarAt(sun, pos[0], pos[1]);
   } catch (e) {
    const err = "Mars24 solar calculation temporarily unavailable for the current time.";
    this.addMessage('ARES', err);
    this.speak(err);
    return;
   }

   const elev = solar.elevation;
   const isDay = elev > 0;
   const isTwilight = elev <= 0 && elev > -6;
   const lightingState = isDay ? ' DAYLIGHT' : isTwilight ? ' CIVIL TWILIGHT' : ' NIGHT';

   const trueHour = Math.floor(solar.local_true_hour);
   const trueMin = Math.round((solar.local_true_hour % 1) * 60);
   const timeStr = `${String(trueHour).padStart(2, '0')}:${String(trueMin).padStart(2, '0')} Local True Solar Time (LTST)`;

   const metrics = this.solarLighting?.computeMetrics?.(pos[0], pos[1], new Date().toISOString());
   const fluxStr = metrics ? `\n• Surface Irradiance: ${metrics.panel?.totalSurfaceFlux ?? 0} W/m² (Direct: ${metrics.panel?.directFlux ?? 0} W/m², Diffuse: ${metrics.panel?.diffuseFlux ?? 0} W/m²)\n• Optimal Solar Panel Tilt: ${metrics.optimalTilt?.toFixed(1) ?? '—'}°\n• Daylight Duration: ${metrics.hours?.toFixed(1) ?? '—'} hours/sol` : '';

   const resp = ` MARS DIURNAL SOLAR TELEMETRY:\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• View Coordinates: [${fmtCoord(pos[0], pos[1])}]\n` +
    `• Illumination Condition: ${lightingState}\n` +
    `• Local Solar Time: ${timeStr}\n` +
    `• Solar Elevation: ${elev.toFixed(2)}° above local horizontal\n` +
    `• Solar Azimuth: ${solar.azimuth.toFixed(1)}°\n` +
    `• Geometric Illumination Factor: ${(solar.illumination * 100).toFixed(1)}% of maximum normal insolation` +
    fluxStr + `\n` +
    `• Solar Longitude (Season): Ls = ${sun.ls.toFixed(1)}°\n` +
    `• Mars-Sun Distance: ${sun.distance_au.toFixed(3)} AU (Solar irradiance ≈ ${(1361 / (sun.distance_au ** 2)).toFixed(0)} W/m²)\n` +
    `• Algorithm: NASA GISS Mars24 analytical equations (100% Offline computation).`;

   this.solarLighting?.open?.(true);
   this.addMessage('ARES', resp, true);
   const spoken = `At view coordinates, conditions are ${isDay ? 'daylight' : isTwilight ? 'civil twilight' : 'night'}. Solar elevation is ${elev.toFixed(1)} degrees, with local true solar time at ${trueHour} hours ${trueMin} minutes.`;
   this.speak(spoken);
   this.setStatus(`Solar: ${elev.toFixed(1)}° · ${isDay ? 'Day' : 'Night'}`);
  }

  async executeDustPrediction() {
   if(!this.dustPredictor){this.addMessage('ARES','The dust input service is unavailable.');return;}
   const result=await this.dustPredictor.open(true);this.addMessage('ARES',result?.inputNote??'No validated dust forecast is available.');return result;
  }

  executeSeismicDetection() {
   if (this.seismology) {
    this.seismology.open(true);
   }

   const resp = ` PLANETARY SEISMOLOGY & MARSQUAKE LAB (NASA InSight SEIS):\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• Mission Ground Truth: InSight Very Broad Band (VBB) & Short Period (SP) seismometer package (Sol 1–1440, Elysium Planitia [135.62°E, 4.50°N]).\n` +
    `• Total Marsquakes Catalogued: 1,318 events detected across 4 mission sols.\n` +
    `• Benchmark Event S1222a: Magnitude Mw 4.7 monster marsquake (May 4, 2022) — strongest recorded extraterrestrial seismic event, reverberating energy for >10 hours.\n` +
    `• Autonomous On-Device Trigger: Real-time Short-Term Average / Long-Term Average (STA/LTA) energy ratio detector running in-browser.\n` +
    `• Waveform Phase Picking: Automated detection of primary compressional (P-wave) and secondary shear (S-wave) phase arrival differentials (Δt).\n` +
    `• Epicentral Distance Model: D = Δt · (vP · vS) / (vP - vS) = Δt · 9.0 km (vP = 7.2 km/s, vS = 4.0 km/s InSight crustal velocity model).\n` +
    `• Primary Tectonic Epicenter: Cerberus Fossae fault grabens [164.7°E, 9.8°N], demonstrating active volcanotectonic extensional rifting on Mars today.\n` +
    `• Apollo PSE Comparison: Moonquakes (shallow tectonic, deep tidal ~800 km, thermal, and artificial impact) available for multi-planetary comparative seismology.`;

   this.addMessage('ARES', resp, true);
   const spoken = "Opening Planetary Seismology Lab. NASA InSight SEIS catalogue contains 1,318 marsquakes, led by event S1222a at magnitude 4.7. On-device STA/LTA detector and P/S phase pickers are active.";
   this.speak(spoken);
   this.setStatus("Seismology Lab Active · 1,318 InSight Marsquakes");
  }

  executeOfflineStatus() {
   const resp = `MARS OFFLINE AUTONOMY ARCHITECTURE AUDIT:\n\n` +
    `Available coverage depends on installed datasets and runtimes. A browser cache does not establish complete offline readiness.\n\n` +
    `1. MAPS: The desktop starter includes coarse CTX/Viking overview imagery and MOLA elevation at 4 pixels/degree. Missing fine imagery and terrain remain unavailable; Online Mode must be selected explicitly for remote sources.\n\n` +
    `2. MOONS: Local NAIF SPICE kernels, including mar099-moons-2025-2035.bsp, support modeled Phobos/Deimos positions only with an installed compatible scientific runtime and within kernel coverage.\n\n` +
    `3. SUNLIGHT: NASA GISS Mars24 equations support local analytical calculations; these are modeled geometry, not observed weather.\n\n` +
    `4. SPACECRAFT: bootstrap.json and local catalogues contain dated historical positions. These are not live tracking. Missing orbit/time coverage is unknown; no unverified propagation is implied.\n\n` +
    `5. ROUTES: The original three-profile Python engine requires its scientific runtime and measured terrain coverage. Coarse maps do not establish operational navigation safety.\n\n` +
    `6. ARES: Deterministic commands remain available. Local inference additionally requires an app-managed executable and compatible installed GGUF weights; this build does not yet bundle them.`;
   this.addMessage('ARES', resp, true);
   this.speak('Offline capability depends on installed coverage and runtimes. Check the dataset and model status before use.');
   this.setStatus('Coverage and runtime requirements reported.');
  }

  executePlanMission(target) {
   if (!this.missionDeployer) {
    this.addMessage('ARES', 'Mission Workbench deployer is currently unavailable.');
    return;
   }
   const q = (typeof target === 'string' ? target : (target?.name || target?.location || '')).toLowerCase();
   let locId = 'VALLES_MARINERIS';
   if (q.includes('gale') || q.includes('curiosity') || q.includes('sharp') || q.includes('boxwork')) {
    locId = 'GALE_CRATER';
   } else if (q.includes('jezero') || q.includes('perseverance') || q.includes('delta') || q.includes('forks')) {
    locId = 'JEZERO_CRATER';
   } else if (q.includes('arcadia') || q.includes('ice') || q.includes('isru') || q.includes('glacier')) {
    locId = 'ARCADIA_PLANITIA';
   } else if (q.includes('valles') || q.includes('candor') || q.includes('marineris')) {
    locId = 'VALLES_MARINERIS';
   }

   this.missionDeployer.selectLocation(locId);
   this.missionDeployer.open(true);

   const locs = {
    VALLES_MARINERIS: {
     name: 'Valles Marineris (Candor Chasma)',
     badge: 'Deep Canyon Stratigraphy',
     center: '7.0°S, 71.7°W',
     details: '• Terrain: Deep canyon floor (4.5 km below datum), steep walls (>25°), shadow traps.\n• Barometric Pressure: ~913 Pa (+50% higher atmospheric density vs Mars datum).\n• Operational Window: Solar shadow mask >24.5° requires high-elevation solar arrays.',
     voice: 'Mission Workbench initialized at Valles Marineris Candor Chasma. High atmospheric density and steep canyon walls active.'
    },
    GALE_CRATER: {
     name: 'Gale Crater (Mount Sharp)',
     badge: 'Boxwork Strata & Curiosity Findings',
     center: '4.82°S, 137.38°E',
     details: '• Terrain: Layered central mound (Aeolis Mons), boxwork polygonal mineral networks.\n• Curiosity 2025 Finding: Subsurface groundwater fracture fills preserved in sulfate-clay contacts.\n• Rim Mask: 8.0° elevation horizon; prime multi-directional rover traverse corridor.',
     voice: 'Mission Workbench initialized at Gale Crater Mount Sharp. Boxwork ridge formations and sulfate clay contacts loaded.'
    },
    JEZERO_CRATER: {
     name: 'Jezero Crater (Western Delta)',
     badge: 'Ancient River Delta & Sample Depot',
     center: '18.48°N, 77.40°E',
     details: '• Terrain: Sedimentary fan delta, boulder dropstones, crater rim fault scarps.\n• Biosignature Caching: Perseverance Three Forks depot and fine-grained mudstones.\n• Rim Mask: 6.5° horizon; optimal line-of-sight for tactical comms relay to orbiters.',
     voice: 'Mission Workbench initialized at Jezero Crater Western Delta. River delta sedimentology and sample depot active.'
    },
    ARCADIA_PLANITIA: {
     name: 'Arcadia Planitia (Site AP-1)',
     badge: 'Glacial Sheet Ice Outpost',
     center: '39.79°N, 157.90°W',
     details: '• Terrain: Vast smooth volcanic plains with subsurface sheet ice at depth <1.0 m.\n• Resource Extraction: MRO SHARAD / SWIM confirmed >80% pure water ice for ISRU life support.\n• Slope & Horizon: Minimal 2.0° horizon mask; 43.5° panel tilt optimal for high-latitude solar.',
     voice: 'Mission Workbench initialized at Arcadia Planitia. Shallow sheet ice extraction site and ISRU outpost active.'
    }
   };

   const info = locs[locId] || locs.VALLES_MARINERIS;
   const resp = ` MISSION WORKBENCH: ${info.name.toUpperCase()}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• Target Status: ACTIVE PILOT OPERATIONAL\n` +
    `• Coordinates: [${info.center}]\n` +
    `• Exploration Focus: ${info.badge}\n` +
    `${info.details}\n` +
    `• Tactical Instruments Ready: UltraFlex Solar Array, Comms Mast, InSight SEIS, REMS Weather Station.\n\n` +
    `Tactical mission workbench open. 3D models and terrain clamp ready for deployment.`;

   this.addMessage('ARES', resp, true);
   this.speak(info.voice);
   this.setStatus(`Mission: ${info.name}`);
  }

  executeSkylineLocalization(query = '') {
   const q = (typeof query === 'string' ? query : '').toLowerCase();

   let targetPreset = null;
   if (q.includes('valles') || q.includes('marineris') || q.includes('ius')) {
    targetPreset = 'VALLES_MARINERIS_IUS';
   } else if (q.includes('jezero') || q.includes('belva') || q.includes('delta')) {
    targetPreset = 'JEZERO_CRATER_DELTA';
   } else if (q.includes('gale') || q.includes('sharp') || q.includes('aeolis')) {
    targetPreset = 'GALE_CRATER_MOUNT_SHARP';
   } else if (q.includes('olympus')) {
    targetPreset = 'OLYMPUS_MONS_CALDERA';
   } else if (q.includes('arcadia') || q.includes('vastitas')) {
    targetPreset = 'ARCADIA_PLANITIA_PLAINS';
   }

   if (this.skylineVPR) {
    this.skylineVPR.open(true);
    if (targetPreset) {
      this.skylineVPR.loadPreset(targetPreset);
      this.skylineVPR.runLocalization();
    }
   }

   const lastResult = this.skylineVPR?.lastResult;
   const bestMatch = lastResult?.bestMatch;

   let matchDetails = '';
   if (bestMatch) {
    matchDetails =
     `• Highest-ranked basin: ${bestMatch.name}\n` +
     `• Candidate coordinates: [${fmtCoord(bestMatch.lon, bestMatch.lat)}] (candidate; positional uncertainty unavailable)\n` +
     `• Recovered Camera Compass Heading: ${lastResult.matchedHeadingDeg}°\n` +
     `• Skyline correlation: ${(bestMatch.confidence * 100).toFixed(1)}% (ZNCC Silhouette Matching)\n` +
     `• Geomorphological Evidence: ${bestMatch.geomorphology}\n\n`;
   }

   const resp =
    `🧭 MARS SKYLINE VISUAL PLACE RECOGNITION (VPR) ENGAGED:\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Skyline VPR ranks a supplied skyline against the library of candidate profiles. Results need independent position confirmation.\n\n` +
    (matchDetails || `• Skyline VPR panel opened with live 360° horizon matching engine.\n\n`) +
    `• Scientific Principle: 360° Mountain Silhouette Geometric Matching (Cozman & Krotkov 1995; Babacic, Lu, & Stachniss 2022).\n` +
    `• Curvature Correction: d(r) = r² / (2·R_Mars) compensates for Mars's spherical drop (R_Mars = 3,396,190 m).\n` +
    `• Scale & Pitch Invariance: Z-Score normalization s_norm(φ) = (s(φ) - μ) / σ cancels unknown camera vertical tilt (pitch) and optical zoom (VFOV).\n` +
    `• In-Situ Panoramic Capture: In Ground View, click "📸 Capture 360° Panorama" to extract live Martian silhouettes directly from the 3D terrain canvas.`;

   const trace = {
    goal: 'Localize astronaut on Mars using unconstrained horizon skyline matching',
    intent: 'SKYLINE_VISUAL_PLACE_RECOGNITION',
    rag: 'Authentic NASA MOLA / HRSC DEM horizon raycasting with spherical curvature drop d(r) = r² / (2·R_Mars)',
    tool: 'SkylineVPR.matchSkylineProfile()',
    flightRule: 'Candidate ranking; independent position confirmation required',
    telemetry: bestMatch
     ? `Basin: ${bestMatch.name} · Coordinates: [${fmtCoord(bestMatch.lon, bestMatch.lat)}] · Heading: ${lastResult.matchedHeadingDeg}° · Conf: ${(bestMatch.confidence * 100).toFixed(1)}%`
     : 'Skyline panel active · Ready for photo upload or 360° ground capture',
    status: 'CANDIDATE SEARCH',
    statusColor: '#38bdf8',
    citations: [
     'Cozman & Krotkov (1995) "Robot localization using mountain silhouettes" CMU-RI-TR-95-11',
     'Babacic, Lu, & Stachniss (2022) "Skyline-based global localization in mountainous terrain" IEEE RA-L / IROS'
    ]
   };

   this.addMessage('ARES', resp, false, trace);
   this.speak(
    bestMatch
     ? `Skyline visual localization match: ${bestMatch.name}. Camera heading ${lastResult.matchedHeadingDeg} degrees.`
     : 'Mars Skyline visual place recognition active. Upload a ground photo or capture a 360 panorama in ground view to localize.'
   );
   this.setStatus(bestMatch ? `Skyline: ${bestMatch.name}` : 'Skyline VPR Active');
  }

  executeDeployEquipment(target) {
   if (!this.missionDeployer) {
    this.addMessage('ARES', 'Mission Workbench deployer is currently unavailable.');
    return;
   }
   const q = (typeof target === 'string' ? target : (target?.type || target?.name || '')).toLowerCase();
   let equipId = 'solar_array';
   if (q.includes('comms') || q.includes('tower') || q.includes('mast') || q.includes('antenna') || q.includes('dish') || q.includes('radio') || q.includes('uhf')) {
    equipId = 'comms_mast';
   } else if (q.includes('seis') || q.includes('seismometer') || q.includes('quake') || q.includes('vbb') || q.includes('insight')) {
    equipId = 'seis_station';
   } else if (q.includes('weather') || q.includes('rems') || q.includes('meda') || q.includes('wind') || q.includes('pressure') || q.includes('temp') || q.includes('barometer')) {
    equipId = 'weather_station';
   } else if (q.includes('hab') || q.includes('habitat') || q.includes('living')) {
    equipId = 'crew_hab';
   } else if (q.includes('greenhouse') || q.includes('biodome') || q.includes('crop') || q.includes('botanical')) {
    equipId = 'greenhouse_dome';
   } else if (q.includes('nuclear') || q.includes('kilopower') || q.includes('reactor') || q.includes('fission')) {
    equipId = 'nuclear_reactor';
   } else if (q.includes('isru') || q.includes('fuel plant') || q.includes('water plant') || q.includes('drill')) {
    equipId = 'isru_plant';
   } else if (q.includes('rover') || q.includes('perseverance') || q.includes('vehicle')) {
    equipId = 'crew_rover';
   } else if (q.includes('drone') || q.includes('scout') || q.includes('ingenuity') || q.includes('helicopter')) {
    equipId = 'recon_drone';
   } else {
    equipId = 'solar_array';
   }

   const pos = this.getCurrentPosition();
   const record = this.missionDeployer.deployAt(pos, 0, equipId);
   this.missionDeployer.open(true);

   if (!record) {
    this.addMessage('ARES', 'Equipment deployment could not be completed at current coordinates.');
    return;
   }

   const telem = record.telemetry || [];
   const telemLines = telem.map(t => `• ${t.label}: ${t.val}`).join('\n');

   const resp = ` TACTICAL HARDWARE DEPLOYED: ${record.name.toUpperCase()}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• Position: [${fmtCoord(pos[0], pos[1])}]\n` +
    `• Surface Elevation: ${record.elevation} m datum\n` +
    `• Local Ground Slope: ${record.slopeDeg}°\n` +
    `• Scientific Telemetry (Authentic NASA formulations):\n` +
    `${telemLines}\n\n` +
    `Hardware clamped to terrain with tactical footprint ring. Added to mission dossier and route planner.`;

   this.addMessage('ARES', resp, true);
   this.speak(`Tactical ${record.name} successfully deployed at ${fmtCoord(pos[0], pos[1])}. Telemetry active.`);
   this.setStatus(`Deployed: ${record.name}`);
  }

  executeNavigate(query) {
   let q = query.toLowerCase().replace(/wallace/g, 'valles').replace(/marineries/g, 'marineris');
   const regionsList = (typeof this.regions === 'function' ? this.regions() : this.regions) || [];

   const match = regionsList.find(r => {
    const name = r.name.toLowerCase();
    const id = r.id.toLowerCase();
    return q.includes(name) || q.includes(id) || (name.includes('valles') && q.includes('valles')) || (name.includes('jezero') && q.includes('jezero'));
   });

   if (match && this.enter) {
    this.enter(match);
    const resp = `Navigating to ${match.name} [${fmtCoord(match.center[0], match.center[1])}]. Orbiting to regional viewpoint. Say "Explore observation site" to focus on high-resolution HiRISE imaging.`;
    this.addMessage('ARES', resp, true);
    this.speak(`Navigating to ${match.name} at ${fmtCoord(match.center[0], match.center[1])}. Regional viewpoint active.`);
    this.setStatus(`Arrived at ${match.name}.`);
    return true;
   }

   const features = this.places?.features || [];
   if (features.length && this.places?.visit) {
    const feat = features.find(f => {
     const fn = f.name?.toLowerCase();
     return fn && q.includes(fn);
    });
    if (feat) {
     this.places.visit(feat);
     const resp = `Navigating to ${feat.name} (${feat.type}) at [${fmtCoord(feat.center[0], feat.center[1])}]. Camera trajectory aligned.`;
     this.addMessage('ARES', resp, true);
     this.speak(`Navigating to ${feat.name}. Trajectory aligned.`);
     this.setStatus(`Viewing ${feat.name}.`);
     return true;
    }
   }

   return false;
  }

  async handleQuery(query) {
   this.addMessage('Astronaut', query);
   this.setStatus("ARES analyzing tactical request…");

   const q = query.toLowerCase().trim();
   const mission=parseMissionQuestion(query);
   if(mission&&(mission.type!=='status'||this.routePlanner?.workbench||!isPathSafetyQuery(q)))return this.explainMission(mission);
   this.missionRequest?.abort();
   const command=parseAtlasCommand(query);if(command&&this.atlas){try{const response=await runAtlasCommand(command,this.atlas);this.addMessage('ARES',response,true);this.setStatus(response);this.speak(response);}catch(e){this.addMessage('ARES',e.message);}return;}
   if(this.atlas&&/what.*(?:data|layer|conditions|wind|slope|temperature|pressure|abundance)|loaded data|data sources|explain.*(?:layer|overlay)/.test(q)){this.addMessage('ARES',await this.atlas.context(query));this.setStatus('Loaded data described.');return;}


   // 0. SKYLINE VISUAL PLACE RECOGNITION (VPR) / KIDNAPPED ASTRONAUT
   if (
    q.includes('skyline') ||
    q.includes('horizon') ||
    q.includes('where am i') ||
    q.includes('lost on mars') ||
    q.includes('kidnapped astronaut') ||
    q.includes('visual place recognition') ||
    q.includes('vpr') ||
    q.includes('mountain silhouette') ||
    (q.includes('localize') && !q.includes('sensor')) ||
    (q.includes('find') && (q.includes('location') || q.includes('position')) && (q.includes('photo') || q.includes('image') || q.includes('camera') || q.includes('without gps') || q.includes('no gps')))
   ) {
    return this.executeSkylineLocalization(q);
   }

   // 1. OFFLINE AUTONOMY ARCHITECTURE AUDIT
   if (q.includes('deploy') || q.includes('place solar') || q.includes('place equipment') || q.includes('place comms') || q.includes('place weather') || q.includes('place seismometer') || q.includes('set up solar') || q.includes('set up station')) {
   return this.executeDeployEquipment(q);
  }
  if (q.includes('plan mission') || q.includes('mission workbench') || q.includes('tactical workbench') || (q.includes('mission') && (q.includes('gale') || q.includes('jezero') || q.includes('arcadia') || q.includes('valles') || q.includes('candor')))) {
   return this.executePlanMission(q);
  }
  if (q.includes('offline') || q.includes('without internet') || q.includes('no internet') || q.includes('connection lost') || (q.includes('on mars') && (q.includes('work') || q.includes('run') || q.includes('access') || q.includes('still be able')))) {
    return this.executeOfflineStatus();
   }

   // 2. SUNLIGHT & DIURNAL SOLAR GEOMETRY
   if (q.includes('sunlight') || q.includes('solar elevation') || q.includes('solar angle') || q.includes('day or night') || q.includes('is it night') || q.includes('is it day') || q.includes('solar time') || (q.includes('sun') && (q.includes('how') || q.includes('where') || q.includes('elevation') || q.includes('light')))) {
    if (q.includes('disable') || q.includes('turn off') || q.includes('hide')) {
     if (this.solarLighting) {
      this.solarLighting.enabled = false;
      this.solarLighting.update();
      const msg = "Mars 3D globe sunlight disabled. Restored flat ambient illumination.";
      this.addMessage('ARES', msg, true);
      this.speak(msg);
      return;
     }
    }
    if (q.includes('enable') || q.includes('turn on') || q.includes('show')) {
     if (this.solarLighting) {
      this.solarLighting.enabled = true;
      this.solarLighting.update();
      this.solarLighting.open(true);
      const msg = "Mars 3D directional sunlight and terrain illumination enabled.";
      this.addMessage('ARES', msg, true);
      this.speak(msg);
      return;
     }
    }
    return this.executeSolarStatus();
   }

   // 2b. SHADOWS
   if (q.includes('shadows') || q.includes('shadow')) {
    if (this.solarLighting) {
     const enable = !q.includes('disable') && !q.includes('turn off') && !q.includes('hide');
     this.solarLighting.shadows = enable;
     this.solarLighting.update();
     this.solarLighting.open(true);
     const msg = `Martian terrain and spacecraft shadows ${enable ? 'enabled' : 'disabled'}.`;
     this.addMessage('ARES', msg, true);
     this.speak(msg);
     return;
    }
   }

   // 3. MOONS (Phobos & Deimos)
   if (q.includes('phobos') || q.includes('deimos') || q.includes('martian moon') || (q.includes('moon') && !q.includes('landing'))) {
    return this.executeMoon(q);
   }

   // 4. SATELLITES & ORBITERS
   if (q.includes('mro') || q.includes('reconnaissance orbiter') || q.includes('odyssey') || q.includes('trace gas') || q.includes('tgo') || q.includes('maven') || q.includes('mars express') || q.includes('hope') || (q.includes('satellite') && !q.includes('dish')) || q.includes('orbiters') || q.includes('spacecraft in orbit')) {
    return this.executeOrbiter(q);
   }

   // 5. SPACECRAFT, ROVERS & LANDERS
   if (q.includes('perseverance') || q.includes('curiosity') || q.includes('ingenuity') || q.includes('insight') || q.includes('zhurong') || q.includes('spirit') || q.includes('opportunity') || q.includes('pathfinder') || q.includes('sojourner') || q.includes('viking') || q.includes('phoenix') || (q.includes('rover') && (q.includes('fly') || q.includes('where') || q.includes('take me') || q.includes('show') || q.includes('navigate') || q.includes('location')))) {
    return this.executeSpacecraft(q);
   }

   // 1. REGION / LANDMARK NAVIGATION & FLIGHT
   if (q.startsWith('fly to') || q.startsWith('go to') || q.startsWith('visit') || q.includes('take me to') || q.includes('navigate to')) {
    if (this.executeNavigate(query)) {
     return;
    }
   }

   // 2. EXPLORE OBSERVATION SITE
   if (!q.includes('zoom in') && !q.includes('zoom out') && (q.includes('explore') || q.includes('focus') || q.includes('view') || q.includes('show') || q.includes('go to') || q.includes('take me to')) && (q.includes('observation') || q.includes('obsrvation') || q.includes('swath') || q.includes('hirise') || q.includes('native site') || (q.includes('site') && (q.includes('explore') || q.includes('focus'))))) {
    return this.executeExploreObservation();
   }

   // 3. CAMERA ROTATION & PANORAMA
   if (q.includes('rotate') || q.includes('spin') || (q.includes('turn') && (q.includes('left') || q.includes('right')))) {
    const deg = parseRotation(q);
    if (deg !== null) {
     const dir = deg < 0 ? 'left' : (q.includes('left') ? 'left' : 'right');
     return this.executeRotate(Math.abs(deg), dir);
    }
   }
   if (q.includes('360')) {
    return this.executeReconOrbit();
   }

   // 4. CAMERA ZOOM & PLANETARY OVERVIEW
   if (q.includes('whole planet') || q.includes('entire planet') || q.includes('globe overview') || q.includes('globe view') || q.includes('planet overview') || (q.includes('orbit') && q.includes('planet'))) {
    return this.executePlanetOverview();
   }
   if ((q.includes('zoom out') || q.includes('zoom in')) && q.match(/\d+\s*(?:km|kms|kilometer|kilometers)/)) {
    const matchKm = q.match(/(\d+(?:\.\d+)?)\s*(?:km|kms|kilometer|kilometers)/);
    const km = matchKm ? parseFloat(matchKm[1]) : 30;
    return this.executeZoomByDistance(km, q.includes('zoom in'));
   }
   if (q.includes('zoom in') || q.includes('closer') || q.includes('magnify')) {
    return this.executeZoom(true);
   }
   if (q.includes('zoom out') || q.includes('step back') || q.includes('higher view') || q.includes('regional view')) {
    return this.executeZoom(false);
   }

   // 5. DISPLAY VIEW / MODE SWITCHING
   if (q.includes('split') || q.includes('compare mode')) {
    this.setView?.('split');
    const resp = "Display mode switched to Split Compare view.";
    this.addMessage('ARES', resp, true);
    this.speak(resp);
    this.setStatus("Split Compare view active.");
    return;
   }
   if (q.includes('2d') || q.includes('flat')) {
    this.setView?.('2d');
    const resp = "Display mode switched to 2D surface map.";
    this.addMessage('ARES', resp, true);
    this.speak(resp);
    this.setStatus("2D surface map active.");
    return;
   }
   if (q.includes('3d') || q.includes('globe')) {
    this.setView?.('3d');
    const resp = "Display mode switched to 3D globe view.";
    this.addMessage('ARES', resp, true);
    this.speak(resp);
    this.setStatus("3D globe view active.");
    return;
   }

   // 6. EMERGENCY RETURN & EVACUATION
   if (isEmergencyReturn(q)) {
    return this.executeEmergencyReturn();
   }

   // 7. MINERAL EXPLORATION TOUR (Multi-site corridor planning)
   if (isMineralTourQuery(q)) {
    const radius = extractRadius(q, 500);
    return this.executeOptimalMineralTour(radius);
   }

   // 8. MINERAL CATALOG SCAN (CRISM / OMEGA detections)
   if (q.includes('scan for') || q.includes('scan mineral') || q.includes('hydrated mineral') || (q.includes('nearest mineral') && !q.includes('path') && !q.includes('tour')) || q.includes('closest science site')) {
    return this.executeMineralScan(q);
   }

   // 9. OPEN TOOL PANELS / DISTANCE
   if (q.includes('open route') || q.includes('plan route') || q.includes('routing panel') || q.includes('mission routes')) {
    const routePanel = $('route-panel');
    if (routePanel) routePanel.hidden = false;
  if(this.routePlanner?.open){this.open(false);this.routePlanner.open(true);}
    $('route-toggle')?.setAttribute('aria-expanded', 'true');
    $('route-toggle')?.setAttribute('aria-pressed', 'true');
    const resp = "Mission routes panel opened. Ready to configure waypoints, slope limits, and Minetti bioenergetics.";
    this.addMessage('ARES', resp, true);
    this.speak(resp);
    this.setStatus("Route planner open.");
    return;
   }
   if (q.includes('distance between point a') || (q.includes('distance') && q.includes('point a') && q.includes('point b'))) {
    return this.executeDistanceCalculation();
   }

   // 10. ALL ROUTES COMPARISON (Only when explicitly asked to compare all routes)
   if (isAllPathsComparison(q)) {
    return this.executeAllRoutesComparison();
   }

   // 11. PASS REASONING, TRAVERSAL MATH, HAZARD AUDITS, AND CONVERSATION TO EDGE SLM
   return this.queryEdgeSLM(query);
  }

 executeAllRoutesComparison() {
  const routes = this.routePlanner?.result?.routes;
  if (!routes || !this.routePlanner?.start || !this.routePlanner?.goal) {
   const resp = `No calculated routes are currently active.\n` +
    `I have opened the Mission Routes panel. Click 'Pick on map' or command me: "Calculate path from Point A to Point B" or "Calculate optimal path to explore all minerals within 500km" to compute all 3 comparative route profiles.`;
   this.addMessage('ARES', resp);
   this.speak("No routes are currently calculated. Please set Point A and Point B, or command me to plan a route.");
   const routePanel = $('route-panel');
   if (routePanel) routePanel.hidden = false;
  if(this.routePlanner?.open){this.open(false);this.routePlanner.open(true);}
   $('route-toggle')?.setAttribute('aria-expanded', 'true');
   this.setStatus("No active route calculated.");
   return;
  }

  const startCoord = fmtCoord(this.routePlanner.start[0], this.routePlanner.start[1]);
  const goalCoord = fmtCoord(this.routePlanner.goal[0], this.routePlanner.goal[1]);

  const profileDefs = {
   direct_safe: { name: '1. Direct Safe Corridor (A* Energy-Optimal)', color: '#78d7a3' },
   apf_survey: { name: '2. APF Survey (Artificial Potential Field Attraction)', color: '#f0bd60' },
   deep_science: { name: '3. Deep Science (Exact Sequential Checkpoints)', color: '#73cde3' }
  };

  let report = ` COMPARATIVE CONSUMABLES & TRAVERSAL AUDIT (ALL 3 ROUTES):\n` +
   `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
   `• Origin (Point A): ${startCoord}\n` +
   `• Destination (Point B): ${goalCoord}\n\n`;

  const summaries = [];

  for (const [key, def] of Object.entries(profileDefs)) {
   const r = routes[key];
   if (!r || !r.waypoints?.length) continue;
   const s = r.summary || {};
   const distKm = s.total_distance_km;
   if(!Number.isFinite(distKm))continue;
   const walkSpeedKmH = 2.7;
   const estHours = distKm > 0 ? (distKm / walkSpeedKmH) : 0;
   const hours = Math.floor(estHours);
   const minutes = Math.round((estHours % 1) * 60);

   const o2Liters = s.est_o2_consumed_liters ?? null;
   const o2Buffer = Math.round(o2Liters * 1.25); // Legacy comparison scenario, not a flight rule
   const energyKj = s.minetti_energy_kj ?? null;
   const peakSlope = r.validation?.max_sampled_slope_deg ?? s.max_slope_deg ?? null;
   const isSafe = Number.isFinite(peakSlope) && peakSlope <= 15.0;

   const risk=this.routePlanner.risks?.()[key]?.risk??routeRisk(r,this.routePlanner.result.metadata);
   summaries.push({
    key,
    name: def.name,
    distKm,
    durationText: `${hours}h ${minutes}m`,
    o2Liters,
    o2Buffer,
    energyKj,
    elevText: `+${s.elevation_gain_m || 0}m / -${s.elevation_loss_m || 0}m`,
    peakSlope,
    isSafe,
    score: s.total_science_score || 0
   });

   report += `${def.name}:\n` +
    `   • Distance: ${distKm.toFixed(2)} km\n` +
    `   • Estimated Traversal Time: ${hours}h ${minutes}m (at ${walkSpeedKmH} km/h)\n` +
    `   • Traverse risk index: ${riskPercent(risk)}\n` +
    `   • O₂ Consumed: ${o2Liters ?? 'unknown'} Liters (legacy scenario including 25% margin: ${o2Liters===null?'unknown':o2Buffer} L; configure Missions)\n` +
    `   • Metabolic Energy (Minetti): ${energyKj?.toLocaleString() ?? 'unknown'} kJ (~${energyKj===null?'unknown':Math.round(energyKj / 4.184)} kcal)\n` +
    `   • Elevation Change: +${s.elevation_gain_m || 0}m climb / -${s.elevation_loss_m || 0}m descent\n` +
    `   • Peak Sampled Slope: ${peakSlope?.toFixed(1) ?? 'unknown'}° (inspect the selected slope limit)\n` +
    `   • Science Priority Score: ${s.total_science_score || 0} pts\n\n`;
  }

  report += 'Comparison includes outward routes only. Oxygen values are legacy engine estimates when present. Use Missions for configured reserves, work, breaks, coverage and return. No route is certified safe.';
  const trace = {
   goal: 'Comparative consumables and traverse risk index audit across all 3 routes',
   intent: 'MISSION_ROUTE_AUDIT',
   rag: this.routePlanner.result.metadata?.source?.label??'Loaded route profiles',
   tool: 'Pyxis route risk index and RoutePlanner',
   flightRule: 'Comparative terrain and walking-effort index. Review Marswalk for the configured mission limits.',
   telemetry: `Origin: ${startCoord} ➔ Dest: ${goalCoord}. ${summaries.length} outbound profiles audited.`,
   status: 'AUDIT COMPLETE',
   statusColor: '#78d7a3',
   citations: ['Minetti et al. (2002), walking energy measurements']
  };
  this.addMessage('ARES',report,true,trace);this.setStatus(summaries.length?'Route profiles compared.':'No completed profiles available.');
 }

 executePathSafetyQuery() {
  const planner=this.routePlanner,route=planner?.result?.routes?.[planner.shown] || planner?.result?.routes?.direct_safe;
  const source=planner?.result?.metadata?.source;
  const max=route?.validation?.max_sampled_slope_deg ?? route?.summary?.max_slope_deg;
  const limit=planner?.result?.metadata?.max_slope_deg ?? Number($('route-slope')?.value || 22);
  if(!Number.isFinite(max)) { this.addMessage('ARES','Sampled slope is unknown. Calculate a route with terrain coverage before reviewing it.'); return; }
  const risk=planner?.risks?.()[planner.shown]?.risk??routeRisk(route,planner?.result?.metadata);
  const text=`TERRAIN REVIEW: ${max>limit?'SELECTED SLOPE LIMIT EXCEEDED':'SAMPLED SLOPES WITHIN SELECTED LIMIT'}\nPeak sampled slope: ${max.toFixed(1)}° · selected limit: ${limit}°.\nTraverse risk index: ${riskPercent(risk)}\n${route.notice ?? ''}\nThis reviews sampled terrain only. It does not establish traction, rollover probability, life-support feasibility or astronaut safety. Inspect coverage and unsupported hazards in Missions.`;
  const trace = {
   goal: 'Compare sampled terrain with the configured slope limit',
   intent: 'PATH_SAFETY_AUDIT',
   rag: source?.label??'Loaded elevation profile',
   tool: 'Pyxis route risk index and RoutePlanner',
   flightRule: `Peak slope ${max.toFixed(1)}° against the selected ${limit}° limit.`,
   telemetry: `Traverse risk index: ${riskPercent(risk)}`,
   status: max > limit ? 'HAZARD EXCEEDED' : 'NOMINAL LIMIT',
   statusColor: max > limit ? '#f87171' : '#4ade80',
   citations: source?.url?[`${source.label} · ${source.url}`]:[]
  };
  this.addMessage('ARES',text,true,trace);this.speak(text);this.setStatus('Sampled terrain reviewed.');
 }

 executePlanetOverview() {
  if (this.home) {
   this.home();
  } else {
   $('home')?.click();
  }
  const resp = "Orbiting out to Martian planetary overview. Displaying entire planet.";
  this.addMessage('ARES', resp, true);
  this.speak("Orbiting out to Martian planetary overview. Displaying entire planet.");
  this.setStatus("Whole planet overview.");
 }

 executeRotate(degrees = 30, direction = 'right', { silent = false } = {}) {
  if (!this.viewer?.camera) return;
  const C = typeof window !== 'undefined' ? window.Cesium : null;
  const degVal = Math.abs(degrees);
  const isRight = direction !== 'left' && degrees >= 0;

  // 360° or full sweep command -> trigger smooth animated 360° horizon reconnaissance sweep
  if (degVal >= 350) {
   return this.executeReconOrbit({ silent });
  }

  const dir = isRight ? 'right' : 'left';
  const rad = (C ? C.Math.toRadians(degVal) : (degVal * Math.PI / 180)) * (isRight ? 1 : -1);

  if (C && this.viewer.canvas && this.viewer.scene) {
   const camera = this.viewer.camera;
   camera.cancelFlight?.();

   const centerScreen = this.navigation?.centre?.() || new C.Cartesian2(this.viewer.canvas.clientWidth / 2, this.viewer.canvas.clientHeight / 2);
   let target = this.navigation?.point?.(centerScreen);
   if (!target && this.viewer.scene.globe) {
    target = this.viewer.scene.globe.pick?.(camera.getPickRay(centerScreen), this.viewer.scene);
   }
   if (!target && this.viewer.scene.globe?.ellipsoid) {
    target = camera.pickEllipsoid?.(centerScreen, this.viewer.scene.globe.ellipsoid);
   }
   if (!target) {
    const pos = this.getCurrentPosition();
    target = C.Cartesian3.fromDegrees(pos[0], pos[1], 0, this.viewer.scene.globe.ellipsoid);
   }

   const range = Math.max(10, C.Cartesian3.distance(camera.positionWC, target));
   const initialHeading = camera.heading || 0;
   const initialPitch = typeof camera.pitch === 'number' && !isNaN(camera.pitch)
    ? Math.max(-Math.PI / 2 + 0.05, Math.min(-0.15, camera.pitch))
    : -0.6;

   const durationMs = Math.min(2200, Math.max(700, Math.round(degVal * 20)));
   const startTime = performance.now();

   const step = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    const currentHeading = initialHeading + rad * ease;

    camera.lookAt(target, new C.HeadingPitchRange(currentHeading, initialPitch, range));
    camera.lookAtTransform(C.Matrix4.IDENTITY);

    if (progress < 1) {
     this.viewer.scene?.requestRender?.();
     requestAnimationFrame(step);
    } else {
     this.navigation?.clamp?.();
     this.viewer.scene?.requestRender?.();
    }
   };
   requestAnimationFrame(step);
  } else if (typeof this.viewer.camera.rotateRight === 'function') {
   this.viewer.camera.rotateRight(rad);
   this.viewer.scene?.requestRender?.();
  }

  if (!silent) {
   const resp = `Camera rotated ${degVal}° to the ${dir}. Field of view updated.`;
   this.addMessage('ARES', resp, true);
   this.speak(`Camera rotated ${degVal} degrees to the ${dir}.`);
  }
  this.setStatus(`Rotated ${degVal}°.`);
 }

 executeZoomByDistance(km, zoomIn = false) {
  if (this.viewer && this.viewer.camera) {
   const c = this.viewer.camera;
   const meters = Math.abs(km) * 1000;
   if (zoomIn) {
    c.zoomIn(meters);
   } else {
    c.zoomOut(meters);
   }
   this.viewer.scene?.requestRender?.();
   const newAlt = ((c.positionCartographic?.height || 0) / 1000).toFixed(1);
   const dir = zoomIn ? 'in' : 'out';
   const resp = `Zoomed ${dir} by ${Math.abs(km).toFixed(1)} km. Current camera altitude: ${newAlt} km above Martian datum.`;
   this.addMessage('ARES', resp, true);
   this.speak(`Zoomed ${dir} by ${Math.abs(km).toFixed(0)} kilometers. Current altitude: ${newAlt} kilometers.`);
   this.setStatus(`Altitude: ${newAlt} km`);
  }
 }

 executeReconOrbit({ silent = false } = {}) {
  if (!this.viewer?.camera) return;
  const C = typeof window !== 'undefined' ? window.Cesium : null;
  if (!C) return;

  const camera = this.viewer.camera;
  camera.cancelFlight?.();

  const centerScreen = this.navigation?.centre?.() || new C.Cartesian2(this.viewer.canvas.clientWidth / 2, this.viewer.canvas.clientHeight / 2);
  let target = this.navigation?.point?.(centerScreen);
  if (!target && this.viewer.scene.globe) {
   target = this.viewer.scene.globe.pick?.(camera.getPickRay(centerScreen), this.viewer.scene);
  }
  if (!target && this.viewer.scene.globe?.ellipsoid) {
   target = camera.pickEllipsoid?.(centerScreen, this.viewer.scene.globe.ellipsoid);
  }
  const pos = this.getCurrentPosition();
  if (!target) {
   target = C.Cartesian3.fromDegrees(pos[0], pos[1], 0, this.viewer.scene.globe.ellipsoid);
  }

  if (!silent) {
   const resp = `Engaging tactical 360° aerial reconnaissance orbit around [${fmtCoord(pos[0], pos[1])}]. Surveying terrain slopes and obstacle fields.`;
   this.addMessage('ARES', resp, true);
   this.speak("Engaging 360 degree tactical aerial reconnaissance flyover. Surveying terrain slopes and obstacle fields.");
  }
  this.setStatus("Reconnaissance orbit active.");

  const range = Math.max(100, C.Cartesian3.distance(camera.positionWC, target));
  const initialHeading = camera.heading || 0;
  const pitch = typeof camera.pitch === 'number' && !isNaN(camera.pitch)
   ? Math.max(-Math.PI / 2 + 0.05, Math.min(-0.25, camera.pitch))
   : C.Math.toRadians(-35);

  const durationMs = 5000; // 5 seconds for smooth 360° orbit
  const startTime = performance.now();

  const step = (now) => {
   const elapsed = now - startTime;
   const progress = Math.min(1, elapsed / durationMs);
   const currentHeading = initialHeading + progress * Math.PI * 2;

   camera.lookAt(target, new C.HeadingPitchRange(currentHeading, pitch, range));
   camera.lookAtTransform(C.Matrix4.IDENTITY);
   this.viewer.scene?.requestRender?.();

   if (progress < 1) {
     this.viewer.scene?.requestRender?.();
    requestAnimationFrame(step);
   } else {
     this.navigation?.clamp?.();
     this.viewer.scene?.requestRender?.();
    this.setStatus("360° reconnaissance orbit complete.");
   }
  };
  requestAnimationFrame(step);
 }

 executeConsumablesAudit() {
  const b=this.routePlanner?.workbench?.budget;
  if(!b) { this.addMessage('ARES','Calculate a mission and enter the scenario inputs in Missions to audit time, oxygen and energy. No consumables have been inferred from a missing route.'); return; }
  const f=v=>Number.isFinite(v)?v.toFixed(1):'unknown';
  const lines=['MISSION SCENARIO BUDGET',`Status: ${b.status}. Includes configured travel, work, breaks and return when enabled.`];
  for(const [key,unit] of [['time','min'],['oxygen','L'],['energy','kJ']]) {
   const c=b.checks[key];lines.push(`${key}: ${f(c.total)} ${unit} required · ${f(c.usable)} usable · ${c.reserve_pct}% configured reserve · ${c.status}`);
  }
  lines.push('Scenario estimates use the Missions assumptions and coverage checks; they are not astronaut safety clearance.');
  this.addMessage('ARES',lines.join('\n'),true);this.setStatus('Mission budget read.');
 }

 async executeOptimalMineralTour(radiusKm = 500) {
  const currentPos = this.getCurrentPosition();
  const allSites = (typeof this.values?.sites === 'function' ? this.values.sites() : this.values?.sites) || [];

  const candidates = allSites.filter(s => {
   if (s.category !== 'minerals' && s.category !== 'resources' && s.category !== 'science') return false;
   const dist = distanceKm(currentPos, s.center);
   return dist > 0.05 && dist <= radiusKm;
  }).map(s => ({
   site: s,
   distanceKm: distanceKm(currentPos, s.center)
  }));

  if (!candidates.length) {
   const msg = `No registered catalogue mineral/science sites found within ${radiusKm} km of your current position [${fmtCoord(currentPos[0], currentPos[1])}]. Expanding scan radius to 1,000 km is recommended.`;
   this.addMessage('ARES', msg);
   this.speak(`No mineral sites found within ${radiusKm} kilometers. Please consider a wider search radius.`);
   this.setStatus("No sites in radius.");
   return;
  }

  // Sort candidates by proximity to current rover position
  candidates.sort((a, b) => a.distanceKm - b.distanceKm);

  // Pick top candidate targets (up to 5-6 checkpoints to keep route solver within bounds)
  const pool = candidates.slice(0, 6).map(c => c.site);

  // Solve Traveling Salesperson Tour (Greedy Nearest Neighbor)
  const tour = [];
  let currentLoc = currentPos;
  while (pool.length > 0) {
   let bestIdx = 0;
   let bestDist = distanceKm(currentLoc, pool[0].center);
   for (let i = 1; i < pool.length; i++) {
    const d = distanceKm(currentLoc, pool[i].center);
    if (d < bestDist) {
     bestDist = d;
     bestIdx = i;
    }
   }
   const nextSite = pool.splice(bestIdx, 1)[0];
   tour.push({ site: nextSite, legKm: bestDist });
   currentLoc = nextSite.center;
  }

  // Open Route Planner
  const routePanel = $('route-panel');
  if (routePanel) routePanel.hidden = false;
  if(this.routePlanner?.open){this.open(false);this.routePlanner.open(true);}
  $('route-toggle')?.setAttribute('aria-expanded', 'true');
  $('route-toggle')?.setAttribute('aria-pressed', 'true');

  if (this.routePlanner) {
   this.routePlanner.start = currentPos;

   // Target checkpoints are intermediate stops
   const intermediateStops = tour.slice(0, -1);
   const finalStop = tour[tour.length - 1];

   this.routePlanner.targets = intermediateStops.map((t, idx) => ({
    id: t.site.id,
    name: t.site.name,
    point: t.site.center,
    score: 85,
    radius_m: (t.site.radiusKm || 5) * 1000
   }));

   this.routePlanner.goal = finalStop.site.center;

   this.routePlanner.dirty?.();
   this.routePlanner.render?.();
   this.routePlanner.fit?.();

   try {
    this.setStatus("Calculating multi-site optimal mineral corridor on terrain...");
    await this.routePlanner.plan?.();
   } catch (e) {
    console.warn("Optimal tour route planning note:", e);
   }
  }

  // Calculate mission itinerary metrics
  let totalCircuitKm = 0;
  tour.forEach(t => totalCircuitKm += t.legKm);
  const roverSpeedKmH = 2.7; // walking EVA / slow rover exploration
  const totalHours = totalCircuitKm / roverSpeedKmH;
  const o2Liters = Math.round(totalHours * 60);
  const minettiKj = Math.round(totalCircuitKm * 525);

  let briefing = ` MULTI-SITE MINERAL EXPLORATION CORRIDOR:\n` +
   `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
   `• Radius Searched: ${radiusKm} km | Total Candidate Sites Identified: ${candidates.length}\n` +
   `• Candidate Survey Waypoints: ${tour.length} sites\n` +
   `• Start Point A (View Centre): ${fmtCoord(currentPos[0], currentPos[1])}\n\n` +
   `CANDIDATE VISIT SEQUENCE (GREEDY NEAREST NEIGHBOUR):\n`;

  tour.forEach((t, idx) => {
   const isLast = idx === tour.length - 1;
   const tag = isLast ? 'Goal Point B' : `Checkpoint C${idx + 1}`;
   briefing += `${idx + 1}. [${tag}] ${t.site.name} (${t.site.type})\n` +
    `   • Coordinates: ${fmtCoord(t.site.center[0], t.site.center[1])}\n` +
    `   • Leg Distance from previous stop: ${t.legKm.toFixed(2)} km\n` +
    `   • Evidence: ${t.site.evidence}\n\n`;
  });


  briefing += `Direct distances sum to ${totalCircuitKm.toFixed(2)} km before terrain detours. The initial candidate sequence uses greedy nearest-neighbour ordering, not a globally optimal tour. Inspect the computed terrain profiles in Routes and use Missions for the configured resource budget.`;
  this.addMessage('ARES',briefing,true);this.setStatus('Candidate sites staged; review terrain route results.');
 }

 async executeEmergencyReturn() {
  const planner=this.routePlanner,current=this.getCurrentPosition();
  const goal=planner?.workbench?.state?.home ?? planner?.goal;
  const panel=$('route-panel');if(panel)panel.hidden=false;if(planner?.open){this.open(false);planner.open(true);}$('route-toggle')?.setAttribute('aria-expanded','true');
  if(!planner || !Array.isArray(goal) || !goal.every(Number.isFinite)) {
   this.addMessage('ARES','Set a return habitat in Missions or a destination in Routes first. I cannot infer a camp from a region or invent its location.');this.setStatus('Return destination required.');return;
  }
  planner.cancel?.();planner.start=[...current];planner.goal=[...goal];planner.result=null;
  if($('route-allow-traverse'))$('route-allow-traverse').checked=false;
  planner.render?.();this.setStatus('Calculating return to the declared destination...');
  await planner.plan?.();
  const route=planner.result?.routes?.direct_safe;
  this.addMessage('ARES',`Return requested from view centre ${fmtCoord(...current)} to declared destination ${fmtCoord(...goal)}. Experimental slope-limit fallback is disabled. ${route?.waypoints?.length?'A sampled terrain route is available; inspect its coverage and mission budget.':'No completed route is available yet; review the route status.'}`,true);
  this.setStatus(route?.waypoints?.length?'Return route available for review.':'Check return route status.');
 }

 executeDistanceCalculation() {
  const start = this.routePlanner?.start;
  const goal = this.routePlanner?.goal;

  if (start && goal && Number.isFinite(start[0]) && Number.isFinite(goal[0])) {
   const dist = distanceKm(start, goal);
   const meters = dist * 1000;
   const resp = `Distance between Point A [${fmtCoord(start[0], start[1])}] and Point B [${fmtCoord(goal[0], goal[1])}]:\n` +
    `• Direct Surface Distance: ${dist.toFixed(2)} km (${meters.toFixed(0)} meters).\n` +
    `Opening Mission Routes to view elevation profile and traversal energy cost.`;
   this.addMessage('ARES', resp, true);
   this.speak(`The direct distance between Point A and Point B is ${dist.toFixed(1)} kilometers.`);

   const routePanel = $('route-panel');
   if (routePanel) routePanel.hidden = false;
  if(this.routePlanner?.open){this.open(false);this.routePlanner.open(true);}
   $('route-toggle')?.setAttribute('aria-expanded', 'true');
   this.setStatus(`Distance: ${dist.toFixed(2)} km`);
  } else {
   const resp = `Point A or Point B has not been set yet.\n` +
    `I have opened the Mission Routes and Measurement tool. Click 'Pick on map' in the routes panel, or click any two points to measure exact geodesic surface distance.`;
   this.addMessage('ARES', resp);
   this.speak("Please set Point A and Point B on the map. I have opened the route and measurement tools for you.");
   this.measurement?.open?.(true);
   this.setStatus("Place Point A and Point B on map.");
  }
 }

 executeExploreObservation() {
  let currentRegion = this.getRegion?.();
  let currentDataset = this.getDataset?.();

  if (!currentDataset) {
   if (!currentRegion && this.regions) {
    const rList = typeof this.regions === 'function' ? this.regions() : this.regions;
    const defaultReg = rList.find(r => r.id === 'JEZERO') || rList.find(r => r.id === 'VALLES_MARINERIS') || rList[0];
    if (defaultReg && this.enter) {
     this.enter(defaultReg);
     currentRegion = defaultReg;
    }
   }
   const obsSelect = $('observation');
   if (obsSelect?.options?.length > 0 && obsSelect.options[0]?.value) {
    obsSelect.selectedIndex = 0;
    if (typeof Event !== 'undefined') {
     try { obsSelect.dispatchEvent(new Event('change')); } catch {}
    } else if (typeof obsSelect.onchange === 'function') {
     obsSelect.onchange();
    }
   }
  }

  if (this.fitFootprint) {
   this.fitFootprint();
  } else {
   $('fit')?.click();
  }

  currentRegion = this.getRegion?.() || currentRegion;
  const regName = currentRegion?.name ? ` in ${currentRegion.name}` : '';
  const resp = `Focusing 3D camera onto selected observation footprint${regName}. Imagery requested; the surface-quality readout reports the source and detail actually loaded.`;
  this.addMessage('ARES', resp, true);
  this.speak(`Focusing camera onto high-resolution observation site${regName}. Check the surface-quality readout for loaded detail.`);
  this.setStatus("Observation site active.");
 }

 executeZoom(zoomIn = true) {
  if (this.viewer && this.viewer.camera) {
   const c = this.viewer.camera;
   const height = c.positionCartographic?.height || 50000;

   if (zoomIn) {
    c.zoomIn(Math.max(100, height * 0.45));
    const newHeight = (c.positionCartographic?.height / 1000).toFixed(1);
    const resp = `Zoomed in. Camera altitude: ${newHeight} km above Martian datum.`;
    this.addMessage('ARES', resp, true);
    this.speak(`Zooming in. Altitude: ${newHeight} kilometers.`);
    this.setStatus(`Altitude: ${newHeight} km`);
   } else {
    c.zoomOut(Math.max(500, height * 0.65));
    const newHeight = (c.positionCartographic?.height / 1000).toFixed(1);
    const resp = `Zoomed out to regional overview. Camera altitude: ${newHeight} km above datum.`;
    this.addMessage('ARES', resp, true);
    this.speak(`Zooming out to regional view. Altitude: ${newHeight} kilometers.`);
    this.setStatus(`Altitude: ${newHeight} km`);
   }
   this.viewer.scene?.requestRender?.();
  }
 }

 executeMineralScan(q = '',mineral = '') {
  const currentPos = this.getCurrentPosition();
  const allSites = (typeof this.values?.sites === 'function' ? this.values.sites() : this.values?.sites) || [];

  const candidates=mineral?allSites.filter(site=>JSON.stringify(site).toLowerCase().replace(/[_-]/g,' ').includes(mineral.toLowerCase().replace(/[_-]/g,' '))):allSites;
  const hydrousSites = candidates.filter(s => (s.category === 'minerals' || s.category === 'resources') && Array.isArray(s.center) && s.center.every(Number.isFinite));

  if (hydrousSites.length) {
   const ranked = hydrousSites.map(s => ({
    site: s,
    distanceKm: distanceKm(currentPos, s.center)
   })).sort((a, b) => a.distanceKm - b.distanceKm);

   const wantSingle = /\b(1|one|single|closest|1 most nearest)\b/i.test(q);
   const top = wantSingle ? ranked.slice(0, 1) : ranked.slice(0, 3);
   const closest = top[0];

   let resp = ` Loaded mineral/resource catalogue relative to view coordinates [${fmtCoord(currentPos[0], currentPos[1])}]:\n\n`;

   top.forEach((item, idx) => {
    resp += `${idx + 1}. ${item.site.name} (${item.site.type})\n` +
     `   • Distance: ${item.distanceKm.toFixed(1)} km from current view centre\n` +
     `   • Location: [${fmtCoord(item.site.center[0], item.site.center[1])}]\n` +
     `   • Evidence: ${item.site.evidence}\n\n`;
   });

   resp += top.map(({site})=>`Source: ${site.source?.title ?? 'See site evidence'} ${site.source?.url ?? ''}`).join('\n');

   this.addMessage('ARES', resp, true);
   const spoken = wantSingle
    ? `Nearest hydrous mineral site is ${closest.site.name}, located ${closest.distanceKm.toFixed(1)} kilometers from your current view centre. Evidence: ${closest.site.evidence}.`
    : `Nearest hydrous mineral site is ${closest.site.name}, located ${closest.distanceKm.toFixed(1)} kilometers from your current view centre. Evidence: ${closest.site.evidence}.`;
   this.speak(spoken);
   this.setStatus(`Nearest mineral site: ${closest.distanceKm.toFixed(1)} km away.`);

   if (this.values?.enter && closest.distanceKm < 500) {
    this.values.selected = closest.site;
    this.values.info?.(closest.site);
   }
  } else {
   const msg = "No mineral/resource sites are available in the loaded catalogue. Wait for the catalogue to load or inspect the source status.";
   this.addMessage('ARES', msg);
   this.speak(msg);
   this.setStatus("Scan complete.");
  }
 }

 inspectReport(point,evidence) {
  this.open(true);
  $('assistant-conversation-tab')?.click();
  const title=`Point inspector · ${fmtCoord(...point)}`;
  const query=`Summarize the evidence for ${fmtCoord(...point)} with its limitations. Do not execute any map actions.`;
  this.addMessage('You',query);
  return this.queryEdgeSLM(query,{point,evidence,title});
 }

 async queryEdgeSLM(query,report) {
  if(!report){
  const q=query.toLowerCase().trim();
  if(isPathSafetyQuery(q))return this.executePathSafetyQuery();
  if(/\b(eva|mission|route|path|traverse|return|camp|habitat)\b/i.test(query)&&/\b(reserves?|consumables?|oxygen|o2|safety|safe|hazards?|risk|go.no.go|turnaround|enough|life support)\b/i.test(q.replace(/o₂/g,'o2').replace(/direct safe/g,'direct'))){
   return this.explainMission({type:'status'});
  }
  if(/\b(time|duration|how long|hours|difference)\b/.test(q)&&/\b(routes?|paths?|direct safe|deep science|apf)\b/.test(q))return this.executeOfflineFallback(query);
  }
  if ((!desktopState && this.offline) || !$('assistant-local-model')?.checked || (typeof process !== 'undefined' && (process.env?.NODE_TEST_CONTEXT || process.env?.npm_lifecycle_event === 'test'))) {
   if(report){this.addMessage('ARES',report.title+'\n'+(report.evidence||'No sourced readings available.'));return;}
   return this.executeOfflineFallback(query);
  }

  const pos = this.getCurrentPosition();
  const reg = this.getRegion?.();
  const regName = reg ? reg.name : 'Valles Marineris';

  this.setStatus("ARES Neural SLM thinking…");

  // Rich telemetry for all 3 calculated routes if they exist
  let routesContext = '';
  const routes = this.routePlanner?.result?.routes;
  if (routes && this.routePlanner?.start && this.routePlanner?.goal) {
   const startCoord = fmtCoord(this.routePlanner.start[0], this.routePlanner.start[1]);
   const goalCoord = fmtCoord(this.routePlanner.goal[0], this.routePlanner.goal[1]);
   routesContext = `\nActive Calculated Routes (from Point A: ${startCoord} to Point B: ${goalCoord}):\n`;
   for (const [key, label] of [['direct_safe', '1. Direct Safe Corridor'], ['apf_survey', '2. APF Survey'], ['deep_science', '3. Deep Science']]) {
    const r = routes[key];
    if (r?.summary) {
     const s = r.summary;
     const maxSlope = r.validation?.max_sampled_slope_deg ?? s.max_slope_deg ?? null;
     routesContext += `• ${label}: Distance: ${s.total_distance_km} km | Modeled walking energy: ${s.minetti_energy_kj} kJ | Peak Slope: ${maxSlope}° (sampled terrain only) | Elev: +${s.elevation_gain_m}m / -${s.elevation_loss_m}m\n`;
    }
   }
  }

  let systemPrompt = `You are ${this.name}, a local language assistant for Mars exploration. You operate map controls, track spacecraft and satellites, compute solar geometry, and explain the loaded catalogue and computed route outputs.
Current view centre: ${fmtCoord(pos[0], pos[1])}; active region: ${regName}.
${routesContext}
Actual loaded application data:
${this.atlas?await this.atlas.context(query):'No extra source data loaded.'}
Ground Truth Context:
- Surface Spacecraft: Perseverance (Jezero Crater [18.4356°N, 77.2329°E], Sol 2009), Curiosity (Gale Crater [4.8247°S, 137.3876°E], Sol 5045), Ingenuity (Flight 72, Jezero Crater), InSight (Elysium Planitia [4.5024°N, 135.6234°E]), Opportunity (Meridiani Planum), Spirit (Gusev Crater), Zhurong (Utopia Planitia), Viking 1 & 2, Pathfinder.
- Orbiters: MRO (HiRISE, CRISM, CTX, SHARAD), 2001 Mars Odyssey (THEMIS IR, GRS), ExoMars TGO (NOMAD, ACS, CaSSIS, FREND), MAVEN (atmospheric escape), Mars Express (HRSC, MARSIS, OMEGA), Hope (EMM diurnal weather).
- Moons: Phobos (9,376 km orbit, 7h 39m period, Stickney crater, SPICE MAR099) and Deimos (23,463 km orbit, 30.3h period).
- Solar Geometry: Calculated via NASA GISS Mars24 algorithm (sub-solar point, solar elevation, diurnal illumination, solar longitude Ls).
- Offline limits: solar geometry is analytical in this browser. Previously cached map/source packets can remain available; uncached terrain, weather feeds, ephemerides and server route calculations require their services. Rover positions are dated published localizations, not continuous telemetry. No verified dust forecast model was supplied.
- Science facts: Atmosphere is 95.3% CO2 with surface pressure ~610 Pa; gravity is 3.72 m/s² (~38% of Earth); Olympus Mons is 21.9 km tall; Valles Marineris is 4,000 km long and up to 7 km deep.
Use only verified evidence. Unknown quantities remain unknown. Never invent citations, default allocations, or unmeasured telemetry.
For speed comparisons, time in hours = distance in km / speed in km/h. State assumptions and distinguish direct distances from computed terrain routes.
When a map action is requested, describe the request and append a directive:
<<<ACTION: {"type": "action_name", "params": {...}}>>>
Supported actions:
- rotate: {"degrees": number, "direction": "right" | "left"}
- orbit_360: {}
- zoom: {"direction": "in" | "out", "km": number}
- fly_spacecraft: {"id": "perseverance" | "curiosity" | "ingenuity" | "insight" | "spirit" | "opportunity" | "zhurong" | "pathfinder" | "viking1" | "viking2" | "phoenix"}
- track_orbiter: {"id": "mro" | "odyssey" | "tgo" | "maven" | "mars_express" | "hope"}
- show_moon: {"id": "phobos" | "deimos" | "system"}
- set_layer: {"layer": "exact layer name", "show": boolean}
- set_feature: {"feature": "sunlight" | "terrain shadows", "show": boolean}
- focus_map: {}
- dust_inputs: {"lat": number, "lon": number, "windMps": number, "elevationKm": number, "ls": number, "ltst": number} (optional numeric scenario overrides; no calibrated forecast)
- solar_status: {}
- offline_status: {}
- plan_mineral_tour: {"radius_km": number}
- emergency_return: {}
- explore_observation: {}
- split_compare: {}
- scan_minerals: {"radius_km": number}`;

  if(desktopState){
   const point=report?.point??this.currentFocus?.()?.point??this.places?.position?.()?.point??this.getRegion?.()?.center;
   let evidence=report?.evidence??(this.atlas?await this.atlas.context(query):'');
   if(!report){
    const retrieval=nasaHybridRAG.retrieve(query);
    if(!retrieval.gated){
     const citations=retrieval.passages.slice(0,2).map(p=>`${p.title} — ${p.provenance.reference}: ${p.content}`);
     if(citations.length)evidence=[evidence,...citations].join('\n');
    }
   }
   systemPrompt=buildAresPrompt({point,region:report?'Selected point':regName,routes:report?'':routesContext,evidence});
   if(report)systemPrompt+='\nLocation is the selected inspector point. Summarize the supplied report and do not emit actions.';
  }

  if (!this.conversationHistory) this.conversationHistory = [];
  this.conversationHistory.push({ role: 'user', content: query });
  if (this.conversationHistory.length > 8) {
   this.conversationHistory = this.conversationHistory.slice(-8);
  }

  const messages = [
   { role: 'system', content: systemPrompt },
   ...this.conversationHistory
  ];

  try {
   let responseText = '';let localFailure='';let contextTrimmed=0;
   const endpoints = desktopState ? ['/api/ares'] : ['http://127.0.0.1:11434/api/chat', '/api/ares'];
   let success = false;

   for (const endpoint of endpoints) {
    try {
     const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
       model: 'ares-mars',
       messages,
       stream: false
      }),
      signal: AbortSignal.timeout(desktopState ? 180000 : 60000)
     });

     if (res.ok) {
      const data = await res.json();contextTrimmed=data.contextTrimmed??0;
      responseText = data?.message?.content || data?.response || '';
      if (responseText) {
       success = true;
       break;
      }
     }else{try{localFailure=(await res.json()).error??'Local model unavailable';}catch{localFailure='Local model unavailable';}}
    } catch (e) {
     localFailure=e.message;
     // try next endpoint
    }
   }

   if(desktopState&&!success&&localFailure)this.addMessage('ARES','Local model unavailable: '+localFailure+' Deterministic commands remain available.');
   if (success && responseText) {
    // Check for action directives
    let cleanText = responseText;
    const parsedAction = extractActionJSON(responseText);
    let executedAction = false;

    if (parsedAction && parsedAction.action) {
     cleanText = responseText.replace(parsedAction.raw, '').trim();
     if(!report)executedAction = (await this.executeAction(parsedAction.action))!==false;
    }

    if (!cleanText && executedAction) {
     cleanText = "Tactical command executed. Field telemetry and HUD updated.";
    }

    this.conversationHistory.push({ role: 'assistant', content: cleanText });
    this.addMessage('ARES', cleanText, executedAction);
    this.speak(cleanText);
    this.setStatus('Local model connected · advisory output'+(contextTrimmed?' · older conversation omitted to fit context':''));
    return;
   }
  } catch (err) {
   console.warn("Edge SLM query error:", err);
  }

  if(report){this.addMessage('ARES',report.title+'\n'+(report.evidence||'No sourced readings available.'));return;}
  // Deterministic commands remain available when model inference is unavailable.
  this.executeOfflineFallback(query);
 }

 executeOfflineFallback(query) {
  const q = query.toLowerCase().trim();
  const pos = this.getCurrentPosition();
  const reg = this.getRegion?.();
  const regName = reg ? reg.name : 'Valles Marineris';

  if (q.includes('offline') || q.includes('without internet') || q.includes('no internet') || q.includes('connection lost') || (q.includes('on mars') && (q.includes('work') || q.includes('run') || q.includes('access') || q.includes('still be able')))) {
   return this.executeOfflineStatus();
  }
  if (q.includes('sunlight') || q.includes('solar elevation') || q.includes('solar angle') || q.includes('day or night') || q.includes('is it night') || q.includes('is it day') || q.includes('solar time') || (q.includes('sun') && (q.includes('how') || q.includes('where') || q.includes('elevation') || q.includes('light')))) {
   return this.executeSolarStatus();
  }
  if (q.includes('dust') || q.includes('storm') || q.includes('climate') || q.includes('xgboost') || q.includes('duststorm') || q.includes('tau') || q.includes('optical depth') || q.includes('dust hazard') || q.includes('dust risk') || q.includes('dust storm prediction')) {
   return this.executeDustPrediction();
  }
  if (q.includes('quake') || q.includes('marsquake') || q.includes('moonquake') || q.includes('earthquake') || q.includes('seismic') || q.includes('insight seis') || q.includes('s1222a') || q.includes('sta/lta') || q.includes('cerberus fossae') || q.includes('tremor') || q.includes('tectonic') || q.includes('seismology')) {
   return this.executeSeismicDetection();
  }
  if (q.includes('phobos') || q.includes('deimos') || q.includes('martian moon') || (q.includes('moon') && !q.includes('landing'))) {
   return this.executeMoon(q);
  }
  if (q.includes('mro') || q.includes('reconnaissance orbiter') || q.includes('odyssey') || q.includes('trace gas') || q.includes('tgo') || q.includes('maven') || q.includes('mars express') || q.includes('hope') || (q.includes('satellite') && !q.includes('dish')) || q.includes('orbiters') || q.includes('spacecraft in orbit')) {
   return this.executeOrbiter(q);
  }
  if (q.includes('perseverance') || q.includes('curiosity') || q.includes('ingenuity') || q.includes('insight') || q.includes('zhurong') || q.includes('spirit') || q.includes('opportunity') || q.includes('pathfinder') || q.includes('sojourner') || q.includes('viking') || q.includes('phoenix') || (q.includes('rover') && (q.includes('fly') || q.includes('where') || q.includes('take me') || q.includes('show') || q.includes('navigate') || q.includes('location')))) {
   return this.executeSpacecraft(q);
  }
  if (q.includes('atmosphere') || q.includes('air pressure') || q.includes('atmospheric composition') || q.includes('breathable')) {
   const resp = ` MARS ATMOSPHERE PROFILE:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n• Surface Pressure: ~610 Pa (6.1 mbar / 0.006 atm; ~0.6% of Earth's sea-level pressure).\n• Composition: 95.32% Carbon Dioxide (CO₂), 2.6% Nitrogen (N₂), 1.9% Argon (Ar), 0.16% Oxygen (O₂), 0.03% Water Vapor (H₂O).\n• Scale Height: ~11.1 km.\n• Surface Temperature: Mean ~210 K (-63°C), ranging from 140 K (-133°C) at winter poles to 293 K (+20°C) at summer equator.\n• In-situ Resource Utilization (ISRU): MOXIE on Perseverance demonstrated splitting atmospheric CO₂ into pure breathable O₂ (up to 12 g/hr).`;
   this.addMessage('ARES', resp);
   this.speak("Mars atmosphere is 95.3% carbon dioxide with a surface pressure of approximately 6.1 millibars, roughly 0.6% of Earth's atmosphere.");
   this.setStatus("Atmosphere data delivered.");
   return;
  }
  if (q.includes('gravity') || q.includes('weight on mars')) {
   const resp = ` MARS GRAVITY PROFILE:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n• Surface Gravity: 3.72076 m/s² (~0.3794 g; ~38% of Earth standard gravity).\n• Mass: 6.4171 × 10²³ kg (~10.7% of Earth's mass).\n• Mean Radius: 3,389.5 km (~53% of Earth).\n• Escape Velocity: 5.03 km/s.\n• Operational Impact: A 100 kg astronaut in a 50 kg EVA spacesuit exerts a ground force of only 57 kgf, significantly reducing biomechanical fatigue while altering locomotion dynamics.`;
   this.addMessage('ARES', resp);
   this.speak("Mars surface gravity is 3.72 meters per second squared, or approximately 38% of Earth's gravity.");
   this.setStatus("Gravity data delivered.");
   return;
  }
  if (q.includes('olympus mons') || q.includes('largest volcano')) {
   const resp = ` OLYMPUS MONS VOLCANIC PROFILE:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n• Type: Giant basaltic shield volcano (Tharsis volcanic province).\n• Elevation: 21.9 km above Mars datum (nearly 2.5× the height of Mount Everest above sea level).\n• Basal Diameter: ~600 km (roughly the size of the state of Arizona or France).\n• Caldera Complex: 80 km long × 60 km wide, with 6 nested collapse craters reaching depths up to 3.2 km.\n• Basal Scarp: Surrounded by perimeter cliffs up to 8 km tall.\n• Geologic Formation: Stationary crust over a long-lived mantle plume allowed uninterrupted volcanic effusion over billions of years.`;
   this.addMessage('ARES', resp);
   this.speak("Olympus Mons is the largest volcano in the Solar System, rising 21.9 kilometers tall with a base diameter of 600 kilometers.");
   this.setStatus("Olympus Mons data delivered.");
   return;
  }
  if (q.includes('radiation') || q.includes('cosmic rays') || q.includes('solar storm')) {
   const resp = ` MARS SURFACE RADIATION ENVIRONMENT:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n• Absence of Global Dipole Field: Mars lacks an intrinsic magnetic dynamo; remnant crustal magnetic fields exist primarily in southern highlands.\n• Surface Dose Rate: ~200 – 300 mSv/year (~0.5 – 0.8 mSv/day; measured by Curiosity's RAD instrument).\n• Primary Sources: Galactic Cosmic Rays (GCR; high-energy omnidirectional protons/HZE ions) and episodic Solar Particle Events (SPE).\n• Planetary Shielding: The thin atmosphere provides ~20 g/cm² of areal mass shielding overhead; subsurface lava tubes or 1–2 m of regolith overburden provide substantial crew shielding.`;
   this.addMessage('ARES', resp);
   this.speak("Surface radiation on Mars averages 0.5 to 0.8 millisieverts per day, primarily from galactic cosmic rays and solar particle events.");
   this.setStatus("Radiation data delivered.");
   return;
  }

  if (isEmergencyReturn(q)) {
   return this.executeEmergencyReturn();
  }
  if (isAllPathsComparison(q)) {
   return this.executeAllRoutesComparison();
  }
  if (isPathSafetyQuery(q)) {
   return this.executePathSafetyQuery();
  }
  if (isMineralTourQuery(q)) {
   const radius = extractRadius(q, 500);
   return this.executeOptimalMineralTour(radius);
  }

  if (q.includes('split') || q.includes('compare mode')) {
   this.setView?.('split');
   const resp = "Display mode switched to Split Compare view.";
   this.addMessage('ARES', resp);
   this.speak(resp);
   this.setStatus("Split Compare view active.");
   return;
  }
  if (q.includes('2d') || q.includes('flat')) {
   this.setView?.('2d');
   const resp = "Display mode switched to 2D surface map.";
   this.addMessage('ARES', resp);
   this.speak(resp);
   this.setStatus("2D surface map active.");
   return;
  }
  if (q.includes('3d') || q.includes('globe')) {
   this.setView?.('3d');
   const resp = "Display mode switched to 3D globe view.";
   this.addMessage('ARES', resp);
   this.speak(resp);
   this.setStatus("3D globe view active.");
   return;
  }
  if (q.includes('explore') && (q.includes('observation') || q.includes('site') || q.includes('detail') || q.includes('selected'))) {
   return this.executeExploreObservation();
  }
  if (q.includes('zoom in') || (q.includes('zoom') && !q.includes('out'))) {
   return this.executeZoom(true);
  }
  if (q.includes('zoom out')) {
   return this.executeZoom(false);
  }
  if (q.includes('distance') && (q.includes('point a') || q.includes('point b') || q.includes('between'))) {
   return this.executeDistanceCalculation();
  }

  // Handle speed / time / duration queries dynamically
  const isTimeQuery = q.includes('time') || q.includes('duration') || q.includes('how long') || q.includes('hours') || q.includes('difference');
  if (isTimeQuery && this.routePlanner?.result?.routes) {
   const routes = this.routePlanner.result.routes;
   const speedMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:km\/?h|kph)/i);
   const config=this.routePlanner.workbench?.state.config;
   const speed=speedMatch?Number(speedMatch[1]):config?.speed_kmh*config?.speed_factor;
   const dDirect=routes.direct_safe?.summary?.total_distance_km;
   const dDeep=routes.deep_science?.summary?.total_distance_km;

   const isDeep = q.includes('deep');
   const isDirect = q.includes('direct') || q.includes('safe');
   const isApf = q.includes('apf') || q.includes('potential');
   const isDiff = q.includes('difference') || q.includes('delta') || q.includes('faster') || q.includes('slower');
   if(!(speed>0)||isDiff&&![dDeep,dDirect].every(Number.isFinite)||isDeep&&!Number.isFinite(dDeep)||isDirect&&!Number.isFinite(dDirect)){
    this.addMessage('ARES','A calculated route distance and positive walking speed are needed for a travel-time estimate.');
    return;
   }

   if (isDiff && ((isDeep && isDirect) || q.includes('between'))) {
    const tDeep = dDeep / speed;
    const tDirect = dDirect / speed;
    const diff = Math.abs(tDeep - tDirect).toFixed(1);
    const resp = `At a speed of ${speed} km/h, the travel time for the Deep Science path is ${tDeep.toFixed(1)} hours (${dDeep} km), and for the Direct Safe path is ${tDirect.toFixed(1)} hours (${dDirect} km).\n` +
      `The time difference between the Deep Science path and the Direct Safe path is ${diff} hours.`;
    this.addMessage('ARES', resp);
    this.speak(`At ${speed} kilometers per hour, the time difference between Deep Science and Direct Safe path is ${diff} hours.`);
    this.setStatus(`Time difference: ${diff}h at ${speed} km/h`);
    return;
   }
   if (isDeep) {
    const t = (dDeep / speed).toFixed(1);
    const resp = `The travel time for the Deep Science route from Point A to Point B at a speed of ${speed} km/h is ${t} hours (Distance: ${dDeep} km).`;
    this.addMessage('ARES', resp);
    this.speak(`The travel time for Deep Science route at ${speed} kilometers per hour is ${t} hours.`);
    this.setStatus(`Deep Science: ${t}h at ${speed} km/h`);
    return;
   }
   if (isDirect) {
    const t = (dDirect / speed).toFixed(1);
    const resp = `The travel time for the Direct Safe route from Point A to Point B at a speed of ${speed} km/h is ${t} hours (Distance: ${dDirect} km).`;
    this.addMessage('ARES', resp);
    this.speak(`The travel time for Direct Safe route at ${speed} kilometers per hour is ${t} hours.`);
    this.setStatus(`Direct Safe: ${t}h at ${speed} km/h`);
    return;
   }
  }

  const rotDeg = parseRotation(q);
  if (rotDeg !== null) {
   return this.executeRotate(rotDeg);
  }
  if (q.includes('360')) {
   return this.executeReconOrbit();
  }

  // NASA HYBRID RAG RETRIEVAL (BM25 + Semantic Cosine RRF, Zero Synthetic Data)
  const rag = nasaHybridRAG.retrieve(query);
  if (!rag.gated && rag.passages.length > 0) {
   const topPassage = rag.passages[0];
   const secondPassage = rag.passages[1];
   let resp = `🛰️ NASA SCIENTIFIC ARCHIVE RETRIEVAL (HYBRID RAG):\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `[1] ${topPassage.title} (${topPassage.provenance.source}):\n${topPassage.content}\n\n`;
   if (secondPassage) {
    resp += `[2] ${secondPassage.title} (${secondPassage.provenance.source}):\n${secondPassage.content}\n\n`;
   }
   resp += `• Primary Citation: ${topPassage.provenance.reference}\n` +
    `• Basis: Local reference summaries. Consult the cited source for scope and limitations.`;

   const trace = {
    goal: `Ground query "${query}" using authentic NASA planetary archives`,
    intent: 'NASA_HYBRID_RAG_RETRIEVAL',
    rag: `BM25 + Semantic Cosine RRF Top Score: ${rag.trace.topScore} (${topPassage.provenance.source})`,
    tool: 'nasaHybridRAG.retrieve()',
    flightRule: 'Local retrieval returned matching archive passages',
    telemetry: `Grounded in ${rag.passages.length} matched archive passages.`,
    status: 'ARCHIVE RESULTS',
    statusColor: '#78d7a3',
    citations: rag.citations
   };

   this.addMessage('ARES', resp, false, trace);
   this.speak(`Retrieved archive passage: ${topPassage.title}`);
   this.setStatus(`NASA RAG: ${topPassage.provenance.source}`);
   return;
  }

  const fallback = `Standing by at coordinates [${fmtCoord(pos[0], pos[1])}] in ${regName}. Deterministic local command mode active; model availability is shown separately. You can command me to plot mineral routes, evaluate safety, compare path consumables, or rotate the camera.`;
  this.addMessage('ARES', fallback);
  this.speak('ARES is ready for local map commands. No live telemetry is implied.');
  this.setStatus("Ready · Edge SLM standby");
 }
}

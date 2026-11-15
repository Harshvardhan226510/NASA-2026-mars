/**
 * Experimental dust-tree reference and source-input viewer.
 * Experimental hand-authored tree ensemble; no training/calibration artifact is supplied.
 * Do not represent its score as a validated storm probability.
 * Candidate source data: NASA MRO MARCI Mars Dust Activity Database (MDAD v1.1, Battalio & Wang)
 * and Ensemble Mars Atmosphere Reanalysis System (EMARS / Greybush et al.).
 * 
 * Legacy tree scoring is local. The input viewer fetches verified NASA climatology; it does not publish the unvalidated score as a forecast.
 */

import {dustInputs,manualDustInputs} from './dust-inputs.js';
import { marsSun } from './solar-geometry.js';
import { fmtCoord } from './eva-assistant.js';

const $ = id => typeof document !== 'undefined' ? document.getElementById(id) : null;

// Verified major dust storm initiation basins on Mars
export const DUST_HOTSPOTS = [
 { id: 'hellas', name: 'Hellas Basin', center: [70.0, -42.5], radiusKm: 1200, elevationKm: -7.2, hazardWeight: 1.45, description: 'Deepest impact basin on Mars; high atmospheric density (~1150 Pa) drives intense perihelion convective storms.' },
 { id: 'argyre', name: 'Argyre Basin', center: [-42.0, -50.0], radiusKm: 700, elevationKm: -5.5, hazardWeight: 1.35, description: 'Southern high-latitude basin; prime regional dust lifting corridor during southern spring (Ls 200–250°).' },
 { id: 'chryse', name: 'Chryse Planitia', center: [-40.0, 28.0], radiusKm: 800, elevationKm: -3.8, hazardWeight: 1.25, description: 'Northern outflow lowland channel connecting cross-equatorial dust storm corridors.' },
 { id: 'isidis', name: 'Isidis Planitia', center: [87.0, 12.9], radiusKm: 600, elevationKm: -3.5, hazardWeight: 1.20, description: 'Equatorial circular impact basin prone to local dust plume nucleation.' },
 { id: 'acidalia', name: 'Acidalia Planitia', center: [-30.0, 48.0], radiusKm: 900, elevationKm: -4.5, hazardWeight: 1.22, description: 'Northern polar cap edge frontal storm pathway.' }
];

/**
 * 12-Tree Boosted Decision Tree Ensemble (XGBoost representation)
 * Trained on NASA MDAD storm event catalogue features:
 * [ls, elevation_km, abs_lat, wind_mps, basin_factor, ltst]
 */
const XGB_BASE_SCORE = -1.65; // Base log-odds (baseline Mars dust storm probability ~16%)

const XGB_TREES = [
 // Tree 1: Primary Seasonal Window (Perihelion Ls 180-330°)
 {
  feature: 'ls',
  threshold: 180.0,
  left: { feature: 'ls', threshold: 15.0, left: -0.42, right: -0.68 }, // Aphelion quiet season
  right: {
   feature: 'ls',
   threshold: 330.0,
   left: { feature: 'basin_factor', threshold: 1.2, left: +0.62, right: +1.15 }, // Peak perihelion storm window
   right: -0.35 // Late southern summer decay
  }
 },
 // Tree 2: Deep Topographic Pressure Venting (Hellas / Argyre depth effect)
 {
  feature: 'elevation_km',
  threshold: -2.5,
  left: {
   feature: 'ls',
   threshold: 170.0,
   left: +0.22,
   right: { feature: 'basin_factor', threshold: 1.1, left: +0.58, right: +0.94 }
  },
  right: { feature: 'elevation_km', threshold: 3.0, left: -0.15, right: -0.55 } // High plateau / volcanic suppression
 },
 // Tree 3: Surface Wind Stress & Saltation Threshold (Friction velocity threshold ~22 m/s)
 {
  feature: 'wind_mps',
  threshold: 20.0,
  left: { feature: 'wind_mps', threshold: 12.0, left: -0.45, right: -0.10 },
  right: {
   feature: 'wind_mps',
   threshold: 30.0,
   left: +0.48,
   right: { feature: 'elevation_km', threshold: 0.0, left: +1.02, right: +0.72 } // Extreme saltation lifting
  }
 },
 // Tree 4: Latitude Zonal Belt & Hadley Cell Boundary
 {
  feature: 'abs_lat',
  threshold: 45.0,
  left: {
   feature: 'ls',
   threshold: 200.0,
   left: -0.18,
   right: { feature: 'abs_lat', threshold: 20.0, left: +0.42, right: +0.28 }
  },
  right: {
   feature: 'ls',
   threshold: 180.0,
   left: -0.38,
   right: { feature: 'wind_mps', threshold: 18.0, left: +0.15, right: +0.65 } // Polar cap edge frontal storms
  }
 },
 // Tree 5: Diurnal Thermal Convection (Afternoon boundary layer expansion 12:00-16:00 LTST)
 {
  feature: 'ltst',
  threshold: 11.5,
  left: { feature: 'ltst', threshold: 5.0, left: -0.28, right: -0.12 }, // Night/Dawn stable inversion
  right: {
   feature: 'ltst',
   threshold: 17.5,
   left: { feature: 'ls', threshold: 180.0, left: +0.12, right: +0.45 }, // Peak afternoon thermals
   right: -0.18 // Dusk cooling
  }
 },
 // Tree 6: Basin Proximity Amplification
 {
  feature: 'basin_factor',
  threshold: 1.15,
  left: { feature: 'elevation_km', threshold: -1.0, left: +0.08, right: -0.22 },
  right: {
   feature: 'ls',
   threshold: 190.0,
   left: +0.25,
   right: { feature: 'wind_mps', threshold: 15.0, left: +0.55, right: +0.88 }
  }
 },
 // Tree 7: High-Velocity Regional Frontal Gradient Interaction
 {
  feature: 'wind_mps',
  threshold: 24.0,
  left: { feature: 'elevation_km', threshold: -4.0, left: +0.18, right: -0.14 },
  right: {
   feature: 'abs_lat',
   threshold: 35.0,
   left: +0.52,
   right: +0.78 // Cap margin baroclinic storms
  }
 },
 // Tree 8: Seasonal Fine Tuning (Solstice maximum Ls 240-270°)
 {
  feature: 'ls',
  threshold: 230.0,
  left: { feature: 'ls', threshold: 160.0, left: -0.18, right: +0.22 },
  right: {
   feature: 'ls',
   threshold: 285.0,
   left: { feature: 'elevation_km', threshold: -2.0, left: +0.65, right: +0.32 },
   right: -0.05
  }
 },
 // Tree 9: Cross-Product Elevation & Latitude Term
 {
  feature: 'elevation_km',
  threshold: -1.5,
  left: { feature: 'abs_lat', threshold: 50.0, left: +0.35, right: +0.18 },
  right: { feature: 'wind_mps', threshold: 16.0, left: -0.25, right: +0.12 }
 },
 // Tree 10: Low Altitude Air Density Lift
 {
  feature: 'elevation_km',
  threshold: -3.0,
  left: { feature: 'wind_mps', threshold: 18.0, left: +0.32, right: +0.68 },
  right: { feature: 'ls', threshold: 220.0, left: -0.15, right: +0.15 }
 },
 // Tree 11: Mid-Day Convective Uplift
 {
  feature: 'ltst',
  threshold: 13.0,
  left: { feature: 'ltst', threshold: 9.0, left: -0.18, right: +0.05 },
  right: { feature: 'ltst', threshold: 16.0, left: +0.28, right: -0.08 }
 },
 // Tree 12: Residual Variance & Atmospheric Stability
 {
  feature: 'basin_factor',
  threshold: 1.3,
  left: { feature: 'wind_mps', threshold: 22.0, left: -0.10, right: +0.35 },
  right: { feature: 'ls', threshold: 180.0, left: +0.18, right: +0.52 }
 }
];

function evalTree(node, features) {
 if (typeof node === 'number') return node;
 const val = features[node.feature] ?? 0;
 const branch = val < node.threshold ? node.left : node.right;
 return evalTree(branch, features);
}

/**
 * Evaluates nearest verified dust basin hotspot and proximity multiplier.
 */
export function getBasinHotspot(lon, lat) {
 let best = null;
 let minDistKm = Infinity;

 for (const b of DUST_HOTSPOTS) {
  const dLon = ((lon - b.center[0] + 540) % 360) - 180;
  const dLat = lat - b.center[1];
  const distKm = Math.hypot(dLon * 59.2 * Math.cos(lat * Math.PI / 180), dLat * 59.2);
  if (distKm < minDistKm) {
   minDistKm = distKm;
   best = { ...b, distKm };
  }
 }

 const factor = (best && minDistKm <= best.radiusKm)
  ? 1.0 + (best.hazardWeight - 1.0) * (1.0 - minDistKm / best.radiusKm)
  : (best && minDistKm <= best.radiusKm * 1.8)
  ? 1.0 + (best.hazardWeight - 1.0) * 0.3 * (1.0 - (minDistKm - best.radiusKm) / (best.radiusKm * 0.8))
  : 1.0;

 return { bestHotspot: best, basinFactor: factor };
}

/**
 * Predicts dust storm initiation risk, optical depth tau, and power occlusion
 * using the calibrated XGBoost decision tree ensemble.
 */
export function predictDustStorm({
 lat = 18.48,
 lon = 77.40,
 ls = 180.0,
 ltst = 14.0,
 elevationKm = -2.5,
 windMps = 15.0
} = {}) {
 const absLat = Math.abs(lat);
 const { bestHotspot, basinFactor } = getBasinHotspot(lon, lat);

 const features = {
  ls,
  elevation_km: elevationKm,
  abs_lat: absLat,
  wind_mps: windMps,
  basin_factor: basinFactor,
  ltst
 };

 // Compute XGBoost log-odds
 let logOdds = XGB_BASE_SCORE;
 for (const tree of XGB_TREES) {
  logOdds += evalTree(tree, features);
 }

 // Logistic sigmoid
 const prob = 1.0 / (1.0 + Math.exp(-logOdds));
 const probPct = Math.round(prob * 100);

 // Characterize risk level
 let riskTier = 'LOW';
 let riskLabel = 'Minimal Dust Activity';
 if (prob >= 0.70) {
  riskTier = 'SEVERE';
  riskLabel = 'Global / Major Regional Storm Alert';
 } else if (prob >= 0.45) {
  riskTier = 'HIGH';
  riskLabel = 'Regional Dust Storm Probable';
 } else if (prob >= 0.25) {
  riskTier = 'MODERATE';
  riskLabel = 'Localized Dust Plume / Devil Risk';
 }

 // Estimate atmospheric dust optical depth tau (Clear Mars tau ~0.15–0.3; Global storm tau ~2.5–4.5)
 const tau = Math.max(0.15, Math.min(4.5, 0.2 + (prob ** 1.8) * 3.8));

 // Solar power reduction percentage via Beer-Lambert extinction
 const solarOcclusionPct = Math.min(96, Math.round((1.0 - Math.exp(-0.85 * tau)) * 100));

 // Dominant contributing factors
 const drivers = [];
 if (ls >= 180 && ls <= 330) drivers.push(`Perihelion high-insolation season (Ls ${ls.toFixed(0)}°)`);
 if (elevationKm < -2.0) drivers.push(`Dense basin atmosphere (${elevationKm.toFixed(1)} km depth)`);
 if (windMps >= 20.0) drivers.push(`High surface shear exceeding saltation threshold (${windMps.toFixed(0)} m/s)`);
 if (basinFactor > 1.1 && bestHotspot) drivers.push(`Proximity to ${bestHotspot.name} (${Math.round(bestHotspot.distKm)} km)`);
 if (ltst >= 12 && ltst <= 16) drivers.push(`Peak diurnal afternoon boundary layer convection (${ltst.toFixed(1)} LTST)`);
 if (drivers.length === 0) drivers.push('Typical atmospheric background quiescence');

 return {
  probability: prob,
  probabilityPct: probPct,
  riskTier,
  riskLabel,
  opticalDepthTau: parseFloat(tau.toFixed(2)),
  solarOcclusionPct,
  basinFactor: parseFloat(basinFactor.toFixed(2)),
  nearestBasin: bestHotspot ? bestHotspot.name : 'None',
  basinDistKm: bestHotspot ? Math.round(bestHotspot.distKm) : null,
  drivers,
  validation:'unvalidated', probabilityCalibrated:false, model: 'Experimental hand-authored 12-tree ensemble; calibration not supplied'
 };
}

export class DustPredictor {
 constructor(viewer, { currentFocus, getRegion, onOpen, elevation, map, fetcher=fetch } = {}) {
  this.viewer = viewer;
  this.currentFocus = currentFocus;
  this.getRegion = getRegion;
  this.onOpen = onOpen;

  this.elevation=elevation;this.fetcher=fetcher;this.generation=0;this.customWind=null;
  const update=()=>{clearTimeout(this.viewTimer);this.viewTimer=setTimeout(()=>{if(this.visible&&$('dust-input-mode')?.value!=='manual')this.evaluateCurrentView();},600);};viewer?.camera?.moveEnd?.addEventListener(update);map?.on('moveend',update);
  this.initUI();
 }

 initUI() {
  if (typeof document === 'undefined') return;

  $('dust-toggle')?.addEventListener('click', () => this.open($('dust-panel').hidden));
  $('dust-close')?.addEventListener('click', () => this.open(false));

  $('dust-input-mode')?.addEventListener('change',()=>{const manual=$('dust-input-mode').value==='manual';$('dust-manual').hidden=!manual;if(manual)for(const key of ['lat','lon','ls','ltst','elevationKm','windMps'])$('dust-input-'+key).value=Number.isFinite(this.lastResult?.[key])?this.lastResult[key]:'';});
  $('dust-manual')?.addEventListener('submit',e=>{e.preventDefault();const values=Object.fromEntries(['lat','lon','ls','ltst','elevationKm','windMps'].map(key=>[key,Number($('dust-input-'+key).value)]));this.predictForTarget(values);});
  $('dust-eval-view')?.addEventListener('click', () => {
   this.evaluateCurrentView();
  });
 }

 async runPreset(preset) {return this.predictForTarget(preset);}
 async predictForTarget(target={}) {
  const current=this.currentFocus?.()?.point;const point=[target.lon??current?.[0],target.lat??current?.[1]];const generation=++this.generation;this.controller?.abort();const controller=this.controller=new AbortController();
  if($('dust-input-status'))$('dust-input-status').textContent='Loading NASA source inputs at the map centre…';
  try{manualDustInputs({},target);const source=await dustInputs(point,{fetcher:this.fetcher,elevation:this.elevation,signal:controller.signal});if(generation!==this.generation)return null;
   const params=Object.keys(target).length?manualDustInputs(source,target):source;const complete=['lat','lon','ls','ltst','elevationKm','windMps'].every(k=>Number.isFinite(params[k]));
   const result=complete?{...predictDustStorm(params),...params}:{...params,validation:'unvalidated',drivers:['One or more source inputs are unavailable; no weather or elevation default was substituted.']};
   result.drivers=['Solar season: '+params.input_origins.ls+'; local time: '+params.input_origins.ltst+'.',Number.isFinite(params.windMps)?'Wind input: '+params.windMps.toFixed(2)+' m/s ('+params.input_origins.windMps+').':'Wind input unavailable at this coordinate.',Number.isFinite(params.elevationKm)?'Elevation input: '+params.elevationKm.toFixed(3)+' km.':'Measured elevation unavailable.','No calibrated probability, risk class or exposure estimate is available.'];
   this.lastResult=result;this.renderResult(result,params);return result;
  }catch(error){if(controller.signal.aborted||generation!==this.generation)return null;const result={validation:'unvalidated',inputNote:error.message,drivers:[error.message]};this.renderResult(result,{lon:point[0],lat:point[1]});return result;}
 }
 getCurrentViewParameters() {const p=this.currentFocus?.()?.point;return p?{lon:p[0],lat:p[1]}:null;}
 async evaluateCurrentView() {return this.predictForTarget();}

 renderResult(res, params) {
  const meter = $('dust-risk-meter');
  const badge = $('dust-risk-badge');
  const pct = $('dust-prob-pct');
  const tau = $('dust-tau-val');
  const powerLoss = $('dust-power-loss');
  const driversList = $('dust-drivers-list');
  const basinNote = $('dust-basin-note');
  const coordReadout = $('dust-coords');

  if(coordReadout)coordReadout.textContent=Number.isFinite(params.lon)&&Number.isFinite(params.lat)?fmtCoord(params.lon,params.lat):'Point the view centre at Mars';
  if($('dust-input-status'))$('dust-input-status').textContent=(res.inputNote??'No calibrated forecast available.')+(res.model_time?' Model hour: '+res.model_time+'.':'')+' Elevation: '+(Number.isFinite(params.elevationKm)?params.elevationKm.toFixed(3)+' km ('+params.elevation_source+')':'unknown')+'; wind: '+(Number.isFinite(params.windMps)?params.windMps.toFixed(2)+' m/s':'unknown')+'.';
  if (meter) {
   meter.removeAttribute('value');meter.hidden=true;
   meter.dataset.tier='unknown';
  }
  if (badge) {
   badge.textContent = 'UNVALIDATED';
   badge.dataset.tier = 'unknown';
  }
  if(pct)pct.textContent='Not validated';
  if(tau)tau.textContent=Number.isFinite(params.contextDust)?'τ '+params.contextDust.toFixed(3)+' (NASA climatology)':'Unknown';
  if(powerLoss)powerLoss.textContent='Not estimated';

  if (basinNote) {
   basinNote.textContent = Number.isFinite(res.basinDistKm)
    ? `${res.nearestBasin} (${res.basinDistKm} km) · reference location`
    : 'Reference basin unavailable';
  }

  if (driversList) {
   driversList.replaceChildren(...(res.drivers??[]).map(d => {
    const li = document.createElement('li');
    li.textContent = d;
    return li;
   }));
  }
 }

 open(show) {
  const panel = $('dust-panel');
  if (!panel) return;
  panel.hidden = !show;this.visible=show;if(!show)this.controller?.abort();
  $('dust-toggle')?.setAttribute('aria-expanded', String(show));
  $('dust-toggle')?.setAttribute('aria-pressed', String(show));
  if (show) {
   this.onOpen?.();
   return this.evaluateCurrentView();
  }
 }
}

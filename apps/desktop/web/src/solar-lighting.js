import { marsSun, solarAt, solarFlux, daylightHours, solarPanelMetrics } from './solar-geometry.js';
import { fmtCoord } from './eva-assistant.js';
import {sunModel,SUN_RADIUS_METERS,SUN_TEXTURE_SIZE} from './sun-model.js';

const $ = id => typeof document !== 'undefined' ? document.getElementById(id) : null;

function sunSVG(enlarged=false) {
 const svg = enlarged ? `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><radialGradient id="mars-sun-glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="20%" stop-color="#fff8db"/><stop offset="50%" stop-color="#ffa64d" stop-opacity="0.8"/><stop offset="78%" stop-color="#ff6e26" stop-opacity="0.3"/><stop offset="100%" stop-color="#ff3300" stop-opacity="0"/></radialGradient></defs><circle cx="48" cy="48" r="46" fill="url(#mars-sun-glow)"/><circle cx="48" cy="48" r="13" fill="#ffffff"/></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
   <radialGradient id="mars-sun-disc" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#ffffff"/>
    <stop offset="75%" stop-color="#fff8db"/>
    <stop offset="100%" stop-color="#ffedbb"/>
   </radialGradient>
  </defs>
  <circle cx="128" cy="128" r="128" fill="url(#mars-sun-disc)"/>
 </svg>`;
 return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const sunImages={enlarged:sunSVG(true),physical:sunSVG()};
function sunAppearance(enlarged){
 return enlarged?{image:sunImages.enlarged,width:64,height:64,scale:1,sizeInMeters:false}:{image:sunImages.physical,width:SUN_TEXTURE_SIZE,height:SUN_TEXTURE_SIZE,scale:2*SUN_RADIUS_METERS/SUN_TEXTURE_SIZE,sizeInMeters:true};
}

export class SolarLighting {
 constructor(viewer, { currentFocus, getRegion, onOpen, onChange } = {}) {
  this.onChange = onChange;
  this.viewer = viewer;
  this.currentFocus = currentFocus;
  this.getRegion = getRegion;
  this.onOpen = onOpen;

  this.enabled = true;
  try {
   const saved = localStorage.getItem('mars-atlas-solar-lighting-v1');
   if (saved !== null) this.enabled = saved === 'true';
  } catch {}

  this.sunEnlarged=true;
  try{this.sunEnlarged=localStorage.getItem('mars-atlas-sun-enlarged-v1')!=='false';}catch{}

  this.shadows = false;
  try {
   const savedShad = localStorage.getItem('mars-atlas-solar-shadows-v1');
   if (savedShad !== null) this.shadows = savedShad === 'true';
  } catch {}

  this.mode = 'now'; // 'now' | 'scrub'
  this.scrubHour = 12.0; // 0.0 to 24.0
  this.scrubDate = new Date().toISOString().slice(0, 10);
  this.lastAt = null;

  this.initSunEntity();
  this.initUI();

  // Periodic update timer to keep sunlight aligned with elapsed time
  this.timer = setInterval(() => {
   if (this.mode === 'now' && !document.hidden) {
    this.update();
   }
  }, 1000);
  this.timer.unref?.();

  // Update when camera moves or finishes navigating
  this.viewer.camera?.changed?.addEventListener(() => {
   if (this.enabled) this.updateTelemetryOnly();
  });

  this.update();
 }

 initSunEntity() {
  const C = typeof window !== 'undefined' ? window.Cesium : null;
  if (!C || !this.viewer) return;

  this.sunPosition = new C.Cartesian3();
  // Keep the astronomical bounding volume/scale out of map-pin collections.
  this.sunSource = new C.CustomDataSource('Sun · Mars24');
  this.viewer.dataSources.add(this.sunSource);
  this.sunEntity = this.sunSource.entities.add({
   id: 'mars-sun-disc',
   position: new C.CallbackPositionProperty(() => this.sunPosition, false),
   billboard: {
    // Cesium packs image dimensions into limited-size vertex attributes.
    // Apply the physical diameter through scale, not a billion-unit width.
    ...sunAppearance(this.sunEnlarged),
    // The Sun must be occluded by the rendered planet and foreground terrain.
    // Always-on-top billboards leaked through Mars at oblique viewing angles.
    disableDepthTestDistance: 0
   },
   show: this.enabled
  });
 }

 setSunEnlarged(enlarged){
  this.sunEnlarged=Boolean(enlarged);
  try{localStorage.setItem('mars-atlas-sun-enlarged-v1',String(this.sunEnlarged));}catch{}
  if(this.sunEntity)Object.assign(this.sunEntity.billboard,sunAppearance(this.sunEnlarged));
  this.updateSunScaleControl();this.updateTelemetryOnly();this.viewer.scene?.requestRender?.();
 }

 updateSunScaleControl(){
  const input=$('sun-enlarge');if(input)input.checked=this.sunEnlarged;
  const note=$('sun-display-note');if(note)note.textContent=this.sunEnlarged?'Sun enlarged for visibility using its earlier screen size and glow. Display only; its calculated distance and sunlight calculations stay unchanged. Turn off for physical apparent size.':'Sun at physical apparent size and calculated distance. Turn on to make it easier to see. The Sunlight switch controls visibility.';
 }

 initUI() {
  if (typeof document === 'undefined') return;

  this.updateSunScaleControl();
  $('sun-enlarge')?.addEventListener('change',event=>this.setSunEnlarged(event.target.checked));

  $('solar-toggle')?.addEventListener('click', () => this.open($('solar-panel').hidden));
  $('solar-close')?.addEventListener('click', () => this.open(false));

  const enableCheckbox = $('solar-enable');
  if (enableCheckbox) {
   enableCheckbox.checked = this.enabled;
   enableCheckbox.addEventListener('change', () => {
    this.enabled = enableCheckbox.checked;
    try { localStorage.setItem('mars-atlas-solar-lighting-v1', String(this.enabled)); } catch {}
    this.update();
   });
  }

  const shadowCheckbox = $('solar-shadows');
  if (shadowCheckbox) {
   shadowCheckbox.checked = this.shadows;
   shadowCheckbox.addEventListener('change', () => {
    this.shadows = shadowCheckbox.checked;
    try { localStorage.setItem('mars-atlas-solar-shadows-v1', String(this.shadows)); } catch {}
    this.update();
   });
  }

  // Solar mode tabs
  const modeNow = $('solar-mode-now');
  const modeScrub = $('solar-mode-scrub');

  modeNow?.addEventListener('click', () => {
   this.mode = 'now';
   modeNow.setAttribute('aria-pressed', 'true');
   modeScrub?.setAttribute('aria-pressed', 'false');
   $('solar-scrub-controls')?.setAttribute('hidden', '');
   this.update();
  });

  modeScrub?.addEventListener('click', () => {
   this.mode = 'scrub';
   modeScrub.setAttribute('aria-pressed', 'true');
   modeNow?.setAttribute('aria-pressed', 'false');
   $('solar-scrub-controls')?.removeAttribute('hidden');
   this.update();
  });

  // Sol hour slider
  const slider = $('solar-hour-slider');
  const sliderValue = $('solar-hour-value');
  slider?.addEventListener('input', () => {
   this.scrubHour = parseFloat(slider.value);
   if (sliderValue) {
    const h = Math.floor(this.scrubHour);
    const m = Math.round((this.scrubHour % 1) * 60);
    sliderValue.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} LTST`;
   }
   this.update();
  });

  // Quick sol time presets
  document.querySelectorAll('[data-solar-preset]').forEach(btn => {
   btn.addEventListener('click', () => {
    const preset = btn.dataset.solarPreset;
    let h = 12.0;
    if (preset === 'dawn') h = 6.0;
    else if (preset === 'noon') h = 12.0;
    else if (preset === 'dusk') h = 18.0;
    else if (preset === 'midnight') h = 0.0;
    this.scrubHour = h;
    if (slider) slider.value = String(h);
    if (sliderValue) {
     const hr = Math.floor(h);
     const mn = Math.round((h % 1) * 60);
     sliderValue.textContent = `${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')} LTST`;
    }
    if (this.mode !== 'scrub') {
     modeScrub?.click();
    } else {
     this.update();
    }
   });
  });
 }

 open(show) {
  const panel = $('solar-panel');
  if (!panel) return;
  panel.hidden = !show;
  $('solar-toggle')?.setAttribute('aria-expanded', String(show));
  $('solar-toggle')?.setAttribute('aria-pressed', String(show));
  if (show) {
   this.onOpen?.();
   this.update();
  }
 }

 currentTime() {
  if (this.mode === 'now') {
   return new Date().toISOString();
  }

  // In scrub mode: compute UTC timestamp that yields the desired Local True Solar Time (scrubHour)
  // at the current view longitude.
  const coords = this.getCurrentCoordinates();
  const lon = coords[0];
  const baseTime = Date.now();
  let baseSun;
  try {
   baseSun = marsSun(baseTime);
  } catch {
   return new Date().toISOString();
  }

  // Current local solar hour at longitude:
  // hour = mod(mst + lon/15 + eot/15, 24)
  const currentLTST = ((baseSun.mst + lon / 15 + baseSun.eot / 15) % 24 + 24) % 24;
  let deltaHours = this.scrubHour - currentLTST;
  // Normalize delta to nearest [-12, 12] sol hours
  while (deltaHours > 12) deltaHours -= 24;
  while (deltaHours < -12) deltaHours += 24;

  // 1 Mars solar hour = 1.02749 Earth hours
  const deltaMs = deltaHours * 1.02749125 * 3600000;
  return new Date(baseTime + deltaMs).toISOString();
 }

 getCurrentCoordinates() {
  const p = this.currentFocus?.()?.point;
  if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) return p;
  const reg = this.getRegion?.();
  if (reg?.center) return reg.center;
  return [77.40, 18.48]; // default Jezero Crater
 }

 computeMetrics(lon, lat, atTime) {
  try {
   const sun = marsSun(atTime);
   const solar = solarAt(sun, lon, lat);
   const flux = solarFlux(sun.distance_au);
   const hours = daylightHours(lat, sun.declination);
   const panel = solarPanelMetrics(solar, flux);

   const elev = solar?.elevation ?? 0;
   const isDay = elev > 0;
   const isTwilight = elev <= 0 && elev > -6;
   const lightingLabel = isDay ? 'Daylight' : isTwilight ? 'Civil Twilight' : 'Night';

   const ltstHour = Math.floor(solar?.local_true_hour ?? 0);
   const ltstMin = Math.round(((solar?.local_true_hour ?? 0) % 1) * 60);
   const ltstStr = `${String(ltstHour).padStart(2, '0')}:${String(ltstMin).padStart(2, '0')} LTST`;

   const optimalTilt = Math.abs(lat - sun.declination);

   return {
    sun,
    solar,
    flux,
    hours,
    panel,
    elevation: elev,
    azimuth: solar?.azimuth ?? 0,
    illumination: solar?.illumination ?? 0,
    lightingLabel,
    ltstStr,
    optimalTilt,
    dayState: isDay ? 'day' : isTwilight ? 'twilight' : 'night',
    distanceAU: sun.distance_au,
    solarLongitudeLs: sun.ls
   };
  } catch (e) {
   return null;
  }
 }

 update() {
  const C = typeof window !== 'undefined' ? window.Cesium : null;
  if (!C || !this.viewer) return;

  const timeStr = this.currentTime();
  let sun;
  try {
   sun = marsSun(timeStr);
  } catch (e) {
   return;
  }

  const model = sunModel(sun);
  C.Cartesian3.fromArray(model.position,0,this.sunPosition);
  const toSun = C.Cartesian3.normalize(this.sunPosition, new C.Cartesian3());
  const lightDir = C.Cartesian3.negate(toSun, new C.Cartesian3());

  // Set directional light onto Mars surface
  this.viewer.scene.light = new C.DirectionalLight({
   direction: lightDir,
   color: C.Color.fromCssColorString('#fff4e6')
  });

  if (this.enabled) {
   this.viewer.scene.globe.enableLighting = true;
   this.viewer.scene.globe.lightingFadeOutDistance = 10.0;
   this.viewer.scene.globe.lightingFadeInDistance = 25000000.0;
   this.viewer.scene.globe.ambientLightColor = new C.Color(0.08, 0.10, 0.15, 1.0);

   if (this.sunEntity) {
    this.sunEntity.show = true;
    // The real Sun lies beyond Cesium's default far plane. Extend only far;
    // preserve near-plane terrain precision and restore far when switched off.
    const camera=this.viewer.camera,frustum=camera?.frustum;
    if(frustum&&camera.positionWC){
     const far=1.01*(C.Cartesian3.distance(camera.positionWC,this.sunPosition)+SUN_RADIUS_METERS);
     if(frustum.far<far){this.sunPreviousFar??=frustum.far;frustum.far=far;this.sunOwnedFar=far;}
    }
   }

   if (this.shadows) {
    this.viewer.shadows = true;
    this.viewer.scene.globe.shadows = C.ShadowMode.RECEIVE_ONLY;
   } else {
    this.viewer.shadows = false;
    this.viewer.scene.globe.shadows = C.ShadowMode.DISABLED;
   }
  } else {
   this.viewer.scene.globe.enableLighting = false;
   this.viewer.shadows = false;
   this.viewer.scene.globe.shadows = C.ShadowMode.DISABLED;
   if (this.sunEntity) {
    this.sunEntity.show = false;
   }
   const frustum=this.viewer.camera?.frustum;
   if(this.sunPreviousFar!==undefined){if(frustum?.far===this.sunOwnedFar)frustum.far=this.sunPreviousFar;this.sunPreviousFar=undefined;this.sunOwnedFar=undefined;}
  }

  this.updateTelemetryOnly();
  this.onChange?.(timeStr, sun);
  if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("mars-solar-change", { detail: { time: timeStr, sun } }));
  this.viewer.scene?.requestRender?.();
 }

 updateTelemetryOnly() {
  const coords = this.getCurrentCoordinates();
  const m = this.computeMetrics(coords[0], coords[1], this.currentTime());
  if (!m) return;

  const readoutCoords = $('solar-coords');
  if (readoutCoords) readoutCoords.textContent = fmtCoord(coords[0], coords[1]);

  const readoutTime = $('solar-time-readout');
  if (readoutTime) readoutTime.textContent = m.ltstStr;

  const readoutElev = $('solar-elev-readout');
  if (readoutElev) readoutElev.textContent = `${m.elevation >= 0 ? '+' : ''}${m.elevation.toFixed(1)}°`;

  const readoutAz = $('solar-az-readout');
  if (readoutAz) readoutAz.textContent = `${m.azimuth.toFixed(0)}°`;

  const readoutFlux = $('solar-flux-readout');
  if (readoutFlux) readoutFlux.textContent = `${m.panel?.totalSurfaceFlux ?? 0} W/m²`;

  const readoutState = $('solar-state-badge');
  if (readoutState) {
   readoutState.textContent = m.lightingLabel;
   readoutState.dataset.state = m.dayState;
  }

  const readoutTilt = $('solar-tilt-readout');
  if (readoutTilt) readoutTilt.textContent = `${m.optimalTilt.toFixed(1)}° facing equator`;

  const readoutDaylight = $('solar-daylight-readout');
  if (readoutDaylight) readoutDaylight.textContent = `${m.hours.toFixed(1)} hours/sol`;

  const readoutLs = $('solar-ls-readout');
  if (readoutLs) readoutLs.textContent = `Ls ${m.solarLongitudeLs.toFixed(1)}° · ${m.distanceAU.toFixed(2)} AU`;
  const scaleNote=$('solar-scale-note');
  if(scaleNote){const model=sunModel(m.sun);scaleNote.textContent=`Sun ${this.sunEnlarged?'enlarged for visibility':'at physical scale'} · physical diameter 1,391,400 km · ${(model.distance_m/1e9).toFixed(1)} million km from Mars · ${model.angular_diameter_deg.toFixed(3)}° physical apparent diameter from Mars. Distance follows the selected solar time. ${this.sunEnlarged?'Display size only is enlarged; switch it off in Mars system.':'No size enlargement.'}`;}
 }
}

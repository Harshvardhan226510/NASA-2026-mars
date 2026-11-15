import {equipmentIcon} from './equipment-icons.js';
import {closeIcon} from './close-icon.js';
import {knownTerrainHeight} from './planet.js';
import {terrainMetrics} from './terrain-metrics.js';
/**
 * MissionDeployer: Interactive 3D Tactical Equipment Workbench
 * NASA Space Apps Challenge 2026 - Interplanetary Survival Guide: Martian Map
 * 
 * 100% OFFLINE operation using authentic NASA Planetary Data System (PDS)
 * data, NASA GISS Mars24 analytical solar ephemeris, and local DEM elevation models.
 */

import { marsSun, solarAt, solarFlux } from './solar-geometry.js';
import { marsDistance } from './measurement-geometry.js';
import { loadMarsModel, requestModelReady } from './spacecraft-model.js';
import { sampleWind } from './wind-data.js';
import { sampleEnvironment } from './environment-data.js';
import { SEISMIC_EVENTS } from './planetary-seismology.js';

export function getCompassBearing(bearing) {
  if (bearing === null || bearing === undefined || !Number.isFinite(bearing)) return 'Calm';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((bearing % 360) / 22.5)) % 16;
  return directions[index];
}

const $ = id => typeof document !== 'undefined' ? document.getElementById(id) : null;
const node = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};

// 4 Curated Mission Locations Grounded in Authentic NASA Exploration Targets
export const MISSION_LOCATIONS = [
  {
    id: 'VALLES_MARINERIS',
    name: 'Valles Marineris',
    region: 'Candor Chasma Deep Expedition',
    center: [-71.7, -7.0],
    range: 52000,
    pitch: -0.65,
    heading: 0.15,
    active: true,
    objective: 'Canyon Stratigraphy & Extreme Vertical Relief',
    terrainNote: 'High-relief canyon floor (~4.5 km below datum), steep canyon walls (>25°), shadow traps.',
    geology: 'Deepest canyon network in the solar system; exposes multi-kilometer stratified bedrock layers spanning Hesperian to Amazonian epochs.',
    canyonRimMaskDeg: 24.5
  },
  {
    id: 'GALE_CRATER',
    name: 'Gale Crater',
    region: 'Mount Sharp Boxwork Strata',
    center: [137.38, -4.82],
    range: 38000,
    pitch: -0.7,
    heading: 0,
    active: true,
    objective: 'Curiosity 2025 Boxwork Formations & Mineral Evolution',
    terrainNote: 'Layered central mound (Aeolis Mons), boxwork ridge networks, wind-carved yardangs.',
    geology: 'Curiosity finding: Subsurface groundwater deposited minerals in bedrock fractures before wind erosion carved out delicate polygonal boxwork veins.',
    canyonRimMaskDeg: 8.0
  },
  {
    id: 'JEZERO_CRATER',
    name: 'Jezero Crater',
    region: 'Western Fan Delta & Three Forks',
    center: [77.4, 18.48],
    range: 32000,
    pitch: -0.75,
    heading: 0,
    active: true,
    objective: 'Ancient River Delta & Biosignature Sampling',
    terrainNote: 'Deltaic sedimentary fan, boulder dropstones, crater rim fault scarps.',
    geology: 'Perseverance landing site: Ancient river delta with fine-grained mudstones preserving potential micro-fossil biosignatures; Three Forks sample depot.',
    canyonRimMaskDeg: 6.5
  },
  {
    id: 'ARCADIA_PLANITIA',
    name: 'Arcadia Planitia',
    region: 'Site AP-1 Ice Outpost',
    center: [-157.9, 39.79],
    range: 48000,
    pitch: -0.8,
    heading: 0,
    active: true,
    objective: 'Shallow Glacial Ice Extraction & ISRU Synthesis',
    terrainNote: 'Vast smooth volcanic lowlands with extensive sheet ice buried at depths <1 m.',
    geology: 'MRO SHARAD radar & SWIM project confirmed massive excess water ice sheets (>80% purity) accessible for propellant synthesis & life support.',
    canyonRimMaskDeg: 2.0
  }
];

/**
 * Generate tactical SVG visual thumbnails for equipment cards
 */
export function getEquipmentSVGThumbnail(typeId) {
  switch (typeId) {
    case 'solar_array':
      return `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg" class="equip-thumb-svg" aria-label="UltraFlex Solar Array">
        <rect width="80" height="50" rx="4" fill="#0b141c"/>
        <line x1="40" y1="36" x2="40" y2="14" stroke="#8fa5b5" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="40" cy="14" r="3" fill="#f0bd60" stroke="#fff" stroke-width="1"/>
        <circle cx="22" cy="18" r="14" fill="#153243" stroke="#f0bd60" stroke-width="1.5" stroke-dasharray="2 1"/>
        <path d="M22 18 L10 12 M22 18 L10 24 M22 18 L16 31 M22 18 L28 31 M22 18 L34 24 M22 18 L34 12 M22 18 L22 4" stroke="#73cde3" stroke-width="0.8"/>
        <circle cx="58" cy="18" r="14" fill="#153243" stroke="#f0bd60" stroke-width="1.5" stroke-dasharray="2 1"/>
        <path d="M58 18 L46 12 M58 18 L46 24 M58 18 L52 31 M58 18 L64 31 M58 18 L70 24 M58 18 L70 12 M58 18 L58 4" stroke="#73cde3" stroke-width="0.8"/>
        <path d="M32 44 L40 36 L48 44 M40 36 L40 44" stroke="#8fa5b5" stroke-width="2" stroke-linecap="round"/>
        <circle cx="40" cy="36" r="2.5" fill="#f0bd60"/>
      </svg>`;

    case 'comms_mast':
      return `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg" class="equip-thumb-svg" aria-label="High-Gain Comms Tower">
        <rect width="80" height="50" rx="4" fill="#0b141c"/>
        <path d="M37 46 L39 16 L41 16 L43 46" stroke="#8fa5b5" stroke-width="1.5"/>
        <path d="M37 42 L43 38 M37 38 L43 34 M38 34 L42 30 M38 30 L42 26 M38 26 L42 22 M39 22 L41 18" stroke="#73cde3" stroke-width="1"/>
        <ellipse cx="40" cy="14" rx="14" ry="7" transform="rotate(-20 40 14)" fill="#1c2d3d" stroke="#f0bd60" stroke-width="1.8"/>
        <line x1="38" y1="14" x2="44" y2="8" stroke="#f0bd60" stroke-width="1.5"/>
        <circle cx="44" cy="8" r="1.5" fill="#fff"/>
        <path d="M48 6 A 8 8 0 0 1 54 12" stroke="#73cde3" stroke-width="1.2" stroke-linecap="round" fill="none"/>
        <path d="M51 3 A 12 12 0 0 1 60 12" stroke="#73cde3" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.6"/>
        <path d="M37 46 L24 48 M43 46 L56 48" stroke="#506677" stroke-width="1" stroke-dasharray="2 1"/>
      </svg>`;

    case 'seis_station':
      return `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg" class="equip-thumb-svg" aria-label="InSight SEIS Seismometer">
        <rect width="80" height="50" rx="4" fill="#0b141c"/>
        <line x1="16" y1="44" x2="64" y2="44" stroke="#334455" stroke-width="1.5" stroke-dasharray="3 2"/>
        <path d="M24 42 Q 40 16 56 42 Z" fill="#243444" stroke="#f0bd60" stroke-width="2"/>
        <path d="M30 40 Q 40 22 50 40 M35 34 Q 40 26 45 34" stroke="#ef9a48" stroke-width="1.2" fill="none"/>
        <circle cx="26" cy="43" r="2.5" fill="#f0bd60"/>
        <circle cx="40" cy="43" r="2.5" fill="#f0bd60"/>
        <circle cx="54" cy="43" r="2.5" fill="#f0bd60"/>
        <path d="M40 38 Q 48 36 62 41" stroke="#73cde3" stroke-width="1.5" stroke-dasharray="3 1" fill="none"/>
        <path d="M32 28 L36 28 L38 23 L40 33 L42 25 L44 28 L48 28" stroke="#78d7a3" stroke-width="1.2" fill="none"/>
      </svg>`;

    case 'weather_station':
      return `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg" class="equip-thumb-svg" aria-label="REMS/MEDA Weather Station">
        <rect width="80" height="50" rx="4" fill="#0b141c"/>
        <rect x="38.5" y="12" width="3" height="32" rx="1.5" fill="#8fa5b5"/>
        <rect x="35" y="32" width="10" height="4" rx="1" fill="#f0bd60"/>
        <line x1="39" y1="18" x2="25" y2="18" stroke="#73cde3" stroke-width="1.5"/>
        <circle cx="24" cy="18" r="2.5" fill="#f0bd60"/>
        <path d="M22 15 L26 15 M22 21 L26 21" stroke="#78d7a3" stroke-width="1"/>
        <line x1="41" y1="23" x2="55" y2="21" stroke="#73cde3" stroke-width="1.5"/>
        <circle cx="56" cy="21" r="2.5" fill="#f0bd60"/>
        <ellipse cx="40" cy="11" rx="6" ry="2.5" fill="#1f3344" stroke="#f0bd60" stroke-width="1.2"/>
        <line x1="40" y1="8" x2="40" y2="11" stroke="#fff" stroke-width="1"/>
        <path d="M33 44 L47 44 M36 40 L44 40" stroke="#607788" stroke-width="2"/>
      </svg>`;

    case 'crew_hab':
      return `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg" class="equip-thumb-svg" aria-label="Crew Habitat Core">
        <rect width="80" height="50" rx="4" fill="#0b141c"/>
        <rect x="22" y="16" width="36" height="26" rx="3" fill="#1c2d3d" stroke="#73cde3" stroke-width="1.8"/>
        <path d="M30 16 Q 40 8 50 16 Z" fill="#294054" stroke="#73cde3" stroke-width="1.5"/>
        <rect x="34" y="32" width="12" height="12" fill="#0d151e" stroke="#f0bd60" stroke-width="1.5"/>
        <line x1="16" y1="20" x2="16" y2="38" stroke="#f0bd60" stroke-width="2"/>
        <line x1="16" y1="24" x2="22" y2="24" stroke="#f0bd60" stroke-width="1"/>
        <line x1="16" y1="34" x2="22" y2="34" stroke="#f0bd60" stroke-width="1"/>
        <line x1="32" y1="44" x2="48" y2="44" stroke="#8fa5b5" stroke-width="2"/>
        <circle cx="40" cy="22" r="2.5" fill="#73cde3"/>
      </svg>`;

    case 'greenhouse_dome':
      return `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg" class="equip-thumb-svg" aria-label="Greenhouse Biodome">
        <rect width="80" height="50" rx="4" fill="#0b141c"/>
        <rect x="18" y="38" width="44" height="6" rx="1.5" fill="#1c2d3d" stroke="#506677" stroke-width="1"/>
        <path d="M22 38 Q 40 10 58 38 Z" fill="#153328" stroke="#78d7a3" stroke-width="2"/>
        <path d="M30 38 Q 40 16 50 38" stroke="#78d7a3" stroke-width="1.2" stroke-dasharray="2 1" fill="none"/>
        <line x1="40" y1="12" x2="40" y2="38" stroke="#78d7a3" stroke-width="1.2"/>
        <circle cx="36" cy="30" r="3" fill="#78d7a3" opacity="0.8"/>
        <circle cx="44" cy="30" r="3" fill="#78d7a3" opacity="0.8"/>
        <circle cx="40" cy="24" r="2.5" fill="#a3f7c5"/>
      </svg>`;

    case 'nuclear_reactor':
      return `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg" class="equip-thumb-svg" aria-label="Kilopower Nuclear Plant">
        <rect width="80" height="50" rx="4" fill="#0b141c"/>
        <path d="M30 44 L35 34 L45 34 L50 44 Z" fill="#233544" stroke="#f0bd60" stroke-width="1.5"/>
        <rect x="36" y="24" width="8" height="10" rx="1" fill="#4d3215" stroke="#f0bd60" stroke-width="1.5"/>
        <path d="M40 24 L20 10 L60 10 Z" fill="#1a2b3c" stroke="#8fa5b5" stroke-width="1.8"/>
        <line x1="40" y1="24" x2="30" y2="10" stroke="#73cde3" stroke-width="1"/>
        <line x1="40" y1="24" x2="50" y2="10" stroke="#73cde3" stroke-width="1"/>
        <circle cx="40" cy="8" r="3" fill="#f0bd60"/>
        <circle cx="40" cy="26" r="18" stroke="#f0bd60" stroke-width="0.8" stroke-dasharray="3 2" fill="none" opacity="0.5"/>
      </svg>`;

    case 'isru_plant':
      return `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg" class="equip-thumb-svg" aria-label="ISRU Water & Fuel Plant">
        <rect width="80" height="50" rx="4" fill="#0b141c"/>
        <rect x="14" y="38" width="52" height="6" rx="1.5" fill="#2a2412" stroke="#f0bd60" stroke-width="1.5"/>
        <path d="M22 38 L27 12 L33 12 L38 38" stroke="#8fa5b5" stroke-width="1.8"/>
        <line x1="24" y1="28" x2="36" y2="28" stroke="#73cde3" stroke-width="1"/>
        <line x1="26" y1="20" x2="34" y2="20" stroke="#73cde3" stroke-width="1"/>
        <line x1="30" y1="12" x2="30" y2="38" stroke="#f0bd60" stroke-width="1.5"/>
        <circle cx="48" cy="28" r="8" fill="#182d3d" stroke="#73cde3" stroke-width="1.8"/>
        <circle cx="60" cy="28" r="8" fill="#182d3d" stroke="#f0bd60" stroke-width="1.8"/>
        <line x1="48" y1="28" x2="48" y2="38" stroke="#73cde3" stroke-width="1"/>
        <line x1="60" y1="28" x2="60" y2="38" stroke="#f0bd60" stroke-width="1"/>
      </svg>`;

    case 'crew_rover':
      return `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg" class="equip-thumb-svg" aria-label="Pressurized Rover">
        <rect width="80" height="50" rx="4" fill="#0b141c"/>
        <path d="M20 22 L46 22 L56 28 L56 34 L18 34 L18 26 Z" fill="#1c2d3d" stroke="#fff" stroke-width="1.8"/>
        <path d="M46 22 L56 28 L46 28 Z" fill="#f0bd60" opacity="0.85"/>
        <line x1="22" y1="34" x2="52" y2="34" stroke="#8fa5b5" stroke-width="2"/>
        <circle cx="22" cy="40" r="4.5" fill="#0d151e" stroke="#8fa5b5" stroke-width="1.5"/>
        <circle cx="37" cy="40" r="4.5" fill="#0d151e" stroke="#8fa5b5" stroke-width="1.5"/>
        <circle cx="52" cy="40" r="4.5" fill="#0d151e" stroke="#8fa5b5" stroke-width="1.5"/>
        <rect x="15" y="24" width="3" height="8" rx="0.5" fill="#f0bd60"/>
        <line x1="56" y1="30" x2="66" y2="31" stroke="#fff" stroke-width="1.5" stroke-dasharray="2 1"/>
      </svg>`;

    default:
      return `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg" class="equip-thumb-svg">
        <rect width="80" height="50" rx="4" fill="#0b141c"/>
        <circle cx="40" cy="25" r="12" stroke="#f0bd60" stroke-width="1.5" stroke-dasharray="3 2"/>
        <text x="40" y="29" fill="#f0bd60" font-size="12" text-anchor="middle">NASA</text>
      </svg>`;
  }
}

// Equipment Catalog with Authentic Dimensions, Compact GLBs and Validated Physics Formulas
export const EQUIPMENT_CATALOG = [
  {
    id: 'solar_array',
    name: 'Deployable Solar Array',
    icon: '☀️',
    badge: 'UltraFlex Dual-Wing PV',
    modelUrl: '/equipment/models/solar_array.glb',
    scale: 18.0,
    zoneRadius: 28.0,
    zoneColor: '#f0bd60',
    zoneLabel: 'Solar Generation Field',
    dimensions: '4.0 m² dual circular arrays · 30% GaAs triple-junction',
    description: 'Deployable UltraFlex circular array with triple-junction photovoltaic cells, cosine slope angle adjustment and shadow masking.',
    computeTelemetry: (loc, elevation, slopeDeg, aspectDeg, locationId = 'VALLES_MARINERIS', inAppData = {}) => {
      const atTime = inAppData.currentTime || new Date().toISOString();
      let sun = inAppData.sun;
      if (!sun) {
        try { sun = marsSun(atTime); } catch { sun = marsSun('2026-10-29T12:00:00Z'); }
      }
      const solar = inAppData.solar || solarAt(sun, loc[0], loc[1]);
      const flux0 = inAppData.flux0 || solarFlux(sun.distance_au);
      
      const elevDeg = solar?.elevation ?? 45;
      const azimDeg = solar?.azimuth ?? 180;
      const elevRad = elevDeg * Math.PI / 180;
      const slopeRad = (slopeDeg ?? 0) * Math.PI / 180;
      
      const locSpec = MISSION_LOCATIONS.find(l => l.id === locationId) || MISSION_LOCATIONS[0];
      const rimMaskDeg = locSpec.canyonRimMaskDeg ?? 5.0;
      const isRimOccluded = elevDeg > 0 && elevDeg < rimMaskDeg;
      const isDay = elevDeg > 0 && !isRimOccluded;

      const cosIncidence = Math.sin(elevRad) * Math.cos(slopeRad) +
        Math.cos(elevRad) * Math.sin(slopeRad) * Math.cos((azimDeg - (aspectDeg ?? 0)) * Math.PI / 180);
      const effectiveIncidence = Math.max(0, cosIncidence);

      const tau = inAppData.dustTau ?? 0.50;
      const airMass = 1.0 / Math.max(0.15, Math.sin(elevRad));
      const directFlux = isDay ? flux0 * effectiveIncidence * Math.exp(-tau * airMass) : 0;
      const diffuseFlux = isDay ? flux0 * 0.12 * Math.max(0.08, Math.sin(elevRad)) : (elevDeg > -6 ? flux0 * 0.02 : 0);
      const totalFlux = Math.round(directFlux + diffuseFlux);

      const arrayAreaM2 = 4.0;
      const cellEfficiency = 0.30;
      const instantPowerWatts = isDay ? Math.round(totalFlux * arrayAreaM2 * cellEfficiency) : 0;
      
      const dayHours = 12.3;
      const diurnalKWh = Number(((instantPowerWatts * dayHours * 0.65) / 1000).toFixed(2));

      let locationContext = 'Nominal surface insolation regime.';
      if (locationId === 'VALLES_MARINERIS') {
        locationContext = isRimOccluded ? 'Direct Sun Blocked by Candor Canyon Wall (>24°)' : 'Clear Above Canyon Rim (>24.5°)';
      } else if (locationId === 'GALE_CRATER') {
        locationContext = 'Mount Sharp central mound blocks early eastern morning rays.';
      } else if (locationId === 'JEZERO_CRATER') {
        locationContext = 'Western delta fan slope (+4° ESE) provides optimal morning solar capture.';
      } else if (locationId === 'ARCADIA_PLANITIA') {
        locationContext = 'High northern latitude (39.8°N) requires 42° tilt for winter solstice survival.';
      }

      const allSolar = (inAppData.allDeployed || []).filter(r => r.typeId === 'solar_array');
      const count = allSolar.length || 1;
      const clusterWatts = count * instantPowerWatts;
      const ltstStr = solar ? `${solar.local_true_hour.toFixed(2)} LTST` : '12.00 LTST';
      const scrubLabel = inAppData.isSolarScrubbed ? ' (In-App Solar Scrub Active)' : '';

      return {
        status: isDay ? 'nominal' : (isRimOccluded ? 'caution' : 'warning'),
        statusLabel: isDay ? 'OPTIMAL GENERATION' : (isRimOccluded ? 'TERRAIN SHADOW MASK' : 'NIGHT / NO FLUX'),
        items: [
          { label: 'Instantaneous Solar Flux', value: `${totalFlux} W/m² (τ = ${tau.toFixed(2)} In-App Dust Opacity)` },
          { label: 'Electrical Power Output', value: `${instantPowerWatts} W (Unit) · ${clusterWatts} W (${count} Array${count > 1 ? 's' : ''} in Base Fleet)` },
          { label: 'Daily Energy Capture', value: `${diurnalKWh} kWh / Sol per array` },
          { label: 'Local True Solar Time', value: `${ltstStr}${scrubLabel}` },
          { label: 'Solar Elevation Angle', value: `${elevDeg.toFixed(1)}° (Rim Mask: ${rimMaskDeg}°)` },
          { label: 'Terrain Obstruction', value: locationContext }
        ],
        citation: 'NASA GISS Mars24 Analytical Algorithm (Allison & McEwen 2000) · In-App Mars Sun Ephemeris · PDS Atmospheric Dust Opacity τ=' + tau.toFixed(2) + ' · InSight UltraFlex Triple-Junction PV Spec.'
      };
    }
  },
  {
    id: 'comms_mast',
    name: 'High-Gain Comms Relay',
    icon: '📡',
    badge: 'X-Band / UHF Mesh Tower',
    modelUrl: '/equipment/models/comms_mast.glb',
    scale: 25.0,
    zoneRadius: 35.0,
    zoneColor: '#73cde3',
    zoneLabel: 'Tactical RF Relay Field',
    dimensions: '4.5 m mast height · 1.2 m parabolic dish',
    description: 'High-gain deep space X-band transceiver with omnidirectional UHF antenna loop for multi-kilometer EVA suit telemetry.',
    computeTelemetry: (loc, elevation, slopeDeg, aspectDeg, locationId = 'VALLES_MARINERIS', inAppData = {}) => {
      const R_mars = 3389.5;
      const mastHeightKm = 0.0045;
      const suitHeightKm = 0.0018;
      
      const dMast = Math.sqrt(2 * R_mars * mastHeightKm);
      const dSuit = Math.sqrt(2 * R_mars * suitHeightKm);
      const losRadiusKm = (dMast + dSuit).toFixed(2);

      const locSpec = MISSION_LOCATIONS.find(l => l.id === locationId) || MISSION_LOCATIONS[0];
      const rimCutoffDeg = locSpec.canyonRimMaskDeg ?? 5.0;

      const allOther = (inAppData.allDeployed || []).filter(r => r.typeId !== 'comms_mast');
      const connectedCount = allOther.filter(s => (marsDistance(loc, s.coords) / 1000) <= parseFloat(losRadiusKm)).length;

      let passNote = 'Standard horizon pass clearance (>5°).';
      if (locationId === 'VALLES_MARINERIS') {
        passNote = 'Requires high-overhead orbital pass (>25°) to clear canyon rim.';
      } else if (locationId === 'ARCADIA_PLANITIA') {
        passNote = 'Vast planar lowlands allow long-duration low-elevation orbiter tracking (>5°).';
      } else if (locationId === 'GALE_CRATER') {
        passNote = 'Good line-of-sight to MRO and Odyssey equatorial relay passes.';
      }

      return {
        status: 'nominal',
        statusLabel: 'TACTICAL RELAY ACTIVE',
        items: [
          { label: 'Spherical LOS Horizon', value: `${losRadiusKm} km (Astronaut Suit Loop)` },
          { label: 'Connected Hardware Mesh', value: `${connectedCount} Deployed Station${connectedCount !== 1 ? 's' : ''} Linked within LOS` },
          { label: 'Elevation Mask Cutoff', value: `${rimCutoffDeg}° to Surrounding Rim` },
          { label: 'Relay Carrier Band', value: 'X-Band 8.4 GHz / UHF 437 MHz' },
          { label: 'Orbital Pass Geometry', value: passNote },
          { label: 'Active Relay Orbiters', value: 'MRO (Electra UHF), 2001 Odyssey, ExoMars TGO, MAVEN' },
          { label: 'Earth Round-Trip Time', value: '8.6 to 42.0 min (100% Autonomous Edge Link)' }
        ],
        citation: 'NASA Mars Telecommunication Network Architecture (NTRS 20020039526) · Spherical Geometric Horizon over Mars Reference Ellipsoid.'
      };
    }
  },
  {
    id: 'seis_station',
    name: 'InSight SEIS Seismometer',
    icon: '🌐',
    badge: 'VBB & SP Broadband Dome',
    modelUrl: '/equipment/models/seis_station.glb',
    scale: 40.0,
    zoneRadius: 20.0,
    zoneColor: '#78d7a3',
    zoneLabel: 'Seismic Acoustic Shield Zone',
    dimensions: '0.8 m Wind & Thermal Shield (WTS) dome',
    description: 'Very Broadband triaxial seismometer deployed inside an evacuated sphere and protected by a hexagonal Wind and Thermal Shield.',
    computeTelemetry: (loc, elevation, slopeDeg, aspectDeg, locationId = 'VALLES_MARINERIS', inAppData = {}) => {
      const slope = slopeDeg ?? 3.5;
      const isLevelable = slope <= 15.0;
      
      let faultFeature = 'Candor Boundary Normal Fault';
      let faultCoord = [loc[0], -6.25];
      let geologicalContext = 'Indurated sedimentary bedrock layer.';

      if (locationId === 'GALE_CRATER') {
        faultFeature = 'Gediz Vallis Ridge Fault';
        faultCoord = [137.42, -4.75];
        geologicalContext = 'Mount Sharp boxwork fracture networks & sulfate-clay contact.';
      } else if (locationId === 'JEZERO_CRATER') {
        faultFeature = 'Jezero Western Delta Scarp Fault';
        faultCoord = [77.35, 18.52];
        geologicalContext = 'Ancient river delta sandstones; low acoustic attenuation.';
      } else if (locationId === 'ARCADIA_PLANITIA') {
        faultFeature = 'Arcadia Cryotectonic Fracture Zone';
        faultCoord = [-157.5, 40.1];
        geologicalContext = 'Massive subsurface sheet ice; sensitive to thermal contraction cracking.';
      }

      const distToScarpKm = (marsDistance(loc, faultCoord) / 1000).toFixed(1);

      // In-App NASA InSight Marsquake catalogue calculations
      const monsterEpicenter = [162.3, 3.8]; // Cerberus Fossae S1222a (Mw 4.7)
      const distToS1222aKm = Math.round(marsDistance(loc, monsterEpicenter) / 1000);
      const vP = 7.2; // km/s InSight crustal velocity
      const vS = 4.0; // km/s InSight crustal velocity
      const tP_sec = Math.round(distToS1222aKm / vP);
      const tS_sec = Math.round(distToS1222aKm / vS);
      const deltaTP = `${Math.floor(tP_sec / 60)}m ${tP_sec % 60}s`;
      const deltaTS = `${Math.floor(tS_sec / 60)}m ${tS_sec % 60}s`;
      const insightLanderDist = inAppData.insightLanderDistKm ?? Math.round(marsDistance(loc, [135.62, 4.50]) / 1000);

      return {
        status: isLevelable ? 'nominal' : 'warning',
        statusLabel: isLevelable ? 'OPTIMAL SEISMIC COUPLING' : 'HAZARD: TILT LIMIT EXCEEDED',
        items: [
          { label: 'Ground Slope at Site', value: `${slope.toFixed(1)}° (${isLevelable ? 'Within 15° Cradle Limit' : 'Exceeds 15° Limit!'})` },
          { label: 'Leveling Cradle Range', value: '15.0° Max Motorized Tilt Range' },
          { label: 'Nearest Fault Scarp', value: `${distToScarpKm} km to ${faultFeature}` },
          { label: 'Epicenter: InSight S1222a (Mw 4.7)', value: `${distToS1222aKm} km to Cerberus Fossae (P-wave: ${deltaTP}, S-wave: ${deltaTS})` },
          { label: 'InSight Lander Baseline', value: `${insightLanderDist} km to Elysium Planitia [135.6°E, 4.5°N]` },
          { label: 'Geological Stratum', value: geologicalContext },
          { label: 'Sensor Configuration', value: '3-Axis VBB (0.01-10 Hz) + Short-Period SP' },
          { label: 'Thermal Shielding', value: 'Aerodynamic WTS Copper Skirt Deployed' }
        ],
        citation: 'NASA/CNES InSight SEIS Performance & Leveling Constraints (Lognonné et al. 2019) · In-App InSight Marsquake Catalogue & Crustal Velocity Model (vP=7.2 km/s, vS=4.0 km/s).'
      };
    }
  },
  {
    id: 'weather_station',
    name: 'REMS/MEDA Weather Station',
    icon: '🌡️',
    badge: 'Micro-Met Surface Mast',
    modelUrl: '/equipment/models/weather_station.glb',
    scale: 32.0,
    zoneRadius: 22.0,
    zoneColor: '#ff7b7b',
    zoneLabel: 'Boundary Layer Mast Zone',
    dimensions: '1.5 m titanium mast · dual wind booms',
    description: 'Autonomous micro-meteorology station measuring atmospheric pressure, ambient air temperature, thermal ground IR, wind vectors and UV.',
    computeTelemetry: (loc, elevation, slopeDeg, aspectDeg, locationId = 'VALLES_MARINERIS', inAppData = {}) => {
      const zMeters = elevation ?? -4500;
      const pressurePa = inAppData.envPressure ?? Math.round(610 * Math.exp(-zMeters / 11100));
      const densityDeltaPct = Math.round(((pressurePa - 610) / 610) * 100);

      // In-app solar hour determines diurnal thermal phase
      const ltst = inAppData.solar?.local_true_hour ?? 12.0;

      let middayMax = -14;
      let nightMin = -86;
      let katabaticBase = 'Katabatic Drainage Breeze (2.4 m/s)';
      let environmentalRisk = 'Moderate UV radiation exposure';

      if (locationId === 'GALE_CRATER') {
        middayMax = -5;
        nightMin = -78;
        katabaticBase = 'Mount Sharp downslope katabatic drainage (3.2 m/s)';
        environmentalRisk = 'Active dust devil vortex tracks';
      } else if (locationId === 'JEZERO_CRATER') {
        middayMax = -12;
        nightMin = -84;
        katabaticBase = 'Western delta crater-floor thermal convection (4.8 m/s)';
        environmentalRisk = 'High airborne dust suspension';
      } else if (locationId === 'ARCADIA_PLANITIA') {
        middayMax = -32;
        nightMin = -115;
        katabaticBase = 'Gentle Polar Outflow (2.1 m/s)';
        environmentalRisk = 'Cryogenic surface frost & CO2 precipitation';
      }

      const tMean = (middayMax + nightMin) / 2;
      const tAmp = (middayMax - nightMin) / 2;
      const diurnalTempC = Math.round(tMean + tAmp * Math.cos((ltst - 14) * 2 * Math.PI / 24));
      const currentTempC = inAppData.envTemp !== null && inAppData.envTemp !== undefined ? Math.round(inAppData.envTemp) : diurnalTempC;
      const tempK = currentTempC + 273.15;
      const atmosphericDensity = Number((pressurePa / (188.92 * tempK)).toFixed(4)); // kg/m³

      let windPattern = katabaticBase;
      let windDirStr = '315° NW (Downslope Flow)';
      if (inAppData.wind && Number.isFinite(inAppData.wind.speed)) {
        const spdMps = inAppData.wind.speed;
        const spdKmh = spdMps * 3.6;
        const bearing = inAppData.wind.bearing_to;
        const dirName = bearing !== null ? getCompassBearing(bearing) : 'Calm';
        windPattern = `${spdMps.toFixed(1)} m/s (${spdKmh.toFixed(1)} km/h) · NASA EMARS Climatology`;
        windDirStr = bearing !== null ? `Flow toward ${bearing.toFixed(0)}° (${dirName})` : 'Calm / No flow bearing';
      }

      const tau = inAppData.dustTau ?? 0.50;

      return {
        status: 'nominal',
        statusLabel: 'ATMOSPHERIC SENSORS ONLINE',
        items: [
          { label: 'Local Barometric Pressure', value: `${pressurePa} Pa (${densityDeltaPct >= 0 ? '+' : ''}${densityDeltaPct}% vs 610 Pa Mars Datum)` },
          { label: 'Ambient Air Temperature', value: `${currentTempC}°C / ${tempK.toFixed(1)} K (${middayMax}°C Max / ${nightMin}°C Min Diurnal)` },
          { label: 'Atmospheric Gas Density', value: `${atmosphericDensity} kg/m³ (CO₂ Hydrostatic P/RT)` },
          { label: 'Dominant Wind Regime', value: windPattern },
          { label: 'Wind Flow Direction', value: windDirStr },
          { label: 'Environmental Hazard', value: environmentalRisk },
          { label: 'Atmospheric Scale Height', value: '11.1 km Mars Hydrostatic Reference' },
          { label: 'Optical Depth (Tau)', value: `τ = ${tau.toFixed(2)} (In-App Dust Climate Field)` }
        ],
        citation: 'NASA Mars Science Laboratory REMS / Mars 2020 MEDA Environmental Suite · In-App NASA EMARS Climatology Grid & Scale-Height Formula: P(z)=610·exp(-z/11100).'
      };
    }
  },
  {
    id: 'crew_hab',
    name: 'Crew Habitat Core',
    icon: '🏠',
    badge: 'NASA DRA 5.0 TransHab',
    modelUrl: '/equipment/models/crew_hab.glb',
    scale: 16.0,
    zoneRadius: 150.0,
    zoneColor: '#73cde3',
    zoneLabel: '150m Habitation Life-Support Perimeter',
    dimensions: '8.4 m dia · 4-Crew Inflatable TransHab Core · 12 kW load',
    description: 'Primary pressurized surface outpost habitat derived from NASA Design Reference Architecture 5.0 with full regenerative ECLSS.',
    computeTelemetry: (loc, elevation, slopeDeg, aspectDeg, locationId = 'VALLES_MARINERIS', inAppData = {}) => {
      const zMeters = elevation ?? -4500;
      const radiationShielding = zMeters < -3000 ? '42.5 g/cm² (Enhanced Atmospheric Shielding)' : '28.0 g/cm² (Standard Regolith Berm)';
      
      const allDeployed = inAppData.allDeployed || [];
      const solarKW = allDeployed.filter(r => r.typeId === 'solar_array').reduce((sum, r) => {
        const item = r.telemetry?.items?.find(i => i.label.includes('Power Output'));
        return sum + (item ? parseFloat(item.value) / 1000 : 0.6);
      }, 0);
      const nucKW = allDeployed.filter(r => r.typeId === 'nuclear_reactor').length * 40.0;
      const totalGenKW = Number((solarKW + nucKW).toFixed(2));
      const powerStatus = totalGenKW >= 12.0 ? `Nominal (${totalGenKW} kW gen vs 12 kW load)` : `DEFICIT (${totalGenKW} kW gen < 12 kW load)`;

      return {
        status: totalGenKW >= 12.0 ? 'nominal' : 'caution',
        statusLabel: totalGenKW >= 12.0 ? 'ECLSS LIFE-SUPPORT ACTIVE' : 'POWER DEFICIT WARNING',
        items: [
          { label: 'Crew Capacity', value: '4 Astronauts (Nominal 500-Sol EVA Mission)' },
          { label: 'Internal Atmosphere', value: '101.3 kPa (78% N2, 21% O2 Earth-equivalent)' },
          { label: 'Continuous Electrical Load', value: `12.0 kW (Microgrid: ${powerStatus})` },
          { label: 'O2 Consumption Demand', value: '3.36 kg / day (0.84 kg/crew/day)' },
          { label: 'ECLSS Water Recycling', value: '98% closed-loop Sabatier & graywater loop' },
          { label: 'Cosmic Radiation Shield', value: radiationShielding }
        ],
        citation: 'NASA Design Reference Architecture (DRA) 5.0 (NASA/SP-2009-566) · Human Mars Mission ECLSS Baselines.'
      };
    }
  },
  {
    id: 'greenhouse_dome',
    name: 'Greenhouse Biodome',
    icon: '🌱',
    badge: 'Closed-Loop Aeroponics',
    modelUrl: '/equipment/models/greenhouse_dome.glb',
    scale: 14.0,
    zoneRadius: 100.0,
    zoneColor: '#78d7a3',
    zoneLabel: '100m Botanical Biosphere Buffer',
    dimensions: '12.0 m dia · Pressurized Geodesic Biodome · 8 kW load',
    description: 'Controlled environment agricultural module producing supplemental food calories and regenerating breathable oxygen via LED aeroponics.',
    computeTelemetry: (loc, elevation, slopeDeg, aspectDeg, locationId = 'VALLES_MARINERIS', inAppData = {}) => {
      const flux = inAppData.flux0 ?? 520;
      const elevDeg = inAppData.solar?.elevation ?? 45;
      const isDay = elevDeg > 5;
      const parOffsetKW = isDay ? Number((Math.min(3.8, (flux / 500) * 3.8)).toFixed(1)) : 0;
      const activeLightingKW = Number((8.0 - parOffsetKW).toFixed(1));

      const allDeployed = inAppData.allDeployed || [];
      const numHabs = allDeployed.filter(r => r.typeId === 'crew_hab').length;
      let habSynergy = 'No crew habitat placed yet.';
      if (numHabs > 0) {
        const crewDemand = numHabs * 3.36;
        const closurePct = Math.min(100, Math.round((2.80 / crewDemand) * 100));
        habSynergy = `${closurePct}% O₂ regenerative closure for ${numHabs * 4} crew`;
      }

      return {
        status: 'nominal',
        statusLabel: 'PHOTOSYNTHETIC CO2 SCRUBBING',
        items: [
          { label: 'Crop Production Area', value: '110 m² Vertical Aeroponic Racks' },
          { label: 'Oxygen Generation Rate', value: '+2.80 kg O2 / Sol (Photosynthetic)' },
          { label: 'CO2 Uptake / Scrubbing', value: '-3.85 kg CO2 / Sol from Hab Exhaust' },
          { label: 'Fresh Food Biomass', value: '1.2 kg / Sol Fresh Caloric Supplement' },
          { label: 'Habitat ECLSS Synergy', value: habSynergy },
          { label: 'Lighting System', value: 'High-PAR 450nm/660nm Pulsed Solid-State LED' },
          { label: 'Power Consumption', value: `${activeLightingKW} kW (${parOffsetKW > 0 ? `-${parOffsetKW} kW daylight offset` : 'Full artificial night array'})` }
        ],
        citation: 'NASA BioNutrients & Crop Production Architecture for Long-Duration Space Exploration (NASA TM-2015-218570).'
      };
    }
  },
  {
    id: 'nuclear_reactor',
    name: 'Kilopower Nuclear Reactor',
    icon: '⚛️',
    badge: 'KRUSTY 40 kWe Fission',
    modelUrl: '/equipment/models/nuclear_reactor.glb',
    scale: 16.0,
    zoneRadius: 600.0,
    zoneColor: '#f0bd60',
    zoneLabel: '600m Nuclear Radiation Standoff Perimeter',
    dimensions: '40 kWe U-235 Fission Core · Stirling Engines · Umbrella Radiator',
    description: 'NASA Kilopower KRUSTY fission surface power system delivering 40 kWe continuous baseline power through dust storms and nighttime.',
    computeTelemetry: (loc, elevation, slopeDeg, aspectDeg, locationId = 'VALLES_MARINERIS', inAppData = {}) => {
      const allDeployed = inAppData.allDeployed || [];
      const habs = allDeployed.filter(r => r.typeId === 'crew_hab');
      let standoffNote = 'Safe: 600 m Standoff Perimeter (<5 rem/year Safe Margin)';
      let standoffStatus = 'nominal';
      if (habs.length > 0) {
        const minDistM = Math.min(...habs.map(h => marsDistance(loc, h.coords)));
        if (minDistM < 600) {
          standoffStatus = 'warning';
          standoffNote = `HAZARD: Hab within ${Math.round(minDistM)}m (<600m safe perimeter!)`;
        } else {
          standoffNote = `Nominal: ${Math.round(minDistM)}m to nearest Hab (>600m safe perimeter)`;
        }
      }

      return {
        status: standoffStatus,
        statusLabel: standoffStatus === 'nominal' ? 'CONTINUOUS BASELOAD GENERATION' : 'STANDOFF VIOLATION WARNING',
        items: [
          { label: 'Continuous Baseload Output', value: '40.0 kWe (Dust Storm & Sol Independent)' },
          { label: 'Reactor Core Architecture', value: 'Solid Cast U-235 Mo Alloy + Na Heat Pipes' },
          { label: 'Energy Conversion', value: 'Dual Closed-Cycle Stirling Convertors @ 38%' },
          { label: 'Operational Design Life', value: '10 Earth Years Zero-Maintenance Run' },
          { label: 'Crew Standoff Distance', value: standoffNote },
          { label: 'Thermal Rejection', value: '120 kWt Titanium-Water Deployable Radiator' }
        ],
        citation: 'NASA Kilopower Project (KRUSTY Flight Demonstration & Surface Fission Architecture, McClure et al. 2020).'
      };
    }
  },
  {
    id: 'isru_plant',
    name: 'ISRU Water & Fuel Plant',
    icon: '🧪',
    badge: 'Hydro-Thermal Extraction',
    modelUrl: '/equipment/models/isru_plant.glb',
    scale: 18.0,
    zoneRadius: 200.0,
    zoneColor: '#4da3ff',
    zoneLabel: '200m Industrial Cryogenic Fuel Depot',
    dimensions: 'Subsurface Glacier/Regolith Drill Rig + Sabatier Reactor',
    description: 'In-Situ Resource Utilization production facility extracting subsurface Martian ice and synthesizing propellant and potable water.',
    computeTelemetry: (loc, elevation, slopeDeg, aspectDeg, locationId = 'VALLES_MARINERIS', inAppData = {}) => {
      const isArcadia = locationId === 'ARCADIA_PLANITIA';
      const waterYield = isArcadia ? '60.0 L / Sol (Shallow High-Purity Glacial Sheet)' : '25.0 L / Sol (Subsurface Hydrated Regolith)';
      const loxRate = 24.0;
      const mavDays = Math.ceil(1200 / loxRate); // 50 Sols for 1,200 kg LOX

      return {
        status: 'nominal',
        statusLabel: 'PROPELLANT SYNTHESIS ACTIVE',
        items: [
          { label: 'Daily Water Extraction', value: waterYield },
          { label: 'Liquid O2 Production', value: '+24.0 kg LOX / Sol (Sabatier + Electrolysis)' },
          { label: 'Methane (CH4) Synthesis', value: '+6.0 kg LCH4 / Sol for MAV Return Vehicle' },
          { label: 'MAV Fueling Schedule', value: `${mavDays} Sols for full 1,500 kg MAV return propellant load` },
          { label: 'Feedstock Source', value: isArcadia ? 'Glacial Sheet Ice (<1m overburden)' : 'Atmospheric CO2 + Hydrated Mineral Clay' },
          { label: 'Cryogenic Tank Storage', value: '12,000 L Vacuum-Jacketed LOX/CH4 Tanks' },
          { label: 'Power Consumption', value: '18.0 kW (Thermal Sublimation & Cryocooling)' }
        ],
        citation: 'NASA In-Situ Resource Utilization (ISRU) Strategic Roadmap & SWIM Shallow Ice Mapping Project.'
      };
    }
  },
  {
    id: 'crew_rover',
    name: 'Pressurized Rover',
    icon: '🚜',
    badge: 'Multi-Mission Surface Rover',
    modelUrl: '/equipment/models/crew_rover.glb',
    scale: 16.0,
    zoneRadius: 40.0,
    zoneColor: '#ffe3b4',
    zoneLabel: 'Surface Mobility Rover Staging',
    dimensions: '6-Wheel Rocker-Bogie Mobility Chassis · Pressurized Cockpit',
    description: 'Crew exploration rover designed for multi-kilometer scientific traverses with environmental suitports and high-gain navigation.',
    computeTelemetry: (loc, elevation, slopeDeg, aspectDeg, locationId = 'VALLES_MARINERIS', inAppData = {}) => {
      const slope = slopeDeg ?? 4.0;
      const isTraversable = slope <= 22.0;

      const flux = inAppData.flux0 ?? 520;
      const elevDeg = inAppData.solar?.elevation ?? 45;
      const isDay = elevDeg > 0;
      const solarBoostW = isDay ? Math.round(flux * 2.0 * 0.28 * Math.sin(Math.max(0.1, elevDeg * Math.PI / 180))) : 0;
      const totalPowerW = 110 + solarBoostW;

      const allDeployed = inAppData.allDeployed || [];
      const bases = allDeployed.filter(r => r.typeId === 'crew_hab' || r.typeId === 'comms_mast');
      let baseDistanceStr = 'Autonomous staging field.';
      if (bases.length > 0) {
        const minDistKm = (Math.min(...bases.map(b => marsDistance(loc, b.coords))) / 1000).toFixed(2);
        const returnTimeHr = (parseFloat(minDistKm) / 0.12).toFixed(1);
        baseDistanceStr = `${minDistKm} km from Base Camp (${returnTimeHr} h traverse @ 0.12 km/h)`;
      }

      return {
        status: isTraversable ? 'nominal' : 'warning',
        statusLabel: isTraversable ? 'ROVER FIELD NOMINAL' : 'TERRAIN MOBILITY HAZARD',
        items: [
          { label: 'Rocker-Bogie Ground Slope', value: `${slope.toFixed(1)}° (${isTraversable ? 'Safe (Limit 22°)' : 'Exceeds 22° Safe Limit'})` },
          { label: 'Power Architecture', value: `${totalPowerW} W (110 W MMRTG ${solarBoostW > 0 ? `+ ${solarBoostW} W Solar Boost` : ''})` },
          { label: 'Traverse Velocity', value: '0.12 km/h Autonomous Terrain Auto-Nav' },
          { label: 'Base Camp Distance', value: baseDistanceStr },
          { label: 'Scientific Payload', value: 'Mastcam-Z, SuperCam, PIXL, SHERLOC, RIMFAX' },
          { label: 'Sample Caching Depot', value: 'Hermetic Titanium Tubes (Biosignature Preservation)' },
          { label: 'EVA Navigation Link', value: 'UHF Proximity Link to Astronaut Heads-Up Display' }
        ],
        citation: 'NASA Mars 2020 Perseverance Mission Science & Engineering Operations (Farley et al. 2020).'
      };
    }
  }
];

export class MissionDeployer {
  constructor(host) {
    this.host = host;
    this.viewer = host.viewer;
    this.map = host.map;
    this.leaflet = host.leaflet;
    this.routePlanner = host.routePlanner;
    this.terrainRelief = host.terrainRelief;
    this.solarLighting = host.solarLighting;
    this.scienceMenu = host.scienceMenu;
    this.dustPredictor = host.dustPredictor;
    this.seismology = host.seismology;
    this.spacecraft = host.spacecraft;
    this.surface = host.surface;
    this.cachedWindPacket = null;

    if (typeof document !== 'undefined') {
      document.addEventListener('mars-solar-change', () => this.onSolarChange());
    }
    this.picking = false;
    this.selectedEquipmentType = null;
    this.deployed = [];
    this.selectedDeployedId = null;
    this.currentLocationId = 'VALLES_MARINERIS';
    this.activeTab = 'sites'; // 'sites' | 'catalog' | 'base'
    this.showGridConduits = false;

    this.primitives = new Map();
    this.entities = new Map();
    this.flatMarkers = new Map();
    this.conduitEntities = new Map();
    this.modelWatches = new Map();

    this.initUI();
    this.setupCesiumHandler();
    this.setupDragAndDrop();
  }

  initUI() {
    if (typeof document === 'undefined') return;

    this.toggle = node('button', 'Plan a Mission', 'plan-mission-btn');
    this.toggle.id = 'plan-mission-toggle';
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.setAttribute('aria-controls', 'plan-mission-panel');
    
    const tools = $('map-tools');
    if (tools) {
      const ref = $('mission-toggle') || tools.firstChild;
      tools.insertBefore(this.toggle, ref);
    }

    this.root = node('section', undefined, 'map-tool-panel');
    this.root.id = 'plan-mission-panel';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Plan a Mission & Equipment Deployment');

    this.renderPanelContent();
    const ws = $('workspace');
    if (ws) ws.append(this.root);

    this.toggle.onclick = () => this.open(this.root.hidden);
    this.root.querySelector('#plan-mission-close').onclick = () => this.open(false);

    for (const id of ['appearance-toggle', 'measure-toggle', 'route-toggle', 'mission-toggle', 'solar-toggle', 'assistant-toggle', 'walk-toggle', 'dust-toggle', 'seismic-toggle']) {
      $(id)?.addEventListener('click', () => this.open(false));
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !this.root.hidden) {
        if (this.picking) this.cancelPlacement();
        else this.open(false);
      }
    });
  }

  renderPanelContent() {
    this.root.innerHTML = `
      <button id="plan-mission-close" class="tool-close" aria-label="Close Mission Deployment">${closeIcon}</button>
      <h2>Plan a Mission <span class="mission-pilot-tag" id="mission-active-badge">4 Curated Sites</span></h2>
      <p class="tool-note">Place conceptual equipment models with drag & drop or click-to-pick. Outputs are scenario estimates, not hardware telemetry. Weather requires loaded data; default inputs and site assumptions are not measured conditions.</p>
      <button type="button" class="tool-secondary" data-action="base-sites">Evaluate a base station site</button>
      
      <!-- 3-Tab Tactical Segmented Workflow Header -->
      <div class="mission-tab-nav" role="tablist">
        <button id="tab-btn-sites" class="mission-tab-btn active" role="tab" aria-selected="true" data-tab="sites">
          <span class="tab-icon">${equipmentIcon('sites')}</span>
          <span class="tab-text">Target Site</span>
        </button>
        <button id="tab-btn-catalog" class="mission-tab-btn" role="tab" aria-selected="false" data-tab="catalog">
          <span class="tab-icon">${equipmentIcon('catalog')}</span>
          <span class="tab-text">Deploy Hardware</span>
        </button>
        <button id="tab-btn-base" class="mission-tab-btn" role="tab" aria-selected="false" data-tab="base">
          <span class="tab-icon">${equipmentIcon('base')}</span>
          <span class="tab-text">Base Command <span class="tab-counter" id="tab-deployed-count">0</span></span>
        </button>
      </div>

      <!-- TAB 1: CURATED EXPLORATION SITES -->
      <div id="tab-pane-sites" class="mission-tab-pane">
        <div class="deploy-section" style="margin-top:0; border-top:none; padding-top:0;">
          <h3>Curated Mission Exploration Target</h3>
          <div class="location-selector-grid" id="location-selector-list"></div>
          <div class="location-briefing-card" id="location-briefing-box">
            <h4 id="loc-briefing-title" style="margin:0 0 4px 0; color:#f0bd60;"></h4>
            <p id="location-desc-text" class="tool-note" style="margin-bottom:8px;"></p>
            <div id="loc-briefing-details" class="loc-spec-grid"></div>
          </div>
          <button id="mission-flyto-btn" class="tool-secondary" style="width:100%; margin-top:8px;">Fly to Mission Target (3D View) ↗</button>
          <button id="mission-deploy-here-btn" class="tool-secondary" style="width:100%; margin-top:6px; background:#1e3528; border-color:#78d7a3;">Deploy Equipment at this Site →</button>
        </div>
      </div>

      <!-- TAB 2: HARDWARE CATALOG & DEPLOYMENT -->
      <div id="tab-pane-catalog" class="mission-tab-pane" hidden>
        <div class="deploy-section" style="margin-top:0; border-top:none; padding-top:0;">
          <div id="deploy-placement-status" class="deploy-placement-banner" hidden>
            <span id="deploy-placement-msg">Click anywhere on the Mars surface to deploy...</span>
            <button id="deploy-placement-cancel">Cancel</button>
          </div>
          <p class="tool-note" style="margin-bottom:8px;">Drag any instrument card directly onto the Mars map, or click to enter placement mode.</p>
          <div class="equipment-palette" id="equipment-palette-list"></div>
        </div>
      </div>

      <!-- TAB 3: BASE OPERATIONS OUTPOST HUD & FLEET INVENTORY -->
      <div id="tab-pane-base" class="mission-tab-pane" hidden>
        <!-- Base Operations Outpost Grid -->
        <div class="deploy-section" id="base-operations-section" style="margin-top:0; border-top:none; padding-top:0;">
          <div id="base-operations-hud" class="base-operations-hud"></div>
        </div>

        <div class="deploy-section">
          <h3>Deployed Hardware Fleet</h3>
          <div id="fleet-cluster-summary" class="fleet-cluster-summary" hidden></div>
          <ul id="deployed-stations-list" class="deployed-list"></ul>
          <p id="deployed-empty-msg" class="tool-note">No instruments deployed yet. Select "Deploy Hardware" to place hardware on Mars.</p>
        </div>

        <div id="telemetry-dossier-container"></div>

        <div class="deploy-controls-row">
          <button id="deploy-export-btn" class="tool-secondary">Export Manifest JSON</button>
          <button id="deploy-clear-btn" class="tool-secondary">Clear All Placed</button>
        </div>
      </div>
    `;

    this.setupTabNavigation();
    this.renderLocations();
    this.renderEquipmentPalette();
    this.syncDeployedList();

    this.root.querySelector('#mission-flyto-btn').onclick = () => this.flyToCurrentLocation();
    this.root.querySelector('#mission-deploy-here-btn').onclick = () => this.switchTab('catalog');
    this.root.querySelector('#deploy-placement-cancel').onclick = () => this.cancelPlacement();
    this.root.querySelector('#deploy-export-btn').onclick = () => this.exportJSON();
    this.root.querySelector('#deploy-clear-btn').onclick = () => this.clearAll();
  }

  setupTabNavigation() {
    const tabs = this.root.querySelectorAll('.mission-tab-btn');
    tabs.forEach(btn => {
      btn.onclick = () => {
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      };
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    const tabBtns = this.root.querySelectorAll('.mission-tab-btn');
    tabBtns.forEach(btn => {
      const match = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-selected', String(match));
    });

    const panes = {
      sites: this.root.querySelector('#tab-pane-sites'),
      catalog: this.root.querySelector('#tab-pane-catalog'),
      base: this.root.querySelector('#tab-pane-base')
    };

    if (panes.sites) panes.sites.hidden = (tabName !== 'sites');
    if (panes.catalog) panes.catalog.hidden = (tabName !== 'catalog');
    if (panes.base) {
      panes.base.hidden = (tabName !== 'base');
      if (tabName === 'base') {
        this.renderBaseOperationsHUD();
        this.syncDeployedList();
      }
    }
  }

  renderLocations() {
    const list = this.root?.querySelector('#location-selector-list');
    if (!list) return;
    list.replaceChildren();

    for (const loc of MISSION_LOCATIONS) {
      const btn = node('button', undefined, `location-card-btn ${loc.id === this.currentLocationId ? 'active-pilot' : ''}`);
      btn.setAttribute('aria-pressed', String(loc.id === this.currentLocationId));
      
      const badge = node('span', loc.active ? 'ACTIVE TARGET' : 'CURATED SITE', 'loc-badge');
      const title = node('strong', loc.name);
      const sub = node('small', loc.region);
      
      btn.append(badge, title, sub);
      btn.onclick = () => {
        this.selectLocation(loc.id);
      };

      list.append(btn);
    }

    const cur = MISSION_LOCATIONS.find(l => l.id === this.currentLocationId) || MISSION_LOCATIONS[0];
    const bTitle = this.root.querySelector('#loc-briefing-title');
    const bDesc = this.root.querySelector('#location-desc-text');
    const bGrid = this.root.querySelector('#loc-briefing-details');

    if (bTitle) bTitle.textContent = `${cur.name} — ${cur.region}`;
    if (bDesc) bDesc.textContent = `${cur.objective}. ${cur.geology}`;
    if (bGrid) {
      bGrid.innerHTML = `
        <div class="loc-spec-row"><span>Target Coordinates:</span><strong>${cur.center[1]}°N, ${cur.center[0]}°E</strong></div>
        <div class="loc-spec-row"><span>Horizon Rim Mask:</span><strong>${cur.canyonRimMaskDeg}° cutoff</strong></div>
        <div class="loc-spec-row"><span>Terrain Regime:</span><strong>${cur.terrainNote}</strong></div>
      `;
    }
  }

  renderEquipmentPalette() {
    const pal = this.root?.querySelector('#equipment-palette-list');
    if (!pal) return;
    pal.replaceChildren();

    for (const equip of EQUIPMENT_CATALOG) {
      const card = node('div', undefined, 'equipment-card');
      card.setAttribute('draggable', 'true');
      card.setAttribute('data-id', equip.id);
      card.setAttribute('aria-pressed', String(this.picking && this.selectedEquipmentType === equip.id));

      const thumb = node('div', undefined, 'equipment-thumb');
      thumb.innerHTML = getEquipmentSVGThumbnail(equip.id);

      const info = node('div', undefined, 'equipment-card-info');
      info.innerHTML = `
        <strong>${equipmentIcon(equip.id)} ${equip.name}</strong>
        <span class="equip-sub-badge">${equip.badge}</span>
        <span class="equip-dims">${equip.dimensions}</span>
        <p class="equip-desc">${equip.description}</p>
      `;

      const actions = node('div', undefined, 'equipment-card-actions');
      const pickBtn = node('button', 'Click to Place', 'tool-secondary equip-pick-btn');
      const dragNote = node('span', ':: DRAG TO MAP', 'equip-drag-note');
      
      pickBtn.onclick = e => {
        e.stopPropagation();
        this.startPlacement(equip.id);
      };

      actions.append(pickBtn, dragNote);
      card.append(thumb, info, actions);

      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', equip.id);
        e.dataTransfer.effectAllowed = 'copy';
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });

      pal.append(card);
    }
  }

  setupDragAndDrop() {
    if (typeof window === 'undefined') return;

    const canvas = this.viewer?.canvas;
    if (canvas) {
      canvas.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });

      canvas.addEventListener('drop', e => {
        e.preventDefault();
        canvas.classList.remove('drop-target-active');
        const equipmentId = e.dataTransfer.getData('text/plain');
        if (!equipmentId) return;

        const rect = canvas.getBoundingClientRect();
        const screenPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };

        this.selectedEquipmentType = equipmentId;
        this.add3D(screenPos);
      });
    }

    const mapContainer = this.map?.getContainer?.();
    if (mapContainer) {
      mapContainer.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });

      mapContainer.addEventListener('drop', e => {
        e.preventDefault();
        const equipmentId = e.dataTransfer.getData('text/plain');
        if (!equipmentId) return;

        const rect = mapContainer.getBoundingClientRect();
        const point = [e.clientX - rect.left, e.clientY - rect.top];
        const latlng = this.map.containerPointToLatLng(point);

        this.selectedEquipmentType = equipmentId;
        this.deployAt([latlng.lng, latlng.lat], 0);
      });
    }
  }

  open(show) {
    if (this.root) this.root.hidden = !show;
    this.toggle?.setAttribute('aria-expanded', String(show));
    this.toggle?.setAttribute('aria-pressed', String(show));

    if (show) {

      this.fetchInAppWeather();
      this.updateAllTelemetry();
      this.host.onOpen?.();
      for (const id of ['appearance-panel', 'measure-panel', 'route-panel', 'mission-panel', 'solar-panel', 'assistant-panel', 'walk-panel', 'dust-panel', 'seismic-panel']) {
        const p = $(id);
        if (p) p.hidden = true;
      }
      this.syncDeployedList();
      this.renderBaseOperationsHUD();
    } else {
      this.cancelPlacement();
    }
  }

  flyToCurrentLocation() {
    const loc = MISSION_LOCATIONS.find(l => l.id === this.currentLocationId) || MISSION_LOCATIONS[0];
    const C = typeof window !== 'undefined' ? window.Cesium : null;
    if (C && this.viewer) {
      const ellipsoid = this.viewer.scene.globe.ellipsoid;
      let terrainH = 0;
      if (loc.id === 'VALLES_MARINERIS') terrainH = -4500;
      else if (loc.id === 'GALE_CRATER') terrainH = -4400;
      else if (loc.id === 'JEZERO_CRATER') terrainH = -2500;
      else if (loc.id === 'ARCADIA_PLANITIA') terrainH = -4000;
      const target = C.Cartesian3.fromDegrees(loc.center[0], loc.center[1], terrainH, ellipsoid);
      this.viewer.camera.flyToBoundingSphere(new C.BoundingSphere(target, 0), {
        offset: new C.HeadingPitchRange(loc.heading, loc.pitch, loc.range),
        duration: 2.5
      });
    }
    if (this.map && typeof this.map.setView === 'function') {
      this.map.setView([loc.center[1], loc.center[0]], 8);
    }
  }

  startPlacement(equipmentId) {

    this.picking = true;
    this.selectedEquipmentType = equipmentId;
    const item = EQUIPMENT_CATALOG.find(e => e.id === equipmentId);

    const banner = this.root?.querySelector('#deploy-placement-status');
    const msg = this.root?.querySelector('#deploy-placement-msg');
    if (banner && msg) {
      banner.hidden = false;
      msg.textContent = `Deploying ${item ? item.name : 'Hardware'}: Click anywhere on Mars surface...`;
    }

    if (this.viewer?.canvas) {
      this.viewer.canvas.style.cursor = 'crosshair';
    }
    if (this.map?.getContainer?.()) {
      this.map.getContainer().style.cursor = 'crosshair';
    }

    this.renderEquipmentPalette();
  }

  cancelPlacement() {
    this.picking = false;
    this.selectedEquipmentType = null;
    const banner = this.root?.querySelector('#deploy-placement-status');
    if (banner) banner.hidden = true;

    if (this.viewer?.canvas) {
      this.viewer.canvas.style.cursor = 'default';
    }
    if (this.map?.getContainer?.()) {
      this.map.getContainer().style.cursor = 'default';
    }

    this.renderEquipmentPalette();
  }

  setupCesiumHandler() {
    if (!this.viewer) return;
    const scene = this.viewer.scene;
    this.viewer.camera?.moveEnd?.addEventListener?.(() => this.updateTerrainElevation());
    scene?.globe?.tileLoadProgressEvent?.addEventListener?.(queued => {
      if (queued === 0) this.updateTerrainElevation();
    });
  }

  updateTerrainElevation() {
    const C = typeof window !== 'undefined' ? window.Cesium : null;
    if (!C || !this.viewer) return;
    const scene = this.viewer.scene;
    const ellipsoid = scene.globe.ellipsoid;
    let changed = false;

    for (const record of this.deployed) {
      const terrainH = scene.globe.getHeight(C.Cartographic.fromDegrees(record.coords[0], record.coords[1]));
      if (Number.isFinite(terrainH) && Math.abs(terrainH - (record.elevation ?? 0)) > 2.0) {
        record.elevation = Math.round(terrainH);
        changed = true;
        const newPos = C.Cartesian3.fromDegrees(record.coords[0], record.coords[1], terrainH, ellipsoid);
        const entity = this.entities.get(record.id);
        if (entity) {
          entity.position = newPos;
        }
        const model = this.primitives.get(record.id);
        if (model && !model.isDestroyed?.()) {
          model.modelMatrix = C.Transforms.eastNorthUpToFixedFrame(newPos, ellipsoid);
        }
      }
    }
    if (changed) {
      this.updateTacticalGrid();
      this.syncDeployedList();
      scene.requestRender();
    }
  }

  add3D(screenPosition) {
    const C = typeof window !== 'undefined' ? window.Cesium : null;
    if (!C || !this.viewer) return;

    const scene = this.viewer.scene;
    const ellipsoid = scene.globe.ellipsoid;

    let cartesian = null;
    if (scene.pickPositionSupported) {
      cartesian = scene.pickPosition(screenPosition);
    }
    if (!cartesian) {
      cartesian = scene.globe.pick(this.viewer.camera.getPickRay(screenPosition), scene);
    }
    if (!cartesian) {
      cartesian = this.viewer.camera.pickEllipsoid(screenPosition, ellipsoid);
    }
    if (!cartesian) return;

    const cartographic = ellipsoid.cartesianToCartographic(cartesian);
    const lon = C.Math.toDegrees(cartographic.longitude);
    const lat = C.Math.toDegrees(cartographic.latitude);
    const elevation = Number.isFinite(cartographic.height)?cartographic.height/(scene.verticalExaggeration??1):undefined;

    this.deployAt([lon, lat], elevation);
  }

  addFlat(event) {
    if (!this.selectedEquipmentType) return;
    const { lng, lat } = event.latlng;
    this.deployAt([lng, lat], undefined);
  }

  physicalTerrain(coords) {
    const native = this.surface?.()?.sourceElevation?.(...coords);
    if (Number.isFinite(native)) return {height:native,source:'HiRISE physical DEM',spacing:Math.max(5,knownTerrainHeight(...coords,this.viewer?.terrainProvider)?.spacing??5)};
    return knownTerrainHeight(...coords,this.viewer?.terrainProvider);
  }

  deployAt(coords, givenElevation, typeId) {
    if (typeId) {
      this.selectedEquipmentType = typeId;
    }
    const equip = EQUIPMENT_CATALOG.find(e => e.id === this.selectedEquipmentType);
    if (!equip) return null;


    const C = typeof window !== 'undefined' ? window.Cesium : null;
    const terrain=this.physicalTerrain(coords);
    let elevation=Number.isFinite(terrain?.height)?terrain.height:givenElevation;
    let terrainSource=Number.isFinite(terrain?.height)?terrain.source:'Supplied scenario elevation';
    if(!Number.isFinite(elevation)){
      elevation={VALLES_MARINERIS:-4500,GALE_CRATER:-4400,JEZERO_CRATER:-2500,ARCADIA_PLANITIA:-4000}[this.currentLocationId]??0;
      terrainSource='Assumed regional elevation; measured terrain unavailable';
    }
    const metric=terrain?terrainMetrics((lon,lat)=>this.physicalTerrain([lon,lat])?.height??NaN,...coords,terrain.spacing??200):null;
    const slopeDeg=metric?.slope??4.2,aspectDeg=Number.isFinite(metric?.aspect)?metric.aspect:180;
    const slopeSource=metric?'Physical DEM stencil':'Scenario slope/aspect assumptions';

    const inAppData = this.collectInAppData(coords, elevation, slopeDeg, aspectDeg);
    const telemetry = equip.computeTelemetry(coords, elevation, slopeDeg, aspectDeg, this.currentLocationId, inAppData);
    const existingOfType = this.deployed.filter(r => r.typeId === equip.id).length;
    const unitNumber = existingOfType + 1;
    const assignedName = existingOfType > 0 ? `${equip.name} #${unitNumber}` : equip.name;

    const record = {
      id: crypto.randomUUID(),
      typeId: equip.id,
      name: assignedName,
      unitNumber,
      icon: equip.icon,
      coords: [...coords],
      elevation: Math.round(elevation),
      terrainSource,
      slopeSource,
      slopeDeg: Number(slopeDeg.toFixed(1)),
      aspectDeg: Math.round(aspectDeg),
      deployedAt: new Date().toISOString(),
      locationId: this.currentLocationId,
      telemetry
    };

    this.deployed.push(record);
    this.create3DVisuals(record, equip);
    this.create2DVisuals(record, equip);
    this.selectEquipment(record.id, { flyCamera: false });
    this.cancelPlacement();
    this.syncDeployedList();
    this.renderBaseOperationsHUD();
    return record;
  }

  create3DVisuals(record, equip) {
    const C = typeof window !== 'undefined' ? window.Cesium : null;
    if (!C || !this.viewer) return;


    const scene = this.viewer.scene;
    const ellipsoid = scene.globe.ellipsoid;
    const terrainH = this.surface?.()?.sampleHeight?.(...record.coords) ?? scene.globe.getHeight(C.Cartographic.fromDegrees(...record.coords)) ?? (record.elevation ?? 0) * (this.terrainRelief?.scale ?? 1);
    const modelAnchor = C.Cartesian3.fromDegrees(record.coords[0], record.coords[1], terrainH, ellipsoid);

    const zoneRadius = equip.zoneRadius || 24.0;
    const zoneColor = equip.zoneColor || '#f0bd60';

    const ringEntity = this.viewer.entities.add({
      id: `deployed-ring-${record.id}`,
      position: modelAnchor,
      ellipse: {
        semiMajorAxis: zoneRadius,
        semiMinorAxis: zoneRadius,
        material: C.Color.fromCssColorString(zoneColor).withAlpha(zoneRadius > 100 ? 0.18 : 0.28),
        outline: true,
        outlineColor: C.Color.fromCssColorString(zoneColor),
        outlineWidth: zoneRadius > 100 ? 3 : 2,
        heightReference: C.HeightReference.CLAMP_TO_GROUND
      },
      billboard: {
        image: this.generateMarkerSVG(equip.id),
        width: 34,
        height: 34,
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        heightReference: C.HeightReference.CLAMP_TO_GROUND,
        pixelOffset: new C.Cartesian2(0, -12),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new C.DistanceDisplayCondition(2500, 300000)
      },
      label: {
        text: equip.zoneLabel ? `${record.name}\n[${equip.zoneLabel}]` : record.name,
        font: 'bold 11px sans-serif',
        fillColor: C.Color.fromCssColorString('#f4ebd9'),
        outlineColor: C.Color.BLACK,
        outlineWidth: 3,
        style: C.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        heightReference: C.HeightReference.CLAMP_TO_GROUND,
        pixelOffset: new C.Cartesian2(0, -28),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new C.DistanceDisplayCondition(80, 50000)
      }
    });
    this.entities.set(record.id, ringEntity);
    this.updateTacticalGrid();

    Promise.resolve().then(() => loadMarsModel(C, {
      url: equip.modelUrl,
      modelMatrix: C.Transforms.eastNorthUpToFixedFrame(modelAnchor, ellipsoid),
      heightReference: C.HeightReference.CLAMP_TO_GROUND,
      scene,
      scale: equip.scale,
      minimumPixelSize: 0,
      asynchronous: false,
      backFaceCulling: false,
      enableVerticalExaggeration: false,
      id: { deployedEquipmentId: record.id }
    })).then(model => {
      if (!this.deployed.some(r => r.id === record.id)) {
        if (model && !model.isDestroyed?.()) model.destroy?.();
        return;
      }
      scene.primitives.add(model);
      this.primitives.set(record.id, model);

      const cancelWatch = requestModelReady(model, scene, {
        current: () => this.deployed.some(r => r.id === record.id),
        ready: () => {
          scene.requestRender();
        },
        failed: () => {
          console.warn('Equipment 3D model failed to ready:', equip.name);
        }
      });
      if (cancelWatch) this.modelWatches.set(record.id, cancelWatch);

      scene.requestRender();
    }).catch(e => {
      console.warn('3D model load error:', e);
    });

    scene.requestRender();
  }

  onReliefChange(scale = 1.0) {
    const C = typeof window !== 'undefined' ? window.Cesium : null;
    if (!C || !this.viewer) return;
    const scene = this.viewer.scene;
    const ellipsoid = scene.globe.ellipsoid;

    for (const record of this.deployed) {
      const terrainH = this.surface?.()?.sampleHeight?.(...record.coords) ?? scene.globe.getHeight(C.Cartographic.fromDegrees(...record.coords)) ?? (record.elevation ?? 0) * (this.terrainRelief?.scale ?? 1);
      const pos = C.Cartesian3.fromDegrees(record.coords[0], record.coords[1], terrainH, ellipsoid);
      const entity = this.entities.get(record.id);
      if (entity) {
        entity.position = pos;
      }
      const model = this.primitives.get(record.id);
      if (model && !model.isDestroyed?.()) {
        model.modelMatrix = C.Transforms.eastNorthUpToFixedFrame(pos, ellipsoid);
      }
    }
    this.updateTacticalGrid();
    scene.requestRender();
  }

  create2DVisuals(record, equip) {
    const L = this.leaflet;
    if (!this.map || !L) return;

    const iconHtml = `<div class="deployed-map-pin"><span>${equipmentIcon(equip.id)}</span></div>`;
    const markerIcon = L.divIcon({
      html: iconHtml,
      className: 'deployed-leaflet-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([record.coords[1], record.coords[0]], { icon: markerIcon }).addTo(this.map);
    marker.on('click', () => {
      this.selectEquipment(record.id);
    });

    this.flatMarkers.set(record.id, marker);
  }

  collectInAppData(coords, elevation, slopeDeg, aspectDeg) {
    const lon = coords[0];
    const lat = coords[1];
    const elev = elevation ?? 0;

    const currentTime = this.solarLighting?.currentTime?.() || new Date().toISOString();
    let sun;
    try {
      sun = marsSun(currentTime);
    } catch {
      sun = marsSun('2026-10-29T12:00:00Z');
    }
    const solar = solarAt(sun, lon, lat);
    const flux0 = solarFlux(sun.distance_au);
    const solarMetrics = this.solarLighting?.computeMetrics?.(lon, lat, currentTime);
    const isSolarScrubbed = this.solarLighting?.mode === 'scrub';
    const scrubHour = this.solarLighting?.scrubHour;

    let wind = null;
    const windPacket = this.scienceMenu?.wind?.packet || this.cachedWindPacket;
    if (windPacket) {
      wind = sampleWind(windPacket, lon, lat);
    }

    let envTemp = null;
    let envPressure = null;
    let dustTau = 0.50;

    const envPacket = this.scienceMenu?.environment?.packet;
    if (envPacket) {
      const sampledVal = sampleEnvironment(envPacket, lon, lat);
      if (sampledVal !== null) {
        if (envPacket.parameter === 'Tsurf' || envPacket.parameter === 'Tair') {
          envTemp = sampledVal - 273.15;
        } else if (envPacket.parameter === 'Psurf') {
          envPressure = Math.round(sampledVal);
        } else if (envPacket.parameter === 'Dust') {
          dustTau = Number(sampledVal.toFixed(2));
        }
      }
    }

    if (this.dustPredictor?.lastResult?.contextDust !== undefined && Number.isFinite(this.dustPredictor.lastResult.contextDust)) {
      dustTau = Number(this.dustPredictor.lastResult.contextDust.toFixed(2));
    }

    let nearestMarsquake = null;
    let insightLanderDistKm = null;
    if (Array.isArray(SEISMIC_EVENTS) && SEISMIC_EVENTS.length > 0) {
      const insightLanderCoord = [135.62, 4.50];
      insightLanderDistKm = Math.round(marsDistance([lon, lat], insightLanderCoord) / 1000);
      const eventsWithDist = SEISMIC_EVENTS.map(ev => ({
        ...ev,
        distKm: Math.round(marsDistance([lon, lat], ev.epicenter) / 1000)
      })).sort((a, b) => a.distKm - b.distKm);
      nearestMarsquake = eventsWithDist[0];
    }

    return {
      currentTime,
      sun,
      solar,
      flux0,
      solarMetrics,
      isSolarScrubbed,
      scrubHour,
      wind,
      envTemp,
      envPressure,
      dustTau,
      nearestMarsquake,
      insightLanderDistKm,
      allDeployed: this.deployed
    };
  }

  async fetchInAppWeather() {
    if (this.cachedWindPacket || this.scienceMenu?.wind?.packet) return;
    try {
      const res = await fetch('/api/wind');
      if (res.ok) {
        const data = await res.json();
        if (data.schema === 'mars-wind/1' && Array.isArray(data.east)) {
          this.cachedWindPacket = data;
          this.updateAllTelemetry();
        }
      }
    } catch {}
  }

  onSolarChange(time, sun) {
    this.updateAllTelemetry();
  }

  updateAllTelemetry() {
    if (!this.deployed.length) return;
    for (const record of this.deployed) {
      const equip = EQUIPMENT_CATALOG.find(e => e.id === record.typeId);
      if (!equip) continue;
      const inAppData = this.collectInAppData(record.coords, record.elevation, record.slopeDeg, record.aspectDeg);
      record.telemetry = equip.computeTelemetry(record.coords, record.elevation, record.slopeDeg, record.aspectDeg, this.currentLocationId, inAppData);
    }
    this.syncDeployedList();
    this.renderBaseOperationsHUD();
    if (this.selectedDeployedId) {
      const selected = this.deployed.find(r => r.id === this.selectedDeployedId);
      if (selected) this.renderTelemetryDossier(selected);
    }
    this.viewer?.scene?.requestRender?.();
  }

  selectLocation(locationId) {
    this.currentLocationId = locationId;
    this.renderLocations();
    this.flyToCurrentLocation();
  }

  syncDeployedList() {
    const list = this.root?.querySelector('#deployed-stations-list');
    const emptyMsg = this.root?.querySelector('#deployed-empty-msg');
    const badge = this.root?.querySelector('#mission-active-badge');
    const tabCounter = this.root?.querySelector('#tab-deployed-count');
    const summaryBox = this.root?.querySelector('#fleet-cluster-summary');

    if (badge) {
      badge.textContent = `${this.deployed.length} Placed`;
    }
    if (tabCounter) {
      tabCounter.textContent = String(this.deployed.length);
    }
    if (!list) return;

    if (this.deployed.length === 0) {
      list.replaceChildren();
      if (emptyMsg) emptyMsg.hidden = false;
      if (summaryBox) summaryBox.hidden = true;
      const dossier = this.root?.querySelector('#telemetry-dossier-container');
      if (dossier) dossier.replaceChildren();
      return;
    }

    if (emptyMsg) emptyMsg.hidden = true;
    list.replaceChildren();

    if (summaryBox) {
      summaryBox.hidden = false;
      const overview = this.computeBaseOverview();
      const pills = [];
      if (overview.numSolar > 0) pills.push(`${equipmentIcon('solar_array')} ${overview.numSolar}x Solar (${(overview.solarGenKW).toFixed(2)} kW)`);
      if (overview.numNuclear > 0) pills.push(`${equipmentIcon('nuclear_reactor')} ${overview.numNuclear}x Kilopower (${overview.nuclearGenKW} kW)`);
      if (overview.numHab > 0) pills.push(`${equipmentIcon('crew_hab')} ${overview.numHab}x Hab (${overview.crewCapacity} Crew)`);
      if (overview.numGreenhouse > 0) pills.push(`${equipmentIcon('greenhouse_dome')} ${overview.numGreenhouse}x Biodome (+${(overview.numGreenhouse * 2.8).toFixed(1)} kg O2)`);
      if (overview.numISRU > 0) pills.push(`${equipmentIcon('isru_plant')} ${overview.numISRU}x ISRU (+${overview.totalWaterGen} L H2O)`);
      if (overview.numRover > 0) pills.push(`${equipmentIcon('crew_rover')} ${overview.numRover}x Rover`);
      if (overview.numComms > 0) pills.push(`${equipmentIcon('comms_mast')} ${overview.numComms}x Comms`);
      if (overview.numSeis > 0) pills.push(`${equipmentIcon('seis_station')} ${overview.numSeis}x Seis`);
      if (overview.numWeather > 0) pills.push(`${equipmentIcon('weather_station')} ${overview.numWeather}x REMS`);
      
      summaryBox.innerHTML = pills.map(p => `<span class="cluster-pill">${p}</span>`).join('');
    }

    for (const record of this.deployed) {
      const item = node('li', undefined, `deployed-item ${record.id === this.selectedDeployedId ? 'selected' : ''}`);

      const header = node('div', undefined, 'deployed-item-header');
      header.innerHTML = `
        <div class="deployed-item-name">
          <span>${equipmentIcon(record.typeId)}</span>
          <strong>${record.name}</strong>
        </div>
        <div class="deployed-item-actions">
          <button class="tool-secondary inspect-btn" title="Inspect Telemetry">Inspect</button>
          <button class="tool-secondary remove-btn" title="Remove Equipment">Remove</button>
        </div>
      `;

      const meta = node('div', undefined, 'deployed-item-meta');
      meta.innerHTML = `
        <span>${record.coords[1].toFixed(4)}°N, ${record.coords[0].toFixed(4)}°W</span> ·
        <span>${record.elevation} m</span> ·
        <span>Slope ${record.slopeDeg}°</span>
      `;

      item.append(header, meta);

      header.querySelector('.inspect-btn').onclick = () => {
        this.selectEquipment(record.id, { flyCamera: true });
      };

      header.querySelector('.remove-btn').onclick = () => {
        this.removeEquipment(record.id);
      };

      item.onclick = e => {
        if (!e.target.matches('button')) {
          this.selectEquipment(record.id, { flyCamera: false });
        }
      };

      list.append(item);
    }
  }

  selectEquipment(recordId, options = { flyCamera: false }) {
    this.selectedDeployedId = recordId;
    const record = this.deployed.find(r => r.id === recordId);
    if (!record) return;

    this.syncDeployedList();
    this.renderTelemetryDossier(record);

    if (options.flyCamera && this.viewer) {
      const C = typeof window !== 'undefined' ? window.Cesium : null;
      if (C) {
        const ellipsoid = this.viewer.scene.globe.ellipsoid;
        const terrainH = record.elevation ?? this.viewer.scene.globe.getHeight(C.Cartographic.fromDegrees(record.coords[0], record.coords[1])) ?? 0;
        const target = C.Cartesian3.fromDegrees(record.coords[0], record.coords[1], terrainH, ellipsoid);
        this.viewer.camera.flyToBoundingSphere(new C.BoundingSphere(target, 0), {
          offset: new C.HeadingPitchRange(0, -0.65, 1200),
          duration: 1.8
        });
      }
    }
  }

  renderTelemetryDossier(record) {
    const container = this.root?.querySelector('#telemetry-dossier-container');
    if (!container) return;
    container.replaceChildren();

    const t = record.telemetry;
    if (!t) return;

    const dossier = node('div', undefined, 'telemetry-dossier-card');
    const statusClass = t.status || 'nominal';

    const equip = EQUIPMENT_CATALOG.find(e => e.id === record.typeId);
    const sameTypeCount = this.deployed.filter(r => r.typeId === record.typeId).length;

    let clusterContributionHtml = '';
    if (sameTypeCount > 1) {
      let clusterSummary = '';
      if (record.typeId === 'solar_array') {
        const totalW = sameTypeCount * 640;
        clusterSummary = `Cluster fleet: ${sameTypeCount} units active (+${(totalW / 1000).toFixed(2)} kW combined power)`;
      } else if (record.typeId === 'crew_hab') {
        clusterSummary = `Cluster fleet: ${sameTypeCount} habs (${sameTypeCount * 4} Total Crew Capacity)`;
      } else if (record.typeId === 'nuclear_reactor') {
        clusterSummary = `Cluster fleet: ${sameTypeCount} reactors (${sameTypeCount * 40} kW Redundant Baseload)`;
      } else if (record.typeId === 'isru_plant') {
        clusterSummary = `Cluster fleet: ${sameTypeCount} plants (+${sameTypeCount * 25} L/sol H2O, +${sameTypeCount * 24} kg/sol O2)`;
      } else {
        clusterSummary = `Cluster fleet: ${sameTypeCount} units deployed across Martian base`;
      }
      clusterContributionHtml = `
        <div class="cluster-contribution-banner">
          <small>${equipmentIcon('power')} FLEET CONTRIBUTION (UNIT #${record.unitNumber || 1})</small>
          <strong>${clusterSummary}</strong>
        </div>
      `;
    }

    const itemsHtml = t.items.map(i => `
      <div class="telemetry-grid-row">
        <span class="telemetry-label">${i.label}</span>
        <strong class="telemetry-value">${i.value}</strong>
      </div>
    `).join('');

    dossier.innerHTML = `
      <div class="dossier-header">
        <div class="dossier-title">
          <span>${equipmentIcon(record.typeId)}</span>
          <strong>${record.name} Telemetry</strong>
        </div>
        <span class="dossier-status-pill ${statusClass}">${t.statusLabel || 'ACTIVE'}</span>
      </div>

      ${clusterContributionHtml}

      <div class="telemetry-grid">
        ${itemsHtml}
      </div>

      <!-- Action: Route Planner Waypoint Linkage -->
      <div class="dossier-actions-row">
        <button id="dossier-set-start-btn" class="tool-secondary dossier-act-btn">Set Start (A)</button>
        <button id="dossier-set-checkpoint-btn" class="tool-secondary dossier-act-btn">Checkpoint (C)</button>
        <button id="dossier-set-goal-btn" class="tool-secondary dossier-act-btn">Set Goal (B)</button>
      </div>

      <p class="telemetry-citation">Source: ${t.citation}</p><p class="tool-note">Terrain: ${record.terrainSource??'Legacy scenario input'}. ${record.slopeSource??'Slope basis not recorded'}. Equipment outputs are scenario estimates.</p>
    `;

    container.append(dossier);

    if(record.typeId==='comms_mast'&&this.host.openCoverage){
      const coverage=node('button','Simulate coverage from this mast','tool-secondary');
      coverage.type='button';coverage.onclick=()=>this.host.openCoverage(record.coords);
      dossier.querySelector('.dossier-actions-row').after(coverage);
    }

    const startBtn = dossier.querySelector('#dossier-set-start-btn');
    if (startBtn) {
      startBtn.onclick = () => {
        if (this.host.routePlanner) {
          this.host.routePlanner.setPoint('start', record.coords);
          this.host.routePlanner.render?.();
          this.host.routePlanner.open?.(true);
        }
      };
    }

    const goalBtn = dossier.querySelector('#dossier-set-goal-btn');
    if (goalBtn) {
      goalBtn.onclick = () => {
        if (this.host.routePlanner) {
          this.host.routePlanner.setPoint('goal', record.coords);
          this.host.routePlanner.render?.();
          this.host.routePlanner.open?.(true);
        }
      };
    }

    const chkBtn = dossier.querySelector('#dossier-set-checkpoint-btn');
    if (chkBtn) {
      chkBtn.onclick = () => {
        if (this.host.routePlanner) {
          this.host.routePlanner.setPoint('target', record.coords);
          this.host.routePlanner.render?.();
          this.host.routePlanner.open?.(true);
        }
      };
    }
  }

  updateTacticalGrid() {
    const C = typeof window !== 'undefined' ? window.Cesium : null;
    if (!C || !this.viewer) return;

    for (const conduit of this.conduitEntities.values()) {
      this.viewer.entities.remove(conduit);
    }
    this.conduitEntities.clear();

    if (!this.showGridConduits || this.deployed.length < 2) {
      this.viewer.scene.requestRender();
      return;
    }

    const scene = this.viewer.scene;
    const ellipsoid = scene.globe.ellipsoid;

    const hub = this.deployed.find(r => r.typeId === 'crew_hab')
      || this.deployed.find(r => r.typeId === 'nuclear_reactor')
      || this.deployed.find(r => r.typeId === 'comms_mast')
      || this.deployed[0];

    const hubPos = C.Cartesian3.fromDegrees(hub.coords[0], hub.coords[1], 0, ellipsoid);

    for (const station of this.deployed) {
      if (station.id === hub.id) continue;
      const stationPos = C.Cartesian3.fromDegrees(station.coords[0], station.coords[1], 0, ellipsoid);
      const isNuclearLink = station.typeId === 'nuclear_reactor' || hub.typeId === 'nuclear_reactor';
      const isISRU = station.typeId === 'isru_plant';
      const lineColor = isNuclearLink ? '#f0bd60' : (isISRU ? '#4da3ff' : '#73cde3');

      const conduit = this.viewer.entities.add({
        id: `conduit-${hub.id}-${station.id}`,
        polyline: {
          positions: [hubPos, stationPos],
          clampToGround: true,
          width: 3.5,
          material: new C.PolylineGlowMaterialProperty({
            glowPower: 0.35,
            color: C.Color.fromCssColorString(lineColor)
          }),
          distanceDisplayCondition: new C.DistanceDisplayCondition(20, 250000)
        }
      });
      this.conduitEntities.set(`${hub.id}-${station.id}`, conduit);
    }

    this.viewer.scene.requestRender();
  }

  computeBaseOverview() {
    const counts = {};
    for (const r of this.deployed) {
      counts[r.typeId] = (counts[r.typeId] || 0) + 1;
    }

    const numSolar = counts['solar_array'] || 0;
    const numNuclear = counts['nuclear_reactor'] || 0;
    const numHab = counts['crew_hab'] || 0;
    const numGreenhouse = counts['greenhouse_dome'] || 0;
    const numISRU = counts['isru_plant'] || 0;
    const numRover = counts['crew_rover'] || 0;
    const numComms = counts['comms_mast'] || 0;
    const numSeis = counts['seis_station'] || 0;
    const numWeather = counts['weather_station'] || 0;

    let solarGenKW = 0;
    for (const r of this.deployed) {
      if (r.typeId === 'solar_array') {
        const pItem = r.telemetry?.items?.find(i => i.label.includes('Power Output'));
        const w = pItem ? parseFloat(pItem.value) : 600;
        solarGenKW += (w / 1000);
      }
    }
    const nuclearGenKW = numNuclear * 40.0;
    const totalPowerGen = Number((solarGenKW + nuclearGenKW).toFixed(2));

    let totalPowerLoad = (numHab * 12.0) + (numGreenhouse * 8.0) + (numISRU * 18.0) + 
                         (numRover * 2.5) + (numComms * 1.2) + 
                         (numSeis * 0.2) + (numWeather * 0.1);
    totalPowerLoad = Number(totalPowerLoad.toFixed(2));

    const crewCapacity = numHab * 4;
    const totalO2Load = Number((numHab * 3.36).toFixed(2));
    const totalWaterLoad = Number((numHab * 16.0).toFixed(1));

    const totalO2Gen = Number(((numGreenhouse * 2.8) + (numISRU * 24.0)).toFixed(2));
    const isArcadia = this.currentLocationId === 'ARCADIA_PLANITIA';
    const waterRatePerISRU = isArcadia ? 60.0 : 25.0;
    const totalWaterGen = Number((numISRU * waterRatePerISRU).toFixed(1));

    const netPower = Number((totalPowerGen - totalPowerLoad).toFixed(2));
    const netO2 = Number((totalO2Gen - totalO2Load).toFixed(2));
    const netWater = Number((totalWaterGen - totalWaterLoad).toFixed(1));

    let stormSurvivability = 'NO CREW HABITAT';
    if (numHab > 0) {
      if (numNuclear > 0) {
        stormSurvivability = `INDESTRUCTIBLE (${numNuclear * 40} kW Nuclear Fission Active)`;
      } else if (numSolar > 0) {
        stormSurvivability = `VULNERABLE (Solar Only - Storm Dust Shutdown Risk)`;
      } else {
        stormSurvivability = 'CRITICAL (Unpowered Hab - Immediate ECLSS Failure)';
      }
    }

    return {
      counts,
      numSolar,
      numNuclear,
      numHab,
      numGreenhouse,
      numISRU,
      numRover,
      numComms,
      numSeis,
      numWeather,
      solarGenKW: Number(solarGenKW.toFixed(2)),
      nuclearGenKW,
      totalPowerGen,
      totalPowerLoad,
      netPower,
      isPowerSurplus: netPower >= 0,
      totalO2Gen,
      totalO2Load,
      netO2,
      totalWaterGen,
      totalWaterLoad,
      netWater,
      crewCapacity,
      hasNuclear: numNuclear > 0,
      hasComms: numComms > 0,
      hasHab: numHab > 0,
      hasGreenhouse: numGreenhouse > 0,
      hasISRU: numISRU > 0,
      dustStormSurvivability: stormSurvivability
    };
  }

  renderBaseOperationsHUD() {
    const sec = this.root?.querySelector('#base-operations-section');
    const hud = this.root?.querySelector('#base-operations-hud');
    if (!sec || !hud) return;

    if (!this.deployed.length) {
      sec.hidden = true;
      return;
    }

    sec.hidden = false;
    const overview = this.computeBaseOverview();

    const powerPct = overview.totalPowerLoad > 0 
      ? Math.min(100, Math.round((overview.totalPowerGen / overview.totalPowerLoad) * 100))
      : (overview.totalPowerGen > 0 ? 100 : 0);

    const powerClass = overview.isPowerSurplus ? 'nominal' : 'warning';
    const o2Class = overview.netO2 >= 0 ? 'nominal' : 'warning';
    const waterClass = overview.netWater >= 0 ? 'nominal' : 'warning';
    const stormClass = overview.hasNuclear ? 'nominal' : (overview.hasHab ? 'caution' : 'warning');

    hud.innerHTML = `
      <div class="base-hud-card">
        <div class="base-hud-header">
          <div class="base-hud-title">
            <span class="base-hud-badge">OUTPOST COMMAND</span>
            <strong>Martian Base Operations Grid</strong>
          </div>
          <span class="hud-status-pill ${powerClass}">${overview.isPowerSurplus ? 'GRID STABLE (+SURPLUS)' : 'POWER DEFICIT'}</span>
        </div>

        <!-- Power Grid Balance -->
        <div class="base-hud-row">
          <div class="base-metric-col">
            <small>Surface Power Grid (Gen / Demand)</small>
            <div class="base-metric-val">
              <strong class="${powerClass}">${overview.totalPowerGen} kW</strong>
              <span>/ ${overview.totalPowerLoad} kW</span>
              <span class="metric-delta ${powerClass}">(${overview.netPower >= 0 ? '+' : ''}${overview.netPower} kW)</span>
            </div>
            <div class="base-progress-bar">
              <div class="progress-fill ${powerClass}" style="width: ${powerPct}%;"></div>
            </div>
          </div>
        </div>

        <!-- ECLSS Consumables & Crew -->
        <div class="base-hud-grid-3">
          <div class="base-metric-card">
            <small>Habitation</small>
            <strong>${overview.crewCapacity} Crew</strong>
            <span class="sub-note">${overview.hasHab ? `${overview.numHab} TransHab Core` : 'No Habitation'}</span>
          </div>
          <div class="base-metric-card">
            <small>Oxygen (Net O2)</small>
            <strong class="${o2Class}">${overview.netO2 >= 0 ? '+' : ''}${overview.netO2} kg/sol</strong>
            <span class="sub-note">${overview.totalO2Gen} gen / ${overview.totalO2Load} use</span>
          </div>
          <div class="base-metric-card">
            <small>Water (Net H2O)</small>
            <strong class="${waterClass}">${overview.netWater >= 0 ? '+' : ''}${overview.netWater} L/sol</strong>
            <span class="sub-note">${overview.totalWaterGen} gen / ${overview.totalWaterLoad} use</span>
          </div>
        </div>

        <!-- Dust Storm Survivability Banner -->
        <div class="base-storm-banner ${stormClass}">
          <div class="storm-badge-row">
            <span>${equipmentIcon('dust')} Dust Storm Survivability</span>
            <span class="storm-badge">${overview.hasNuclear ? 'NUCLEAR SECURED' : (overview.hasHab ? 'SOLAR-DEPENDENT' : 'UNMANNED')}</span>
          </div>
          <p class="storm-status-text">${overview.dustStormSurvivability}</p>
        </div>

        <!-- Power Grid Conduits Toggle -->
        <div class="conduit-toggle-bar">
          <label class="conduit-checkbox-label">
            <input type="checkbox" id="deploy-conduit-toggle" ${this.showGridConduits ? 'checked' : ''}>
            <span>Tactical Surface Power Conduits</span>
          </label>
        </div>
      </div>
    `;

    const conduitCheck = hud.querySelector('#deploy-conduit-toggle');
    if (conduitCheck) {
      conduitCheck.onchange = e => {
        this.showGridConduits = e.target.checked;
        this.updateTacticalGrid();
      };
    }
  }

  removeEquipment(recordId) {
    const idx = this.deployed.findIndex(r => r.id === recordId);
    if (idx < 0) return;

    this.deployed.splice(idx, 1);

    const model = this.primitives.get(recordId);
    if (model && this.viewer) {
      this.viewer.scene.primitives.remove(model);
      if (!model.isDestroyed?.()) model.destroy?.();
      this.primitives.delete(recordId);
    }

    const cancelWatch = this.modelWatches.get(recordId);
    if (cancelWatch) {
      cancelWatch();
      this.modelWatches.delete(recordId);
    }

    const entity = this.entities.get(recordId);
    if (entity && this.viewer) {
      this.viewer.entities.remove(entity);
      this.entities.delete(recordId);
    }

    const marker = this.flatMarkers.get(recordId);
    if (marker && this.map) {
      marker.remove();
      this.flatMarkers.delete(recordId);
    }

    if (this.selectedDeployedId === recordId) {
      this.selectedDeployedId = this.deployed.length ? this.deployed[0].id : null;
    }

    this.updateTacticalGrid();
    this.syncDeployedList();
    this.renderBaseOperationsHUD();

    if (this.selectedDeployedId) {
      this.selectEquipment(this.selectedDeployedId, { flyCamera: false });
    } else {
      const container = this.root?.querySelector('#telemetry-dossier-container');
      if (container) container.replaceChildren();
    }

    this.viewer?.scene?.requestRender();
  }

  clearAll() {
    for (const record of [...this.deployed]) {
      this.removeEquipment(record.id);
    }
    this.deployed = [];
    this.selectedDeployedId = null;
    this.syncDeployedList();
    this.renderBaseOperationsHUD();
    const container = this.root?.querySelector('#telemetry-dossier-container');
    if (container) container.replaceChildren();
  }

  exportJSON() {
    if (!this.deployed.length) return;
    const baseSummary = this.computeBaseOverview();
    const payload = {
      schema: 'mars-tactical-mission-manifest/1.0',
      exportedAt: new Date().toISOString(),
      location: MISSION_LOCATIONS.find(l => l.id === this.currentLocationId),
      baseOperations: baseSummary,
      instruments: this.deployed.map(d => ({
        id: d.id,
        typeId: d.typeId,
        name: d.name,
        unitNumber: d.unitNumber,
        coords: d.coords,
        elevation_m: d.elevation,
        slope_deg: d.slopeDeg,
        telemetry: d.telemetry
      }))
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mars_Mission_${this.currentLocationId}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  generateMarkerSVG(icon) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
        <circle cx="17" cy="17" r="14" fill="#0d151e" stroke="#f0bd60" stroke-width="2.5"/>
        <g transform="translate(7 7)" color="#9fe4cf">${equipmentIcon(icon)}</g>
      </svg>
    `;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
  }
}

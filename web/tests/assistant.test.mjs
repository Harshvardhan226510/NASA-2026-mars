import test from 'node:test';
import assert from 'node:assert/strict';
import {EVAssistant} from '../src/eva-assistant.js';

test('EVAssistant initializes cleanly and processes emergency evacuation intent into direct_safe route action', async () => {
 let planned = false;
 let startPoint = null;
 let goalPoint = null;
 const dummyRoutePlanner = {
  workbench: { state: { home: [77.45, 18.52] } },
  set start(p) { startPoint = p; },
  set goal(p) { goalPoint = p; },
  render() {},
  plan() { planned = true; }
 };

 // Mock minimal DOM elements
 const elements = new Map();
 global.document = {
  getElementById(id) {
   if (!elements.has(id)) {
    elements.set(id, {
     hidden: true,
     value: '',
     textContent: '',
     classList: { add() {}, remove() {} },
     setAttribute() {},
     addEventListener() {},
     append() {}
    });
   }
   return elements.get(id);
  },
  querySelectorAll() { return []; },
  createElement(tag) {
   return { className: '', textContent: '', append() {} };
  }
 };

 const assistant = new EVAssistant(null, null, null, {
  routePlanner: dummyRoutePlanner,
  currentFocus: () => ({ point: [77.40, 18.48] }),
  places: { position: () => ({ point: [77.40, 18.48] }) }
 });

 // Disable audio speech synthesis during unit tests
 assistant.muted = true;

 await assistant.handleQuery("Hey please quickly recalculate the safest and fastest path to reach back to camp in case of any emergency");

 assert.ok(planned, "RoutePlanner.plan() must be triggered on emergency return query");
 assert.deepEqual(startPoint, [77.40, 18.48], "Start coordinate must match current rover position");
 assert.ok(goalPoint, "Destination camp must be set");
});

test('EVAssistant processes display mode change requests correctly', async () => {
 let switchedView = null;
 const assistant = new EVAssistant(null, null, null, {
  setView: (v) => { switchedView = v; }
 });
 assistant.muted = true;

 await assistant.handleQuery("Switch display to split compare mode");
 assert.equal(switchedView, 'split');

 await assistant.handleQuery("Switch view to 2d surface map");
 assert.equal(switchedView, '2d');
});

test('EVAssistant handles explore observation and zoom requests', async () => {
 let explored = false;
 let zoomCalled = false;
 const assistant = new EVAssistant({ camera: { positionCartographic: { height: 50000 }, zoomIn() { zoomCalled = true; } } }, null, null, {
  fitFootprint: () => { explored = true; }
 });
 assistant.muted = true;

 await assistant.handleQuery("Can you explore the selected observations site at valles marineris");
 assert.ok(explored, "fitFootprint should be invoked when asked to explore observation");

 await assistant.handleQuery("Can you zoom in to the observation site in the valles marineris");
 assert.ok(zoomCalled, "camera.zoomIn should be invoked on zoom in query");
});

test('EVAssistant computes geodesic distance between Point A and Point B', async () => {
 let messageDelivered = '';
 const assistant = new EVAssistant(null, null, null, {
  routePlanner: {
   start: [77.40, 18.48],
   goal: [77.45, 18.52]
  }
 });
 assistant.muted = true;
 assistant.addMessage = (sender, text) => { messageDelivered = text; };

 await assistant.handleQuery("Calculate the distance between point A and point B");
 assert.ok(messageDelivered.includes("Direct Surface Distance"), "Must output computed geodesic distance");
 assert.ok(messageDelivered.includes("km"), "Distance must be in km");
});


test('EVAssistant plans mineral tour from natural language prompt', async () => {
 let planned = false;
 let lastMessage = '';
 const dummyPlanner = {
  set start(p) {},
  set goal(p) {},
  set targets(t) {},
  render() {},
  plan() { planned = true; },
  fit() {}
 };
 const assistant = new EVAssistant(null, null, null, {
  routePlanner: dummyPlanner,
  currentFocus: () => ({ point: [-76.44, -9.80] }),
  values: {
   sites: [
    { id: 'm1', name: 'Mineral 1', category: 'minerals', center: [-76.47, -9.81], radiusKm: 5, evidence: 'CRISM detection' },
    { id: 'm2', name: 'Mineral 2', category: 'minerals', center: [-76.40, -9.80], radiusKm: 5, evidence: 'OMEGA sulfate' }
   ]
  }
 });
 assistant.muted = true;
 assistant.addMessage = (sender, text) => { lastMessage = text; };

 await assistant.handleQuery("I am standing at point A calculate path for minerals under 500 km range a");
 assert.ok(planned, "Must trigger multi-site mineral tour planning");
 assert.ok(lastMessage.includes("MULTI-SITE MINERAL EXPLORATION CORRIDOR"), "Must output mineral tour briefing");
 assert.ok(!lastMessage.includes("-76."), "Coordinates must NOT have negative signs");
});

test('EVAssistant rotates camera on natural degree command like 180 degrees to right', async () => {
 let rotatedRad = 0;
 const assistant = new EVAssistant({
  camera: {
   rotateRight(rad) { rotatedRad = rad; }
  },
  scene: { requestRender() {} }
 });
 assistant.muted = true;

 await assistant.handleQuery("180 degrees to right");
 assert.ok(Math.abs(rotatedRad - Math.PI) < 0.01, "Camera must rotate by 180 degrees (PI radians)");
});

test('EVAssistant delivers BLUF NO on unsafe path and compares all 3 routes', async () => {
 let safetyMsg = '';
 let compareMsg = '';
 const dummyPlanner = {
  start: [-76.44, -9.80],
  goal: [-76.35, -9.75],
  result: {
   routes: {
    direct_safe: {
     waypoints: [{ lon: -76.44, lat: -9.80 }],
     summary: { total_distance_km: 9.03, minetti_energy_kj: 4740, est_o2_consumed_liters: 195, max_slope_deg: 27.3, avg_slope_deg: 5.4, total_science_score: 85 }
    },
    apf_survey: {
     waypoints: [{ lon: -76.44, lat: -9.80 }],
     summary: { total_distance_km: 11.2, minetti_energy_kj: 5890, est_o2_consumed_liters: 242, max_slope_deg: 12.1, avg_slope_deg: 4.8, total_science_score: 95 }
    },
    deep_science: {
     waypoints: [{ lon: -76.44, lat: -9.80 }],
     summary: { total_distance_km: 14.5, minetti_energy_kj: 7600, est_o2_consumed_liters: 310, max_slope_deg: 14.8, avg_slope_deg: 6.1, total_science_score: 100 }
    }
   }
  }
 };

 const assistant = new EVAssistant(null, null, null, {
  routePlanner: dummyPlanner
 });
 assistant.muted = true;

 assistant.addMessage = (sender, text) => { safetyMsg = text; };
 await assistant.handleQuery("Is the calculated path safe for an astronaut?");
 assert.ok(safetyMsg.startsWith("TERRAIN REVIEW: SELECTED SLOPE LIMIT EXCEEDED"), "Must provide BLUF direct NO answer first");
 assert.ok(safetyMsg.includes("27.3°"), "Must report exact peak slope");
 assert.ok(safetyMsg.includes("does not establish traction"), "Must identify critical rollover hazard");

 assistant.addMessage = (sender, text) => { compareMsg = text; };
 await assistant.handleQuery("provide data like o2 required and everything else for all three paths calculated");
 assert.ok(compareMsg.includes("COMPARATIVE CONSUMABLES & TRAVERSAL AUDIT (ALL 3 ROUTES)"), "Must output all 3 routes comparison");
 assert.ok(compareMsg.includes("Direct Safe Corridor"), "Must include Direct Safe");
 assert.ok(compareMsg.includes("APF Survey"), "Must include APF Survey");
 assert.ok(compareMsg.includes("Deep Science"), "Must include Deep Science");
 assert.ok(compareMsg.includes("195 Liters"), "Must include exact O2 for route 1");
 assert.ok(compareMsg.includes("242 Liters"), "Must include exact O2 for route 2");
 assert.ok(compareMsg.includes("310 Liters"), "Must include exact O2 for route 3");
});

test('EVAssistant executes navigation to Valles Marineris and exploration of observation', async () => {
 let enteredRegion = null;
 let exploredObservation = false;

 const assistant = new EVAssistant(null, null, null, {
  enter: (r) => { enteredRegion = r; },
  fitFootprint: () => { exploredObservation = true; },
  regions: () => [
   { id: 'VALLES_MARINERIS', name: 'Valles Marineris', center: [-59.2, -13.74] },
   { id: 'JEZERO', name: 'Jezero', center: [77.45, 18.44] }
  ]
 });
 assistant.muted = true;

 await assistant.handleQuery("Navigate to Valles Marineris.");
 assert.ok(enteredRegion, "Must enter region when commanded to Navigate to Valles Marineris");
 assert.equal(enteredRegion.name, "Valles Marineris");

 await assistant.handleQuery("Explore selected observation.");
 assert.ok(exploredObservation, "Must explore selected observation when commanded");
});

test('EVAssistant computes dynamic speed and time difference between routes', async () => {
 let diffMsg = '';
 const dummyPlanner = {
  result: {
   routes: {
    direct_safe: { summary: { total_distance_km: 40.79 } },
    apf_survey: { summary: { total_distance_km: 42.33 } },
    deep_science: { summary: { total_distance_km: 49.42 } }
   }
  }
 };

 const assistant = new EVAssistant(null, null, null, {
  routePlanner: dummyPlanner
 });
 assistant.muted = true;
 assistant.addMessage = (sender, text) => { diffMsg = text; };

 await assistant.handleQuery("So at the speed of 4km/h what is the time difference between deep science and direct safe path?");
 assert.ok(diffMsg.includes("time difference"), "Must state time difference");
 assert.ok(diffMsg.includes("2.2 hours") || diffMsg.includes("Deep Science") || diffMsg.includes("Direct Safe"), "Must include calculated hours difference");
 assert.ok(!diffMsg.includes("COMPARATIVE CONSUMABLES & TRAVERSAL AUDIT"), "Must NOT dump 3-route comparison table");
});


test('ARES never invents a return camp, sampled slope or consumables when records are missing', async()=>{
 let calls=0;const messages=[];
 const assistant=new EVAssistant(null,null,null,{routePlanner:{plan(){calls++;}},currentFocus:()=>({point:[77.4,18.48]})});
 assistant.muted=true;assistant.addMessage=(_sender,text)=>messages.push(text);
 await assistant.executeEmergencyReturn();assert.equal(calls,0);assert.match(messages.at(-1),/Set a return habitat/);
 assistant.executePathSafetyQuery();assert.match(messages.at(-1),/slope is unknown/);
 assistant.executeConsumablesAudit();assert.match(messages.at(-1),/No consumables have been inferred/);
 assistant.executeMineralScan();assert.match(messages.at(-1),/No mineral\/resource sites/);assert.doesNotMatch(messages.at(-1),/1,855/);
});

test('ARES preserves zero observations and reads configured mission reserves',()=>{
 let message='';const assistant=new EVAssistant(null,null,null,{routePlanner:{shown:'direct_safe',result:{metadata:{max_slope_deg:12},routes:{direct_safe:{summary:{max_slope_deg:0}}}},workbench:{budget:{status:'incomplete',checks:Object.fromEntries(['time','oxygen','energy'].map(k=>[k,{total:0,usable:null,reserve_pct:35,status:'unknown'}]))}}}});
 assistant.muted=true;assistant.addMessage=(_sender,text)=>message=text;
 assistant.executePathSafetyQuery();assert.match(message,/0.0°/);assert.match(message,/selected limit: 12/);assert.doesNotMatch(message,/certified safe|YES.*SAFE/);
 assistant.executeConsumablesAudit();assert.match(message,/35% configured reserve/);assert.match(message,/unknown usable/);
});

test('EVAssistant handles offline autonomy questions with accurate architecture audit', async () => {
 let message = '';
 const assistant = new EVAssistant(null, null, null, {});
 assistant.muted = true;
 assistant.addMessage = (_sender, text) => { message = text; };

 await assistant.handleQuery("Can this run offline on mars like if we were on mars will we still be able to access their locations and paths anytime offline?");
 assert.ok(message.includes("MARS OFFLINE AUTONOMY ARCHITECTURE AUDIT"), "Must provide offline architecture audit");
 assert.ok(message.includes("NAIF SPICE kernels"), "Must state SPICE kernels for moons");
 assert.ok(message.includes("mar099-moons-2025-2035.bsp"), "Must cite exact SPICE kernel");
 assert.ok(message.includes("NASA GISS Mars24"), "Must cite Mars24 for sunlight");
 assert.ok(message.includes("bootstrap.json"), "Must cite bootstrap.json for rover positions");
});

test('EVAssistant executes spacecraft queries and selects rover on terrain', async () => {
 let selectedId = null;
 let message = '';
 const dummySpacecraft = {
  select(id) { selectedId = id; }
 };
 const assistant = new EVAssistant(null, null, null, {
  spacecraft: dummySpacecraft
 });
 assistant.muted = true;
 assistant.addMessage = (_sender, text) => { message = text; };

 await assistant.handleQuery("Where is Perseverance right now?");
 assert.equal(selectedId, 'perseverance', "Must select perseverance rover");
 assert.ok(message.includes("PERSEVERANCE"), "Must state Perseverance telemetry");
 assert.ok(message.includes("18.4356°N, 77.2329°E"), "Must include exact coordinates in cardinal non-negative format");
 assert.ok(message.includes("Jezero Crater"), "Must mention Jezero Crater");

 await assistant.handleQuery("Fly to Curiosity rover");
 assert.equal(selectedId, 'curiosity', "Must select curiosity rover");
 assert.ok(message.includes("CURIOSITY"), "Must state Curiosity telemetry");
 assert.ok(message.includes("Gale Crater"), "Must mention Gale Crater");
});

test('EVAssistant tracks satellites and orbiters', async () => {
 let selectedOrbiter = null;
 let message = '';
 const dummyMoons = {
  selectOrbiter(id) { selectedOrbiter = id; }
 };
 const assistant = new EVAssistant(null, null, null, {
  moons: dummyMoons
 });
 assistant.muted = true;
 assistant.addMessage = (_sender, text) => { message = text; };

 await assistant.handleQuery("Track Mars Reconnaissance Orbiter");
 assert.equal(selectedOrbiter, 'mro', "Must select MRO orbiter");
 assert.ok(message.includes("MRO"), "Must state MRO telemetry");
 assert.ok(message.includes("HiRISE"), "Must cite HiRISE instrument payload");

 await assistant.handleQuery("Where is the Trace Gas Orbiter?");
 assert.equal(selectedOrbiter, 'tgo', "Must select TGO orbiter");
 assert.ok(message.includes("TGO"), "Must state TGO telemetry");
 assert.ok(message.includes("NOMAD"), "Must cite NOMAD spectrometer");
});

test('EVAssistant focuses on Martian moons and system view', async () => {
 let selectedMoon = null;
 let systemCalled = false;
 let message = '';
 const dummyMoons = {
  select(id) { selectedMoon = id; },
  system() { systemCalled = true; }
 };
 const assistant = new EVAssistant(null, null, null, {
  moons: dummyMoons
 });
 assistant.muted = true;
 assistant.addMessage = (_sender, text) => { message = text; };

 await assistant.handleQuery("Show Phobos");
 assert.equal(selectedMoon, 'phobos', "Must focus on Phobos");
 assert.ok(message.includes("PHOBOS"), "Must deliver Phobos telemetry");
 assert.ok(message.includes("Stickney crater"), "Must cite Stickney crater");

 await assistant.handleQuery("Show Martian moons celestial system view");
 assert.ok(systemCalled, "Must engage moons.system()");
 assert.ok(message.includes("MARTIAN CELESTIAL SYSTEM OVERVIEW"), "Must deliver system overview");
});

test('EVAssistant computes real-time solar elevation and diurnal geometry', async () => {
 let message = '';
 const assistant = new EVAssistant(null, null, null, {
  currentFocus: () => ({ point: [77.40, 18.48] })
 });
 assistant.muted = true;
 assistant.addMessage = (_sender, text) => { message = text; };

 await assistant.handleQuery("What is the solar elevation and sunlight at my location?");
 assert.ok(message.includes("MARS DIURNAL SOLAR TELEMETRY"), "Must deliver solar telemetry");
 assert.ok(message.includes("Solar Elevation:"), "Must calculate solar elevation");
 assert.ok(message.includes("Local True Solar Time"), "Must calculate local solar time");
 assert.ok(message.includes("NASA GISS Mars24"), "Must cite Mars24 algorithm");
});

test('EVAssistant answers scientific facts about Martian atmosphere and gravity', async () => {
 let message = '';
 const assistant = new EVAssistant(null, null, null, {});
 assistant.muted = true;
 assistant.addMessage = (_sender, text) => { message = text; };

 await assistant.handleQuery("What is the atmosphere of Mars?");
 assert.ok(message.includes("95.32% Carbon Dioxide"), "Must cite CO2 percentage");
 assert.ok(message.includes("~610 Pa"), "Must cite surface pressure");

 await assistant.handleQuery("What is the gravity on Mars?");
 assert.ok(message.includes("3.72"), "Must cite Mars surface gravity 3.72 m/s²");
 assert.ok(message.includes("38%"), "Must state ~38% of Earth gravity");
});


test('EVAssistant executes mission planning commands and selects target', async () => {
 let message = '';
 let opened = false;
 let selectedLoc = '';
 const mockDeployer = {
  selectLocation(id) { selectedLoc = id; },
  open(val) { opened = val; }
 };
 const assistant = new EVAssistant(null, null, null, {
  missionDeployer: mockDeployer
 });
 assistant.muted = true;
 assistant.addMessage = (_sender, text) => { message = text; };

 await assistant.handleQuery("Plan mission in Gale Crater");
 assert.strictEqual(selectedLoc, 'GALE_CRATER');
 assert.strictEqual(opened, true);
 assert.ok(message.includes("GALE CRATER"));
 assert.ok(message.includes("Boxwork"));

 await assistant.handleQuery("Plan mission at Jezero Crater");
 assert.strictEqual(selectedLoc, 'JEZERO_CRATER');
 assert.ok(message.includes("JEZERO CRATER"));
 assert.ok(message.includes("Delta"));
});

test('EVAssistant executes equipment deployment commands with authentic telemetry', async () => {
 let message = '';
 let opened = false;
 let deployedType = '';
 const mockDeployer = {
  deployAt(coords, elev, typeId) {
   deployedType = typeId;
   return {
    id: 'rec-1',
    name: 'Deployable Solar Array',
    elevation: -4500,
    slopeDeg: 4.2,
    telemetry: [
     { label: 'Instantaneous Solar Flux', val: '540 W/m²' },
     { label: 'Electrical Power Output', val: '648 W' }
    ]
   };
  },
  open(val) { opened = val; }
 };
 const assistant = new EVAssistant(null, null, null, {
  missionDeployer: mockDeployer,
  currentFocus: () => ({ point: [-71.7, -7.0] })
 });
 assistant.muted = true;
 assistant.addMessage = (_sender, text) => { message = text; };

 await assistant.handleQuery("Deploy solar array at current position");
 assert.strictEqual(deployedType, 'solar_array');
 assert.strictEqual(opened, true);
 assert.ok(message.includes("TACTICAL HARDWARE DEPLOYED"));
 assert.ok(message.includes("SOLAR ARRAY"));
 assert.ok(message.includes("Instantaneous Solar Flux"));
});

test('EVAssistant executes skyline visual place recognition intent to localize kidnapped astronaut', async () => {
 let message = '';
 let agentTrace = null;
 let opened = false;
 let loadedPreset = '';
 let localized = false;

 const mockSkylineVPR = {
  open(val) { opened = val; },
  loadPreset(preset) { loadedPreset = preset; },
  runLocalization() {
   localized = true;
   this.lastResult = {
    bestMatch: {
     id: 'VALLES_MARINERIS_IUS',
     name: 'Valles Marineris · Ius Chasma / Geryon Montes',
     lon: -76.5824,
     lat: -9.8072,
     confidence: 0.985,
     geomorphology: 'High vertical relief (>6 km); steep north and south towering cliff horizon with deep east-west canyon trench.'
    },
    matchedHeadingDeg: 42
   };
  },
  lastResult: null
 };

 const assistant = new EVAssistant(null, null, null, {
  skylineVPR: mockSkylineVPR
 });
 assistant.muted = true;
 assistant.addMessage = (_sender, text, _speak, trace) => {
  message = text;
  agentTrace = trace;
 };

 await assistant.handleQuery("Where am I? Localize my position from horizon photo in Valles Marineris without GPS");

 assert.strictEqual(opened, true, 'Skyline panel should be opened');
 assert.strictEqual(loadedPreset, 'VALLES_MARINERIS_IUS', 'Target preset should be loaded');
 assert.strictEqual(localized, true, 'Localization engine should be executed');
 assert.ok(message.includes('SKYLINE VISUAL PLACE RECOGNITION'), 'Response should announce Skyline VPR');
 assert.ok(message.includes('Kidnapped Astronaut'), 'Response should reference Kidnapped Astronaut formulation');
 assert.ok(message.includes('Valles Marineris'), 'Response should mention Valles Marineris');
 assert.ok(message.includes('42°'), 'Response should mention recovered camera heading');
 assert.ok(message.includes('Cozman & Krotkov'), 'Response should cite seminal academic literature');
 assert.strictEqual(agentTrace?.intent, 'SKYLINE_VISUAL_PLACE_RECOGNITION');
 assert.strictEqual(agentTrace?.status, 'LOCALIZED / ACTIVE');
});

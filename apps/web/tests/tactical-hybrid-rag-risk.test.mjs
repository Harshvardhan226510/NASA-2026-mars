import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTraverseRiskIndex, routeProfile } from '../src/route-profile.js';
import { NASA_Hybrid_RAG, nasaHybridRAG } from '../src/nasa-hybrid-rag.js';
import { NASA_KNOWLEDGE_CORPUS } from '../src/nasa-knowledge-corpus.js';
import { EVAssistant } from '../src/eva-assistant.js';

test('Traverse Risk Index (TRI) evaluates slope hazard and metabolic strain against NASA HLS2 limits', () => {
 const nominalRoute = {
  waypoints: [
   { lon: 77.40, lat: 18.45, elevation_m: -2000 },
   { lon: 77.42, lat: 18.46, elevation_m: -1995 },
   { lon: 77.44, lat: 18.47, elevation_m: -1990 }
  ],
  summary: { total_distance_km: 3.5, minetti_energy_kj: 850, max_slope_deg: 4.2 }
 };

 const nominalTRI = calculateTraverseRiskIndex(nominalRoute, { max_slope_deg: 22 });
 assert.ok(nominalTRI.risk_index >= 0 && nominalTRI.risk_index <= 100, 'Risk index must be in [0, 100]');
 assert.equal(nominalTRI.safety_percentage, 100 - nominalTRI.risk_index, 'Safety percentage must equal 100 - risk_index');
 assert.equal(nominalTRI.rating, 'NOMINAL', 'Low slope (<15°) and low energy route must be NOMINAL');
 assert.equal(nominalTRI.color, '#4ade80', 'NOMINAL route must have green color');
 assert.ok(nominalTRI.components.slope_hazard <= 15, 'Nominal slope hazard should be low');

 // Critical hazard route exceeding 22° barrier
 const hazardousRoute = {
  waypoints: [
   { lon: 77.40, lat: 18.45, elevation_m: -2000 },
   { lon: 77.41, lat: 18.455, elevation_m: -1200 }, // Extremely steep cliff
   { lon: 77.42, lat: 18.46, elevation_m: -600 }
  ],
  summary: { total_distance_km: 18.2, minetti_energy_kj: 7800, max_slope_deg: 28.5 }
 };

 const hazardousTRI = calculateTraverseRiskIndex(hazardousRoute, { max_slope_deg: 22 });
 assert.ok(hazardousTRI.risk_index >= 60, 'Risk index exceeding 22° barrier and high energy must be >= 60');
 assert.equal(hazardousTRI.rating, 'CRITICAL HAZARD', 'High slope and fatigue must be CRITICAL HAZARD');
 assert.equal(hazardousTRI.color, '#f87171', 'CRITICAL HAZARD must have red color');
 assert.ok(hazardousTRI.safety_percentage <= 40, 'Hazardous route must have low safety percentage');
});

test('NASA Hybrid RAG retrieves authentic PDS/USGS documents via BM25 + Semantic Cosine RRF', () => {
 const rag = new NASA_Hybrid_RAG();

 // 1. CRISM hydrous minerals query
 const crismResult = rag.retrieve('What hydrous phyllosilicate minerals were detected by CRISM in Jezero crater?');
 assert.equal(crismResult.gated, false, 'Evidence gate must pass for valid scientific query');
 assert.ok(crismResult.passages.length > 0, 'Must retrieve authentic matching passages');
 assert.ok(crismResult.passages[0].provenance.source.includes('Planetary Data System'), 'Must cite authentic CRISM source');
 assert.ok(crismResult.contextSnippet.includes('smectite') || crismResult.contextSnippet.includes('CRISM'), 'Must contain mineral content');
 assert.ok(crismResult.citations[0].includes('MRO CRISM'), 'Must format official citation');

 // 2. InSight SEIS marsquake query
 const seisResult = rag.retrieve('InSight SEIS marsquake event S1222a magnitude and Cerberus Fossae epicenters');
 assert.equal(seisResult.gated, false);
 assert.ok(seisResult.passages.some(p => p.id === 'NASA-INSIGHT-SEIS-11'), 'Must retrieve InSight SEIS corpus document');
 assert.ok(seisResult.contextSnippet.includes('S1222a'), 'Must mention landmark marsquake S1222a');

 // 3. Evidence Gating on ungrounded/nonsense query (Strict zero synthetic data gate)
 const bogusResult = rag.retrieve('Where can I buy cheap pizza and soda in Chicago downtown?');
 assert.ok(bogusResult.gated, 'Evidence gate must reject ungrounded query');
 assert.ok(bogusResult.refusal.includes('Evidence Gate'), 'Must refuse ungrounded query');
 assert.equal(bogusResult.passages.length, 0, 'No passages allowed for ungrounded queries');
});

test('EVAssistant renders Agentic Execution Trace Drawer and answers with authentic NASA citations', async () => {
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
   return { className: '', textContent: '', append() {}, style: {}, setAttribute() {} };
  }
 };

 let capturedSender = '';
 let capturedText = '';
 let capturedIsAction = false;
 let capturedTrace = null;

 const dummyPlanner = {
  shown: 'direct_safe',
  result: {
   metadata: { max_slope_deg: 22, source: { label: 'Mars 2020 Jezero CTX DTM', url: 'https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-ctx-dtm-mosaic' } },
   routes: {
    direct_safe: {
     waypoints: [{ lon: 77.40, lat: 18.45, elevation_m: 0 }, { lon: 77.45, lat: 18.48, elevation_m: 10 }],
     summary: { total_distance_km: 8.5, minetti_energy_kj: 2200, max_slope_deg: 9.4, est_o2_consumed_liters: 140, total_science_score: 90 }
    }
   }
  }
 };

 const assistant = new EVAssistant(null, null, null, {
  routePlanner: dummyPlanner
 });
 assistant.muted = true;

 // Mock addMessage to inspect arguments
 assistant.addMessage = (sender, text, isAction, trace) => {
  capturedSender = sender;
  capturedText = text;
  capturedIsAction = isAction;
  capturedTrace = trace;
 };

 // Query path safety
 await assistant.handleQuery('Is the calculated path safe for an astronaut?');
 assert.equal(capturedSender, 'ARES');
 assert.ok(capturedText.includes('TERRAIN REVIEW: SAMPLED SLOPES WITHIN SELECTED LIMIT'));
 assert.match(capturedText, /Traverse risk index: ≈\d+%/);
 assert.doesNotMatch(capturedText, /Safety Rating/);
 assert.ok(capturedTrace, 'Must provide execution trace data');
 assert.equal(capturedTrace.intent, 'PATH_SAFETY_AUDIT');
 assert.match(capturedTrace.flightRule, /selected 22° limit/);
 assert.match(capturedTrace.citations[0], /www\.usgs\.gov\/data\/mars-2020/);

 // Test trace drawer DOM creation
 const drawer = assistant.buildTraceDrawer(capturedTrace);
 assert.ok(drawer, 'Drawer element must be created');
 assert.equal(drawer.className, 'ares-trace-drawer');
});

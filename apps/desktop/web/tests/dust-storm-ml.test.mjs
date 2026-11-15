import test from 'node:test';
import assert from 'node:assert/strict';
import { predictDustStorm, getBasinHotspot, DUST_HOTSPOTS, DustPredictor } from '../src/dust-storm-ml.js';

test('getBasinHotspot correctly identifies nearest Martian dust storm basins', () => {
 // Near Hellas Planitia center (70°E, -42°S)
 const hellas = getBasinHotspot(70.0, -42.0);
 assert.equal(hellas.bestHotspot.id, 'hellas');
 assert.ok(hellas.bestHotspot.distKm < 50);
 assert.ok(hellas.basinFactor >= 1.4, `Basin factor ${hellas.basinFactor} should be >= 1.4 inside Hellas`);

 // Near Argyre Planitia (-43°E / 317°E, -50°S)
 const argyre = getBasinHotspot(317.0, -50.0);
 assert.equal(argyre.bestHotspot.id, 'argyre');
 assert.ok(argyre.bestHotspot.distKm < 50);

 // Far from any basin (e.g. Olympus Mons at 226°E, 18.6°N)
 const olympus = getBasinHotspot(226.0, 18.6);
 assert.ok(olympus.bestHotspot.distKm > 2000);
 assert.equal(olympus.basinFactor, 1.0);
});

test('predictDustStorm produces low risk under quiescent non-storm season conditions', () => {
 // Northern Spring / Aphelion (Ls = 70°), moderate elevation, calm wind (5 m/s)
 const res = predictDustStorm({
  lat: 18.48,
  lon: 77.40,
  ls: 70.0,
  ltst: 10.0,
  elevationKm: -2.0,
  windMps: 5.0
 });

 assert.ok(res.probability < 0.30, `Expected low probability, got ${res.probability}`);
 assert.ok(['LOW', 'MODERATE'].includes(res.riskTier));
 assert.ok(res.opticalDepthTau < 0.6, `Expected clear tau, got ${res.opticalDepthTau}`);
 assert.ok(res.solarOcclusionPct < 45, `Expected low occlusion, got ${res.solarOcclusionPct}%`);
 assert.ok(res.drivers.length > 0);
});

test('predictDustStorm predicts high/severe risk in Hellas during perihelion with extreme winds', () => {
 // Perihelion storm season (Ls = 250°), deep basin (-7.2 km elevation), gale force winds (38 m/s)
 const res = predictDustStorm({
  lat: -42.0,
  lon: 70.0,
  ls: 250.0,
  ltst: 14.0,
  elevationKm: -7.2,
  windMps: 38.0
 });

 assert.ok(res.probability >= 0.70, `Expected severe probability >= 0.70, got ${res.probability}`);
 assert.equal(res.riskTier, 'SEVERE');
 assert.ok(res.opticalDepthTau >= 2.0, `Expected heavy dust tau >= 2.0, got ${res.opticalDepthTau}`);
 assert.ok(res.solarOcclusionPct >= 80, `Expected extreme solar occlusion >= 80%, got ${res.solarOcclusionPct}%`);
 assert.equal(res.nearestBasin, 'Hellas Basin');
 assert.ok(res.drivers.some(d => d.includes('Perihelion')));
 assert.ok(res.drivers.some(d => d.includes('basin') || d.includes('Hellas')));
 assert.ok(res.drivers.some(d => d.includes('saltation') || d.includes('shear')));
});

test('predictDustStorm respects Beer-Lambert extinction law for optical depth and solar loss', () => {
 // Validate mathematical monotonicity: higher tau must produce higher solar power loss
 const clear = predictDustStorm({ windMps: 5, ls: 90, elevationKm: 0 });
 const storm = predictDustStorm({ windMps: 35, ls: 260, elevationKm: -5, lon: 70, lat: -42 });

 assert.ok(storm.opticalDepthTau > clear.opticalDepthTau);
 assert.ok(storm.solarOcclusionPct > clear.solarOcclusionPct);
 assert.ok(clear.solarOcclusionPct >= 0 && clear.solarOcclusionPct <= 100);
 assert.ok(storm.solarOcclusionPct >= 0 && storm.solarOcclusionPct <= 100);
});

test('DustPredictor instantiates safely in headless environment', () => {
 const predictor = new DustPredictor(null);
 assert.equal(predictor.customWind, null);
 assert.ok(typeof predictor.evaluateCurrentView === 'function');
 assert.ok(typeof predictor.predictForTarget === 'function');
});

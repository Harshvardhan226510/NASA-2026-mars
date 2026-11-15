import test from 'node:test';
import assert from 'node:assert/strict';
import { SEISMIC_EVENTS, runStaLtaDetector, PlanetarySeismology } from '../src/planetary-seismology.js';

test('SEISMIC_EVENTS catalog contains verified NASA InSight and Apollo missions data', () => {
 assert.ok(SEISMIC_EVENTS.length >= 6);

 // Check S1222a - largest recorded marsquake
 const s1222a = SEISMIC_EVENTS.find(e => e.id === 'S1222a');
 assert.ok(s1222a, 'S1222a should exist in catalog');
 assert.equal(s1222a.body, 'mars');
 assert.equal(s1222a.magnitude, 4.7);
 assert.equal(s1222a.sol, 1222);
 assert.ok(s1222a.region.includes('Cerberus Fossae') || s1222a.region.includes('Dorsa Breccia'));
 assert.ok(s1222a.waveform.length > 50, 'S1222a should have digitized seismic waveform');

 // Check Apollo Moonquake
 const apollo = SEISMIC_EVENTS.find(e => e.body === 'moon');
 assert.ok(apollo, 'Apollo lunar seismic event should exist in catalog');
 assert.ok(apollo.station.includes('Apollo'));
});

test('runStaLtaDetector triggers on S1222a waveform and picks P and S wave phases', () => {
 const s1222a = SEISMIC_EVENTS.find(e => e.id === 'S1222a');
 const detection = runStaLtaDetector(s1222a.waveform, {
  nSta: 4,
  nLta: 20,
  triggerThreshold: 3.2,
  sampleIntervalSec: 2.0
 });

 assert.equal(detection.isTriggered, true, 'STA/LTA ratio should trigger on S1222a waveform');
 assert.ok(detection.pArrivalIndex > 0, 'P-wave arrival index must be identified');
 assert.ok(detection.sArrivalIndex > detection.pArrivalIndex, 'S-wave must arrive after P-wave');
 assert.ok(detection.deltaTSec > 0, 'Travel time differential Delta-t must be positive');
 assert.ok(detection.estimatedDistanceKm > 0, 'Estimated epicentral distance must be positive');
 
 // InSight crustal velocity model distance check
 // D = Delta-t * 9.0 km
 assert.equal(detection.estimatedDistanceKm, Math.round(detection.deltaTSec * 9.0));
});

test('runStaLtaDetector remains untriggered on quiet background noise', () => {
 // Generate Gaussian-like quiet seismic background noise (mean 0.0, max 0.05 um/s)
 const quietNoise = Array.from({ length: 120 }, () => (Math.random() - 0.5) * 0.05);

 const detection = runStaLtaDetector(quietNoise, {
  nSta: 4,
  nLta: 20,
  triggerThreshold: 3.5,
  sampleIntervalSec: 2.0
 });

 assert.equal(detection.isTriggered, false, 'STA/LTA should not trigger on background noise');
 assert.equal(detection.pArrivalIndex, -1);
 assert.equal(detection.sArrivalIndex, -1);
 assert.equal(detection.estimatedDistanceKm, null);
});

test('PlanetarySeismology instantiates safely in headless environment', () => {
 const lab = new PlanetarySeismology(null);
 assert.ok(lab.selectedEvent);
 assert.equal(lab.filterMode, 'bandpass');
 assert.equal(typeof lab.runDetection, 'function');
 assert.equal(typeof lab.selectEvent, 'function');

 const result = lab.runDetection();
 assert.ok(result.isTriggered);
});

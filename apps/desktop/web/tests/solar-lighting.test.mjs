import test from 'node:test';
import assert from 'node:assert/strict';
import { marsSun, solarAt, solarFlux, daylightHours, solarPanelMetrics } from '../src/solar-geometry.js';
import { SolarLighting } from '../src/solar-lighting.js';
import { EVAssistant } from '../src/eva-assistant.js';

test('solarFlux correctly computes Martian solar irradiance using inverse-square law', () => {
 // At 1 AU (Earth orbit), solar flux is 1361 W/m^2
 assert.equal(Math.round(solarFlux(1.0)), 1361);

 // At Mars mean distance (1.524 AU), irradiance is ~586 W/m^2
 const meanFlux = solarFlux(1.524);
 assert.ok(meanFlux >= 580 && meanFlux <= 590, `Mean flux ${meanFlux} outside expected range`);

 // At Mars perihelion (~1.381 AU), irradiance is ~713 W/m^2
 const perihelionFlux = solarFlux(1.381);
 assert.ok(perihelionFlux >= 705 && perihelionFlux <= 720, `Perihelion flux ${perihelionFlux} outside expected range`);

 // At Mars aphelion (~1.666 AU), irradiance is ~490 W/m^2
 const aphelionFlux = solarFlux(1.666);
 assert.ok(aphelionFlux >= 485 && aphelionFlux <= 495, `Aphelion flux ${aphelionFlux} outside expected range`);

 // Fallback for invalid input
 assert.equal(solarFlux(0), 590);
 assert.equal(solarFlux(-1.5), 590);
 assert.equal(solarFlux(NaN), 590);
});

test('daylightHours accurately models Martian daylight duration including polar day/night', () => {
 // At the Martian equator (lat 0°) during equinox (declination 0°), daylight is ~12.33 hours (half a Mars sol)
 const equinoxEquator = daylightHours(0, 0);
 assert.ok(Math.abs(equinoxEquator - 12.33) < 0.1, `Equator daylight ${equinoxEquator} not ~12.33h`);

 // North Pole (lat 85°) in northern summer (declination +20°): 24-hour polar day
 const polarDay = daylightHours(85, 20);
 assert.equal(polarDay, 24.66);

 // North Pole (lat 85°) in northern winter (declination -20°): 0-hour polar night
 const polarNight = daylightHours(85, -20);
 assert.equal(polarNight, 0);

 // South Pole (lat -85°) in northern summer (declination +20°): 0-hour polar night
 assert.equal(daylightHours(-85, 20), 0);

 // South Pole (lat -85°) in northern winter (declination -20°): 24-hour polar day
 assert.equal(daylightHours(-85, -20), 24.66);

 // Fallback on missing or invalid params
 assert.equal(daylightHours(NaN, 0), 12.33);
 assert.equal(daylightHours(0, NaN), 12.33);
});

test('solarPanelMetrics calculates direct/diffuse insolation and shadow ratio', () => {
 const flux = 600;

 // Overhead Sun (elevation 90°)
 const overhead = solarPanelMetrics({ elevation: 90 }, flux);
 assert.equal(overhead.isDay, true);
 assert.equal(overhead.directFlux, 600);
 assert.ok(overhead.totalSurfaceFlux > 600);
 assert.ok(overhead.shadowRatio < 0.05);

 // 30° elevation: sin(30°) = 0.5 -> directFlux should be 300 W/m^2
 const angled = solarPanelMetrics({ elevation: 30 }, flux);
 assert.equal(angled.isDay, true);
 assert.equal(angled.directFlux, 300);
 assert.ok(angled.totalSurfaceFlux > 300);
 assert.ok(Math.abs(angled.shadowRatio - 1.732) < 0.05); // 1 / tan(30°) = sqrt(3) ~ 1.732

 // Below horizon (elevation -10°): night time
 const night = solarPanelMetrics({ elevation: -10 }, flux);
 assert.equal(night.isDay, false);
 assert.equal(night.directFlux, 0);
 assert.equal(night.diffuseFlux, 0);
 assert.equal(night.totalSurfaceFlux, 0);
 assert.equal(night.shadowRatio, null);

 // Civil twilight (elevation -3°): subtle diffuse skyglow
 const twilight = solarPanelMetrics({ elevation: -3 }, flux);
 assert.equal(twilight.isDay, false);
 assert.equal(twilight.directFlux, 0);
 assert.ok(twilight.diffuseFlux > 0);
 assert.equal(twilight.shadowRatio, null);

 // Null handling
 assert.equal(solarPanelMetrics(null, flux), null);
});

test('marsSun and solarAt compute offline celestial mechanics correctly', () => {
 const sun = marsSun('2026-10-25T12:00:00Z');
 assert.ok(sun.ls >= 0 && sun.ls <= 360, `Ls ${sun.ls} out of bounds`);
 assert.ok(sun.distance_au >= 1.35 && sun.distance_au <= 1.70, `Mars-Sun distance ${sun.distance_au} AU out of bounds`);
 assert.ok(sun.declination >= -26 && sun.declination <= 26, `Declination ${sun.declination}° out of bounds`);
 assert.ok(sun.subsolar_lon >= -180 && sun.subsolar_lon <= 180, `Subsolar lon ${sun.subsolar_lon} out of bounds`);

 // Local solar calculation at Jezero Crater (77.40° E, 18.48° N)
 const solar = solarAt(sun, 77.40, 18.48);
 assert.ok(solar.elevation >= -90 && solar.elevation <= 90);
 assert.ok(solar.azimuth >= 0 && solar.azimuth <= 360);
 assert.ok(solar.local_true_hour >= 0 && solar.local_true_hour <= 24);
 assert.ok(solar.illumination >= 0 && solar.illumination <= 1);
});

test('SolarLighting computeMetrics returns complete physical telemetry', () => {
 const fakeViewer = { entities: { add: () => ({}) }, scene: { globe: { ellipsoid: {} } } };
 const solarLighting = new SolarLighting(fakeViewer, {
  currentFocus: () => ({ point: [77.40, 18.48] }),
  getRegion: () => ({ center: [77.40, 18.48] })
 });

 const metrics = solarLighting.computeMetrics(77.40, 18.48, '2026-06-01T12:00:00Z');
 assert.ok(metrics !== null);
 assert.ok(typeof metrics.elevation === 'number');
 assert.ok(typeof metrics.azimuth === 'number');
 assert.ok(typeof metrics.flux === 'number');
 assert.ok(typeof metrics.hours === 'number');
 assert.ok(['day', 'twilight', 'night'].includes(metrics.dayState));
 assert.ok(metrics.ltstStr.includes('LTST'));
 assert.ok(typeof metrics.optimalTilt === 'number');
 assert.ok(metrics.distanceAU > 1.3 && metrics.distanceAU < 1.7);
});

test('SolarLighting scrub mode computes timestamp for requested local sol hour', () => {
 const fakeViewer = { entities: { add: () => ({}) }, scene: { globe: { ellipsoid: {} } } };
 const solarLighting = new SolarLighting(fakeViewer, {
  currentFocus: () => ({ point: [77.40, 18.48] }),
  getRegion: () => ({ center: [77.40, 18.48] })
 });

 solarLighting.mode = 'scrub';
 solarLighting.scrubHour = 12.0; // noon
 const noonUtc = solarLighting.currentTime();
 const sunNoon = marsSun(noonUtc);
 const solarNoon = solarAt(sunNoon, 77.40, 18.48);
 // Sol hour at scrubbed time should match ~12:00 LTST within ~0.1h
 assert.ok(Math.abs(solarNoon.local_true_hour - 12.0) < 0.1, `Scrubbed noon produced ${solarNoon.local_true_hour}`);

 solarLighting.scrubHour = 6.0; // dawn
 const dawnUtc = solarLighting.currentTime();
 const sunDawn = marsSun(dawnUtc);
 const solarDawn = solarAt(sunDawn, 77.40, 18.48);
 assert.ok(Math.abs(solarDawn.local_true_hour - 6.0) < 0.1, `Scrubbed dawn produced ${solarDawn.local_true_hour}`);
});

test('EVAssistant handles sunlight and shadow toggles through solarLighting', async () => {
 let opened = false;
 const fakeSolarLighting = {
  enabled: false,
  shadows: false,
  open(val) { opened = val; },
  update() {},
  computeMetrics: () => ({ panel: { totalSurfaceFlux: 540, directFlux: 480, diffuseFlux: 60 }, optimalTilt: 15.2, hours: 12.3 })
 };

 const assistant = new EVAssistant(null, null, null, {
  currentFocus: () => ({ point: [77.40, 18.48] }),
  solarLighting: fakeSolarLighting
 });
 assistant.addMessage = () => {};
 assistant.speak = () => {};
 assistant.setStatus = () => {};

 await assistant.handleQuery('turn on sunlight');
 assert.equal(fakeSolarLighting.enabled, true);
 assert.equal(opened, true);

 await assistant.handleQuery('enable shadows');
 assert.equal(fakeSolarLighting.shadows, true);

 await assistant.handleQuery('turn off sunlight');
 assert.equal(fakeSolarLighting.enabled, false);

 await assistant.handleQuery('disable shadows');
 assert.equal(fakeSolarLighting.shadows, false);
});

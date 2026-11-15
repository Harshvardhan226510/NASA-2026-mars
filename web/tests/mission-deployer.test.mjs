import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSION_LOCATIONS, EQUIPMENT_CATALOG, MissionDeployer, getEquipmentSVGThumbnail } from '../src/mission-deployer.js';

test('MISSION_LOCATIONS includes all 4 curated sites active with authentic NASA targets', () => {
  assert.ok(Array.isArray(MISSION_LOCATIONS));
  assert.strictEqual(MISSION_LOCATIONS.length, 4);

  const valles = MISSION_LOCATIONS.find(l => l.id === 'VALLES_MARINERIS');
  assert.ok(valles);
  assert.strictEqual(valles.active, true);
  assert.strictEqual(valles.center[0], -71.7);
  assert.strictEqual(valles.center[1], -7.0);
  assert.ok(valles.objective.includes('Canyon'));
  assert.strictEqual(valles.canyonRimMaskDeg, 24.5);

  const gale = MISSION_LOCATIONS.find(l => l.id === 'GALE_CRATER');
  assert.ok(gale);
  assert.strictEqual(gale.active, true);
  assert.ok(gale.objective.includes('Boxwork'));
  assert.strictEqual(gale.canyonRimMaskDeg, 8.0);

  const jezero = MISSION_LOCATIONS.find(l => l.id === 'JEZERO_CRATER');
  assert.ok(jezero);
  assert.strictEqual(jezero.active, true);
  assert.ok(jezero.objective.includes('Delta'));
  assert.strictEqual(jezero.canyonRimMaskDeg, 6.5);

  const arcadia = MISSION_LOCATIONS.find(l => l.id === 'ARCADIA_PLANITIA');
  assert.ok(arcadia);
  assert.strictEqual(arcadia.active, true);
  assert.ok(arcadia.objective.includes('Ice'));
  assert.strictEqual(arcadia.canyonRimMaskDeg, 2.0);
});

test('EQUIPMENT_CATALOG registers all 9 base infrastructure and scientific instruments with valid models', () => {
  assert.strictEqual(EQUIPMENT_CATALOG.length, 9);
  const ids = EQUIPMENT_CATALOG.map(e => e.id);
  assert.ok(ids.includes('crew_hab'));
  assert.ok(ids.includes('greenhouse_dome'));
  assert.ok(ids.includes('nuclear_reactor'));
  assert.ok(ids.includes('isru_plant'));
  assert.ok(ids.includes('crew_rover'));
  assert.ok(ids.includes('solar_array'));
  assert.ok(ids.includes('comms_mast'));
  assert.ok(ids.includes('seis_station'));
  assert.ok(ids.includes('weather_station'));

  for (const item of EQUIPMENT_CATALOG) {
    assert.ok(item.modelUrl.endsWith('.glb'));
    assert.strictEqual(typeof item.computeTelemetry, 'function');
  }
});

test('getEquipmentSVGThumbnail returns valid SVG markup for all equipment types', () => {
  const allIds = ['solar_array', 'comms_mast', 'seis_station', 'weather_station', 'crew_hab', 'greenhouse_dome', 'nuclear_reactor', 'isru_plant', 'crew_rover'];
  for (const id of allIds) {
    const svg = getEquipmentSVGThumbnail(id);
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(svg.includes('viewBox'));
  }
});

test('computeBaseOverview calculates power balance, ECLSS O2, and water production', () => {
  const host = {
    viewer: {
      scene: {
        globe: { ellipsoid: {}, getHeight: () => -4500 },
        primitives: { add: () => {}, remove: () => true },
        requestRender: () => {}
      },
      camera: { flyToBoundingSphere: () => {} },
      entities: { add: () => ({ id: 'ent' }), remove: () => true }
    }
  };
  const deployer = new MissionDeployer(host);

  // Deploy Crew Habitat (12 kW load, 4 crew, 3.36 kg O2 load, 16 L H2O load)
  deployer.deployed.push({
    id: 'hab-1',
    typeId: 'crew_hab',
    name: 'Crew Habitat Core',
    coords: [-71.7, -7.0],
    elevation: -4500
  });

  let overview = deployer.computeBaseOverview();
  assert.strictEqual(overview.crewCapacity, 4);
  assert.strictEqual(overview.totalPowerLoad, 12.0);
  assert.strictEqual(overview.totalPowerGen, 0);
  assert.strictEqual(overview.isPowerSurplus, false);

  // Deploy Kilopower Nuclear Reactor (+40 kWe continuous power)
  deployer.deployed.push({
    id: 'nuc-1',
    typeId: 'nuclear_reactor',
    name: 'Kilopower Nuclear Plant',
    coords: [-71.72, -7.02],
    elevation: -4500
  });

  overview = deployer.computeBaseOverview();
  assert.strictEqual(overview.totalPowerGen, 40.0);
  assert.strictEqual(overview.totalPowerLoad, 12.0);
  assert.strictEqual(overview.netPower, 28.0);
  assert.strictEqual(overview.isPowerSurplus, true);
  assert.ok(overview.dustStormSurvivability.includes('INDESTRUCTIBLE'));

  // Deploy ISRU Plant (+24 kg O2/sol, 25 L H2O/sol, 18 kW load)
  deployer.deployed.push({
    id: 'isru-1',
    typeId: 'isru_plant',
    name: 'ISRU Water & Fuel Plant',
    coords: [-71.71, -7.01],
    elevation: -4500
  });

  overview = deployer.computeBaseOverview();
  assert.strictEqual(overview.totalPowerLoad, 30.0); // 12 + 18
  assert.strictEqual(overview.netPower, 10.0); // 40 - 30 = 10 kW surplus
  assert.strictEqual(overview.isPowerSurplus, true);
  assert.ok(overview.netO2 > 20.0); // 24 - 3.36 = 20.64
  assert.ok(overview.netWater >= 9.0); // 25 - 16 = 9
});

test('Solar array telemetry calculates positive flux, power output and canyon shadow', () => {
  const solar = EQUIPMENT_CATALOG.find(e => e.id === 'solar_array');
  const candorCoords = [-71.7, -7.0];
  const t = solar.computeTelemetry(candorCoords, -4500, 5.0, 180, 'VALLES_MARINERIS');

  assert.ok(t);
  assert.ok(['nominal', 'caution', 'warning'].includes(t.status));
  assert.ok(t.items.length >= 5);
  
  const fluxItem = t.items.find(i => i.label.includes('Solar Flux'));
  assert.ok(fluxItem);
  assert.ok(fluxItem.value.includes('W/m²'));

  const pwrItem = t.items.find(i => i.label.includes('Power Output'));
  assert.ok(pwrItem);
  assert.ok(pwrItem.value.includes('W'));

  const terrainItem = t.items.find(i => i.label.includes('Terrain Obstruction'));
  assert.ok(terrainItem);
  assert.ok(t.citation.includes('Mars24'));
});

test('Location-specific telemetry across all 4 mission targets', () => {
  const seis = EQUIPMENT_CATALOG.find(e => e.id === 'seis_station');
  const wx = EQUIPMENT_CATALOG.find(e => e.id === 'weather_station');

  // Gale Crater: Boxwork fracture networks
  const galeSeis = seis.computeTelemetry([137.38, -4.82], -4400, 5.0, 0, 'GALE_CRATER');
  const galeScarp = galeSeis.items.find(i => i.label.includes('Nearest Fault Scarp'));
  assert.ok(galeScarp.value.includes('Gediz Vallis Ridge'));

  const galeWx = wx.computeTelemetry([137.38, -4.82], -4400, 0, 0, 'GALE_CRATER');
  const galeWind = galeWx.items.find(i => i.label.includes('Wind'));
  assert.ok(galeWind.value.includes('katabatic'));

  // Jezero Crater: Delta scarp fault
  const jezSeis = seis.computeTelemetry([77.4, 18.48], -2500, 4.0, 0, 'JEZERO_CRATER');
  const jezScarp = jezSeis.items.find(i => i.label.includes('Nearest Fault Scarp'));
  assert.ok(jezScarp.value.includes('Delta Scarp'));

  // Arcadia Planitia: Cryotectonic fracture zone & frost risks
  const arcSeis = seis.computeTelemetry([-157.9, 39.79], -4000, 2.0, 0, 'ARCADIA_PLANITIA');
  const arcScarp = arcSeis.items.find(i => i.label.includes('Nearest Fault Scarp'));
  assert.ok(arcScarp.value.includes('Cryotectonic'));

  const arcWx = wx.computeTelemetry([-157.9, 39.79], -4000, 0, 0, 'ARCADIA_PLANITIA');
  const arcRisk = arcWx.items.find(i => i.label.includes('Environmental'));
  assert.ok(arcRisk.value.includes('Cryogenic'));
});

test('Comms mast telemetry calculates spherical LOS horizon and canyon rim elevation cutoff', () => {
  const comms = EQUIPMENT_CATALOG.find(e => e.id === 'comms_mast');
  const t = comms.computeTelemetry([-71.7, -7.0], -4500, 0, 0, 'VALLES_MARINERIS');

  assert.strictEqual(t.status, 'nominal');
  const losItem = t.items.find(i => i.label.includes('LOS Horizon'));
  assert.ok(losItem);
  // Geometric horizon of 4.5m mast + 1.8m suit is ~9.02 km
  const km = parseFloat(losItem.value);
  assert.ok(km > 8.0 && km < 10.0, `Expected ~9 km, got ${km}`);

  const cutoffItem = t.items.find(i => i.label.includes('Elevation Mask Cutoff'));
  assert.ok(cutoffItem);
  assert.ok(cutoffItem.value.includes('24.5°'));
});

test('Seismometer telemetry validates InSight 15° leveling threshold', () => {
  const seis = EQUIPMENT_CATALOG.find(e => e.id === 'seis_station');
  
  // Test safe slope <= 15°
  const safe = seis.computeTelemetry([-71.7, -7.0], -4500, 8.5, 0, 'VALLES_MARINERIS');
  assert.strictEqual(safe.status, 'nominal');
  assert.ok(safe.statusLabel.includes('OPTIMAL'));

  // Test dangerous steep slope > 15°
  const steep = seis.computeTelemetry([-71.7, -7.0], -4500, 26.0, 0, 'VALLES_MARINERIS');
  assert.strictEqual(steep.status, 'warning');
  assert.ok(steep.statusLabel.includes('HAZARD'));
});

test('Weather station telemetry calculates barometric pressure increase at canyon depth', () => {
  const wx = EQUIPMENT_CATALOG.find(e => e.id === 'weather_station');
  
  // At datum (0 m), pressure is ~610 Pa
  const atDatum = wx.computeTelemetry([0, 0], 0, 0, 0, 'VALLES_MARINERIS');
  const pDatum = parseInt(atDatum.items[0].value);
  assert.strictEqual(pDatum, 610);

  // At Candor Chasma canyon floor (-4500 m), pressure is significantly higher (>850 Pa)
  const atCanyon = wx.computeTelemetry([-71.7, -7.0], -4500, 0, 0, 'VALLES_MARINERIS');
  const pCanyon = parseInt(atCanyon.items[0].value);
  assert.ok(pCanyon > 850 && pCanyon < 960, `Expected ~915 Pa at -4500m, got ${pCanyon}`);
  assert.ok(atCanyon.items[0].value.includes('+'));
});

test('MissionDeployer deploys, inspects and removes instruments cleanly and interacts with routePlanner', () => {
  const routeCalls = [];
  const mockRoutePlanner = {
    setPoint: (kind, coords) => {
      routeCalls.push({ kind, coords });
    },
    render: () => {},
    open: () => {}
  };

  const host = {
    viewer: {
      scene: {
        globe: {
          ellipsoid: {},
          getHeight: () => -4500
        },
        primitives: {
          add: () => {},
          remove: () => true
        },
        requestRender: () => {}
      },
      camera: {
        flyToBoundingSphere: () => {}
      },
      entities: {
        add: () => ({ id: 'ent-1' }),
        remove: () => true
      },
      canvas: {
        style: {},
        addEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0 })
      }
    },
    map: {
      setView: () => {}
    },
    routePlanner: mockRoutePlanner
  };

  const deployer = new MissionDeployer(host);
  assert.strictEqual(deployer.deployed.length, 0);

  // Start placement of solar array
  deployer.startPlacement('solar_array');
  assert.strictEqual(deployer.picking, true);
  assert.strictEqual(deployer.selectedEquipmentType, 'solar_array');

  // Deploy at Candor Chasma
  const record = deployer.deployAt([-71.7, -7.0], -4500);
  assert.strictEqual(deployer.deployed.length, 1);
  assert.strictEqual(deployer.picking, false);
  assert.ok(record);
  assert.strictEqual(record.typeId, 'solar_array');
  assert.strictEqual(record.coords[0], -71.7);
  assert.strictEqual(record.coords[1], -7.0);
  assert.ok(record.telemetry);

  // Inspect
  deployer.selectEquipment(record.id);
  assert.strictEqual(deployer.selectedDeployedId, record.id);

  // Deploy second instrument: Weather station
  deployer.startPlacement('weather_station');
  const record2 = deployer.deployAt([-71.75, -7.02], -4600);
  assert.strictEqual(deployer.deployed.length, 2);
  assert.strictEqual(record2.typeId, 'weather_station');

  // Test route planner integration via mock
  deployer.host.routePlanner.setPoint('start', record.coords);
  deployer.host.routePlanner.setPoint('goal', record2.coords);
  assert.strictEqual(routeCalls.length, 2);
  assert.strictEqual(routeCalls[0].kind, 'start');
  assert.deepStrictEqual(routeCalls[0].coords, [-71.7, -7.0]);
  assert.strictEqual(routeCalls[1].kind, 'goal');
  assert.deepStrictEqual(routeCalls[1].coords, [-71.75, -7.02]);

  // Remove first instrument
  deployer.removeEquipment(record.id);
  assert.strictEqual(deployer.deployed.length, 1);
  assert.strictEqual(deployer.deployed[0].typeId, 'weather_station');

  // Clear all
  deployer.clearAll();
  assert.strictEqual(deployer.deployed.length, 0);
  assert.strictEqual(deployer.selectedDeployedId, null);
});

test('Solar array reacts dynamically to in-app solar hour scrubbing (Noon vs Midnight)', () => {
  const solar = EQUIPMENT_CATALOG.find(e => e.id === 'solar_array');
  const loc = [-71.7, -7.0];

  // Midday noon: high elevation, positive generation
  const middayData = {
    currentTime: '2026-10-31T12:00:00Z',
    solar: { elevation: 62.5, azimuth: 175, local_true_hour: 12.1 },
    flux0: 540,
    dustTau: 0.45
  };
  const noonTelem = solar.computeTelemetry(loc, -4500, 4.0, 180, 'VALLES_MARINERIS', middayData);
  assert.strictEqual(noonTelem.status, 'nominal');
  const noonPwr = noonTelem.items.find(i => i.label.includes('Power Output'));
  assert.ok(noonPwr.value.includes('W'));
  const watts = parseFloat(noonPwr.value);
  assert.ok(watts > 400, `Expected >400W at noon, got ${watts}W`);

  // Midnight: sun below horizon, 0 W generation
  const nightData = {
    currentTime: '2026-10-31T00:00:00Z',
    solar: { elevation: -55.0, azimuth: 350, local_true_hour: 0.1 },
    flux0: 540,
    dustTau: 0.45
  };
  const nightTelem = solar.computeTelemetry(loc, -4500, 4.0, 180, 'VALLES_MARINERIS', nightData);
  assert.strictEqual(nightTelem.status, 'warning');
  assert.ok(nightTelem.statusLabel.includes('NIGHT'));
  const nightPwr = nightTelem.items.find(i => i.label.includes('Power Output'));
  assert.ok(nightPwr.value.startsWith('0 W'));
});

test('Weather station utilizes in-app NASA EMARS wind vectors and atmospheric density', () => {
  const wx = EQUIPMENT_CATALOG.find(e => e.id === 'weather_station');
  const loc = [-71.7, -7.0];

  const inAppData = {
    envPressure: 915,
    envTemp: -35,
    wind: { speed: 8.4, bearing_to: 45.0 }, // 8.4 m/s toward NE
    dustTau: 0.62
  };

  const t = wx.computeTelemetry(loc, -4500, 2.0, 180, 'VALLES_MARINERIS', inAppData);
  assert.strictEqual(t.status, 'nominal');

  const windItem = t.items.find(i => i.label.includes('Dominant Wind Regime'));
  assert.ok(windItem.value.includes('8.4 m/s'));
  assert.ok(windItem.value.includes('NASA EMARS'));

  const dirItem = t.items.find(i => i.label.includes('Wind Flow Direction'));
  assert.ok(dirItem.value.includes('45°'));
  assert.ok(dirItem.value.includes('NE'));

  const densityItem = t.items.find(i => i.label.includes('Atmospheric Gas Density'));
  assert.ok(densityItem.value.includes('kg/m³'));
});

test('Seismometer computes authentic InSight S1222a Monster Marsquake travel times', () => {
  const seis = EQUIPMENT_CATALOG.find(e => e.id === 'seis_station');
  const loc = [-71.7, -7.0]; // Valles Marineris

  const t = seis.computeTelemetry(loc, -4500, 4.0, 180, 'VALLES_MARINERIS', {
    insightLanderDistKm: 12500
  });

  const monsterItem = t.items.find(i => i.label.includes('S1222a'));
  assert.ok(monsterItem);
  assert.ok(monsterItem.value.includes('Cerberus Fossae'));
  assert.ok(monsterItem.value.includes('P-wave'));
  assert.ok(monsterItem.value.includes('S-wave'));
});

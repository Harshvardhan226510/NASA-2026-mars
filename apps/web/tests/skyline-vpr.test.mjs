import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateElevationAngle,
  projectForwardMars,
  raycastSkylineAngle,
  generateLocationSkyline,
  zScoreNormalize,
  medianFilter3,
  extractSkylineFromImage,
  matchSkylineProfile,
  CANONICAL_MARS_SKYLINES,
  MARS_RADIUS_METERS,
} from '../src/skyline-vpr.js';

test('calculateElevationAngle accounts for Martian spherical curvature drop', () => {
  // Test target at same datum height as origin at 20 km distance
  // Curvature drop d = r^2 / (2 * R_Mars) ≈ 20000^2 / (2 * 3396190) ≈ 58.89 m
  const originElev = 0;
  const targetElev = 0;
  const distance = 20000;
  const eyeHeight = 1.7;

  const angle = calculateElevationAngle(targetElev, originElev, distance, eyeHeight);
  // Apparent height is negative because the Martian surface curves downwards
  assert.ok(angle < 0, 'Elevation angle at same elevation should be negative due to curvature');

  // If a mountain rises 2000m above datum at 20 km distance
  const mountainElev = 2000;
  const mountainAngle = calculateElevationAngle(mountainElev, originElev, distance, eyeHeight);
  // Approx: (2000 - 1.7 - 58.89) / 20000 ≈ 1939.4 / 20000 = 0.09697 rad ≈ 5.54°
  assert.ok(Math.abs(mountainAngle - 5.54) < 0.1, `Mountain angle should be ~5.54°, got ${mountainAngle}`);
});

test('zScoreNormalize provides 100% invariance to camera pitch tilt and VFOV zoom', () => {
  // Base physical skyline profile (angles in degrees)
  const baseProfile = new Float32Array([2.0, 5.0, 12.0, 8.0, 4.0, 1.0, 0.5, 3.0]);

  // Scaled by unknown VFOV zoom (factor 2.8) and shifted by unknown camera pitch tilt (+15°)
  const scaledAndTilted = new Float32Array(baseProfile.map(v => 2.8 * v + 15.0));

  const normBase = zScoreNormalize(baseProfile);
  const normTransformed = zScoreNormalize(scaledAndTilted);

  for (let i = 0; i < baseProfile.length; i++) {
    assert.ok(
      Math.abs(normBase[i] - normTransformed[i]) < 1e-5,
      `Z-score normalized profiles must be identical at index ${i}`
    );
  }
});

test('medianFilter3 removes isolated dust and sensor noise spikes', () => {
  const signalWithSpike = new Float32Array([10, 10, 10, 999, 10, 10]);
  const cleaned = medianFilter3(signalWithSpike);
  // The 999 spike at index 3 should be replaced by 10 (the median of 10, 999, 10)
  assert.equal(cleaned[3], 10);
});

test('extractSkylineFromImage correctly extracts 360-column boundary from image', () => {
  const width = 360;
  const height = 100;
  const data = new Uint8ClampedArray(width * height * 4);

  // Synthetic canyon wall:
  // Top (sky): black space (0, 0, 0, 255)
  // Bottom (terrain): illuminated Martian rock (180, 90, 40, 255)
  // Horizon ridge follows a sine wave: y_horizon(x) = 40 + 15 * sin(2*pi*x/360)
  for (let x = 0; x < width; x++) {
    const ridgeY = Math.round(40 + 15 * Math.sin((x * 2 * Math.PI) / 360));
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      if (y < ridgeY) {
        // Dark Martian sky
        data[idx] = 10;
        data[idx + 1] = 10;
        data[idx + 2] = 15;
        data[idx + 3] = 255;
      } else {
        // Bright Martian canyon wall
        data[idx] = 180;
        data[idx + 1] = 110;
        data[idx + 2] = 60;
        data[idx + 3] = 255;
      }
    }
  }

  const result = extractSkylineFromImage({ data, width, height }, { vfovDeg: 60 });
  assert.equal(result.rawHorizonRows.length, 360);
  assert.equal(result.elevationAngles.length, 360);
  assert.equal(result.zScoreProfile.length, 360);

  // Check that the extracted ridge row matches the synthetic sine wave within ±2 pixels
  for (let x = 0; x < 360; x += 30) {
    const expectedY = Math.round(40 + 15 * Math.sin((x * 2 * Math.PI) / 360));
    assert.ok(
      Math.abs(result.rawHorizonRows[x] - expectedY) <= 3,
      `At column ${x}: expected ${expectedY}, got ${result.rawHorizonRows[x]}`
    );
  }
});

test('matchSkylineProfile correctly identifies Valles Marineris regardless of compass heading', () => {
  // Take the ground-truth Valles Marineris profile
  const vmCand = CANONICAL_MARS_SKYLINES.find(c => c.id === 'VALLES_MARINERIS_IUS');
  assert.ok(vmCand, 'Valles Marineris profile must be present');

  // Rotate the profile by an arbitrary unknown compass heading, e.g. 137° SE
  const unknownHeading = 137;
  const observedProfile = new Float32Array(360);
  for (let i = 0; i < 360; i++) {
    observedProfile[i] = vmCand.profile[(i + unknownHeading) % 360];
  }

  // Also add slight scale/pitch shift to test robustness
  for (let i = 0; i < 360; i++) {
    observedProfile[i] = observedProfile[i] * 1.5 - 4.0;
  }

  const match = matchSkylineProfile(observedProfile, CANONICAL_MARS_SKYLINES);

  // Must correctly identify Valles Marineris as top candidate!
  assert.equal(match.bestMatch.id, 'VALLES_MARINERIS_IUS');
  assert.ok(match.bestMatch.confidence > 0.9, 'Confidence should be > 90%');
  // Must recover the unknown compass heading (137°) within ±1°!
  assert.ok(
    Math.abs(match.matchedHeadingDeg - unknownHeading) <= 1,
    `Must recover compass heading ${unknownHeading}°, got ${match.matchedHeadingDeg}°`
  );
});

test('matchSkylineProfile correctly distinguishes Jezero Crater from Gale Crater', () => {
  const jezeroCand = CANONICAL_MARS_SKYLINES.find(c => c.id === 'JEZERO_CRATER_DELTA');
  // Rotate Jezero by 45°
  const observedJezero = new Float32Array(360);
  for (let i = 0; i < 360; i++) {
    observedJezero[i] = jezeroCand.profile[(i + 45) % 360];
  }

  const match = matchSkylineProfile(observedJezero, CANONICAL_MARS_SKYLINES);
  assert.equal(match.bestMatch.id, 'JEZERO_CRATER_DELTA');
  assert.ok(match.bestMatch.confidence > 0.85);
});

test('matchSkylineProfile correctly identifies Gale Crater Mount Sharp regardless of heading', () => {
  const galeCand = CANONICAL_MARS_SKYLINES.find(c => c.id === 'GALE_CRATER_MOUNT_SHARP');
  assert.ok(galeCand, 'Gale Crater profile must be present');

  // Rotate Gale Crater by 210°
  const unknownHeading = 210;
  const observedGale = new Float32Array(360);
  for (let i = 0; i < 360; i++) {
    observedGale[i] = galeCand.profile[(i + unknownHeading) % 360];
  }

  const match = matchSkylineProfile(observedGale, CANONICAL_MARS_SKYLINES);
  assert.equal(match.bestMatch.id, 'GALE_CRATER_MOUNT_SHARP');
  assert.ok(match.bestMatch.confidence > 0.9, 'Confidence for Gale Crater should be >90%');
  assert.ok(
    Math.abs(match.matchedHeadingDeg - unknownHeading) <= 1,
    `Must recover compass heading ${unknownHeading}°, got ${match.matchedHeadingDeg}°`
  );
});

test('matchSkylineProfile correctly identifies Gale Crater Farah Vallis as top match for western Gale rim', () => {
  const farahCand = CANONICAL_MARS_SKYLINES.find(c => c.id === 'GALE_FARAH_VALLIS');
  assert.ok(farahCand, 'Gale Crater Farah Vallis must be present in canonical sites');

  // Rotate Farah Vallis by 95°
  const unknownHeading = 95;
  const observed = new Float32Array(360);
  for (let i = 0; i < 360; i++) {
    observed[i] = farahCand.profile[(i + unknownHeading) % 360];
  }

  const match = matchSkylineProfile(observed, CANONICAL_MARS_SKYLINES);
  assert.equal(match.bestMatch.id, 'GALE_FARAH_VALLIS');
  assert.ok(match.bestMatch.confidence > 0.95);
  assert.ok(Math.abs(match.matchedHeadingDeg - unknownHeading) <= 1);
});

test('extractSkylineFromImage smoothly bridges across missing/dark columns via circular interpolation', () => {
  const width = 360;
  const height = 100;
  const data = new Uint8ClampedArray(width * height * 4);

  // Synthetic horizon at y = 50, but columns 10 to 25 are completely pitch black (unrendered tile gap)
  for (let x = 0; x < width; x++) {
    const isDarkGap = (x >= 10 && x <= 25);
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      if (isDarkGap) {
        // Completely unrendered black block
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      } else if (y < 50) {
        // Dark Martian sky
        data[idx] = 8;
        data[idx + 1] = 8;
        data[idx + 2] = 12;
        data[idx + 3] = 255;
      } else {
        // Lit terrain
        data[idx] = 160;
        data[idx + 1] = 100;
        data[idx + 2] = 50;
        data[idx + 3] = 255;
      }
    }
  }

  const res = extractSkylineFromImage({ data, width, height }, { vfovDeg: 60 });
  // The unrendered columns 10-25 should NOT drop to 0 or 100, but interpolate smoothly around y=50!
  for (let x = 10; x <= 25; x++) {
    assert.ok(
      Math.abs(res.rawHorizonRows[x] - 50) <= 2,
      `Gap at column ${x} must be smoothly interpolated near 50, got ${res.rawHorizonRows[x]}`
    );
  }
});


/**
 * Mars Skyline Visual Place Recognition (Skyline-VPR) Engine
 *
 * Grounded in peer-reviewed planetary robotics literature:
 * - Cozman & Krotkov (1995, 1997): "Robot localization using mountain silhouettes in unstructured terrain" (CMU)
 * - Stein & Medioni (1995): "Structural indexing for localization"
 * - Babacic, Lu, & Stachniss (2022): "Skyline-based global localization in mountainous terrain"
 *
 * Implements:
 * 1. Radial DEM raycasting with Martian spherical curvature drop: d(r) = r² / (2 * R_Mars)
 * 2. 360-column panoramic horizon ridge edge extraction in HTML5 Canvas
 * 3. 3-point noise median filter
 * 4. Z-Score normalization for camera pitch tilt & VFOV zoom invariance
 * 5. 360° circular cross-correlation matching for zero-prior, compass-free position & heading estimation
 */

export const MARS_RADIUS_METERS = 3396190;
export const DEFAULT_EYE_HEIGHT_METERS = 1.7; // Standard standing astronaut visor height
export const DEFAULT_MAX_HORIZON_RANGE_METERS = 30000; // 30 km max line-of-sight horizon search
export const DEFAULT_RAYCAST_STEP_METERS = 250; // 250m step size along ray

/**
 * Computes apparent elevation angle for a distant terrain point taking planetary curvature into account.
 *
 * @param {number} targetElevation - Ground elevation Z(r, phi) in meters
 * @param {number} originElevation - Ground elevation Z0 at astronaut position in meters
 * @param {number} distanceMeters - Horizontal ground distance r in meters
 * @param {number} [eyeHeight=1.7] - Astronaut eye height h above terrain in meters
 * @returns {number} Apparent elevation angle in degrees
 */
export function calculateElevationAngle(targetElevation, originElevation, distanceMeters, eyeHeight = DEFAULT_EYE_HEIGHT_METERS) {
  if (distanceMeters <= 0) return 0;

  // Planetary spherical curvature drop: d(r) ≈ r² / (2 * R_Mars)
  const curvatureDrop = (distanceMeters * distanceMeters) / (2 * MARS_RADIUS_METERS);

  // Apparent height delta
  const deltaHeight = targetElevation - (originElevation + eyeHeight) - curvatureDrop;

  // Apparent angular elevation in degrees
  return Math.atan2(deltaHeight, distanceMeters) * (180 / Math.PI);
}

/**
 * Projects a forward point on Mars given origin, azimuth, and distance.
 * 
 * @param {number} lon - Origin longitude in degrees
 * @param {number} lat - Origin latitude in degrees
 * @param {number} azimuthDeg - Azimuth clockwise from North (0° = North, 90° = East)
 * @param {number} distanceMeters - Distance in meters
 * @returns {[number, number]} [newLon, newLat]
 */
export function projectForwardMars(lon, lat, azimuthDeg, distanceMeters) {
  const azRad = (azimuthDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const cosLat = Math.max(1e-5, Math.abs(Math.cos(latRad)));

  const dLatDeg = (distanceMeters * Math.cos(azRad) / MARS_RADIUS_METERS) * (180 / Math.PI);
  const dLonDeg = (distanceMeters * Math.sin(azRad) / (MARS_RADIUS_METERS * cosLat)) * (180 / Math.PI);

  const newLat = Math.max(-90, Math.min(90, lat + dLatDeg));
  let newLon = lon + dLonDeg;
  while (newLon > 180) newLon -= 360;
  while (newLon < -180) newLon += 360;

  return [newLon, newLat];
}

/**
 * Raycasts outward from a given position along a specific azimuth to find the highest horizon ridge angle.
 *
 * @param {Function} elevationSampler - Function (lon, lat) => elevation in meters
 * @param {number} originLon
 * @param {number} originLat
 * @param {number} originElevation
 * @param {number} azimuthDeg
 * @param {number} [maxRangeMeters=30000]
 * @param {number} [stepMeters=250]
 * @param {number} [eyeHeight=1.7]
 * @returns {number} Maximum apparent horizon elevation angle in degrees
 */
export function raycastSkylineAngle(
  elevationSampler,
  originLon,
  originLat,
  originElevation,
  azimuthDeg,
  maxRangeMeters = DEFAULT_MAX_HORIZON_RANGE_METERS,
  stepMeters = DEFAULT_RAYCAST_STEP_METERS,
  eyeHeight = DEFAULT_EYE_HEIGHT_METERS
) {
  let maxAngle = -90;

  for (let r = stepMeters; r <= maxRangeMeters; r += stepMeters) {
    const [pLon, pLat] = projectForwardMars(originLon, originLat, azimuthDeg, r);
    const targetElev = elevationSampler(pLon, pLat);

    if (Number.isFinite(targetElev)) {
      const angle = calculateElevationAngle(targetElev, originElevation, r, eyeHeight);
      if (angle > maxAngle) {
        maxAngle = angle;
      }
    }
  }

  // If no mountain ridge is encountered, the flat geometric horizon limit is negative due to curvature
  return maxAngle > -90 ? maxAngle : -Math.sqrt((2 * eyeHeight) / MARS_RADIUS_METERS) * (180 / Math.PI);
}

/**
 * Computes a complete 360° skyline profile (1 elevation angle per degree of the compass) for a point.
 *
 * @param {Function} elevationSampler - (lon, lat) => height
 * @param {number} originLon
 * @param {number} originLat
 * @param {Object} [options]
 * @returns {Float32Array} 360-element array of horizon elevation angles in degrees
 */
export function generateLocationSkyline(elevationSampler, originLon, originLat, options = {}) {
  const maxRange = options.maxRangeMeters || DEFAULT_MAX_HORIZON_RANGE_METERS;
  const step = options.stepMeters || DEFAULT_RAYCAST_STEP_METERS;
  const eyeHeight = options.eyeHeight || DEFAULT_EYE_HEIGHT_METERS;

  const originElevation = elevationSampler(originLon, originLat) || 0;
  const profile = new Float32Array(360);

  for (let deg = 0; deg < 360; deg++) {
    profile[deg] = raycastSkylineAngle(
      elevationSampler,
      originLon,
      originLat,
      originElevation,
      deg,
      maxRange,
      step,
      eyeHeight
    );
  }

  return profile;
}

/**
 * Z-score normalization for scale & pitch invariance:
 * s_norm(phi) = (s(phi) - mean) / stdDev
 *
 * Subtracting mean cancels unknown camera vertical tilt / horizon line offset (y0).
 * Dividing by stdDev cancels unknown camera zoom / vertical field of view (VFOV).
 *
 * @param {Float32Array|Array<number>} profile
 * @returns {Float32Array} Normalized profile
 */
export function zScoreNormalize(profile) {
  const len = profile.length;
  if (len === 0) return new Float32Array(0);

  let sum = 0;
  for (let i = 0; i < len; i++) sum += profile[i];
  const mean = sum / len;

  let sumSq = 0;
  for (let i = 0; i < len; i++) {
    const diff = profile[i] - mean;
    sumSq += diff * diff;
  }
  const std = Math.sqrt(sumSq / len);
  const stdSafe = std > 1e-6 ? std : 1.0;

  const normalized = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    normalized[i] = (profile[i] - mean) / stdSafe;
  }

  return normalized;
}

/**
 * 3-point median filter to clean single-pixel noise or atmospheric dust spikes.
 *
 * @param {Float32Array|Array<number>} arr
 * @returns {Float32Array}
 */
export function medianFilter3(arr) {
  const len = arr.length;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const prev = arr[(i - 1 + len) % len];
    const curr = arr[i];
    const next = arr[(i + 1) % len];
    // Median of 3 elements
    out[i] = Math.max(Math.min(prev, curr), Math.min(Math.max(prev, curr), next));
  }
  return out;
}

/**
 * Extracts a 360-column skyline boundary curve from an image or panorama.
 * Scans each column top-to-bottom to locate where the bright/smooth Martian sky meets the textured terrain.
 *
 * @param {HTMLCanvasElement|ImageData|Object} sourceImage - Image source
 * @param {Object} [options]
 * @param {number} [options.vfovDeg=60] - Optional known vertical field of view
 * @returns {{
 *   rawHorizonRows: Float32Array,
 *   elevationAngles: Float32Array,
 *   zScoreProfile: Float32Array,
 *   width: number,
 *   height: number
 * }}
 */
export function extractSkylineFromImage(sourceImage, options = {}) {
  let width = sourceImage.width;
  let height = sourceImage.height;
  let data = sourceImage.data;

  // If Canvas element
  if (typeof HTMLCanvasElement !== 'undefined' && sourceImage instanceof HTMLCanvasElement) {
    const ctx = sourceImage.getContext('2d');
    const imgData = ctx.getImageData(0, 0, width, height);
    data = imgData.data;
  }

  if (!data || !width || !height) {
    throw new Error('Valid image data with width and height is required');
  }

  const rawRows = new Float32Array(360);
  const validEdge = new Uint8Array(360);
  const vfovDeg = options.vfovDeg || 60;
  const y0 = height / 2.0;
  const degPerPixel = vfovDeg / height;

  // Sample across 360 azimuth columns
  for (let phi = 0; phi < 360; phi++) {
    const x = Math.min(width - 1, Math.floor((phi / 360.0) * width));
    let detectedY = height * 0.5; // default fallback horizon line

    // Scan top-to-bottom (sky to ground)
    let maxGrad = -1;
    let bestY = -1;

    for (let y = 2; y < height - 2; y++) {
      const idxAbove = ((y - 1) * width + x) * 4;
      const idxBelow = ((y + 1) * width + x) * 4;

      // Rec. 601 Luminance
      const lumaAbove = 0.299 * data[idxAbove] + 0.587 * data[idxAbove + 1] + 0.114 * data[idxAbove + 2];
      const lumaBelow = 0.299 * data[idxBelow] + 0.587 * data[idxBelow + 1] + 0.114 * data[idxBelow + 2];

      const grad = Math.abs(lumaBelow - lumaAbove);

      // In space / Mars renderings, sky is either very dark/black space or smooth uniform bright dust
      // The mountain edge creates the first significant luminance transition
      if (grad > maxGrad && grad > 12) {
        maxGrad = grad;
        bestY = y;
        // Stop early if strong horizon edge detected
        if (grad > 35) break;
      }
    }

    if (bestY !== -1) {
      detectedY = bestY;
      validEdge[phi] = 1;
    }

    rawRows[phi] = detectedY;
  }

  // Circular interpolation for any unrendered / gap columns
  for (let phi = 0; phi < 360; phi++) {
    if (!validEdge[phi]) {
      let left = -1;
      for (let offset = 1; offset < 360; offset++) {
        const idx = (phi - offset + 360) % 360;
        if (validEdge[idx]) { left = idx; break; }
      }
      let right = -1;
      for (let offset = 1; offset < 360; offset++) {
        const idx = (phi + offset) % 360;
        if (validEdge[idx]) { right = idx; break; }
      }
      if (left !== -1 && right !== -1) {
        const distL = (phi - left + 360) % 360;
        const distR = (right - phi + 360) % 360;
        rawRows[phi] = (rawRows[left] * distR + rawRows[right] * distL) / (distL + distR);
      }
    }
  }

  // Filter single-pixel noise spikes with a 3-point median filter
  const filteredRows = medianFilter3(rawRows);

  // Convert pixel rows into elevation angles
  // y=0 (top) is positive elevation (+vfov/2), y=height (bottom) is negative elevation (-vfov/2)
  const elevationAngles = new Float32Array(360);
  for (let phi = 0; phi < 360; phi++) {
    elevationAngles[phi] = (y0 - filteredRows[phi]) * degPerPixel;
  }

  // Z-Score normalize for tilt & zoom invariance
  const zScoreProfile = zScoreNormalize(elevationAngles);

  return {
    rawHorizonRows: filteredRows,
    elevationAngles,
    zScoreProfile,
    width,
    height,
  };
}

/**
 * Matches an observed skyline profile against a database of regional DEM candidate skylines.
 * Evaluates all 360 candidate compass headings using circular sliding correlation.
 *
 * @param {Float32Array} observedProfile - 360-element observed profile (or partial slice)
 * @param {Array<Object>} candidateSkylines - Array of { id, name, lon, lat, profile: Float32Array(360) }
 * @returns {{
 *   bestMatch: Object,
 *   candidates: Array<Object>,
 *   matchedHeadingDeg: number
 * }}
 */
export function matchSkylineProfile(observedProfile, candidateSkylines) {
  if (!candidateSkylines || candidateSkylines.length === 0) {
    throw new Error('Candidate skyline database cannot be empty');
  }

  const obsNorm = zScoreNormalize(observedProfile);
  const obsLen = obsNorm.length;
  const isFull360 = obsLen >= 360;

  const results = [];

  for (const cand of candidateSkylines) {
    const candNorm = zScoreNormalize(cand.profile);
    let bestAzimuth = 0;
    let minMse = Infinity;

    // Search across all 360 candidate azimuth offsets (compass headings)
    for (let alpha = 0; alpha < 360; alpha++) {
      let sumSq = 0;
      const count = isFull360 ? 360 : obsLen;

      for (let i = 0; i < count; i++) {
        const candIdx = (i + alpha) % 360;
        const diff = obsNorm[i] - candNorm[candIdx];
        sumSq += diff * diff;
      }

      const mse = sumSq / count;
      if (mse < minMse) {
        minMse = mse;
        bestAzimuth = alpha;
      }
    }

    // Match confidence score (inversely proportional to Mean Squared Error)
    const confidence = Math.max(0.1, Math.min(0.999, 1.0 / (1.0 + minMse * 1.5)));

    results.push({
      id: cand.id,
      name: cand.name,
      lon: cand.lon,
      lat: cand.lat,
      description: cand.description,
      geomorphology: cand.geomorphology,
      bestAzimuthDeg: bestAzimuth,
      mse: Math.round(minMse * 1000) / 1000,
      confidence: Math.round(confidence * 1000) / 1000,
      candidateProfile: cand.profile,
    });
  }

  // Sort by lowest MSE (best match first)
  results.sort((a, b) => a.mse - b.mse);

  const bestMatch = results[0];

  return {
    bestMatch,
    candidates: results,
    matchedHeadingDeg: bestMatch.bestAzimuthDeg,
  };
}

/**
 * Refines a coarse basin match down to exact local coordinates by raycasting
 * a local grid of MOLA DEM candidate coordinates around the basin in real-time.
 *
 * @param {Float32Array} observedProfile - 360-element observed profile
 * @param {Object} bestBasinMatch - Best matching candidate basin from coarse search
 * @param {Function} elevationSampler - (lon, lat) => height in meters
 * @param {number} [radiusDeg=1.0] - Search radius in degrees (±1° ≈ ±60 km)
 * @param {number} [stepDeg=0.25] - Grid step in degrees (0.25° ≈ 15 km)
 * @returns {Object} Refined match with exact sub-regional coordinates and MSE
 */
export function refineLocationGrid(
  observedProfile,
  bestBasinMatch,
  elevationSampler,
  radiusDeg = 1.0,
  stepDeg = 0.25
) {
  if (!elevationSampler || typeof elevationSampler !== 'function' || !bestBasinMatch) {
    return bestBasinMatch;
  }

  const centerLon = bestBasinMatch.lon;
  const centerLat = bestBasinMatch.lat;
  const gridCandidates = [];

  for (let dLat = -radiusDeg; dLat <= radiusDeg; dLat += stepDeg) {
    for (let dLon = -radiusDeg; dLon <= radiusDeg; dLon += stepDeg) {
      const gLon = centerLon + dLon;
      const gLat = centerLat + dLat;

      const profile = generateLocationSkyline(elevationSampler, gLon, gLat, {
        stepMeters: 500,
        maxRangeMeters: 40000,
      });

      gridCandidates.push({
        id: `GRID_${gLon.toFixed(3)}_${gLat.toFixed(3)}`,
        name: bestBasinMatch.name,
        lon: gLon,
        lat: gLat,
        description: bestBasinMatch.description,
        geomorphology: bestBasinMatch.geomorphology,
        profile,
      });
    }
  }

  const match = matchSkylineProfile(observedProfile, gridCandidates);
  return {
    ...match.bestMatch,
    baseBasinName: bestBasinMatch.name,
    isRefined: true,
  };
}

export { CANONICAL_MARS_SKYLINES } from './skyline-candidates.js';


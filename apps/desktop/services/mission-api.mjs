import {mkdir, readFile, rename, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {isDeepStrictEqual} from 'node:util';
import {decodeTopography, sampleHeight, MARS_RADIUS_M} from '../web/src/global-terrain.js';
import {selectionShape, pointInSelection, segmentsIntersect} from '../web/src/map-area.js';
import {marsDistance as measurementDistance, sphericalArc} from '../web/src/measurement-geometry.js';
import {sampleEnvironment} from '../web/src/environment-data.js';
import {sampleWind} from '../web/src/wind-data.js';
import {SurfaceRaster} from '../web/src/raster.js';
import {fromFile} from 'geotiff';
import {sampleGrid} from '../web/src/planet.js';
import {auditTerrainReference} from '../web/src/terrain-integrity.js';

const FRAME = 'mars-east-planetocentric';
const RAD = Math.PI / 180;
const MOLA = {id: 'MOLA-MEGR90N000CB', gridMeters: MARS_RADIUS_M * RAD / 4, datum: 'Mars areoid', kind: 'measured_dem'};
const PARAMETERS = {Tair: 'K', Tsurf: 'K', Psurf: 'Pa', Dust: 'tau', wind: 'm/s'};
const wrap = lon => ((lon + 180) % 360 + 360) % 360 - 180;
const relative = (point, anchor) => [anchor + wrap(point[0] - anchor), point[1]];

function invalid(message, status = 422) {
  throw Object.assign(Error(message), {status});
}

function point(value) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite) ||
      Math.abs(value[0]) > 180 || Math.abs(value[1]) > 90) invalid('Expected [east longitude, planetocentric latitude]');
  return value;
}

function time(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) invalid('Expected a UTC ISO timestamp');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) invalid('Invalid UTC timestamp');
  const canonical = new Date(parsed).toISOString();
  if (canonical !== value.replace(/(?<=:\d{2})Z$/, '.000Z')) invalid('Invalid UTC calendar time');
  return canonical;
}

function polygonHits(a, b, polygon) {
  const anchor = (polygon.bounds[0] + polygon.bounds[2]) / 2;
  const from = relative(a, anchor), to = relative(b, from[0]);
  for (const shift of [-360, 0, 360]) {
    const start = [from[0] + shift, from[1]], end = [to[0] + shift, to[1]];
    if (polygon.polygon.some((p, index, vertices) => segmentsIntersect(start, end, p, vertices[(index + 1) % vertices.length]))) return true;
  }
  return pointInSelection(a, polygon) || pointInSelection(b, polygon);
}

function observe(input) {
  if (!input || typeof input.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(input.id) ||
      !['waypoint', 'sample', 'photo', 'measurement'].includes(input.kind) ||
      typeof input.label !== 'string' || !input.label.trim() || input.label.length > 160) invalid('Provide a stable ID, kind and short label');
  if (input.frame !== FRAME) invalid('Expected the Atlas Mars coordinate frame');
  const result = {id: input.id, kind: input.kind, label: input.label.trim(), frame: FRAME, point: point(input.point), at: time(input.at)};
  for (const key of ['reference', 'source']) {
    if (input[key] == null) continue;
    if (typeof input[key] !== 'string' || input[key].length > 240) invalid(`Invalid ${key}`);
    result[key] = input[key];
  }
  if (input.kind === 'measurement') {
    const {parameter, value, units, dataKind} = input;
    if (typeof parameter !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(parameter) || !Number.isFinite(value) ||
        typeof units !== 'string' || !units || units.length > 32 || !['measured', 'modeled'].includes(dataKind) || !result.source?.trim()) {
      invalid('Measurements require a parameter, finite value, units, source, and measured or modeled dataKind');
    }
    if (Object.hasOwn(PARAMETERS, parameter) && units !== PARAMETERS[parameter]) invalid(`Expected ${PARAMETERS[parameter]} for ${parameter}`);
    Object.assign(result, {parameter, value, units, dataKind});
  }
  return result;
}

export function createMissionApi({directory, webRoot, localMaps, getSourceMaps, notify = () => {}}) {
  const file = path.join(directory, 'observations.json');
  let observationsPromise, pending = Promise.resolve(), molaPromise, archivePromise;

  function observations() {
    return observationsPromise ??= (async () => {
      try {
        if ((await stat(file)).size > 4 * 1024 * 1024) throw Error('Observation file exceeds its limit');
        const list = JSON.parse(await readFile(file, 'utf8'));
        if (!Array.isArray(list) || list.length > 5000) throw Error('Invalid observation file');
        return list.map(observe);
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw Object.assign(Error('Observation store is unreadable'), {status: 503});
      }
    })();
  }

  function saveObservation(input) {
    const observation = observe(input);
    const write = pending.catch(() => {}).then(async () => {
      const previous = await observations();
      const existing = previous.find(item => item.id === observation.id);
      if (existing) {
        if (isDeepStrictEqual(existing, observation)) return existing;
        invalid('Observation ID already exists with different data', 409);
      }
      const list = [...previous, observation];
      const data = JSON.stringify(list);
      if (list.length > 5000 || Buffer.byteLength(data) > 4 * 1024 * 1024) invalid('Observation store is full', 507);
      await mkdir(directory, {recursive: true});
      await writeFile(file + '.tmp', data, {mode: 0o600});
      await rename(file + '.tmp', file);
      observationsPromise = Promise.resolve(list);
      notify();
      return observation;
    });
    pending = write;
    return write;
  }

  function mola() {
    return molaPromise ??= readFile(path.join(webRoot, 'dist', 'mola-topography.dat')).catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return readFile(path.join(webRoot, 'public', 'mola-topography.dat'));
    }).then(bytes => {
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes, {maxOutputLength: 1440 * 720 * 2});
      return decodeTopography(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    });
  }

  async function terrain(points) {
    const values=await mola();
    return points.map(([lon, lat]) => {
      const elevationMeters = sampleHeight(values, lon, lat);
      const step = .25;
      const dx = 2 * MOLA.gridMeters * Math.cos(lat * RAD);
      const east = sampleHeight(values, lon + step, lat), west = sampleHeight(values, lon - step, lat);
      const north = sampleHeight(values, lon, Math.min(lat + step, 90)), south = sampleHeight(values, lon, Math.max(lat - step, -90));
      const slopeDegrees = Math.abs(lat) > 89.75 ? null : Math.atan(Math.hypot((east - west) / dx, (north - south) / (2 * MOLA.gridMeters))) / RAD;
      return {point: [lon, lat], elevationMeters, slopeDegrees, coverage: 'overview', source: MOLA};
    });
  }

  async function queryTerrain(points) {
    const catalogue = await localMaps?.catalog();
    const datasets = (catalogue?.datasets ?? []).filter(dataset =>
      Array.isArray(dataset.dem_grid_m) && dataset.dem_grid_m.length === 2 &&
      dataset.dem_grid_m.every(value => Number.isFinite(value) && value > 0));
    datasets.sort((a, b) => Math.max(...a.dem_grid_m) - Math.max(...b.dem_grid_m));
    const fallback=await terrain(points),sourceMaps=getSourceMaps?.();
    const downloaded=sourceMaps?.layers().filter(item=>item.product.role==='terrain')??[];
    if(downloaded.length){
      const values=await mola(),audits=new WeakMap();
      for(let i=0;i<points.length;i++){
        const tile=await sourceMaps.terrainGridAt(points[i],downloaded);
        if(!tile)continue;
        if(!audits.has(tile))audits.set(tile,auditTerrainReference(tile,(lon,lat)=>sampleHeight(values,lon,lat)).valid);
        if(!audits.get(tile))continue;
        const [lon,lat]=points[i],at=(x,y)=>sampleGrid(tile.grid,tile.width,tile.bounds,x,y);
        const h=at(lon,lat),step=tile.gridMeters/(MARS_RADIUS_M*RAD),longitudeStep=step/Math.max(.01,Math.cos(lat*RAD));
        const adjacent=[at(lon-longitudeStep,lat),at(lon+longitudeStep,lat),at(lon,lat-step),at(lon,lat+step)];
        const slopeDegrees=adjacent.every(Number.isFinite)
          ?Math.atan(Math.hypot(adjacent[1]-adjacent[0],adjacent[3]-adjacent[2])/(2*tile.gridMeters))/RAD:null;
        fallback[i]={point:points[i],elevationMeters:h??null,slopeDegrees,coverage:Number.isFinite(h)?'installed':'gap',
          source:{id:'hrsc-elevation',gridMeters:tile.gridMeters,datum:'Mars areoid',credit:tile.credit,kind:'measured_dem'}};
      }
    }
    if(!datasets.length)return fallback;
    const files = new Map();
    const keys = new Map(datasets.flatMap(dataset => dataset.terrain.map(asset => [`${dataset.id}/terrain/${asset.key}`, asset.id])));
    const rasterCache = {read: async (key, reader) => {
      const id = keys.get(key);
      const binding = localMaps.bindings.get(id);
      if (!binding) throw Error('Installed terrain source is unavailable');
      if (!files.has(id)) {
        const asset = await localMaps.registry.asset(binding.packageId, binding.file);
        files.set(id, fromFile(path.join(asset.root, asset.path)));
      }
      return reader(await files.get(id));
    }};
    try {
      for (let i = 0; i < points.length; i++) {
        const [lon, lat] = points[i];
        const dataset = datasets.find(item => lon >= item.bounds[0] && lon <= item.bounds[2] && lat >= item.bounds[1] && lat <= item.bounds[3]);
        if (!dataset) continue;
        const spacing = Math.max(...dataset.dem_grid_m);
        const latStep = spacing / (MARS_RADIUS_M * RAD);
        const lonStep = latStep / Math.max(.01, Math.cos(lat * RAD));
        const source = {id: dataset.id, gridMeters: spacing, datum: dataset.height_reference, credit: dataset.packageCredit, kind: 'measured_dem'};
        const bounds = [lon - lonStep, lat - latStep, lon + lonStep, lat + latStep];
        const samples = await new SurfaceRaster(dataset,{fileCache:rasterCache,pool:()=>undefined}).read(bounds,3,3,{kind:'terrain',nodes:true});
        source.gridMeters = Math.max(spacing, samples.gridMeters || 0);
        const elevationMeters = Number.isFinite(samples[4]) ? samples[4] : null;
        const slopeDegrees = elevationMeters !== null && [samples[1],samples[3],samples[5],samples[7]].every(Number.isFinite)
          ? Math.atan(Math.hypot(samples[5]-samples[3],samples[1]-samples[7])/(2*spacing))/RAD : null;
        fallback[i] = {point: points[i], elevationMeters, slopeDegrees, coverage: elevationMeters === null ? 'gap' : 'installed', source};
      }
      return fallback;
    } finally {
      await Promise.allSettled([...files.values()].map(async promise => (await promise).close()));
    }
  }

  async function evaluateRoute(input) {
    const coordinates = input?.path ?? [input?.start, input?.destination];
    if (!Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > 128) invalid('Provide 2–128 path points, or start and destination');
    const points = coordinates.map(point);
    if (points.some(p => Math.abs(p[1]) > 89.75)) invalid('Route evaluation stops at 89.75° latitude');
    const exclusions = input?.exclusions ?? [];
    if (!Array.isArray(exclusions) || exclusions.length > 24) invalid('Provide at most 24 exclusion polygons');
    const zones = exclusions.map(zone => {
      if (typeof zone?.id !== 'string' || !zone.id || zone.id.length > 80 || !Array.isArray(zone.polygon) || zone.polygon.length > 128) invalid('Invalid exclusion polygon');
      return {id: zone.id, shape: selectionShape({polygon: zone.polygon})};
    });
    const spacing = input.spacingMeters ?? MOLA.gridMeters;
    if (!Number.isFinite(spacing) || spacing < 10 || spacing > 15000) invalid('Use sample spacing from 10 to 15,000 metres');
    const sampled = [points[0]], distance = [0], hits = new Set();
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const leg = measurementDistance(a, b);
      const steps = Math.max(1, Math.ceil(leg / spacing));
      if (sampled.length + steps > 768) invalid('Route exceeds 768 samples. Increase the spacing or split the route.');
      const arc = sphericalArc(a, b, Infinity, steps);
      const startDistance = distance.at(-1);
      for (let j = 1; j < arc.length; j++) {
        sampled.push(arc[j]);
        distance.push(startDistance + (j / steps) * leg);
        for (const zone of zones) if (!hits.has(zone.id) && polygonHits(arc[j - 1], arc[j], zone.shape)) hits.add(zone.id);
      }
    }
    const maxSlope = input.maxSlopeDegrees;
    if (maxSlope != null && (!Number.isFinite(maxSlope) || maxSlope < 0 || maxSlope > 90)) invalid('Invalid maximum slope');
    const profile = (await queryTerrain(sampled)).map((entry, i) => ({...entry, distanceMeters: distance[i]}));
    const steepSamples = maxSlope == null ? [] : profile.flatMap((item, index) => item.slopeDegrees != null && item.slopeDegrees > maxSlope ? [index] : []);
    return {frame: FRAME, kind: 'proposed-path-evaluation', distanceMeters: distance.at(-1), profile,
      intersectingExclusions: [...hits], steepSamples, unknownTerrainSamples: profile.filter(item => item.elevationMeters === null).length};
  }

  function environmentArchive() {
    return archivePromise ??= Promise.all(['environment/verified-snapshot.json', 'wind/bootstrap.json']
      .map(name => readFile(path.join(webRoot, 'data', name), 'utf8').then(JSON.parse)));
  }

  async function environmentArchiveTimes() {
    const [fields] = await environmentArchive();
    return Object.fromEntries(Object.entries(fields.fields??{}).map(([key,field])=>[key,field.model_time]));
  }

  async function environment(query) {
    const parameter = query.get('parameter');
    if (!Object.hasOwn(PARAMETERS, parameter)) invalid('Choose Tair, Tsurf, Psurf, Dust, or wind');
    const at = time(query.get('at'));
    if (!query.get('lon')?.trim() || !query.get('lat')?.trim()) invalid('Provide lon and lat');
    const target = point([Number(query.get('lon')), Number(query.get('lat'))]);
    const kind = query.get('kind') ?? 'modeled';
    if (kind === 'measured') {
      const radius = query.has('radiusMeters') ? Number(query.get('radiusMeters')) : 1000;
      const maxAge = query.has('maxAgeSeconds') ? Number(query.get('maxAgeSeconds')) : 86400;
      if (!Number.isFinite(radius) || radius <= 0 || radius > 100000 || !Number.isFinite(maxAge) || maxAge < 0 || maxAge > 2592000) invalid('Invalid radius or maximum age');
      const reference = Date.parse(at);
      const matches = (await observations()).filter(record => record.dataKind === 'measured' && record.parameter === parameter && record.at <= at)
        .map(record => ({...record, distanceMeters: measurementDistance(target, record.point), ageSeconds: (reference - Date.parse(record.at)) / 1000}))
        .filter(record => record.distanceMeters <= radius && record.ageSeconds <= maxAge)
        .sort((a, b) => a.distanceMeters - b.distanceMeters || a.ageSeconds - b.ageSeconds).slice(0, 20);
      return {parameter, kind, at, point: target, coverage: matches.length ? 'available' : 'unavailable', observations: matches};
    }
    if (kind !== 'modeled') invalid('Choose measured or modeled');
    const [fields, wind] = await environmentArchive();
    const grid = parameter === 'wind' ? wind : fields.fields[parameter];
    const value = grid?.model_time === at ? (parameter === 'wind' ? sampleWind(grid, ...target) : sampleEnvironment(grid, ...target)) : null;
    return {parameter, kind: 'modeled_climatology', at, point: target, value: value ?? null, units: grid?.units ?? PARAMETERS[parameter],
      coverage: value == null ? 'unavailable' : 'available', availableModelTime: grid?.model_time ?? null,
      model: grid?.model_label ?? null, source: grid?.source ?? null, spatialSupport: grid?.spatial_support ?? null};
  }

  async function list(query) {
    const since = query.get('since') ? time(query.get('since')) : null;
    const until = query.get('until') ? time(query.get('until')) : null;
    const shape = query.has('bounds') ? selectionShape({bounds: query.get('bounds').split(',').map(Number)}) : null;
    const offset = Number(query.get('offset') ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 5000 || (since && until && since > until)) invalid('Invalid observation range');
    const matched = (await observations()).filter(item => (!since || item.at >= since) && (!until || item.at <= until) && (!shape || pointInSelection(item.point, shape)));
    const items = matched.slice(offset, offset + 200);
    return {type: 'FeatureCollection', features: items.map(item => ({type: 'Feature', id: item.id, geometry: {type: 'Point', coordinates: item.point}, properties: item})), nextOffset: offset + items.length < matched.length ? offset + items.length : null};
  }

  return {
    routes: new Map([
      ['POST /v1/terrain/query', async (_query, body) => {
        if (!Array.isArray(body?.points) || body.points.length < 1 || body.points.length > 200) invalid('Provide 1–200 points');
        return {frame: FRAME, samples: await queryTerrain(body.points.map(point))};
      }],
      ['POST /v1/routes/evaluate', (_query, body) => evaluateRoute(body)],
      ['GET /v1/observations', list],
      ['POST /v1/observations', (_query, body) => saveObservation(body)],
      ['GET /v1/environment', environment],
    ]),
    list, queryTerrain, environment, environmentArchiveTimes, saveObservation,
    async nearbyObservations(target) {
      return (await observations()).map(record=>({...record,distanceMeters:measurementDistance(point(target),record.point)}))
        .filter(record=>record.distanceMeters<=10000).sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,5);
    },
    async flush() { await pending.catch(() => {}); },
  };
}

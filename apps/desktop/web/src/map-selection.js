import {resolveArea} from "./map-area.js";
// Shared catalogue presentation used by the manager and review preview.
export const STARTER_ID = 'mars-global-overview';
export const CACHE_GIB = [1, 2, 5, 10, 20, 50, 100];
export const defaultMapChoices = () => ({globalId: STARTER_ID, regionalIds: [], progressive: false, cacheGiB: 5, areaSelection: null, areaPackageIds: [], imageryAppearance:"grayscale", selectionPreviewAppearance:"grayscale"});
export function mapOption(manifest) {
  const p = manifest.presentation;
  if (!p) return null;
  return {
    id: manifest.id, name: manifest.name, version: manifest.version,
    scope: p.scope, qualityLabel: p.qualityLabel, appearances:p.imageryAppearance?[p.imageryAppearance]:[], colorKind:p.colorKind??null,
    imageryMetersPerPixel: p.imageryMetersPerPixel,
    terrainMetersPerPixel: p.terrainMetersPerPixel ?? null,
    placeId: p.placeId ?? manifest.id, placeName: p.placeName ?? manifest.name,
    bounds: manifest.bounds, credit: manifest.provenance.credit,
    source: manifest.provenance.source, description: p.description ?? '',
    bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0),
  };
}
export function starterOption(starter) {
  return {
    id: STARTER_ID, name: 'Bundled starter', version: starter.version,
    scope: 'global', qualityLabel: 'Starter', appearances:['grayscale','color'], colorKind:'colorized',
    imageryMetersPerPixel: starter.imageryMetersPerPixelAtEquator,
    terrainMetersPerPixel: null, bounds: starter.bounds,
    credit: starter.credit, source: 'Bundled CTX / Viking overview and MOLA elevation',
    bytes: starter.files.reduce((sum, file) => sum + file.bytes, 0),
    included: true, description: 'Already included with the app. Coarse imagery; MOLA elevation at 4 pixels per degree.',
  };
}
export const supportsAppearance=(option,appearance)=>option.appearances?.includes(appearance)===true;
export function normalizeChoices(input, options) {
  const defaults = defaultMapChoices();
  const value = input && typeof input === 'object' ? input : defaults;
  const imageryAppearance=value.imageryAppearance==='color'?'color':'grayscale';
  options=options.filter(o=>supportsAppearance(o,imageryAppearance));
  const global = options.find(o => o.scope === 'global' && o.id === value.globalId)
    ?? options.find(o => o.id === STARTER_ID);
  const requested = Array.isArray(value.regionalIds) ? value.regionalIds.slice(0, 1000) : [];
  const places = new Set(), regionalIds = [];
  // One selected resolution per place. Finer-than-global is a numerical comparison.
  for (const id of [...new Set(requested)]) {
    const option = options.find(o => o.id === id && o.scope === 'regional');
    if (!option || option.imageryMetersPerPixel >= global.imageryMetersPerPixel || places.has(option.placeId)) continue;
    places.add(option.placeId);
    regionalIds.push(id);
  }
  const area = resolveArea(options,global.id,value.areaSelection);
  return {
    imageryAppearance, selectionPreviewAppearance:value.selectionPreviewAppearance==="color"?"color":"grayscale",
    areaSelection: area ? {bounds:area.bounds,...(area.polygon?{polygon:area.polygon}:{}),...(area.circle?{circle:area.circle}:{}),resolution:area.resolution} : null,
    areaPackageIds: area?.packageIds ?? [],
    globalId: global.id, regionalIds, progressive: value.progressive === true,
    cacheGiB: CACHE_GIB.includes(value.cacheGiB) ? value.cacheGiB : defaults.cacheGiB,
  };
}
export function regionalGroups(options, choices) {
  const global = options.find(o => o.id === choices.globalId);
  const groups = new Map();
  for (const option of options) {
    if (!supportsAppearance(option,choices.imageryAppearance))continue;
    if (option.scope !== 'regional' || option.imageryMetersPerPixel >= global.imageryMetersPerPixel) continue;
    const key = option.imageryMetersPerPixel;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(option);
  }
  return [...groups].sort(([a], [b]) => b - a).map(([resolution, places]) => ({
    resolution, places: places.sort((a, b) => a.placeName.localeCompare(b.placeName)),
  }));
}
export function selectPlace(choices, option, checked, options) {
  const regionalIds = choices.regionalIds.filter(id => {
    const previous = options.find(o => o.id === id);
    return previous?.placeId !== option.placeId;
  });
  if (checked) regionalIds.push(option.id);
  return {...choices, regionalIds};
}
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'Unavailable';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.max(0, Math.min(units.length - 1, Math.floor(Math.log(Math.max(1, bytes)) / Math.log(1024))));
  return (bytes / 1024 ** i).toLocaleString(undefined, {maximumFractionDigits: i ? 2 : 0}) + ' ' + units[i];
}
export function formatResolution(metres) {
  if (!Number.isFinite(metres)) return 'Not specified';
  return metres >= 1000 ? (metres / 1000).toLocaleString(undefined, {maximumFractionDigits: 2}) + ' km/px'
    : metres.toLocaleString(undefined, {maximumFractionDigits: 2}) + ' m/px';
}
export const containsPoint = (bounds, point) => point[0] >= bounds[0] && point[0] <= bounds[2] && point[1] >= bounds[1] && point[1] <= bounds[3];

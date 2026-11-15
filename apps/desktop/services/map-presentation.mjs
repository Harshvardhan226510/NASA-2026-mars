// Optional presentation metadata never grants source approval or invents coverage.
const label = (value, max = 160) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const resolution = value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1e6;
const tileSpec = {
  imagery: {pixels: [256, 512, 1024, 2048], extensions: ['jpg', 'jpeg', 'png', 'webp']},
  terrain: {pixels: [513], extensions: ['lerc']},
};
export function validateMapPresentation(manifest) {
  const p = manifest.presentation;
  if (!p) {
    if (manifest.planetTiles) throw Error('Global tiles require explicit presentation metadata');
    return;
  }
  if (!['global', 'regional'].includes(p.scope) || !label(p.qualityLabel, 60) || !resolution(p.imageryMetersPerPixel)
    || p.terrainMetersPerPixel != null && !resolution(p.terrainMetersPerPixel)
    || p.description != null && !label(p.description, 1200)) throw Error('Invalid map quality metadata');
  if(p.imageryAppearance!=null&&!['color','grayscale'].includes(p.imageryAppearance))throw Error('Unknown imagery appearance');
  if(p.imageryAppearance==='color'&&!['natural','enhanced','colorized'].includes(p.colorKind))throw Error('Color packages must declare natural, enhanced or colorized source imagery');
  if (p.scope === 'regional') {
    if(p.imageryAppearance==='color')throw Error('Regional color packages require RGB display support; the current native packet format is grayscale-only.');
    if (!label(p.placeId, 100) || !label(p.placeName) || !manifest.dataset || manifest.planetTiles)
      throw Error('Regional choices require a named place and verified native dataset');
    // Native grid metadata describes imagery and elevation separately.
    const imagery = manifest.dataset.imagery_grid_m, terrain = manifest.dataset.dem_grid_m;
    if (!Array.isArray(imagery) || imagery.length !== 2 || !imagery.every(resolution)
      || p.imageryMetersPerPixel < Math.max(...imagery) * .99)
      throw Error('Quality must not claim sharper imagery than the source grid');
    if (p.terrainMetersPerPixel != null && (!Array.isArray(terrain) || !terrain.every(resolution)
      || p.terrainMetersPerPixel < Math.max(...terrain) * .99)) throw Error('Terrain quality exceeds its source grid');
    return;
  }
  if (manifest.dataset || JSON.stringify(manifest.bounds) !== '[-180,-90,180,90]' || !manifest.planetTiles?.imagery)
    throw Error('A whole-Mars choice requires a complete global tile pyramid');
  const files = new Set(manifest.files.map(file => file.path));
  for (const [kind, tile] of Object.entries(manifest.planetTiles)) {
    const spec = tileSpec[kind];
    if (!spec || !Number.isInteger(tile.maximumLevel) || tile.maximumLevel < 0 || tile.maximumLevel > (kind === 'terrain' ? 7 : 12)
      || !spec.pixels.includes(tile.tilePixels) || typeof tile.template !== 'string'
      || !/^[a-z0-9/_{}.-]+$/i.test(tile.template)
      || !spec.extensions.some(ext => tile.template.endsWith('.' + ext))
      || ['{z}', '{y}', '{x}'].some(token => tile.template.split(token).length !== 2)
      || tile.template.replaceAll(/\{[zyx]\}/g, '').includes('{')) throw Error('Invalid global tile layout');
    const count = 2 * (4 ** (tile.maximumLevel + 1) - 1) / 3;
    if (count > manifest.files.length) throw Error('Global package is missing tiles');
    // Bounded by the already validated manifest file count.
    for (let z = 0; z <= tile.maximumLevel; z++) for (let y = 0; y < 2 ** z; y++) for (let x = 0; x < 2 ** (z + 1); x++) {
      if (!files.has(tile.template.replace('{z}', z).replace('{y}', y).replace('{x}', x)))
        throw Error('Global package is missing tiles, including polar coverage');
    }
    const actualGrid = Math.PI * 3396190 / (tile.tilePixels * 2 ** tile.maximumLevel);
    const stated = kind === 'imagery' ? p.imageryMetersPerPixel : p.terrainMetersPerPixel;
    if (kind === 'terrain' && stated == null || stated < actualGrid * .99) throw Error('Quality exceeds stored tile sampling');
  }
}

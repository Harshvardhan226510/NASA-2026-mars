import {selectionShape, selectionIntersectsBounds, selectionContainsBounds, splitArea} from './map-area.js';
import {geographicBounds, overlaps} from './planet-grid.js';

export const SOURCE_TILE_BYTES = 256 * 1024;
const largeTile = 1024 * 1024;
const world = [-180, -90, 180, 90];
const trek = 'https://trek.nasa.gov/tiles/Mars/EQ';
const arcgis = 'https://astro.arcgis.com/arcgis/rest/services/OnMars';
const trekProduct = (layer, extension) => (x, y, z) => trek+'/'+layer+'/1.0.0/default/default028mm/'+z+'/'+y+'/'+x+'.'+extension;
const arcProduct = layer => (x, y, z) => arcgis+'/'+layer+'/tile/'+z+'/'+y+'/'+x;
const trekReference = 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars';
const hrscReference = 'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m';
const hiriseCredit = 'NASA/JPL/University of Arizona HiRISE · NASA Mars Trek';

function hirise(name, layer, coverage, max, nativeMetres, min = 10) {
  return {name, group:'HiRISE', role:'imagery', coverage, min, max, root:0, pixels:256,
    nativeMetres, extension:'png', tileBytes:largeTile, sparse:true, grayscaleOnly:true,
    url:trekProduct(layer,'png'), reference:trekReference, credit:hiriseCredit};
}

export const MAP_SOURCES = Object.freeze({
  viking: {name:'Viking MDIM 2.1', group:'Optical imagery', role:'imagery', coverage:world, min:0, max:7, root:0,
    pixels:256, nativeMetres:232, extension:'jpg', tileBytes:SOURCE_TILE_BYTES,
    url:trekProduct('Mars_Viking_MDIM21_ClrMosaic_global_232m','jpg'),
    reference:'https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m',
    credit:'NASA Ames / USGS Viking MDIM 2.1 · NASA Mars Trek'},
  'hrsc-relief': {name:'HRSC / MOLA shaded relief', group:'Relief imagery', role:'imagery', coverage:world, min:0, max:8, root:0,
    pixels:256, nativeMetres:200, extension:'jpg', tileBytes:SOURCE_TILE_BYTES,
    url:trekProduct('Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw','jpg'),
    urlForAppearance:appearance=>trekProduct(appearance==='grayscale'?'Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw':'Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw','jpg'),
    reference:hrscReference, credit:'USGS / NASA MOLA / ESA Mars Express HRSC · NASA Mars Trek'},
  'hrsc-elevation': {name:'HRSC / MOLA measured elevation', group:'Elevation', role:'terrain', coverage:world, min:1, max:7, root:1,
    pixels:513, nativeMetres:200, extension:'lerc', tileBytes:2*largeTile,
    url:arcProduct('MDEM200M/ImageServer'), reference:hrscReference, credit:'USGS / NASA MOLA / ESA Mars Express HRSC · Esri'},
  themis: {name:'THEMIS daytime infrared', group:'Infrared imagery', role:'imagery', coverage:[-180,-60,180,60], min:0, max:9, root:0,
    pixels:256, nativeMetres:100, extension:'png', tileBytes:largeTile, sparse:true, grayscaleOnly:true,
    url:trekProduct('THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018','png'), reference:'https://stac.astrogeology.usgs.gov/docs/data/mars/themis_controlled_mosaics/',
    credit:'NASA/JPL/ASU/USGS THEMIS · NASA Mars Trek'},
  ctx: {name:'CTX global mosaic', group:'Optical imagery', role:'imagery', coverage:[-180,-88,180,88], min:0, max:12, root:0,
    pixels:512, nativeMetres:5, extension:'png', tileBytes:largeTile, sparse:true, grayscaleOnly:true,
    url:arcProduct('CTX1/MapServer'), reference:'https://murray-lab.caltech.edu/CTX/V01/TilePages/', credit:'NASA/JPL/MSSS / Caltech Murray Lab · Esri CTX'},
  'hirise-jezero': hirise('HiRISE · Jezero controlled mosaic','JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd',[77.2229331,18.3067994,77.583964,18.669315],17,.25),
  'hirise-gale': hirise('HiRISE · Gale / Curiosity','curiosity_hirise_mosaic',[137.1224669,-4.9254743,137.7298129,-4.2489588],16,.25),
  'hirise-insight': hirise('HiRISE · InSight','ESP_058005_1845_RED_spline_rect',[135.5687727, 4.3304903, 135.6963018, 4.6680121],17,.25),
  'hirise-opportunity': hirise('HiRISE · Opportunity','opportunity_hirise_mosaic',[-5.5964391, -2.7513281, -4.9954112, -1.8994384],17,.25),
  'hirise-columbia': hirise('HiRISE · Columbia Hills','spirit_hirise_mosaic',[175.4278511, -14.6925026, 175.5858031, -14.5357546],17,.25),
  'hirise-phoenix': hirise('HiRISE · Phoenix','phoenix_hirise_mosaic',[-125.8898226, 68.165978, -125.6607922, 68.2499439],16,.25),
  'hirise-sojourner': hirise('HiRISE · Sojourner','sojourner_hirise_mosaic',[-33.2879718, 19.0227898, -33.208734, 19.1598471],16,.25),
  'hirise-candor': hirise('HiRISE · Southwest Candor Chasma','PSP_001918_1735_RED_A_01_ORTHO_longlat',[-76.9823817, -6.5613214, -76.8732883, -6.3775787],16,.25),
  'hirise-viking1': hirise('HiRISE · Viking 1','PSP_001521_2025_RED',[-48.0315109, 22.0911996, -47.8627669, 22.4608596],17,.25),
  'hirise-viking2': hirise('HiRISE · Viking 2','PSP_001501_2280_RED',[134.1990102, 47.5633533, 134.3996328, 47.7836251],16,.25),
  'hirise-marth': hirise('HiRISE · Marth Crater','ESP_042252_1930_RED_B_01_ORTHO',[-4.3189165, 12.4509362, -4.1936811, 12.8286463],15,.25),
});

export function mapSource(id) {
  if (typeof id !== 'string' || !Object.hasOwn(MAP_SOURCES,id)) throw Error('Choose a supported map product.');
  return MAP_SOURCES[id];
}

export function sourceMeters(level, sourceId = 'viking') {
  const product = mapSource(sourceId);
  const intervals = product.role==='terrain'?product.pixels-1:product.pixels;
  return Math.max(product.nativeMetres,Math.PI*3396190/(intervals*2**level));
}

export function sourceCoverage(shape, product) {
  return splitArea(shape.bounds).map(bounds => [
    Math.max(bounds[0],product.coverage[0]),Math.max(bounds[1],product.coverage[1]),
    Math.min(bounds[2],product.coverage[2]),Math.min(bounds[3],product.coverage[3]),
  ]).filter(bounds=>bounds[0]<bounds[2]&&bounds[1]<bounds[3]&&selectionIntersectsBounds(shape,bounds));
}

function sourceSelection(selection,level,appearance,sourceId){
  const product=mapSource(sourceId);
  if(!Number.isInteger(level)||level<product.min||level>product.max||!['color','grayscale'].includes(appearance))
    throw Error('Choose a quality supported by the map product.');
  const shape=selectionShape(selection),boxes=sourceCoverage(shape,product);
  if(!boxes.length)throw Error('The selected area does not intersect this product’s coverage.');
  return {product,shape,boxes};
}

export function sourceMapEstimate(selection,level,appearance,sourceId='viking'){
  const {product,shape,boxes}=sourceSelection(selection,level,appearance,sourceId);
  function count(x,y,z){
    const tile=geographicBounds(x,y,z);
    if(!boxes.some(box=>overlaps(box,tile))||!selectionIntersectsBounds(shape,tile))return 0;
    const contained=boxes.some(box=>box[0]<=tile[0]&&box[1]<=tile[1]&&box[2]>=tile[2]&&box[3]>=tile[3]);
    if(contained&&selectionContainsBounds(shape,tile)){
      const first=Math.max(z,product.root);
      return (4**(level-z+1)-4**(first-z))/3;
    }
    let total=z>=product.root?1:0;
    if(z<level)for(let j=0;j<2;j++)for(let i=0;i<2;i++)total+=count(2*x+i,2*y+j,z+1);
    return total;
  }
  let tileCount=0;
  if(!shape.polygon){
    for(let z=product.root;z<=level;z++){
      const rows=2**z,columns=2*rows;
      const ranges=boxes.map(([w,s,e,n])=>[
        Math.max(0,Math.floor((w+180)/360*columns)),Math.max(0,Math.floor((90-n)/180*rows)),
        Math.min(columns,Math.ceil((e+180)/360*columns)),Math.min(rows,Math.ceil((90-s)/180*rows)),
      ]);
      for(const [left,top,right,bottom] of ranges)tileCount+=(right-left)*(bottom-top);
      if(ranges.length===2){
        const [a,b]=ranges;
        tileCount-=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
      }
    }
  }else tileCount=count(0,0,0)+count(1,0,0);
  const {bounds,polygon,circle}=shape;
  const partial=splitArea(bounds).some(b=>b[0]<product.coverage[0]||b[1]<product.coverage[1]||b[2]>product.coverage[2]||b[3]>product.coverage[3]);
  return {selection:{bounds,...(polygon&&{polygon}),...(circle&&{circle})},sourceId,level,tileCount,boxes,partial,
    appearance:product.role==='terrain'||product.grayscaleOnly?'grayscale':appearance,
    maximumBytes:tileCount*product.tileBytes,metresPerPixel:sourceMeters(level,sourceId)};
}

export function sourceStorageRequired(plan){
  return plan.maximumBytes+plan.tileCount*384+64*1024**2;
}

export function* sourceMapTiles(plan){
  const {product,shape,boxes}=sourceSelection(plan.selection,plan.level,plan.appearance,plan.sourceId);
  function* visit(x,y,z){
    const tile=geographicBounds(x,y,z);
    if(!boxes.some(box=>overlaps(box,tile))||!selectionIntersectsBounds(shape,tile))return;
    if(z>=product.root)yield {x,y,z};
    if(z<plan.level)for(let j=0;j<2;j++)for(let i=0;i<2;i++)yield* visit(2*x+i,2*y+j,z+1);
  }
  yield* visit(0,0,0);yield* visit(1,0,0);
}

export function sourceMapPlan(selection,level,appearance,sourceId='viking'){
  const plan=sourceMapEstimate(selection,level,appearance,sourceId);
  return {...plan,tiles:[...sourceMapTiles(plan)]};
}

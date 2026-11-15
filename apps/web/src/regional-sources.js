export const REGIONAL_IMAGERY={
 'jezero-ctx':{product:'JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0',bounds:[77.1605,18.2110,77.6992,18.7212],min:9,max:13,metres:6,name:'Jezero CTX'},
 'jezero-hirise':{product:'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd',bounds:[77.2229,18.3068,77.5840,18.6693],min:11,max:17,metres:.25,name:'Jezero HiRISE'},
 'gale-hirise':{product:'curiosity_hirise_mosaic',bounds:[137.1225,-4.9255,137.7298,-4.2490],min:10,max:16,metres:.25,name:'Gale HiRISE'}
};
export const VIKING_PRODUCT='Mars_Viking_MDIM21_ClrMosaic_global_232m';
export const trekTile=(product,z,y,x,ext='png')=>`https://trek.nasa.gov/tiles/Mars/EQ/${product}/1.0.0/default/default028mm/${z}/${y}/${x}.${ext}`;
export const regionalTileUrl=kind=>`/api/planet?kind=${kind}&z={z}&y={y}&x={x}&v=trek-1`;

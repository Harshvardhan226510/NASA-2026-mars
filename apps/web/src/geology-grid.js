export const GEOLOGY_SERVICE='https://tiles.arcgis.com/tiles/nzS0F0zdNLvs7nc8/arcgis/rest/services/Mars_geology_All_layers_100pct/MapServer';
export const GEOLOGY_MAX_LEVEL=5;
// Service GCS Mars 2000 (104971): origin (-180,180), square 360° root.
// Atlas uses origin (-180,90), two 180° root tiles. Never use Web Mercator.
export function geologyTileParts(x,y,z){
 if(![x,y,z].every(Number.isInteger)||z<0||z>GEOLOGY_MAX_LEVEL||y<0||y>=2**z)throw Error('Invalid geologic map tile.');
 x=((x%2**(z+1))+2**(z+1))%2**(z+1);
 return z===0?[{x,y:0,z:1,source:[0,128,256,128],destination:[0,0,256,128]},{x,y:1,z:1,source:[0,0,256,128],destination:[0,128,256,128]}]:[{x,y:y+2**(z-1),z:z+1,source:[0,0,256,256],destination:[0,0,256,256]}];
}
export function geologySourceAddress(query){
 if(Object.keys(query).some(k=>!['x','y','z'].includes(k)))throw Error('Unknown map parameter.');
 const [x,y,z]=['x','y','z'].map(k=>/^\d{1,3}$/.test(String(query[k]))?Number(query[k]):NaN);
 if(![x,y,z].every(Number.isInteger)||z<1||z>6||x>=2**z||y>=2**z)throw Error('Invalid geology source address.');
 return {x,y,z,key:`${z}/${y}/${x}`,url:`${GEOLOGY_SERVICE}/tile/${z}/${y}/${x}`};
}
export function validateGeologyLegend(data){
 if(data?.schema!=='mars-usgs-geology-legend/1'||!Array.isArray(data.units)||data.units.length!==44||new Set(data.units.map(u=>u.code)).size!==44||data.units.some(u=>!/^\w{1,8}$/.test(u.code)||typeof u.name!=='string'||!u.name||!/^#[0-9a-f]{6}$/i.test(u.color)))throw Error('Geologic legend is incomplete.');return data;
}

import {R} from './raster.js';
import {wrapRouteLongitude} from './route-geometry.js';

// Choose an elevation pyramid level from the actual analysis spacing. Fetch
// exactly the tiles touched by grid nodes, including wrapped/polar windows.
export function routeTilePlan(spec){
 const level=Math.max(1,Math.min(7,Math.ceil(Math.log2(Math.PI*R/(512*Math.max(200,spec.resolution)))))),span=180/2**level,columns=2**(level+1),rows=2**level;
 const address=([lon,lat])=>({x:Math.min(columns-1,Math.floor((wrapRouteLongitude(lon)+180)/span)),y:Math.max(0,Math.min(rows-1,Math.floor((90-lat)/span))),z:level});
 const key=a=>`${a.z}/${a.y}/${a.x}`,tiles=new Map();
 for(let r=0;r<spec.size;r++)for(let c=0;c<spec.size;c++){const a=address(spec.point(r,c));tiles.set(key(a),a);}
 return {level,tiles:[...tiles.values()],key:point=>key(address(point))};
}

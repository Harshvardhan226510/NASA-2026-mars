import {contourSegments} from './terrain-metrics.js';
export function contourPaths(grid,width,bounds,interval,size=512){
 return contourSegments(grid,width,bounds,interval,12000).map(segment=>({height:segment.height,points:segment.points.map(([lon,lat])=>[(lon-bounds[0])/(bounds[2]-bounds[0])*(size-1),(bounds[3]-lat)/(bounds[3]-bounds[1])*(size-1)])}));
}
export const contourInterval=(selected,z)=>Math.max(selected,z===0?2000:z===1?1000:0);

import {sampleGrid} from './planet.js';
const metres=Math.PI*3396190/180;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Fine derivatives use one physical source grid for their entire stencil.
// Blend rendered metric colors to MOLA near source/tile boundaries; never
// differentiate a discontinuity between independently served DEM products.
export function terrainOverlayContext(tile,bounds){
 if(!tile||tile.fallback)return ()=>null;
 const b=tile.bounds,spacing=Math.max(200,(b[3]-b[1])*metres/(tile.width-1));
 const sample=(lon,lat)=>{const wrapped=lon+360*Math.round(((b[0]+b[2])/2-lon)/360);return sampleGrid(tile.grid,tile.width,b,wrapped,lat)??NaN;};
 return (lon,lat)=>{
  const wrapped=lon+360*Math.round(((b[0]+b[2])/2-lon)/360),cos=Math.max(.01,Math.cos(lat*Math.PI/180));
  const distance=Math.min((wrapped-b[0])*metres*cos,(b[2]-wrapped)*metres*cos,(lat-b[1])*metres,(b[3]-lat)*metres);
  // The longest horizon stencil reaches eight source spacings.
  const support=8.1*spacing,edge=Math.min((lon-bounds[0])/(bounds[2]-bounds[0]),(bounds[2]-lon)/(bounds[2]-bounds[0]),(lat-bounds[1])/(bounds[3]-bounds[1]),(bounds[3]-lat)/(bounds[3]-bounds[1]));
  const weight=smooth((distance-support)/(4*spacing))*smooth(edge*32);
  return weight>0?{sample,spacing,weight}:null;
 };
}

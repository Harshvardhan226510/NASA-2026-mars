import {geographicBounds} from './planet-grid.js';
const metresPerDegree=Math.PI/180*3396190;
export function imageryRootLevel(bounds,preferred=8){
 let level=preferred;
 const count=z=>{const span=180/2**z;return (Math.floor((bounds[2]+180-1e-10)/span)-Math.floor((bounds[0]+180)/span)+1)*(Math.floor((90-bounds[1]-1e-10)/span)-Math.floor((90-bounds[3])/span)+1);};
 while(level>0&&count(level)>4)level--;return level;
}
export function imageryWindow(dataset,visible,focus,perPixel,width,height){
 const d=dataset.bounds,dx=perPixel*width*.75/(metresPerDegree*Math.max(.1,Math.cos(focus[1]*Math.PI/180))),dy=perPixel*height*.75/metresPerDegree;
 let b=[Math.max(d[0],visible[0],focus[0]-dx),Math.max(d[1],visible[1],focus[1]-dy),Math.min(d[2],visible[2],focus[0]+dx),Math.min(d[3],visible[3],focus[1]+dy)];if(b[0]>=b[2]||b[1]>=b[3])return null;
 let level=Math.max(13,Math.min(17,Math.floor(Math.log2(180*metresPerDegree/(512*Math.max(.25,perPixel*1.2))))));
 const cells=z=>{const span=180/2**z;return [Math.floor((b[0]+180)/span),Math.floor((90-b[3])/span),Math.floor((b[2]+180-1e-10)/span),Math.floor((90-b[1]-1e-10)/span)];};
 let c=cells(level);while((c[2]-c[0]+1)*(c[3]-c[1]+1)>20&&level>13)c=cells(--level);
 if((c[2]-c[0]+1)*(c[3]-c[1]+1)>20){const span=180/2**level;b=[Math.max(b[0],focus[0]-span),Math.max(b[1],focus[1]-span),Math.min(b[2],focus[0]+span),Math.min(b[3],focus[1]+span)];c=cells(level);}
 const nw=geographicBounds(c[0],c[1],level),se=geographicBounds(c[2],c[3],level);return {level,bounds:[Math.max(d[0],nw[0]),Math.max(d[1],se[1]),Math.min(d[2],se[2]),Math.min(d[3],nw[3])],key:`${level}/${c.join('/')}`,count:(c[2]-c[0]+1)*(c[3]-c[1]+1)};
}

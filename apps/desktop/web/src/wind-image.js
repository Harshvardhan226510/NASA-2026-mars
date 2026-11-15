import {geographicBounds} from './planet-grid.js';
import {sampleWind} from './wind-data.js';
import {windColor} from './wind-flow-field.js';
const SIZE=256;
export function windImage(grid,x,y,z,{canvas=document.createElement('canvas'),ImageDataClass=ImageData}={}){
 canvas.width=canvas.height=SIZE;const columns=2**(z+1),rows=2**z;if(y<0||y>=rows)return canvas;x=((x%columns)+columns)%columns;
 const bounds=geographicBounds(x,y,z),context=canvas.getContext('2d'),pixels=new Uint8ClampedArray(SIZE*SIZE*4);
 for(let row=0;row<SIZE;row++)for(let col=0;col<SIZE;col++){
  // Shared boundary samples prevent a line between adjacent imagery tiles.
  const lon=bounds[0]+col/(SIZE-1)*(bounds[2]-bounds[0]),lat=bounds[3]-row/(SIZE-1)*(bounds[3]-bounds[1]),value=sampleWind(grid,lon,lat);
  pixels.set(windColor(value?.speed??NaN),(row*SIZE+col)*4);
 }
 context.putImageData(new ImageDataClass(pixels,SIZE,SIZE),0,0);
 return canvas;
}

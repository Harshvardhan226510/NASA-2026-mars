import {tintOpticalTile} from './viking-tint.js';

self.onmessage=({data:{id,pixels,width,height,tone,side}})=>{
 tintOpticalTile(pixels,width,height,tone,side);
 self.postMessage({id,pixels},[pixels.buffer]);
};

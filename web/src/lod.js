import {R} from './raster.js';
export const dimensions=b=>[(b[2]-b[0])*Math.PI/180*R*Math.cos((b[1]+b[3])*Math.PI/360),(b[3]-b[1])*Math.PI/180*R];
export function tileBounds(dataset,lod,row,col){
 if(![lod,row,col].every(Number.isInteger)||lod<0||lod>16||row<0||col<0)throw new Error('Invalid map tile.');
 const b=dataset.bounds,[w,h]=dimensions(b),span=Math.max(...dataset.dem_grid_m)*128*2**lod;
 const dx=(b[2]-b[0])*span/w,dy=(b[3]-b[1])*span/h;
 if(col*span>=w||row*span>=h)throw new Error('Map tile lies outside the prepared footprint.');
 return [b[0]+col*dx,Math.max(b[1],b[3]-(row+1)*dy),Math.min(b[2],b[0]+(col+1)*dx),b[3]-row*dy];
}
export function planTiles(dataset,visible,metresPerPixel,focus,limit=20){
 const b=dataset.bounds,[w,h]=dimensions(b),base=Math.max(...dataset.dem_grid_m)*128;
 let lod=Math.max(0,Math.floor(Math.log2(Math.max(base,metresPerPixel*512*1.25)/base)));
 const clipped=[Math.max(b[0],visible[0]),Math.max(b[1],visible[1]),Math.min(b[2],visible[2]),Math.min(b[3],visible[3])];
 if(clipped[0]>=clipped[2]||clipped[1]>=clipped[3])return [];
 let x0,x1,y0,y1;
 for(;lod<=16;lod++){
  const span=base*2**lod;
  x0=Math.max(0,Math.floor((clipped[0]-b[0])/(b[2]-b[0])*w/span));x1=Math.min(Math.ceil(w/span)-1,Math.floor((clipped[2]-b[0])/(b[2]-b[0])*w/span));
  y0=Math.max(0,Math.floor((b[3]-clipped[3])/(b[3]-b[1])*h/span));y1=Math.min(Math.ceil(h/span)-1,Math.floor((b[3]-clipped[1])/(b[3]-b[1])*h/span));
  if((x1-x0+1)*(y1-y0+1)<=limit)break;
 }
 const result=[];
 for(let row=y0;row<=y1;row++)for(let col=x0;col<=x1;col++)result.push({id:`${lod}:${row}:${col}`,lod,row,col,bounds:tileBounds(dataset,lod,row,col)});
 return result.sort((a,c)=>{
  const distance=t=>((t.bounds[0]+t.bounds[2])/2-focus[0])**2*Math.cos(focus[1]*Math.PI/180)**2+((t.bounds[1]+t.bounds[3])/2-focus[1])**2;
  return distance(a)-distance(c);
 });
}
export function tileVersion(d){return (d.terrain?.[0]?.sha256??d.terrain?.[0]?.md5??'preview').slice(0,16)+(d.imagery?.[0]?.sha256??d.imagery?.[0]?.md5??'').slice(0,16);}
export function packTile(heights,imagery){
 const bytes=new Uint8Array(32+129*129*4+512*512*2),header=new DataView(bytes.buffer);
 header.setUint32(0,0x4d415253,true);header.setUint32(4,1,true);header.setFloat32(8,heights.gridMeters??0,true);header.setFloat32(12,imagery.gridMeters??0,true);
 new Float32Array(bytes.buffer,32,129*129).set(heights);
 const pixels=bytes.subarray(32+129*129*4);for(let i=0;i<pixels.length;i++)pixels[i]=Math.max(0,Math.min(255,Math.round(imagery[i])));
 return bytes;
}
export function unpackTile(buffer){
 if(buffer.byteLength!==32+129*129*4+512*512*2)throw new Error('Incomplete map tile.');
 const h=new DataView(buffer);if(h.getUint32(0,true)!==0x4d415253||h.getUint32(4,true)!==1)throw new Error('Unknown map tile format.');
 return {heights:new Float32Array(buffer,32,129*129),pixels:new Uint8Array(buffer,32+129*129*4),terrainGrid:h.getFloat32(8,true),imageryGrid:h.getFloat32(12,true)};
}

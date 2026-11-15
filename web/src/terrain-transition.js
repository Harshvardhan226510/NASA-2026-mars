// Display-only transition to context terrain. Publisher elevations stay intact.
export function terrainConfidence(grid,width,padding=4){
 const distances=new Float32Array(grid.length),diagonal=Math.SQRT2;
 for(let i=0;i<grid.length;i++)distances[i]=Number.isFinite(grid[i])?padding+1:0;
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  const i=y*width+x;let d=distances[i];
  if(x)d=Math.min(d,distances[i-1]+1);if(y)d=Math.min(d,distances[i-width]+1);
  if(x&&y)d=Math.min(d,distances[i-width-1]+diagonal);if(y&&x<width-1)d=Math.min(d,distances[i-width+1]+diagonal);distances[i]=d;
 }
 for(let y=width-1;y>=0;y--)for(let x=width-1;x>=0;x--){
  const i=y*width+x;let d=distances[i];
  if(x<width-1)d=Math.min(d,distances[i+1]+1);if(y<width-1)d=Math.min(d,distances[i+width]+1);
  if(x<width-1&&y<width-1)d=Math.min(d,distances[i+width+1]+diagonal);if(x&&y<width-1)d=Math.min(d,distances[i+width-1]+diagonal);distances[i]=d;
 }
 const size=width-padding*2,heights=new Float32Array(size*size),confidence=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y+padding)*width+x+padding,p=y*size+x,t=Math.max(0,Math.min(1,(distances[i]-1)/padding));
  heights[p]=grid[i];confidence[p]=t*t*(3-2*t);
 }return {heights,confidence};
}
export function unpackElevation(buffer){
 const count=129*129,header=new DataView(buffer);
 if(buffer.byteLength!==16+count*8||header.getUint32(0,true)!==0x4d44454d||header.getUint32(8,true)!==2)throw new Error('Incomplete detailed terrain.');
 return {grid:new Float32Array(buffer,16,count),confidence:new Float32Array(buffer,16+count*4,count),width:129,gridMeters:header.getFloat32(4,true)};
}
export function cameraClearance(height,terrain,clearance=6){return Number.isFinite(terrain)&&height+.001<terrain+clearance?terrain+clearance:height;}

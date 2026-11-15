const RADIANS_METRES=Math.PI*3396190/180;
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
// Display-only transition between independently served DEM patches. Every
// source tile meets the same continuous measured MOLA reference at its border,
// including a patch retained from a coarser level after a source failure.
// Use source bounds, not geometry bounds: subdividing a patch must not create
// a new seam or a new strip of softened terrain on every rendered child tile.
export function stitchTerrainEdges(grid,width,bounds,sourceBounds,reference){
 const [west,south,east,north]=sourceBounds,spanX=east-west,spanY=north-south;
 const latitude=(south+north)/2*Math.PI/180;
 const supportX=Math.min(.15,Math.max(3/128,3000/(spanX*RADIANS_METRES*Math.max(.02,Math.cos(latitude)))));
 const supportY=Math.min(.15,Math.max(3/128,3000/(spanY*RADIANS_METRES)));
 const out=new Float32Array(grid);
 for(let row=0;row<width;row++)for(let col=0;col<width;col++){
  const lon=bounds[0]+col/(width-1)*(bounds[2]-bounds[0]),lat=bounds[3]-row/(width-1)*(bounds[3]-bounds[1]);
  const u=(lon-west)/spanX,v=(lat-south)/spanY,weight=smooth(Math.min(u/supportX,(1-u)/supportX,v/supportY,(1-v)/supportY));
  if(weight>=1)continue;const h=reference(lon,lat),i=row*width+col;
  if(Number.isFinite(h))out[i]=h+(grid[i]-h)*weight;
 }
 return out;
}

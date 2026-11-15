import {fromCustomClient,Pool} from 'geotiff';
import proj4 from 'proj4';
import {RangeClient} from './range-client.js';
import {RasterFileCache} from './recovery.js';
import {hasRecoverableNull} from './ortho-mask.js';
let decoder;
const files=new RasterFileCache(key=>fromCustomClient(new RangeClient(rasterUrl(key)),{allowFullFile:false,blockSize:131072,cacheSize:16,maxRanges:1}));
const decoderPool=()=>decoder??=new Pool(2);
export const R=3396190;
export const intersects=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
export const rasterUrl=key=>'/api/raster?asset='+encodeURIComponent(key);
function projection(crs){const m=/\+(?:R|a)=([^ ]+)/.exec(crs);return proj4(`+proj=longlat +R=${m?.[1]??R} +no_defs`,crs);}
export function closeRasters(){files.clear();}
export function pixelStencil(px,py,width,height){
 if(px<-.5||py<-.5||px>width-.5||py>height-.5)return null;
 const x=Math.max(0,Math.min(width-1,px)),y=Math.max(0,Math.min(height-1,py)),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1);
 return {indices:[y0*width+x0,y0*width+x1,y1*width+x0,y1*width+x1],u:x-x0,v:y-y0};
}
export async function selectOverview(tiff,base,pixelSize,desired){
 let image=base,scale=1;
 for(let i=1;i<=16&&pixelSize*scale*2<=desired;i++){
  let candidate;try{candidate=await tiff.getImage(i);}catch(error){if(/^No image at index \d+$/.test(error.message))break;throw error;}
  const ratio=base.getWidth()/candidate.getWidth();
  if((candidate.getFileDirectory().getValue('NewSubfileType')??0)&4)continue;
  if(candidate.getSamplesPerPixel()!==base.getSamplesPerPixel())continue;
  if(pixelSize*ratio>desired)break;image=candidate;scale=ratio;
 }
 return {image,scale};
}
export class SurfaceRaster {
 constructor(dataset,{fileCache=files,pool=decoderPool}={}){this.dataset=dataset;this.files=fileCache;this.pool=pool;this.active=0;this.queue=[];this.preview=null;}
 async limited(task){if(this.active>=4)await new Promise(resolve=>this.queue.push(resolve));this.active++;try{return await task();}finally{this.active--;this.queue.shift()?.();}}
 async read(bounds,width,height,{kind='imagery',nodes=false}={}){
  const output=new Float32Array(width*height*(kind==='imagery'?2:1));if(kind==='terrain')output.fill(NaN);
  let entries=this.dataset[kind]??[];
  const geo=projection(kind==='terrain'?this.dataset.terrain_crs:this.dataset.imagery_crs);
  const topLeft=geo.forward([bounds[0],bounds[3]]),bottomRight=geo.forward([bounds[2],bounds[1]]);
  const stepX=(bottomRight[0]-topLeft[0])/(nodes?width-1:width),stepY=(bottomRight[1]-topLeft[1])/(nodes?height-1:height);
  const desired=Math.min(Math.abs(stepX),Math.abs(stepY));
  output.gridMeters=Math.max(Math.abs(stepX),Math.abs(stepY));
  // Whole-swath overviews can be mildly oversampled before native detail is
  // needed; this avoids opening every native shard for a distant portrait view.
  const overview=entries.find(a=>a.isOverview&&Math.max(Math.abs(a.transform[0]),Math.abs(a.transform[4]))<=desired*2)??(this.dataset.desktopStorage==='verified-local-package'&&entries.every(a=>a.isOverview)?entries.slice().sort((a,b)=>Math.max(Math.abs(a.transform[0]),Math.abs(a.transform[4]))-Math.max(Math.abs(b.transform[0]),Math.abs(b.transform[4])))[0]:undefined);
  entries=overview?[overview]:entries.filter(a=>!a.isOverview);
  const relevant=entries.filter(a=>intersects(a.bounds,bounds));
  await Promise.all(relevant.map(asset=>this.limited(async()=>{
   const key=`${this.dataset.id}/${kind}/${asset.key}`;
   await this.files.read(key,async tiff=>{
   const base=await tiff.getImage(0);
   const origin=base.getOrigin(),resolution=base.getResolution();
   const transform=asset.transform??[resolution[0],0,origin[0],0,resolution[1],origin[1]];
   const crs=kind==='terrain'?this.dataset.terrain_crs:this.dataset.imagery_crs;
   const radius=Number(/\+(?:R|a)=([^ ]+)/.exec(crs)?.[1]??R),parallel=Number(/\+lat_ts=([^ ]+)/.exec(crs)?.[1]??0);
   const period=2*Math.PI*radius*Math.cos(parallel*Math.PI/180);
   const assetCentre=transform[2]+transform[0]*base.getWidth()/2,geoCentre=geo.forward([(asset.bounds[0]+asset.bounds[2])/2,(asset.bounds[1]+asset.bounds[3])/2])[0];
   const wrap=Math.round((assetCentre-geoCentre)/period)*period;
   const {image,scale}=await selectOverview(tiff,base,Math.max(Math.abs(transform[0]),Math.abs(transform[4])),desired*(kind==='imagery'?1.2:1));
   output.gridMeters=Math.max(output.gridMeters,Math.abs(transform[0])*scale,Math.abs(transform[4])*scale);
   const [a,,originX,,,originY]=transform;const nativeY=transform[4];
   const dx=a*scale,dy=nativeY*(base.getHeight()/image.getHeight());
   const ax=(topLeft[0]+wrap-originX)/dx,ay=(topLeft[1]-originY)/dy,bx=(bottomRight[0]+wrap-originX)/dx,by=(bottomRight[1]-originY)/dy;
   const left=Math.max(0,Math.floor(Math.min(ax,bx)-1)),top=Math.max(0,Math.floor(Math.min(ay,by)-1));
   const right=Math.min(image.getWidth(),Math.ceil(Math.max(ax,bx)+1)),bottom=Math.min(image.getHeight(),Math.ceil(Math.max(ay,by)+1));
   if(left>=right||top>=bottom)return;
   if((right-left)*(bottom-top)>1_500_000)throw new Error('A map request exceeded its raster budget. Zoom in or retry.');
   const bands=await image.readRasters({window:[left,top,right,bottom],samples:kind==='imagery'?[0,1]:[0],pool:this.pool()});
   const stride=right-left,nodata=asset.nodata,sourceNull=kind==='imagery'&&hasRecoverableNull(this.dataset);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const px=(topLeft[0]+wrap+stepX*(x+(nodes?0:.5))-originX)/dx-.5-left;
    const py=(topLeft[1]+stepY*(y+(nodes?0:.5))-originY)/dy-.5-top;
    const stencil=pixelStencil(px,py,stride,bottom-top);if(!stencil)continue;
    const {indices,u,v}=stencil;
    const values=indices.map(i=>bands[0][i]);if(values.some(n=>!Number.isFinite(n)||(nodata!==null&&nodata!==undefined&&n===nodata)||(sourceNull&&n===0)))continue;
    const value=values[0]*(1-u)*(1-v)+values[1]*u*(1-v)+values[2]*(1-u)*v+values[3]*u*v;
    const p=y*width+x;
    if(kind==='terrain')output[p]=value;else{output[p*2]=value;output[p*2+1]=Math.min(...indices.map(i=>bands[1][i]));}
   }
   });
  })));
  if(kind==='imagery'&&this.dataset.previewTexture&&!relevant.length)return this.previewRead(bounds,width,height);
  return output;
 }
 async previewRead(bounds,width,height){
  if(!this.preview)this.preview=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Drive overview imagery is unavailable.'));image.src=rasterUrl(`${this.dataset.id}/texture`);});
  const pending=this.preview;let image;
  try{image=await pending;}catch(error){if(this.preview===pending)this.preview=null;throw error;}
  const [west,south,east,north]=this.dataset.bounds;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
  const sx=(bounds[0]-west)/(east-west)*image.width,sy=(north-bounds[3])/(north-south)*image.height,sw=(bounds[2]-bounds[0])/(east-west)*image.width,sh=(bounds[3]-bounds[1])/(north-south)*image.height;
  ctx.drawImage(image,sx,sy,sw,sh,0,0,width,height);const rgba=ctx.getImageData(0,0,width,height).data,out=new Float32Array(width*height*2);
  const geo=projection(this.dataset.imagery_crs),tl=geo.forward([bounds[0],bounds[3]]),br=geo.forward([bounds[2],bounds[1]]);
  out.gridMeters=Math.max(...this.dataset.imagery_grid_m,Math.abs(br[0]-tl[0])/width,Math.abs(br[1]-tl[1])/height);for(let i=0;i<width*height;i++){out[i*2]=rgba[i*4];out[i*2+1]=rgba[i*4+3];}return out;
 }
 async texture(bounds,size=256){
  const data=await this.read(bounds,size,size),canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(size,size);
  canvas.gridMeters=data.gridMeters;for(let i=0;i<size*size;i++){const value=data[i*2];pixels.data[i*4]=pixels.data[i*4+1]=pixels.data[i*4+2]=value;pixels.data[i*4+3]=data[i*2+1];}ctx.putImageData(pixels,0,0);return canvas;
 }
}

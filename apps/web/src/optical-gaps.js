import {TileQueue} from './tile-queue.js';
const queue=new TileQueue(3,32);
let globalTone;
const gray=(p,i)=>p[i]*.2125+p[i+1]*.7154+p[i+2]*.0721;
const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));

// Blend measured optical context only through the publisher's alpha mask.
// A low-frequency brightness correction meets the CTX boundary; source texture,
// geometry and every fully opaque CTX pixel remain untouched. This is display
// balancing, not recovered CTX detail or a change to the archived measurements.
export function opticalToneField(primary,base,width,height){
 const step=4,w=Math.ceil(width/step),h=Math.ceil(height/step),n=w*h;
 const known=new Uint8Array(n),delta=new Float32Array(n),counts=new Uint16Array(n);let sum=0,total=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,j=Math.floor(y/step)*w+Math.floor(x/step);
  if(primary[i+3]>=250&&base[i+3]>=250){delta[j]+=Math.max(-64,Math.min(64,gray(primary,i)-gray(base,i)));counts[j]++;}
 }
 for(let i=0;i<n;i++)if(counts[i]){known[i]=1;delta[i]/=counts[i];sum+=delta[i];total++;}
 const mean=total?sum/total:0;for(let i=0;i<n;i++)if(!known[i])delta[i]=mean;
 let current=delta,next=new Float32Array(n);
 for(let pass=0;pass<64;pass++){
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;
   next[i]=known[i]?delta[i]:(current[y*w+Math.max(0,x-1)]+current[y*w+Math.min(w-1,x+1)]+current[Math.max(0,y-1)*w+x]+current[Math.min(h-1,y+1)*w+x])/4;
  }
  [current,next]=[next,current];
 }
 return {values:current,width:w,height:h,hasSupport:total>0};
}
export function blendOpticalGap(primary,base,width,height,field,window=[0,0,1,1]){
 let gap=false;for(let i=3;i<primary.length;i+=4)if(primary[i]<255){gap=true;break;}
 if(!gap)return null;
 field??=opticalToneField(primary,base,width,height);
 const {values:current,width:w,height:h}=field,[wx,wy,ww,wh]=window;
 const out=primary.slice(),mask=new Uint8Array(Math.ceil(width*height/8));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const pixel=y*width+x,i=pixel*4,alpha=primary[i+3]/255;
  if(primary[i+3]>=128)mask[pixel>>3]|=1<<(pixel&7);
  if(alpha===1||base[i+3]===0)continue;
  const sx=(wx+(x+.5)/width*ww)*w-.5,gx=field.wrapLongitude?sx:Math.max(0,Math.min(w-1,sx)),gy=Math.max(0,Math.min(h-1,(wy+(y+.5)/height*wh)*h-.5)),x0=Math.floor(gx),y0=Math.floor(gy),u=gx-x0,v=gy-y0;
  const at=(xx,yy)=>current[Math.min(h-1,yy)*w+(field.wrapLongitude?((xx%w)+w)%w:Math.min(w-1,xx))];
  let correction=(at(x0,y0)*(1-u)+at(x0+1,y0)*u)*(1-v)+(at(x0,y0+1)*(1-u)+at(x0+1,y0+1)*u)*v;
  // Match the local CTX boundary inside a tile, while retaining the same
  // global tone at tile edges. This cannot create independent tile seams.
  if(field.local?.hasSupport){const local=field.local,lx=(x+.5)/width*local.width-.5,ly=(y+.5)/height*local.height-.5,ix=Math.floor(lx),iy=Math.floor(ly),fx=lx-ix,fy=ly-iy;
   const get=(xx,yy)=>local.values[Math.max(0,Math.min(local.height-1,yy))*local.width+Math.max(0,Math.min(local.width-1,xx))];
   const tone=(get(ix,iy)*(1-fx)+get(ix+1,iy)*fx)*(1-fy)+(get(ix,iy+1)*(1-fx)+get(ix+1,iy+1)*fx)*fy;
   let weight=Math.min(x/Math.max(1,width-1),(width-1-x)/Math.max(1,width-1),y/Math.max(1,height-1),(height-1-y)/Math.max(1,height-1))*8;weight=Math.max(0,Math.min(1,weight));weight=weight*weight*(3-2*weight);correction+=weight*(tone-correction);
  }
  const b=clamp(gray(base,i)+correction),ba=(1-alpha)*base[i+3]/255,a=alpha+ba;
  for(let c=0;c<3;c++)out[i+c]=clamp((primary[i+c]*alpha+b*ba)/a);
  out[i+3]=Math.round(a*255);
 }
 return {pixels:out,sourceOpacityMask:mask};
}

async function opticalParent(coords,url,maximum=7){
 const z=Math.min(maximum,coords.z),factor=2**(coords.z-z),x=Math.floor(coords.x/factor),y=Math.floor(coords.y/factor);
 const address=url.replace('{z}',z).replace('{x}',x).replace('{y}',y);
 const image=await queue.get(address,async signal=>{
  const response=await fetch(address,{signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])});if(!response.ok)throw new Error('Optical context unavailable');
  const bitmap=await createImageBitmap(await response.blob()),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();return canvas;
 });
 return {image,window:[(coords.x-x*factor)/factor,(coords.y-y*factor)/factor,1/factor,1/factor]};
}
export function globalToneWindow(coords){const cols=2**(coords.z+1),rows=2**coords.z;return [coords.x/cols,coords.y/rows,1/cols,1/rows];}
async function sharedToneField(coords){
 // The same measured geographic reference is used at every zoom. Independent
 // regional reference tiles can change tone in rectangles as their LOD changes.
 if(!globalTone){const task=fetch('/globe-optical-tone.json').then(r=>{if(!r.ok)throw new Error('Global optical reference unavailable');return r.json();}).then(data=>{
  if(data.schema!=='mars-optical-tone/1'||data.width!==128||data.height!==64||data.values.length!==8192||data.values.some(v=>!Number.isFinite(v)||Math.abs(v)>64.01))throw new Error('Invalid optical reference');
  return {...data,values:new Float32Array(data.values)};
 });globalTone=task;task.catch(()=>{if(globalTone===task)globalTone=null;});}
 return {field:await globalTone,window:globalToneWindow(coords)};
}
export async function composeOpticalGaps(canvas,coords,options){
 const context=canvas.getContext('2d',{willReadFrequently:true}),primary=context.getImageData(0,0,canvas.width,canvas.height);
 let gap=false;for(let i=3;i<primary.data.length;i+=4)if(primary.data[i]<255){gap=true;break;}if(!gap)return canvas;
 try{
  const [{image,window:[x,y,w,h]},tone]=await Promise.all([opticalParent(coords,options.base),sharedToneField(coords,options)]),base=document.createElement('canvas');base.width=canvas.width;base.height=canvas.height;
  const b=base.getContext('2d',{willReadFrequently:true});b.drawImage(image,x*image.width,y*image.height,w*image.width,h*image.height,0,0,base.width,base.height);
  const basePixels=b.getImageData(0,0,base.width,base.height).data,field={...tone.field,local:opticalToneField(primary.data,basePixels,canvas.width,canvas.height)};
  const result=blendOpticalGap(primary.data,basePixels,canvas.width,canvas.height,field,tone.window);
  if(result){primary.data.set(result.pixels);context.putImageData(primary,0,0);canvas.sourceOpacityMask=result.sourceOpacityMask;}
 }catch(error){console.warn('optical_gap_context_deferred',error.message);}
 return canvas;
}

export function cropSourceMask(image,window,width,height){
 if(!image.sourceOpacityMask)return undefined;
 const mask=new Uint8Array(Math.ceil(width*height/8)),[x,y,w,h]=window;
 for(let row=0;row<height;row++)for(let col=0;col<width;col++){
  const sx=Math.min(image.width-1,Math.floor((x+(col+.5)/width*w)*image.width)),sy=Math.min(image.height-1,Math.floor((y+(row+.5)/height*h)*image.height)),i=sy*image.width+sx,j=row*width+col;
  if(image.sourceOpacityMask[i>>3]&(1<<(i&7)))mask[j>>3]|=1<<(j&7);
 }
 return mask;
}

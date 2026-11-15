export const MAGNETIC_MODEL={name:'Langlais et al. (2019)',degree:134,radius:3393500,sourceHash:'3cad9e268f0673be1702f1df504a4cbcb8dba4480c7b3f629921911488fe247b',dataset:'https://doi.org/10.5281/zenodo.3876714',paper:'https://doi.org/10.1029/2018JE005854'};
export const MAGNETIC_COLORS=[[0,[18,26,68]],[.2,[57,48,131]],[.4,[128,52,141]],[.6,[203,71,119]],[.8,[244,139,61]],[1,[252,247,153]]];
export const magneticScale=altitude=>altitude===0?20000:2000;
export const magneticFraction=(value,maximum)=>Math.log1p(Math.max(0,Math.min(maximum,value))/10)/Math.log1p(maximum/10);

export function decodeMagneticGrid(buffer,altitude){
 const h=new DataView(buffer);if(buffer.byteLength<32||new TextDecoder().decode(new Uint8Array(buffer,0,8))!=='MARSB001')throw new Error('The magnetic model packet is incomplete.');
 const width=h.getUint32(8,true),height=h.getUint32(12,true),radius=h.getFloat32(16,true),level=h.getFloat32(20,true),step=h.getFloat32(24,true),degree=h.getUint32(28,true);
 if(width!==720||height!==361||radius!==MAGNETIC_MODEL.radius||level!==altitude||step!==.5||degree!==134||buffer.byteLength!==32+width*height*4)throw new Error('The magnetic model geometry or altitude does not match.');
 const values=new Float32Array(width*height);for(let i=0;i<values.length;i++){values[i]=h.getFloat32(32+i*4,true);if(!Number.isFinite(values[i])||values[i]<0)throw new Error('The magnetic model contains invalid values.');}
 for(const row of [0,height-1])for(let x=1;x<width;x++)if(Math.abs(values[row*width+x]-values[row*width])>.001)throw new Error('The magnetic model pole is inconsistent.');
 return {values,width,height,step,radius,altitude:level,degree};
}
export function sampleMagnetic(grid,lon,lat){
 if(!grid||!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>90)return NaN;
 const x=(((lon+180)%360+360)%360)/grid.step,y=Math.max(0,Math.min(grid.height-1,(90-lat)/grid.step)),x0=Math.floor(x)%grid.width,x1=(x0+1)%grid.width,y0=Math.min(grid.height-2,Math.floor(y)),u=x-Math.floor(x),v=y-y0;
 const a=grid.values[y0*grid.width+x0],b=grid.values[y0*grid.width+x1],c=grid.values[(y0+1)*grid.width+x0],d=grid.values[(y0+1)*grid.width+x1];return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;
}
export function magneticColor(value,maximum=2000){
 if(!Number.isFinite(value)||value<0)return [0,0,0,0];const t=magneticFraction(value,maximum),i=Math.max(1,MAGNETIC_COLORS.findIndex(s=>s[0]>=t)),a=MAGNETIC_COLORS[i-1],b=MAGNETIC_COLORS[i],u=(t-a[0])/(b[0]-a[0]);return [...a[1].map((v,c)=>Math.round(v+(b[1][c]-v)*u)),255];
}
export function magneticPixels(grid,bounds,size){
 const out=new Uint8ClampedArray(size*size*4),maximum=magneticScale(grid.altitude);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const lon=bounds[0]+(x+.5)/size*(bounds[2]-bounds[0]),lat=bounds[3]-(y+.5)/size*(bounds[3]-bounds[1]);out.set(magneticColor(sampleMagnetic(grid,lon,lat),maximum),(y*size+x)*4);}return out;
}
export class MagneticModelData{
 constructor({fetchImpl=(...args)=>fetch(...args)}={}){this.fetch=fetchImpl;this.cache=new Map();}
 async manifest(){
  if(!this.metadata)this.metadata=this.fetch('/magnetic/model.json',{signal:AbortSignal.timeout(25000)}).then(async r=>{if(!r.ok)throw new Error('The magnetic model metadata is unavailable.');const m=await r.json();if(m.schema!=='mars-crustal-magnetism/1'||m.sources?.coefficients_sha256!==MAGNETIC_MODEL.sourceHash||m.reference_radius_m!==MAGNETIC_MODEL.radius||m.degree!==134)throw new Error('The published magnetic model identity does not match.');return m;}).catch(e=>{this.metadata=null;throw e;});return this.metadata;
 }
 load(altitude=150000){
  if(![0,150000].includes(altitude))return Promise.reject(new Error('Choose a published model altitude.'));
  if(!this.cache.has(altitude)){const task=this.manifest().then(async m=>{const item=m.layers.find(l=>l.altitude_m===altitude);if(!item||item.file!==`crustal-field-${altitude/1000}km.f32.gz`||!/^[a-f0-9]{64}$/.test(item.packet_sha256))throw new Error('The magnetic model asset is not registered.');const r=await this.fetch('/magnetic/'+item.file,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error('The magnetic model data could not load.');let buffer=await r.arrayBuffer();const bytes=new Uint8Array(buffer);if(bytes[0]===0x1f&&bytes[1]===0x8b)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(v=>v.toString(16).padStart(2,'0')).join('');if(digest!==item.packet_sha256)throw new Error('The magnetic model integrity check failed. Retry the verified data.');return decodeMagneticGrid(buffer,altitude);}).catch(e=>{this.cache.delete(altitude);throw e;});this.cache.set(altitude,task);}return this.cache.get(altitude);
 }
}

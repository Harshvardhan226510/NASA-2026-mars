import {marsSun,solarAt} from './solar-geometry.js';
import {SKY_FACES,cubeDirection,skyColor,skyPhase,skyStars} from './ground-sky-colors.js';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const gradientSize=128,dayTextureSize=512,starTextureSize=1024;

function paintStars(ctx,face,stars,normal,visibility){
 const halfSize=ctx.canvas.width/2;
 const axis=face.endsWith('X')?0:face.endsWith('Y')?1:2;
 const sign=face.startsWith('positive')?1:-1;
 for(const {direction,brightness} of stars){
  const [x,y,z]=direction,m=Math.max(Math.abs(x),Math.abs(y),Math.abs(z));
  if(direction[axis]*sign!==m||dot(direction,normal)<0)continue;
  const u=axis===0?-z*sign:axis===1?x:x*sign;
  const v=axis===1?z*sign:-y;
  const column=Math.floor(halfSize*(1+u/m)),row=Math.floor(halfSize*(1-v/m));
  // Keep each star on one texel so canvas antialiasing does not spread it before projection.
  ctx.fillStyle=`rgba(232,239,255,${visibility*brightness**2*.9})`;
  ctx.fillRect(column,row,1,1);
 }
}
export class GroundSky{
 constructor(viewer,host){
  this.viewer=viewer;this.host=host;this.enabled=true;this.stars=skyStars(1100);try{this.enabled=localStorage.getItem('mars-atlas-ground-sky-v1')!=='false';}catch{}
  const label=document.createElement('label');label.className='ground-sky-control';this.input=document.createElement('input');this.input.id='ground-simulate-sky';this.input.type='checkbox';this.input.checked=this.enabled;label.append(this.input,document.createTextNode(' Simulate sky'));
  const note=document.createElement('small');note.id='ground-sky-note';note.textContent='Illustrative Mars sky · Sunlight time · not live weather or a navigation star chart.';label.title=note.textContent;
  document.getElementById('ground-help').append(label,note);this.input.onchange=()=>{this.enabled=this.input.checked;try{localStorage.setItem('mars-atlas-ground-sky-v1',String(this.enabled));}catch{}this.signature=null;this.sync();};
  viewer.scene.preRender.addEventListener(()=>this.sync());document.addEventListener('mars-solar-change',()=>viewer.scene.requestRender());
 }
 sync(){
  const scene=this.viewer.scene,on=this.enabled&&this.host.active();
  if(!on){if(this.owned){if(scene.skyBox===this.box)scene.skyBox=this.previous;this.owned=false;scene.requestRender();}return;}
  const C=window.Cesium,p=this.viewer.camera.positionCartographic,lon=C.Math.toDegrees(p.longitude),lat=C.Math.toDegrees(p.latitude),at=this.host.time()??new Date().toISOString();
  const signature=[Math.round(lon*2),Math.round(lat*2),Math.floor(Date.parse(at)/60000)].join(':');
  if(signature!==this.signature){this.signature=signature;this.paint(lon,lat,at);}
  if(!this.owned){this.previous=scene.skyBox;scene.skyBox=this.box;this.owned=true;scene.requestRender();}
 }
 paint(lon,lat,at){
  const C=window.Cesium,sun=marsSun(at),local=solarAt(sun,lon,lat),ellipsoid=this.viewer.scene.globe.ellipsoid;
  const up=ellipsoid.geodeticSurfaceNormal(this.viewer.camera.positionWC),r=Math.PI/180,solar=[Math.cos(sun.declination*r)*Math.cos(sun.subsolar_lon*r),Math.cos(sun.declination*r)*Math.sin(sun.subsolar_lon*r),Math.sin(sun.declination*r)];
  // SkyBox is defined in TEME axes. Convert the local horizon into those axes.
  const inverse=C.Matrix3.transpose(C.Transforms.computeTemeToPseudoFixedMatrix(this.viewer.clock.currentTime),new C.Matrix3());
  const u=C.Matrix3.multiplyByVector(inverse,up,new C.Cartesian3()),s=C.Matrix3.multiplyByVector(inverse,C.Cartesian3.fromArray(solar),new C.Cartesian3()),normal=[u.x,u.y,u.z],direction=[s.x,s.y,s.z],phase=skyPhase(local.elevation),sources={};
  // Cesium uploads cube faces with flipY=true: canvas top corresponds to cube v=+1.
  const textureSize=phase.stars>0?starTextureSize:dayTextureSize;
  for(const face of SKY_FACES){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=gradientSize;const ctx=canvas.getContext('2d'),image=ctx.createImageData(gradientSize,gradientSize);
   for(let y=0;y<gradientSize;y++)for(let x=0;x<gradientSize;x++){const d=cubeDirection(face,2*(x+.5)/gradientSize-1,1-2*(y+.5)/gradientSize),color=skyColor(dot(d,normal),dot(d,direction),local.elevation),i=(y*gradientSize+x)*4;image.data[i]=color[0];image.data[i+1]=color[1];image.data[i+2]=color[2];image.data[i+3]=255;}
   ctx.putImageData(image,0,0);
   const source=document.createElement('canvas');source.width=source.height=textureSize;
   const sourceContext=source.getContext('2d');
   sourceContext.drawImage(canvas,0,0,textureSize,textureSize);
   if(phase.stars>0)paintStars(sourceContext,face,this.stars,normal,phase.stars);
   sources[face]=source;
  }
  if(!this.box)this.box=new C.SkyBox({sources});else this.box.sources=sources;
  this.input.dataset.phase=phase.stars>.5?'night':phase.day>.8?'day':'twilight';this.viewer.scene.requestRender();
 }
}

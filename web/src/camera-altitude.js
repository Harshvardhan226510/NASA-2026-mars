import {knownTerrainHeight} from './planet.js';
const R=3396190,rad=Math.PI/180;
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),add=(a,b,k=1)=>a.map((v,i)=>v+k*b[i]);
export function closestTriangle(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 if(d1<=0&&d2<=0)return a;
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return b;
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return add(a,ab,d1/(d1-d3));
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return c;
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return add(a,ac,d2/(d2-d6));
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0)return add(b,sub(c,b),(d4-d3)/(d4-d3+d5-d6));
 const den=va+vb+vc;if(Math.abs(den)<1e-12)return a;
 return add(add(a,ab,vb/den),ac,vc/den);
}
const xyz=(lon,lat,height)=>[(R+height)*Math.cos(lat)*Math.cos(lon),(R+height)*Math.cos(lat)*Math.sin(lon),(R+height)*Math.sin(lat)];
// Search a spherical cap, then refine the closest measured terrain triangles.
// This estimates shortest 3D clearance, including hills beside the nadir point.
// It is deliberately labelled approximate: a DEM is not an exact physical surface.
export function terrainClearance(camera,sample,{iterations=6}={}){
 const radius=Math.hypot(...camera),lon=Math.atan2(camera[1],camera[0]),lat=Math.atan2(camera[2],Math.hypot(camera[0],camera[1]));
 const initial=sample(lon/rad,lat/rad);if(!initial)return null;
 let best={point:xyz(lon,lat,initial.height),...initial};best.distance=Math.hypot(...sub(camera,best.point));
 const east=[-Math.sin(lon),Math.cos(lon),0],north=[-Math.sin(lat)*Math.cos(lon),-Math.sin(lat)*Math.sin(lon),Math.cos(lat)],up=xyz(lon,lat,0).map(v=>v/R);
 let cx=0,cy=0,span=Math.max(50,Math.min(R*.15,Math.sqrt(Math.max(0,2*best.distance*45000+45000**2)))),spacing=initial.spacing;
 for(let pass=0;pass<iterations;pass++){
  const grid=[];let bestXY=[cx,cy];
  for(let row=0;row<9;row++){grid[row]=[];for(let col=0;col<9;col++){
   const x=cx+(col-4)*span/4,y=cy+(row-4)*span/4,angle=Math.hypot(x,y)/R,k=angle?Math.sin(angle)/(angle*R):1/R;
   const unit=up.map((v,i)=>v*Math.cos(angle)+k*(east[i]*x+north[i]*y)),lo=Math.atan2(unit[1],unit[0]),la=Math.atan2(unit[2],Math.hypot(unit[0],unit[1])),value=sample(lo/rad,la/rad);
   if(!value)continue;const point=xyz(lo,la,value.height);grid[row][col]={point,value,x,y};const distance=Math.hypot(...sub(camera,point));if(distance<best.distance){best={point,distance,...value};bestXY=[x,y];}
  }}
  // At coarse levels use measured vertices only; very large planar triangles
  // would cut through the curved planet and understate orbital altitude.
  if(span/4<Math.max(300,Math.sqrt(Math.max(1,best.distance)*R)*.015))for(let row=0;row<8;row++)for(let col=0;col<8;col++)for(const indices of [[[row,col],[row,col+1],[row+1,col]],[[row+1,col+1],[row+1,col],[row,col+1]]]){
   const vertices=indices.map(([r,c])=>grid[r][c]);if(vertices.some(v=>!v))continue;
   const point=closestTriangle(camera,...vertices.map(v=>v.point)),distance=Math.hypot(...sub(camera,point));if(distance<best.distance){best={point,distance,...vertices[0].value};const offset=sub(point,up.map(v=>v*R));bestXY=[dot(offset,east),dot(offset,north)];}
  }
  [cx,cy]=bestXY;spacing=best.spacing;span=Math.max(2,span/4);
 }
 return {...best,spacing,datumHeight:radius-R};
}
export function altitudeText(metres){if(!Number.isFinite(metres))return '—';if(metres>=1e6)return `${(metres/1000).toLocaleString('en',{maximumFractionDigits:0})} km`;if(metres>=1000)return `${(metres/1000).toFixed(metres>=10000?1:2)} km`;return `${Math.max(0,metres).toFixed(metres<10?1:0)} m`;}
export class CameraAltitude{
 constructor(viewer,{view=()=> '3d',onUpdate}={}){
  this.viewer=viewer;this.view=view;this.onUpdate=onUpdate;this.tick=()=>this.update();viewer.scene.postRender.addEventListener(this.tick);this.timer=setInterval(this.tick,650);this.update();
 }
 update(){
  const now=performance.now();if(now-(this.last??-1000)<450)return;this.last=now;
  const p=this.viewer.camera.positionWC,scale=this.viewer.scene.verticalExaggeration??1,relative=this.viewer.scene.verticalExaggerationRelativeHeight??0,result=terrainClearance([p.x,p.y,p.z],(lon,lat)=>{const value=knownTerrainHeight(lon,lat,this.viewer.terrainProvider);return value?{...value,height:relative+(value.height-relative)*scale}:null;});
  const twoD=this.view()==='2d',label=document.getElementById('altitude-label'),value=document.getElementById('altitude-value'),note=document.getElementById('altitude-source');
  const metres=result?.distance??Math.max(0,this.viewer.camera.positionCartographic.height);
  label.textContent=twoD?'3D camera altitude':'Camera altitude';value.textContent=(result?'≈ ':'')+altitudeText(metres);
  note.textContent=result?`Displayed terrain · ${result.source} · relief ${scale}×`:'Mars reference sphere · terrain loading';
  document.getElementById('altitude').title=(twoD?'2D has no physical camera height; this is the retained 3D camera. ':'')+'Estimated shortest distance to displayed sampled terrain, including nearby slopes. Clearance follows the current relief exaggeration; source DEM measurements remain physical. '+(result?`Source sampling ≈${altitudeText(result.spacing)}. `:'')+'Not the view-centre elevation or the 2D distance scale.';
  this.onUpdate?.(metres);
 }
 destroy(){clearInterval(this.timer);this.viewer.scene.postRender.removeEventListener(this.tick);}
}

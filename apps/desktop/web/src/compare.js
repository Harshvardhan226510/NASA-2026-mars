import {R} from './raster.js';
const parallelScale=lat=>Math.PI*R*Math.max(.000001,Math.cos(lat*Math.PI/180))/256;
export const groundMetresPerPixel=(lat,zoom)=>parallelScale(lat)/2**zoom;
export const zoomForGroundScale=(lat,metres)=>Math.max(0,Math.min(23,Math.log2(parallelScale(lat)/Math.max(.001,metres))));

export class CompareViews{
 constructor(map,{active,move3D}){this.map=map;this.active=active;this.move3D=move3D;this.syncing=false;this.userMoving=false;map.on?.('movestart zoomstart',()=>{if(!this.syncing)this.userMoving=true;});map.on?.('moveend',()=>{if(!this.syncing)this.userMoving=false;});}
 programmatic(task){const previous=this.syncing;this.syncing=true;try{return task();}finally{this.syncing=previous;}}
 from3D(detail){
  if(!this.active()||this.syncing||this.userMoving||!detail?.focus||!(detail.perPixel>0))return;
  const [lon,lat]=detail.focus,zoom=zoomForGroundScale(lat,detail.perPixel),centre=this.map.getCenter();
  if(this.map.distance(centre,[lat,lon])<detail.perPixel*.25&&Math.abs(this.map.getZoom()-zoom)<.002)return;
  this.programmatic(()=>this.map.setView([lat,lon],zoom,{animate:false}));
 }
 from2D(){
  if(!this.active()||this.syncing)return;
  const c=this.map.getCenter();this.move3D([c.lng,c.lat],groundMetresPerPixel(c.lat,this.map.getZoom()));
 }
}

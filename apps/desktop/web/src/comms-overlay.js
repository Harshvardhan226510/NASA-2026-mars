import L from 'leaflet';
import {coverageBounds,coverageCell,coverageStates} from './comms-model.js';
import {routeProjection,wrapRouteLongitude} from './route-geometry.js';

export const towerSymbol='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="#102431" stroke="#adf3db" stroke-width="2"/><path d="M11 25l5-13 5 13m-8-4h6m-7-10a6 6 0 0 1 0-6m8 6a6 6 0 0 0 0-6" fill="none" stroke="#adf3db" stroke-width="1.6" stroke-linecap="round"/><circle cx="16" cy="9" r="2" fill="#adf3db"/></svg>';

function coverageImage(result,point){
 const bounds=coverageBounds(point,result.radius),[west,south,east,north]=bounds;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(canvas.width,canvas.height),{forward}=routeProjection(result.center);
 const palette=Object.fromEntries(coverageStates.map(state=>[state.id,state.rgb]));
 for(let row=0;row<canvas.height;row++)for(let col=0;col<canvas.width;col++){
  const ll=[west+(east-west)*(col+.5)/canvas.width,north-(north-south)*(row+.5)/canvas.height];
  const hit=coverageCell(result,forward(ll));if(!hit)continue;
  const i=(row*canvas.width+col)*4;
  image.data.set(palette[hit.id],i);image.data[i+3]=hit.id===5&&((row+col)%9<3)?125:210;
 }
 ctx.putImageData(image,0,0);
 return {url:canvas.toDataURL(),bounds};
}

export class CommsOverlay{
 constructor(viewer,maps,{dragStarted,dragged,dragEnded}){
  Object.assign(this,{viewer,maps});
  const C=window.Cesium;
  this.source=new C.CustomDataSource('Ground radio coverage');viewer.dataSources.add(this.source);
  this.tower=this.source.entities.add({billboard:{image:'data:image/svg+xml,'+encodeURIComponent(towerSymbol.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" ')),width:34,height:34,heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
  this.markers=maps.map((map,index)=>{
   const pane=map.createPane('commsCoverage');pane.style.zIndex='397';pane.style.pointerEvents='none';
   const marker=L.marker([0,0],{icon:L.divIcon({className:'comms-tower-pin',html:towerSymbol,iconSize:[34,34],iconAnchor:[17,17]}),draggable:index===0,title:'Simulation tower',alt:'Simulation tower',riseOnHover:true});
   if(index===0){
    marker.on('dragstart',dragStarted);marker.on('drag',()=>{const p=marker.getLatLng();dragged([p.lng,p.lat],index);});marker.on('dragend',dragEnded);
   }
   map.on('moveend',()=>{if(!this.dragging)this.positionMarkers();this.wrapImages();});
   return marker;
  });
  this.visible=false;this.editable=false;this.opacity=.55;this.source.show=false;
 }
 positionMarkers(except){
  if(!this.point)return;
  const [lon,lat]=this.point,C=window.Cesium;
  this.tower.position=C.Cartesian3.fromDegrees(lon,lat,0,this.viewer.scene.globe.ellipsoid);
  for(const [i,map] of this.maps.entries())if(i!==except)this.markers[i].setLatLng([lat,lon+360*Math.round((map.getCenter().lng-lon)/360)]);
  this.viewer.scene.requestRender();
 }
 setTower(point,except){this.point=point;this.positionMarkers(except);this.sync();}
 setVisibility(visible,editable){if(this.visible===visible&&this.editable===editable)return;this.visible=visible;this.editable=editable;this.sync();}
 sync(){
  this.source.show=this.visible&&Boolean(this.point);
  this.markers.forEach((marker,i)=>{
   if(this.source.show)marker.addTo(this.maps[i]);else marker.remove();
   if(i===0&&marker.dragging){if(this.editable)marker.dragging.enable();else marker.dragging.disable();}
  });
  this.showImages();
 }
 showImages(){
  if(this.layer)this.layer.show=this.visible;
  this.images?.forEach((image,i)=>{if(this.visible)image.addTo(this.maps[i]);else image.remove();});
  this.viewer.scene.requestRender();
 }
 setOpacity(value){this.opacity=value;if(this.layer)this.layer.alpha=value;this.images?.forEach(layer=>layer.setOpacity(value));this.viewer.scene.requestRender();}
 wrapImages(){
  if(!this.bounds)return;
  const [w,s,e,n]=this.bounds;
  this.images?.forEach((image,i)=>{
   const shift=360*Math.round((this.maps[i].getCenter().lng-(w+e)/2)/360);
   if(shift!==image.commsShift){image.commsShift=shift;image.setBounds([[s,w+shift],[n,e+shift]]);}
  });
 }
 clear(){
  this.generation=(this.generation??0)+1;
  if(this.layer)this.viewer.imageryLayers.remove(this.layer);
  this.images?.forEach(layer=>layer.remove());this.layer=null;this.images=null;this.bounds=null;
  this.viewer.scene.requestRender();
 }
 async draw(result,point){
  this.clear();const generation=this.generation,C=window.Cesium,{url,bounds}=coverageImage(result,point),[w,s,e,n]=bounds;
  this.bounds=bounds;
  this.images=this.maps.map(()=>L.imageOverlay(url,[[s,w],[n,e]],{pane:'commsCoverage',opacity:this.opacity,interactive:false}));
  this.wrapImages();this.showImages();
  const full=e-w>=360,west=full?-180:wrapRouteLongitude(w),east=full?180:(e===180?180:wrapRouteLongitude(e));
  const provider=await C.SingleTileImageryProvider.fromUrl(url,{rectangle:C.Rectangle.fromDegrees(west,s,east,n),ellipsoid:this.viewer.scene.globe.ellipsoid});
  if(generation!==this.generation)return;
  this.layer=new C.ImageryLayer(provider,{alpha:this.opacity,show:this.visible});this.viewer.imageryLayers.add(this.layer);this.viewer.imageryLayers.raiseToTop(this.layer);
  this.viewer.scene.requestRender();
 }
}

import L from 'leaflet';
import {MagneticModelData,MAGNETIC_COLORS,magneticPixels,sampleMagnetic,magneticScale,magneticFraction} from './magnetic-data.js';
import {magneticImageryProvider} from './magnetic-provider.js';

const $=id=>document.getElementById(id),storage='mars-field-atlas-magnetic-v1',size=512;
const defaultOpacity=.4,minOpacity=0,maxOpacity=1;
const modelData=new MagneticModelData();
const FlatMagnetic=L.GridLayer.extend({createTile(coords,done){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;if(coords.y===0&&this.options.images)canvas.getContext('2d').drawImage(this.options.images[((coords.x%2)+2)%2],0,0);queueMicrotask(()=>done(null,canvas));return canvas;}});
export class MagneticLayer{
 constructor(viewer,map,mini){
  this.viewer=viewer;this.maps=[map,mini];this.altitude=150000;this.opacity=defaultOpacity;this.images=new Map();this.generation=0;
  try{const saved=JSON.parse(localStorage.getItem(storage));if([0,150000].includes(saved?.altitude))this.altitude=saved.altitude;if(Number.isFinite(saved?.opacity))this.opacity=Math.max(minOpacity,Math.min(maxOpacity,saved.opacity));}catch{}
  $('magnetic-altitude').value=String(this.altitude);$('magnetic-opacity').value=String(Math.round(this.opacity*100));
  $('magnetic-altitude').onchange=()=>{this.altitude=Number($('magnetic-altitude').value);this.remember();if(this.visible)this.load();};
  $('magnetic-opacity').oninput=()=>{const value=Number($('magnetic-opacity').value)/100;this.opacity=Number.isFinite(value)?Math.max(minOpacity,Math.min(maxOpacity,value)):defaultOpacity;this.remember();this.applyOpacity();};
  $('magnetic-retry').onclick=()=>this.load();this.applyOpacity();
  viewer.imageryLayers.layerAdded.addEventListener(()=>{if(this.layer)viewer.imageryLayers.raiseToTop(this.layer);});
 }
 remember(){try{localStorage.setItem(storage,JSON.stringify({altitude:this.altitude,opacity:this.opacity}));}catch{}}
 applyOpacity(){if(this.layer)this.layer.alpha=this.opacity;this.flat?.forEach(l=>l.setOpacity(this.opacity));$('magnetic-opacity-value').textContent=`${Math.round(this.opacity*100)}%`;this.viewer.scene.requestRender();}
 setVisible(show){if(this.visible===show)return;this.visible=show;$('magnetic-legend').hidden=!show;$('magnetic-options').hidden=!show;this.generation=(this.generation??0)+1;if(show)this.load();else this.clear();}
 clear(){if(this.layer){this.viewer.imageryLayers.remove(this.layer,true);this.layer=null;}this.flat?.forEach(l=>l.remove());this.flat=null;this.grid=null;this.viewer.scene.requestRender();}
 async load(){
  const generation=++this.generation,altitude=this.altitude;this.clear();this.failed=false;$('magnetic-layer-status').textContent='Loading and verifying the published model…';$('magnetic-retry').hidden=true;$('magnetic-value').textContent='Loading model…';this.legend();
  try{
   const grid=await modelData.load(altitude);if(!this.visible||generation!==this.generation)return;this.grid=grid;
   if(!this.images.has(altitude))this.images.set(altitude,[0,1].map(x=>{const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').putImageData(new ImageData(magneticPixels(grid,[-180+x*180,-90,x*180,90],size),size,size),0,0);return c;}));
   const images=this.images.get(altitude),C=window.Cesium,provider=magneticImageryProvider(C,this.viewer.scene.globe.ellipsoid,images);
   this.layer=new C.ImageryLayer(provider,{alpha:this.opacity});this.viewer.imageryLayers.add(this.layer);
   this.flat=this.maps.map(m=>{const pane=m.getPane('magnetic')??m.createPane('magnetic');pane.style.zIndex='355';pane.style.pointerEvents='none';return new FlatMagnetic({pane:'magnetic',images,maxNativeZoom:0,maxZoom:23,keepBuffer:0,noWrap:false,opacity:this.opacity,attribution:'Langlais et al. (2019) · MGS/MAVEN magnetic model'}).addTo(m);});
   $('magnetic-layer-status').textContent='Verified model · global coverage · ≈160 km resolving power at the reference surface.';this.legend();this.viewer.scene.requestRender();
  }catch(error){if(generation!==this.generation||!this.visible)return;this.failed=true;$('magnetic-layer-status').textContent=error.message;$('magnetic-value').textContent='Model unavailable';$('magnetic-retry').hidden=false;}
 }
 updateLocation(point){this.point=point;if(this.visible)this.readout();}
 readout(){const value=this.point&&sampleMagnetic(this.grid,...this.point);$('magnetic-value').textContent=!this.grid?this.failed?'Model unavailable':'Loading model…':!this.point?'View centre is above the horizon':Number.isFinite(value)?`View centre ≈${value<1?'<1':Math.round(value).toLocaleString()} nT`:'No model value here';}
 legend(){
  const maximum=magneticScale(this.altitude);$('magnetic-height').textContent=this.altitude?'150 km above the model reference sphere':'At the model reference surface';
  $('magnetic-ramp').style.background=`linear-gradient(to right,${MAGNETIC_COLORS.map(([t,rgb])=>`rgb(${rgb.join(',')}) ${t*100}%`).join(',')})`;
  const ticks=this.altitude?[0,10,100,1000,2000]:[0,100,1000,10000,20000];$('magnetic-ticks').replaceChildren(...ticks.map(value=>{const span=document.createElement('span');span.style.left=`${magneticFraction(value,maximum)*100}%`;span.textContent=value>=1000?`${value/1000}k`:String(value);return span;}));this.readout();
 }
}

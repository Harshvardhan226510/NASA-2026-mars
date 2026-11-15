import L from 'leaflet';
import {globeDetailWeight,flatDetailWeight} from './overview-policy.js';
let images;
function overviewImages(){
 if(!images){const task=Promise.all([0,1].map(x=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Globe overview unavailable.'));image.src=`/globe-overview-${x}.jpg`;})));images=task;task.catch(()=>{if(images===task)images=null;});}return images;
}
const FlatOverview=L.GridLayer.extend({createTile(coords,done){const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;if(coords.y!==0){queueMicrotask(()=>done(null,canvas));return canvas;}overviewImages().then(frames=>{canvas.getContext('2d').drawImage(frames[((coords.x%2)+2)%2],0,0);done(null,canvas);}).catch(e=>done(e,canvas));return canvas;}});
export class GlobeOverview{
 constructor(viewer,maps,{providers,flatLayers,elevation,onChange=()=>{}}){
  Object.assign(this,{viewer,maps,providers,flatLayers,elevation,onChange});const C=window.Cesium;
  const provider={tilingScheme:new C.GeographicTilingScheme({ellipsoid:viewer.scene.globe.ellipsoid}),tileWidth:2048,tileHeight:2048,minimumLevel:0,maximumLevel:0,hasAlphaChannel:false,errorEvent:new C.Event(),credit:new C.Credit('NASA/JPL/MSSS · Caltech Murray Lab CTX · NASA Viking gap context · fixed globe overview'),requestImage(x){return overviewImages().then(frames=>frames[x]);},getTileCredits(){},pickFeatures(){}};
  provider.rectangle=provider.tilingScheme.rectangle;this.layer=viewer.imageryLayers.addImageryProvider(provider,0);
  this.base=maps.map(m=>new FlatOverview({maxNativeZoom:0,maxZoom:23,keepBuffer:0,zIndex:0,attribution:'CTX/Viking · consistent globe overview'}).addTo(m));
  maps.forEach((m,i)=>m.on('zoomend',()=>this.flat(i)));
  this.tick=()=>this.update();viewer.scene.preRender.addEventListener(this.tick);this.update();maps.forEach((m,i)=>this.flat(i));
 }
 update(){const weight=globeDetailWeight(this.viewer.camera.positionCartographic.height);if(Math.abs(weight-(this.weight??-1))<.001)return;this.weight=weight;
  for(const p of this.providers){p.displayLayer.show=this.enabled!==false&&weight>0;p.displayLayer.alpha=weight;}
  this.elevation.setDetailWeight(weight);this.onChange();
 }
 flat(index){const weight=flatDetailWeight(this.maps[index].getZoom());for(const layer of this.flatLayers[index])layer.setOpacity(this.enabled===false?0:weight);this.elevation.flatWeight(index,weight);}
 // Keep the complete photograph underneath color too. It covers a new color
 // tile while it loads and remains ready when returning to grayscale.
 setEnabled(show){this.enabled=show;this.layer.show=Boolean(show);for(const p of this.base)p.setOpacity(show?1:0);this.weight=undefined;this.update();this.maps.forEach((_,i)=>this.flat(i));}
 active(map){return this.enabled!==false&&(map?flatDetailWeight(map.getZoom())<.5:this.weight<.5);}
 qualityAt(){return {source:'CTX / Viking overview',level:2,metres:Math.PI*3396190/2048};}
}

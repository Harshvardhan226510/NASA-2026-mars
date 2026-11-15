import L from 'leaflet';
import {geographicBounds} from './planet-grid.js';
const FlatRaster=L.GridLayer.extend({createTile(coords,done){const source=this.options.image(coords.x,coords.y,coords.z),canvas=document.createElement('canvas');canvas.width=canvas.height=256;canvas.getContext('2d').drawImage(source,0,0);queueMicrotask(()=>done(null,canvas));return canvas;}});
export class SourceRaster{
 constructor(viewer,maps){this.viewer=viewer;this.maps=maps;this.opacity=.55;viewer.imageryLayers.layerAdded.addEventListener(()=>{if(this.layer)viewer.imageryLayers.raiseToTop(this.layer);});}
 clear(){if(this.layer)this.viewer.imageryLayers.remove(this.layer,true);this.layer=null;this.flat?.forEach(x=>x.remove());this.flat=null;this.viewer.scene.requestRender();}
 draw(color,credit,maxLevel=3){
  this.clear();const C=window.Cesium,scheme=new C.GeographicTilingScheme({ellipsoid:this.viewer.scene.globe.ellipsoid}),cache=new Map();
  const image=(x,y,z)=>{const columns=2**(z+1),rows=2**z;x=((x%columns)+columns)%columns;const key=`${z}/${x}/${y}`;if(cache.has(key))return cache.get(key);const canvas=document.createElement('canvas');canvas.width=canvas.height=256;if(y<0||y>=rows)return canvas;const pixels=new Uint8ClampedArray(256*256*4),b=geographicBounds(x,y,z);
   for(let row=0;row<256;row++)for(let col=0;col<256;col++)pixels.set(color(b[0]+col/255*(b[2]-b[0]),b[3]-row/255*(b[3]-b[1])),(row*256+col)*4);
   canvas.getContext('2d').putImageData(new ImageData(pixels,256,256),0,0);cache.set(key,canvas);if(cache.size>96)cache.delete(cache.keys().next().value);return canvas;};
  const provider={tilingScheme:scheme,rectangle:scheme.rectangle,tileWidth:256,tileHeight:256,minimumLevel:0,maximumLevel:maxLevel,hasAlphaChannel:true,errorEvent:new C.Event(),credit:new C.Credit(credit),getTileCredits(){},pickFeatures(){},async requestImage(x,y,z){return image(x,y,z);}};
  this.layer=new C.ImageryLayer(provider,{alpha:this.opacity});this.viewer.imageryLayers.add(this.layer);
  this.flat=this.maps.map(map=>{const pane=map.getPane('source-overlays')??map.createPane('source-overlays');pane.style.zIndex='355';pane.style.pointerEvents='none';return new FlatRaster({pane:'source-overlays',image,tileSize:256,maxNativeZoom:maxLevel,maxZoom:23,opacity:this.opacity,keepBuffer:0,attribution:credit}).addTo(map);});this.viewer.scene.requestRender();
 }
 setOpacity(value){this.opacity=Math.max(0,Math.min(1,value));if(this.layer)this.layer.alpha=this.opacity;this.flat?.forEach(x=>x.setOpacity(this.opacity));this.viewer.scene.requestRender();}
}

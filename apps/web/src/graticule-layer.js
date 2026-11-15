import L from 'leaflet';
import {geographicBounds} from './planet-grid.js';
import {gridInterval,coordinateGrid} from './coordinate-grid.js';
const size=256;
export function gridImage(x,y,z,spacing,createCanvas=()=>document.createElement('canvas')){
 const canvas=createCanvas();canvas.width=canvas.height=size;
 const columns=2**(z+1),rows=2**z;if(y<0||y>=rows)return canvas;x=((x%columns)+columns)%columns;
 const context=canvas.getContext('2d'),{lines,labels}=coordinateGrid(geographicBounds(x,y,z),spacing,size);
 context.lineCap='butt';
 for(const line of lines){
  context.beginPath();context.moveTo(...line.from);context.lineTo(...line.to);
  context.strokeStyle='#06121dcc';context.lineWidth=line.major?3.5:2.5;context.stroke();
  context.strokeStyle=line.major?'#ffe3b2e6':'#d5f0f0b3';context.lineWidth=line.major?1.5:.8;context.stroke();
 }
 context.font='600 12px system-ui, sans-serif';context.textAlign='center';context.textBaseline='middle';context.lineJoin='round';context.lineWidth=3.5;context.strokeStyle='#07121ff2';context.fillStyle='#f1f6ed';
 for(const label of labels){context.strokeText(label.text,label.x,label.y);context.fillText(label.text,label.x,label.y);}
 return canvas;
}
const FlatGraticule=L.GridLayer.extend({createTile(coords,done){const image=this.options.image(coords.x,coords.y,coords.z);queueMicrotask(()=>done(null,image));return image;}});

export class GraticuleLayer{
 constructor(viewer,map,mini){
  this.viewer=viewer;this.maps=[map,mini];this.flat=[];this.flatKeys=[];
  viewer.camera.moveEnd.addEventListener(()=>this.schedule());
  viewer.imageryLayers.layerAdded.addEventListener(()=>{if(this.layer)viewer.imageryLayers.raiseToTop(this.layer);});
  this.maps.forEach(m=>m.on('zoomend moveend resize',()=>this.schedule()));
 }
 schedule(){if(!this.visible)return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.update(),100);}
 setVisible(show){
  if(this.visible===show)return;this.visible=show;document.getElementById('graticule-details').hidden=!show;
  if(show)this.update();else{clearTimeout(this.timer);if(this.layer)this.viewer.imageryLayers.remove(this.layer,true);this.layer=null;this.key=null;this.flat.forEach(l=>l?.remove());this.flat=[];this.flatKeys=[];this.viewer.scene.requestRender();}
 }
 image(spacing){const cache=new Map();return (x,y,z)=>{const key=`${x}/${y}/${z}`;if(cache.has(key))return cache.get(key);const image=gridImage(x,y,z,spacing);cache.set(key,image);if(cache.size>64)cache.delete(cache.keys().next().value);return image;};}
 update(){
  if(!this.visible)return;
  const C=window.Cesium,camera=this.viewer.camera,ellipsoid=this.viewer.scene.globe.ellipsoid,p=camera.positionCartographic;
  // Estimate a viewport footprint, then use the loaded globe's view rectangle
  // when available. No offscreen terrain picking or elevation requests.
  const degrees=C.Math.toDegrees,span=Math.min(180,Math.max(.000006,degrees(2*Math.atan(Math.max(.1,p.height)/ellipsoid.maximumRadius))));
  let latSpan=span,lonSpan=Math.min(360,span/Math.max(.03,Math.cos(p.latitude)));
  const rectangle=camera.computeViewRectangle?.(ellipsoid);
  if(rectangle){latSpan=Math.max(.000006,degrees(rectangle.north-rectangle.south));lonSpan=Math.max(.000006,degrees(C.Rectangle.computeWidth(rectangle)));}
  const spacing={latStep:gridInterval(latSpan),lonStep:gridInterval(lonSpan)},key=JSON.stringify(spacing);
  if(this.key!==key){
   if(this.layer)this.viewer.imageryLayers.remove(this.layer,true);this.layer=null;
   const scheme=new C.GeographicTilingScheme({ellipsoid}),image=this.image(spacing),provider={tilingScheme:scheme,rectangle:scheme.rectangle,tileWidth:size,tileHeight:size,minimumLevel:0,maximumLevel:20,hasAlphaChannel:true,errorEvent:new C.Event(),getTileCredits(){},pickFeatures(){},async requestImage(x,y,z){return image(x,y,z);}};
   this.key=key;this.layer=new C.ImageryLayer(provider);this.viewer.imageryLayers.add(this.layer);
  }
  let activeSpacing=spacing;
  this.maps.forEach((map,i)=>{
   const extent=map.getBounds(),flatSpacing={latStep:gridInterval(Math.min(180,extent.getNorth()-extent.getSouth())),lonStep:gridInterval(Math.min(360,extent.getEast()-extent.getWest()))},flatKey=JSON.stringify(flatSpacing);
   if(this.flatKeys[i]!==flatKey){this.flat[i]?.remove();const pane=map.getPane('graticule')??map.createPane('graticule');pane.style.zIndex='390';pane.style.pointerEvents='none';this.flat[i]=new FlatGraticule({pane:'graticule',image:this.image(flatSpacing),tileSize:size,maxNativeZoom:20,maxZoom:23,keepBuffer:0,noWrap:false}).addTo(map);this.flatKeys[i]=flatKey;}
   if(i===0&&document.body.classList.contains('two-d'))activeSpacing=flatSpacing;
  });
  document.getElementById('graticule-spacing').textContent=`${activeSpacing.latStep}° latitude × ${activeSpacing.lonStep}° longitude · adjusts with zoom`;
  this.viewer.scene.requestRender();
 }
}

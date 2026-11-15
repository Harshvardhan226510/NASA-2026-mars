import L from 'leaflet';
import {globalElevationTile,geographicBounds,overviewElevation} from './planet.js';
import {elevationLayerWeights,flatDetailWeight} from './overview-policy.js';
import {TileQueue} from './tile-queue.js';
import {elevationPixels,ELEVATION_STOPS} from './elevation-colors.js';

const tiles=new TileQueue(2,48),size=256;
let overview;
function overviewImage(x){if(!overview)overview=overviewElevation().then(data=>[0,1].map(col=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=720;canvas.getContext('2d').putImageData(new ImageData(elevationPixels(geographicBounds(col,0,0),720,data.heightAt),720,720),0,0);return canvas;})).catch(e=>{overview=null;throw e;});return overview.then(images=>images[((x%2)+2)%2]);}
function image(x,y,z,signal){
 const columns=2**(z+1);x=((x%columns)+columns)%columns;
 return tiles.get(`${z}/${y}/${x}`,async()=>{
  const data=z<=5?await overviewElevation():await globalElevationTile(x,y,z),bounds=geographicBounds(x,y,z),canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  canvas.getContext('2d').putImageData(new ImageData(elevationPixels(bounds,size,data.displayHeightAt??data.heightAt),size,size),0,0);return canvas;
 },signal);
}
const FlatElevation=L.GridLayer.extend({
 createTile(coords,done){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.abort=new AbortController();
  image(coords.x,coords.y,coords.z,canvas.abort.signal).then(result=>{if(canvas.abort.signal.aborted)return;canvas.getContext('2d').drawImage(result,0,0);done(null,canvas);}).catch(error=>{if(!canvas.abort.signal.aborted)done(error,canvas);});return canvas;
 }
});
const FlatOverviewElevation=L.GridLayer.extend({createTile(coords,done){const canvas=document.createElement('canvas');canvas.width=canvas.height=720;if(coords.y!==0){queueMicrotask(()=>done(null,canvas));return canvas;}overviewImage(coords.x).then(image=>{canvas.getContext('2d').drawImage(image,0,0);done(null,canvas);}).catch(e=>done(e,canvas));return canvas;}});
export class ElevationLayer{
 constructor(viewer,map,mini){
  this.viewer=viewer;this.maps=[map,mini];const C=window.Cesium;
  const provider={tilingScheme:new C.GeographicTilingScheme({ellipsoid:viewer.scene.globe.ellipsoid}),tileWidth:size,tileHeight:size,minimumLevel:0,maximumLevel:8,hasAlphaChannel:true,errorEvent:new C.Event(),credit:new C.Credit('NASA/ESA/USGS · HRSC/MOLA elevations, with measured MOLA fallback'),getTileCredits(){return undefined;},pickFeatures(){return undefined;},requestImage(x,y,z){return image(x,y,z);}};
  provider.rectangle=provider.tilingScheme.rectangle;
  this.overviewLayer=new C.ImageryLayer({...provider,tileWidth:720,tileHeight:720,maximumLevel:0,requestImage(x){return overviewImage(x);}},{show:false,alpha:.7});viewer.imageryLayers.add(this.overviewLayer);
  this.layer=new C.ImageryLayer(provider,{show:false,alpha:0});viewer.imageryLayers.add(this.layer);
  this.flat=this.maps.map(m=>{const pane=m.getPane('elevation')??m.createPane('elevation');pane.style.zIndex='350';pane.style.pointerEvents='none';const layer=new FlatElevation({pane:'elevation',minZoom:0,maxNativeZoom:8,maxZoom:23,noWrap:false,opacity:.7,keepBuffer:0,attribution:'NASA/ESA/USGS · measured elevation colors'});layer.on('tileunload',e=>e.tile.abort?.abort());return layer;});
  this.overviewFlat=this.maps.map(m=>new FlatOverviewElevation({pane:'elevation',maxNativeZoom:0,maxZoom:23,opacity:.7,keepBuffer:0}));
  viewer.imageryLayers.layerAdded.addEventListener(()=>{viewer.imageryLayers.raiseToTop(this.overviewLayer);viewer.imageryLayers.raiseToTop(this.layer);});
  document.getElementById('elevation-ramp').style.background=`linear-gradient(to right,${ELEVATION_STOPS.map(([h,rgb])=>`rgb(${rgb.join(',')}) ${(h+8000)/300}%`).join(',')})`;
 }
 setVisible(show){
  if(this.visible===show)return;this.visible=show;this.setDetailWeight(this.weight??0);
  this.flat.forEach((layer,i)=>{if(show){this.overviewFlat[i].addTo(this.maps[i]);layer.addTo(this.maps[i]);this.flatWeight(i,flatDetailWeight(this.maps[i].getZoom()));}else{layer.remove();this.overviewFlat[i].remove();}});
  document.getElementById('elevation-legend').hidden=!show;this.viewer.scene.requestRender();
 }
 setDetailWeight(weight){this.weight=weight;const alpha=elevationLayerWeights(weight);this.overviewLayer.show=Boolean(this.visible)&&alpha.overview>0;this.overviewLayer.alpha=alpha.overview;this.layer.show=Boolean(this.visible)&&alpha.fine>0;this.layer.alpha=alpha.fine;this.legend();}
 flatWeight(index,weight){const alpha=elevationLayerWeights(weight);this.overviewFlat[index].setOpacity(alpha.overview);this.flat[index].setOpacity(alpha.fine);this.legend();}
 legend(){const label=document.querySelector('#elevation-legend small');if(label)label.innerHTML=(document.body.classList.contains('two-d')?flatDetailWeight(this.maps[0].getZoom()):this.weight??0)<.5?'MOLA overview ≈15 km grid · finer elevations on zoom<br>Color indicates height, not surface composition.':'HRSC/MOLA ≈200 m source · measured MOLA fallback<br>Color indicates height, not surface composition.';}
 refresh(){this.legend();if(this.visible)this.flat.forEach((layer,i)=>{if(this.maps[i].getContainer().clientWidth)layer.redraw();});}
}

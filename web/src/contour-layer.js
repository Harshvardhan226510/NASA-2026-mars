import L from 'leaflet';
import {cachedElevationTile,sampleGrid,overviewElevation,geographicBounds} from './planet.js';
import {contourPaths,contourInterval} from './contour-raster.js';
import {TileQueue} from './tile-queue.js';
import {scienceTile} from './science-tile-cache.js';
const SIZE=256;
const FlatContours=L.GridLayer.extend({createTile(coords,done){const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;canvas.abort=new AbortController();this.options.image(coords.x,coords.y,coords.z,canvas.abort.signal).then(image=>{if(canvas.abort.signal.aborted)return;canvas.getContext('2d').drawImage(image,0,0);done(null,canvas);}).catch(e=>{if(!canvas.abort.signal.aborted)done(e,canvas);});return canvas;}});
// Contours are transparent imagery draped by the same globe geometry as the
// photograph, so long chords and thousands of 3D/SVG line objects are avoided.
export class ContourLayer{
 constructor(viewer,map,mini){this.viewer=viewer;this.maps=[map,mini];this.interval=500;this.tiles=new TileQueue(2,64);this.generation=0;viewer.imageryLayers.layerAdded.addEventListener(()=>{if(this.layer)viewer.imageryLayers.raiseToTop(this.layer);});}
 clear(){this.controller?.abort();if(this.layer)this.viewer.imageryLayers.remove(this.layer,true);this.layer=null;this.flat?.forEach(l=>l.remove());this.flat=null;this.viewer.scene.requestRender();}
 setVisible(show){if(this.visible===show)return;this.visible=show;if(show)this.update();else{this.key=null;++this.generation;this.clear();}}
 async update(){
  if(!this.visible||this.key===this.interval)return;this.key=this.interval;const generation=++this.generation;this.clear();this.controller=new AbortController();const signal=this.controller.signal,selected=this.interval,C=window.Cesium,scheme=new C.GeographicTilingScheme({ellipsoid:this.viewer.scene.globe.ellipsoid});
  const image=(x,y,z,consumer)=>{const columns=2**(z+1);x=((x%columns)+columns)%columns;const ready=z>3?cachedElevationTile(x,y,z):null,sourceKey=ready?ready.bounds.join(',')+'/'+Boolean(ready.fallback):'mola';return this.tiles.get(`${selected}/${sourceKey}/${z}/${y}/${x}`,taskSignal=>scienceTile(`contours-v1/${selected}/${sourceKey}/${z}/${y}/${x}`,async()=>{
   const bounds=geographicBounds(x,y,z),width=129,grid=new Float32Array(width*width),interval=contourInterval(selected,z);let sample;
   const overview=await overviewElevation(),tile=ready;sample=tile?(lon,lat)=>sampleGrid(tile.grid,tile.width,tile.bounds,lon,lat)??overview.heightAt(lon,lat):overview.heightAt;
   for(let row=0;row<width;row++)for(let col=0;col<width;col++)grid[row*width+col]=sample(bounds[0]+col/(width-1)*(bounds[2]-bounds[0]),bounds[3]-row/(width-1)*(bounds[3]-bounds[1]));
   taskSignal.throwIfAborted();const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;const context=canvas.getContext('2d'),paths=contourPaths(grid,width,bounds,interval,SIZE);context.beginPath();for(const path of paths){context.moveTo(...path.points[0]);for(const point of path.points.slice(1))context.lineTo(...point);}context.strokeStyle='#12252d';context.lineWidth=2.5;context.stroke();context.strokeStyle='#f8e6a4';context.lineWidth=1.2;context.stroke();return canvas;
  },{persistent:z<=3,signal:taskSignal}),consumer?AbortSignal.any([signal,consumer]):signal);};
  try{document.getElementById('contour-status').textContent='Loading measured contour tiles…';await Promise.all([image(0,0,0),image(1,0,0)]);if(generation!==this.generation)return;
   const provider={tilingScheme:scheme,rectangle:scheme.rectangle,tileWidth:SIZE,tileHeight:SIZE,minimumLevel:0,maximumLevel:9,hasAlphaChannel:true,errorEvent:new C.Event(),credit:new C.Credit('NASA MOLA / ESA HRSC · measured elevation contours'),getTileCredits(){},pickFeatures(){},requestImage(x,y,z){return image(x,y,z);}};
   this.layer=new C.ImageryLayer(provider,{alpha:.9});this.viewer.imageryLayers.add(this.layer);this.flat=this.maps.map(map=>{const pane=map.getPane('contours')??map.createPane('contours');pane.style.zIndex='356';pane.style.pointerEvents='none';return new FlatContours({pane:'contours',image,tileSize:256,maxNativeZoom:9,maxZoom:23,keepBuffer:0,noWrap:false,opacity:.9,attribution:provider.credit.html}).on('tileunload',e=>e.tile.abort?.abort()).addTo(map);});document.getElementById('contour-status').textContent=`${selected} m selected interval · global overview uses at least 1–2 km spacing · cached measured DEM · coarse ≈15 km MOLA fallback; small cliffs may be unresolved. Contours follow the terrain in 3D and 2D.`;this.viewer.scene.requestRender();
  }catch(error){if(generation===this.generation&&!signal.aborted){this.key=null;document.getElementById('contour-status').textContent='Measured contours unavailable. Toggle the layer to retry.';}}
 }
}

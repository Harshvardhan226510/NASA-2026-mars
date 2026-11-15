import {progressiveImage} from './progressive-image.js';
import {scheduledImage,abortableResult} from './scheduled-image.js';
import {scientificPixels} from './scientific-pixels.js';
import L from 'leaflet';
import {globalElevationTile,sampleGrid,geographicBounds,overviewElevation} from './planet.js';
import {loadReference,sampleReference} from './scientific-data.js';
import {referencePyramid,sampleReferencePixel,referenceStyle} from './reference-display.js';
import {TileQueue} from './tile-queue.js';
import {scienceTile} from './science-tile-cache.js';
import {renderOverlayScale} from './science-style.js';
import {terrainOverlayContext} from './terrain-overlay-sampling.js';
import {MINERAL_SURVEY_GAPS} from './overlay-explanations.js';
import {geologyImage} from './geology-tiles.js';
import {validateGeologyLegend,GEOLOGY_MAX_LEVEL} from './geology-grid.js';
const size=128,$=id=>document.getElementById(id);
const FlatScience=L.GridLayer.extend({createTile(coords,done){const c=document.createElement('canvas');c.width=c.height=this.options.imageSize;c.scienceController=new AbortController();const signal=c.scienceController.signal,primary=this.options.image(coords.x,coords.y,coords.z,signal),coarse=this.options.coarseImage&&coords.z>3?this.options.coarseImage(coords.x,coords.y,coords.z,signal):null;
 progressiveImage(primary,coarse,(image,first)=>{c.getContext('2d').clearRect(0,0,c.width,c.height);c.getContext('2d').drawImage(image,0,0);if(first)done(null,c);},signal).catch(error=>{if(!signal.aborted)done(error,c);});return c;}});
export class ScientificLayer{
 constructor(viewer,map,mini){this.viewer=viewer;this.maps=[map,mini];this.generation=0;this.opacity=.55;this.tiles=new TileQueue(2,64);this.coarseTiles=new TileQueue(2,48);viewer.imageryLayers.layerAdded.addEventListener(()=>{if(this.layer)viewer.imageryLayers.raiseToTop(this.layer);});}
 clear(){this.controller?.abort();if(this.layer)this.viewer.imageryLayers.remove(this.layer,true);this.layer=null;this.flat?.forEach(l=>l.remove());this.flat=null;this.viewer.scene.requestRender();}
 async setActive(item,variant){
  const key=item?item.id+':'+(variant??item.asset??'')+':'+(item.solar?.at??''):'';if(this.key===key)return;this.key=key;const generation=++this.generation;this.clear();this.item=item;this.grid=null;this.geologyLegend=null;this.readout();if(!item){$('science-legend').hidden=true;return;}
  this.controller=new AbortController();const signal=this.controller.signal;$('science-status').textContent='Loading verified static data…';this.legend();
  try{
   if(item.engine==='geology'){const r=await fetch('/geology/legend.json',{signal});if(!r.ok)throw Error('The geologic map legend is unavailable.');const legend=validateGeologyLegend(await r.json());if(generation!==this.generation)return;this.geologyLegend=legend;}
   if(item.engine==='reference'){
    if(!this.manifest)this.manifest=fetch('/scientific/manifest.json').then(r=>{if(!r.ok)throw new Error('Reference metadata unavailable.');return r.json();}).catch(e=>{this.manifest=null;throw e;});
    const manifest=await this.manifest,asset=manifest.layers[variant??item.asset];if(!asset)throw new Error('This source product is unavailable.');const grid=await loadReference(asset,{signal});const display=await referencePyramid(grid,signal);if(generation!==this.generation)return;this.grid=grid;this.display=display;
   }
   if(generation!==this.generation)return;const C=window.Cesium,scheme=new C.GeographicTilingScheme({ellipsoid:this.viewer.scene.globe.ellipsoid}),imageSize=item.engine==='geology'?256:item.engine==='reference'?512:size,maximumLevel=item.engine==='geology'?GEOLOGY_MAX_LEVEL:item.engine==='reference'?Math.max(0,Math.ceil(Math.log2(this.grid.width/(imageSize*2)))):7;
   const sourceGrid=this.grid,display=this.display,image=(x,y,z,consumer)=>this.image(item,sourceGrid,key,x,y,z,consumer?AbortSignal.any([signal,consumer]):signal,display),provider={tilingScheme:scheme,rectangle:scheme.rectangle,tileWidth:imageSize,tileHeight:imageSize,minimumLevel:0,maximumLevel,hasAlphaChannel:true,errorEvent:new C.Event(),credit:new C.Credit(item.engine==='geology'?'USGS SIM 3292 · Tanaka et al. (2014) · ArcGIS cartography':item.engine==='reference'?(item.sources?.[0]?.title??'Published reference source'):'NASA MOLA / ESA HRSC · derived terrain metric'),getTileCredits(){},pickFeatures(){},requestImage(x,y,z,request){return scheduledImage(C,request,new URL(`/__science_display__/${encodeURIComponent(key)}/${z}/${y}/${x}`,location.href).href,consumer=>image(x,y,z,consumer));}};
   // Prime both measured hemispheres before refinement requests can queue ahead.
   await Promise.all([image(0,0,0),image(1,0,0)]);if(generation!==this.generation)return;
   this.layer=new C.ImageryLayer(provider,{alpha:this.opacity});this.viewer.imageryLayers.add(this.layer);
   this.flat=this.maps.map(m=>{const pane=m.getPane('scientific')??m.createPane('scientific');pane.style.zIndex='354';pane.style.pointerEvents='none';return new FlatScience({pane:'scientific',image,coarseImage:item.engine==='terrain'?((x,y,z,consumer)=>this.image(item,sourceGrid,key,x,y,z,consumer?AbortSignal.any([signal,consumer]):signal,display,true)):null,imageSize,maxNativeZoom:maximumLevel,maxZoom:23,opacity:this.opacity,keepBuffer:0,noWrap:false,tileSize:256,attribution:provider.credit.html}).on('tileunload',e=>e.tile.scienceController?.abort()).addTo(m);});
   $('science-status').textContent=item.engine==='geology'?'USGS SIM 3292 cartography · 44 named map units · 1:20 million. Zoom enlarges the published map; it does not add geological detail.':item.engine==='reference'?`Source verified · ${this.grid.native_sampling}. Smooth display; numeric readout uses the original cell.`:item.solar?`Calculated sunlight at ${item.solar.at} · physical DEM heights · bounded local horizon.`:'Measured terrain derivatives · globe overview uses cached MOLA; finer HRSC/MOLA loads on zoom. No extra detail is inferred.';this.legend();this.readout();this.viewer.scene.requestRender();
  }catch(error){if(generation===this.generation){$('science-status').textContent=error.message;$('science-retry').hidden=false;}}
 }
 retry(){const item=this.item;this.key=null;return this.setActive(item,$('science-variant').value||undefined);}
 setOpacity(value){this.opacity=Math.max(0,Math.min(1,value));if(this.layer)this.layer.alpha=this.opacity;this.flat?.forEach(l=>l.setOpacity(this.opacity));this.viewer.scene.requestRender();}
 updateLocation(point){this.point=point;this.readout();}
 readout(){const out=$('science-value');out.hidden=!this.grid;if(!this.grid)return;const value=this.point?sampleReference(this.grid,...this.point):NaN,swim=this.grid.file.startsWith('ice-');out.textContent=Number.isFinite(value)?`Source cell: ${value.toLocaleString(undefined,{maximumSignificantDigits:4})} ${this.grid.units}`:this.point?(swim&&Math.abs(this.point[1])>60?'Outside SWIM’s 60°S–60°N survey · choose Global hydrogen for polar coverage':'No source data at view centre'):'View centre is above the horizon';}
 image(item,grid,key,x,y,z,signal,display,coarse=false){
  if(item.engine==='geology')return geologyImage(x,y,z,signal);
  const columns=2**(z+1);x=((x%columns)+columns)%columns;if(y<0||y>=2**z)return Promise.resolve(document.createElement('canvas'));
  const sourceVersion=grid?.file==='thermal-inertia.f32.gz'?`${grid.packet_sha256}-polar-mask`:grid?.packet_sha256??'mola4ppd-or-hrsc-v5';
  return (coarse?this.coarseTiles:this.tiles).get(`${key}/${coarse?'coarse/':''}${z}/${y}/${x}`,taskSignal=>scienceTile(`${key}/${coarse?'coarse/':''}${sourceVersion}/${z}/${y}/${x}`,async()=>{
   const bounds=geographicBounds(x,y,z),imageSize=item.engine==='reference'?512:size,style=referenceStyle(item,grid);let sample,spacing,confidence,terrainContext;
   if(item.engine==='reference')sample=(lon,lat)=>sampleReferencePixel(display,lon,lat,(bounds[2]-bounds[0])/(imageSize-1));
   else{
    const overview=await overviewElevation();sample=overview.heightAt;confidence=0;spacing=Math.max(15000,(bounds[3]-bounds[1])*Math.PI/180*3396190/128);
    // A single coherent global DEM at planetary scales avoids a checkerboard
    // of independent service levels. Fine metrics fade in only on local zoom.
    if(z>5&&!coarse){const tile=await abortableResult(globalElevationTile(x,y,z),taskSignal);terrainContext=terrainOverlayContext(tile,bounds);}
   }
   const pixels=await scientificPixels(item,{sample,spacing,confidence,style,bounds,size:imageSize,signal:taskSignal,terrainContext});
   const c=document.createElement('canvas');c.width=c.height=imageSize;c.getContext('2d').putImageData(new ImageData(pixels,imageSize,imageSize),0,0);return c;
  },{persistent:item.engine==='reference'||z<=3,signal:taskSignal}),signal);
 }
 legend(){
  const item=this.item;$('science-legend').hidden=!item;if(!item)return;
  let key=$('geology-unit-key');if(!key){key=document.createElement('details');key.id='geology-unit-key';$('science-legend-note').before(key);}key.hidden=item.engine!=='geology';$('science-legend-ramp').nextElementSibling.hidden=item.engine==='geology';
  if(item.engine==='geology'){
   $('science-legend-title').textContent='USGS geologic map';$('science-legend-units').textContent='SIM 3292 · 1:20 million';$('science-legend-ramp').hidden=true;$('science-value').hidden=true;$('science-legend-note').textContent='Colors identify mapped units, not abundance or elevation. Relative periods: Noachian, Hesperian and Amazonian; mixed-age units remain mixed. Global interpretation, not local ground conditions.';
   key.replaceChildren();const summary=document.createElement('summary');summary.textContent=this.geologyLegend?'44 map units · color key':'Loading unit key…';key.append(summary);const list=document.createElement('ul');for(const unit of this.geologyLegend?.units??[]){const li=document.createElement('li'),swatch=document.createElement('i'),name=document.createElement('span');swatch.style.background=unit.color;swatch.setAttribute('aria-hidden','true');name.textContent=`${unit.code} · ${unit.name}`;li.append(swatch,name);list.append(li);}key.append(list);return;
  }
  const style=referenceStyle(item,this.grid);if(item.solar)style.note=`UTC ${item.solar.at} · measured DEM slope + horizon to 8 grid spacings; distant terrain shadows may be missed. No relief exaggeration in calculation.`;
  $('science-legend-title').textContent=style.title+(this.grid?.file.includes('-sigma.')?' · uncertainty':'');
  $('science-legend-units').textContent=this.grid?.units??item.units;
  const swim=this.grid?.file.startsWith('ice-'),depth=({'ice-0_1.f32.gz':'0–1 m','ice-1_5.f32.gz':'1–5 m','ice-5.f32.gz':'>5 m'})[this.grid?.file];
  $('science-legend-note').textContent=style.note??({confidence:'0: coarse MOLA · 1: HRSC/MOLA. Source tier, not statistical confidence.',landform:'0: depression · 1: level/intermediate · 2: ridge · 3: slope. Local terrain heuristic.',accessibility:'0: <5° · 1: 5–15° · 2: 15–30° · 3: ≥30°. Slope classes only.'})[item.metric]??(swim?`SWIM ${depth} sensing depth · 60°S–60°N only. Polar coverage: choose Global hydrogen. Original instrument boundaries may remain.`:item.engine==='reference'?'Published reference · smooth shading, original source-cell readout · transparent outside valid coverage':'Map-scale terrain derivative · source ≈200 m to ≈15 km; see layer details');
  if(this.grid?.valid_pixels<this.grid?.width*this.grid?.height)$('science-legend-note').textContent+=' '+(this.grid.units.startsWith('spectral fraction')?MINERAL_SURVEY_GAPS:
    this.grid.file==='thermal-inertia.f32.gz'?'Polar fill rows are masked. The delivered grid is sampled at 2 pixels per degree.':
    'Blank strips and polar gaps are missing source retrievals, not zero values. Zoom cannot create finer source detail.');
  if(item.min<0&&item.max>0&&/curvature|gravity|magnetic/.test(item.id))$('science-legend-note').textContent+=' Fixed nonlinear color stretch emphasizes small variations; readouts retain original units.';
  renderOverlayScale($('science-legend-ramp'),$('science-legend-ramp').nextElementSibling,item.id,style.min,style.max);
 }
}

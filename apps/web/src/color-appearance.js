import {BASE_URL,CTX_URL,CTX_CREDIT} from './planet.js';
import {planetImageryProvider} from './context-display.js';
import {PlanetImageLayer} from './context-imagery.js';
import {globeDetailWeight,flatDetailWeight} from './overview-policy.js';
export const COLOR_CREDIT='NASA Ames / USGS · Viking MDIM 2.1 colorized mosaic · ≈232 m photographic base; coarser color';
const COLOR_GRADE={brightness:1.045,contrast:1.065,saturation:1.26};
const ORIGINAL_COLOR={brightness:1,contrast:1,saturation:1};
const DETAIL_CREDIT=CTX_CREDIT+' · Viking-based display tint';
export class ColorAppearance{
 constructor(viewer,maps,{onReady=()=>{}}={}){
  this.viewer=viewer;this.maps=maps;const C=window.Cesium;
  this.providers=[0,7].map(level=>{const pixels=level?256:2048,p=planetImageryProvider(C,{url:level?BASE_URL:'/color-overview-{x}.jpg',tilingScheme:new C.GeographicTilingScheme({ellipsoid:viewer.scene.globe.ellipsoid}),tileWidth:pixels,tileHeight:pixels,maximumLevel:level,credit:COLOR_CREDIT},{source:level?'Viking colorized':'Viking color overview',nativeMeters:232,onReady});p.displayLayer=viewer.imageryLayers.addImageryProvider(p);p.displayLayer.show=false;return p;});
  // Grade the color imagery as one stack, below scientific layers and map marks.
  this.colorPanes=maps.map(map=>{
   const pane=map.createPane('vikingColor');
   pane.style.zIndex='201';
   pane.style.pointerEvents='none';
   return pane;
  });
  this.flat=maps.map(()=>[0,7].map(level=>new PlanetImageLayer({pane:'vikingColor',url:level?BASE_URL:'/color-overview-{x}.jpg',tilePixels:level?256:2048,source:level?'Viking colorized':'Viking color overview',nativeMeters:232,maxNativeZoom:level,maxZoom:23,noWrap:false,keepBuffer:1,attribution:COLOR_CREDIT})));for(const group of this.flat)for(const p of group)p.on('tileload',onReady);
  const detail={source:'CTX · Viking tint',nativeMeters:5,colourReference:BASE_URL,reuseDetail:false,minimumSourceLevel:8,immediateFallback:true};
  this.detail=planetImageryProvider(C,{url:CTX_URL,tilingScheme:new C.GeographicTilingScheme({ellipsoid:viewer.scene.globe.ellipsoid}),rectangle:C.Rectangle.fromDegrees(-180,-88,180,88),tileWidth:512,tileHeight:512,maximumLevel:12,credit:DETAIL_CREDIT},{...detail,sharedImages:true,onReady});
  this.detailLayer=new C.ImageryLayer(this.detail,{show:false,minimumTerrainLevel:8});viewer.imageryLayers.add(this.detailLayer);
  this.flatDetail=maps.map(()=>new PlanetImageLayer({...detail,pane:'vikingColor',url:CTX_URL,tilePixels:512,minZoom:8,minNativeZoom:8,maxNativeZoom:12,maxZoom:23,noWrap:false,keepBuffer:1,zIndex:3,attribution:DETAIL_CREDIT}).on('tileload',onReady));
  viewer.scene.preRender.addEventListener(()=>this.update());maps.forEach((m,i)=>m.on('zoomend',()=>this.updateFlat(i)));
 }
 setEnhanced(enabled){
  const grade=enabled?COLOR_GRADE:ORIGINAL_COLOR;
  for(const provider of this.providers)Object.assign(provider.displayLayer,grade);
  Object.assign(this.detailLayer,grade);
  const filter=enabled?`brightness(${grade.brightness}) contrast(${grade.contrast}) saturate(${grade.saturation})`:'';
  for(const pane of this.colorPanes)pane.style.filter=filter;
  this.grade={grade,filter};
  this.viewer.scene.requestRender();
 }
 setVisible(show){this.visible=show;this.detailLayer.show=show;this.weight=undefined;this.update();this.flat.forEach((_,i)=>this.updateFlat(i));this.viewer.scene.requestRender();}
 update(){const weight=globeDetailWeight(this.viewer.camera.positionCartographic.height);if(this.weight===weight)return;this.weight=weight;this.providers.forEach((p,i)=>{// Warm the two complete color roots without requesting hidden fine tiles.
  p.displayLayer.show=i===0||Boolean(this.visible)&&weight>0;p.displayLayer.alpha=i?weight:this.visible?1:0;});}
 updateFlat(index){const weight=flatDetailWeight(this.maps[index].getZoom());this.flat[index].forEach((p,i)=>{if(this.visible&&(i===0||weight>0))p.addTo(this.maps[index]);else p.remove();p.setOpacity(i?weight:1);});if(this.visible)this.flatDetail[index].addTo(this.maps[index]);else this.flatDetail[index].remove();}
 qualityAt(point,mapIndex){let source=mapIndex===undefined?this.providers:this.flat[mapIndex];const weight=mapIndex===undefined?this.weight:flatDetailWeight(this.maps[mapIndex].getZoom());if(weight<.5)source=source.slice(0,1);const detail=mapIndex===undefined?this.detail:this.flatDetail[mapIndex];return [...source,detail].map(p=>p.qualityAt(...point)).filter(Boolean).sort((a,b)=>a.metres-b.metres)[0];}
}

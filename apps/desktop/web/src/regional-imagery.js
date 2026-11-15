import {planetImageryProvider} from './context-display.js';
import {PlanetImageLayer} from './context-imagery.js';
import {REGIONAL_IMAGERY,regionalTileUrl} from './regional-sources.js';

export class RegionalImagery{
 constructor(viewer,maps,{base,onReady=()=>{}}={}){
  Object.assign(this,{viewer,maps});
  const C=window.Cesium,scheme=new C.GeographicTilingScheme({ellipsoid:viewer.scene.globe.ellipsoid});
  this.groups=new Map();
  function config(mode){return mode==='color'?{colourReference:base}:{};}
  this.createGroup=mode=>Object.entries(REGIONAL_IMAGERY).map(([id,source])=>{
   const url=regionalTileUrl(id),[west,south,east,north]=source.bounds;
   const display={...config(mode),source:source.name,nativeMeters:source.metres,reuseDetail:false,minimumSourceLevel:source.min,immediateFallback:true};
   const credit=`NASA/JPL · Mars Trek ${source.name}${mode==='color'?' · Viking-based display tint':''}`;
   const globe=planetImageryProvider(C,{url,tilingScheme:scheme,rectangle:C.Rectangle.fromDegrees(...source.bounds),tileWidth:256,tileHeight:256,maximumLevel:source.max,credit},{...display,sharedImages:true,onReady});
   const layer=new C.ImageryLayer(globe,{show:false,minimumTerrainLevel:source.min});
   viewer.imageryLayers.add(layer);
   const flat=maps.map((map,i)=>{
    const result=new PlanetImageLayer({...display,url,pane:this.panes[i],tilePixels:256,minNativeZoom:source.min,maxNativeZoom:source.max,maxZoom:23,minZoom:source.min,noWrap:true,bounds:[[south,west],[north,east]],keepBuffer:1,zIndex:source.min,attribution:credit});
    result.on('tileload',onReady);return result;
   });
   return {layer,globe,flat};
  });
  this.panes=maps.map((map,index)=>{const name=`marsTrek${index}`,pane=map.createPane(name);pane.style.zIndex='203';pane.style.pointerEvents='none';return name;});
  for(const mode of ['grayscale','color'])this.groups.set(mode,this.createGroup(mode));
 }
 setMode(mode){
  if(this.mode===mode)return;
  this.mode=mode;
  for(const [key,group] of this.groups)if(key!==mode)for(const {layer,flat} of group){layer.show=false;flat.forEach(p=>p.remove());}
  if(mode)for(const {layer,flat} of this.groups.get(mode)){layer.show=true;flat.forEach((p,i)=>p.addTo(this.maps[i]));}
  this.viewer.scene.requestRender();
 }
 qualityAt(point,mapIndex){return (this.groups.get(this.mode)??[]).map(p=>(mapIndex===undefined?p.globe:p.flat[mapIndex]).qualityAt(...point)).filter(Boolean).sort((a,b)=>a.metres-b.metres)[0];}
 setGrade(grade,filter){for(const {layer} of this.groups.get('color'))Object.assign(layer,grade);for(const [i,map] of this.maps.entries())map.getPane(this.panes[i]).style.filter=filter;}
}

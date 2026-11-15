import {knownTerrainHeight} from './planet.js';
import {reticlePoint,clientPoint} from './view-focus.js';

export function normalizedPoint(point){
 if(!Array.isArray(point)||!Number.isFinite(point[0])||!Number.isFinite(point[1])||Math.abs(point[1])>90)return null;
 return [((point[0]+180)%360+360)%360-180,point[1]];
}
export function coordinateText(point){
 const p=normalizedPoint(point);if(!p)return '—';
 const [lon,lat]=p;return `${Math.abs(lat).toFixed(5)}°${lat>=0?'N':'S'} · ${Math.abs(lon).toFixed(5)}°${lon>=0?'E':'W'}`;
}
export function spacingText(value){
 if(!Number.isFinite(value)||value<=0)return 'unknown';
 return value>=1000?`${(value/1000).toFixed(value>=10000?1:2)} km`:`${value.toFixed(value<10?2:0)} m`;
}
export function elevationText(value){
 if(!Number.isFinite(value))return 'Elevation unavailable';
 const magnitude=Math.abs(value).toLocaleString('en',{maximumFractionDigits:0});
 return `Elev. ≈ ${value<0?'−':value>0?'+':''}${magnitude} m`;
}
export function sourceTerrain(point,surface,provider,fallback=knownTerrainHeight){
 const p=normalizedPoint(point);if(!p)return null;
 const q=surface?.qualityAt?.(...p),height=surface?.sourceElevation?.(...p);
 // Never use displayed Cartesian height: the terrain may be exaggerated 3×.
 if(Number.isFinite(height)&&q&&q.nativeTerrain!==false&&!q.terrainTransition)return {height,source:'HiRISE DEM',spacing:q.terrain};
 const value=fallback(...p,provider);
 return Number.isFinite(value?.height)?value:null;
}
export function loadedImage({native,overview,color,providers=[],polar=false}={}){
 if(color)return Number.isFinite(color.metres)&&color.metres>0?color:null;
 if(Number.isFinite(native?.imagery)&&native.imagery>0)return {source:'HiRISE',metres:native.imagery};
 if(overview)return overview;
 return providers.filter(q=>Number.isFinite(q?.metres)&&q.metres>0&&(!polar||q.source!=='CTX')).sort((a,b)=>a.metres-b.metres)[0]??null;
}
const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};

export class SurfaceReadout{
 constructor(viewer,map,{view,focus,active,surface,imageAt,pickPreview}={}){
  Object.assign(this,{viewer,map,view,focus,active,surface,imageAt,pickPreview});
  const panel=this.panel=document.createElement('section');panel.id='surface-readout';panel.setAttribute('aria-label','Surface coordinates and loaded resolution');
  panel.innerHTML='<div class="surface-coordinate-row"><span id="surface-centre-label" class="surface-readout-label">Centre</span><output id="surface-centre">Locating surface…</output></div><div class="surface-coordinate-row"><span id="surface-cursor-label" class="surface-readout-label">Cursor</span><div><output id="surface-cursor">Move over the map</output><output id="surface-cursor-height">Elevation above Mars datum</output></div></div><div class="surface-quality-row"><span class="surface-readout-label">Loaded</span><div><output id="surface-image-quality">Loading imagery…</output><output id="surface-terrain-quality">Terrain sampling unknown</output><output id="surface-relief-scale"></output></div></div>';
  panel.title='Planetocentric latitude · east/west longitude. Elevation uses physical source DEM heights, not display exaggeration. Loaded spacing describes detail, not positional accuracy. Resolution is sampled at the view centre.';
  document.getElementById('workspace').append(panel);
  this.nodes=Object.fromEntries([...panel.querySelectorAll('[id]')].map(n=>[n.id,n]));
  for(const output of panel.querySelectorAll('output'))output.setAttribute('aria-live','off');
  this.resize=new ResizeObserver(()=>{document.getElementById('workspace').style.setProperty('--surface-readout-height',panel.offsetHeight+'px');});this.resize.observe(panel);
  this.move3D=e=>{this.pointer={kind:'3d',...clientPoint(viewer.canvas,e.clientX,e.clientY),touch:e.pointerType==='touch'};this.schedule();};
  this.leave3D=e=>{if(e.pointerType!=='touch'){this.pointer=null;this.schedule();}};
  viewer.canvas.addEventListener('pointermove',this.move3D);viewer.canvas.addEventListener('pointerup',this.move3D);viewer.canvas.addEventListener('pointerleave',this.leave3D);
  this.moveFlat=e=>{this.pointer={kind:'2d',x:e.containerPoint.x,y:e.containerPoint.y,touch:e.originalEvent?.pointerType==='touch'||e.originalEvent?.type?.startsWith('touch')};this.schedule();};
  this.leaveFlat=()=>{if(!this.pointer?.touch){this.pointer=null;this.schedule();}};
  map.on('mousemove click',this.moveFlat);map.on('mouseout',this.leaveFlat);map.on('move zoom tileload',()=>this.schedule());
  this.tick=()=>{if(performance.now()-(this.last??-1000)>250)this.update();};
  this.removeRender=viewer.scene.postRender.addEventListener(this.tick);this.timer=setInterval(this.tick,500);this.update();
 }
 schedule(){if(!this.pending)this.pending=setTimeout(()=>{this.pending=null;this.update();},60);}
 pick3D(x,y){
  const C=window.Cesium,scene=this.viewer.scene,camera=this.viewer.camera,screen=new C.Cartesian2(x,y);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>this.viewer.canvas.clientWidth||y>this.viewer.canvas.clientHeight)return null;
  let hit;
  try{hit=this.pickPreview?.(screen);const ray=camera.getPickRay(screen);hit??=(ray?scene.globe.pick(ray,scene):null)??camera.pickEllipsoid(screen,scene.globe.ellipsoid);}catch{return null;}
  if(!hit)return null;
  const p=scene.globe.ellipsoid.cartesianToCartographic(hit);
  return normalizedPoint([C.Math.toDegrees(p.longitude),C.Math.toDegrees(p.latitude)]);
 }
 update(){
  this.last=performance.now();this.panel.hidden=!this.active();if(this.panel.hidden)return;
  const flat=this.view()==='2d',screen=reticlePoint(this.viewer.canvas),centre=this.focus?normalizedPoint(this.focus()?.point):flat?normalizedPoint([this.map.getCenter().lng,this.map.getCenter().lat]):this.pick3D(screen.x,screen.y);
  setText(this.nodes['surface-centre-label'],this.view()==='split'?'3D crosshair':'Crosshair');
  setText(this.nodes['surface-centre'],centre?coordinateText(centre):'Above the horizon');
  let point=null;const p=this.pointer;
  if(p&&(p.kind==='2d'?this.view()!=='3d':!flat)){
   if(p.kind==='2d'){const c=this.map.containerPointToLatLng([p.x,p.y]);point=normalizedPoint([c.lng,c.lat]);}
   else point=this.pick3D(p.x,p.y);
  }
  setText(this.nodes['surface-cursor-label'],p?.touch?'Touch':'Cursor');
  setText(this.nodes['surface-cursor'],point?coordinateText(point):p?'No surface under cursor':'Move over the map');
  const terrain=point?sourceTerrain(point,this.surface(),this.viewer.terrainProvider):null;
  setText(this.nodes['surface-cursor-height'],point?terrain?`${elevationText(terrain.height)} · Mars datum`:'Elevation unavailable':'Elevation above Mars datum');
  this.nodes['surface-cursor-height'].title=terrain?`${terrain.source} · ${spacingText(terrain.spacing)} sampling. Approximate source DEM elevation, independent of display exaggeration.`:'Move or tap on the surface. Missing heights remain unknown.';
  this.nodes['surface-cursor-height'].setAttribute('aria-label',terrain?`${elevationText(terrain.height)} above Mars datum. ${terrain.source}, ${spacingText(terrain.spacing)} sampling.`:'Source elevation unavailable');
  const image=centre?this.imageAt(centre):null,ground=centre?sourceTerrain(centre,this.surface(),this.viewer.terrainProvider):null;
  setText(this.nodes['surface-image-quality'],image?`${image.source} · ≈${spacingText(image.metres)} / px`:'No loaded imagery at centre');
  setText(this.nodes['surface-terrain-quality'],ground?`Terrain · ${ground.source} · ≈${spacingText(ground.spacing)} grid`:'Terrain sampling unavailable');
  setText(this.nodes['surface-relief-scale'],flat?'2D · relief shown in 3D only':this.viewer.scene.verticalExaggeration===1?'Relief · true scale (1×)':'Relief · enhanced 3× · display only');
  this.panel.dataset.imageSource=image?.source??'unknown';
 }
}

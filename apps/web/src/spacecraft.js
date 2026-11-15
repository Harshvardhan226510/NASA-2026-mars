import L from 'leaflet';
import {hasSurfacePosition,positionSummary,trackLines,SPACECRAFT_FEEDS} from './spacecraft-data.js';
import {requestModelReady,loadMarsModel} from './spacecraft-model.js';
import {SpacecraftTerrainModels} from './spacecraft-models.js';
import {ORBITERS} from './orbiter-data.js';
import {mapPinSVG,mapLabel,PIN_SIZE,PIN_ANCHOR} from './map-marker-style.js';
import {appendSpacecraftHistory,fetchOdometers,mergeOdometers} from './spacecraft-history.js';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const kindName=x=>({rover:'Rover',helicopter:'Helicopter',lander:'Lander',landing_platform:'Landing platform',failed_lander:'Impact site',failed_or_unlocated_surface_hardware:'Probe / unlocated',orbiter:'Orbiter'})[x]??x;
const date=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString(undefined,{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})+' UTC':value??'Not supplied';
function link(text,href){const a=el('a',text);if(/^https:\/\//.test(href??'')){a.href=href;a.target='_blank';a.rel='noopener';}return a;}
function pointText(l){return `${Math.abs(l.lat_planetocentric).toFixed(5)}°${l.lat_planetocentric>=0?'N':'S'} · ${Math.abs(l.lon_east).toFixed(5)}°${l.lon_east>=0?'E':'W'}`;}
export const spacecraftIcon=mapPinSVG;

export class SpacecraftLayer{
 constructor(viewer,map,mini,{view,beforeFly,show3D,ensureVisible,onOpen,onFlatPick,qualityAt}={}){
  this.viewer=viewer;this.maps=[map,mini];this.view=view;this.beforeFly=beforeFly;this.show3D=show3D;this.ensureVisible=ensureVisible;this.onOpen=onOpen;this.onFlatPick=onFlatPick;this.items=[];this.models=[];this.markers=new Map();this.trackCache=new Map();this.scope='surface';this.visible=true;this.tracksVisible=false;this.trackVersion=0;this.modelVersion=0;this.previewVersion=0;
  const C=window.Cesium;this.source=new C.CustomDataSource('Mars spacecraft');this.trackSource=new C.CustomDataSource('Recorded spacecraft tracks');viewer.dataSources.add(this.source);viewer.dataSources.add(this.trackSource);
  this.source.clustering.enabled=true;this.source.clustering.pixelRange=28;this.source.clustering.minimumClusterSize=3;
  this.source.clustering.clusterEvent.addEventListener((entities,cluster)=>{cluster.label.text=String(entities.length);cluster.label.font='bold 13px sans-serif';cluster.label.fillColor=C.Color.fromCssColorString('#ffe2a1');cluster.label.outlineColor=C.Color.BLACK;cluster.label.outlineWidth=4;cluster.label.style=C.LabelStyle.FILL_AND_OUTLINE;cluster.billboard.image=spacecraftIcon('lander');cluster.billboard.width=36;cluster.billboard.height=36;});
  this.flatGroups=this.maps.map(()=>L.layerGroup());this.flatTracks=this.maps.map(()=>L.layerGroup());
  this.autoModels=true;try{this.autoModels=localStorage.getItem('mars-field-atlas-spacecraft-models-v1')!=='false';}catch{}
  const modelLabel=el('label',undefined,'spacecraft-track-switch'),modelToggle=this.modelToggle=el('input');modelToggle.id='spacecraft-auto-models';modelToggle.type='checkbox';modelToggle.checked=this.autoModels;modelLabel.append(modelToggle,el('span','3D models on detailed terrain'));$('spacecraft-track-toggle').parentElement.before(modelLabel);
  modelLabel.after(el('p','Spacecraft models are enlarged for visibility and are not shown at their true scale relative to Mars.','spacecraft-note'));
  modelToggle.onchange=()=>{this.autoModels=modelToggle.checked;try{localStorage.setItem('mars-field-atlas-spacecraft-models-v1',String(this.autoModels));}catch{}this.terrainModels.update();this.syncModelMarkers();};
  this.terrainModels=new SpacecraftTerrainModels(viewer,{qualityAt,view:()=>this.view?.()??'3d',enabled:()=>this.visible&&this.autoModels,accepts:item=>this.accepts(item),modelFor:item=>this.modelFor(item),items:()=>this.items,onChange:()=>this.syncModelMarkers()});
  $('spacecraft-search').oninput=()=>this.list();$('spacecraft-kind').onchange=()=>{if($('spacecraft-kind').value==='orbiter')this.scope='orbit';else if(this.scope==='orbit'&&$('spacecraft-kind').value!=='all')this.scope='surface';this.list();this.applyVisibility();};
  for(const b of document.querySelectorAll('[data-spacecraft-scope]'))b.onclick=()=>{this.scope=b.dataset.spacecraftScope;$('spacecraft-kind').value='all';this.list();this.applyVisibility();};
  $('spacecraft-open').onclick=()=>this.openDirectory();$('spacecraft-layer-open').onclick=()=>this.openDirectory();
  $('spacecraft-update').onclick=()=>this.refresh();$('spacecraft-track-toggle').onchange=()=>{this.tracksVisible=$('spacecraft-track-toggle').checked;this.updateTrack();};
  const dialog=$('spacecraft-model-dialog');$('spacecraft-model-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>this.closePreview());
  $('spacecraft-model-place').onclick=()=>{dialog.close();this.showModelOnTerrain();};
  this.heartbeat=setInterval(()=>{if(!document.hidden)this.refresh();},21600000);
 }
 async load(){
  try{const r=await fetch('/spacecraft/catalog.json');if(!r.ok)throw new Error('Spacecraft catalogue unavailable');const c=await r.json();if(c.schema!=='mars-spacecraft-catalog/1'||!Array.isArray(c.objects))throw new Error('Invalid spacecraft catalogue');this.items=c.objects;this.models=c.models;this.rebuildMarkers();this.list();this.refresh();}
  catch{$('spacecraft-count').textContent='Spacecraft catalogue could not load. Reload the page to try again.';}
 }
 openDirectory(){
  this.onOpen?.();
  $('directory').hidden=false;$('detail').hidden=true;$('value-info').hidden=true;$('place-type').value='spacecraft';$('place-type').dispatchEvent(new Event('change'));
  $('title').textContent='Spacecraft on Mars';$('category').textContent='EXPLORATION HISTORY';$('description').textContent='Find rovers, landers and probes, inspect NASA models, and follow recorded journeys.';
  if(document.body.classList.contains('sidebar-collapsed'))$('sidebar-toggle').click();$('sidebar').scrollTop=0;
 }
 modelFor(item){return this.models.find(m=>item.model_ids?.includes(m.id));}
 list(){
  const q=$('spacecraft-search').value.trim().toLowerCase(),kind=$('spacecraft-kind').value;
  for(const b of document.querySelectorAll('[data-spacecraft-scope]'))b.setAttribute('aria-pressed',String(b.dataset.spacecraftScope===this.scope));
  const found=this.items.filter(x=>(this.scope==='all'||(this.scope==='orbit')===(x.kind==='orbiter'))&&(kind==='all'||x.kind===kind)&&`${x.name} ${x.kind}`.toLowerCase().includes(q));
  const located=this.items.filter(hasSurfacePosition).length;$('spacecraft-count').textContent=`${found.length} results · ${located} sourced surface positions · ${this.items.length} catalogued objects`;
  $('spacecraft-list').replaceChildren(...found.map(item=>{const b=el('button',undefined,'region-row');b.setAttribute('aria-label','Select spacecraft '+item.name);b.setAttribute('aria-pressed',String(item.id===this.selected?.id));const copy=el('span');copy.append(el('strong',item.name),el('small',kindName(item.kind)+' · '+(hasSurfacePosition(item)?'Mapped':ORBITERS[item.id]?'Dated orbit':item.kind==='orbiter'?'Orbit not plotted':'Unlocated')));b.append(copy,el('span',hasSurfacePosition(item)?'↗':'→'));b.onclick=()=>this.select(item.id);return b;}));
 }
 accepts(item){const kind=$('spacecraft-kind').value;return (this.scope==='all'||(this.scope==='orbit')===(item.kind==='orbiter'))&&(kind==='all'||kind===item.kind);}
 rebuildMarkers(){
  const C=window.Cesium;this.source.entities.removeAll();this.markers.clear();for(const group of this.flatGroups)group.clearLayers();
  for(const item of this.items.filter(hasSurfacePosition)){
   const l=item.location,image=spacecraftIcon(item.kind),e=this.source.entities.add({id:'spacecraft-'+item.id,position:C.Cartesian3.fromDegrees(l.lon_east,l.lat_planetocentric,0,this.viewer.scene.globe.ellipsoid),billboard:{image,width:PIN_SIZE[0],height:PIN_SIZE[1],heightReference:C.HeightReference.CLAMP_TO_GROUND,verticalOrigin:C.VerticalOrigin.BOTTOM},label:mapLabel(C,{text:item.name,pixelOffset:new C.Cartesian2(0,-53),heightReference:C.HeightReference.CLAMP_TO_GROUND,distanceDisplayCondition:new C.DistanceDisplayCondition(0,250000)})});e.spacecraftId=item.id;
   const flat=this.maps.map((map,i)=>{const marker=L.marker([l.lat_planetocentric,l.lon_east],{icon:L.icon({iconUrl:image,iconSize:PIN_SIZE,iconAnchor:PIN_ANCHOR,className:'spacecraft-pin'}),title:item.name,alt:item.name+' spacecraft location',bubblingMouseEvents:false});marker.bindTooltip(item.name,{className:'spacecraft-tooltip',direction:'top',offset:[0,-37]});marker.on('click',event=>{const point={...event,latlng:marker.getLatLng(),containerPoint:map.latLngToContainerPoint(marker.getLatLng())};if(!this.onFlatPick?.(point))this.select(item.id);});this.flatGroups[i].addLayer(marker);return marker;});this.markers.set(item.id,{entity:e,flat});
  }this.applyVisibility();
 }
 setLayerVisibility(state){this.visible=Boolean(state.spacecraft);this.applyVisibility();}
 applyVisibility(){
  const selectedVisible=this.visible&&(!this.selected||this.accepts(this.selected));this.source.show=this.visible;this.trackSource.show=selectedVisible&&this.tracksVisible;
  const C=window.Cesium;
  for(const [id,m] of this.markers){const show=this.visible&&this.accepts(this.items.find(x=>x.id===id));m.entity.show=show;m.entity.label.distanceDisplayCondition=new C.DistanceDisplayCondition(0,250000);for(let i=0;i<this.maps.length;i++){if(show)this.flatGroups[i].addLayer(m.flat[i]);else this.flatGroups[i].removeLayer(m.flat[i]);}}
  for(let i=0;i<this.maps.length;i++){const m=this.maps[i];if(this.visible){this.flatGroups[i].addTo(m);if(this.tracksVisible&&selectedVisible)this.flatTracks[i].addTo(m);else this.flatTracks[i].remove();}else{this.flatGroups[i].remove();this.flatTracks[i].remove();}}
  if(!this.visible)this.terrainModels?.update();else this.terrainModels?.schedule();this.syncModelMarkers();this.viewer.scene.requestRender();
 }
 scheduleModels(){this.terrainModels?.schedule();}
 syncModelMarkers(){
  for(const [id,m] of this.markers){const model=Boolean(this.terrainModels?.ready(id));m.entity.billboard.show=!model;m.entity.label.pixelOffset=new window.Cesium.Cartesian2(0,model?-32:-53);}
  $('legend-spacecraft').textContent=[...this.terrainModels?.pool.entries.values()??[]].some(e=>e.state==='ready')?'Spacecraft enlarged for visibility · not to scale with Mars':'◎ Spacecraft';
  this.renderModelState();this.viewer.scene.requestRender();
 }
 renderModelState(){
  if(!this.modelState||!this.selected||!this.modelFor(this.selected)||!hasSurfacePosition(this.selected))return;
  const state=this.terrainModels?.state(this.selected.id)??'waiting';this.modelState.dataset.state=state;
  const scale=Math.round(this.terrainModels?.pool.entries.get(this.selected.id)?.spec.scale??1);
  this.modelState.textContent=!this.visible||!this.autoModels?'Terrain models are hidden. Use the model switch above or View 3D model on map.':this.view?.()==='2d'?'The 2D map shows the location pin. Choose View 3D model on map for the terrain model.':state==='ready'?`3D model visible on terrain · enlarged ${scale}× for visibility; not to scale with Mars. Grows as you approach. Pose and map tie are approximate.`:state==='loading'||state==='queued'?'Loading 3D model on terrain…':state==='error'?'Terrain model could not load. The location pin remains available; use View 3D model on map to retry.':'The 3D model appears automatically when nearby CTX tiles reach ≈5.1 m. Zoom closer, or choose View 3D model on map.';
 }
 async refreshTravel(){
  if(this.travelRefreshing)return;this.travelRefreshing=true;
  try{this.travel=mergeOdometers(this.travel,await fetchOdometers());if(this.selected)this.renderDetails();}
  catch{/* Retain the last published distance when the independent odometer check fails. */}
  finally{this.travelRefreshing=false;}
 }
 async refresh(){
  this.refreshTravel();
  if(this.refreshing)return;this.refreshing=true;$('spacecraft-update').disabled=true;$('spacecraft-feed-state').textContent='Checking NASA’s published positions…';
  try{
   const r=await fetch('/api/spacecraft',{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error('Position refresh failed');const p=await r.json();if(p.schema!=='mars-spacecraft-positions/1')throw new Error('Unknown position response');
   for(const item of this.items)if(SPACECRAFT_FEEDS[item.id]){const l=p.positions?.[item.id];if(hasSurfacePosition({...item,location:l})&&Number.isInteger(l.sol)&&l.sol>=item.location.sol)item.location=l;}
   this.rebuildMarkers();this.list();if(this.selected)this.renderDetails();$('spacecraft-feed-state').textContent=p.health.state==='ok'?'NASA positions checked · refreshes every 6 hours. Latest published localizations, not live tracking.':'NASA refresh incomplete · retained sourced positions and their original record dates.';
  }catch{$('spacecraft-feed-state').textContent='NASA refresh unavailable · showing the last sourced positions with their original record dates.';}
  finally{this.refreshing=false;$('spacecraft-update').disabled=false;}
 }
 select(id,{fly=true}={}){
  const item=this.items.find(x=>x.id===id);if(!item)return;if(fly&&!this.modelFor(item))this.clearTerrainModel();this.selected=item;if(!this.accepts(item)){this.scope=item.kind==='orbiter'?'orbit':'surface';$('spacecraft-kind').value='all';}this.openDirectory();this.list();this.renderDetails();this.ensureVisible?.();
  if(item.track){this.tracksVisible=true;if($('spacecraft-track-toggle'))$('spacecraft-track-toggle').checked=true;}
  this.updateTrack();
  history.replaceState(null,'',location.pathname+location.search+'#spacecraft='+encodeURIComponent(id));
  if(fly&&hasSurfacePosition(item)){
   if(this.modelFor(item)){this.autoModels=true;if(this.modelToggle)this.modelToggle.checked=true;this.terrainModels.focus(item);}
   this.fly(item,2500);
  }else if(fly&&ORBITERS[item.id]){
   this.orbitalView?.(item.id);
  }
 }
 clearSelection(){this.selected=null;this.clearTerrainModel();this.trackVersion++;this.trackSource.entities.removeAll();for(const g of this.flatTracks)g.clearLayers();$('spacecraft-details').hidden=true;this.list();}
 fly(item,range=2500){
  if(!hasSurfacePosition(item))return;this.beforeFly?.();const C=window.Cesium,l=item.location;
  if(this.modelFor(item)){this.autoModels=true;if(this.modelToggle)this.modelToggle.checked=true;this.terrainModels.focus(item);}
  if(range<100)this.viewer.scene.screenSpaceCameraController.minimumZoomDistance=2;
  const height=this.viewer.scene.globe.getHeight(C.Cartographic.fromDegrees(l.lon_east,l.lat_planetocentric))??l.elevation_m??0,point=C.Cartesian3.fromDegrees(l.lon_east,l.lat_planetocentric,height,this.viewer.scene.globe.ellipsoid);
  this.viewer.camera.flyToBoundingSphere(new C.BoundingSphere(point,Math.max(3,range/3)),{duration:1.8,offset:new C.HeadingPitchRange(0,-.8,range)});
  for(const m of this.maps)m.setView([l.lat_planetocentric,l.lon_east],range<100?19:13,{animate:false});
 }
 renderDetails(){
  const item=this.selected;if(!item)return;const root=$('spacecraft-details');root.hidden=false;root.replaceChildren();root.dataset.spacecraft=item.id;
  root.append(el('span',kindName(item.kind),'spacecraft-badge'),el('span',ORBITERS[item.id]?'Dated trajectory service':item.status_label,'spacecraft-badge'),el('h3',item.name),el('p',ORBITERS[item.id]?'NASA/JPL geometric trajectory. Available dates depend on the mission solution.':positionSummary(item)));
  appendSpacecraftHistory(root,item,this.travel);
  const dl=el('dl'),detail=(k,v)=>dl.append(el('dt',k),el('dd',v));const l=item.location;
  if(hasSurfacePosition(item)){detail('Planetocentric · east-positive',pointText(l));detail('Placement accuracy','Source map tie; numerical uncertainty not supplied. Coordinate decimals do not establish metre accuracy.');if(l.retrieved_at)detail('Source checked',date(l.retrieved_at));if(l.file_last_modified)detail('Source file modified',date(l.file_last_modified)+' · not an observation time');if(l.record_id)detail('Drive record',l.record_id);if(l.update_state==='cached_fallback'){const p=el('p','Latest check failed · retained last sourced position.');p.dataset.state='fallback';root.append(p);}}
  else detail('Location',ORBITERS[item.id]?'Open the dated orbit to see its source-covered position and shared animation controls.':item.kind==='orbiter'?'A valid timestamped ephemeris is needed. No orbital point or track has been invented.':'A separate final global position has not been verified. This object has no surface pin.');
  root.append(dl);const actions=el('div',undefined,'spacecraft-actions');
  if(hasSurfacePosition(item)){const fly=el('button','Go to location ↗');fly.onclick=()=>this.fly(item);actions.append(fly);}
  else if(ORBITERS[item.id]){const orbit=el('button','View dated orbit ↗');orbit.onclick=()=>this.orbitalView?.(item.id);actions.append(orbit);}
  else if(l?.site_reference){const vicinity=el('button','Visit landing-site vicinity ↗');vicinity.onclick=()=>this.fly({...item,location:l.site_reference});actions.append(vicinity);root.append(el('p','The vicinity link visits the published landing site, not this rover’s final position.','spacecraft-note'));}
  const model=this.modelFor(item);if(model){if(hasSurfacePosition(item)){const terrain=el('button','View 3D model on map');terrain.onclick=()=>this.showModelOnTerrain(item,model);actions.append(terrain);}const button=el('button','Inspect NASA 3D model');button.onclick=()=>this.inspectModel(model,item);actions.append(button);}else root.append(el('p','No verified, reusable 3D model is available for this object.','spacecraft-note'));
  root.append(actions);if(item.track){const label=el('label',undefined,'spacecraft-track-switch'),input=el('input');input.type='checkbox';input.checked=this.tracksVisible;input.onchange=()=>{$('spacecraft-track-toggle').checked=input.checked;this.tracksVisible=input.checked;this.updateTrack();};label.append(input,el('span',item.id==='ingenuity'?'Recorded flight paths':'Recorded traverse'));root.append(label);}
  this.trackState=el('p',undefined,'spacecraft-note');this.modelState=el('p',undefined,'spacecraft-model-state');this.modelState.setAttribute('role','status');root.append(this.modelState,this.trackState);this.renderModelState();
  const notes=el('details'),summary=el('summary','Sources & placement notes');notes.append(summary,el('p',item.notes));const sources=[l?.source,l?.site_reference?.source,l?.orbital_localization_source,item.source,item.track?.source].filter((v,i,a)=>v&&a.indexOf(v)===i);for(const [i,url] of sources.entries())notes.append(link('Location / mission source '+(i+1)+' ↗',url),el('br'));
  if(ORBITERS[item.id])notes.append(link('NASA/JPL spacecraft trajectories ↗','https://ssd.jpl.nasa.gov/horizons/'),el('br'));if(model)notes.append(el('p',model.credit),link('NASA model source ↗',model.source_page),el('br'),link('NASA media-use guidance ↗',model.terms_url));root.append(notes);
 }
 async updateTrack(){
  const version=++this.trackVersion,item=this.selected;this.trackSource.entities.removeAll();for(const g of this.flatTracks)g.clearLayers();this.applyVisibility();if(!this.tracksVisible||!item?.track)return;
  if(this.trackState)this.trackState.textContent='Loading recorded path…';
  try{
   let p=this.trackCache.get(item.id);if(!p){const r=await fetch(item.track.url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error('Track unavailable');p=await r.json();this.trackCache.set(item.id,p);}if(version!==this.trackVersion)return;
   const lines=trackLines(p.data),C=window.Cesium,color=C.Color.fromCssColorString('#ffd28a');
   for(const line of lines)this.trackSource.entities.add({polyline:{positions:C.Cartesian3.fromDegreesArray(line.flat(),this.viewer.scene.globe.ellipsoid),arcType:C.ArcType.RHUMB,clampToGround:true,width:3,material:color}});
   for(const g of this.flatTracks)L.polyline(lines.map(line=>line.map(c=>[c[1],c[0]])),{color:'#ffd28a',weight:3,interactive:false}).addTo(g);
   if(this.trackState)this.trackState.textContent='Recorded path · source checked '+date(p.retrieved_at)+'. '+(p.note??'Source gaps are retained. Track and current-position feeds may update at different times.');this.applyVisibility();
  }catch{if(version===this.trackVersion&&this.trackState)this.trackState.textContent='Recorded path could not load. Toggle it to retry.';}
 }
 async inspectModel(model,item){
  const dialog=$('spacecraft-model-dialog');if(dialog.open)dialog.close();const version=++this.previewVersion;this.previousFocus=document.activeElement;this.previewItem=item;this.previewModel=model;
  $('spacecraft-model-title').textContent=item.name+' · NASA model';$('spacecraft-model-status').textContent='Loading NASA model…';$('spacecraft-model-stage').dataset.state='loading';
  $('spacecraft-model-note').textContent='Reference artwork · pose, orientation and condition are illustrative. Drag to rotate; wheel or pinch to zoom. '+model.scale_note;
  $('spacecraft-model-credit').replaceChildren(el('span',model.credit.split(';')[0]+' · '),link('Original NASA asset ↗',model.source_page),el('span',' · '),link('Media-use guidance ↗',model.terms_url));
  $('spacecraft-model-place').hidden=!hasSurfacePosition(item);$('spacecraft-model-place').disabled=true;dialog.showModal();
  const C=window.Cesium,ellipsoid=this.viewer.scene.globe.ellipsoid,origin=new C.Cartesian3(ellipsoid.maximumRadius,0,0);
  try{
   const stage=this.previewViewer=new C.Viewer('spacecraft-model-stage',{globe:false,ellipsoid,baseLayer:false,skyBox:false,skyAtmosphere:false,animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,navigationHelpButton:false,sceneModePicker:false,fullscreenButton:false,selectionIndicator:false,infoBox:false,requestRenderMode:true,showRenderLoopErrors:false});
   stage.scene.backgroundColor=C.Color.fromCssColorString('#111d28');stage.scene.light=new C.DirectionalLight({direction:new C.Cartesian3(-1,-.5,-1),intensity:2});stage.scene.screenSpaceCameraController.enableTranslate=false;stage.scene.screenSpaceCameraController.enableLook=false;
   const renderFailure=()=>{if(version===this.previewVersion){$('spacecraft-model-status').textContent='This model could not render. Its map marker remains available.';$('spacecraft-model-stage').dataset.state='error';$('spacecraft-model-place').disabled=true;}};stage.scene.renderError.addEventListener(renderFailure);
   const anchor=C.Transforms.eastNorthUpToFixedFrame(origin,ellipsoid),radius=Math.max(...model.bounds_size)*.65;
   stage.camera.lookAt(origin,new C.HeadingPitchRange(.65,-.35,Math.max(2,radius*3)));
   const primitive=await loadMarsModel(C,{url:model.url,modelMatrix:anchor,minimumPixelSize:0,enableVerticalExaggeration:false,scene:stage.scene});
   if(version!==this.previewVersion){primitive.destroy();return;}stage.scene.primitives.add(primitive);primitive.errorEvent.addEventListener(renderFailure);
   this.cancelPreviewReady=requestModelReady(primitive,stage.scene,{current:()=>version===this.previewVersion,failed:renderFailure,ready:()=>{stage.camera.viewBoundingSphere(new C.BoundingSphere(primitive.boundingSphere.center,primitive.boundingSphere.radius*1.08),new C.HeadingPitchRange(.65,-.3,0));$('spacecraft-model-status').textContent='NASA model ready · reference view';$('spacecraft-model-stage').dataset.state='ready';$('spacecraft-model-place').disabled=false;stage.scene.requestRender();}});
  }catch{if(version===this.previewVersion){$('spacecraft-model-status').textContent='The NASA model could not load. Close this view and try again.';$('spacecraft-model-stage').dataset.state='error';}}
 }
 closePreview(){++this.previewVersion;this.cancelPreviewReady?.();if(this.previewViewer&&!this.previewViewer.isDestroyed())this.previewViewer.destroy();this.previewViewer=null;$('spacecraft-model-stage').replaceChildren();this.previousFocus?.focus({preventScroll:true});}
 clearTerrainModel(){this.terrainModels?.clearFocus();}
 showModelOnTerrain(item=this.previewItem,model=this.previewModel){
  if(!hasSurfacePosition(item)||!model)return;this.ensureVisible?.();this.autoModels=true;this.modelToggle.checked=true;try{localStorage.setItem('mars-field-atlas-spacecraft-models-v1','true');}catch{}
  const entry=this.terrainModels.pool.entries.get(item.id);if(entry?.state==='error')entry.retryAt=0;
  this.show3D?.();this.beforeFly?.();this.terrainModels.focus(item);this.terrainModels.frame(item);for(const m of this.maps)m.setView([item.location.lat_planetocentric,item.location.lon_east],16,{animate:false});this.renderModelState();
 }
}

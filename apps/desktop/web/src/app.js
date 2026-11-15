import {installSeismicReplay} from './desktop-field-ui.js';
import './desktop-field-ui.css';
import './point-inspector.css';
import {installPointTools} from './desktop-point-tools.js';
import './desktop-models.js';
import './desktop-mode.css';
import './desktop-voice.js';
import './desktop-manager.js';
import {desktopState,desktopOffline} from './desktop-mode.js';
import {CommsCoverage} from './comms-coverage.js';
import {GroundSky} from './ground-sky.js';
import {RoverGroundView} from './rover-ground-view.js';
import {protectTerrainPickBounds} from './terrain-mesh.js';
import {declaredCampPoint,evaluatedCampPoint,sameCampPoint,setCampDestination} from './mission-camp.js';
import {CampControls} from './camp-controls.js';
import {PerimeterTool} from './perimeter-tool.js';
import {stableGlobeDetail,imageryReadyCallback,GLOBE_OVERVIEW,CtxDetailPrefetch,mapLoadingMessage} from './globe-loading.js';
import {atlasDataDescription} from './atlas-context.js';
import {overviewElevation} from './planet.js';
import {TerrainRelief} from './terrain-relief.js';
import './style.css';
import './mission-tools.css';
import './scientific-overlays.css';
import './spacecraft.css';
import L from 'leaflet';
import {SurfaceRaster,R,closeRasters,intersects} from './raster.js';
import {Surface3D,spanMeters} from './surface.js';
import {measurementPositions} from './measurement-terrain.js';
import {MarsTerrain,CTX_URL,CTX_CREDIT,BASE_URL,BASE_CREDIT} from './planet.js';
import {CTXLayer,GrayscaleBaseLayer} from './context-imagery.js';
import {planetImageryProvider} from './context-display.js';
import {ContinuousSurface} from './continuous-surface.js';
import {recoverSurfaceRead,mapErrorMessage} from './recovery.js';
import {MapNavigation} from './navigation.js';
import {availableDetail,coverageText,inside} from './coverage.js';
import {displayTexture,prefetchDisplay} from './display-tiles.js';
import {RegionalImagery} from './regional-imagery.js';
import {CompareViews,zoomForGroundScale} from './compare.js';
import {ValueSites} from './value-sites.js';
import {UserSites} from './user-sites-ui.js';
import {PlaceContext,coordinateRegion,parseCoordinateSearch} from './place-context.js';
import {siteDatasets,aboveHorizon} from './value-geometry.js';
import {regionMarkerGraphics,sharpenMap} from './map-marker-style.js';
import {MeasureTool} from './measurement.js';
import {LayerControls,applyLayerVisibility} from './layers.js';
import {ElevationLayer} from './elevation-layer.js';
import {MagneticLayer} from './magnetic-layer.js';
import {ScienceMenu} from './science-menu.js';
import {GraticuleLayer} from './graticule-layer.js';
import {GlobeOverview} from './globe-overview.js';
import {CameraAltitude} from './camera-altitude.js';
import {RoutePlanner} from './route-planner.js';
import {SiteEvaluator} from './site-evaluation-ui.js';
import {DesktopDeadReckoning} from './desktop-dead-reckoning.js';
import {installDeveloperOverlays} from './developer-overlays.js';
import {EVAssistant} from './eva-assistant.js';
import {sidebarControls} from './sidebar.js';
import {SpacecraftLayer} from './spacecraft.js';
import {MissionLibrary} from './missions.js';
import {MISSION_SCHEMA} from './mission-state.js';
import {ColorAppearance} from './color-appearance.js';
import {MarsMoons} from './moons.js';
import {restoredSystemTime} from './orbiter-data.js';
import './moons.css';
import {initInterface} from './interface.js';
import './interface.css';
import {SurfaceReadout,loadedImage} from './surface-readout.js';
import {pickViewFocus,reticlePoint} from './view-focus.js';
import {showOverview,walkOverviewTarget,watchOverviewLayout} from './overview-layout.js';
import './surface-readout.css';
import './spacecraft-history.css';
import {startGraphics,watchGraphics,showGraphicsRecovery} from './graphics-startup.js';
import './graphics-recovery.css';
import {SolarLighting} from './solar-lighting.js';
import './solar-lighting.css';
import {DustPredictor} from './dust-storm-ml.js';
import './dust-storm.css';
import {PlanetarySeismology} from './planetary-seismology.js';
import './planetary-seismology.css';
import './interface-horizon.css';
import {MissionDeployer} from './mission-deployer.js';
import './mission-deployer.css';
import {SkylineVPRUI} from './skyline-vpr-ui.js';
const $=id=>document.getElementById(id),rad=Math.PI/180;
let perimeterTool,retainedPerimeters,commsCoverage,pointTools;
const keys={ARCADIA_PLANITIA:'ARCADIA',ARCADIA_REGIONAL:'ARCADIA',AP1:'ARCADIA',AP8:'ARCADIA',AP9:'ARCADIA',PM1:'ARCADIA',EM16:'ARCADIA',VALLES_MARINERIS:'VALLES',VALLES_REGIONAL:'VALLES',VALLES_COPRATES:'VALLES',VALLES_CANDOR:'VALLES',TITHONIUM_SULFATES:'VALLES',JEZERO:'JEZERO',GALE:'GALE'};
let viewer,map,mini,navigation,comparison,compareCentre,compareLinked=true,lastDetail,regions=[],catalog,region,dataset,raster,surface,mainLayer,miniLayer,outline,miniOutline,miniCenter,view='3d',filter='All',changing=0,mapFitted=false,popupRegion,footprintEntities=[],values,places,userSites,siteEvaluator,groundSky;
let desktopOverlays,terrainRelief,polarContext=false,measurement,layers,elevation,magnetic,scienceMenu,graticule,routePlanner,altitude,overview,spacecraft,missions,moons,colorMap,assistant,solarLighting,dustPredictor,seismology,missionDeployer,skylineVPR,appearanceMode='color';
const appearancePreference='mars-atlas-appearance-v2';
const globeContext=[],flatContext=[],miniContext=[];
const loadingWork={native:0,retrying:false,prefetch:false,globe:0};
let regionalImagery,observationWarmup;
function updateMapLoading(patch){
 Object.assign(loadingWork,patch);
 const showGlobe=view!=='2d'&&!moons?.exploring,showFlat=view!=='3d';
 let flat=false;
 if(showFlat)map?.eachLayer(layer=>{
  if(!flat&&layer.qualityAt&&layer.options.opacity!==0)flat=layer.hasPendingDetail?.()??layer.isLoading?.();
 });
 const message=mapLoadingMessage({...loadingWork,showGlobe,showFlat,flat}),busy=$('busy'),hidden=!message;
 if(message&&busy.textContent!==message)busy.textContent=message;
 if(busy.hidden!==hidden)busy.hidden=hidden;
}
function colorQuality(point,index){return [regionalImagery?.qualityAt(point,index),colorMap?.qualityAt(point,index)].filter(Boolean).sort((a,b)=>a.metres-b.metres)[0];}
const fmt=(lon,lat)=>`${Math.abs(lat).toFixed(5)}°${lat>=0?'N':'S'} · ${Math.abs(lon).toFixed(5)}°${lon>=0?'E':'W'}`;
const error=e=>{console.warn('map_data_error',e,e?.errors?.map(c=>c?.message??String(c)));$('error').textContent=mapErrorMessage(e);$('error').hidden=false;};
const geoBounds=b=>L.latLngBounds([[b[1],b[0]],[b[3],b[2]]]);
function updateColorReadout(point){
 if(moons?.exploring){moons.render();return;}
 if(view==='2d'){const p=map.getCenter();point=[p.lng,p.lat];}if(!point)return;
 const q=colorQuality(point,view==='2d'?0:undefined);$('status').textContent=q?.source??'Viking color context';$('coverage-state').textContent=q?`${q.source} · ≈${Number(q.metres.toPrecision(3))} m image sampling · color is coarser`:'Loading color context…';$('coverage-state').dataset.quality=q?'context':'loading';$('view-status').textContent='Viking color context · finer CTX and HiRISE textures use a modeled display tint';$('readout').textContent=fmt(...point)+' · view centre';
}
function setAppearance(value){
 appearanceMode=value==='grayscale'?'grayscale':'color';const color=appearanceMode==='color';colorMap?.setVisible(color);regionalImagery?.setMode(appearanceMode);overview?.setEnabled(!color);surface?.setImageryVisible?.(!color);mainLayer?.setOpacity(color?0:1);miniLayer?.setOpacity(color?0:1);
 for(const input of document.querySelectorAll('[name="map-appearance"]'))input.checked=input.value===appearanceMode;
 $('color-enhancement-control').hidden=!color;
 places?.update();updateCoverage();updateMapLoading();viewer?.scene.requestRender();document.dispatchEvent(new Event('atlas-mission-change'));
}
const sourceCredit='NASA / HiRISE · streamed from Google Drive';
const marsCRS=L.extend({},L.CRS.EPSG4326,{distance(a,b){const p=a.lat*rad,q=b.lat*rad,h=Math.sin((q-p)/2)**2+Math.cos(p)*Math.cos(q)*Math.sin((b.lng-a.lng)*rad/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}});
const RasterLayer=L.GridLayer.extend({createTile(coords,done){
 const tile=document.createElement('canvas');tile.width=tile.height=256;
 const nw=this._map.unproject(L.point(coords.x*256,coords.y*256),coords.z),se=this._map.unproject(L.point((coords.x+1)*256,(coords.y+1)*256),coords.z),bounds=[nw.lng,se.lat,se.lng,nw.lat];
 if(!intersects(bounds,this.options.raster.dataset.bounds)){queueMicrotask(()=>done(null,tile));return tile;}
 if(!this.samples){this.samples=new Set();this.on('tileunload',e=>{this.samples.delete(e.tile);e.tile.mapController?.abort();});}this.samples.add(tile);tile.mapBounds=bounds;tile.mapController=new AbortController();
 const alive=()=>Boolean(this._map)&&this.options.isCurrent();
 recoverSurfaceRead(()=>this.options.raster.dataset.status==='complete'?displayTexture(this.options.raster.dataset,bounds,256,tile.mapController.signal):this.options.raster.texture(bounds,256),{alive:()=>alive()&&!tile.mapController.signal.aborted}).then(image=>{if(!alive())return;tile.getContext('2d').drawImage(image,0,0);tile.gridMeters=image.gridMeters;done(null,tile);this.options.onReady?.();}).catch(e=>{if(!alive()||tile.mapController.signal.aborted)return;done(e,tile);this.options.onError(e);});return tile;
},qualityAt(lon,lat){
 for(const tile of this.samples??[]){const b=tile.mapBounds;if(tile.gridMeters&&lon>=b[0]&&lon<=b[2]&&lat>=b[1]&&lat<=b[3]){const x=Math.min(255,Math.max(0,Math.floor((lon-b[0])/(b[2]-b[0])*256))),y=Math.min(255,Math.max(0,Math.floor((b[3]-lat)/(b[3]-b[1])*256)));if(tile.getContext('2d').getImageData(x,y,1,1).data[3])return {imagery:tile.gridMeters};}}
 return null;
}});
function listing(){
 const q=$('search').value.toLowerCase(),point=parseCoordinateSearch(q);
 if(point){
  const target=coordinateRegion(...point);
  if(!target){
   const note=document.createElement('p');
   note.setAttribute('role','status');
   note.textContent='Use latitude from −90 to 90 and longitude from −180 to 180.';
   $('regions').replaceChildren(note);
   return;
  }
  const button=document.createElement('button');
  button.type='button';button.id='search-coordinate-result';button.className='region-row';
  button.textContent=`Go to ${fmt(...point)}`;
  button.onclick=()=>enter(target);
  $('regions').replaceChildren(button);
  return;
 }
 $('regions').replaceChildren(...regions.filter(r=>(filter==='All'||r.category===filter||(filter==='High detail'&&availableDetail(catalog,keys[r.id])))&&(r.name+' '+r.description).toLowerCase().includes(q)).map(r=>{const b=document.createElement('button');b.className='region-row';b.setAttribute('aria-label','Explore '+r.name);const name=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small'),arrow=document.createElement('span');strong.textContent=r.name;small.textContent=r.category;arrow.textContent='↗';name.append(strong,small);const detail=availableDetail(catalog,keys[r.id]);if(detail){const badge=document.createElement('small');badge.className='detail-badge';badge.textContent=`High detail · ${detail.imagery.toFixed(2)} m ${detail.initial?'crop':'footprints'}`;name.append(badge);}b.append(name,arrow);b.onclick=()=>enter(r);return b;}));
}
function choices(r){if(r.valueSite)return siteDatasets(catalog,r.valueSite);const key=keys[r.id];if(key){const full=catalog.datasets.filter(d=>d.region===key&&d.terrain?.length&&d.imagery?.length);if(full.some(d=>d.status==='complete'))return full;const pilots=catalog.pilots?.filter(d=>d.region===key)||[];if(pilots.length||full.length)return [...pilots,...full];}if(r.bbox){const spatial=catalog.datasets.filter(d=>intersects(d.bounds,r.bbox));if(spatial.length)return spatial;}return [];}
function observationLabel(d,all){return d.status==='preview'?'Local native terrain crop':`HiRISE observation ${all.filter(x=>x.status!=='preview').findIndex(x=>x.id===d.id)+1} · ${d.status==='complete'?'ready':'preparing'}`;}
function updateCoverage(){
 if(moons?.exploring){moons.render();return;}
 if(appearanceMode==='color'){updateColorReadout(lastDetail?.focus??region?.center);return;}
 let focus=lastDetail?.focus??region?.center??[0,0],quality=lastDetail?.quality,loading=lastDetail?.refining??Boolean(dataset);
 if(dataset&&view==='2d'){const c=map.getCenter();focus=[c.lng,c.lat];quality=mainLayer?.qualityAt(...focus);loading=Boolean(mainLayer?.isLoading());if(quality)$('view-status').textContent=`2D displayed imagery ≈${quality.imagery.toFixed(2)} m`;}
 let state=coverageText(dataset,focus,quality,loading);const contextView=view==='2d'?map.getZoom()<13:lastDetail?.context&&!lastDetail?.nativeChecked;if(dataset&&!quality&&inside(focus,dataset.bounds)&&contextView){const close=view!=='2d'&&lastDetail?.perPixel<=8;state={text:`CTX context · ${Math.max(...dataset.imagery_grid_m).toFixed(2)} m HiRISE source ${close?'loading for this view':'available on closer zoom'}`,kind:close?'loading':'context'};}$('coverage-state').textContent=state.text;$('coverage-state').dataset.quality=state.kind;
 if(dataset&&view==='2d'){
  $('readout').textContent=fmt(...focus)+' · view centre';
  $('status').textContent=state.kind==='outside'?'Global CTX · outside selected HiRISE observation':loading?'Global CTX · loading HiRISE detail':quality?'HiRISE over global CTX · Drive':'Global CTX · zoom for HiRISE detail';if(!quality)$('view-status').textContent='Global CTX · ≈5 m imagery source';
 }
 if(view==='split')$('coverage-state').textContent='3D centre · '+state.text;
 if(dataset&&state.kind==='outside')$('view-status').textContent='No native imagery at view centre · global context';
 if(dataset&&!lastDetail&&view!=='2d'){$('coverage-state').textContent=`Loading selected high-resolution footprint · ${Math.max(...dataset.imagery_grid_m).toFixed(2)} m imagery available`;$('coverage-state').dataset.quality='loading';}
}
function updatePolarContext(position){
 if(moons?.exploring){moons.render();return;}
 magnetic?.updateLocation(position?.point??null);scienceMenu?.raster.updateLocation(position?.point??null);scienceMenu?.wind.updateLocation(position?.point??null);scienceMenu?.environment.updateLocation(position?.point??null);scienceMenu?.sources.updateLocation(position?.point??null);if(!position)return;
 const downloaded=(!dataset||!inside(position.point,dataset.bounds))&&desktopOverlays?.qualityAt(position.point,view==='2d');
 if(downloaded){
  $('status').textContent='Downloaded '+downloaded.source;
  $('coverage-state').textContent=`Loaded tile ≈${Math.round(downloaded.metres)} m/px · ${downloaded.appearance}`;
  $('coverage-state').dataset.quality='context';
  $('view-status').textContent=downloaded.source+' · downloaded imagery · elevation shown separately';
  $('readout').textContent=fmt(...position.point)+' · view centre';
  return;
 }
 if(appearanceMode==='color'){updateColorReadout(position.point);return;}
 if(!dataset)$('readout').textContent=fmt(...position.point)+' · view centre';
 const latitude=Math.abs(position.point[1]),overviewActive=overview?.active(view==='2d'?map:undefined),active=overviewActive||!dataset||!inside(position.point,dataset.bounds);
 if(active){const providers=view==='2d'?flatContext:globeContext,point=position.point;
  const samples=[...providers.map(p=>p.qualityAt(...point)),regionalImagery?.qualityAt(point,view==='2d'?0:undefined)].filter(s=>s&&(s.source!=='CTX'||latitude<88)),quality=overviewActive?overview.qualityAt():samples.sort((a,b)=>a.metres-b.metres)[0];
  const loading=!overviewActive&&providers.some(p=>p.loadingAt(...point));
  $('status').textContent=quality?`${latitude>64?'Polar':'Global'} ${quality.source==='CTX'?'photography':'optical context'} · ${quality.source}`:'Global context · loading imagery';
  $('coverage-state').textContent=quality?`${quality.source==='Viking'&&latitude<88?'CTX gap / overview · ':''}Loaded ${quality.source} tile ≈${quality.metres.toFixed(quality.metres<10?1:0)} m${loading?' · loading finer tiles':''}`:'Loading imagery · overview remains visible';
  $('coverage-state').dataset.quality=loading?'loading':'context';
  const terrain=viewer.terrainProvider.backgroundQualityAt?.(...point);
  $('view-status').textContent=overviewActive?'Coherent CTX/Viking overview ≈5.2 km · HRSC/MOLA detail on zoom':(latitude>=88?'CTX ends at ±88° · Viking cap imagery':quality?.source==='CTX'?'CTX ≈5 m source · loaded sampling shown above':'Viking optical context ≈232 m source · CTX where available')+(terrain?.source==='MOLA fallback'?' · elevation: measured MOLA fallback ≈15 km grid':' · HRSC/MOLA terrain');
 }
 else if(polarContext){
  if(dataset){updateCoverage();$('status').textContent=lastDetail?.quality?'HiRISE over global CTX · Drive':'Global CTX · outside selected HiRISE observation';}
  else{$('status').textContent='Mars globe · CTX photography';$('view-status').textContent='Global CTX · optical gap context · HRSC/MOLA terrain';}
 }
 polarContext=active;
}
function showPopup(r){popupRegion=r;$('popup-name').textContent=r.name;$('popup-description').textContent=r.description;$('popup-coverage').textContent=choices(r).length?'Detailed observation footprints available':'Global context · native preparation pending';$('region-popup').hidden=false;}
function updateRegionMarkers(){for(const e of viewer.entities.values)if(e.region)e.show=!moons?.exploring&&layers?.state.regions!==false&&(!dataset||viewer.camera.positionCartographic.height>80000)&&aboveHorizon(e.region.center,viewer.camera.positionWC);viewer.scene.requestRender();}
 function applyMapLayers(input){applyLayerVisibility(input,moons,state=>{values?.setLayerVisibility(state);userSites?.setVisible(state.userSites);spacecraft?.setLayerVisibility(state);measurement?.setVisible(state.measurements);elevation?.setVisible(state.elevation);magnetic?.setVisible(state.magnetic);scienceMenu?.apply(state);graticule?.setVisible(state.graticule);routePlanner?.setVisible(state.routes);updateRegionMarkers();updateFootprints(state.footprints);perimeterTool?.setVisible(!moons?.exploring);if(!state.regions)$('region-popup').hidden=true;});}
function clearSurface(){observationWarmup?.abort();observationWarmup=null;moons?.releaseTracking();surface?.destroy();surface=null;terrainRelief?.apply();for(const e of footprintEntities)viewer.entities.remove(e);footprintEntities=[];closeRasters();mainLayer?.remove();miniLayer?.remove();outline?.remove();miniOutline?.remove();miniCenter?.remove();miniCenter=null;compareCentre?.remove();raster=null;dataset=null;lastDetail=null;navigation?.setMode('pan');navigation?.sync();$('navigation').hidden=view==='2d';$('compare-link').hidden=true;$('view-centre-mark').hidden=true;viewer.scene.globe.show=true;viewer.scene.screenSpaceCameraController.minimumZoomDistance=100;updateMapLoading({native:0,retrying:false});updateRegionMarkers();}
function home(){spacecraft?.clearSelection();changing++;clearSurface();values?.clearSelection();values?.resetLanding();region=null;$('sidebar').scrollTop=0;$('region-popup').hidden=true;$('detail').hidden=true;$('directory').hidden=false;$('mini-wrap').hidden=true;$('error').hidden=true;$('title').innerHTML='Explore the<br>red planet.';$('category').textContent='ONE PLANET. MANY FRONTIERS.';$('description').textContent='Follow real orbital observations from a whole-planet view down to their available surface detail.';$('readout').textContent='Select a place to explore';$('view-status').textContent='Global CTX · optical gap context · HRSC/MOLA terrain';$('status').textContent='Mars globe · CTX photography';setView('3d');viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(-100,20,R*2.2,viewer.scene.globe.ellipsoid),duration:2.4});updateCoverage();history.replaceState(null,'',location.pathname+location.search);}
function regionOverview(){
 if(!region)return;
 const C=window.Cesium,ellipsoid=viewer.scene.globe.ellipsoid;
 if(region.id==='COORDINATES'){
  const [lon,lat]=region.center;
  if(view!=='3d'){
   comparison.programmatic(()=>{
    map.invalidateSize();
    const zoom=map.getBoundsZoom(geoBounds(region.bbox),false,L.point(50,50));
    map.setView([lat,lon],zoom,{animate:false});
   });
   mapFitted=true;
  }
  viewer.camera.flyTo({destination:C.Cartesian3.fromDegrees(lon,lat,108000,ellipsoid),orientation:{heading:0,pitch:-Math.PI/2,roll:0},duration:2.4,complete:()=>surface?.update()});
  return;
 }
 const [w,h]=spanMeters(region.bbox),centre=C.Cartesian3.fromDegrees(...region.center,surface?.sourceElevation?.(...region.center)??0,ellipsoid);
 viewer.camera.flyToBoundingSphere(new C.BoundingSphere(centre,0),{offset:new C.HeadingPitchRange(0,-1.35,Math.min(R*1.8,Math.max(region.valueSite?2500:80000,w,h)*1.35)),duration:3,complete:()=>surface?.update()});
 if(view==='2d')map.fitBounds(geoBounds(region.bbox),{padding:[25,25]});
}
function enter(r){
 spacecraft?.clearSelection();
 if(!r.valueSite){values?.clearSelection();values?.prioritizeLanding(r.id);}else values?.info(r.valueSite);
 region=r;mapFitted=false;$('sidebar').scrollTop=0;$('region-popup').hidden=true;$('directory').hidden=true;$('detail').hidden=false;$('title').textContent=r.name;$('category').textContent=r.category.toUpperCase();$('description').textContent=r.description;$('error').hidden=true;
 const options=choices(r);$('source-link').hidden=Boolean(r.valueSite?.userDefined&&!options.length);$('observation').replaceChildren(...options.map(d=>{const opt=document.createElement('option');opt.value=d.id;opt.textContent=observationLabel(d,options);opt.disabled=d.status!=='complete'&&d.status!=='preview';opt.title=d.id;return opt;}));
 $('fit').disabled=!options.length;if(options.length)selectDataset(options[0],false);else{clearSurface();$('mini-wrap').hidden=true;$('observation').innerHTML='<option>No HiRISE observation prepared yet</option>';$('coverage').textContent='CTX photography with coarser Viking optical imagery in source gaps and at the poles. HRSC/MOLA terrain is checked against independent MOLA measurements. HiRISE preparation remains pending.';$('imagery-resolution').textContent='CTX ≈5 m · optical gaps / caps ≈232 m';$('terrain-resolution').textContent='HRSC/MOLA ≈200 m · coarse MOLA fallback';$('quality').textContent='CTX is a uncontrolled photographic mosaic; HiRISE preparation and absolute registration remain pending.';$('source-link').href=r.archiveUrl;$('status').textContent='Global CTX · HiRISE data pending';$('readout').textContent=fmt(...r.center);map.setView([r.center[1],r.center[0]],6);}
 $('navigation').hidden=view==='2d';navigation?.sync();if(r.valueSite){$('mini-wrap').hidden=false;mini.invalidateSize();mini.fitBounds(geoBounds(r.bbox),{padding:[15,15]});$('overview').textContent='Study-window overview ↗';}else $('overview').textContent='Region overview ↗';
 regionOverview();
 updateCoverage();const params=new URLSearchParams({region:r.id});if(r.id==='COORDINATES'){params.set('lon',r.center[0]);params.set('lat',r.center[1]);}history.replaceState(null,'','#'+params);
}
function selectDataset(d,fit=true){
 const token=++changing,isCurrent=()=>token===changing;
 $('error').hidden=true;
 clearSurface();dataset=d;raster=new SurfaceRaster(d);viewer.scene.screenSpaceCameraController.minimumZoomDistance=5;updateRegionMarkers();
 if(d.status==='complete'&&appearanceMode==='grayscale'){observationWarmup=new AbortController();const [w,s,e,n]=d.bounds;prefetchDisplay(d,[(w+e)/2,(s+n)/2],observationWarmup.signal,{preparedOnly:true}).catch(()=>{});}
 $('view-status').textContent='Loading native map · global context remains visible';
 mapFitted=false;
 $('observation').value=d.id;$('mini-wrap').hidden=false;$('terrain-resolution').textContent=`${Math.max(...d.dem_grid_m).toFixed(2)} m native grid`;$('imagery-resolution').textContent=`${Math.max(...d.imagery_grid_m).toFixed(2)} m ${d.previewTexture?'overview texture':'native imagery'}`;
 const [w,h]=spanMeters(d.bounds);$('coverage').textContent=`${(w/1000).toFixed(1)} × ${(h/1000).toFixed(1)} km footprint bounds · ${d.status==='complete'?'prepared':d.status==='preview'?'initial crop; full swaths are next':'preparation in progress'}`;
 $('quality').textContent=(d.desktopCoverage??'')+' '+d.registration+' Native heights transition gradually to HRSC/MOLA near missing-data edges over approximately 300–400 m for display. Original source elevations remain unchanged. Global CTX is uncontrolled; image-to-image and height datum registration remain uncertified. Each observation is a separate satellite strip, not a resolution level.';$('source-link').href=d.source_folder??region?.archiveUrl??'#';
 const onError=e=>{if(isCurrent())error(e);};
 mainLayer=new RasterLayer({raster,isCurrent,onError,onReady:updateCoverage,tileSize:256,minZoom:13,maxZoom:23,noWrap:true,bounds:geoBounds(d.bounds),keepBuffer:1,attribution:sourceCredit}).addTo(map);
 miniLayer=new RasterLayer({raster,isCurrent,onError,tileSize:256,minZoom:13,maxZoom:23,noWrap:true,bounds:geoBounds(d.bounds),keepBuffer:0,attribution:sourceCredit}).addTo(mini);
 outline=L.featureGroup().addTo(map);miniOutline=L.featureGroup().addTo(mini);
 mini.invalidateSize();mini.fitBounds(geoBounds(d.bounds),{padding:[10,10]});mini._fittedToObservation=true;if(!miniCenter)miniCenter=L.circleMarker([(d.bounds[1]+d.bounds[3])/2,(d.bounds[0]+d.bounds[2])/2],{radius:3,color:'#fff',fillColor:'#efa678',fillOpacity:1,weight:1}).addTo(mini);else miniCenter.setLatLng([(d.bounds[1]+d.bounds[3])/2,(d.bounds[0]+d.bounds[2])/2]);
 if(!compareCentre)compareCentre=L.circleMarker([(d.bounds[1]+d.bounds[3])/2,(d.bounds[0]+d.bounds[2])/2],{radius:6,color:'#efa678',weight:2,fill:false,interactive:false});
 else compareCentre.setLatLng([(d.bounds[1]+d.bounds[3])/2,(d.bounds[0]+d.bounds[2])/2]);
 if(view==='split')compareCentre.addTo(map);
 const Surface=d.status==='complete'?ContinuousSurface:Surface3D;
 surface=new Surface(viewer,raster,{onStatus(p,detail){
  if(!isCurrent())return;updateMapLoading({native:p,retrying:detail?.retrying===true});
  if(detail?.meshMeters){lastDetail=detail;$('coverage-state').dataset.screenMetres=String(detail.perPixel);navigation?.sync();if(view!=='2d')$('view-status').textContent=detail.context?'Global CTX · ≈5 m imagery source · HRSC/MOLA ≈200 m terrain source':`Image ≈${detail.imageMeters.toFixed(2)} m · terrain mesh ≈${detail.meshMeters.toFixed(1)} m`;if(view!=='2d'&&navigation?.mode!=='ground')setOverviewMarker([detail.focus[1],detail.focus[0]]);compareCentre?.setLatLng([detail.focus[1],detail.focus[0]]);comparison?.from3D(detail);if(view==='split'&&compareLinked)mapFitted=true;if(view!=='2d')$('readout').textContent=fmt(...detail.focus)+' · view centre';if(view==='3d'&&navigation?.mode!=='ground'){const isOut=d&&!inside(detail.focus,d.bounds);if(isOut){mini._fittedToObservation=false;const z=Math.max(3,Math.min(14,Math.round(zoomForGroundScale(detail.focus[1],(detail.perPixel||50)*3))));mini.setView([detail.focus[1],detail.focus[0]],z,{animate:false});}else if(!mini._fittedToObservation){mini.fitBounds(geoBounds(d.bounds),{padding:[10,10]});mini._fittedToObservation=true;}}}
  const outside=lastDetail&&!inside(lastDetail.focus,d.bounds);
  $('status').textContent=outside?'Global CTX · outside selected HiRISE observation':detail?.context?detail.perPixel<=8?'Global CTX · loading HiRISE detail':'Global CTX · zoom for HiRISE detail':d.previewTexture?'Native terrain · overview imagery':'HiRISE over global CTX · Drive';
  updateCoverage();
 },onError,onReady(){if(isCurrent())$('error').hidden=true;}});
 navigation?.sync();$('navigation').hidden=view==='2d';
 $('compare-link').hidden=view!=='split';$('view-centre-mark').hidden=view!=='split';
 terrainRelief.apply();
 surface.setImageryVisible?.(appearanceMode!=='color');mainLayer.setOpacity(appearanceMode==='color'?0:1);miniLayer.setOpacity(appearanceMode==='color'?0:1);
 if(fit)fitFootprint();updateFootprints();
}
function fitFootprint(){if(!dataset){if(region){const opts=choices(region);if(opts.length){selectDataset(opts[0],true);return;}}else if(regions.length){const defaultReg=regions.find(r=>r.id==='JEZERO')||regions.find(r=>r.id==='VALLES_MARINERIS')||regions[0];if(defaultReg){enter(defaultReg);return;}}return;}const d=dataset,[w,h]=spanMeters(d.bounds),lon=(d.bounds[0]+d.bounds[2])/2,lat=(d.bounds[1]+d.bounds[3])/2,centre=Cesium.Cartesian3.fromDegrees(lon,lat,surface?.sampleHeight(lon,lat)??0,viewer.scene.globe.ellipsoid);viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(centre,0),{offset:new Cesium.HeadingPitchRange(.28,-.9,Math.max(w,h)*1.3),duration:2.8,complete:()=>surface?.update()});if(view!=='3d'&&!(view==='split'&&compareLinked)){map.invalidateSize();map.fitBounds(geoBounds(d.bounds),{padding:[30,30]});mapFitted=true;}}
function updateFootprints(visible=layers?.state.footprints&&!moons?.exploring){
 for(const group of [outline,miniOutline])group?.clearLayers();
 for(const entity of footprintEntities)viewer.entities.remove(entity);
 footprintEntities=[];
 if(region&&visible){
  const C=window.Cesium,ellipsoid=viewer.scene.globe.ellipsoid;
  const observations=choices(region).filter(d=>d.status==='complete'||d.id===dataset?.id);
  observations.forEach((observation,i)=>{
   const [west,south,east,north]=observation.bounds;
   const selected=observation.id===dataset?.id;
   const color=selected?'#79e0a5':'#85cda4',width=selected?3:2;
   const name=`Observation ${i+1}${selected?' · selected':''}`;
   for(const group of [outline,miniOutline])if(group){
    L.rectangle(geoBounds(observation.bounds),{color,weight:width,fill:false})
     .bindTooltip(name,{permanent:true,direction:'top',className:'observation-label'}).addTo(group);
   }
   const ink=C.Color.fromCssColorString(color);
   const corners=[west,south,east,south,east,north,west,north,west,south];
   const entity=viewer.entities.add({
    polyline:{positions:C.Cartesian3.fromDegreesArray(corners,ellipsoid),arcType:C.ArcType.RHUMB,width,material:ink,clampToGround:true},
    position:C.Cartesian3.fromDegrees((west+east)/2,north,0,ellipsoid),
    label:{text:name,font:'12px sans-serif',fillColor:ink,outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,heightReference:C.HeightReference.CLAMP_TO_GROUND,pixelOffset:new C.Cartesian2(0,-8),distanceDisplayCondition:new C.DistanceDisplayCondition(0,60000)}
   });
   entity.observation=observation;footprintEntities.push(entity);
  });
 }
 viewer.scene.requestRender();
}
function currentSurfaceFocus(){if(view==='2d'&&map){const s=reticlePoint(map.getContainer()),p=map.containerPointToLatLng([s.x,s.y]);return {point:[((p.lng+180)%360+360)%360-180,p.lat]};}return current3DCameraFocus();}
function pickSurfacePreview(screen){if(!(surface instanceof Surface3D)||!viewer.scene.pickPositionSupported)return;const picked=viewer.scene.pick(screen);if(surface.shown.some(n=>n.primitive===picked?.primitive))return viewer.scene.pickPosition(screen);}
function current3DCameraFocus(){
 if(!viewer)return null;
 return pickViewFocus(viewer,{pickPreview:pickSurfacePreview});
}
function setOverviewMarker(point){
 if(miniCenter)miniCenter.setLatLng(point);
 else miniCenter=L.circleMarker(point,{radius:3,color:'#fff',fillColor:'#efa678',fillOpacity:1,weight:1}).addTo(mini);
}
function syncPyxisOverview(){
 const point=map.getCenter();
 showOverview(mini,$('mini-wrap'));
 mini.setView(point,Math.max(0,map.getZoom()-2.5),{animate:false});
 setOverviewMarker(point);
}
function syncWalkOverview(){
 if(view==='2d'||navigation.mode!=='ground'||moons?.exploring)return;
 const target=walkOverviewTarget(viewer.camera,window.Cesium,mini);
 if(!target)return;
 const container=$('mini-wrap');
 if(container.hidden)showOverview(mini,container);
 mini._fittedToObservation=false;
 if(!target.unchanged||!miniCenter){mini.setView(target.point,target.zoom,{animate:false});setOverviewMarker(target.point);}
}
function syncGlobeOverview(focus){
 if(!focus?.point||dataset||navigation.mode==='ground'||moons?.exploring||view!=='3d'&&!(view==='split'&&document.body.classList.contains('ui-pyxis')))return;
 const [lon,lat]=focus.point,metres=focus.width*1000/Math.max(1,viewer.canvas.clientWidth);
 const zoom=Math.max(1,Math.min(13,Math.round(zoomForGroundScale(lat,metres*2.5))));
 showOverview(mini,$('mini-wrap'));
 mini.setView([lat,lon],zoom,{animate:false});setOverviewMarker([lat,lon]);
}
function setView(value){
 measurement?.clearPreview();
 const handoff=view==='3d'&&value!=='3d'?current3DCameraFocus():null;
 view=value;if(value==='2d')moons?.releaseTracking();moons?.setVisible(layers?.state.moons!==false);document.body.classList.toggle('split',value==='split');document.body.classList.toggle('two-d',value==='2d');$('map2d').hidden=value==='3d';$('navigation').hidden=value==='2d';if(value==='2d')navigation?.setMode('pan');$('compare-link').hidden=value!=='split';$('view-centre-mark').hidden=value!=='split';
 updateMapLoading();
 if(compareCentre){if(value==='split')compareCentre.addTo(map);else compareCentre.remove();}
 for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===value));
 requestAnimationFrame(()=>{
  comparison?.programmatic(()=>map?.invalidateSize());mini?.invalidateSize();viewer?.resize();elevation?.refresh();
  if(handoff){const [lon,lat]=handoff.point;comparison.programmatic(()=>map.setView([lat,lon],zoomForGroundScale(lat,handoff.width*1000/Math.max(1,viewer.canvas.clientWidth)),{animate:false}));mapFitted=true;}
  if(dataset&&value!=='3d'&&!mapFitted&&!(value==='split'&&compareLinked)){comparison.programmatic(()=>map.fitBounds(geoBounds(dataset.bounds),{padding:[25,25]}));mapFitted=true;}
  if(region&&!dataset&&value!=='3d'&&!mapFitted){map.fitBounds(geoBounds(region.bbox),{padding:[25,25]});mapFitted=true;}
  if(document.body.classList.contains('ui-pyxis')){
   if(value==='2d')syncPyxisOverview();
   else{
    if(value==='3d'&&dataset)mini._fittedToObservation=false;
    showOverview(mini,$('mini-wrap'));
   }
  }
  graticule?.schedule();spacecraft?.scheduleModels();const remove=viewer.scene.postRender.addEventListener(()=>{remove();surface?.update();updateCoverage();});viewer.scene.requestRender();
 });
}
async function refresh(force=false){
 const response=await fetch('/api/catalog');if(!response.ok)throw new Error('The Drive map catalogue is currently unavailable.');const next=await response.json();
 if(next.schema!=='mars-drive-cog-catalog/1')throw new Error('The map catalogue format changed.');
 const oldCount=catalog?.datasets.filter(d=>d.status==='complete').length;catalog=next;values?.refresh();$('storage-status').textContent=desktopOffline?`LOCAL DATA · ${catalog.datasets.length} REGIONAL PACKAGES · COARSE GLOBAL STARTER`:`GOOGLE DRIVE · ${catalog.datasets.filter(d=>d.status==='complete').length} FULL OBSERVATIONS READY`;if(regions.length&&oldCount!==catalog.datasets.filter(d=>d.status==='complete').length)listing();
 if(region){const found=choices(region),previous=dataset;const updated=found.find(d=>d.id===previous?.id)??found[0];if(updated&&(force||JSON.stringify(updated)!==JSON.stringify(previous))){const fit=updated.id!==previous?.id;selectDataset(updated,fit);$('observation').replaceChildren(...found.map(d=>{const o=document.createElement('option');o.value=d.id;o.textContent=observationLabel(d,found);o.disabled=d.status!=='complete'&&d.status!=='preview';o.title=d.id;return o;}));$('observation').value=updated.id;}}
}

function currentCamp(){
 const state=routePlanner?.workbench?.state,point=declaredCampPoint(state);
 if(!point)return null;
 const sites=userSites?.sites.filter(site=>sameCampPoint(site.center,point))??[];
 const site=sites.find(site=>site.id===state.campSiteId)??sites.find(site=>site.evaluationKind==='base')??sites[0];
 return {point,name:site?.name??'Declared camp'};
}
function declareCamp(point,siteId){
 routePlanner.cancel();
 Object.assign(routePlanner.workbench.state,{home:[...point],campSiteId:siteId});delete routePlanner.workbench.state.evaReturn;
 routePlanner.dirty();routePlanner.workbench.changed();missions?.autosave();
}
function declareBaseCamp(result){
 const point=evaluatedCampPoint(result),existing=userSites.sites.find(s=>s.id===result.markerId);
 if(!existing||!sameCampPoint(existing.center,point))result.markerId=userSites.saveEvaluation(result,{isValue:existing?.isValue??false});
 declareCamp(point,result.markerId);
}
function visitCamp(){
 const camp=currentCamp();
 if(!camp)return false;
 if(moons?.exploring)home();
 const target=coordinateRegion(...camp.point);
 // A linked Compare map must not pull the camera toward its previous view.
 comparison.programmatic(()=>enter({...target,name:camp.name,description:'Declared mission camp · shared with the assistant and Marswalk.'}));
 return true;
}
function focusPerimeter(points){
 const C=window.Cesium,scene=viewer.scene,ellipsoid=scene.globe.ellipsoid;
 if(view==='2d'||view==='split'){
  const reference=points[0][0];
  const bounds=L.latLngBounds(points.map(([lon,lat])=>[lat,lon+360*Math.round((reference-lon)/360)]));
  comparison.programmatic(()=>map.fitBounds(bounds,{padding:[60,60],maxZoom:20}));
 }
 if(view==='2d')return;
 const positions=points.map(([lon,lat])=>C.Cartesian3.fromDegrees(lon,lat,surface?.sampleHeight(lon,lat)??scene.globe.getHeight(C.Cartographic.fromDegrees(lon,lat))??0,ellipsoid));
 const sphere=C.BoundingSphere.fromPoints(positions);
 viewer.camera.flyToBoundingSphere(sphere,{offset:new C.HeadingPitchRange(0,-1.25,Math.max(250,sphere.radius*3.2)),duration:1.5});
}
function deployAtCamp(){if(!visitCamp())return;siteEvaluator.panel.hidden=true;missionDeployer.open(true);missionDeployer.switchTab('catalog');}
async function boot(){
 const pyxis=document.body.classList.contains('ui-pyxis');
 for(let i=0;!window.Cesium&&i<500;i++)await new Promise(r=>setTimeout(r,60));
 if(!window.Cesium)throw new Error('The 3D library could not load. Refresh when the connection is available.');
 const C=window.Cesium,ellipsoid=new C.Ellipsoid(R,R,R),projection=new C.GeographicProjection(ellipsoid);
 C.Ellipsoid.default=ellipsoid;
 protectTerrainPickBounds(C);
 const graphics=await startGraphics(options=>new C.Viewer('globe',{ellipsoid,globe:new C.Globe(ellipsoid),mapProjection:projection,terrainProvider:new C.EllipsoidTerrainProvider({ellipsoid}),skyAtmosphere:false,skyBox:false,baseLayer:false,animation:false,timeline:false,geocoder:false,baseLayerPicker:false,homeButton:false,navigationHelpButton:false,sceneModePicker:false,fullscreenButton:false,selectionIndicator:false,infoBox:false,requestRenderMode:true,...options}),{compatible:new URLSearchParams(location.search).get('graphics')==='compatible',clear:()=>$('globe').replaceChildren(),onAttempt:mode=>{$('status').textContent=mode==='standard'?'Opening Mars…':'Retrying with lighter graphics…';}});
 viewer=graphics.viewer;
 watchGraphics(viewer,error=>{document.dispatchEvent(new Event('atlas-mission-save-request'));showGraphicsRecovery(error,{runtime:true});});
 viewer.scene.backgroundColor=C.Color.fromCssColorString('#090d12');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#595959');viewer.scene.globe.depthTestAgainstTerrain=true;viewer.scene.screenSpaceCameraController.minimumZoomDistance=100;viewer.camera.percentageChanged=.02;
 // Orbit paths and color overlays are not navigation surfaces. Reading their
 // depth triggers a second render inside Cesium's native zoom controller.
 viewer.scene.pickTranslucentDepth=false;
 sharpenMap(viewer,window,{maxScale:graphics.mode==='standard'?2:1});
 navigation=new MapNavigation(viewer,{dataset:()=>dataset,surface:()=>surface,onMode:mode=>{const leftWalk=mode!=='ground'&&$('nav-ground').getAttribute('aria-pressed')==='true';for(const type of ['pan','rotate','ground'])$('nav-'+type).setAttribute('aria-pressed',String(type===mode));$('ground-help').hidden=mode!=='ground';$('nav-hint').textContent=mode==='ground'?'Click map · WASD to walk · Space to jump':mode==='pan'?'Drag to pan · wheel to zoom · right-drag to rotate':'Drag to rotate and tilt · wheel to zoom';if(leftWalk)requestAnimationFrame(()=>{if(navigation.mode==='ground'||view==='2d'||moons?.exploring)return;if(surface)surface.update();else syncGlobeOverview(current3DCameraFocus());});}});
 groundSky=new GroundSky(viewer,{active:()=>navigation.mode==='ground'&&view!=='2d'&&!moons?.exploring&&viewer.camera.positionCartographic.height<100000,time:()=>solarLighting?.currentTime()});
 $('ground-speed').onchange=()=>{navigation.groundSpeed=Number($('ground-speed').value);viewer.canvas.focus({preventScroll:true});};
 $('nav-ground').onclick=()=>navigation.setMode(navigation.mode==='ground'?'pan':'ground');$('nav-pan').onclick=()=>navigation.setMode('pan');$('nav-rotate').onclick=()=>navigation.setMode('rotate');$('nav-in').onclick=()=>navigation.zoom(160,true);$('nav-out').onclick=()=>navigation.zoom(-160,true);$('nav-north').onclick=()=>navigation.north();
 for(const id of ['nav-ground','nav-pan','nav-rotate'])$(id).addEventListener('click',()=>{if(measurement?.drawing){measurement.line.drawing=false;measurement.update();}});
 viewer.terrainProvider=new MarsTerrain(C,ellipsoid);
 let reliefStorage;try{reliefStorage=localStorage;}catch{}
 terrainRelief=new TerrainRelief(viewer,{surface:()=>surface,controls:[$('relief'),$('terrain-relief')],storage:reliefStorage,onChange:scale=>{navigation?.clamp();routePlanner?.draw();missionDeployer?.onReliefChange?.(scale);}});
 // Keep the two complete global photographs underneath every refinable layer.
 // They never replace their texture with an unavailable fine tile, so partial
 // source failures cannot uncover the globe's flat base colour.
 const contextReady=imageryReadyCallback(viewer,()=>{places?.update();spacecraft?.scheduleModels();});
 const addContext=(options,display)=>{if(desktopOffline&&!desktopState?.globalMap?.available)return;const provider=planetImageryProvider(C,{...options,tilingScheme:new C.GeographicTilingScheme({ellipsoid})},{...display,sharedImages:true,onReady:contextReady});globeContext.push(provider);provider.displayLayer=viewer.imageryLayers.addImageryProvider(provider);};
 const installedBase=desktopState?.globalMap?.available?desktopState.globalMap:null;
 if(installedBase){addContext({url:CTX_URL,tileWidth:installedBase.imagery.tilePixels,tileHeight:installedBase.imagery.tilePixels,maximumLevel:installedBase.imagery.maximumLevel,credit:installedBase.credit},{source:'Installed base',nativeMeters:installedBase.imageryMetersPerPixel});}
 else{
 addContext({...GLOBE_OVERVIEW,credit:CTX_CREDIT+' · Viking optical gap context'},{source:'CTX / Viking overview',nativeMeters:5210});
 addContext({url:BASE_URL,tileWidth:256,tileHeight:256,maximumLevel:7,credit:BASE_CREDIT},{grayscale:true,source:'Viking',nativeMeters:232});
 // Optical imagery stays optical: infrared temperature contrast does not match
 // CTX illumination and created conspicuous strips across otherwise real terrain.
 // Cesium already uses meridional texel spacing for GeographicProjection.
 // Keep the actual 512-pixel tile size. Duplicating polar layers with a fictitious
 // 128-pixel size requested 16 times as many geographic tiles at each pole.
 addContext({url:CTX_URL,rectangle:C.Rectangle.fromDegrees(-180,-88,180,88),tileWidth:512,tileHeight:512,maximumLevel:12,credit:CTX_CREDIT},{polarOverview:true,maskEdges:true,bootstrapOverview:true,opticalGaps:{base:BASE_URL,primary:CTX_URL},source:'CTX',nativeMeters:5});
 }
 stableGlobeDetail(viewer,{compatible:graphics.mode!=='standard'});
 viewer.scene.globe.tileLoadProgressEvent.addEventListener(globe=>updateMapLoading({globe}));
 map=L.map('map2d',{crs:marsCRS,maxZoom:23,zoomSnap:0,zoomControl:true,attributionControl:true}).setView([0,0],0);L.control.scale({imperial:false,maxWidth:130}).addTo(map);
 map.on('moveend zoomend',()=>updateMapLoading());
 compareCentre=L.circleMarker([0,0],{radius:6,color:'#efa678',weight:2,fill:false,interactive:false});
 comparison=new CompareViews(map,{active:()=>Boolean(view==='split'&&compareLinked),move3D:(focus,metres)=>navigation.focusOn(focus,metres)});
 if(!desktopOffline&&!installedBase)flatContext.push(new GrayscaleBaseLayer({url:BASE_URL,maxNativeZoom:0,maxZoom:23,noWrap:false,attribution:BASE_CREDIT,keepBuffer:0}).addTo(map));
 if(!desktopOffline&&!installedBase)flatContext.push(new GrayscaleBaseLayer({url:BASE_URL,maxNativeZoom:7,maxZoom:23,noWrap:false,attribution:BASE_CREDIT,keepBuffer:1}).addTo(map));
 if(!desktopOffline&&!installedBase)flatContext.push(new CTXLayer({url:CTX_URL,opticalGaps:{base:BASE_URL,primary:CTX_URL},maxNativeZoom:12,maxZoom:23,noWrap:false,attribution:CTX_CREDIT,keepBuffer:2}).addTo(map));
 if(installedBase)flatContext.push(new CTXLayer({url:CTX_URL,tilePixels:installedBase.imagery.tilePixels,maxNativeZoom:installedBase.imagery.maximumLevel,maxZoom:23,noWrap:false,attribution:installedBase.credit,keepBuffer:1,source:'Installed base',nativeMeters:installedBase.imageryMetersPerPixel,polarOverview:false,maskEdges:false}).addTo(map));
 for(const layer of flatContext)layer.on('tileload',contextReady);
 mini=L.map('mini-map',{crs:marsCRS,zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,touchZoom:false,keyboard:false}).setView([0,0],0);
 watchOverviewLayout(mini,$('mini-wrap'));
 if(!desktopOffline&&!installedBase)miniContext.push(new GrayscaleBaseLayer({url:BASE_URL,maxNativeZoom:0,maxZoom:23,noWrap:false,keepBuffer:0}).addTo(mini));
 if(!desktopOffline&&!installedBase)miniContext.push(new GrayscaleBaseLayer({url:BASE_URL,maxNativeZoom:7,maxZoom:23,noWrap:false}).addTo(mini));
 if(!desktopOffline&&!installedBase)miniContext.push(new CTXLayer({url:CTX_URL,opticalGaps:{base:BASE_URL,primary:CTX_URL},maxNativeZoom:12,maxZoom:23,noWrap:false,keepBuffer:1}).addTo(mini));
 if(installedBase)miniContext.push(new CTXLayer({url:CTX_URL,tilePixels:installedBase.imagery.tilePixels,maxNativeZoom:installedBase.imagery.maximumLevel,maxZoom:23,noWrap:false,keepBuffer:0,source:'Installed base',nativeMeters:installedBase.imageryMetersPerPixel,polarOverview:false,maskEdges:false}).addTo(mini));
 if(desktopState&&window.marsDesktop?.onObservationsChanged)desktopOverlays=installDeveloperOverlays({viewer,map,mini,ellipsoid,imageryReady:contextReady});
 const appearance=show=>{$('appearance-panel').hidden=!show;$('appearance-toggle').setAttribute('aria-expanded',String(show));$('appearance-toggle').setAttribute('aria-pressed',String(show));if(show){assistant?.open(false);moons?.open(false);missions?.open(false);measurement?.open(false);routePlanner?.open(false);solarLighting?.open(false);dustPredictor?.open(false);seismology?.open(false);missionDeployer?.open(false);}};
 $('appearance-toggle').onclick=()=>appearance($('appearance-panel').hidden);$('appearance-close').onclick=()=>appearance(false);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('appearance-panel').hidden){appearance(false);$('appearance-toggle').focus({preventScroll:true});}});
 measurement=new MeasureTool(viewer,map,mini,{navigation,surface:()=>surface,view:()=>view,onOpen:()=>{missions?.open(false);appearance(false);routePlanner?.open(false);solarLighting?.open(false);dustPredictor?.open(false);seismology?.open(false);missionDeployer?.open(false);$('region-popup').hidden=true;if(layers&&!layers.state.measurements)layers.set('measurements',true);}});
 colorMap=new ColorAppearance(viewer,[map,mini],{onReady:()=>{if(appearanceMode==='color')places?.update();}});
 regionalImagery=new RegionalImagery(viewer,[map,mini],{base:BASE_URL,onReady:contextReady});
 elevation=new ElevationLayer(viewer,map,mini);
 magnetic=new MagneticLayer(viewer,map,mini);
 scienceMenu=new ScienceMenu(viewer,map,mini);
 graticule=new GraticuleLayer(viewer,map,mini);
 overview=new GlobeOverview(viewer,[map,mini],{providers:globeContext,flatLayers:[flatContext,miniContext],elevation,onChange:()=>places?.update()});
 const colorEnhancement=$('color-enhancement');
 try{colorEnhancement.checked=localStorage.getItem('mars-atlas-color-enhancement')!=='false';}catch{}
 colorMap.setEnhanced(colorEnhancement.checked);
 regionalImagery.setGrade(colorMap.grade.grade,colorMap.grade.filter);
 colorEnhancement.onchange=()=>{
  colorMap.setEnhanced(colorEnhancement.checked);
  regionalImagery.setGrade(colorMap.grade.grade,colorMap.grade.filter);
  try{localStorage.setItem('mars-atlas-color-enhancement',String(colorEnhancement.checked));}catch{}
 };
 for(const input of document.querySelectorAll('[name="map-appearance"]'))input.onchange=()=>{if(input.checked){try{localStorage.setItem(appearancePreference,input.value);}catch{}setAppearance(input.value);}};
 try{setAppearance(localStorage.getItem(appearancePreference)??localStorage.getItem('mars-atlas-appearance'));}catch{setAppearance('color');}
 const ctxPrefetch=new CtxDetailPrefetch(()=>current3DCameraFocus()?.point,prefetch=>updateMapLoading({prefetch}));
 altitude=new CameraAltitude(viewer,{view:()=>view,onUpdate:metres=>{
  const provider=view==='2d'||moons?.exploring?null:appearanceMode==='color'?colorMap.detail:globeContext.at(-1);
  ctxPrefetch.update(metres,provider);
  if(view!=='3d')updateMapLoading();
 }});
 routePlanner=new RoutePlanner(viewer,map,mini,{surface:()=>surface,catalog:()=>catalog,dataset:()=>dataset,sites:()=>values?.sites,radio:()=>commsCoverage?.safetySnapshot(),view:()=>view,navigation,onOpen:()=>{missions?.open(false);appearance(false);measurement?.open(false);solarLighting?.open(false);dustPredictor?.open(false);seismology?.open(false);missionDeployer?.open(false);$('region-popup').hidden=true;if(layers&&!layers.state.routes)layers.set('routes',true);},onExample:()=>{const r=regions.find(r=>r.id==='JEZERO');if(r)return enter(r);}});
 if(desktopState)new DesktopDeadReckoning({viewer,map,mini,focus:()=>moons?.exploring?null:currentSurfaceFocus(),surface:()=>surface,centre:point=>{if(view==='2d')map.panTo([point[1],point[0]]);else{const height=surface?.sampleHeight?.(...point)??viewer.scene.globe.getHeight(C.Cartographic.fromDegrees(...point))??22000;viewer.camera.flyTo({destination:C.Cartesian3.fromDegrees(...point,height+3000,ellipsoid),duration:1});}},routeStart:point=>{routePlanner.setPoint('start',point);routePlanner.open(true);}});
 const roverView=new RoverGroundView({
  centre:()=>navigation.mode==='ground'?[C.Math.toDegrees(viewer.camera.positionCartographic.longitude),C.Math.toDegrees(viewer.camera.positionCartographic.latitude)]:currentSurfaceFocus()?.point,
  locate:point=>{const target=coordinateRegion(...point);if(target)enter(target);},
  reports:()=>routePlanner.workbench.hazards.reports(),
  analyse:point=>{routePlanner.workbench.open(true);routePlanner.workbench.showTab('hazards');routePlanner.workbench.hazards.loadLocal(point);}
 });
 for(const [id,parent] of [['rover-ground-explore',$('pyxis-explore-shortcuts')??$('sidebar').querySelector('.ui-drawer-top')],['rover-ground-walk',$('ground-help')]]){
  const button=document.createElement('button');button.type='button';button.id=id;button.textContent='Rover ground imagery';button.onclick=()=>roverView.open();parent?.append(button);
 }
 siteEvaluator=new SiteEvaluator({viewer,map,mini,camp:currentCamp,declareCamp:declareBaseCamp,deployOnSite:deployAtCamp,mark:(r,options)=>userSites.saveEvaluation(r,options),savedSite:id=>userSites?.sites.find(s=>s.id===id),editSite:site=>userSites.edit(site),beforePick:()=>{userSites?.cancelPick();if(moons?.exploring)home();navigation.setMode('pan');routePlanner.picking=null;routePlanner.renderPicking();measurement?.open(false);if(missionDeployer)missionDeployer.picking=false;},surface:()=>surface,catalog:()=>catalog,dataset:()=>dataset,sites:()=>values?.sites,centre:()=>currentSurfaceFocus()?.point,cancel:()=>routePlanner.cancel(),dirty:()=>routePlanner.dirty(),openRoute:()=>routePlanner.open(true),status:text=>routePlanner.status(text),set start(p){routePlanner.start=p;},set goal(p){routePlanner.goal=p;},set targets(p){routePlanner.targets=p;}});
 layers=new LayerControls(applyMapLayers);applyMapLayers(layers.state);
 spacecraft=new SpacecraftLayer(viewer,map,mini,{view:()=>view,qualityAt:(lon,lat)=>globeContext.map(p=>p.qualityAt(lon,lat)).filter(q=>q?.source==='CTX').sort((a,b)=>a.metres-b.metres)[0],show3D:()=>setView('3d'),ensureVisible:()=>{if(!layers.state.spacecraft)layers.set('spacecraft',true);},onOpen:()=>{missions?.open(false);appearance(false);measurement?.open(false);routePlanner?.open(false);solarLighting?.open(false);dustPredictor?.open(false);seismology?.open(false);missionDeployer?.open(false);},onFlatPick:event=>{if(siteEvaluator?.picking){siteEvaluator.addFlat(event);return true;}if(userSites?.picking){userSites.addFlat(event);return true;}if(routePlanner?.picking){routePlanner.addFlat(event);return true;}if(measurement?.drawing){measurement.addFlat(event);return true;}return false;},beforeFly:()=>{clearSurface();region=null;navigation.setMode('pan');$('region-popup').hidden=true;}});spacecraft.setLayerVisibility(layers.state);
 moons=new MarsMoons(viewer,{onExplore:()=>{if(layers)applyMapLayers(layers.state);pointTools?.syncSpace();updateMapLoading();},view:()=>view,show3D:()=>setView('3d'),beforeFly:()=>{clearSurface();region=null;navigation.setMode('pan');$('region-popup').hidden=true;},ensureVisible:()=>{if(!layers.state.moons)layers.set('moons',true);},onOpen:()=>{missions?.open(false);appearance(false);measurement?.open(false);routePlanner?.open(false);solarLighting?.open(false);dustPredictor?.open(false);seismology?.open(false);missionDeployer?.open(false);}});moons.setVisible(layers.state.moons);navigation.focusZoom=delta=>moons.zoom(delta);navigation.spaceFocus=()=>moons.exploring;spacecraft.orbitalView=id=>moons.selectOrbiter(id);
 sidebarControls(()=>{measurement?.clearPreview();comparison.programmatic(()=>{const centre=map.getCenter(),zoom=map.getZoom();map.invalidateSize({pan:false});map.setView(centre,zoom,{animate:false,reset:true});});mini.invalidateSize({pan:false,animate:false});viewer.resize();viewer.scene.requestRender();surface?.schedule?.();});
 regions=await fetch('/regions.json').then(r=>r.json());if(!Array.isArray(regions))regions=regions.regions;
 try{await refresh();}catch(e){catalog={schema:'mars-drive-cog-catalog/1',datasets:[],pilots:[],build_status:'unavailable'};$('storage-status').textContent='ARCHIVE TEMPORARILY UNAVAILABLE';console.warn(e.message);}listing();
 values=new ValueSites(viewer,map,mini,{catalog:()=>catalog,onEnter:enter,regions:()=>regions});values.layerVisibility=layers.state;await values.load();
 userSites=new UserSites(viewer,map,mini,{
  centre:()=>currentSurfaceFocus()?.point,
  changed:(before,after)=>{values.setUserSites(userSites.sites);if(JSON.stringify(before.filter(s=>s.isValue))!==JSON.stringify(after.filter(s=>s.isValue)))routePlanner.dirty();else routePlanner.render();},
  visibility:show=>layers.set('userSites',show),
  visit:site=>values.enter(site),
  declareCamp:pyxis?site=>declareCamp(site.center,site.id):undefined,
  assignPerimeter:pyxis?site=>perimeterTool.assign({kind:'site',id:site.id}):undefined,
  beforePick:()=>{siteEvaluator?.cancelPick();if(moons?.exploring)home();navigation.setMode('pan');routePlanner.picking=null;routePlanner.renderPicking();measurement?.open(false);if(missionDeployer)missionDeployer.picking=false;},
  isCamp:point=>sameCampPoint(currentCamp()?.point,point),
  flatPick:event=>{if(perimeterTool?.picking){perimeterTool.addFlat(event);return true;}if(siteEvaluator?.picking){siteEvaluator.addFlat(event);return true;}if(routePlanner?.picking){routePlanner.addFlat(event);return true;}if(measurement?.drawing){measurement.addFlat(event);return true;}if(missionDeployer?.picking){missionDeployer.addFlat(event);return true;}return false;}
 });
 if(pyxis)perimeterTool=new PerimeterTool({viewer,map,mini,sites:()=>userSites.sites,camp:currentCamp,centre:()=>currentSurfaceFocus()?.point,
  surface:()=>surface,inSpace:()=>Boolean(moons?.exploring),focus:focusPerimeter,
  open:()=>{if($('perimeter-panel').hidden)document.querySelector('#ui-rail [data-action="perimeter"]').click();},
  beforePick:()=>{userSites.cancelPick();userSites.host.beforePick();}
 });
 values.onUserEdit=site=>{const saved=userSites.sites.find(s=>s.id===site.id);if(saved)userSites.edit(saved);};
 values.setUserSites(userSites.sites);userSites.setVisible(layers.state.userSites);routePlanner.render();
 places=new PlaceContext(viewer,map,{regions:()=>regions,onEnter:enter,view:()=>view,focus:current3DCameraFocus,onPosition:updatePolarContext});await places.load();
 viewer.scene.postRender.addEventListener(syncWalkOverview);
 let cameraSyncScheduled=false;
 viewer.camera.changed.addEventListener(()=>{
  navigation.sync();
  if(navigation.mode==='ground'&&view!=='split'||dataset)return;
  if(cameraSyncScheduled)return;
  cameraSyncScheduled=true;
  requestAnimationFrame(()=>{
   cameraSyncScheduled=false;
   const focus=current3DCameraFocus();
   if(focus?.point&&view==='split')comparison.from3D({focus:focus.point,perPixel:focus.width*1000/Math.max(1,viewer.canvas.clientWidth)});
   syncGlobeOverview(focus);
  });
 });
 const pointImageCoverage=point=>{
   const downloaded=desktopOverlays?.qualityAt(point,view==='2d');
   if(downloaded)return downloaded;
   if(appearanceMode==='color')return loadedImage({color:colorQuality(point,view==='2d'?0:undefined)??{}});
   const flat=view==='2d',native=flat?(map.getZoom()>=13?mainLayer?.qualityAt(...point):null):surface?.qualityAt(...point);
   return loadedImage({native,overview:overview?.active(flat?map:undefined)?overview.qualityAt():null,providers:[...(flat?flatContext:globeContext).map(p=>p.qualityAt(...point)),regionalImagery?.qualityAt(point,flat?0:undefined)],polar:Math.abs(point[1])>=88});
  };
 new SurfaceReadout(viewer,map,{view:()=>view,focus:currentSurfaceFocus,active:()=>!moons?.exploring||view==='2d',surface:()=>surface,
  pickPreview:pickSurfacePreview,imageAt:pointImageCoverage});
 await spacecraft.load();
 solarLighting=new SolarLighting(viewer,{currentFocus:current3DCameraFocus,getRegion:()=>region,onOpen:()=>{moons?.open(false);missions?.open(false);appearance(false);measurement?.open(false);routePlanner?.open(false);assistant?.open(false);dustPredictor?.open(false);seismology?.open(false);missionDeployer?.open(false);skylineVPR?.open(false);$('region-popup').hidden=true;}});
 dustPredictor=new DustPredictor(viewer,{currentFocus:currentSurfaceFocus,map,elevation:async point=>{const height=surface?.sourceElevation?.(...point);if(Number.isFinite(height))return {height,source:'HiRISE physical DEM'};const overview=await overviewElevation();return {height:overview.heightAt(...point),source:'NASA MOLA · ≈15 km overview'};},getRegion:()=>region,onOpen:()=>{moons?.open(false);missions?.open(false);appearance(false);measurement?.open(false);routePlanner?.open(false);assistant?.open(false);solarLighting?.open(false);seismology?.open(false);missionDeployer?.open(false);skylineVPR?.open(false);$('region-popup').hidden=true;}});
 seismology=new PlanetarySeismology(viewer,{onOpen:()=>{moons?.open(false);missions?.open(false);appearance(false);measurement?.open(false);routePlanner?.open(false);assistant?.open(false);solarLighting?.open(false);dustPredictor?.open(false);skylineVPR?.open(false);$('region-popup').hidden=true;}});
 missionDeployer=new MissionDeployer({viewer,map,leaflet:L,routePlanner,terrainRelief,solarLighting,scienceMenu,dustPredictor,seismology,spacecraft,surface:()=>surface,getRegion:()=>region,openCoverage:point=>commsCoverage.openMast(point),onOpen:()=>{moons?.open(false);missions?.open(false);appearance(false);measurement?.open(false);routePlanner?.open(false);assistant?.open(false);solarLighting?.open(false);dustPredictor?.open(false);seismology?.open(false);skylineVPR?.open(false);$('region-popup').hidden=true;}});
 commsCoverage=new CommsCoverage({viewer,map,mini,navigation,catalog:()=>catalog,dataset:()=>dataset,focus:()=>currentSurfaceFocus()?.point,inSpace:()=>Boolean(moons?.exploring),
  onAnalysisChange:()=>routePlanner.workbench.renderSafety(),
  mast:()=>missionDeployer.deployed.find(record=>record.id===missionDeployer.selectedDeployedId&&record.typeId==='comms_mast')??missionDeployer.deployed.find(record=>record.typeId==='comms_mast'),
  openPanel:()=>document.querySelector('#ui-mission-menu [data-action="comms"]').click(),
  focusMap:focusPerimeter,
  onOpen:()=>{if(navigation.mode==='ground')navigation.setMode('pan');perimeterTool?.pick(false);siteEvaluator?.cancelPick();userSites?.cancelPick();missionDeployer?.cancelPlacement();routePlanner.picking=null;routePlanner.renderPicking();skylineVPR?.open(false);$('region-popup').hidden=true;}
 });
 skylineVPR=new SkylineVPRUI({viewer,map,mini,surface:()=>surface,getElevationSampler:async()=>{const o=await overviewElevation();return o.heightAt;},setStart:p=>routePlanner.setPoint('start',p),openRoute:b=>routePlanner.open(b),routePlanner,onOpen:()=>{moons?.open(false);missions?.open(false);appearance(false);measurement?.open(false);routePlanner?.open(false);assistant?.open(false);solarLighting?.open(false);dustPredictor?.open(false);seismology?.open(false);missionDeployer?.open(false);$('region-popup').hidden=true;}});
 $('skyline-toggle')?.addEventListener('click',()=>skylineVPR.open($('skyline-panel').hidden));
 assistant=new EVAssistant(viewer,map,mini,{name:pyxis?'TARS AI':'ARES',routePlanner,values,places,setView,navigation,measurement,appearance,enter,fitFootprint,regionOverview,home,getRegion:()=>region,getDataset:()=>dataset,regions:()=>regions,currentFocus:currentSurfaceFocus,spacecraft,moons,solarLighting,dustPredictor,seismology,missionDeployer,skylineVPR,atlas:{layer:async(key,show,variant)=>{layers.set(key,show);if(variant){$('science-variant').value=variant;$('science-variant').dispatchEvent(new Event('change'));}},all:show=>layers.all(show),focus:show=>{const button=$('ui-focus');if(button?.getAttribute('aria-pressed')!==String(show))button?.click();},feature:(id,show)=>{const input=$(id);if(!input)throw Error('Feature unavailable');input.checked=show;input.dispatchEvent(new Event('change'));},dust:target=>dustPredictor.predictForTarget(target),context:query=>atlasDataDescription({query,point:currentSurfaceFocus()?.point,item:scienceMenu.active,reference:scienceMenu.raster.grid,wind:scienceMenu.wind.packet,environment:scienceMenu.environment.packet,environmentItem:scienceMenu.environment.item,quality:$('coverage-state')?.textContent})+(scienceMenu.dynamic.item?'\nSelected space-weather record: '+scienceMenu.dynamic.item.name+'. '+$('space-weather-controls').textContent:'')},onOpen:()=>{moons?.open(false);missions?.open(false);appearance(false);measurement?.open(false);routePlanner?.open(false);solarLighting?.open(false);dustPredictor?.open(false);seismology?.open(false);missionDeployer?.open(false);skylineVPR?.open(false);$('region-popup').hidden=true;}});
 for(const r of regions){const marker=viewer.entities.add({position:C.Cartesian3.fromDegrees(...r.center,0,ellipsoid),...regionMarkerGraphics(C,r,R)});marker.region=r;}
 let regionMarkersScheduled=false;
 const scheduleRegionMarkers=()=>{
  if(regionMarkersScheduled)return;
  regionMarkersScheduled=true;
  requestAnimationFrame(()=>{
   regionMarkersScheduled=false;
   updateRegionMarkers();
  });
 };
 updateRegionMarkers();viewer.camera.changed.addEventListener(scheduleRegionMarkers);
 if(pyxis&&desktopState&&window.marsDesktop.inspectPoint){
  pointTools=installPointTools({viewer,map,mini,api:window.marsDesktop,inSpace:()=>Boolean(moons?.exploring),
   places,values,spacecraft,deployer:missionDeployer,comms:commsCoverage,camp:currentCamp,
   imageCoverage:pointImageCoverage,offline:()=>desktopOffline,rover:roverView,
   route:routePlanner,evaluator:siteEvaluator,sites:userSites,assistant});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&pointTools.picking)pointTools.setPicking(false);},true);
 }
 const picker=new C.ScreenSpaceEventHandler(viewer.canvas);picker.setInputAction(click=>{if(!commsCoverage.panel.hidden&&(!pointTools?.picking||commsCoverage.picking)&&commsCoverage.click(routePlanner.point3D(click.position)))return;if(perimeterTool?.picking){perimeterTool.add3D(click.position);return;}if(siteEvaluator?.picking){siteEvaluator.add3D(click.position);return;}if(userSites?.picking){userSites.add3D(click.position);return;}if(missionDeployer?.picking){missionDeployer.add3D(click.position);return;}if(routePlanner?.picking){routePlanner.add3D(click.position);return;}if(measurement?.drawing){measurement.add3D(click.position);return;}const picked=viewer.scene.pick(click.position);if(!moons?.exploring&&picked?.id?.crewFix){pointTools?.select(picked.id.crewFix.point);return;}if(pointTools?.picking&&!moons?.exploring){const point=routePlanner.point3D(click.position);if(point){pointTools.select(point);return;}}if(picked?.id?.campPoint){visitCamp();return;}if(picked?.id?.userSite){userSites.edit(picked.id.userSite);return;}if(picked?.id?.deployedEquipmentId){missionDeployer?.selectEquipment(picked.id.deployedEquipmentId);missionDeployer?.open(true);return;}if(picked?.id?.orbiterId)return moons.selectOrbiter(picked.id.orbiterId);if(picked?.id?.moonId)return moons.select(picked.id.moonId);if(picked?.id?.spacecraftId)return spacecraft.select(picked.id.spacecraftId,{fly:!picked.id.terrainSpacecraftModel});if(picked?.id?.valueSite)return values.enter(picked.id.valueSite);if(Array.isArray(picked?.id)){const points=picked.id.map(e=>e.position?.getValue(C.JulianDate.now())).filter(Boolean);if(points.length)viewer.camera.flyToBoundingSphere(C.BoundingSphere.fromPoints(points),{duration:2});return;}if(picked?.id?.region)return showPopup(picked.id.region);if(picked?.id?.observation)return selectDataset(picked.id.observation,true);$('region-popup').hidden=true;if(!dataset)return;const position=viewer.scene.pickPosition(click.position);if(position){const c=ellipsoid.cartesianToCartographic(position),lon=C.Math.toDegrees(c.longitude),lat=C.Math.toDegrees(c.latitude),height=surface?.sourceElevation(lon,lat);$('readout').textContent=fmt(lon,lat)+(Number.isFinite(height)?` · source elevation ≈${height.toFixed(1)} m`:' · global terrain; native elevation unavailable');}},C.ScreenSpaceEventType.LEFT_CLICK);
 map.on('moveend',()=>{comparison.from2D();if(pyxis&&view==='2d')syncPyxisOverview();updateCoverage();});map.on('zoomend',updateCoverage);
 map.on('click',async event=>{const {lng,lat}=event.latlng;if((!pointTools?.picking||commsCoverage.picking)&&commsCoverage.click([lng,lat]))return;if(perimeterTool?.picking){perimeterTool.addFlat(event);return;}if(siteEvaluator?.picking){siteEvaluator.addFlat(event);return;}if(userSites?.picking){userSites.addFlat(event);return;}if(missionDeployer?.picking){missionDeployer.addFlat(event);return;}if(routePlanner?.picking){routePlanner.addFlat(event);return;}if(measurement?.drawing){measurement.addFlat(event);return;}if(pointTools?.picking){pointTools.select([lng,lat]);return;}if(!raster)return;const epsilon=1e-6;try{const v=await raster.read([lng-epsilon,lat-epsilon,lng+epsilon,lat+epsilon],3,3,{kind:'terrain',nodes:true});$('readout').textContent=fmt(lng,lat)+(Number.isFinite(v[4])?` · source elevation ${v[4].toFixed(1)} m`:' · elevation unknown');}catch(e){error(e);}});
 $('home').onclick=home;$('all').onclick=home;$('fit').onclick=fitFootprint;$('overview').onclick=regionOverview;$('search').oninput=listing;$('expand-2d').onclick=()=>setView('2d');
 $('search').onkeydown=event=>{
  if(event.key!=='Enter'||event.isComposing)return;
  const result=$('search-coordinate-result');
  if(result){event.preventDefault();result.click();}
 };
 $('observation').onchange=()=>{const d=choices(region).find(d=>d.id===$('observation').value);if(d)selectDataset(d,true);};
 $('compare-link').onclick=()=>{compareLinked=!compareLinked;$('compare-link').setAttribute('aria-pressed',String(compareLinked));$('compare-link').textContent=compareLinked?'Views linked':'Views independent';if(compareLinked){const focus=!dataset&&current3DCameraFocus();comparison.from3D(focus?.point?{focus:focus.point,perPixel:focus.width*1000/Math.max(1,viewer.canvas.clientWidth)}:lastDetail);}};
 $('refresh').onclick=()=>refresh(true).catch(error);
 $('popup-close').onclick=()=>{$('region-popup').hidden=true;};$('popup-explore').onclick=()=>{if(popupRegion)enter(popupRegion);};document.addEventListener('keydown',e=>{if(e.key==='Escape')$('region-popup').hidden=true;});
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);
 for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{filter=b.dataset.filter;for(const x of document.querySelectorAll('[data-filter]'))x.setAttribute('aria-pressed',String(x===b));listing();};
 const params=new URLSearchParams(location.hash.slice(1)),selected=params.get('region');home();const r=regions.find(x=>x.id===selected),s=values.sites.find(x=>'VALUE_'+x.id===selected);if(params.get('orbiter'))await moons.selectOrbiter(params.get('orbiter'));else if(params.get('moon')==='system')await moons.system();else if(params.get('moon'))await moons.select(params.get('moon'));else if(params.get('spacecraft'))spacecraft.select(params.get('spacecraft'));else if(r)enter(r);else if(s)values.enter(s);else if(selected?.startsWith('PLACE_')){const f=places.features.find(f=>'PLACE_'+f.id===selected);if(f)places.visit(f);}else if(selected==='COORDINATES'&&params.has('lon')&&params.has('lat')){const point=coordinateRegion(Number(params.get('lon')),Number(params.get('lat')));if(point)enter(point);}
 if(params.has('mission'))history.replaceState(null,'','#'+params.toString());
 const routeInputs=['route-allow-traverse','route-terrain','route-spacing','route-mass','route-gravity','route-slope','route-pull','route-sensor'];
 const overlayInputs=['science-opacity','magnetic-altitude','magnetic-opacity','contour-interval','science-variant'];
 const readInputs=ids=>Object.fromEntries(ids.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]));
 const restoreInputs=(values,ids)=>{for(const id of ids){const node=$(id),value=values[id];if(value===undefined||value===null)continue;if(node.type==='checkbox'){node.checked=value===true;}else if(node.tagName==='SELECT'){if([...node.options].some(o=>o.value===String(value)))node.value=String(value);}else if(Number.isFinite(Number(value))&&Number(value)>=Number(node.min)&&Number(value)<=Number(node.max))node.value=String(value);}};
 missions=new MissionLibrary({restoreCamp:({home,campSiteId})=>{Object.assign(routePlanner.workbench.state,{home,campSiteId});},capture:()=>{const c=viewer.camera.positionCartographic,p=map.getCenter();return {schema:MISSION_SCHEMA,commsCoverage:commsCoverage.snapshot(),userSites:userSites.snapshot(),perimeters:perimeterTool?.snapshot()??retainedPerimeters,view,appearance:appearanceMode,layers:layers.state,controls:readInputs(overlayInputs),relief:$('relief').checked,compareLinked,selection:{region:region?.id,center:region?.center,dataset:dataset?.id,spacecraft:spacecraft.selected?.id,moon:moons.selected??(moons.exploring?'system':undefined),moon_at:new Date(moons.at).toISOString(),moon_enhanced:moons.enhanced,moon_orbits:moons.orbits,moon_orbit_display:moons.orbitDisplay,orbiter:moons.selectedOrbiter,system_live:moons.mode==='now',system_orbiters:moons.showOrbiters},camera:{lon:C.Math.toDegrees(c.longitude),lat:C.Math.toDegrees(c.latitude),height:c.height,heading:viewer.camera.heading,pitch:viewer.camera.pitch,roll:viewer.camera.roll},flat:{lon:((p.lng+180)%360+360)%360-180,lat:p.lat,zoom:map.getZoom()},measurement:{points:measurement.line.points,mode:measurement.line.mode,unit:measurement.unit,snap:$('measure-snap').checked},route:{start:routePlanner.start??null,goal:routePlanner.goal??null,targets:routePlanner.targets,sites:routePlanner.siteSettings,operation:routePlanner.workbench.snapshot(),settings:readInputs(routeInputs),shown:routePlanner.shown,result:routePlanner.result??null}};},restore:async (state,{automatic})=>{
  userSites.restore(state.userSites);
  retainedPerimeters=state.perimeters;commsCoverage.restore(state.commsCoverage);
  perimeterTool?.restore(state.perimeters,{automatic});
  routePlanner.cancel();navigation.setMode('pan');viewer.camera.cancelFlight();clearSurface();spacecraft.clearSelection();region=null;
  const saved=state.selection,known=regions.find(r=>r.id===saved.region);if(known)enter(known);else if(Array.isArray(saved.center)){const r=coordinateRegion(...saved.center);if(r)enter(r);}
  const d=catalog.datasets.find(d=>d.id===saved.dataset&&d.status==='complete');if(d&&region&&d.id!==dataset?.id)selectDataset(d,false);
  if(saved.spacecraft)spacecraft.select(saved.spacecraft,{fly:false});viewer.camera.cancelFlight();
  layers.restore(automatic?{...state.layers,footprints:layers.state.footprints}:state.layers);
  restoreInputs(state.controls,overlayInputs);for(const id of overlayInputs){$(id).dispatchEvent(new Event(id.endsWith('opacity')?'input':'change'));}
  terrainRelief.set(state.relief);
  if(!automatic)setAppearance(state.appearance);compareLinked=state.compareLinked;$('compare-link').setAttribute('aria-pressed',String(compareLinked));$('compare-link').textContent=compareLinked?'Views linked':'Views independent';setView(state.view);
  if(saved.moon||saved.orbiter){const clock=restoredSystemTime(saved);moons.choose(clock.at,clock.mode);}
  if(saved.moon&&['phobos','deimos','system'].includes(saved.moon)){$('moons-enhance').checked=saved.moon_enhanced===true;moons.enhanced=$('moons-enhance').checked;moons.setOrbitDisplay(saved.moon_orbit_display??(saved.moon_orbits===false?'hidden':'path'));moons.settings();if(saved.moon==='system'&&!saved.orbiter)await moons.system({play:false});else if(!saved.orbiter)await moons.select(saved.moon,{fly:false,live:false});}if(typeof saved.system_orbiters==='boolean'){$('moons-orbiters').checked=saved.system_orbiters;moons.showOrbiters=saved.system_orbiters;}if(saved.orbiter)await moons.selectOrbiter(saved.orbiter,{fly:false,live:false});
  restoreInputs(state.route.settings,routeInputs);Object.assign(routePlanner,{start:state.route.start,goal:state.route.goal,targets:state.route.targets,siteSettings:state.route.sites,result:state.route.result,shown:state.route.shown});routePlanner.workbench.restore(state.route.operation);routePlanner.render();routePlanner.status(state.route.result?'Saved results restored. Recalculate to use newly available terrain.':'Saved endpoints restored. Compare routes when ready.');
  Object.assign(measurement.line,{points:state.measurement.points,mode:state.measurement.mode,drawing:false});measurement.unit=state.measurement.unit;$('measure-unit').value=measurement.unit;$('measure-snap').checked=state.measurement.snap;measurement.update();
  if(state.flat)comparison.programmatic(()=>map.setView([state.flat.lat,state.flat.lon],state.flat.zoom,{animate:false}));
  if(state.camera){viewer.camera.cancelFlight();const c=state.camera;viewer.camera.setView({destination:C.Cartesian3.fromDegrees(c.lon,c.lat,c.height,ellipsoid),orientation:{heading:c.heading,pitch:c.pitch,roll:c.roll}});}if(moons.selected)moons.frame(moons.selected);else if(moons.selectedOrbiter)moons.orbiters.frame(moons.selectedOrbiter);viewer.scene.requestRender();
 },onOpen:()=>{appearance(false);measurement.open(false);routePlanner.open(false);solarLighting?.open(false);dustPredictor?.open(false);seismology?.open(false);missionDeployer?.open(false);}});
 viewer.camera.moveEnd.addEventListener(()=>missions.schedule());map.on('moveend',()=>missions.schedule());
 if(desktopState)installSeismicReplay({viewer,map,mini,leaflet:L,locate:point=>{
  if(moons?.exploring)home();
  navigation.setMode('pan');
  if(view==='2d')map.setView([point[1],point[0]],11);
  else navigation.focusOn(point,30);
 }});
 new CampControls({viewer,map,mini,camp:currentCamp,visit:visitCamp,deploy:deployAtCamp,assignPerimeter:pyxis?camp=>{if(camp)perimeterTool.assign({kind:'camp',point:camp.point});}:undefined,inSpace:()=>Boolean(moons?.exploring),flatPick:event=>{if(userSites.picking){userSites.addFlat(event);return true;}return userSites.host.flatPick(event);},changed:()=>userSites.draw(),returnToCamp:()=>assistant.executeEmergencyReturn(),destination:()=>{try{setCampDestination(routePlanner);routePlanner.status('Camp set as destination. Choose a start if needed, then Compare routes.');}catch(error){routePlanner.status(error.message);}}});
 if(desktopState){
  let visitTimer;
  const visitDesktopMap=()=>{clearTimeout(visitTimer);visitTimer=setTimeout(()=>{if(moons?.exploring&&view!=='2d')return;const flat=view==='2d'?currentSurfaceFocus():null,focus=flat?{point:flat.point,width:360/2**map.getZoom()*Math.PI/180*R/1000}:current3DCameraFocus();if(!focus?.point)return;const metresPerPixel=focus.width*1000/Math.max(1,view==='2d'?map.getSize().x:viewer.canvas.clientWidth);window.marsDesktop.visitMap({point:focus.point,metresPerPixel}).catch(e=>console.warn('map_download_policy',e.message));},700);};
  viewer.camera.moveEnd.addEventListener(visitDesktopMap);map.on('moveend',visitDesktopMap);
  window.marsDesktop.onMapsChanged(async()=>{try{const selected=dataset;await refresh(true);if(selected?.desktopStorage==='verified-local-package'&&!catalog.datasets.some(d=>d.id===selected.id)){clearSurface();updateCoverage();}if(!region){const focus=currentSurfaceFocus()?.point;const local=focus&&catalog.datasets.filter(d=>d.desktopStorage==='verified-local-package'&&inside(focus,d.bounds)).sort((a,b)=>Math.max(...a.imagery_grid_m)-Math.max(...b.imagery_grid_m))[0];if(local)selectDataset(local,false);}}catch(e){console.warn('local_map_refresh',e.message);}});
 }

 if(window.marsDesktop?.diagnosticsEnabled)window.__atlasDiagnostics=()=>({globe:viewer.scene.globe.show,tilesLoaded:viewer.scene.globe.tilesLoaded,renderedTiles:viewer.scene.globe._surface?._tilesToRender?.length,layers:[...Array(viewer.imageryLayers.length)].map((_,i)=>({show:viewer.imageryLayers.get(i).show,alpha:viewer.imageryLayers.get(i).alpha})),selectedDataset:dataset?.id,coverage:document.getElementById('coverage-state')?.textContent,terrain:viewer.terrainProvider.constructor.name,canvas:viewer.canvas.width+'x'+viewer.canvas.height,roots:viewer.scene.globe._surface?._levelZeroTiles?.map(t=>({x:t.x,y:t.y,state:t.state,renderable:t.renderable,terrain:t.data?.terrainState,imagery:t.data?.imagery?.map(i=>({state:i.readyImagery?.state,loading:i.loadingImagery?.state}))})),resources:performance.getEntriesByType('resource').filter(r=>/Worker|mola|overview/.test(r.name)).map(r=>({name:r.name,status:r.responseStatus,duration:r.duration}))});
 if(window.marsDesktop?.diagnosticsEnabled)window.__atlasSmokeRegion=()=>{const area=regions.find(item=>keys[item.id]===catalog.datasets[0]?.region);if(area){enter(area);document.getElementById('fit').click();}return Boolean(area);};
 if(window.marsDesktop?.diagnosticsEnabled)window.__atlasSmokeFocus=point=>navigation.focusOn(point,3);
 await missions.init();
 document.dispatchEvent(new Event('atlas-mission-change'));
 if(!desktopState&&'serviceWorker' in navigator)navigator.serviceWorker.register('/tile-worker.js').catch(()=>console.info('Browser tile cache unavailable; using network delivery.'));
 setInterval(()=>{if(catalog?.build_status!=='complete')refresh().catch(e=>console.warn(e.message));},60000);
}
initInterface();document.dispatchEvent(new Event('atlas-interface-ready'));
if(new URLSearchParams(location.search).get('map')==='basic2d')import('./basic-map.js').then(m=>m.openBasicMap()).catch(showGraphicsRecovery);
else boot().then(()=>{document.documentElement.dataset.atlasReady='true';document.dispatchEvent(new Event('atlas-ready'));}).catch(showGraphicsRecovery);
import './voice-activity.css';

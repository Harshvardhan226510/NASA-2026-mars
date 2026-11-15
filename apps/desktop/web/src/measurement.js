import L from 'leaflet';
import {MeasurementLine,lineDistances,distanceLabel,areaLabel,polygonMetrics,measurementPins,measurementBoundary,flatMeasurementPath,nearestMeasurementPoint,marsDistance} from './measurement-geometry.js';
import {projectMeasurementPin} from './measurement-projection.js';
import {terrainMeasurementLegs,measurementPositions} from './measurement-terrain.js';
import {reticlePoint,clientPoint} from './view-focus.js';
const $=id=>document.getElementById(id);
const colorHex='#ffd278';

export class MeasureTool{
 constructor(viewer,map,mini,{navigation,view,onOpen,surface=()=>null}){
  Object.assign(this,{viewer,map,mini,navigation,view,onOpen,surface,line:new MeasurementLine(),unit:'auto',ctrlDisabled:false});
  const C=window.Cesium;
  this.source=new C.CustomDataSource('Distance and area measurements');viewer.dataSources.add(this.source);
  this.previewSource=new C.CustomDataSource('Measurement drawing preview');viewer.dataSources.add(this.previewSource);
  this.layers=[map,mini].map(m=>L.layerGroup().addTo(m));this.previewLayer=L.layerGroup().addTo(map);
  [map,mini].forEach((m,i)=>m.on('moveend',()=>{if(this.line.drawing||this.lastPointer)this.clearPreview();this.drawFlat(i);}));
  viewer.camera.moveStart.addEventListener(()=>this.clearPreview());
  $('measure-toggle').onclick=()=>this.open($('measure-panel').hidden);
  $('measure-close').onclick=()=>this.open(false);
  $('measure-new').onclick=()=>{this.line.start();this.navigation.setMode('pan');this.update();};
  $('measure-finish').onclick=()=>{if(this.drawing)this.finish();else{this.line.drawing=true;this.update();}};
  $('measure-undo').onclick=()=>{this.line.undo();this.update();};
  $('measure-clear').onclick=()=>{this.line.clear();this.update();};
  $('measure-centre').onclick=()=>{if(this.view()==='2d'){const p=reticlePoint(map.getContainer()),screen=L.point(p.x,p.y);this.addFlat({containerPoint:screen,latlng:map.containerPointToLatLng(screen)});}else{const p=reticlePoint(viewer.canvas);this.add3D(new C.Cartesian2(p.x,p.y));}};
  // Typed coordinates are exact input, independent of the current display scale.
  $('measure-coordinates').onsubmit=e=>{e.preventDefault();this.add([Number($('measure-lon').value),Number($('measure-lat').value)]);};
  $('measure-unit').onchange=()=>{this.unit=$('measure-unit').value;this.update();};
  $('measure-snap').onchange=()=>this.clearPreview();
  for(const button of document.querySelectorAll('[data-measure-mode]'))button.onclick=()=>{this.line.mode=button.dataset.measureMode;this.update();};
  $('measure-save').onclick=()=>{const blob=new Blob([JSON.stringify(this.line.export(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Mars_measured_${this.line.mode==='area'?'area':'line'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  viewer.canvas.addEventListener('pointermove',e=>{
   if(!this.drawing)return;if(e.buttons){this.clearPreview();return;}
   this.schedulePreview({kind:'3d',screen:clientPoint(viewer.canvas,e.clientX,e.clientY),ctrlKey:e.ctrlKey,pointerType:e.pointerType});
  });
  viewer.canvas.addEventListener('pointerleave',()=>this.clearPreview());
  viewer.canvas.addEventListener('pointerdown',e=>{this.pointerType=e.pointerType;});
  viewer.canvas.addEventListener('dblclick',e=>{if(this.drawing){e.preventDefault();this.finish();}});
  map.on('mousemove',e=>{if(this.drawing)this.schedulePreview({kind:'2d',screen:e.containerPoint,point:[e.latlng.lng,e.latlng.lat],ctrlKey:e.originalEvent?.ctrlKey});});
  map.on('mouseout movestart',()=>this.clearPreview());
  map.on('dblclick',()=>{if(this.drawing)this.finish();});
  // Cesium dispatches modified clicks separately from its ordinary LEFT_CLICK.
  this.modifiedPicker=new C.ScreenSpaceEventHandler(viewer.canvas);
  this.modifiedPicker.setInputAction(click=>{if(this.drawing)this.add3D(click.position,{ctrlKey:true});},C.ScreenSpaceEventType.LEFT_CLICK,C.KeyboardEventModifier.CTRL);
  document.addEventListener('keydown',e=>{
   if($('measure-panel').hidden)return;
   if(e.key==='Control'){this.ctrlDisabled=true;this.refreshPointer();return;}
   if(e.key==='Escape'){this.line.drawing=false;this.update();return;}
   if(e.target.closest?.('input,select,textarea,button,a,summary,[contenteditable=true]'))return;
   if(e.key==='Enter'&&this.drawing){e.preventDefault();this.finish();}
   else if(e.key==='Backspace'&&this.drawing){e.preventDefault();this.line.undo();this.update();}
  });
  document.addEventListener('keyup',e=>{if(e.key==='Control'){this.ctrlDisabled=false;this.refreshPointer();}});
  window.addEventListener('blur',()=>{this.ctrlDisabled=false;this.clearPreview();});
  this.update();
 }
 get drawing(){return this.line.drawing;}
 get area(){return this.line.mode==='area';}
 open(show){$('measure-panel').hidden=!show;$('measure-toggle').setAttribute('aria-expanded',String(show));if(show){this.onOpen?.();this.navigation.setMode('pan');if(!this.line.points.length)this.line.drawing=true;}else this.line.drawing=false;this.update();}
 setVisible(show){this.visible=show;this.source.show=show;this.previewSource.show=show;for(const [i,layer] of this.layers.entries()){const map=[this.map,this.mini][i];if(show)layer.addTo(map);else layer.remove();}if(show)this.previewLayer.addTo(this.map);else this.previewLayer.remove();if(!show)this.clearPreview();this.viewer.scene.requestRender();}
 finish(){try{if(this.line.finish())this.update();else $('measure-message').textContent=`Place at least ${this.area?'three':'two'} points to finish.`;}catch(e){$('measure-message').textContent=e.message;}}
 add(point,snap=null){
  try{
   if(!this.drawing)return;
   const existing=measurementPins(this.line.points).pins.find(p=>marsDistance(p.point,point)<.1),sameEnd=this.line.points.length&&marsDistance(this.line.points.at(-1),point)<.1;
   if(sameEnd){this.clearPreview();$('measure-message').textContent=`Point ${existing.number} is already the endpoint · no duplicate point or distance added.`;return;}
   if(this.area&&existing?.number===1&&this.line.points.length>=3){this.finish();return;}
   if(this.area&&existing){$('measure-message').textContent='This boundary already uses that point. Close at point 1 or choose another location.';return;}
   if(this.line.add(point)){this.update();if(existing)$('measure-message').textContent=`Returned to point ${existing.number} · return distance included; original pin number kept.`;}
  }catch(e){$('measure-message').textContent=e.message;}
 }
 raw3D(screen){
  const C=window.Cesium,scene=this.viewer.scene,camera=this.viewer.camera,ellipsoid=scene.globe.ellipsoid;
  let hit;try{const surface=this.surface(),picked=surface?.shown&&scene.pickPositionSupported?scene.pick(screen):null;if(surface?.shown?.some(n=>n.primitive===picked?.primitive))hit=scene.pickPosition(screen);}catch{}
  hit??=scene.globe.pick(camera.getPickRay(screen),scene)??camera.pickEllipsoid(screen,ellipsoid);
  if(!hit)return null;const p=ellipsoid.cartesianToCartographic(hit);return [C.Math.toDegrees(p.longitude),C.Math.toDegrees(p.latitude)];
 }
 project3D(point){
  return projectMeasurementPin(window.Cesium,this.viewer.scene,point,this.surface());
 }
 snapAt(screen,kind,{ctrlKey=this.ctrlDisabled,pointerType=this.pointerType}={}){
  if(!$('measure-snap').checked||ctrlKey||!screen)return null;
  const candidates=measurementPins(this.line.points).pins.map(({point,index,number})=>{
   let projected;if(kind==='3d')projected=this.project3D(point);else{const lon=point[0]+360*Math.round((this.map.getCenter().lng-point[0])/360);projected=this.map.latLngToContainerPoint([point[1],lon]);const size=this.map.getSize();if(projected.x<0||projected.y<0||projected.x>size.x||projected.y>size.y)projected=null;}
   return {point,index,number,screen:projected};
  });
  return nearestMeasurementPoint(screen,candidates,pointerType==='touch'?22:14);
 }
 add3D(screen,options={}){
  const snap=this.snapAt(screen,'3d',options),point=snap?.point??this.raw3D(screen);
  if(point)this.add(point,snap);else $('measure-message').textContent='Choose a point on the visible Martian surface.';
 }
 addFlat(event){const snap=this.snapAt(event.containerPoint,'2d',{ctrlKey:event.originalEvent?.ctrlKey??this.ctrlDisabled,pointerType:event.originalEvent?.pointerType});this.add(snap?.point??[event.latlng.lng,event.latlng.lat],snap);}
 schedulePreview(pointer){this.lastPointer=pointer;if(this.previewFrame)return;this.previewFrame=requestAnimationFrame(()=>{this.previewFrame=null;if(this.drawing&&this.lastPointer)this.showPreview(this.lastPointer);});}
 refreshPointer(){if(this.lastPointer)this.schedulePreview({...this.lastPointer,ctrlKey:this.ctrlDisabled});}
 showPreview(pointer){
  const snap=this.snapAt(pointer.screen,pointer.kind,pointer),point=snap?.point??(pointer.kind==='3d'?this.raw3D(pointer.screen):pointer.point);
  if(!point){this.clearPreview();return;}
  const C=window.Cesium,committed=this.line.points,points=[...committed];
  if(!points.length||marsDistance(points.at(-1),point)>=.1){if(!(this.area&&snap?.index===0&&points.length>=3))points.push(point);}
  const metric=this.values(points),distance=committed.length?marsDistance(committed.at(-1),point):0;
  $('measure-preview').textContent=snap?`Locked to point ${snap.number}${distance<.1?' · already the endpoint':this.area&&snap.number===1&&committed.length>=3?' · click to close':''}`:committed.length?`Next segment ≈ ${distanceLabel(distance,this.unit)}`:'Click to place the first point';
  $('measure-preview').dataset.snapped=String(Boolean(snap));this.displayValues(points,true);
  const host=pointer.kind==='3d'?this.viewer.canvas:this.map.getContainer(),bounds=host.getBoundingClientRect(),workspace=$('workspace').getBoundingClientRect(),position=snap?.screen??pointer.screen,cursor=$('measure-cursor');
  cursor.hidden=false;cursor.classList.toggle('is-snapped',Boolean(snap));cursor.style.left=`${bounds.left-workspace.left+position.x}px`;cursor.style.top=`${bounds.top-workspace.top+position.y}px`;
  $('measure-cursor-label').textContent=(snap?`Point ${snap.number} · `:'')+(this.area?(metric.area===null?'Area preview':areaLabel(metric.area,this.unit)):distanceLabel(metric.total,this.unit));
  this.previewSource.entities.removeAll();this.previewLayer.clearLayers();
  if(committed.length){const path=[committed.at(-1),point,...(this.area&&committed.length>=2?[committed[0]]:[])];
   for(const leg of terrainMeasurementLegs(path))this.previewSource.entities.add({polyline:{positions:new C.CallbackProperty(measurementPositions(C,this.viewer.scene,leg,this.surface),false),arcType:C.ArcType.NONE,clampToGround:false,width:3,material:new C.PolylineDashMaterialProperty({color:C.Color.fromCssColorString(colorHex),dashLength:12})}});
   L.polyline(flatMeasurementPath(path,this.map.getCenter().lng),{color:colorHex,weight:3,dashArray:'6 5',interactive:false}).addTo(this.previewLayer);
  }
  this.viewer.scene.requestRender();
 }
 clearPreview(){
  this.lastPointer=null;if(this.previewFrame){cancelAnimationFrame(this.previewFrame);this.previewFrame=null;}
  $('measure-cursor').hidden=true;$('measure-preview').textContent='';$('measure-preview').dataset.snapped='false';
  const hadPreview=this.previewSource.entities.values.length>0||this.previewLayer.getLayers().length>0;
  this.previewSource.entities.removeAll();this.previewLayer.clearLayers();this.displayValues(this.line.points,false);
  if(hadPreview)this.viewer.scene.requestRender();
 }
 values(points){return this.area?{...lineDistances(points),...polygonMetrics(measurementBoundary(points))}:lineDistances(points);}
 displayValues(points,preview=false){
  const metric=this.values(points);$('measure-total').textContent=this.area?(metric.area===null?'—':'≈ '+areaLabel(metric.area,this.unit)):'≈ '+distanceLabel(metric.total,this.unit);
  $('measure-total').setAttribute('aria-label',this.area?'Measured area':'Total surface distance');
  $('measure-perimeter').hidden=!this.area;$('measure-perimeter').textContent=this.area?'Perimeter ≈ '+distanceLabel(metric.perimeter,this.unit):'';
  $('measure-result-state').textContent=preview?'Live preview':this.area?'Area on Mars':'Distance on Mars';
 }
 update(){
  document.dispatchEvent(new Event('atlas-mission-change'));
  this.clearPreview();const {points,drawing}=this.line,{segments}=lineDistances(points),{pins,numbers}=measurementPins(points),boundary=measurementBoundary(points),metric=this.values(points),C=window.Cesium,minimum=this.area?3:2;
  document.body.classList.toggle('measure-drawing',drawing);$('measure-toggle').setAttribute('aria-pressed',String(!$('measure-panel').hidden));
  for(const button of document.querySelectorAll('[data-measure-mode]'))button.setAttribute('aria-pressed',String(button.dataset.measureMode===this.line.mode));
  $('measure-count').textContent=`${pins.length} pin${pins.length===1?'':'s'} · ${this.area?(metric.area===null?'area unavailable':'closed boundary'):`${segments.length} segment${segments.length===1?'':'s'}`}`;
  $('measure-message').textContent=drawing?(points.length?'Click to add points; double-click or Finish to complete.':'Click the map to place your first point.'):points.length?'Measurement saved in this view. Continue or start a new measurement.':'Start a new measurement to place points.';
  if(this.area){if(metric.invalidReason)$('measure-message').textContent=metric.invalidReason;else $('measure-message').textContent='Area calculated from your existing points, with a closing edge to point 1.';}
  $('measure-finish').textContent=drawing?'Finish':'Continue';$('measure-finish').disabled=drawing?points.length<minimum:points.length<1;
  for(const id of ['measure-centre','measure-add'])$(id).disabled=!drawing;
  for(const id of ['measure-undo','measure-clear'])$(id).disabled=!points.length;
  $('measure-save').disabled=points.length<minimum||(this.area&&this.values(points).area===null);
  $('measure-points').replaceChildren(...points.map((p,i)=>{const li=document.createElement('li'),n=document.createElement('strong'),location=document.createElement('span'),d=document.createElement('small');n.textContent=numbers[i];location.textContent=`${p[1].toFixed(5)}°, ${p[0].toFixed(5)}°E`;d.textContent=i?(numbers.slice(0,i).includes(numbers[i])?'Return +':'+')+distanceLabel(segments[i-1],this.unit):'Start';li.append(n,location,d);return li;}));
  if(drawing!==this.wasDrawing){
   const event=C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,handler=this.viewer.screenSpaceEventHandler;
   if(drawing){this.doubleClick=handler.getInputAction(event);handler.removeInputAction(event);this.mapDoubleClick=this.map.doubleClickZoom.enabled();this.map.doubleClickZoom.disable();}
   else{if(this.doubleClick)handler.setInputAction(this.doubleClick,event);if(this.mapDoubleClick)this.map.doubleClickZoom.enable();}
   this.wasDrawing=drawing;
  }
  this.source.entities.removeAll();const color=C.Color.fromCssColorString(colorHex),path=this.area&&metric.area!==null?[...boundary,boundary[0]]:points;
  if(this.area&&metric.area!==null)this.source.entities.add({polygon:{hierarchy:C.Cartesian3.fromDegreesArray(boundary.flat(),this.viewer.scene.globe.ellipsoid),material:color.withAlpha(.14),arcType:C.ArcType.GEODESIC}});
  for(const leg of terrainMeasurementLegs(path))this.source.entities.add({polyline:{positions:new C.CallbackProperty(measurementPositions(C,this.viewer.scene,leg,this.surface),false),arcType:C.ArcType.NONE,clampToGround:false,width:5,material:new C.PolylineOutlineMaterialProperty({color,outlineColor:C.Color.BLACK,outlineWidth:1})}});
  pins.forEach(({point:p,index,number})=>{const position=measurementPositions(C,this.viewer.scene,[p],this.surface),visible=new C.CallbackProperty(()=>Boolean(this.project3D(p)),false);const entity=this.source.entities.add({position:new C.CallbackPositionProperty(()=>position()[0],false),point:{show:visible,pixelSize:10,color,outlineColor:C.Color.BLACK,outlineWidth:2,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{show:visible,disableDepthTestDistance:Number.POSITIVE_INFINITY,text:String(number),font:'bold 13px sans-serif',fillColor:color,outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-18)}});entity.measurementIndex=index;});
  this.drawFlat(0);this.drawFlat(1);this.viewer.scene.requestRender();
 }
 drawFlat(index){
  const map=[this.map,this.mini][index],layer=this.layers[index];layer.clearLayers();if(!this.line.points.length)return;
  const boundary=measurementBoundary(this.line.points),ring=this.area&&this.values(this.line.points).area!==null?[...boundary,boundary[0]]:this.line.points,points=flatMeasurementPath(ring,map.getCenter().lng);
  if(this.area&&this.line.points.length>=3&&this.values(this.line.points).area!==null)L.polygon(points,{color:colorHex,weight:0,fillOpacity:.14,interactive:false}).addTo(layer);
  if(points.length>1){L.polyline(points,{color:'#10151a',weight:6,interactive:false}).addTo(layer);L.polyline(points,{color:colorHex,weight:3,interactive:false}).addTo(layer);}
  let reference=map.getCenter().lng;
  measurementPins(this.line.points).pins.forEach(({point:p,number})=>{const lon=p[0]+360*Math.round((reference-p[0])/360);reference=lon;L.marker([p[1],lon],{interactive:false,keyboard:false,icon:L.divIcon({className:'measurement-pin',html:`<span>${number}</span>`,iconSize:[24,24],iconAnchor:[12,12]})}).addTo(layer);});
 }
}

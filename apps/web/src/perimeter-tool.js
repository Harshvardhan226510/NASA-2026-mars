import L from 'leaflet';
import {measurementPositions} from './measurement-terrain.js';
import {areaLabel,distanceLabel,flatMeasurementPath,marsDistance,measurementPoint,polygonMetrics} from './measurement-geometry.js';
import {sameCampPoint} from './mission-camp.js';
import {coordinateText} from './surface-readout.js';
import {clientPoint} from './view-focus.js';
import {MAX_PERIMETERS,MAX_PERIMETER_POINTS,PERIMETERS_KEY,lassoVertices,mergePerimeters,validatePerimeter,validatePerimeters} from './perimeters.js';

const color='#72dbe9',activeColor='#ffd29a';
const node=(tag,text)=>Object.assign(document.createElement(tag),text===undefined?{}:{textContent:text});
const button=(text,action)=>Object.assign(node('button',text),{type:'button',onclick:action});

export class PerimeterTool{
 constructor(host){
  this.host=host;
  this.panel=document.getElementById('perimeter-panel');
  this.records=[];this.points=[];this.picking=false;
  try{
   const stored=localStorage.getItem(PERIMETERS_KEY);
   if(stored!==null){this.records=validatePerimeters(JSON.parse(stored));this.hasStoredRecords=true;}
  }catch{}
  this.source=new window.Cesium.CustomDataSource('Saved and draft perimeters');
  host.viewer.dataSources.add(this.source);
  this.maps=[host.map,host.mini];
  this.groups=this.maps.map(map=>L.layerGroup().addTo(map));
  this.worldCopies=[];
  this.maps.forEach((map,index)=>map.on('moveend',()=>{
   if(this.worldCopyKey(map.getCenter().lng)!==this.worldCopies[index])this.drawFlat();
  }));
  const form=this.panel.querySelector('form');
  this.name=form.querySelector('#perimeter-name');
  this.target=form.querySelector('#perimeter-target');
  this.vertices=form.querySelector('#perimeter-vertices');
  this.report=this.panel.querySelector('#perimeter-status');
  this.list=this.panel.querySelector('#perimeter-list');
  this.drawButton=form.querySelector('#perimeter-draw');
  this.lassoButton=form.querySelector('#perimeter-lasso');
  this.undo=form.querySelector('#perimeter-undo');
  this.clear=form.querySelector('#perimeter-clear');
  this.saveButton=form.querySelector('[type="submit"]');
  this.drawButton.onclick=()=>this.pick(!this.picking);
  this.lassoButton.onclick=()=>this.setLasso(!this.lassoActive);
  this.undo.onclick=()=>{this.points.pop();this.updateDraft();};
  this.clear.onclick=()=>{this.points=[];this.updateDraft();};
  form.querySelector('#perimeter-crosshair').onclick=()=>{this.setLasso(false);this.add(host.centre());};
  this.lassoSurfaces=[
   this.lassoOverlay(host.viewer.canvas.closest('#globe'),(x,y)=>{const p=clientPoint(host.viewer.canvas,x,y);return this.point3D(new window.Cesium.Cartesian2(p.x,p.y));}),
   this.lassoOverlay(host.map.getContainer(),(x,y)=>{const p=host.map.mouseEventToLatLng({clientX:x,clientY:y});return measurementPoint([p.lng,p.lat]);})
  ];
  this.panel.querySelector('#perimeter-new').onclick=()=>this.edit();
  form.onsubmit=event=>{event.preventDefault();this.save();};
  new MutationObserver(()=>{
   if(this.panel.hidden)this.pick(false);
   else this.targets();
   this.draw();
  }).observe(this.panel,{attributes:true,attributeFilter:['hidden']});
  this.panel.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&(this.picking||this.lassoActive)){
    event.stopPropagation();this.pick(false);this.message('Drawing paused. Your draft is still here.');
   }
  });
  document.addEventListener('atlas-mission-change',()=>{
   if(this.panel.hidden)return;
   const signature=JSON.stringify([host.camp(),host.sites().map(site=>[site.id,site.name])]);
   if(signature!==this.targetSignature){this.targetSignature=signature;this.targets();this.renderList();}
  });
  this.edit();
 }
 snapshot(){return validatePerimeters(this.records);}
 restore(incoming,{automatic=false}={}){
  if(incoming?.length&&!(automatic&&this.hasStoredRecords))this.persist(mergePerimeters(this.records,incoming));
 }
 setVisible(visible){
  if(this.visible!==visible){this.visible=visible;this.draw();}
 }
 persist(records){
  localStorage.setItem(PERIMETERS_KEY,JSON.stringify(records));
  this.records=records;this.hasStoredRecords=true;this.draw();this.renderList();
  document.dispatchEvent(new Event('atlas-mission-change'));
 }
 assign(target){
  this.host.open();
  const existing=this.records.find(record=>target.kind==='site'
   ?record.target?.kind==='site'&&record.target.id===target.id
   :record.target?.kind==='camp'&&sameCampPoint(record.target.point,target.point));
  this.edit(existing,target);
  if(!existing)this.name.value=target.kind==='camp'?`${this.host.camp()?.name??'Camp'} perimeter`.slice(0,80):`${this.host.sites().find(site=>site.id===target.id)?.name??'Site'} perimeter`.slice(0,80);
  if(!this.panel.hidden){this.pick(true);this.name.focus({preventScroll:true});}
 }
 targets(preferred=this.target.value){
  const options=[new Option('Standalone perimeter','')],camp=this.host.camp();
  if(camp)options.push(new Option('Camp · '+camp.name,'camp'));
  for(const site of this.host.sites())options.push(new Option(site.name,site.id));
  const target=this.originalTarget;
  if(target?.kind==='camp'&&!sameCampPoint(target.point,camp?.point))options.push(new Option('Previous camp · '+coordinateText(target.point),'previous'));
  if(target?.kind==='site'&&!this.host.sites().some(site=>site.id===target.id))options.push(new Option('Previously marked site','previous'));
  this.target.replaceChildren(...options);
  this.target.value=options.some(option=>option.value===preferred)?preferred:'';
 }
 edit(record,target=record?.target){
  this.pick(false);
  this.editId=record?.id;
  this.name.value=record?.name??'';
  this.points=record?.points.map(point=>[...point])??[];
  this.originalTarget=target;
  this.targets(target?.kind==='camp'?(sameCampPoint(target.point,this.host.camp()?.point)?'camp':'previous'):target?.kind==='site'?(this.host.sites().some(site=>site.id===target.id)?target.id:'previous'):'');
  this.saveButton.textContent=record?'Save changes':'Save perimeter';
  this.message(record?'Edit the name or association, or redraw the boundary.':'Add at least three vertices, then name and save the boundary.');
  this.updateDraft();this.renderList();
 }
 message(text){this.report.textContent=text;}
 pick(on){
  this.setLasso(false);
  if(on){this.host.beforePick();this.message('Tap the map to place vertices. You can still drag to pan.');}
  this.picking=on;
  this.drawButton.textContent=on?'Pause drawing':'Draw on map';
  this.drawButton.setAttribute('aria-pressed',String(on));
  document.body.classList.toggle('perimeter-picking',on);
 }
 setLasso(on){
  if(on){this.pick(false);this.host.beforePick();this.message('Drag around the area on the map, then release. A valid lasso replaces the draft.');}
  this.lassoActive=on;
  this.lassoButton.setAttribute('aria-pressed',String(on));
  for(const surface of this.lassoSurfaces){surface.hidden=!on;if(!on)surface.cancelStroke();}
 }
 lassoOverlay(container,toPoint){
  const overlay=node('div');
  overlay.className='pyxis-lasso-surface';overlay.hidden=true;
  overlay.innerHTML='<svg aria-hidden="true"><polyline/></svg>';
  const line=overlay.querySelector('polyline');
  let pointer=null,stroke=[];
  const clear=()=>{
   const id=pointer;pointer=null;stroke=[];line.removeAttribute('points');
   if(id!==null&&overlay.hasPointerCapture(id))overlay.releasePointerCapture(id);
  };
  overlay.cancelStroke=clear;
  const append=event=>{
   const point=[event.clientX,event.clientY],previous=stroke.at(-1);
   if(previous&&Math.hypot(point[0]-previous[0],point[1]-previous[1])<4)return;
   if(stroke.length>=512)stroke=stroke.filter((_,i)=>i%2===0);
   stroke.push(point);
   const bounds=overlay.getBoundingClientRect();
   line.setAttribute('points',stroke.map(([x,y])=>`${x-bounds.left},${y-bounds.top}`).join(' '));
  };
  overlay.onpointerdown=event=>{
   if(pointer!==null||!event.isPrimary||event.button!==0)return;
   event.preventDefault();event.stopPropagation();pointer=event.pointerId;overlay.setPointerCapture(pointer);append(event);
  };
  overlay.onpointermove=event=>{if(event.pointerId===pointer)append(event);};
  overlay.onpointerup=event=>{
   if(event.pointerId!==pointer)return;
   event.stopPropagation();append(event);
   const bounds=overlay.getBoundingClientRect();
   try{
    const points=lassoVertices(stroke).map(([x,y])=>x>=bounds.left&&x<bounds.right&&y>=bounds.top&&y<bounds.bottom?toPoint(x,y):null);
    if(points.some(point=>!point))throw Error('Keep the lasso on the visible Martian surface.');
    const boundary=validatePerimeter({id:'perimeter-draft',name:'Draft',points});
    this.points=boundary.points;this.setLasso(false);this.updateDraft();this.message('Lasso captured. Name and save the perimeter.');
   }catch(error){clear();this.message(`${error.message} Try drawing the lasso again.`);}
  };
  overlay.onpointercancel=overlay.onlostpointercapture=clear;
  overlay.onclick=overlay.ondblclick=overlay.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();};
  container.append(overlay);
  return overlay;
 }
 add(point){
  if(!point){this.message('Choose a point on the surface of Mars.');return;}
  try{
   const next=measurementPoint(point),first=this.points[0];
   if(this.points.length>=3&&marsDistance(first,next)<.5){this.pick(false);this.message('Boundary closed. Name it and select Save perimeter.');return;}
   if(this.points.some(vertex=>marsDistance(vertex,next)<.5))return;
   if(this.points.length>=MAX_PERIMETER_POINTS)throw Error('This perimeter has 64 vertices. Undo a point or save it.');
   this.points.push(next);this.updateDraft();
  }catch(error){this.message(error.message);}
 }
 point3D(screen){
  const {viewer}=this.host,C=window.Cesium,scene=viewer.scene,camera=viewer.camera;
  const ray=camera.getPickRay(screen),hit=(ray&&scene.globe.pick(ray,scene))??camera.pickEllipsoid(screen,scene.globe.ellipsoid);
  if(!hit)return null;
  const point=scene.globe.ellipsoid.cartesianToCartographic(hit);
  return [C.Math.toDegrees(point.longitude),C.Math.toDegrees(point.latitude)];
 }
 add3D(screen){this.add(this.point3D(screen));}
 addFlat(event){this.add([event.latlng.lng,event.latlng.lat]);}
 updateDraft(){
  this.undo.disabled=this.clear.disabled=!this.points.length;
  this.saveButton.disabled=this.points.length<3;
  const metrics=polygonMetrics(this.points);
  this.vertices.textContent=`${this.points.length} of ${MAX_PERIMETER_POINTS} vertices`+(metrics.area===null?'':` · ${areaLabel(metrics.area)} · ${distanceLabel(metrics.perimeter)} around`);
  this.draw();
 }
 save(){
  try{
   const selected=this.target.value,camp=selected==='camp'?this.host.camp():null;
   if(selected==='camp'&&!camp)throw Error('Declare camp before assigning a perimeter to it.');
   const target=camp?{kind:'camp',point:camp.point}:selected==='previous'?this.originalTarget:selected?{kind:'site',id:selected}:null;
   const record=validatePerimeter({id:this.editId??'perimeter-'+crypto.randomUUID(),name:this.name.value,points:this.points,target});
   this.persist(mergePerimeters(this.records,[record]));this.edit();this.message(`Saved “${record.name}”.`);
  }catch(error){this.message(error.message);}
 }
 renderList(){
  const camp=this.host.camp(),sites=this.host.sites();
  this.list.replaceChildren(...this.records.map(record=>{
   const card=node('article'),target=record.target,metrics=polygonMetrics(record.points);
   const association=target?.kind==='camp'
    ?sameCampPoint(target.point,camp?.point)?'Camp · '+camp.name:'Previous camp · '+coordinateText(target.point)
    :target?.kind==='site'?sites.find(site=>site.id===target.id)?.name??'Previously marked site':'Standalone';
   const actions=node('div');actions.className='pyxis-perimeter-actions';
   actions.append(button('View',()=>this.host.focus(record.points)),button('Edit',()=>this.edit(record)),button('Remove',()=>{
    try{this.persist(this.records.filter(item=>item.id!==record.id));if(this.editId===record.id)this.edit();this.message(`Removed “${record.name}”.`);}catch(error){this.message(error.message);}
   }));
   card.append(node('h3',record.name),node('p',`${association} · ${areaLabel(metrics.area)} · ${distanceLabel(metrics.perimeter)} around`),actions);
   return card;
  }));
  if(!this.records.length)this.list.append(node('p','No saved perimeters yet.'));
  this.panel.querySelector('#perimeter-new').disabled=this.records.length>=MAX_PERIMETERS&&!this.editId;
 }
 lines(){
  const lines=this.records.filter(record=>this.panel.hidden||record.id!==this.editId).map(({points})=>({points:[...points,points[0]],color}));
  if(this.points.length>1&&!this.panel.hidden)lines.push({points:this.points.length>=3?[...this.points,this.points[0]]:this.points,color:activeColor});
  return lines;
 }
 draw(){
  const {viewer,surface}=this.host,C=window.Cesium;
  this.source.entities.removeAll();
  const visible=!this.host.inSpace();
  this.source.show=visible;
  if(visible)for(const line of this.lines()){
   const points=flatMeasurementPath(line.points).map(([lat,lon])=>[lon,lat]);
   this.source.entities.add({polyline:{positions:new C.CallbackProperty(measurementPositions(C,viewer.scene,points,surface,1.5),false),arcType:C.ArcType.NONE,width:2,material:C.Color.fromCssColorString(line.color)}});
  }
  if(visible&&!this.panel.hidden)for(const point of this.points){
   const position=measurementPositions(C,viewer.scene,[point],surface,1.5);
   this.source.entities.add({position:new C.CallbackPositionProperty(()=>position()[0],false),point:{pixelSize:7,color:C.Color.fromCssColorString(activeColor),outlineColor:C.Color.BLACK,outlineWidth:1}});
  }
  this.drawFlat();viewer.scene.requestRender();
 }
 worldCopyKey(longitude){
  const anchors=this.records.map(record=>record.points[0][0]);
  if(!this.panel.hidden)anchors.push(...this.points.map(point=>point[0]));
  return anchors.map(lon=>Math.round((longitude-lon)/360)).join(',');
 }
 drawFlat(){
  const lines=this.host.inSpace()?[]:this.lines();
  this.groups.forEach((group,i)=>{
   group.clearLayers();const reference=this.maps[i].getCenter().lng;
   this.worldCopies[i]=this.worldCopyKey(reference);
   for(const line of lines)L.polyline(flatMeasurementPath(line.points,reference),{color:line.color,weight:2,interactive:false}).addTo(group);
   if(!this.panel.hidden&&!this.host.inSpace())for(const [lon,lat] of this.points)L.circleMarker([lat,lon+360*Math.round((reference-lon)/360)],{radius:4,color:activeColor,fillOpacity:1,interactive:false}).addTo(group);
  });
 }
}

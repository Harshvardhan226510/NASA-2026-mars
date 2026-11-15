import L from 'leaflet';
import {studyRings,leafletStudyRings,studyBounds,siteCoverage,markerSVG,valueCategories,aboveHorizon} from './value-geometry.js';
import {filterValueSites,screenClusters} from './value-filter.js';
import {distanceKm} from './place-context.js';
import {mapLabel,PIN_SIZE,PIN_ANCHOR} from './map-marker-style.js';
import {userValueSites} from './user-sites.js';
const $=id=>document.getElementById(id),PAGE=60;
export class ValueSites{
 constructor(viewer,map,mini,{catalog,onEnter,regions}){
  Object.assign(this,{viewer,map,mini,catalog,onEnter,regions,sites:[],found:[],page:0,selected:null,entities:new Map(),perimeters:new Map(),layerVisibility:{science:true,minerals:true,resources:true,boundaries:true}});
  this.mapLayer=L.layerGroup().addTo(map);this.miniLayer=L.layerGroup().addTo(mini);
  const C=window.Cesium;this.source=new C.CustomDataSource('Sites of value');viewer.dataSources.add(this.source);
  this.source.clustering.enabled=true;this.source.clustering.pixelRange=38;this.source.clustering.minimumClusterSize=4;
  this.source.clustering.clusterEvent.addEventListener((items,cluster)=>{cluster.label.show=true;cluster.label.text=items.length+' sites';cluster.label.font='12px sans-serif';cluster.label.fillColor=C.Color.WHITE;cluster.label.showBackground=true;cluster.label.backgroundColor=C.Color.fromCssColorString('#15212b');cluster.billboard.show=false;cluster.point.show=true;cluster.point.pixelSize=14;cluster.point.color=C.Color.fromCssColorString('#9aadc1');});
  viewer.camera.changed.addEventListener(()=>{clearTimeout(this.visibilityTimer);this.visibilityTimer=setTimeout(()=>this.updateVisibility(),120);});
  map.on('moveend zoomend',()=>this.update2D());mini.on('moveend zoomend',()=>this.updateMini());
  $('place-type').onchange=()=>this.menu();
  for(const id of ['value-category','value-landing','value-radius','value-evidence-filter'])$(id).onchange=()=>this.applyFilters();
  $('value-search').oninput=()=>this.applyFilters();
  $('value-prev').onclick=()=>{this.page--;this.list();};$('value-next').onclick=()=>{this.page++;this.list();};
  $('nearby-values').onclick=()=>this.openMenu();
  $('value-back').onclick=()=>this.openMenu();
 }
 async load(){
  const [data,audit]=await Promise.all([fetch('/value-sites.json').then(r=>r.json()),fetch('/value-imagery-audit.json').then(r=>r.ok?r.json():null).catch(()=>null)]);
  if(data.schema!=='mars-value-sites/1')throw new Error('Unexpected sites catalogue.');
  this.publishedSites=data.sites;this.sites=data.sites;this.audit=audit;
  this.landings=this.regions().filter(r=>['AP1','AP9','AP8','EM16','PM1'].includes(r.id));
  for(const r of this.landings){const option=document.createElement('option');option.value=r.id;option.textContent=r.name+' study surroundings';$('value-landing').append(option);}
  this.addPins();this.applyFilters();
 }
 setUserSites(sites){this.sites=[...this.publishedSites,...userValueSites(sites)];if(this.selected?.userDefined)this.clearSelection();this.applyFilters();}
 menu(){const type=$('place-type').value;$('region-menu').hidden=type!=='regions';$('value-menu').hidden=type!=='values';$('more-menu').hidden=type!=='more';if($('spacecraft-menu'))$('spacecraft-menu').hidden=type!=='spacecraft';if($('user-sites-menu'))$('user-sites-menu').hidden=type!=='user-sites';}
 landing(){return this.landings?.find(r=>r.id===$('value-landing').value);}
 prioritizeLanding(id){$('nearby-values').hidden=!this.landings?.some(r=>r.id===id);if(!this.landings?.some(r=>r.id===id))return;$('value-landing').value=id;$('value-radius').value='100';$('value-category').value='all';$('value-evidence-filter').value='all';$('value-search').value='';this.applyFilters();}
 resetLanding(){$('value-landing').value='all';$('nearby-values').hidden=true;this.applyFilters();}
 openMenu(){$('directory').hidden=false;$('detail').hidden=true;$('value-info').hidden=true;$('place-type').value='values';$('title').textContent=this.landing()?this.landing().name+' surroundings':'Sites of value';$('category').textContent='RESEARCH CATALOGUE';$('description').textContent='Explore source-linked science, mineral and crew-resource investigations. Evidence strength and image availability are shown separately.';this.menu();$('sidebar').scrollTop=0;}
 applyFilters(){
  this.page=0;this.found=filterValueSites(this.sites,{category:$('value-category').value,query:$('value-search').value,landing:this.landing(),radiusKm:Number($('value-radius').value),evidence:$('value-evidence-filter').value});
  $('value-radius').disabled=!this.landing();this.list();this.updateVisibility();this.mapSignature=null;this.update2D();
 }
 list(){
  this.page=Math.max(0,Math.min(this.page,Math.ceil(this.found.length/PAGE)-1));
  const landing=this.landing(),counts=Object.keys(valueCategories).map(c=>`${this.found.filter(s=>s.category===c).length.toLocaleString()} ${valueCategories[c].symbol}`).join(' · ');
  $('value-count').textContent=`${this.found.length.toLocaleString()} of ${this.sites.length.toLocaleString()} research records${landing?' · within '+$('value-radius').value+' km of '+landing.name:''}. ${counts}`;
  $('value-scope').textContent=landing?'Published study candidates, not NASA-selected landing sites. Overlapping surroundings can share records. Zero mineral results means no supported point in this catalogue; it does not prove absence.':'Publisher evidence and location basis are linked for every record. Nearby pins become mapped-feature perimeters or study windows. Fine-image coverage and extractability are separate.';
  $('value-list').replaceChildren(...this.found.slice(this.page*PAGE,(this.page+1)*PAGE).map(s=>{
   const b=document.createElement('button');b.className='value-row';b.style.setProperty('--site-color',valueCategories[s.category].color);b.setAttribute('aria-label','Explore value site '+s.name);
   const n=document.createElement('strong'),type=document.createElement('small'),quality=document.createElement('small');n.textContent=s.name;type.textContent=s.type+(landing?` · ${distanceKm(s.center,landing.center).toFixed(1)} km from ${landing.name}`:'');quality.textContent=siteCoverage(this.catalog(),s).text;quality.className='value-quality';b.append(n,type,quality);b.onclick=()=>this.enter(s);return b;
  }));
  if(!this.found.length){const p=document.createElement('p');p.textContent='No supported records match these filters. Try the wider surroundings or another evidence/category filter.';$('value-list').append(p);}
  $('value-prev').disabled=this.page===0;$('value-next').disabled=(this.page+1)*PAGE>=this.found.length;$('value-page').textContent=`Page ${this.page+1} of ${Math.max(1,Math.ceil(this.found.length/PAGE))}`;
 }
 addPins(){
  const C=window.Cesium;this.source.entities.suspendEvents();
  for(const s of this.sites){
   const entity=this.source.entities.add({id:'value-pin-'+s.id,position:C.Cartesian3.fromDegrees(...s.center,0,this.viewer.scene.globe.ellipsoid),billboard:{image:markerSVG(s.category),width:PIN_SIZE[0],height:PIN_SIZE[1],verticalOrigin:C.VerticalOrigin.BOTTOM,disableDepthTestDistance:Infinity},label:mapLabel(C,{text:s.name,show:false,pixelOffset:new C.Cartesian2(0,-53),disableDepthTestDistance:Infinity})});
   entity.valueSite=s;this.entities.set(s.id,entity);
  }
  this.source.entities.resumeEvents();
 }
 updateVisibility(){
  const C=window.Cesium,active=new Set(this.found.map(s=>s.id)),close=[];
  for(const [id,e] of this.entities){
   e.show=this.layerVisibility[e.valueSite.category]&&(active.has(id)||id===this.selected?.id)&&aboveHorizon(e.valueSite.center,this.viewer.camera.positionWC);
   if(!e.show)continue;
   const distance=C.Cartesian3.distance(this.viewer.camera.positionWC,e.position.getValue(C.JulianDate.now())),near=Math.max(2500,e.valueSite.radiusKm*8000);
   const nearby=distance<near||(id===this.selected?.id&&distance<Math.max(15000,near*2));e.label.show=nearby;e.billboard.heightReference=nearby?C.HeightReference.CLAMP_TO_GROUND:C.HeightReference.NONE;e.label.heightReference=e.billboard.heightReference;
   if(nearby&&this.layerVisibility.boundaries)close.push({s:e.valueSite,distance});
  }
  close.sort((a,b)=>(b.s.id===this.selected?.id)-(a.s.id===this.selected?.id)||a.distance-b.distance);
  const visible=new Set(close.slice(0,80).map(x=>x.s.id));
  for(const [id,entities] of this.perimeters)if(!visible.has(id)){for(const e of entities)this.source.entities.remove(e);this.perimeters.delete(id);}
  for(const {s} of close.slice(0,80))if(!this.perimeters.has(s.id)){
   const color=C.Color.fromCssColorString(valueCategories[s.category].color);
   this.perimeters.set(s.id,studyRings(s).map((ring,i)=>{const e=this.source.entities.add({id:`value-edge-${s.id}-${i}`,polyline:{positions:C.Cartesian3.fromDegreesArray(ring.flat(),this.viewer.scene.globe.ellipsoid),clampToGround:true,width:2,material:new C.PolylineDashMaterialProperty({color,dashLength:12})}});e.valueSite=s;return e;}));
  }
  this.viewer.scene.requestRender();
 }
 update2D(){
  if(!this.found.length){this.mapLayer.clearLayers();return;}
  const reference=this.map.getCenter().lng,bounds=this.map.getBounds().pad(.15),z=this.map.getZoom(),latlng=s=>[s.center[1],s.center[0]+360*Math.round((reference-s.center[0])/360)];
  const shown=this.found.filter(s=>!s.userDefined&&this.layerVisibility[s.category]&&bounds.contains(latlng(s)));
  if(this.selected&&!this.selected.userDefined&&this.layerVisibility[this.selected.category]&&!shown.includes(this.selected)&&bounds.contains(latlng(this.selected)))shown.push(this.selected);
  const signature=`${this.map.getZoom()}:${this.map.getCenter().toString()}:${shown.map(s=>s.id).join(',')}`;
  if(signature===this.mapSignature)return;this.mapSignature=signature;this.mapLayer.clearLayers();
  const groups=screenClusters(shown.filter(s=>s.id!==this.selected?.id),s=>this.map.latLngToContainerPoint(latlng(s)),z>=13?12:38);if(this.selected&&shown.includes(this.selected))groups.push([this.selected]);
  for(const group of groups){
   const s=group[0],color=valueCategories[s.category].color;
   if(group.length>1){const icon=L.divIcon({className:'value-cluster',html:`<span style="border-color:${color};color:${color}">${group.length}</span>`,iconSize:[34,34],iconAnchor:[17,17]});L.marker(latlng(s),{icon}).bindTooltip(`${group.length} ${valueCategories[s.category].label} records`).on('click',()=>this.map.setView(latlng(s),Math.min(22,z+2))).addTo(this.mapLayer);continue;}
   if(this.layerVisibility.boundaries&&(z>=11||s.id===this.selected?.id))L.polygon(leafletStudyRings(s,reference),{color,weight:2,dashArray:'7 5',fillOpacity:.055}).bindTooltip(s.name,{className:'value-tooltip'}).on('click',()=>this.enter(s)).addTo(this.mapLayer);
   L.marker(latlng(s),{icon:L.icon({iconUrl:markerSVG(s.category,s.id===this.selected?.id),iconSize:PIN_SIZE,iconAnchor:PIN_ANCHOR}),title:s.name,alt:s.name}).bindTooltip(s.name,{className:'value-tooltip',direction:'top',offset:[0,-37]}).on('click',()=>this.enter(s)).addTo(this.mapLayer);
  }
 }
 updateMini(){this.miniLayer.clearLayers();if(!this.selected||this.selected.userDefined||!this.layerVisibility.boundaries||!this.layerVisibility[this.selected.category])return;const s=this.selected;L.polygon(leafletStudyRings(s,this.mini.getCenter().lng),{color:valueCategories[s.category].color,weight:2,dashArray:'5 4',fillOpacity:0}).addTo(this.miniLayer);}
 setLayerVisibility(state){this.layerVisibility=state;this.updateVisibility();this.mapSignature=null;this.update2D();this.updateMini();}
 enter(s){this.selected=s;this.info(s);this.onEnter({...s,id:'VALUE_'+s.id,name:s.name,category:s.userDefined?'Your marked site':valueCategories[s.category].label,bbox:studyBounds(s),description:s.summary,archiveUrl:s.sources[0]?.url??'#',valueSite:s});this.updateVisibility();this.update2D();this.updateMini();}
 info(s){
  if(s.userDefined){$('value-info').hidden=false;$('value-evidence').textContent=s.evidence;$('value-location').textContent=s.coordinateNote;$('value-validation').textContent=s.validation;$('value-priority').textContent=s.personalValue?'Your site of value · eligible for nearby route stops':'Your marked location';$('value-detail').textContent=siteCoverage(this.catalog(),s).text;const edit=document.createElement('button');edit.textContent='Edit my site';edit.onclick=()=>this.onUserEdit?.(s);$('value-sources').replaceChildren(edit);return;}
  $('value-info').hidden=false;$('value-evidence').textContent=s.evidence;
  $('value-location').textContent=s.coordinateNote+'. Dashed perimeter: '+(s.geometry?s.perimeterMeaning:`${s.radiusKm} km radius study window, not a deposit boundary.`);
  $('value-validation').textContent=s.validation+(s.category==='resources'?' Crew use still requires access, purity, extraction and processing assessment.':'');
  $('value-priority').textContent=s.landingProximity?.length?s.landingProximity.map(p=>`${p.distanceKm.toFixed(1)} km from ${p.id}`).join(' · '):'Global research target · outside the five 300 km landing-study surroundings';
  const audit=this.audit?.sites.find(a=>a.id===s.id);$('value-detail').textContent=siteCoverage(this.catalog(),s).text+(audit?.candidate_count?` · ${audit.candidate_count} image catalogue candidates; usable-pixel audit pending`:'');
  const nodes=s.sources.map(source=>{const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener';a.textContent=source.title+' ↗';return a;});
  if(s.sourceRecord){const p=document.createElement('p');const r=s.sourceRecord;p.textContent='Source record: '+[r.dataset,r.product,r.file,r.fid!=null?'feature '+r.fid:'',r.rows?'rows '+r.rows.join(', '):'',r.omega?.length?'OMEGA '+r.omega.join(', '):'',r.crism?.length?'CRISM '+r.crism.join(', '):'',r.studySite].filter(Boolean).join(' · ');nodes.push(p);}
  $('value-sources').replaceChildren(...nodes);
 }
 clearSelection(){this.selected=null;$('value-info').hidden=true;this.updateMini();}
 refresh(){this.list();if(this.selected)this.info(this.selected);this.updateVisibility();this.mapSignature=null;this.update2D();}
}

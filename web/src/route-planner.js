import {routeMarkers} from './route-markers.js';
import {measurementPositions} from './measurement-terrain.js';
import L from 'leaflet';
import {MissionWorkbench} from './mission-workbench.js';
import {decodeReturnField} from './return-feasibility.js';
import {RETURN_ROUTE,returnRouteEntry} from './return-route.js';
import {addTerrainRoute,ROUTE_WIDTHS,ROUTE_PRIORITY,routeVisible,orderedRouteKeys,routePane} from './route-display.js';
import {routeTerrain} from './route-terrain.js';
import {routeGeoJSON,wrapRouteLongitude,routeRenderLegs} from './route-geometry.js';
import {routeProfile,profileChartPath,calculateTraverseRiskIndex,walkingTimeText} from './route-profile.js';
import {measurementRenderLegs,flatMeasurementPath} from './measurement-geometry.js';
import {nearbyRouteSites,routeSiteSettings,ROUTE_SITE_CATEGORIES,routeAttractors} from './route-sites.js';
const $=id=>document.getElementById(id);
const profiles={direct_safe:{name:'Direct safe',color:'#78d7a3',description:'Minimum modeled walking energy on the strict grid. Experimental slope fallback, if enabled, is separately flagged.'},apf_survey:{name:'APF survey',color:'#f0bd60',description:'The partner A* model, drawn toward high-priority checkpoints across the regional mission window.'},deep_science:{name:'Deep science',color:'#73cde3',description:'Exact checkpoint-order search by grid distance, followed by A* for each leg.'}};
const coord=p=>`${p[1].toFixed(5)}°, ${p[0].toFixed(5)}°E`;
const distance=m=>m>=1000?`${(m/1000).toFixed(2)} km`:`${m.toFixed(0)} m`;
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
export class RoutePlanner{
 constructor(viewer,map,mini,{catalog,dataset,sites,view,onOpen,navigation,onExample,radio,surface=()=>null}={}){
  Object.assign(this,{viewer,map,mini,catalog,dataset,sites,view,onOpen,navigation,onExample,radio,surface,targets:[],siteSettings:routeSiteSettings(),visible:true,shown:'all'});
  const C=window.Cesium;this.source=new C.CustomDataSource('Partner mission routes');viewer.dataSources.add(this.source);this.highlightSource=new C.CustomDataSource('Route profile sample');viewer.dataSources.add(this.highlightSource);this.layers=[map,mini].map(m=>L.layerGroup().addTo(m));this.highlightLayers=[map,mini].map(m=>L.layerGroup().addTo(m));
  $('route-toggle').onclick=()=>this.open($('route-panel').hidden);$('route-close').onclick=()=>this.open(false);
  for(const kind of ['start','goal','target'])$(`route-pick-${kind}`).onclick=()=>this.pick(kind);
  for(const kind of ['start','goal']){
   $(`route-${kind}-form`).onsubmit=e=>{e.preventDefault();this.setPoint(kind,[Number($(`route-${kind}-lon`).value),Number($(`route-${kind}-lat`).value)]);};
   $(`route-centre-${kind}`).onclick=()=>{const p=this.centre();if(p)this.setPoint(kind,p);};
  }
  for(const input of document.querySelectorAll('#route-settings input,#route-settings select'))input.addEventListener('change',()=>this.dirty());
  const updateSites=()=>{this.siteSettings=routeSiteSettings({...this.siteSettings,enabled:$('route-sites-enabled').checked,radiusKm:Number($('route-site-radius').value),categories:Object.keys(ROUTE_SITE_CATEGORIES).filter(c=>$('route-site-'+c).checked)});this.dirty();};
  for(const input of document.querySelectorAll('#route-site-controls input'))input.onchange=updateSites;
  $('route-site-radius').oninput=()=>{if($('route-site-radius').value&&$('route-site-radius').validity.valid)updateSites();};
  $('route-sites-reset').onclick=()=>{this.siteSettings={...this.siteSettings,excluded:[],priorities:{}};this.dirty();};
  $('route-plan').onclick=()=>this.plan();$('route-cancel').onclick=()=>{this.cancel();this.status('Route calculation cancelled. Endpoints kept; compare again when ready.');};$('route-clear').onclick=()=>{this.cancel();this.start=this.goal=null;this.targets=[];this.result=null;this.render();this.status('Choose a start and destination on the map.');};
  $('route-fit').onclick=()=>this.fit();$('route-json').onclick=()=>this.save(false);$('route-geojson').onclick=()=>this.save(true);
  $('route-example').onclick=async()=>{const d=(this.catalog()?.datasets??[]).find(d=>d.region==='JEZERO'&&d.status==='complete'&&d.terrain?.length);if(!d){this.status('The Jezero terrain catalogue is unavailable. Choose endpoints in another prepared observation.');return;}await this.onExample?.();const [w,s,e,n]=d.bounds,lon=(w+e)/2,lat=(s+n)/2;this.start=[lon,lat-(n-s)*.08];this.goal=[lon,lat+(n-s)*.08];this.targets=[{id:'checkpoint-1',name:'User checkpoint 1',point:[lon+(e-w)*.10,lat],score:50}];this.dirty();this.fit();};
  [map,mini].forEach(m=>m.on('moveend zoomend',()=>this.drawFlat()));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){this.picking=null;this.renderPicking();} });
  this.render();this.workbench=new MissionWorkbench(this);
 }
 open(show){$('route-panel').hidden=!show;$('route-toggle').setAttribute('aria-expanded',String(show));$('route-toggle').setAttribute('aria-pressed',String(show));if(show){this.onOpen?.();}else{this.picking=null;this.renderPicking();}}
 pick(kind){if(kind==='target'&&this.targets.length>=6){this.status('Up to six checkpoints are supported.');return;}this.picking=this.picking===kind?null:kind;this.navigation.setMode('pan');this.renderPicking();if(this.picking)this.status(`Click the map to place ${kind==='goal'?'the destination':kind==='start'?'the start':'a checkpoint'}.`);}
 renderPicking(){document.body.classList.toggle('route-picking',Boolean(this.picking));for(const kind of ['start','goal','target'])$(`route-pick-${kind}`).setAttribute('aria-pressed',String(this.picking===kind));}
 centre(){if(this.view()==='2d'){const p=this.map.getCenter();return [wrapRouteLongitude(p.lng),p.lat];}const C=window.Cesium;return this.point3D(new C.Cartesian2(this.viewer.canvas.clientWidth/2,this.viewer.canvas.clientHeight/2));}
 point3D(screen){const C=window.Cesium,scene=this.viewer.scene,camera=this.viewer.camera;const hit=scene.globe.pick(camera.getPickRay(screen),scene)??camera.pickEllipsoid(screen,scene.globe.ellipsoid);if(!hit)return null;const c=scene.globe.ellipsoid.cartesianToCartographic(hit);return [C.Math.toDegrees(c.longitude),C.Math.toDegrees(c.latitude)];}
 add3D(screen){
  const picked=this.viewer.scene.pick(screen);
  if(picked?.id?.valueSite){
   const s=picked.id.valueSite;
   if(this.picking==='target'){
    if(this.targets.length>=6){this.status('Up to six checkpoints are supported.');return;}
    this.targets.push({id:s.id,name:s.name,point:s.center,score:90,radius_m:(s.radiusKm||5)*1000});
    this.picking=null;this.renderPicking();this.dirty();return;
   }else if(this.picking==='start'||this.picking==='goal'){
    this.setPoint(this.picking,s.center);return;
   }
  }
  const p=this.point3D(screen);
  if(p)this.setPoint(this.picking,p);
  else this.status('Click the surface of Mars.');
 }
 addFlat(event){this.setPoint(this.picking,[wrapRouteLongitude(event.latlng.lng),event.latlng.lat]);}
 setPoint(kind,point){if(!kind||point.some(v=>!Number.isFinite(v))||Math.abs(point[0])>180||Math.abs(point[1])>90)return;this.cancel();if(kind==='target')this.targets.push({id:`checkpoint-${Date.now()}`,name:`User checkpoint ${this.targets.length+1}`,point,score:50});else this[kind]=point;const next=kind==='start'&&!this.goal?'goal':null;this.picking=next;this.renderPicking();this.dirty();if(next)this.status('Start placed. Click the map to place the destination.');}
 dirty(){this.cancel();this.result=null;this.render();this.status('Ready to compare routes on measured terrain.');}
 cancel(){this.controller?.abort();this.controller=null;this.busy=false;$('route-plan').disabled=false;$('route-cancel').hidden=true;this.workbench?.syncBusy();}
 status(message){$('route-message').textContent=message;this.workbench?.message(message);}
 allTargets(){return this.result?.targets??[...this.targets,...(this.nearby?.targets??[])];}
 renderSites(){
  const settings=this.siteSettings=routeSiteSettings(this.siteSettings),manual=this.workbench?.planningTargets(this.targets)??this.targets,finished=Object.values(this.workbench?.state.tasks??{}).filter(t=>t.siteId&&['completed','skipped'].includes(t.status)).map(t=>t.siteId);this.nearby=nearbyRouteSites(this.sites?.(),this.start,this.goal,manual,{...settings,excluded:[...settings.excluded,...finished]});
  $('route-sites-enabled').checked=settings.enabled;$('route-site-radius').value=settings.radiusKm;for(const c of Object.keys(ROUTE_SITE_CATEGORIES))$('route-site-'+c).checked=settings.categories.includes(c);
  const selected=this.result?.targets?.filter(t=>t.origin==='catalogue')??this.nearby.targets;
  $('route-site-summary').textContent=`Nearby sites of value · ${selected.length} included`;
  $('route-site-count').textContent=!settings.enabled?'Nearby catalogue sites are excluded.':!this.start||!this.goal?'Place both endpoints to find nearby markers.':!Array.isArray(this.sites?.())?'The sites catalogue is unavailable. Retry loading the map before comparing.':`${this.nearby.available} distinct nearby ${this.nearby.available===1?'site':'sites'} · ${selected.length} included${this.nearby.omitted?` · ${this.nearby.omitted} beyond the six-stop budget`:''}. Manual checkpoints take priority; the nearest remaining sites are included.`;
  $('route-site-list').replaceChildren(...selected.map((t,i)=>{
   const row=element('li'),info=element('div'),name=element('strong',`V${i+1} · ${t.name}`),note=element('small',`${ROUTE_SITE_CATEGORIES[t.category]??'Research'} · ${(t.distanceFromCorridorKm??0).toFixed(2)} km from the endpoint/checkpoint corridor`),priority=element('input'),exclude=element('button','Exclude');
   info.append(name,note);if(t.source?.url&&/^https?:\/\//.test(t.source.url)){const source=element('a','Source ↗');source.href=t.source.url;source.target='_blank';source.rel='noopener';info.append(source);}
   if(t.coordinateNote)info.append(element('small',t.coordinateNote));
   priority.type='number';priority.min='0';priority.max='100';priority.value=t.score;priority.setAttribute('aria-label','Priority for '+t.name);priority.onchange=()=>{this.siteSettings.priorities={...this.siteSettings.priorities,[t.siteId]:Math.max(0,Math.min(100,Number(priority.value)||0))};this.dirty();};
   exclude.setAttribute('aria-label','Exclude '+t.name+' from routes');exclude.onclick=()=>{this.siteSettings.excluded=[...this.siteSettings.excluded,t.siteId];this.dirty();};row.append(info,priority,exclude);return row;
  }));
 }
 async plan(){
  if(!this.start||!this.goal){this.status('Choose both a start and destination first.');return;}
  
  this.cancel();const controller=this.controller=new AbortController();this.busy=true;$('route-plan').disabled=true;$('route-cancel').hidden=false;this.result=null;this.renderSites();this.draw();$('route-results').replaceChildren();this.picking=null;this.renderPicking();this.workbench?.update();
  try{
   if(this.siteSettings.enabled&&!Array.isArray(this.sites?.()))throw new Error('The sites-of-value catalogue is unavailable. Reload the map or turn off nearby sites before comparing.');
   const targets=this.workbench?.planningTargets(this.allTargets())??this.allTargets(),mission=this.workbench?.request()??{},selection={...this.siteSettings,available:this.nearby.available,included:targets.filter(t=>t.origin==='catalogue').length,omitted:this.nearby.omitted};
   const area=[this.start,this.goal,...targets.map(t=>t.point),...(this.workbench?.extraPoints()??[])],grid=await routeTerrain([...new Map(area.map(p=>[p.join(','),p])).values()],{catalog:this.catalog(),preferred:this.dataset(),mode:$('route-terrain').value,spacing:Number($('route-spacing').value),signal:controller.signal,onProgress:m=>{if(this.controller===controller&&!controller.signal.aborted)this.status(m);}});
   if(controller.signal.aborted)return;this.status(`Comparing three profiles · ${grid.rows} × ${grid.cols} terrain cells…`);
   const finished=Object.values(this.workbench?.state.tasks??{}).filter(t=>t.siteId&&['completed','skipped'].includes(t.status)).map(t=>t.siteId);
   const nearbyMinerals=routeAttractors(this.sites?.(),grid,{...this.siteSettings,excluded:[...this.siteSettings.excluded,...finished]});
   const options={allow_slope_traverse:$('route-allow-traverse')?.checked===true,mass_kg:Number($('route-mass').value),gravity_ratio:Number($('route-gravity').value),max_slope_deg:Number($('route-slope').value),apf_pull:Number($('route-pull').value),sensor_radius_m:Number($('route-sensor').value)};
   const response=await fetch('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schema:'mars-route-request/1',start:this.start,goal:this.goal,targets,minerals:nearbyMinerals,options,grid,...mission}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(300000)])});
   const {return_field:packedReturn,...result}=await response.json();if(!response.ok||result.status!=='success')throw new Error(result.error??'The routing service is unavailable.');if(controller.signal.aborted)return;
   let field=null;try{field=await decodeReturnField(packedReturn);}catch(error){console.warn('Return feasibility grid could not load.',error);}
   if(controller.signal.aborted)return;
   result.metadata.site_selection=selection;result.metadata.mission_id=crypto.randomUUID();result.metadata.planned_at=new Date().toISOString();this.workbench?.setGrid(grid,result,field);this.result=result;this.shown='all';this.render();const count=Object.values(result.routes).filter(r=>r.waypoints?.length).length;this.status(count?`${count} profiles returned · ${selection.included} catalogue ${selection.included===1?'site':'sites'} included · ${distance(result.metadata.window_width_m)} planning area · ${distance(result.metadata.grid_spacing_m)} cells. Review the source and model limits below.`:'No route met these terrain constraints. Change endpoints or review the slope limit.');
  }catch(e){if(!controller.signal.aborted)this.status(e.message==='Failed to fetch'?'The route service could not be reached. No substitute route was generated.':e.message);}
  finally{if(this.controller===controller){this.controller=null;this.busy=false;$('route-plan').disabled=false;$('route-cancel').hidden=true;this.workbench?.syncBusy();}}
 }
 render(){
  this.renderSites();
  for(const kind of ['start','goal']){const p=this[kind];$(`route-${kind}-readout`).textContent=p?coord(p):'Not placed';if(p){$(`route-${kind}-lon`).value=p[0].toFixed(7);$(`route-${kind}-lat`).value=p[1].toFixed(7);}}
  $('route-targets').replaceChildren(...this.targets.map((t,i)=>{const row=element('li'),name=element('span',`${i+1}. ${t.name}`),input=element('input');input.type='number';input.min='0';input.max='100';input.value=t.score;input.setAttribute('aria-label',`Priority for checkpoint ${i+1}`);input.onchange=()=>{t.score=Math.max(0,Math.min(100,Number(input.value)||0));this.dirty();};const remove=element('button','×');remove.setAttribute('aria-label',`Remove checkpoint ${i+1}`);remove.onclick=()=>{this.targets.splice(i,1);this.dirty();};row.append(name,input,remove);return row;}));
  $('route-results').replaceChildren();if(this.result){
   const controls=element('div',undefined,'route-visibility-controls');controls.setAttribute('role','group');controls.setAttribute('aria-label','Choose visible routes');
   const choices=[['all','Show all routes'],...Object.entries(profiles).filter(([key])=>this.result.routes[key]?.waypoints?.length).map(([key,d])=>[key,d.name]),...(this.result.return_route?.waypoints?.length?[['return_route','Return']]:[])];
   for(const [key,name] of choices){const button=element('button',name);button.type='button';button.setAttribute('aria-pressed',String(this.shown===key));button.setAttribute('aria-label',key==='all'?name:'Show only '+name);button.onclick=()=>{this.shown=key;this.render();};controls.append(button);}
   const visibility=element('p',this.shown==='all'?'Showing all routes. At overlaps: Direct safe above APF survey, Deep science, then Return. Select a route below to inspect it alone.':'Showing only '+(profiles[this.shown]?.name??'Return')+'. Select Show all routes to compare again.','route-visibility-status');visibility.setAttribute('role','status');$('route-results').append(controls,visibility);

   const entries=Object.entries(profiles).map(([key,definition])=>[key,definition,this.result.routes[key]]),back=returnRouteEntry(this.result);if(back)entries.push(back);
   for(const [key,definition,route] of entries){
    const card=element('section',undefined,'route-card');card.style.setProperty('--route-color',definition.color);const title=element('button',definition.name),hint=element('span',this.shown===key?'Showing only this route':'Show only this route','route-title-action');title.type='button';title.append(hint);title.setAttribute('aria-pressed',String(this.shown===key));title.setAttribute('aria-label','Show only '+definition.name);title.disabled=!route.waypoints?.length;title.onclick=()=>{this.shown=key;this.render();};card.append(title,element('p',definition.description));
    if(key==='return_route'){card.classList.add('return-route-card');card.append(element('p',`From B ${coord(this.result.goal)} → return point ${coord(this.result.return_to??this.result.start)}. The dashed line is the return journey, not another outbound profile.`,'tool-note'));if(route.search?.optimal_on_strict_grid===true)card.append(element('p','Minimum modeled energy on the walkable grid. This does not establish real-world safety.','tool-note'));else if(route.waypoints?.length)card.append(element('p','Saved or experimental result: minimum grid energy is not certified. Recalculate to refresh.','route-warning'));}
    if(route.summary){
     const s=route.summary,data=routeProfile(route,this.result.metadata),stats=element('dl',undefined,'route-stats'),tri=calculateTraverseRiskIndex(route,this.result.metadata);
     const triBadge=element('div',undefined,'route-tri-badge');
     const triHeader=element('div',undefined,'tri-header');
     if(triHeader.style)triHeader.style.setProperty('--tri-color',tri.color);
     const triPill=element('span',`TRAVERSE RISK: ${tri.risk_index}/100 · ${tri.rating}`,'tri-pill');
     if(triPill.style){triPill.style.borderColor=tri.color;triPill.style.color=tri.color;}
     const triSafety=element('span',`⚡ ${tri.safety_percentage}% SAFE`,'route-safety-blink');
     if(triSafety.style){triSafety.style.setProperty('--tri-color',tri.color);triSafety.style.borderColor=definition.color;triSafety.style.color=tri.color;}
     triHeader.append(triPill,triSafety);
     triBadge.append(triHeader);
     card.append(triBadge);
     const walking=element('dd','—');
     if(route.waypoints?.length)walking.dataset.walkingKm=String(data.distance_m>0?data.distance_m/1000:s.total_distance_km);
     stats.append(element('dt','Distance'),element('dd',`${s.total_distance_km} km`),element('dt','Walking time'),walking);
     for(const [label,value] of [['Energy',`${s.minetti_energy_kj} kJ`],['Safety rating',`${tri.safety_percentage}% (${tri.rating})`],['O₂ estimate',`${s.est_o2_consumed_liters??'—'} L`],['Profile climb / descent',`${data.ascent_m.toFixed(0)} / ${data.descent_m.toFixed(0)} m`],['Sampled slope',`${route.validation?.max_sampled_slope_deg??s.max_slope_deg}°`],['Priority credit',`${s.total_science_score}`]])stats.append(element('dt',label),element('dd',value));
     card.append(stats);
    }
    if(route.waypoints?.length)card.append(this.profileView(route,this.result.metadata,definition));
    if(route.status!=='success'||route.reason)card.append(element('p',`${route.status}: ${route.reason??'Some checkpoints were not reached.'}`,'route-warning'));
    if(route.notice)card.append(element('p',route.notice,'route-warning'));
    if(route.unreached_targets?.length)card.append(element('p','Unreached: '+route.unreached_targets.map(id=>this.result.targets?.find(t=>t.id===id)?.name??id).join('; '),'route-warning'));
    const shift=route.endpoint_adjustments_m;if(shift&&(shift.start>.1||shift.goal>.1))card.append(element('p',`Grid / walkable-cell adjustment: start ${distance(shift.start)}, destination ${distance(shift.goal)}. The colored route shows the actual endpoints.`,'tool-note'));
    $('route-results').append(card);
   }
   const m=this.result.metadata;$('route-results').append(element('p',`${m.source.label}; source sampling ≈${distance(m.source.sample_m)}. ${m.unknown_cells} unknown cells blocked. ${m.source.warning}`,'tool-note'));
   if(m.grid_spacing_m>m.source.requested_spacing_m*1.01)$('route-results').append(element('p',`Requested ${distance(m.source.requested_spacing_m)}; calculated on ${distance(m.grid_spacing_m)} cells to fit this area and the available elevation. Terrain between cells is not individually checked.`,'route-warning'));
   if(m.projection_max_scale_error>.01)$('route-results').append(element('p',`Broad-area estimate: the metre grid’s scale distortion can reach ${(m.projection_max_scale_error*100).toFixed(1)}% at its outer corners. Refine sections for local terrain decisions.`,'route-warning'));
  }
  for(const id of ['route-json','route-geojson'])$(id).disabled=!this.result;$('route-fit').disabled=!this.start&&!this.goal;this.draw();this.workbench?.update();document.dispatchEvent(new Event('atlas-mission-change'));
 }
 updateWalkingEstimates({speed_kmh,speed_factor}){
  const speed=speed_kmh*speed_factor;
  const pace=speed.toLocaleString(undefined,{maximumFractionDigits:3});
  for(const readout of $('route-results').querySelectorAll('[data-walking-km]')){
   const time=walkingTimeText(Number(readout.dataset.walkingKm),speed);
   readout.textContent=time==='—'?time:`${time} at ${pace} km/h`;
  }
 }
 profileView(route,metadata,definition){
  const data=routeProfile(route,metadata),box=element('details',undefined,'route-profile');box.open=true;box.append(element('summary','Elevation & slope profile'));
  if(data.min===null){box.append(element('p','No measured elevations in this saved profile.'));return box;}
  const readout=element('output','Move over a chart or use its arrow keys to inspect the route.','profile-readout');readout.setAttribute('aria-live','polite');
  const charts=[];let selected=0;
  const select=index=>{selected=Math.max(0,Math.min(data.samples.length-1,index));const p=data.samples[selected];readout.textContent=`${distance(p.distance_m)} · elevation ${p.elevation_m===null?'unknown':p.elevation_m.toFixed(0)+' m'} · slope ${p.slope_deg===null?'—':p.slope_deg.toFixed(1)+'°'}`;for(const {cursor,svg} of charts){cursor.setAttribute('x1',String(p.distance_m/(data.distance_m||1)*280));cursor.setAttribute('x2',String(p.distance_m/(data.distance_m||1)*280));svg.setAttribute('aria-valuenow',String(selected));svg.setAttribute('aria-valuetext',readout.textContent);}this.highlightSample(p,definition.color);};
  for(const [key,label] of [['elevation_m','Elevation · m'],['slope_deg','Along-route slope · °']]){
   const chart=profileChartPath(data.samples,key),ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path'),cursor=document.createElementNS(ns,'line');svg.setAttribute('viewBox','0 0 280 100');svg.setAttribute('role','slider');svg.setAttribute('tabindex','0');svg.setAttribute('aria-label',`${definition.name}: ${label}. Use arrow keys to inspect along the route.`);svg.setAttribute('aria-valuemin','0');svg.setAttribute('aria-valuemax',String(data.samples.length-1));svg.setAttribute('aria-valuenow','0');path.setAttribute('d',chart.path);path.setAttribute('fill','none');path.setAttribute('stroke',definition.color);path.setAttribute('stroke-width','2');cursor.setAttribute('y1','0');cursor.setAttribute('y2','100');cursor.setAttribute('class','profile-cursor');svg.append(path,cursor);charts.push({cursor,svg});
   const caption=element('div',`${label} · ${chart.min?.toFixed(0)??'—'} to ${chart.max?.toFixed(0)??'—'}`,'profile-caption');box.append(caption,svg);
   svg.onpointermove=e=>{const r=svg.getBoundingClientRect(),d=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*data.distance_m;let i=data.samples.findIndex(p=>p.distance_m>=d);select(i<0?data.samples.length-1:i);};svg.onfocus=()=>select(selected);svg.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();select(e.key==='Home'?0:e.key==='End'?data.samples.length-1:selected+(e.key==='ArrowLeft'?-1:1));}};
  }
  box.append(element('div',`0 — ${distance(data.distance_m)} along route`,'profile-caption'),readout);
  box.append(element('p',`Profile climb ${distance(data.ascent_m)} · descent ${distance(data.descent_m)} · ${data.difficult.length} steeper samples (≥${((metadata.max_slope_deg??22)*.75).toFixed(1)}°).`,'tool-note'));
  box.append(element('p',`${metadata.source?.label??'Saved source'} · source ≈${distance(data.source_sample_m??0)} · profile intervals up to ${distance(data.profile_sample_m)} · ${(data.known_fraction*100).toFixed(0)}% of profile heights known. Unknown terrain is blocked during planning. ${data.legacy?'Older result: only saved waypoints were sampled. ':''}Between-sample hazards are unresolved. Heights exclude visual exaggeration.`,'tool-note'));
  box.onpointerleave=()=>this.highlightSample(null);box.ontoggle=()=>{if(!box.open)this.highlightSample(null);};return box;
 }
 highlightSample(point,color='#ffffff'){
  this.profilePoint=point;
  this.highlightSource.entities.removeAll();for(const layer of this.highlightLayers)layer.clearLayers();if(point&&this.visible){const C=window.Cesium;this.highlightSource.entities.add({position:C.Cartesian3.fromDegrees(point.lon,point.lat,0,this.viewer.scene.globe.ellipsoid),point:{pixelSize:13,color:C.Color.fromCssColorString(color),outlineColor:C.Color.BLACK,outlineWidth:3,heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY}});for(const [i,layer] of this.highlightLayers.entries()){const m=[this.map,this.mini][i],lon=point.lon+360*Math.round((m.getCenter().lng-point.lon)/360);L.circleMarker([point.lat,lon],{radius:7,color:'#fff',weight:2,fillColor:color,fillOpacity:1,interactive:false}).addTo(layer);}}this.viewer.scene.requestRender();
 }
 draw(){const C=window.Cesium;this.source.entities.removeAll();this.drawLegend();if(this.visible){
  const dots=routeMarkers(this.result,this.start,this.goal,this.allTargets(),profiles[this.shown]?this.shown:this.workbench?.state.profile);
  for(const {point,label} of dots){const position=measurementPositions(C,this.viewer.scene,[point],this.surface);this.source.entities.add({position:new C.CallbackPositionProperty(()=>position()[0],false),point:{pixelSize:9,color:C.Color.fromCssColorString('#ffe3b4'),outlineColor:C.Color.BLACK,outlineWidth:2},label:{text:label,font:'bold 13px sans-serif',fillColor:C.Color.WHITE,outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-18)}});}

  orderedRouteKeys(Object.keys(profiles)).forEach((key,i)=>{
   const d=profiles[key],r=this.result?.routes[key];
   if(!r?.waypoints?.length||!routeVisible(this.shown,key))return;
   addTerrainRoute(C,this.viewer,this.source,r.waypoints.map(p=>[p.lon,p.lat]),{surface:this.surface,color:d.color,width:3,priority:ROUTE_PRIORITY[key]});
   const tri=calculateTraverseRiskIndex(r,this.result.metadata);
   const midIdx=Math.floor(r.waypoints.length/2);
   const midWp=r.waypoints[midIdx];
   if(midWp){
    this.source.entities.add({
     position:C.Cartesian3.fromDegrees(midWp.lon,midWp.lat,0,this.viewer.scene.globe.ellipsoid),
     label:{
      text:`⚡ ${tri.safety_percentage}% SAFE`,
      font:'bold 12px monospace',
      fillColor:C.Color.fromCssColorString(tri.color),
      outlineColor:C.Color.BLACK,
      outlineWidth:3,
      style:C.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset:new C.Cartesian2(0,-24-(i*14)),
      heightReference:C.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance:Number.POSITIVE_INFINITY
     }
    });
   }
  });
 }this.drawFlat();this.viewer.scene.requestRender();}
 drawLegend(){
  if(!this.legend){this.legend=element('aside',undefined,'route-map-legend');this.legend.setAttribute('aria-label','Route line legend');($('pyxis-location')??$('workspace')).append(this.legend);}
  this.legend.replaceChildren();this.legend.hidden=!this.visible||!this.result;if(this.legend.hidden)return;
  for(const [key,d] of Object.entries(profiles)){if(!this.result.routes[key]?.waypoints?.length||!routeVisible(this.shown,key))continue;const row=element('div'),swatch=element('span',undefined,'route-line-swatch');swatch.style.borderColor=d.color;row.append(swatch,element('span',d.name+' · A → B'));this.legend.append(row);}
  if(this.workbench?.state.config.round_trip&&this.result.return_route?.waypoints?.length&&routeVisible(this.shown,'return_route')){const row=element('div'),swatch=element('span',undefined,'route-line-swatch return-line-swatch');swatch.style.borderColor=RETURN_ROUTE.color;row.append(swatch,element('span','Return · B → return point'));this.legend.append(row);}
  this.legend.hidden=!this.legend.childElementCount;
 }
 drawFlat(){for(const [index,layer] of this.layers.entries()){
  layer.clearLayers();if(!this.visible)continue;const map=[this.map,this.mini][index],near=map.getCenter().lng;
  orderedRouteKeys(Object.keys(profiles)).forEach((key,i)=>{
   const d=profiles[key],route=this.result?.routes[key];
   if(!route?.waypoints?.length||!routeVisible(this.shown,key))return;
   const linePath=flatMeasurementPath(route.waypoints.map(p=>[p.lon,p.lat]),near);
   L.polyline(linePath,{pane:routePane(map,key),color:d.color,weight:3,interactive:false}).addTo(layer);
   const tri=calculateTraverseRiskIndex(route,this.result?.metadata||{});
   if(linePath&&linePath.length>0){
    const midCoord=linePath[Math.floor(linePath.length/2)];
    if(midCoord){
     L.marker(midCoord,{
      interactive:false,
      icon:L.divIcon({
       className:'route-safety-badge-wrapper',
       html:`<span class="route-safety-blink" style="border-color:${d.color};color:${tri.color};">⚡ ${tri.safety_percentage}% SAFE</span>`,
       iconSize:[84,22],
       iconAnchor:[42,11+(i*18)]
      })
     }).addTo(layer);
    }
   }
  });
  for(const {point,label} of routeMarkers(this.result,this.start,this.goal,this.allTargets(),profiles[this.shown]?this.shown:this.workbench?.state.profile))L.marker([point[1],point[0]+360*Math.round((near-point[0])/360)],{interactive:false,icon:L.divIcon({className:'route-pin',html:`<span>${label}</span>`,iconSize:[24,24],iconAnchor:[12,12]})}).addTo(layer);
 }}
 setVisible(show){this.visible=show;this.source.show=show;this.highlightSource.show=show;if(!show)this.highlightSample(null);this.draw();this.workbench?.setVisible(show);}
 fit(){const points=[this.start,this.goal,...this.allTargets().map(t=>t.point),this.workbench?.returnPoint()].filter(Boolean);if(!points.length)return;const C=window.Cesium,sphere=C.BoundingSphere.fromPoints(points.map(p=>C.Cartesian3.fromDegrees(...p,0,this.viewer.scene.globe.ellipsoid)));this.viewer.camera.flyToBoundingSphere(sphere,{offset:new C.HeadingPitchRange(0,-1.2,Math.max(1500,sphere.radius*3)),duration:1.7});const bounds=L.latLngBounds(points.map(([lon,lat])=>[lat,lon+360*Math.round((points[0][0]-lon)/360)]));this.map.fitBounds(bounds,{padding:[50,50],maxZoom:18});this.mini.fitBounds(bounds,{padding:[18,18],maxZoom:16});}
 save(geojson){if(!this.result)return;const full={...this.result,mission_operation:this.workbench?.snapshot(),mission_budget:this.workbench?.budget},data=geojson?routeGeoJSON(full):full,url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=geojson?'Mars_mission_routes.geojson':'Mars_mission_routes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}

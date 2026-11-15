import L from 'leaflet';
import {USER_SITES_KEY,MAX_USER_SITES,USER_SITE_CATEGORIES,USER_SITE_TAG_PRESETS,userSiteTagKey,validateUserSites,validateUserSite,upsertUserSite,userValueSite} from './user-sites.js';
import {markerSVG,aboveHorizon} from './value-geometry.js';
import {mapLabel,PIN_SIZE,PIN_ANCHOR} from './map-marker-style.js';
import './user-sites.css';
import {evaluatedSiteDraft} from './site-evaluation-settings.js';
const $=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const button=(label,fn)=>{const b=node('button',label);b.type='button';b.onclick=fn;return b;};
const wrap=lon=>((lon+180)%360+360)%360-180;
export class UserSites{
 constructor(viewer,map,mini,host){
  Object.assign(this,{viewer,map,mini,host,sites:[],visible:true,picking:false});
  try{this.storage=localStorage;const raw=this.storage.getItem(USER_SITES_KEY);if(raw)this.sites=validateUserSites(JSON.parse(raw));}catch(e){this.storage=undefined;this.storageError='Saved sites could not be loaded: '+e.message;}
  const C=window.Cesium;this.source=new C.CustomDataSource('My marked sites');viewer.dataSources.add(this.source);this.layers=[map,mini].map(m=>L.layerGroup().addTo(m));
  const option=node('option','My sites');option.value='user-sites';$('place-type').append(option);
  const tab=button('My sites');tab.dataset.directory='user-sites';tab.setAttribute('aria-pressed','false');$('ui-directory-tabs')?.append(tab);
  const shortcut=button('Mark a site',()=>{this.newSite();this.useCentre();});shortcut.dataset.directory='user-sites';shortcut.className='user-sites-shortcut';$('region-menu').prepend(shortcut);
  const root=this.root=node('section');root.id='user-sites-menu';root.hidden=true;root.setAttribute('aria-label','My sites');$('directory').append(root);
  root.append(node('p','Mark a location, give it a name and keep your field notes. Sites of value can be included in route planning.'));
  const actions=node('div');actions.className='user-site-actions';actions.append(button('New site',()=>{this.newSite();this.useCentre();}),button('Use map crosshair',()=>this.useCentre()));root.append(actions);
  this.pickButton=button('Pick on map',()=>this.pick());this.pickButton.setAttribute('aria-pressed','false');actions.append(this.pickButton);
  const show=node('label');show.className='user-site-check';this.show=node('input');this.show.type='checkbox';this.show.checked=true;this.show.dataset.mapLayer='userSites';this.show.onchange=()=>host.visibility(this.show.checked);show.append(this.show,document.createTextNode(' Show my sites on the map'));root.append(show);
  const form=this.form=node('form');form.id='user-site-form';root.append(form);
  const field=(title,input,id)=>{input.id=id;const label=node('label',title);label.htmlFor=id;form.append(label,input);return input;};
  this.name=field('Site name',node('input'),'user-site-name');this.name.required=true;this.name.maxLength=80;this.name.placeholder='e.g. Ridge observation point';
  this.description=field('Description',node('textarea'),'user-site-description');this.description.rows=4;this.description.maxLength=2000;this.description.placeholder='Why this place matters, observations, or tasks…';
  this.tags=field('Tags',node('input'),'user-site-tags');this.tags.placeholder='Add tags, separated by commas';
  const presets=node('div');presets.className='user-site-tag-list';presets.setAttribute('role','group');presets.setAttribute('aria-label','Suggested tags');
  this.tagButtons=USER_SITE_TAG_PRESETS.map(tag=>button(tag,()=>this.toggleTag(tag)));
  presets.append(...this.tagButtons);form.append(presets);this.tags.addEventListener('input',()=>this.updateTagButtons());
  const coords=node('div');coords.className='user-site-coordinates';form.append(coords);
  for(const [key,title,min,max] of [['lat','Latitude · °N',-90,90],['lon','Longitude · °E',-180,180]]){
   const label=node('label',title),input=this[key]=node('input');Object.assign(input,{id:'user-site-'+key,type:'number',min:String(min),max:String(max),step:'any',required:true});label.htmlFor=input.id;label.append(input);coords.append(label);
  }
  const valueLabel=node('label');valueLabel.className='user-site-check';this.value=node('input');this.value.id='user-site-value';this.value.type='checkbox';valueLabel.append(this.value,document.createTextNode(' Mark as a site of value'));form.append(valueLabel);
  this.category=field('Value category',node('select'),'user-site-category');for(const [key,label] of Object.entries(USER_SITE_CATEGORIES)){const op=node('option',label);op.value=key;this.category.append(op);}this.categoryLabel=this.category.previousElementSibling;
  this.value.onchange=()=>this.valueFields();form.addEventListener('input',()=>{this.unsaved=true;});
  const saveActions=node('div');saveActions.className='user-site-actions';this.saveButton=node('button','Save site');this.saveButton.type='submit';saveActions.append(this.saveButton,button('Cancel edit',()=>this.newSite()));form.append(saveActions);
  form.onsubmit=event=>{event.preventDefault();this.save();};
  if(host.declareCamp){
   const camp=button('Save site & declare camp',()=>{
    if(!form.reportValidity())return;
    const site=this.save();
    if(site){host.declareCamp(site);this.message(`Declared “${site.name}” as camp. Use Camp in Explore to return here.`);}
   });
   camp.className='user-site-camp-action';saveActions.after(camp);
  }
  if(host.assignPerimeter){
   const withPerimeter=button('Save site & draw perimeter',()=>{if(form.reportValidity()){const site=this.save();if(site)host.assignPerimeter(site);}});
   withPerimeter.id='user-site-with-perimeter';saveActions.after(withPerimeter);
  }
  this.status=node('p',this.storageError??'Your sites are saved in this browser and included when you save a mission.');this.status.setAttribute('role','status');root.append(this.status);
  this.search=fieldOutside(root,'Find my sites',node('input'),'user-site-search');this.search.type='search';this.search.oninput=()=>this.list();
  this.tagFilter=fieldOutside(root,'Filter by tag',node('select'),'user-site-tag-filter');this.tagFilter.onchange=()=>this.list();
  this.count=node('p');this.count.className='tool-note';root.append(this.count);this.listNode=node('div');this.listNode.id='user-site-list';root.append(this.listNode);
  const layerList=document.querySelector('#appearance-panel .layer-list');if(layerList){const label=node('label');const input=node('input');input.type='checkbox';input.dataset.mapLayer='userSites';input.onchange=()=>host.visibility(input.checked);label.append(input,document.createTextNode(' My marked sites'));layerList.append(label);}
  $('place-type').addEventListener('change',()=>{this.root.hidden=$('place-type').value!=='user-sites';if(this.root.hidden)this.cancelPick();else queueMicrotask(()=>{if(!this.root.hidden){$('title').textContent='My sites';$('category').textContent='YOUR FIELD NOTES';$('description').textContent='Named locations and your own sites of value.';}});});
  document.addEventListener('click',event=>{const target=event.target.closest('[data-action],[data-directory]');if(target&&target.dataset.directory!=='user-sites')this.cancelPick();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')this.cancelPick();});
  viewer.camera.changed.addEventListener(()=>this.visibility3D());[map,mini].forEach(m=>m.on('moveend zoomend',()=>this.drawFlat()));
  this.newSite();this.list();this.draw();
 }
 message(text){this.status.textContent=text;}
 snapshot(){return validateUserSites(this.sites);}
 valueFields(){this.category.hidden=this.categoryLabel.hidden=!this.value.checked;this.category.disabled=!this.value.checked;}
 updateTagButtons(){const selected=this.tags.value.split(',').map(userSiteTagKey);for(const b of this.tagButtons)b.setAttribute('aria-pressed',String(selected.includes(userSiteTagKey(b.textContent))));}
 toggleTag(tag){
  const tags=this.tags.value.split(',').map(t=>t.trim()).filter(Boolean),key=userSiteTagKey(tag);
  this.tags.value=(tags.some(t=>userSiteTagKey(t)===key)?tags.filter(t=>userSiteTagKey(t)!==key):[...tags,tag]).join(', ');
  this.tags.dispatchEvent(new Event('input',{bubbles:true}));
 }
 newSite(){this.editId=null;this.unsaved=false;this.form.reset();this.name.value='';this.description.value='';this.category.value='science';this.valueFields();this.updateTagButtons();this.saveButton.textContent='Save site';this.saveButton.disabled=this.sites.length>=MAX_USER_SITES;this.cancelPick();}
 useCentre(){const p=this.host.centre();if(p)this.place(p);else this.message('Move the map crosshair onto Mars, or enter coordinates.');}
 place(point){if(!point||!point.every(Number.isFinite)||Math.abs(point[1])>90){this.message('Click the surface of Mars.');return;}this.lon.value=wrap(point[0]).toFixed(6);this.lat.value=point[1].toFixed(6);this.unsaved=true;this.cancelPick();this.message('Location selected. Add a name and description, then save.');this.name.focus({preventScroll:true});}
 pick(){if(this.picking){this.cancelPick();return;}this.host.beforePick();this.picking=true;this.pickButton.setAttribute('aria-pressed','true');this.pickButton.textContent='Cancel map pick';document.body.classList.add('user-site-picking');this.message('Click Mars to choose this site’s location. Escape cancels.');}
 cancelPick(){this.picking=false;this.pickButton?.setAttribute('aria-pressed','false');if(this.pickButton)this.pickButton.textContent='Pick on map';document.body.classList.remove('user-site-picking');}
 addFlat(event){this.place([event.latlng.lng,event.latlng.lat]);}
 add3D(screen){const C=window.Cesium,scene=this.viewer.scene,camera=this.viewer.camera,ray=camera.getPickRay(screen),hit=ray&&scene.globe.pick(ray,scene)||camera.pickEllipsoid(screen,scene.globe.ellipsoid);if(!hit){this.message('Click the surface of Mars.');return;}const p=scene.globe.ellipsoid.cartesianToCartographic(hit);this.place([C.Math.toDegrees(p.longitude),C.Math.toDegrees(p.latitude)]);}
 persist(next){if(!this.storage)throw Error('Browser storage is unavailable. Your draft is still in the form.');this.storage.setItem(USER_SITES_KEY,JSON.stringify(next));const previous=this.sites;this.sites=next;this.host.changed(previous,next);this.list();this.draw();document.dispatchEvent(new Event('atlas-mission-change'));}
 save(){try{
  const input=validateUserSite({...this.sites.find(s=>s.id===this.editId),id:this.editId??'user-'+crypto.randomUUID(),name:this.name.value,description:this.description.value,tags:this.tags.value.split(','),center:[this.lon.valueAsNumber,this.lat.valueAsNumber],isValue:this.value.checked,category:this.category.value}),editing=Boolean(this.editId);
  this.persist(upsertUserSite(this.sites,input));this.editId=input.id;this.unsaved=false;this.tags.value=input.tags.join(', ');this.updateTagButtons();this.saveButton.textContent='Save changes';this.host.visibility(true);this.message(`${editing?'Updated':'Saved'} “${input.name}”${input.isValue?' as a site of value':''} in this browser.`);
  return input;
 }catch(e){this.message('Site could not be saved: '+e.message);return null;}}
 saveEvaluation(result,{isValue=false}={}){const id=result.markerId??'user-'+crypto.randomUUID(),tags=this.sites.find(site=>site.id===id)?.tags,draft=evaluatedSiteDraft(result,id,{isValue,tags});this.persist(upsertUserSite(this.sites,draft));this.host.visibility(true);return id;}
 restore(incoming){const clean=validateUserSites(incoming??[]);if(!clean.length)return;let next=this.snapshot();for(const site of clean)next=upsertUserSite(next,site);this.persist(next);}
 open(){const tab=document.querySelector('#ui-directory-tabs [data-directory="user-sites"]');if(tab){tab.click();}else{$('place-type').value='user-sites';$('place-type').dispatchEvent(new Event('change'));$('directory').hidden=false;$('detail').hidden=true;if($('sidebar').hidden||document.body.classList.contains('sidebar-collapsed'))$('sidebar-toggle').click();}}
 edit(site,{visit=true}={}){this.open();this.editId=site.id;this.name.value=site.name;this.description.value=site.description;this.tags.value=site.tags.join(', ');this.updateTagButtons();this.lon.value=site.center[0];this.lat.value=site.center[1];this.value.checked=site.isValue;this.category.value=site.category;this.valueFields();this.saveButton.textContent='Save changes';this.saveButton.disabled=false;this.unsaved=false;this.cancelPick();if(visit)this.host.visit(userValueSite(site));this.open();this.message(`Editing “${site.name}” · ${site.isValue?'your site of value':'marked site'}.`);this.name.focus({preventScroll:true});}
 remove(site){try{this.persist(this.sites.filter(s=>s.id!==site.id));if(this.editId===site.id)this.newSite();this.message(`Removed “${site.name}”.`);}catch(e){this.message('Site could not be removed: '+e.message);}}
 list(){
  const q=this.search.value.trim().toLocaleLowerCase(),previousTag=this.tagFilter.value,tagOptions=new Map();
  for(const site of this.sites)for(const tag of site.tags){const key=userSiteTagKey(tag);if(!tagOptions.has(key))tagOptions.set(key,tag);}
  const option=(value,label)=>Object.assign(node('option',label),{value});
  this.tagFilter.replaceChildren(option('','All tags'),...[...tagOptions].sort((a,b)=>a[1].localeCompare(b[1])).map(([key,label])=>option(key,label)));
  this.tagFilter.value=tagOptions.has(previousTag)?previousTag:'';
  this.tagFilter.disabled=!tagOptions.size;
  const activeTag=this.tagFilter.value,shown=this.sites.filter(s=>(!activeTag||s.tags.some(tag=>userSiteTagKey(tag)===activeTag))&&`${s.name} ${s.description} ${s.tags.join(' ')}`.toLocaleLowerCase().includes(q));
  this.count.textContent=`${shown.length} of ${this.sites.length} saved sites · ${this.sites.filter(s=>s.isValue).length} sites of value`;this.listNode.replaceChildren(...shown.map(site=>{
  const card=node('article');card.className='user-site-card';card.append(node('h3',site.name),node('small',site.isValue?`${USER_SITE_CATEGORIES[site.category]} · Your site of value`:'Your marked site'));if(site.evaluationKind)card.append(node('small',`Evaluated ${site.evaluationKind==='landing'?'landing':'base station'} candidate`));card.append(node('p',site.description||'No description added.'),node('small',`${site.center[1].toFixed(5)}°N · ${site.center[0].toFixed(5)}°E`));
  if(site.tags.length){const tags=node('div');tags.className='user-site-tag-list';for(const tag of site.tags){const badge=node('span',tag);badge.className='user-site-tag';tags.append(badge);}card.append(tags);}
  const actions=node('div');actions.className='user-site-actions';actions.append(button('View & edit',()=>this.edit(site)),button('Remove',()=>this.remove(site)));card.append(actions);return card;
 }));if(!shown.length)this.listNode.append(node('p',q||activeTag?'No saved sites match your filters.':'No sites yet. Choose a location above and save your first site.'));this.saveButton.disabled=this.sites.length>=MAX_USER_SITES&&!this.editId;}
 setVisible(show){this.visible=show;this.show.checked=show;for(const input of document.querySelectorAll('[data-map-layer="userSites"]'))input.checked=show;this.source.show=show;this.visibility3D();this.drawFlat();}
 draw(){const C=window.Cesium;this.source.entities.suspendEvents();this.source.entities.removeAll();for(const site of this.sites){if(this.host.isCamp?.(site.center))continue;const e=this.source.entities.add({id:'my-site-'+site.id,position:C.Cartesian3.fromDegrees(...site.center,0,this.viewer.scene.globe.ellipsoid),billboard:{image:markerSVG(site.isValue?site.category:'saved'),width:PIN_SIZE[0],height:PIN_SIZE[1],verticalOrigin:C.VerticalOrigin.BOTTOM,heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Infinity},label:mapLabel(C,{text:site.name,pixelOffset:new C.Cartesian2(0,-48),heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Infinity})});e.userSite=site;e.valueSite=userValueSite(site);}this.source.entities.resumeEvents();this.visibility3D();this.drawFlat();}
 visibility3D(){const C=window.Cesium;for(const e of this.source.entities.values){e.show=this.visible&&aboveHorizon(e.userSite.center,this.viewer.camera.positionWC);e.label.show=e.show&&(e.userSite.id===this.editId||C.Cartesian3.distance(this.viewer.camera.positionWC,e.position.getValue(C.JulianDate.now()))<100000);}this.viewer.scene.requestRender();}
 drawFlat(){this.layers.forEach((layer,i)=>{layer.clearLayers();if(!this.visible)return;const map=[this.map,this.mini][i],reference=map.getCenter().lng;for(const site of this.sites){if(this.host.isCamp?.(site.center))continue;const p=[site.center[1],site.center[0]+360*Math.round((reference-site.center[0])/360)];L.marker(p,{icon:L.icon({iconUrl:markerSVG(site.isValue?site.category:'saved'),iconSize:PIN_SIZE,iconAnchor:PIN_ANCHOR}),title:site.name,alt:'Your site: '+site.name,bubblingMouseEvents:false}).bindTooltip(node('span',`${site.name}${site.isValue?' · Your site of value':''}`),{direction:'top',offset:[0,-37]}).on('click',event=>{if(this.picking)this.addFlat({...event,latlng:{lng:site.center[0],lat:site.center[1]}});else if(!this.host.flatPick?.({...event,latlng:{lng:site.center[0],lat:site.center[1]}}))this.edit(site);}).addTo(layer);}});}
}
function fieldOutside(root,title,input,id){const label=node('label',title);label.htmlFor=id;input.id=id;root.append(label,input);return input;}

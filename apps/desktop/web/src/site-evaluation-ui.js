import L from 'leaflet';
import {siteComparisonReport} from './site-evaluation-report.js';
import {SITE_WEIGHTS,SITE_CRITERIA,SITE_PROFILES,SITE_METHOD_SOURCES,siteWeight,compareSitePairs,validateSiteOptions,siteFootprint} from './site-evaluation.js';
import {collectSiteEvaluation} from './site-evaluation-data.js';
import {measurementPositions} from './measurement-terrain.js';
import {routeRenderLegs} from './route-geometry.js';
import './site-evaluation.css';
import {SITE_EDITOR_FIELDS,siteEditorDefaults} from './site-evaluation-settings.js';
import {sameCampPoint} from './mission-camp.js';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const number=(v,unit='')=>Number.isFinite(v)?`${v.toLocaleString(undefined,{maximumFractionDigits:2})}${unit}`:'Unknown';
const fields=[['lon','Longitude °E',-180,180,77.43],['lat','Latitude °N',-89,89,18.44],['length','Footprint length · m',200,50000,5000],['width','Footprint width · m',200,50000,3000],['heading','Heading clockwise from north · °',0,360,0],['slope','Maximum resolved slope · °',1,40,10],['roughness','95th-percentile roughness limit · m',1,500,20],['maxElevation','Vehicle elevation ceiling · m',-9000,22000,0],['requiredArea','Required connected area · km²',.01,2000,1],['surroundingBuffer','Outer terrain buffer · m',0,5000,1000],['sols','Operating period · sols',1,668,30],['radius','Resource search radius · km',1,500,100]];
export class SiteEvaluator{
 constructor(host){
  this.host=host;this.results=[];this.editors={};this.picking=false;this.layers=[host.map,host.mini].map(m=>L.layerGroup().addTo(m));
  const C=window.Cesium;this.source=new C.CustomDataSource('Site evaluation footprints');host.viewer.dataSources.add(this.source);
  this.panel=document.getElementById('site-evaluation-panel');
  const root=node('div');root.className='site-evaluator';root.id='site-evaluation';
  root.append(node('p','Choose what you want to evaluate. Landing and base candidates use separate settings and results. Compare up to four of each type.'));
  const chooser=this.chooser=node('div');chooser.className='site-eval-choices';root.append(chooser);
  for(const [mode,title,description] of [['landing','Landing site','Screen the landing ellipse and surrounding terrain, including slope, roughness, usable area and vehicle elevation limits.'],['base','Base station','Assess buildable terrain, sunlight over an operating period, ice evidence and nearby resources.']]){
   const choice=node('button');choice.type='button';choice.id='site-evaluation-choose-'+mode;choice.append(node('strong',title),node('span',description),node('span','Open '+(mode==='base'?'base station':'landing site')+' evaluation →'));choice.onclick=()=>this.open(mode);chooser.append(choice);
   this.buildEditor(root,mode,title);
  }
  const research=node('details');research.append(node('summary','Research behind the priorities'),node('p','NASA landing studies use vehicle-specific engineering and hazard constraints. Surface power and local resource studies inform the solar-supported base preset. The weights, terrain limits, footprint sizes and distance budget here are editable project assumptions. Scores do not certify landing or construction safety. Use terrain routes to assess access across the surface.'));root.append(research);
  for(const [title,url] of SITE_METHOD_SOURCES)this.link(research,title,url);
  const show=node('label');this.show=node('input');this.show.type='checkbox';this.show.onchange=()=>this.draw();show.append(this.show,document.createTextNode(' Show candidate footprints on both maps'));root.append(show);
  const exports=node('div');exports.className='site-eval-actions';root.append(exports);for(const [label,markdown] of [['Export comparison JSON',false],['Export readable report',true]]){const b=node('button',label);b.type='button';b.onclick=()=>this.export(markdown);exports.append(b);}
  this.status=node('p','Choose Landing site or Base station to begin.');this.status.setAttribute('role','status');root.append(this.status);
  const pairing=node('details');pairing.append(node('summary','Compare landing and base together'),node('p','Evaluate at least one landing site and one base station. The shortlist compares those candidates within your straight-line distance budget. Both footprints must meet the resolved terrain limits to qualify. The pair range uses the lower site score at each bound. Eligible pairs with higher lower bounds appear first. Review each candidate’s recorded settings before comparing.'));
  const distanceLabel=node('label','Maximum landing-to-base distance · km');this.pairRadius=node('input');Object.assign(this.pairRadius,{type:'number',min:'1',max:'100',step:'any',value:'10'});distanceLabel.append(this.pairRadius);pairing.append(distanceLabel);
  this.pairResults=node('div');pairing.append(this.pairResults);root.append(pairing);this.pairRadius.oninput=()=>this.renderPairs();this.renderPairs();
  this.panel.append(root);
  document.addEventListener('atlas-site-evaluation-open',event=>this.open(event.detail?.mode,event.detail));
  document.addEventListener('atlas-mission-change',()=>this.updateCampActions());
  document.addEventListener('keydown',event=>{if(event.key==='Escape')this.cancelPick();});
  new MutationObserver(()=>{if(this.panel.hidden)this.cancelPick();}).observe(this.panel,{attributes:true,attributeFilter:['hidden']});
 }
 buildEditor(root,mode,title){
  const section=node('section');section.id='site-evaluation-'+mode;section.hidden=true;section.setAttribute('aria-label',title+' evaluation');root.append(section);
  const back=node('button','← Landing & base sites');back.type='button';back.onclick=()=>this.open();section.append(back);
  const heading=node('h3',title+' evaluation');heading.tabIndex=-1;section.append(heading,node('p',SITE_PROFILES[mode].description));
  const editor=this.editors[mode]={mode,section,heading,inputs:{},weights:{},defaults:siteEditorDefaults(mode)};
  if(mode==='base'){
   editor.campHint=node('p','Choose a location, evaluate it, then review the result and select Declare camp.');
   editor.campHint.className='site-eval-note';editor.campHint.hidden=true;section.append(editor.campHint);
  }
  const form=editor.form=node('form');section.append(form);const grid=node('div');grid.className='site-eval-fields';form.append(grid);
  const add=(title,input,key)=>{input.id='site-evaluation-'+mode+'-'+key;const label=node('label',title);label.htmlFor=input.id;label.append(input);grid.append(label);return input;};
  editor.name=add('Candidate name',node('input'),'name');editor.name.maxLength=60;editor.name.value=(mode==='landing'?'Landing':'Base')+' 1';
  for(const [key,title,min,max] of fields){const input=node('input');Object.assign(input,{type:'number',min:String(min),max:String(max),step:'any',value:String(editor.defaults[key]),required:true});editor.inputs[key]=input;if(SITE_EDITOR_FIELDS[mode].includes(key))add(key==='length'?(mode==='landing'?'Landing ellipse length · m':'Buildable footprint length · m'):key==='width'?(mode==='landing'?'Landing ellipse width · m':'Buildable footprint width · m'):title,input,key);}
  editor.at=node('input');Object.assign(editor.at,{type:'datetime-local',required:true,value:editor.defaults.at.slice(0,16),min:'2000-01-01T00:00',max:'2030-12-01T00:00'});if(mode==='base')add('Start time · UTC',editor.at,'at');
  const weights=node('details');weights.append(node('summary','Preference weights & scoring method'));form.append(weights);
  for(const [key,title] of Object.entries(SITE_CRITERIA)){const input=node('input');Object.assign(input,{type:'number',min:'0',max:'100',step:'1',value:String(editor.defaults.weights[key]),required:true});editor.weights[key]=input;if(editor.defaults.weights[key]>0){input.id='site-evaluation-'+mode+'-weight-'+key;const label=node('label',title);label.htmlFor=input.id;label.append(input);weights.append(label);}}
  weights.append(node('p',mode==='landing'?'Landing weights score terrain inside and around the ellipse. The vehicle elevation ceiling is a separate terrain constraint.':'Base weights prioritize sunlight, ice evidence and nearby resources. Buildable terrain must also meet the configured limits.'));
  weights.append(node('p','Scores decline to zero at the configured slope and roughness limits. Area reaches 100 at the required connected area. Sunlight reaches 100 at 12 equivalent incidence hours per sol. Missing evidence widens the score range. These normalizations and weights are project preferences.'));
  const actions=node('div');actions.className='site-eval-actions';form.append(actions);
  const centre=node('button','Use map crosshair');centre.type='button';centre.onclick=()=>{const p=this.host.centre();if(!p){this.message('Move the crosshair onto Mars first.');return;}this.place(p,editor);};actions.append(centre);
  editor.pick=node('button','Pick site on map');editor.pick.type='button';editor.pick.setAttribute('aria-pressed','false');editor.pick.onclick=()=>this.pick(editor);actions.append(editor.pick);
  editor.location=node('p','Enter coordinates, use the crosshair, or pick a location on either map.');editor.location.className='site-eval-note';editor.location.setAttribute('role','status');form.append(editor.location);
  editor.add=node('button','Evaluate '+(mode==='landing'?'landing site':'base station'));editor.add.type='submit';form.append(editor.add);
  editor.recalculate=node('button','Recalculate '+(mode==='landing'?'landing':'base')+' candidates');editor.recalculate.type='button';editor.recalculate.onclick=()=>{if(form.reportValidity())this.run(true,editor);};form.append(editor.recalculate);
  editor.cancel=node('button','Cancel evaluation');editor.cancel.type='button';editor.cancel.hidden=true;editor.cancel.onclick=()=>this.controller?.abort();form.append(editor.cancel);
  editor.status=node('p','Ready to evaluate.');editor.status.setAttribute('role','status');form.append(editor.status);
  editor.cards=node('div');section.append(editor.cards);editor.cards.append(node('p','No '+(mode==='landing'?'landing':'base')+' candidates evaluated yet.'));
  form.onsubmit=e=>{e.preventDefault();this.run(false,editor);};form.addEventListener('input',event=>{if([editor.inputs.lon,editor.inputs.lat].includes(event.target)){this.cancelPick();editor.location.textContent='Coordinates edited. Review the centre and footprint before evaluating.';}this.changed();});
 }
 open(mode,{campSetup=false}={}){
  this.cancelPick();this.active=Object.hasOwn(this.editors,mode)?mode:null;
  this.chooser.hidden=Boolean(this.active);
  for(const editor of Object.values(this.editors))editor.section.hidden=editor.mode!==this.active;
  const base=this.editors.base;
  base.campHint.hidden=!campSetup;
  if(campSetup){
   const point=this.host.centre();
   if(point?.every(Number.isFinite)&&Math.abs(point[1])<=89)this.place(point,base);
   else base.location.textContent='Pick a location on Mars or enter coordinates for the camp candidate.';
  }
  this.panel.scrollTop=0;
  if(this.active)this.editors[this.active].heading.focus({preventScroll:true});
 }
 message(text){this.status.textContent=text;for(const editor of Object.values(this.editors))editor.status.textContent=text;}
 changed(){this.message(this.results.length?'Settings changed. Existing candidates retain their recorded inputs. Recalculate candidates of this type to apply these settings.':'Scenario settings ready.');}
 options(editor){return validateSiteOptions({mode:editor.mode,at:editor.at.value+':00Z',...Object.fromEntries(Object.entries(editor.inputs).map(([k,v])=>[k,Number(v.value)])),weights:Object.fromEntries(Object.entries(editor.weights).map(([k,v])=>[k,Number(v.value)]))});}
 pick(editor){if(this.picking&&this.pickEditor===editor){this.cancelPick();return;}this.cancelPick();this.host.beforePick();this.picking=true;this.pickEditor=editor;editor.pick.textContent='Cancel map pick';editor.pick.setAttribute('aria-pressed','true');document.body.classList.add('site-evaluation-picking');editor.location.textContent='Click Mars on the 3D map or 2D map to select the centre. Then evaluate. Escape cancels.';}
 cancelPick(){if(this.pickEditor){this.pickEditor.pick.textContent='Pick site on map';this.pickEditor.pick.setAttribute('aria-pressed','false');this.pickEditor.location.textContent='Map picking ended. Review the coordinates before evaluating.';}this.picking=false;this.pickEditor=null;document.body.classList.remove('site-evaluation-picking');}
 place(point,editor=this.pickEditor){if(!editor||!point||!point.every(Number.isFinite)||Math.abs(point[1])>89){this.message('Click Mars between 89°S and 89°N.');return;}editor.inputs.lon.value=(((point[0]+180)%360+360)%360-180).toFixed(6);editor.inputs.lat.value=point[1].toFixed(6);this.cancelPick();editor.location.textContent='Selected '+editor.inputs.lat.value+'°N, '+editor.inputs.lon.value+'°E. Review the footprint, then evaluate.';this.changed();}
 addFlat(event){this.place([event.latlng.lng,event.latlng.lat]);}
 add3D(screen){const C=window.Cesium,scene=this.host.viewer.scene,camera=this.host.viewer.camera,ray=camera.getPickRay(screen),hit=ray&&scene.globe.pick(ray,scene)||camera.pickEllipsoid(screen,scene.globe.ellipsoid);if(!hit){this.message('Click the surface of Mars.');return;}const p=scene.globe.ellipsoid.cartesianToCartographic(hit);this.place([C.Math.toDegrees(p.longitude),C.Math.toDegrees(p.latitude)]);}
 async run(all,editor){
  if(this.controller)return;this.cancelPick();let common;try{common=this.options(editor);}catch(e){this.message(e.message);return;}
  const matching=this.results.filter(r=>r.options.mode===common.mode);
  if(!all&&matching.length>=4){this.message('Four '+common.mode+' candidates are already present. Remove one or recalculate this type.');return;}
  if(all&&!matching.length){this.message('Evaluate a candidate of this type first.');return;}
  const controller=this.controller=new AbortController();editor.form.setAttribute('aria-busy','true');for(const e of Object.values(this.editors))e.add.disabled=e.recalculate.disabled=true;editor.cancel.hidden=false;
  const pending=all?matching.map(r=>({name:r.name,markerId:r.markerId,options:{...common,lon:r.options.lon,lat:r.options.lat}})):[{name:editor.name.value.trim()||common.mode+' '+(matching.length+1),options:common}];
  try{
   const updated=[];for(const [i,p] of pending.entries()){this.message('Evaluating '+p.name+' · '+(i+1)+'/'+pending.length+'…');const result=await collectSiteEvaluation(p.options,{catalog:this.host.catalog(),preferred:this.host.dataset(),sites:this.host.sites(),signal:controller.signal,onProgress:text=>this.message(p.name+': '+text)});updated.push({...result,name:p.name,...(p.markerId?{markerId:p.markerId,markerStale:true}:{})});}
   controller.signal.throwIfAborted();this.results=all?this.results.map(r=>r.options.mode===common.mode?updated.shift():r):[...this.results,...updated];editor.name.value=(common.mode==='landing'?'Landing':'Base')+' '+(this.results.filter(r=>r.options.mode===common.mode).length+1);this.render();this.message('Evaluation complete. Compare score bounds, evidence coverage and terrain limits together. Mark a candidate to save it in My sites.');
  }catch(e){this.message(controller.signal.aborted?'Evaluation cancelled. Previous results kept.':'Evaluation unavailable: '+e.message+'. Previous results kept.');}
  finally{this.controller=null;editor.form.removeAttribute('aria-busy');for(const e of Object.values(this.editors))e.add.disabled=e.recalculate.disabled=false;editor.cancel.hidden=true;}
 }
 renderPairs(){
  this.pairResults.replaceChildren();
  const radius=this.pairRadius.valueAsNumber;
  if(!Number.isFinite(radius)||radius<1||radius>100){this.pairResults.append(node('p','Enter a distance from 1 to 100 km.'));return;}
  const pairs=compareSitePairs(this.results,radius);
  if(!pairs.length){this.pairResults.append(node('p','No evaluated landing and base pair within this distance.'));return;}
  for(const pair of pairs){
   const landing=this.results[pair.landingIndex],base=this.results[pair.baseIndex];
   const card=node('article');card.className='site-eval-card';
   card.append(node('h3',`${landing.name} → ${base.name}`),node('p',`${number(pair.distanceKm,' km')} straight-line · ${pair.eligible?'Both footprints meet resolved terrain limits':'Review failed or unknown terrain limits'}`),node('p',`Pair range ${number(pair.lower)}–${number(pair.upper)} / 100`),node('p',`Landing ${number(landing.lower)}–${number(landing.upper)} · Base ${number(base.lower)}–${number(base.upper)}`));
   this.pairResults.append(card);
  }
 }
 render(){
  this.renderPairs();
  this.campActions=[];
  for(const editor of Object.values(this.editors))editor.cards.replaceChildren();for(const [i,r] of this.results.entries()){
   const card=node('article');card.className='site-eval-card';card.append(node('h3',`${i+1}. ${r.name} · ${r.options.mode==='landing'?'Landing':'Base'}`));
   const score=node('p',`${number(r.score)} / 100 · assessed criteria`);score.className='site-eval-score';card.append(score,node('p',`${r.constraint_status} · ${number(r.coverage*100,'%')} weighted evidence coverage`),node('p',`Full-weight score bounds: ${number(r.lower)}–${number(r.upper)} / 100. Missing criteria account for this range.`));
   const dl=node('dl');for(const [title,value] of [['Centre',`${number(r.options.lat)}°N, ${number(r.options.lon)}°E`],['Physical terrain source',`${r.source.label} · ≈${number(r.source.sample_m)} m`],['Analysis / metric stencil',`${number(r.source.analysis_spacing_m)} / ${number(r.terrain.sample_m)} m`],['Footprint samples',`${r.terrain.known}/${r.terrain.total} valid`],['Slope · 95th / maximum',`${number(r.terrain.slope_p95)} / ${number(r.terrain.slope_max)}°`],['Roughness · 95th percentile',number(r.terrain.roughness_p95,' m')],['Connected usable area',number(r.terrain.connected_km2,' km²')],['Approx. lit hours / sol',number(r.sun.lit_hours_per_sol)],['Equivalent incidence hours / sol',number(r.sun.equivalent_hours_per_sol)],['Sunlight interval',`${r.options.at} · ${r.options.sols} sols`]].filter(([title])=>r.options.mode==='base'||!['Approx. lit hours / sol','Equivalent incidence hours / sol','Sunlight interval'].includes(title)))dl.append(node('dt',title),node('dd',value));card.append(dl);
   if(!r.terrain.adequate)card.append(node('p','Footprint too small or too sparsely sampled for terrain screening. Use a larger area or a finer prepared DEM.'));
   const ring=r.terrain.surroundings;
   if(ring?.buffer_m)card.append(node('p',`Outer buffer ${number(ring.buffer_m,' m')} · ${ring.known}/${ring.total} resolved samples · ${ring.within_limits} within slope and roughness limits`));
   const table=node('table'),head=node('tr');for(const text of ['Criterion','Score','Weight','Points'])head.append(node('th',text));table.append(head);
   const totalWeight=Object.keys(SITE_CRITERIA).reduce((sum,key)=>sum+siteWeight(r.options.weights,key),0);
   for(const [key,title] of Object.entries(SITE_CRITERIA)){
    const weight=siteWeight(r.options.weights,key),score=r.criteria[key],tr=node('tr');if(weight===0)continue;
    for(const text of [title,number(score),number(100*weight/totalWeight,'%'),weight===0?'0':number(Number.isFinite(score)?score*weight/totalWeight:null)])tr.append(node('td',text));
    table.append(tr);
   }
   card.append(table);
   const detail=node('details');detail.append(node('summary','Reasons, sources & unresolved hazards'));const list=node('ul');for(const text of [...r.violations,...r.unassessed,...r.notes,`DEM warning: ${r.source.warning??'See source sampling.'}`,`Terrain shadow search is bounded to ${number(r.sun.shadow_radius_m)} m around the centre. Sunlight does not sample the whole footprint.`])list.append(node('li',text));detail.append(list);
   for(const ref of r.source.reference){detail.append(node('p',`${ref.key}: ${number(ref.value)} ${ref.units??''} · ${ref.sampling??''} · ${ref.note}`));for(const s of ref.sources??[])this.link(detail,s.title??'Source',s.url);}
   this.link(detail,'Physical topography source',r.source.terrain_url);this.link(detail,'Mars24 solar method',r.source.solar_url);card.append(detail);
   if(r.options.mode==='base'){card.append(node('h4','Nearby resource evidence · straight-line distances'));
   if(!r.resources?.targets?.length)card.append(node('p',r.resource_catalogue_available?'No sourced resource catalogue targets in the search radius. This does not establish resource absence.':'Resource catalogue unavailable.'));
   for(const target of r.resources?.targets??[]){card.append(node('p',`${target.name} · ${number(target.distance_km)} km`));for(const s of target.sources??[])this.link(card,s.title??'Resource source',s.url);const use=node('button','Inspect terrain route to this resource');use.type='button';use.onclick=()=>this.useRoute(r,target.point);card.append(use);}
   }
   if(r.options.mode==='base'){
    const actions=node('div');actions.className='site-eval-save';const declare=node('button','Declare camp'),deploy=node('button','Deploy on site'),status=node('p');declare.type=deploy.type='button';
    declare.onclick=()=>{try{this.host.declareCamp(r);this.render();this.message('Camp declared. ARES Return to declared camp and Marswalk now use this base location.');}catch(e){this.message('Camp could not be declared: '+e.message);}};
    deploy.onclick=()=>this.host.deployOnSite();actions.append(declare,deploy,status,node('p','Camp is a user-declared planning destination. Evaluation limits and unresolved hazards still apply.'));card.append(actions);this.campActions.push({r,declare,deploy,status});
   }
   const save=node('div');save.className='site-eval-save';const valueLabel=node('label'),value=node('input');value.type='checkbox';value.checked=Boolean(this.host.savedSite(r.markerId)?.isValue);valueLabel.append(value,document.createTextNode(' Also make this a site of value'));save.append(valueLabel);
   const mark=node('button',r.markerId?'Update saved marker':'Mark & save '+(r.options.mode==='landing'?'landing site':'base station'));mark.type='button';mark.onclick=()=>{try{r.markerId=this.host.mark(r,{isValue:value.checked});r.markerStale=false;this.message('Saved “'+r.name+'” in My sites with its evaluation summary.');this.render();}catch(e){this.message('Marker could not be saved: '+e.message);}};save.append(mark);
   if(r.markerId){save.append(node('p',r.markerStale?'Recalculated. Update the saved marker to store this new evaluation.':'Saved in My sites. Removing this comparison candidate keeps the saved marker.'));const edit=node('button','Edit marked site');edit.type='button';edit.onclick=()=>{const site=this.host.savedSite(r.markerId);if(site){this.panel.hidden=true;this.host.editSite(site);}else this.message('This marker was removed from My sites. Mark the candidate again to restore it.');};save.append(edit);}card.append(save);
   const remove=node('button','Remove candidate');remove.type='button';remove.onclick=()=>{if(this.controller)return;this.results.splice(i,1);this.render();};card.append(remove);this.editors[r.options.mode].cards.append(card);
  }for(const editor of Object.values(this.editors))if(!editor.cards.childElementCount)editor.cards.append(node('p','No '+editor.mode+' candidates evaluated yet.'));this.updateCampActions();this.draw();
 }
 updateCampActions(){const camp=this.host.camp?.();for(const item of this.campActions??[]){const active=sameCampPoint(camp?.point,[item.r.options.lon,item.r.options.lat]);item.declare.disabled=active;item.declare.textContent=active?'Camp declared':'Declare camp';item.deploy.hidden=!active;item.status.textContent=active?'Current declared camp · shared with ARES return planning.':'';}}
 link(root,title,url){try{if(!['https:','http:'].includes(new URL(url).protocol))return;const a=node('a',title+' ↗');a.href=url;a.target='_blank';a.rel='noopener';root.append(a,document.createElement('br'));}catch{}}
 useRoute(r,point){
  if(this.controller)return;
  this.host.cancel();
  this.host.start=[r.options.lon,r.options.lat];
  this.host.goal=point;
  this.host.targets=[];
  this.host.dirty();
  this.panel.hidden=true;
  this.host.openRoute();
  this.host.status('Candidate and resource set as route endpoints. Review route settings, then Compare routes.');
 }
 draw(){
  this.source.entities.removeAll();for(const group of this.layers)group.clearLayers();if(this.show.checked){const C=window.Cesium;for(const [i,r] of this.results.entries()){
   const color=['#9ee5cf','#f0bd60','#73cde3','#d3a8ee'][i%4],points=siteFootprint(r.options);
   for(const leg of routeRenderLegs(points)){this.source.entities.add({polyline:{positions:new C.CallbackProperty(measurementPositions(C,this.host.viewer.scene,leg,this.host.surface),false),width:2,arcType:C.ArcType.NONE,material:C.Color.fromCssColorString(color)}});for(const group of this.layers)L.polyline(leg.map(p=>[p[1],p[0]]),{color,weight:2,interactive:false}).addTo(group);}
  }}this.host.viewer.scene.requestRender();
 }
 export(markdown){
  if(!this.results.length){this.message('Evaluate a candidate before exporting.');return;}
  const report={schema:'mars-site-comparison/1',exported_at:new Date().toISOString(),comparison_note:'No automatic ranking. Candidates may use different recorded scenarios; compare evidence coverage and score bounds.',candidates:this.results};
  const text=markdown?siteComparisonReport(this.results):JSON.stringify(report,null,2);
  const url=URL.createObjectURL(new Blob([text],{type:markdown?'text/markdown':'application/json'})),a=node('a');a.href=url;a.download=`mars-site-comparison.${markdown?'md':'json'}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
}

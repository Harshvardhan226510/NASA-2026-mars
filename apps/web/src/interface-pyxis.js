import {mountThinkingOrb} from './thinking-orb.js';
import './interface-pyxis.css';

const $=id=>document.getElementById(id);
const tools=[['measure','Measure'],['solar','Sunlight'],['dust','Dust ML'],['seismic','Seismic Lab']];
const planLabels={deploy:'Equipment',sites:'Sites',plan:'Marswalk',comms:'Comms',saved:'Saved'};
const tarsIcon='<img class="tars-logo" src="/tars-logo.png" alt="" width="34" height="34">';
const make=(tag,id,markup)=>Object.assign(document.createElement(tag),{id,innerHTML:markup});

function mountSectionNav(menu,panelActions,perform){
 const nav=make('nav','pyxis-section-nav','');
 const plan=[...menu.querySelectorAll('.ui-feature-card[data-action]')].map(card=>{
  const action=card.dataset.action,title=card.querySelector('strong').textContent;
  return [action,planLabels[action]??title,title];
 });
 const groups=[{id:'plan',label:'Plan sections',items:plan},{id:'tools',label:'Map tools',items:tools}];
 const panelIds=Object.fromEntries(Object.entries(panelActions).map(([id,action])=>[action,id]));
 const links=new Map();
 for(const {id,label,items} of groups)for(const [action,name,title=name] of items){
  const button=document.createElement('button');
  button.type='button';button.textContent=name;button.title=title;
  button.setAttribute('aria-controls',panelIds[action]);
  button.onclick=()=>{if(!button.hasAttribute('aria-current'))perform(action);};
  links.set(action,{group:id,label,button});
 }
 let activePanel=null;
 return panelId=>{
  const action=panelActions[panelId],current=links.get(action);
  const panel=current?$(panelId):null;
  if(panel===activePanel)return;
  activePanel=panel;
  const focused=nav.contains(document.activeElement)?document.activeElement:null;
  if(!panel){
   nav.remove();
   if(focused)(nav.dataset.pyxisGroup==='tools'?$('pyxis-tools-button'):$('ui-rail').querySelector('[data-action=missions]')).focus({preventScroll:true});
   return;
  }
  if(nav.dataset.pyxisGroup!==current.group){
   nav.dataset.pyxisGroup=current.group;
   nav.setAttribute('aria-label',current.label);
   nav.replaceChildren(...[...links.values()].filter(link=>link.group===current.group).map(link=>link.button));
  }
  for(const button of nav.children){
   if(button===current.button)button.setAttribute('aria-current','true');
   else button.removeAttribute('aria-current');
  }
  panel.classList.add('ui-drawer','pyxis-section-panel');panel.dataset.pyxisGroup=current.group;
  panel.before(nav);
  if(nav.contains(focused))focused.focus({preventScroll:true});
 };
}

export function initPyxisInterface({svg,registerDrawer,panelActions,perform}){
 const body=document.body,workspace=$('workspace'),rail=$('ui-rail');
 body.classList.add('ui-pyxis');document.title='Pyxis · RevoRed';
 $('home').innerHTML='<span class="ui-planet" aria-hidden="true"></span><span class="pyxis-wordmark"><b>Pyxis</b><small>by RevoRed</small></span>';
 $('ui-scene-caption').remove();
 const control=(action,label,icon=action)=>`<button type="button" data-action="${action}" aria-pressed="false">${svg(icon)}<span>${label}</span></button>`;
 rail.innerHTML=control('explore','Explore')+control('routes','Routes')+control('perimeter','Perimeter')+control('missions','Plan','plan')+control('help','Guide','help');
 const exploreShortcuts=make('div','pyxis-explore-shortcuts','<button type="button" id="pyxis-mark-site">Mark a site</button><button type="button" data-directory="regions">Places</button><button type="button" data-directory="user-sites">My sites</button>');
 $('sidebar').querySelector('.ui-drawer-top').after(exploreShortcuts);
 $('pyxis-mark-site').onclick=()=>document.querySelector('.user-sites-shortcut')?.click();
 const top=document.querySelector('.ui-header-tools');
 top.querySelector('.ui-search').setAttribute('aria-label','Find a place');
 const quick=make('button','pyxis-quick-button',svg('help')+'<span>Quick guide</span>');
 quick.type='button';quick.dataset.action='quick-guide';quick.setAttribute('aria-label','Quick guide');quick.setAttribute('aria-controls','pyxis-quick');quick.setAttribute('aria-pressed','false');
 top.querySelector('[data-action=help]').remove();top.prepend(quick);
 const fullscreen=make('button','pyxis-fullscreen','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/></svg>');
 fullscreen.type='button';fullscreen.setAttribute('aria-label','Fullscreen');fullscreen.title='Fullscreen';
 const focus=$('ui-focus');focus.classList.add('pyxis-focus-control');focus.title='Focus on map (F)';
 top.append(fullscreen);
 fullscreen.onclick=async()=>{
  try{
   if(document.fullscreenElement)await document.exitFullscreen();
   else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
   else focus.click();
  }catch{focus.click();}
 };
 document.addEventListener('fullscreenchange',()=>{
  const active=Boolean(document.fullscreenElement);
  fullscreen.setAttribute('aria-label',active?'Exit fullscreen':'Fullscreen');
  fullscreen.title=active?'Exit fullscreen':'Fullscreen';
 });
 const quickGuide=make('section','pyxis-quick',`<button class="ui-close" data-ui-close aria-label="Close Quick guide">${svg('close')}</button><h2>Quick guide</h2>
  <p>Drag to pan, scroll to zoom, and use Tilt to change the 3D angle.</p><p>Find a place accepts names or latitude and longitude. Use the 2D overview to keep your bearings.</p><p>The crosshair and loaded imagery are shown at bottom left.</p><button type="button" data-action="help">Open full Guide</button>`);
 quickGuide.className='ui-drawer';quickGuide.hidden=true;quickGuide.setAttribute('aria-label','Quick guide');body.append(quickGuide);
 registerDrawer('quick-guide',quickGuide);
 const guide=$('ui-help');guide.querySelector('.ui-kicker').remove();guide.querySelector('h2').textContent='Field guide';
 guide.querySelector(':scope > p').textContent='Use the left rail for fieldwork. Layers, map controls and the Tools menu sit on the right.';
 for(const section of guide.querySelectorAll('p, li span, summary'))for(const child of section.childNodes)if(child.nodeType===Node.TEXT_NODE)child.textContent=child.textContent.replace(/\bARES(?: AI)?\b/g,'TARS AI').replace(/\bMissions →/g,'Plan →').replace(/in the Missions header/g,'in Plan').replace(/Rotate\/right-drag/g,'Tilt/right-drag').replace('Ground opens','Walk opens').replace('Ground view','Walk mode');
 const perimeterGuide=make('details','pyxis-guide-perimeter','<summary>Draw a perimeter</summary><p>Choose Perimeter and tap to add vertices, or use Lasso and drag around an area. Name and save the boundary. You can link it to a marked site or the declared camp. Use View to return to it or Edit to change it.</p>');
 guide.querySelector('.ui-shortcuts').before(perimeterGuide);
 const menu=$('ui-mission-menu');menu.querySelector('.ui-kicker').remove();menu.querySelector('h2').textContent='Plan';
 menu.querySelector(':scope > p').remove();menu.querySelector('[data-action="routes"]').remove();
 document.querySelector('#assistant-panel h2').innerHTML=`${tarsIcon}<span>TARS AI</span>`;
 $('assistant-panel').setAttribute('aria-label','TARS AI Mars EVA assistant');$('assistant-input').setAttribute('aria-label','Ask TARS AI');$('assistant-mute').title='Mute or unmute TARS AI';
 for(const label of $('assistant-panel').querySelectorAll('.msg-sender,.assistant-msg p,.tool-note'))label.textContent=label.textContent.replace(/\bARES(?: AI)?\b/g,'TARS AI');

 const right=make('div','pyxis-right',`<div id="pyxis-location"><div id="pyxis-location-name"></div></div><div id="pyxis-controls"><div id="pyxis-navigation-stack">${control('layers','Layers')}<div id="pyxis-navigator"></div></div>
  <div id="pyxis-actions"><div id="pyxis-tools"><button type="button" id="pyxis-tools-button" aria-expanded="false" aria-controls="pyxis-tool-list">${svg('tools')}<span>Tools</span></button>
  <nav id="pyxis-tool-list" aria-label="Map tools" hidden>${tools.map(([id,name])=>control(id,name)).join('')}</nav></div>
  <button type="button" id="pyxis-tars" data-action="assistant" aria-controls="assistant-panel" aria-pressed="false">${tarsIcon}<span>TARS AI</span></button></div></div><div id="pyxis-overview"></div>`);
 workspace.append(right);
 $('pyxis-location-name').append($('location-context'));$('pyxis-navigator').append($('navigation'),$('ground-help'));
 $('pyxis-overview').append($('ui-view-host'),$('mini-wrap'));
 $('nav-rotate').textContent='Tilt';$('nav-rotate').setAttribute('aria-label','Tilt or rotate the 3D map');
 $('nav-ground').textContent='Walk';$('nav-ground').title='Walk on the Martian surface';
 const toolsButton=$('pyxis-tools-button'),toolList=$('pyxis-tool-list');
 const showTools=show=>{toolList.hidden=!show;toolsButton.setAttribute('aria-expanded',String(show));};
 toolsButton.onclick=()=>{const show=toolList.hidden;showTools(show);if(show)toolList.querySelector('button').focus({preventScroll:true});};
 toolList.onclick=event=>{if(event.target.closest('[data-action]')){toolsButton.focus({preventScroll:true});showTools(false);}};
 document.addEventListener('pointerdown',event=>{if(!event.target.closest('#pyxis-tools'))showTools(false);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!toolList.hidden){event.stopImmediatePropagation();showTools(false);toolsButton.focus();}},true);
 const telemetry=make('div','pyxis-telemetry','');workspace.append(telemetry);telemetry.append($('altitude'));
 $('altitude').prepend($('altitude-value'));
 const mountTelemetry=()=>{
  const readout=$('surface-readout');if(!readout||readout.parentNode===telemetry)return;
  const coordinates=make('div','pyxis-coordinates','');coordinates.append(...readout.querySelectorAll('.surface-coordinate-row'));readout.prepend(coordinates);telemetry.append(readout);
  readout.querySelector('.surface-quality-row').append($('ui-data-details'));
 };
 document.addEventListener('atlas-ready',mountTelemetry,{once:true});
 const watchReadout=new MutationObserver(()=>{if($('surface-readout')){mountTelemetry();watchReadout.disconnect();}});watchReadout.observe(workspace,{childList:true});
 const loading=make('div','pyxis-loading','<canvas aria-hidden="true"></canvas><span></span>');
 loading.setAttribute('role','status');loading.hidden=true;workspace.append(loading);
 const orb=mountThinkingOrb(loading.querySelector('canvas')),label=loading.querySelector('span'),startup=$('ui-loading'),busy=$('busy');
 const sync=()=>{
  const message=startup.isConnected?'Connecting to Mars…':busy.hidden?'':busy.textContent;
  if(label.textContent===message)return;
  label.textContent=message;loading.hidden=!message;orb.setState(message.includes('Retrying')?'connecting':'searching',!message);
 };
 const loadingObserver=new MutationObserver(sync);loadingObserver.observe(busy,{attributes:true,attributeFilter:['hidden'],childList:true});
 document.addEventListener('atlas-ready',()=>queueMicrotask(sync),{once:true});document.addEventListener('atlas-startup-error',()=>queueMicrotask(sync),{once:true});sync();

 const perimeter=make('section','perimeter-panel',`<button class="ui-close" data-ui-close aria-label="Close Perimeter">${svg('close')}</button>
  <h2 tabindex="-1">Perimeter</h2><form><label for="perimeter-name">Boundary name</label><input id="perimeter-name" maxlength="80" required placeholder="e.g. Base operations boundary">
  <label for="perimeter-target">Link to</label><select id="perimeter-target"></select>
  <div class="pyxis-perimeter-actions"><button type="button" id="perimeter-draw" aria-pressed="false">Draw on map</button><button type="button" id="perimeter-lasso" aria-pressed="false">Lasso</button><button type="button" id="perimeter-crosshair">Add crosshair</button>
  <button type="button" id="perimeter-undo">Undo vertex</button><button type="button" id="perimeter-clear">Clear vertices</button></div>
  <output id="perimeter-vertices" aria-live="polite"></output><button class="pyxis-primary" type="submit">Save perimeter</button></form>
  <p id="perimeter-status" role="status"></p><h3>Saved perimeters</h3><button type="button" id="perimeter-new">New perimeter</button><div id="perimeter-list"></div>`);
 perimeter.hidden=true;perimeter.className='ui-drawer';perimeter.setAttribute('aria-label','Perimeter');body.append(perimeter);registerDrawer('perimeter',perimeter);
 return mountSectionNav(menu,panelActions,perform);
}

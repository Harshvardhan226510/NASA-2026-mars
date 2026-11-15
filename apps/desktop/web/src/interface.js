import {initFieldInterface} from './interface-field.js';
import {initPyxisInterface} from './interface-pyxis.js';
import {useHorizonInterface} from './interface-workspaces.js';
import {initHorizonInterface} from './interface-horizon.js';
import {closeIcon} from './close-icon.js';
const $ = id => document.getElementById(id);
const icons = {
 assistant:'<path d="M8 5h8v11H8Z M5 9H3v8h18V9h-2 M12 16v5 M8 21h8"/>',
 solar:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M4.93 19.07l1.41-1.41 M17.66 6.34l1.41-1.41"/>',
 dust:'<path d="M4 8h11a3 3 0 1 0-3-3"/><path d="M2 13h15a3 3 0 1 1-3 3"/><path d="M7 18h6a2 2 0 1 0-2-2"/>',
 seismic:'<path d="M2 12h5l2-8 4 16 3-10 2 5h6"/>',
 deploy:'<rect x="3" y="6" width="6" height="10" rx="1"/><rect x="15" y="6" width="6" height="10" rx="1"/><path d="M9 11h6 M12 11v10 M7 21h10"/>',
 explore:'<circle cx="12" cy="12" r="8"/><path d="m15 9-2 4-4 2 2-4Z"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5"/>',
 measure:'<path d="m4 17 13-13 4 4L8 21Z M8 13l3 3 M12 9l3 3 M16 5l3 3"/>',
 routes:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h7a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h7"/>',
 plan:'<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2 M9 11h6 M9 15h6"/>',
 saved:'<path d="M5 3h12l3 3v15H4V3Z M8 3v6h8V3 M8 21v-7h8v7"/>',
 system:'<circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="11" ry="5" transform="rotate(-35 12 12)"/>',
 focus:'<path d="M9 3H3v6 M15 3h6v6 M3 15v6h6 M21 15v6h-6"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3v2 M12 17v.1"/>',
 perimeter:'<path d="m5 7 11-3 4 12-9 4-6-5Z" stroke-dasharray="2 2"/><circle cx="5" cy="7" r="1"/><circle cx="16" cy="4" r="1"/><circle cx="20" cy="16" r="1"/><circle cx="11" cy="20" r="1"/>',
 tools:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="#111923"/><circle cx="15" cy="12" r="2" fill="#111923"/><circle cx="10" cy="18" r="2" fill="#111923"/>',
 search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
 home:'<circle cx="12" cy="12" r="8"/><path d="M4 12h16 M12 4a14 14 0 0 1 0 16 14 14 0 0 1 0-16"/>',
 chevron:'<path d="m9 5 7 7-7 7"/>',
};
const svg = key => key==='close'?closeIcon:`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icons[key] || icons.explore}</svg>`;
const panels = ['comms-panel','assistant-panel','appearance-panel','measure-panel','route-panel','walk-panel','mission-panel','moons-panel','solar-panel','dust-panel','seismic-panel','plan-mission-panel','site-evaluation-panel'];
const closers = ['comms-close','assistant-close','appearance-close','measure-close','route-close','walk-close','mission-close','moons-close','solar-close','dust-close','seismic-close','plan-mission-close','site-evaluation-close'];
const targets = {comms:'comms-toggle',assistant:'assistant-toggle',layers:'appearance-toggle',measure:'measure-toggle',routes:'route-toggle',plan:'walk-toggle',saved:'mission-toggle',system:'moons-open',solar:'solar-toggle',dust:'dust-toggle',seismic:'seismic-toggle',deploy:'plan-mission-toggle'};
const panelActions = {'comms-panel':'comms','assistant-panel':'assistant','appearance-panel':'layers','measure-panel':'measure','route-panel':'routes','walk-panel':'plan','mission-panel':'saved','moons-panel':'system','solar-panel':'solar','dust-panel':'dust','seismic-panel':'seismic','plan-mission-panel':'deploy','site-evaluation-panel':'sites'};

export function initInterface() {
 const variant=new URLSearchParams(location.search).get('ui')??import.meta.env?.VITE_ATLAS_INTERFACE??'pyxis';
 const pyxis=variant==='pyxis';
 const horizon=useHorizonInterface(variant,location.search);
 if(horizon){document.body.dataset.interface='orbit';document.body.classList.remove('ui-expedition');document.body.classList.add('ui-orbit','ui-horizon');document.title='Mars Atlas | Horizon';}
 const orbit = document.body.dataset.interface === 'orbit';
 // Every tool uses the same responsive drawer as the rest of the interface.
 for(const id of panels)$(id)?.classList.add('ui-drawer');
 for(const button of document.querySelectorAll('.tool-close,#sidebar-toggle,#popup-close,#spacecraft-model-close'))button.innerHTML=closeIcon;
 const brand = horizon?'HORIZON':orbit?'ORBIT':'EXPEDITION';
 let ready = false, startupFailed = false, queued = null, lastFocus = null, syncing = false, syncPyxisSections;
 const header = document.querySelector('header');
 const home = $('home');
 home.innerHTML = `<span class="ui-planet" aria-hidden="true"></span><span>MARS <b>${brand}</b><small>FIELD ATLAS</small></span>`;
 header.replaceChildren(home);
 header.className = 'ui-header';
 const top = document.createElement('div');
 top.className = 'ui-header-tools';
 top.innerHTML = `<button class="ui-search" data-action="find">${svg('search')}<span>Find a place</span><kbd>/</kbd></button><div class="ui-domain" role="group" aria-label="Explore domain"><button id="ui-surface" aria-pressed="true">Surface</button><button id="ui-system">Mars system</button></div><button id="ui-focus" aria-label="Focus on map" title="Focus on map (F)">${svg('focus')}</button><button data-action="help" aria-label="How to use this interface">${svg('help')}</button>`;
 header.append(top);
 const nav = document.createElement('nav');
 nav.id = 'ui-rail'; nav.setAttribute('aria-label','Main tools');
 const choices = orbit
  ? [['explore','Explore','Places, research sites and spacecraft'],['layers','Layers','Scientific overlays and map appearance'],['deploy','Plan Mission','Deploy 3D scientific instruments with offline telemetry'],['measure','Measure','Distance and area'],['routes','Routes','Compare terrain-aware routes'],['solar','Sunlight','Mars sunlight & shadows'],['dust','Dust ML','NASA context and experimental dust-model inputs'],['seismic','Seismic Lab','Planetary seismology & InSight marsquakes'],['assistant','ARES AI','Map and route assistant'],['missions','Missions','Marswalk plans and saved missions'],['system','System','Moons, orbiters and time']]
  : [['explore','Explore Mars','Places & spacecraft'],['layers','Scientific layers','Understand the surface'],['deploy','Plan Mission','Deploy 3D scientific instruments'],['measure','Measure','Distance & area'],['routes','Routes','Compare terrain-aware paths'],['solar','Sunlight','Mars sunlight & shadows'],['dust','Dust ML','NASA context and experimental dust-model inputs'],['seismic','Seismic Lab','Planetary seismology & InSight marsquakes'],['assistant','ARES AI','Map and route assistant'],['plan','Marswalk','Plan, audit & record'],['saved','Saved missions','Save, share & reopen'],['system','Mars system','Moons & orbiters']];
 nav.innerHTML = (!orbit ? '<div class="ui-nav-caption">YOUR WORKSPACE</div>' : '') + choices.map(([id,title,note],i)=>`${!orbit && i===3?'<div class="ui-nav-caption">MISSION PLANNING</div>':''}${!orbit && id==='system'?'<div class="ui-nav-caption">BEYOND THE SURFACE</div>':''}<button data-action="${id}" aria-pressed="false" title="${note}">${svg(id==='missions'?'plan':id)}<span>${title}${!orbit?`<small>${note}</small>`:''}</span></button>`).join('') + `<button data-action="help" class="ui-rail-help">${svg('help')}<span>Quick guide</span></button>`;
 document.body.append(nav);

 // Framing stays reachable in the System panel when the compact bar hides it.
 const framing=document.createElement('fieldset');framing.className='ui-system-framing';
 framing.innerHTML='<legend>System framing</legend><button type="button" data-frame="system-inner">Mars &amp; orbiters</button><button type="button" data-frame="system-wide">All orbits</button>';
 $('moons-system').after(framing);
 for(const button of framing.querySelectorAll('button')){
  const original=$(button.dataset.frame);
  button.onclick=()=>original.click();
  const reflect=()=>button.setAttribute('aria-pressed',original.getAttribute('aria-pressed')??'false');
  new MutationObserver(reflect).observe(original,{attributes:true,attributeFilter:['aria-pressed']});reflect();
 }

 const sidebarHead = document.createElement('div'); sidebarHead.className='ui-drawer-top';
 sidebarHead.innerHTML='<span>DISCOVER MARS</span>';
 $('sidebar').prepend(sidebarHead); sidebarHead.append($('sidebar-toggle'));
 const tabs = document.createElement('nav'); tabs.id='ui-directory-tabs';tabs.setAttribute('aria-label','Explore collections');
 tabs.innerHTML=[['regions','Places'],['values','Research'],['spacecraft','Spacecraft'],['more','More']].map(([value,label])=>`<button data-directory="${value}" aria-pressed="${value==='regions'}">${label}</button>`).join('');
 $('directory').prepend(tabs);
 const researchPins=document.createElement('label');researchPins.className='ui-research-pins';researchPins.innerHTML='<input id="ui-research-pins" type="checkbox"> Show research pins on the map';$('value-menu').prepend(researchPins);
 $('ui-research-pins').onchange=()=>{for(const key of ['science','minerals','resources']){const input=document.querySelector(`[data-map-layer="${key}"]`);if(input){input.checked=$('ui-research-pins').checked;input.dispatchEvent(new Event('change',{bubbles:true}));}}};
 $('place-type').hidden = true;
 document.querySelector('label[for="place-type"]').hidden = true;

 const imageryNote=$('color-availability');
 if(imageryNote){const disclosure=document.createElement('details');disclosure.className='ui-imagery-details';disclosure.innerHTML='<summary>Imagery source & resolution</summary>';imageryNote.before(disclosure);disclosure.append(imageryNote);}
 const visibility=document.createElement('details');visibility.className='ui-visibility';visibility.innerHTML='<summary>Labels, pins & map guides</summary><p>Choose which objects and drawings appear on your map.</p>';
 const appearancePanel=$('appearance-panel');
 for(const section of [...appearancePanel.querySelectorAll('.layer-list,.layers-actions')])visibility.append(section);
 appearancePanel.append(visibility);
 const profilesObserver=new MutationObserver(()=>{for(const profile of $('route-results').querySelectorAll('.route-profile'))if(!profile.dataset.uiFolded){profile.open=false;profile.dataset.uiFolded='true';}});
 profilesObserver.observe($('route-results'),{childList:true});

 const menu = document.createElement('section');menu.id='ui-mission-menu';menu.className='ui-drawer';menu.hidden=true;menu.setAttribute('aria-label','Mission tools');
 menu.innerHTML=`<button class="ui-close" data-ui-close aria-label="Close mission tools">${svg('close')}</button><div class="ui-kicker">PLAN & RETURN</div><h2>Your next Marswalk</h2><p>Build a route, check the return journey, and keep a record in the field.</p><button class="ui-feature-card" data-action="deploy">${svg('deploy')}<span><strong>Plan a Mission</strong><small>Deploy 3D scientific instruments with offline telemetry</small></span>${svg('chevron')}</button><button class="ui-feature-card" data-action="sites">${svg('explore')}<span><strong>Landing &amp; base sites</strong><small>Compare terrain, sunlight and resource evidence</small></span>${svg('chevron')}</button><button class="ui-feature-card" data-action="routes">${svg('routes')}<span><strong>Compare routes</strong><small>Distance, terrain and nearby science sites</small></span>${svg('chevron')}</button><button class="ui-feature-card" data-action="plan">${svg('plan')}<span><strong>Plan a Marswalk</strong><small>Guided EVAs, round trip, reserves and field navigation</small></span>${svg('chevron')}</button><button class="ui-feature-card" data-action="comms">${svg('system')}<span><strong>Communications coverage</strong><small>Place a tower and map terrain shadows</small></span>${svg('chevron')}</button><button class="ui-feature-card" data-action="saved">${svg('saved')}<span><strong>Saved missions</strong><small>Save, share, import and pick up where you left off</small></span>${svg('chevron')}</button>`;
 document.body.append(menu);
 const help = document.createElement('section');help.id='ui-help';help.className='ui-drawer';help.hidden=true;help.setAttribute('aria-label','Interface guide');
 help.innerHTML=`<button class="ui-close" data-ui-close aria-label="Close interface guide">${svg('close')}</button>
 <div class="ui-kicker">${brand} / QUICK GUIDE</div><h2>Explore, plan and save.</h2>
 <p>Choose a tool from the ${horizon?'bottom workspace dock':orbit?'left dock':'workspace navigation'}. Tools share one drawer; opening another closes the previous panel.</p>
 <ol><li><strong>Choose a place</strong><span>Find a place searches named features. Enter latitude first, then longitude, separated by a space or comma: <code>18.44 77.43</code> or <code>18.44, 77.43</code>. North/east are positive; south/west are negative.</span></li>
 <li><strong>Inspect the map</strong><span>Use 3D, 2D or Compare. Ground opens surface movement controls with Simulate sky enabled by default; Sunlight sets its day/night time. The sky is illustrative, not live weather. Layers offers grayscale/color imagery, optional color enhancement, the coordinate grid and scientific overlays. Check each layer’s source, units and coverage: survey gaps are missing observations, not measured zeroes. Image sharpness does not establish terrain or routing precision.</span></li>
 <li><strong>Plan at your current location</strong><span>Plan Mission keeps your map location when opened. Choose Deploy Hardware, then Click to Place and click the surface, or drag a card onto the map. Selecting a curated target or Fly to Mission Target deliberately moves the view. Equipment outputs are scenario estimates.</span></li>
 <li><strong>Keep your work</strong><span>Use Missions → Saved missions to save, export, share or import a mission. My sites are stored in this browser and included in saved missions; they are not automatically synced between devices.</span></li></ol>
 <details><summary>Mark places and evaluate sites</summary><p>Explore → My sites lets you pick a point, name it and add a description. Mark as a site of value optionally makes it available to nearby route planning. Personal annotations are not scientific detections.</p><p>Missions → Landing &amp; base sites has separate landing and base evaluations. Plan Mission also links directly to base evaluation. Enter coordinates, use the crosshair or Pick site on map, then evaluate. Mark &amp; save keeps a candidate with its score bounds, evidence coverage and source-resolution notes. Unknown or failed screening is retained; a score does not certify safety. After base evaluation, Declare camp sets the same return location used by ARES and Marswalk. Use Set up camp in the Explore header to start a base evaluation, or Go to camp to visit the declared site. Return to camp in the Missions header plans the return, and Use camp as destination in Routes sets B. Camp uses a distinct tent marker. Use Deploy on site to open the hardware catalogue there.</p></details>
 <details><summary>Measure, compare routes and plan a return</summary><p>Measure draws a distance or area from selected map points. Routes compares Direct safe, APF survey and Deep science. Click a route title to show only that route; Show all routes restores the comparison. The dashed purple route is Return. Review its own distance, energy, oxygen and terrain details.</p><p>In Plan → Marswalk, Guided EVAs loads a sourced traverse. Calculate its route, then open the briefing in Mission, test an incident in Replay, or inspect route segments in Terrain hazards. Use Field navigation for position fixes and crew supplies.</p><p>Explore and Walk both open Rover ground imagery. Use Locate on map to visit a photographed area or open its terrain analysis.</p></details>
 <details><summary>Sunlight, Dust ML and Seismic Lab</summary><p>Sunlight explores illumination and terrain shadows at a chosen time. Dust ML displays source context and manual model inputs; its experimental output is not a validated storm forecast. Seismic Lab lets you choose an event, switch raw/bandpass views and run the trigger. Its detector output is distinct from the published event catalogue.</p></details>
 <details><summary>ARES AI and the Mars system</summary><p>ARES AI helps with map and planning questions; verify advice against the linked data and tool limits. Mars system shows moons, orbiters and time controls. Enlarge Sun changes apparent display size, not calculated distance; enlarged spacecraft and moons are visualization aids.</p></details>
 <div class="ui-shortcuts"><span><kbd>/</kbd> Find a place</span><span><kbd>F</kbd> Focus map</span><span><kbd>Esc</kbd> Close panel or cancel picking</span></div>
 <p class="ui-small">Drag to pan · scroll to zoom · use Rotate/right-drag to tilt the 3D view. Ground view has its own movement guide. Map &amp; data shows the active source and loading status. Scientific coverage and limitations remain visible in each tool.</p>`;
 document.body.append(help);
 const caption = document.createElement('div');caption.id='ui-scene-caption';caption.innerHTML=`<span class="ui-kicker">${orbit?'A WORLD TO EXPLORE':'SURFACE WORKSPACE'}</span><strong>Mars</strong><span>One planet. Many frontiers.</span>`;$('workspace').append(caption);
 const contextual = document.createElement('div');contextual.id='ui-task-label';contextual.innerHTML='<span>Surface explorer</span><small>Drag to pan · scroll to zoom</small>';$('workspace').append(contextual);
 const sceneBar=document.createElement('div');sceneBar.id='ui-scene-bar';sceneBar.innerHTML='<button data-action="explore">Explore surface</button><button data-celestial="phobos">Phobos</button><button data-celestial="deimos">Deimos</button><button data-action="system">Orbiters & time</button>';$('workspace').append(sceneBar);
 // Preserve the original buttons and their feature handlers as an integration bridge.
 // The new navigation calls those handlers; it never substitutes scientific logic.
 $('map-tools').setAttribute('aria-hidden','true');
 for(const b of $('map-tools').querySelectorAll('button'))b.tabIndex=-1;
 $('workspace').append($('navigation'),$('ground-help'));
 $('view-switch').setAttribute('aria-label','Map presentation');
 $('view-switch').querySelector('[data-view="split"]').textContent='Compare';
 const viewHost = document.createElement('div');viewHost.id='ui-view-host';viewHost.append($('view-switch'));$('workspace').append(viewHost);
 const data = document.createElement('details');data.id='ui-data-details';data.innerHTML='<summary>Map & data</summary><div></div>';
 const dataBody=data.querySelector('div');dataBody.append($('status'),$('coverage-state'),$('storage-status'),$('view-status'),$('refresh'));document.body.append(data);
 const loading=document.createElement('div');loading.id='ui-loading';loading.setAttribute('role','status');loading.innerHTML='<span></span> Connecting to Mars…';document.body.append(loading);
 const note=document.createElement('div');note.id='ui-toast';note.setAttribute('role','status');note.hidden=true;document.body.append(note);
 const drawers=new Map([['missions',menu],['help',help]]);
 const registerDrawer=(action,node)=>drawers.set(action,node);
 const ensureSidebar = show => {
  if($('sidebar').hidden===show || document.body.classList.contains('sidebar-collapsed')===show) $('sidebar-toggle').click();
 };
 const closeTools = except => {
  for(let i=0;i<panels.length;i++)if(panels[i]!==except&&!$(panels[i])?.hidden)$(closers[i])?.click();
  for(const drawer of drawers.values())drawer.hidden=true;
 };
 const directory = type => {
  focusMode(false);
  closeTools();
  if(type==='spacecraft')$('spacecraft-open').click();
  else {
   $('directory').hidden=false;$('detail').hidden=true;$('value-info').hidden=true;
   $('place-type').value=type;$('place-type').dispatchEvent(new Event('change'));
   $('title').textContent=type==='values'?'Sites of value':'Explore Mars';
   $('category').textContent=type==='values'?'SCIENCE · MINERALS · RESOURCES':'FIND YOUR NEXT DESTINATION';
   $('description').textContent=type==='values'?'Research-backed places and the evidence behind them.':'Landmarks, landing regions and places worth exploring.';
  }
  ensureSidebar(true);sync();
 };
 const perform = action => {
  if(startupFailed){$('graphics-recovery')?.querySelector('a')?.focus();return;}
  if(!ready){queued=action;note.textContent='The map is connecting. Your tool will open when it is ready.';note.hidden=false;return;}
  focusMode(false);lastFocus=document.activeElement;
  if(document.body.classList.contains('moon-view')&&['measure','routes','plan','assistant','solar','dust','seismic','deploy','perimeter','comms'].includes(action))$('home').click();
  if(action==='sites'||action==='base-sites'||action==='camp-setup'){
   if(document.body.classList.contains('moon-view'))$('home').click();
   closeTools('site-evaluation-panel');
   ensureSidebar(false);
   const panel=$('site-evaluation-panel');
   panel.hidden=false;
   document.dispatchEvent(new CustomEvent('atlas-site-evaluation-open',{detail:{mode:action==='sites'?null:'base',campSetup:action==='camp-setup'}}));
   panel.scrollTop=0;
   if(action==='sites')$('site-evaluation-title').focus({preventScroll:true});
  }
  else if(action==='find'){directory('regions');$('search').focus();}
  else if(action==='explore'){const open=!$('sidebar').hidden;closeTools();ensureSidebar(!open);if(!open&&(!pyxis||$('detail').hidden))directory($('place-type').value);}
  else if(drawers.has(action)){const node=drawers.get(action),show=node.hidden;closeTools();ensureSidebar(false);node.hidden=!show;if(show&&pyxis)node.querySelector('h2')?.focus({preventScroll:true});}
  else if(targets[action]){const panel=Object.keys(panelActions).find(id=>panelActions[id]===action),show=$(panel)?.hidden;closeTools(panel);ensureSidebar(false);if(show)$(targets[action])?.click();else $(closers[panels.indexOf(panel)])?.click();}
  sync();
 };
 $('site-evaluation-close').onclick=()=>{$('site-evaluation-panel').hidden=true;};
 document.addEventListener('click',e=>{
  const action=e.target.closest('[data-action]');if(action)perform(action.dataset.action);
  const tab=e.target.closest('[data-directory]');if(tab&&ready)directory(tab.dataset.directory);
  if(e.target.closest('[data-ui-close]')){for(const drawer of drawers.values())drawer.hidden=true;lastFocus?.focus();sync();}
  const celestial=e.target.closest('[data-celestial]');if(celestial&&ready){closeTools('moons-panel');ensureSidebar(false);document.querySelector(`[data-moon="${celestial.dataset.celestial}"]`)?.click();}
 },false);
 function focusMode(on){document.body.classList.toggle('ui-focus',on);$('ui-focus').setAttribute('aria-pressed',String(on));$('ui-focus').setAttribute('aria-label',on?'Show interface':'Focus on map');window.dispatchEvent(new Event('resize'));}
 $('ui-surface').onclick=()=>{if(ready){focusMode(false);closeTools();$('home').click();sync();}};
 $('ui-system').onclick=()=>{if(ready){focusMode(false);closeTools('moons-panel');ensureSidebar(false);$('moons-system').click();sync();}};
 $('ui-focus').onclick=()=>{const on=!document.body.classList.contains('ui-focus');if(on){closeTools();ensureSidebar(false);}focusMode(on);};
 document.addEventListener('keydown',e=>{
  if(e.target.closest('input,select,textarea,[contenteditable="true"]')||e.ctrlKey||e.metaKey||e.altKey||!ready)return;
  if(e.key==='/'){e.preventDefault();directory('regions');$('search').focus();}
  if(e.key.toLowerCase()==='f'&&!document.body.classList.contains('ground-mode'))$('ui-focus').click();
  if(e.key==='Escape'){closeTools();ensureSidebar(false);focusMode(false);lastFocus?.focus();sync();}
 });
 function sync(){
  if(syncing)return;syncing=true;
  const active=panels.find(id=>$(id)&&!$(id).hidden);
  // Features can also open their own panels from map objects or shared links.
  if(active){for(const drawer of drawers.values())if(!drawer.hidden)drawer.hidden=true;if(!$('sidebar').hidden&&ready)ensureSidebar(false);}
  const drawer=[...drawers].find(([,node])=>!node.hidden)?.[0];
  const pane=Boolean(active||!$('sidebar').hidden||drawer);
  document.body.classList.toggle('ui-pane-open',pane);
  const selected=active?panelActions[active]:drawer??(!$('sidebar').hidden?'explore':null);
  syncPyxisSections?.(active);
  const buttons=pyxis?document.querySelectorAll('#ui-rail [data-action],#pyxis-right [data-action],#pyxis-quick-button'):nav.querySelectorAll('[data-action]');
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.action===selected||(orbit&&button.dataset.action==='missions'&&['plan','saved','sites','deploy','comms'].includes(selected))));
  for(const b of tabs.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.directory===$('place-type').value));
  $('ui-research-pins').checked=['science','minerals','resources'].every(k=>document.querySelector(`[data-map-layer="${k}"]`)?.checked);
  const moon=document.body.classList.contains('moon-view');
  $('ui-surface').setAttribute('aria-pressed',String(!moon));$('ui-system').setAttribute('aria-pressed',String(moon));
  $('ui-task-label').querySelector('span').textContent=active?$(active)?.querySelector('h2')?.textContent??'Explore':moon?'Mars system':'Surface explorer';
  $('ui-task-label').querySelector('small').textContent=moon?'Current UTC · real rate 1×':'Drag to pan · scroll to zoom';
  document.body.classList.toggle('ui-directory-open',!$('sidebar').hidden);
  syncing=false;
 }
 if(variant==='field')initFieldInterface({svg,closeTools,ensureSidebar});
 if(pyxis)syncPyxisSections=initPyxisInterface({svg,registerDrawer,panelActions,perform});
 if(horizon)initHorizonInterface({perform,directory,closeTools,ensureSidebar,panels,closers,panelActions,svg});
 // Observe only UI state changes, never the continuously rendered map canvas.
 const observer=new MutationObserver(()=>{sync();window.dispatchEvent(new Event('resize'));});
 for(const id of [...panels,'sidebar','directory','detail',...[...drawers.values()].map(node=>node.id)])if($(id))observer.observe($(id),{attributes:true,attributeFilter:['hidden']});
 const bodyObserver=new MutationObserver(()=>{sync();});bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('atlas-startup-error',()=>{startupFailed=true;queued=null;loading.remove();note.hidden=true;});
 document.addEventListener('atlas-ready',()=>{
  ready=true;loading.remove();note.hidden=true;
  if(orbit)for(const id of ['globe','map2d']){const crosshair=document.createElement('div');crosshair.className='ui-centre-crosshair';crosshair.setAttribute('aria-hidden','true');crosshair.innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="3"/></svg>';$(id).append(crosshair);}
  $('map-tools').querySelectorAll('button').forEach(b=>b.tabIndex=-1);
  for(const id of ['walk-panel','comms-panel'])if($(id))observer.observe($(id),{attributes:true,attributeFilter:['hidden']});
  if(!orbit&&!location.hash&&!panels.some(id=>$(id)&&!$(id).hidden))directory('regions');
  if(queued){const action=queued;queued=null;perform(action);}sync();
 });
 $('place-type').addEventListener('change',sync);
 $('sidebar-toggle').addEventListener('click',()=>queueMicrotask(sync));
 sync();
}

import {HORIZON_WORKSPACES,workspaceForAction} from './interface-workspaces.js';
const $=id=>document.getElementById(id);
const groups=new Map(HORIZON_WORKSPACES.map(group=>[group.id,group]));
export function initHorizonInterface({perform,directory,closeTools,ensureSidebar,panels,closers,panelActions,svg}){
 const dock=document.createElement('nav');dock.id='horizon-dock';dock.setAttribute('aria-label','Workspaces');
 dock.innerHTML=HORIZON_WORKSPACES.map(group=>`<button type="button" data-workspace="${group.id}" aria-expanded="false" title="${group.description}">${svg(group.icon)}<span>${group.label}</span></button>`).join('');document.body.append(dock);for(const button of dock.querySelectorAll('button'))button.disabled=true;
 const context=document.createElement('section');context.id='horizon-context';context.hidden=true;context.setAttribute('aria-label','Workspace tools');document.body.append(context);
 const hub=document.createElement('section');hub.id='horizon-hub';hub.className='map-tool-panel';hub.hidden=true;hub.setAttribute('aria-label','Workspace overview');document.body.append(hub);
 const hubClose=document.createElement('button');hubClose.id='horizon-hub-close';hubClose.className='tool-close';hubClose.type='button';hubClose.setAttribute('aria-label','Close workspace');hubClose.textContent='×';hub.append(hubClose);
 const hubBody=document.createElement('div');hubBody.className='horizon-hub-body';hub.append(hubBody);
 panels.push(hub.id);closers.push(hubClose.id);panelActions[hub.id]='workspace';
 hubClose.onclick=()=>{hub.hidden=true;update();};
 const tools=document.querySelector('.ui-header-tools');
 tools.querySelector('.ui-search').setAttribute('aria-label','Find a place');
 const ask=document.createElement('button');ask.type='button';ask.className='horizon-ares';ask.dataset.action='assistant';ask.innerHTML=svg('assistant')+'<span>Ask ARES</span>';ask.setAttribute('aria-label','Open ARES map and route assistant');tools.insertBefore(ask,$('ui-focus'));
 tools.append($('ui-data-details'));
 const overview=document.createElement('button');overview.id='horizon-overview';overview.type='button';overview.setAttribute('aria-label','Toggle 2D overview');overview.setAttribute('aria-expanded','false');overview.textContent='Overview';$('ui-view-host').append(overview);
 overview.onclick=()=>{const show=!document.body.classList.contains('horizon-overview-open');document.body.classList.toggle('horizon-overview-open',show);overview.setAttribute('aria-expanded',String(show));window.dispatchEvent(new Event('resize'));};
 const caption=$('ui-scene-caption');if(caption){caption.querySelector('.ui-kicker').textContent='MARS FIELD ATLAS';caption.querySelector('strong').textContent='A world to explore.';caption.querySelector('span:last-child').textContent='Surface. Science. Space.';}
 let lastGroup=null,lastActive=null;
 function visible(id){return $(id)&&!$(id).hidden;}
 function activeState(){
  if(visible(hub.id))return {group:hub.dataset.workspace,action:null,panel:hub.id};
  for(const [id,action] of Object.entries(panelActions))if(id!==hub.id&&visible(id))return {group:workspaceForAction(action),action,panel:id};
  if(visible('ui-mission-menu'))return {group:'plan',action:null,panel:'ui-mission-menu'};
  if(visible('sidebar'))return {group:'explore',action:$('place-type').value,panel:'sidebar'};
  return {group:document.body.classList.contains('moon-view')?'system':null,action:null,panel:null};
 }
 function renderContext(groupId){
  const group=groups.get(groupId);if(!group){context.hidden=true;lastGroup=null;return;}
  if(lastGroup!==groupId){context.innerHTML=`<span class="horizon-workspace-label">${group.label} workspace</span><nav aria-label="${group.label} tools">${group.tools.map(tool=>`<button type="button" ${tool.directory?`data-directory="${tool.directory}"`:tool.target||tool.moon?`data-system-tool="${tool.id}"`:`data-action="${tool.id}"`} aria-pressed="false">${tool.label}</button>`).join('')}</nav>`;lastGroup=groupId;}
  context.hidden=false;
 }
 function update(){
  const state=activeState(),open=Boolean(state.panel);document.body.dataset.horizonWorkspace=state.group??'';
  for(const button of dock.querySelectorAll('button')){const selected=button.dataset.workspace===state.group;button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-expanded',String(selected&&open));}
  renderContext(open?state.group:null);
  for(const button of context.querySelectorAll('button'))button.setAttribute('aria-pressed',String((button.dataset.action??button.dataset.directory??button.dataset.systemTool)===state.action));
  document.body.classList.toggle('horizon-ground',$('nav-ground').getAttribute('aria-pressed')==='true');
  const available=visible('mini-wrap');overview.disabled=!available;if(!available){document.body.classList.toggle('horizon-overview-open',false);overview.setAttribute('aria-expanded','false');}
  if(state.panel!==lastActive){lastActive=state.panel;context.dataset.panel=state.panel??'';}
 }
 function showHub(groupId){
  if(document.body.classList.contains('graphics-startup-failed'))return;
  const group=groups.get(groupId);if(!group)return;const closing=visible(hub.id)&&hub.dataset.workspace===groupId;
  if(document.body.classList.contains('ui-focus'))$('ui-focus').click();
  if(document.body.classList.contains('moon-view'))$('ui-surface').click();
  closeTools();ensureSidebar(false);
  if(!closing){hub.dataset.workspace=groupId;hubBody.innerHTML=`<div class="horizon-hub-eyebrow">${groupId==='science'?'OBSERVE & UNDERSTAND':'PLAN & CARRY OUT'}</div><h2>${groupId==='science'?'Science & conditions.':'Plan a Marswalk.'}</h2><p>${group.description}</p><div class="horizon-tool-cards">${group.tools.map(tool=>`<button type="button" data-action="${tool.id}" class="horizon-tool-card"><span class="horizon-card-icon">${svg(tool.icon)}</span><span><strong>${tool.title}</strong><small>${tool.note}</small></span><span class="horizon-card-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>`;hub.hidden=false;}
  update();
 }
 dock.addEventListener('click',event=>{const button=event.target.closest('[data-workspace]');if(!button)return;const id=button.dataset.workspace;
  if(id==='explore'){if(document.body.classList.contains('moon-view'))$('ui-surface').click();perform('explore');}
  else if(id==='system'){if(!document.body.classList.contains('moon-view'))$('ui-system').click();else perform('system');}
  else showHub(id);update();
 });
 context.addEventListener('click',event=>{const button=event.target.closest('[data-system-tool]');if(!button)return;const tool=groups.get('system').tools.find(t=>t.id===button.dataset.systemTool);
  if(tool.moon)document.querySelector(`[data-moon="${tool.moon}"]`)?.click();else if(tool.target==='orbiters-list'){if(!visible('moons-panel'))perform('system');$('orbiters-list')?.scrollIntoView({block:'start',behavior:'smooth'});}else $(tool.target)?.click();
 });
 // React only to tool-state changes, never to the Cesium canvas or its frames.
 const observer=new MutationObserver(update);
 for(const id of [...panels,'sidebar','directory','detail','ui-mission-menu','ui-help','mini-wrap'])if($(id))observer.observe($(id),{attributes:true,attributeFilter:['hidden']});
 observer.observe(document.body,{attributes:true,attributeFilter:['class']});observer.observe($('nav-ground'),{attributes:true,attributeFilter:['aria-pressed']});
 document.addEventListener('change',event=>{if(event.target===$('place-type'))update();});document.addEventListener('atlas-ready',()=>{for(const button of dock.querySelectorAll('button'))button.disabled=false;update();});
 document.addEventListener('atlas-startup-error',()=>{hub.hidden=true;context.hidden=true;for(const button of dock.querySelectorAll('button'))button.disabled=true;});
 const hint=document.createElement('div');hint.id='horizon-mode-hint';hint.textContent='Explore the surface';$('workspace').append(hint);
 const modeObserver=new MutationObserver(()=>{hint.textContent=document.body.classList.contains('moon-view')?'Mars system':'Explore the surface';});modeObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
 update();
}

import {installFieldControls} from './desktop-field-ui.js';
import {restoreDesktopState} from './desktop-persistence.js';
await restoreDesktopState();
export const desktopState=globalThis.window?.marsDesktop?await fetch('/api/desktop/status').then(response=>{if(!response.ok)throw Error('Desktop service unavailable');return response.json();}):null;
export const desktopOffline=desktopState?.mode==='offline';
if(desktopState){
 document.body.dataset.desktop='true';
 if(window.marsDesktop.fieldStatus)installFieldControls(window.marsDesktop);
 const menu=document.createElement('details');menu.id='desktop-status';menu.setAttribute('aria-label','Desktop data and network controls');
 const summary=document.createElement('summary');summary.textContent=(desktopOffline?'Offline':'Online')+' · Desktop';summary.setAttribute('aria-label','Open desktop controls: '+(desktopOffline?'Offline Mode':'Online Mode'));
 const content=document.createElement('div');content.className='desktop-controls-content';
 const heading=document.createElement('strong');heading.textContent='Mars Field Atlas · Desktop';
 const label=document.createElement('p');
 label.textContent=desktopOffline?'OFFLINE · Global starter ≈5.2 km/px · installed detail varies':'ONLINE · Remote sources enabled · coverage varies';
 if(desktopState.globalMap?.available)label.textContent=(desktopOffline?'OFFLINE':'ONLINE')+' · '+desktopState.globalMap.name+' · '+desktopState.globalMap.imageryMetersPerPixel.toLocaleString()+' m/px · Regional detail varies';
 if(desktopState.registryWarning)label.textContent+=' · '+desktopState.registryWarning;
 const modeLabel=document.createElement('label');modeLabel.textContent='Network mode';modeLabel.htmlFor='desktop-network-mode';
 const mode=document.createElement('select');mode.id='desktop-network-mode';
 for(const value of ['offline','online']){const option=document.createElement('option');option.value=value;option.textContent=value==='offline'?'Offline Mode':'Online Mode';option.selected=value===desktopState.mode;mode.append(option);}
 mode.onchange=async()=>{mode.disabled=true;try{await window.marsDesktop.setMode(mode.value);}catch(error){label.textContent=error.message;mode.disabled=false;}};
 const actions=document.createElement('div');actions.className='desktop-controls-actions';
 for(const [name,event] of [['Map Manager','atlas-map-manager'],['ARES Models','atlas-model-manager'],['ARES Voice','atlas-voice-settings'],['Position / dead reckoning','atlas-dead-reckoning']]){const button=document.createElement('button');button.type='button';button.textContent=name;if(event==='atlas-dead-reckoning'){button.disabled=document.documentElement.dataset.atlasReady!=='true';document.addEventListener('atlas-ready',()=>{button.disabled=false;},{once:true});}button.onclick=()=>{menu.open=false;document.dispatchEvent(new Event(event));};actions.append(button);}
 content.append(heading,label,modeLabel,mode,actions);menu.append(summary,content);document.body.append(menu);
 const attach=()=>{const host=document.querySelector('.ui-header-tools');if(host){host.append(menu);menu.classList.add('desktop-controls-attached');}};
 document.addEventListener('atlas-interface-ready',attach);attach();
 document.addEventListener('pointerdown',event=>{if(menu.open&&!menu.contains(event.target))menu.open=false;});
 menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;summary.focus();event.stopPropagation();}});
 const modelNote=document.querySelector('.assistant-model-option + .tool-note');
 if(modelNote)modelNote.textContent='Uses the app-managed runtime and your selected GGUF in either network mode. Offline speech input requires the app recognition component. Optional spoken-reply packs can be installed in ARES Voice settings.';
}

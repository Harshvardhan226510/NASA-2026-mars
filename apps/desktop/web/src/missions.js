import {validateMission,encodeMission,decodeMission,MAX_MISSION_BYTES,matchesMissionSelection} from './mission-state.js';
const $=id=>document.getElementById(id),libraryKey='mars-atlas-missions-v1',draftKey='mars-atlas-session-v1';
export class MissionLibrary{
 constructor({capture,restore,restoreCamp,onOpen}){
  Object.assign(this,{capture,restore,restoreCamp,onOpen});this.suspended=true;
  try{this.saved=JSON.parse(localStorage.getItem(libraryKey))??[];if(!Array.isArray(this.saved))this.saved=[];}catch{this.saved=[];}
  $('mission-toggle').onclick=()=>this.open($('mission-panel').hidden);$('mission-close').onclick=()=>this.open(false);
  $('mission-name').oninput=()=>this.schedule();
  $('mission-save').onclick=()=>this.action(()=>{const state=this.snapshot();if(this.saved.length>=5)throw new Error('Five missions are saved here. Export or remove one before saving another.');const next=[{id:crypto.randomUUID(),state},...this.saved];localStorage.setItem(libraryKey,JSON.stringify(next));this.saved=next;this.list();this.autosave();this.status('Mission saved in this browser. Download a copy for safekeeping.');});
  $('mission-download').onclick=()=>this.action(()=>{const state=this.snapshot(),url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=state.name.replace(/[^\w -]/g,'').slice(0,60)+'.mars-mission.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.status('Mission file downloaded with points, route results, layers and viewpoint.');});
  $('mission-share').onclick=()=>this.action(async()=>{const encoded=await encodeMission(this.snapshot()),url=new URL(location.origin+location.pathname);url.hash='mission='+encoded;await navigator.clipboard.writeText(url.href);this.status('Mission link copied. Anyone with this link can open the included mission.');});
  $('mission-import').onchange=()=>this.action(async()=>{const file=$('mission-import').files[0];if(!file)return;if(file.size>MAX_MISSION_BYTES)throw new Error('Choose a mission file smaller than 2 MB.');await this.load(validateMission(JSON.parse(await file.text())));$('mission-import').value='';});
  document.addEventListener('atlas-mission-change',()=>this.schedule());document.addEventListener('atlas-mission-save-request',()=>this.autosave());
  document.addEventListener('change',e=>{if(e.target.closest('#appearance-panel,#route-settings,#measure-panel,#detail'))this.schedule();});
  window.addEventListener('pagehide',()=>this.autosave());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.autosave();});this.list();
 }
 open(show){$('mission-panel').hidden=!show;$('mission-toggle').setAttribute('aria-expanded',String(show));$('mission-toggle').setAttribute('aria-pressed',String(show));if(show)this.onOpen?.();}
 status(message){$('mission-status').textContent=message;}
 async action(fn){try{await fn();}catch(e){this.status(e.name==='QuotaExceededError'?'Browser storage is full. Download a mission file instead.':e.message);}}
 snapshot(){return validateMission({...this.capture(),name:$('mission-name').value.trim()||'Untitled mission',saved_at:new Date().toISOString()});}
 schedule(){if(this.suspended)return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.autosave(),1200);}
 autosave(){if(this.suspended)return;clearTimeout(this.timer);try{localStorage.setItem(draftKey,JSON.stringify(this.snapshot()));$('mission-autosave').textContent=globalThis.window?.marsDesktop?'Session saved automatically on this device.':'Session saved automatically in this browser.';document.dispatchEvent(new CustomEvent('atlas-mission-save',{detail:{ok:true}}));}catch(error){$('mission-autosave').textContent='Session could not be saved here. '+error.message;document.dispatchEvent(new CustomEvent('atlas-mission-save',{detail:{ok:false,error:error.message}}));}}
 async load(state,{automatic=false}={}){const clean=validateMission(state);this.suspended=true;try{await this.restore(clean,{automatic});$('mission-name').value=clean.name;this.status(`Opened “${clean.name}”. Saved route results are restored without recalculation.`);}finally{this.suspended=false;}this.autosave();}
 async init(){
  const params=new URLSearchParams(location.hash.slice(1));try{if(params.has('mission')){await this.load(await decodeMission(params.get('mission')));this.open(true);}else{const raw=localStorage.getItem(draftKey);if(raw){const draft=validateMission(JSON.parse(raw));if(matchesMissionSelection(params,draft.selection))await this.load(draft,{automatic:true});else this.restoreCamp?.(draft.route.operation);}}}catch(e){this.status('Unable to restore this mission: '+e.message);this.open(true);}finally{this.suspended=false;}
 }
 list(){
  $('mission-list').replaceChildren();for(const item of this.saved.slice(0,5)){const row=document.createElement('li'),load=document.createElement('button'),remove=document.createElement('button');load.textContent=String(item.state?.name??'Saved mission');load.onclick=()=>this.action(()=>this.load(item.state));remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+load.textContent);remove.onclick=()=>this.action(()=>{const next=this.saved.filter(s=>s.id!==item.id);localStorage.setItem(libraryKey,JSON.stringify(next));this.saved=next;this.list();this.status('Removed from this browser. Downloaded files and shared links are unchanged.');});row.append(load,remove);$('mission-list').append(row);}
 }
}

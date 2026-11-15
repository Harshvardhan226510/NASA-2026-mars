import {mountThinkingOrb} from './thinking-orb.js';

export function voiceActivityState({listening=false,speaking=false}={}){
 return speaking?'speaking':listening?'listening':'idle';
}
export const voiceOrbState=state=>state==='listening'?'listening':state==='speaking'?'composing':'breathing';
export function voiceActivityMarkup(){
 return '<canvas class="voice-thinking-orb" width="64" height="64" aria-hidden="true"></canvas><span class="voice-activity-label" role="status" aria-live="polite">Voice idle</span>';
}
export function mountVoiceActivity(root,assistantName='ARES'){
 if(!root?.dataset||typeof MutationObserver==='undefined'||root.dataset.voiceActivityMounted)return;
 root.dataset.voiceActivityMounted='true';root.innerHTML=voiceActivityMarkup();
 const label=root.querySelector('.voice-activity-label');
 const orb=mountThinkingOrb(root.querySelector('canvas'));
 const sync=()=>{
  const state=voiceActivityState({listening:root.classList.contains('active'),speaking:root.classList.contains('speaking')});
  if(root.dataset.voiceState===state)return;
  root.dataset.voiceState=state;label.textContent={idle:'Voice idle',listening:'Listening to you',speaking:assistantName+' speaking'}[state];
  orb.setState(voiceOrbState(state),state==='idle');
 };
 sync();new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['class']});
}

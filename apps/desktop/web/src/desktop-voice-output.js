// Local playback uses AudioContext, so no OS text-to-speech voice is required for the pack.
export class DesktopVoiceOutput{
 constructor({note,button,onSpeaking,isMuted}){
  Object.assign(this,{note,button,onSpeaking,isMuted});this.sequence=0;this.refreshSequence=0;this.info=null;
  window.speechSynthesis?.addEventListener('voiceschanged',()=>void this.refresh());document.addEventListener('atlas-voice-pack-changed',()=>{this.stop();void this.refresh();});
  document.addEventListener('pointerdown',event=>{if(event.target.closest?.('#assistant-panel'))this.unlock();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();});window.addEventListener('blur',()=>this.stop());window.addEventListener('pagehide',()=>this.stop());
  const panel=document.getElementById('assistant-panel');if(panel)new MutationObserver(()=>{if(panel.hidden)this.stop();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
  void this.refresh();
 }
 voices(){return window.speechSynthesis?.getVoices().filter(voice=>voice.localService&&voice.lang.toLowerCase().startsWith('en'))??[];}
 unlock(){try{this.context??=new AudioContext();void this.context.resume().catch(()=>{});}catch{}}
 async refresh(){const current=++this.refreshSequence;try{const info=await window.marsDesktop.voicePackStatus();if(current!==this.refreshSequence)return;this.info=info;const system=this.voices().length>0,available=info.mode==='pack'?info.installed:info.mode==='system'?system:system||info.installed;this.button.disabled=!available;this.button.textContent=available?(this.isMuted()?'🔇 Voice OFF':'🔊 Voice ON'):'Voice unavailable';this.note.textContent=info.mode==='pack'?(info.installed?'Spoken replies use the offline ARES voice pack.':'Install the optional voice pack in ARES Voice settings.'):system?'Spoken replies use an installed offline English voice.':info.mode==='auto'&&info.installed?'No English system voice found. Spoken replies use the offline ARES voice pack.':'No offline English voice is available. Add the optional pack in ARES Voice settings.';}catch{this.note.textContent='Voice status is unavailable. Text replies remain available.';}}
 stop(){++this.sequence;this.cancelSystem?.();this.cancelSystem=null;window.speechSynthesis?.cancel();this.source?.stop();this.source=null;this.onSpeaking(false);const id=this.request;this.request=null;if(id)void window.marsDesktop.cancelSpokenReply(id).catch(()=>{});}
 async speak(text){
  this.stop();const sequence=this.sequence;
  try{
   if(this.isMuted())return;
   const info=await window.marsDesktop.voicePackStatus();if(sequence!==this.sequence)return;
   let voices=this.voices();if(info.mode!=='pack'&&!voices.length&&window.speechSynthesis){await new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);window.speechSynthesis.removeEventListener('voiceschanged',done);resolve();};timer=setTimeout(done,1500);window.speechSynthesis.addEventListener('voiceschanged',done,{once:true});});voices=this.voices();}
   if(sequence!==this.sequence||this.isMuted())return;
   if(info.mode!=='pack'&&voices.length){
    const succeeded=await new Promise(resolve=>{let timer;const finish=value=>{clearTimeout(timer);if(sequence===this.sequence)this.cancelSystem=null;resolve(value);};this.cancelSystem=()=>finish(false);timer=setTimeout(()=>{window.speechSynthesis.cancel();finish(false);},120000);const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voices[0];utterance.rate=1.05;utterance.pitch=.95;utterance.onstart=()=>{if(sequence===this.sequence)this.onSpeaking(true);};utterance.onend=()=>{if(sequence===this.sequence)this.onSpeaking(false);finish(true);};utterance.onerror=()=>{if(sequence===this.sequence)this.onSpeaking(false);finish(false);};window.speechSynthesis.speak(utterance);});
    if(succeeded||sequence!==this.sequence)return;if(info.mode==='system'){this.note.textContent='The system voice could not speak. The reply is shown as text; try Automatic or the optional offline pack in Voice settings.';return;}
   }
   if(!info.installed||info.mode==='system'){this.note.textContent='No usable offline voice is available. Open ARES Voice settings to install the optional pack.';return;}
   const id=crypto.randomUUID();this.request=id;this.note.textContent='Preparing spoken reply locally…';
   const wav=await window.marsDesktop.synthesizeVoice(id,text.slice(0,4000));if(sequence!==this.sequence||this.isMuted())return;this.request=null;
   this.context??=new AudioContext();await this.context.resume();if(sequence!==this.sequence)return;
   const bytes=new Uint8Array(wav);const decoded=await this.context.decodeAudioData(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));if(sequence!==this.sequence)return;
   const audio=this.context.createBufferSource();audio.buffer=decoded;audio.connect(this.context.destination);audio.onended=()=>{if(this.source===audio){this.source=null;this.onSpeaking(false);}};this.source=audio;this.onSpeaking(true);audio.start();this.note.textContent='Spoken replies use the offline ARES voice pack.';
  }catch(error){if(sequence===this.sequence){this.onSpeaking(false);this.note.textContent=error.message+'. The reply remains available as text.';}}finally{if(sequence===this.sequence)this.request=null;}
 }
}

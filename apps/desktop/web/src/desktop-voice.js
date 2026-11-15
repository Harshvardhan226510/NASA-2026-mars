if(globalThis.window?.marsDesktop){
 window.marsDesktop.onVoicePackProgress(progress=>{if(progress.state==='installed')document.dispatchEvent(new Event('atlas-voice-pack-changed'));});
 let opening=false;
 async function openVoiceSetup(firstRun=false){
  if(opening)return;opening=true;let unsubscribe;
  try{
   const info=await window.marsDesktop.voicePackStatus();if(firstRun&&(info.setupComplete||!info.setupRequested))return;
   const modal=document.createElement('dialog');modal.setAttribute('aria-label','Optional ARES voice setup');modal.style.cssText='max-width:640px;width:85vw;max-height:85vh;overflow:auto;background:#14212c;color:#f4e4d1;border:1px solid #9a7350;border-radius:12px;padding:24px;font:14px system-ui';
   const heading=document.createElement('h2');heading.textContent=firstRun?'Finish setup · Optional ARES voice':'ARES Voice';
   const note=document.createElement('p');note.textContent='Add a local speech engine and English voice for spoken replies, including on computers without system voices. This is optional and separate from the ARES language model and microphone recognition.';
   const entry=info.catalog[0];
   const choice=document.createElement('label'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=firstRun&&info.setupRequested;checkbox.disabled=info.installed;choice.append(checkbox,document.createTextNode(info.installed?'Offline engine and voice installed':'Install offline speech engine + English voice'));
   const sizes=document.createElement('p'),size=value=>(value/1024**2).toFixed(1)+' MiB';sizes.textContent=entry?`${entry.name} · Download ${size(entry.bytes)} · Installed ${size(entry.installedBytes)} · Temporary space up to ${size(entry.temporaryBytes)} plus headroom`:'This draft has no published voice pack yet. Download size will appear after the platform packs have been built and tested.';
   const licence=document.createElement('p');licence.textContent=entry?'Pack licences: '+entry.licence+'. Source and licence notices are included.':'The final pack will include its engine licence, source and voice provenance.';
   const consent=document.createElement('p');consent.textContent='Downloading contacts only the approved component source. Map Offline Mode stays unchanged. Speech generation uses this device after installation.';
   const modeLabel=document.createElement('label');modeLabel.textContent='Spoken reply voice ';const mode=document.createElement('select');mode.setAttribute('aria-label','Spoken reply voice');for(const [value,text] of [['auto','Automatic: system voice, then offline pack'],['system','Installed system voice'],['pack','Offline ARES voice pack']]){const option=document.createElement('option');option.value=value;option.textContent=text;mode.append(option);}mode.value=info.mode;modeLabel.append(mode);
   const status=document.createElement('p');status.setAttribute('role','status');status.textContent=info.installed?'Offline voice pack installed.':info.progress?.error??'';
   const install=document.createElement('button');install.type='button';install.textContent='Download and install selected pack';const pause=document.createElement('button');pause.type='button';pause.textContent='Pause download';pause.disabled=true;
   const active=progress=>['downloading','verifying','installing'].includes(progress?.state);const reflect=progress=>{info.progress=progress;status.textContent=progress.error??`${progress.state} · ${size(progress.received??0)} / ${size(progress.total??entry?.bytes??0)}`;install.disabled=active(progress)||!entry?.downloadAvailable||!checkbox.checked||progress.state==='installed';pause.disabled=!active(progress);if(progress.state==='installed'){checkbox.checked=true;checkbox.disabled=true;document.dispatchEvent(new Event('atlas-voice-pack-changed'));}else if(['paused','failed'].includes(progress.state))install.textContent='Retry / resume selected pack';};
   const update=()=>{install.disabled=!entry?.downloadAvailable||!checkbox.checked||checkbox.disabled||active(info.progress);};checkbox.onchange=update;update();
   install.onclick=async()=>{install.disabled=true;try{await window.marsDesktop.installVoicePack(entry.id,true);reflect({state:'downloading',received:0,total:entry.bytes});}catch(error){status.textContent=error.message;install.disabled=false;}};
   const local= document.createElement('button');local.type='button';local.textContent='Install downloaded voice ZIP';local.disabled=!entry||info.installed;local.onclick=async()=>{local.disabled=true;try{const result=await window.marsDesktop.importVoicePack();if(!result.cancelled){status.textContent='Offline voice pack installed.';document.dispatchEvent(new Event('atlas-voice-pack-changed'));}}catch(error){status.textContent=error.message;}finally{local.disabled=false;}};
   if(entry&&!entry.downloadAvailable)consent.textContent='Download the matching optional voice ZIP from this app’s GitHub release, then select Install downloaded voice ZIP. Repository access may require signing in. Installation and spoken replies work offline; no access token is stored in the app.';
   pause.onclick=()=>window.marsDesktop.pauseVoicePack().catch(error=>{status.textContent=error.message;});
   mode.onchange=async()=>{try{await window.marsDesktop.configureVoicePack({mode:mode.value});document.dispatchEvent(new Event('atlas-voice-pack-changed'));}catch(error){status.textContent=error.message;}};
   const close=document.createElement('button');close.type='button';close.textContent=firstRun?'Continue to app':'Close';close.onclick=()=>modal.close();
   unsubscribe=window.marsDesktop.onVoicePackProgress(reflect);if(info.progress)reflect(info.progress);
   modal.append(heading,note,choice,sizes,licence,consent,modeLabel,status,install,local,pause,close);document.body.append(modal);
   await new Promise(resolve=>{modal.addEventListener('close',()=>{unsubscribe?.();modal.remove();void window.marsDesktop.configureVoicePack({completeSetup:true}).catch(()=>{});resolve();},{once:true});modal.showModal();});
  }finally{unsubscribe?.();opening=false;}
 }
 document.addEventListener('atlas-voice-settings',()=>void openVoiceSetup().catch(()=>{}));
 document.addEventListener('atlas-interface-ready',()=>{if(!window.marsDesktop.diagnosticsEnabled)void openVoiceSetup(true).catch(()=>{});},{once:true});
}

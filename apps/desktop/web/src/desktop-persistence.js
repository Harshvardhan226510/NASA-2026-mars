const managedKey=key=>/^mars-(?:atlas|field-atlas)-[\w-]{1,96}$/.test(key);

export function preferenceSnapshot(storage){
 const preferences={};
 for(let index=0;index<storage.length;index++){
  const key=storage.key(index);if(managedKey(key))preferences[key]=storage.getItem(key);
 }
 return {schema:'mars-desktop-ui/1',preferences};
}

export function createPreferencePersistence({api,storage}){
 let ready=false,lastSaved,disposed=false;
 const initialized=(async()=>{
  const saved=await api.readUIState();
  if(saved?.schema==='mars-desktop-ui/1'){
   for(const key of Object.keys(preferenceSnapshot(storage).preferences))storage.removeItem(key);
   for(const [key,value] of Object.entries(saved.preferences))if(managedKey(key)&&typeof value==='string')storage.setItem(key,value);
   lastSaved=JSON.stringify(preferenceSnapshot(storage));
  }
  ready=true;
 })();
 return {ready:initialized,
  async flush(){
   await initialized;if(disposed||!ready)return;
   const snapshot=preferenceSnapshot(storage),serialized=JSON.stringify(snapshot);
   if(serialized===lastSaved)return;
   await api.saveUIState(snapshot);lastSaved=serialized;
  },
  dispose(){disposed=true;},
 };
}

export async function restoreDesktopState(){
 const api=globalThis.window?.marsDesktop;
 if(!api?.readUIState||!api?.saveUIState)return;
 let persistence;
 try{persistence=createPreferencePersistence({api,storage:localStorage});await persistence.ready;}catch(error){console.warn('desktop_state_restore',error.message);return;}
 let timer;
 const report=error=>{console.warn('desktop_state_save',error.message);const status=document.getElementById('mission-autosave');if(status)status.textContent='Latest session could not be saved. '+error.message;document.dispatchEvent(new CustomEvent('atlas-state-save-error',{detail:{message:error.message}}));};
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>persistence.flush().catch(report),350);};
 for(const event of ['change','click','input','atlas-mission-save','atlas-preferences-change'])document.addEventListener(event,schedule);
 setInterval(()=>persistence.flush().catch(report),3000);
 window.__atlasSaveState=async()=>{
  clearTimeout(timer);
  const waiting=[];document.dispatchEvent(new CustomEvent('atlas-before-state-save',{detail:{waitUntil:promise=>waiting.push(promise)}}));await Promise.all(waiting);
  let captureError;
  const missionResult=event=>{if(event.detail?.ok===false)captureError=event.detail.error;};
  const draftError=event=>{captureError=event.detail?.message;};
  document.addEventListener('atlas-mission-save',missionResult);document.addEventListener('atlas-state-save-error',draftError);
  try{document.dispatchEvent(new Event('atlas-mission-save-request'));document.dispatchEvent(new Event('atlas-map-draft-save-request'));}
  finally{document.removeEventListener('atlas-mission-save',missionResult);document.removeEventListener('atlas-state-save-error',draftError);}
  if(captureError)throw Error(captureError);
  await persistence.flush();return true;
 };
 window.addEventListener('pagehide',()=>{void window.__atlasSaveState().catch(report);});
}

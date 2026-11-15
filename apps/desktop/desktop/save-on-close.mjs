export function saveBeforeClose(window,{save,onFailure,timeoutMs=8000}){
 let pending=false,ready=false;
 window.on('close',event=>{
  if(ready||window.webContents.isDestroyed())return;
  event.preventDefault();if(pending)return;pending=true;
  let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Saving the latest application state timed out.')),timeoutMs);});
  Promise.race([Promise.resolve().then(save),deadline]).then(()=>{
   ready=true;window.close();
  },async error=>{
   if(await onFailure(error)){ready=true;window.close();}else pending=false;
  }).catch(()=>{pending=false;}).finally(()=>clearTimeout(timer));
 });
}

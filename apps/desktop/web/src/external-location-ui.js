import {locationFix,freshLocation} from './external-location.js';
const node=(tag,text)=>{const item=document.createElement(tag);if(text)item.textContent=text;return item;};
export function externalLocationControl(api,onApply){
 if(!api?.locationStatus)return null;
 const root=node('details');root.className='user-site-external-location';root.append(node('summary','Use external location system'));
 const label=node('label','Location source'),source=node('select');source.id='user-site-location-source';label.htmlFor=source.id;
 const status=node('p','Open to check the local location API.');status.setAttribute('role','status');
 const use=node('button','Use these coordinates');use.type='button';use.disabled=true;
 const note=node('p','Copies the latest fix into this site. Review it, then choose Save site.');note.className='tool-note';
 root.append(label,source,status,use,note);
 let data,loading=false;
 function selected(){return data?.sources.find(fix=>fix.sourceId===source.value);}
 function render(){
  const fix=selected(),ready=Boolean(data?.api?.enabled&&fix?.fresh&&freshLocation(fix));use.disabled=!ready;source.disabled=!data?.api?.enabled||!data.sources.length;
  if(!data?.api?.enabled){status.textContent=data?.api?.error??'Location API is off. Configure the local API port and token, then relaunch Atlas.';return;}
  if(!fix){status.textContent='API ready on 127.0.0.1:'+data.api.port+' · Waiting for a location fix.';return;}
  status.textContent=(ready?'Ready':'Stale fix')+' · '+fix.point[1]+'°N, '+fix.point[0]+'°E · '+fix.at+' · '+(fix.accuracyMeters==null?'Accuracy unknown':fix.accuracyMeters+' m reported accuracy');
 }
 async function refresh(){
  if(loading)return;loading=true;
  try{const before=source.value;data=await api.locationStatus();source.replaceChildren();for(const fix of data.sources){const option=node('option',fix.sourceId);option.value=fix.sourceId;source.append(option);}if(!data.sources.length){const option=node('option','Waiting for location source');option.value='';source.append(option);}if(data.sources.some(fix=>fix.sourceId===before))source.value=before;render();}
  catch(error){data=null;use.disabled=true;status.textContent='Location input unavailable: '+error.message;}
  finally{loading=false;}
 }
 source.onchange=render;root.addEventListener('toggle',()=>{if(root.open)void refresh();});
 use.onclick=async()=>{await refresh();const fix=selected();if(!fix?.fresh||!freshLocation(fix)){render();return;}onApply(locationFix(fix));};
 const timer=setInterval(()=>{if(root.isConnected&&root.open&&!root.closest('[hidden]')&&!document.hidden)void refresh();},1000);
 return {element:root,refresh,dispose:()=>clearInterval(timer)};
}

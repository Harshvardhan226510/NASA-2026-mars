import {MAX_SITE_ATTACHMENTS,validateSiteAttachments} from './site-attachments.js';
const node=(tag,text)=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;return item;};
const size=bytes=>bytes<1024?bytes+' B':bytes<1024**2?(bytes/1024).toFixed(1)+' KiB':bytes<1024**3?(bytes/1024**2).toFixed(1)+' MiB':(bytes/1024**3).toFixed(2)+' GiB';

export function siteAttachmentEditor({api,onChange,onBusy}){
 const root=node('section');root.className='user-site-attachments';root.setAttribute('aria-label','Site attachments');
 root.append(node('h3','Attachments'));
 const add=node('button','Add files');add.type='button';const status=node('p');status.setAttribute('role','status');
 const list=node('div');list.className='user-site-attachment-list';
 const note=node('small','Images, videos and other files · up to 32 per site. Save the site to keep changes.');
 root.append(add,status,list,note);
 let items=[],busy=false,pending=Promise.resolve(),revision=0;
 const supported=Boolean(api?.addSiteAttachments);
 function changed(){onChange?.(validateSiteAttachments(items));}
 function render(){
  const ticket=++revision;list.replaceChildren();add.disabled=!supported||busy||items.length>=MAX_SITE_ATTACHMENTS;
  if(!supported)status.textContent='Add and save file copies in the desktop app.';
  if(!items.length)list.append(node('p','No attachments.'));
  const rows=new Map();
  for(const item of items){
   const card=node('article');card.className='user-site-attachment';card.append(node('strong',item.name),node('small',size(item.bytes)));
   const availability=node('small',supported?'Checking local file…':'File stored on the originating device.');card.append(availability);rows.set(item.id,{card,availability,item});
   const actions=node('div');actions.className='user-site-actions';
   const save=node('button','Save a copy');save.type='button';save.disabled=!supported;save.onclick=async()=>{try{const result=await api.exportSiteAttachment(item.id);if(!result?.cancelled)status.textContent='Saved a copy of '+item.name+'.';}catch(error){status.textContent=error.message;}};
   const remove=node('button','Remove from site');remove.type='button';remove.disabled=busy;remove.setAttribute('aria-label','Remove attachment '+item.name);remove.onclick=()=>{items=items.filter(value=>value.id!==item.id);render();changed();status.textContent='Removed from this draft. Save the site to keep the change.';};
   actions.append(save,remove);card.append(actions);list.append(card);
  }
  if(api?.siteAttachmentStatus&&items.length)api.siteAttachmentStatus(items.map(item=>item.id)).then(results=>{
   if(ticket!==revision)return;
   for(const result of results){
    const row=rows.get(result.id);if(!row)continue;
    row.availability.textContent=result.available?'Stored locally':'Missing on this device — attach the file again.';
    row.card.querySelector('button').disabled=!result.available;
    if(result.available&&(row.item.mediaType.startsWith('image/')||row.item.mediaType.startsWith('video/'))){
     const image=row.item.mediaType.startsWith('image/'),preview=node(image?'img':'video');preview.className='user-site-attachment-preview';preview.src='/api/desktop/site-attachment?id='+encodeURIComponent(result.id);
     if(image){preview.alt=row.item.name;preview.loading='lazy';preview.decoding='async';}else{preview.controls=true;preview.preload='none';preview.setAttribute('aria-label','Video attachment '+row.item.name);}
     preview.onerror=()=>{preview.hidden=true;row.availability.textContent='Preview unavailable. Use Save a copy to view this file.';};
     row.card.insertBefore(preview,row.availability);
    }
   }
  }).catch(error=>{if(ticket===revision)status.textContent='Could not check attachments: '+error.message;});
 }
 add.onclick=()=>{
  if(busy)return;busy=true;onBusy?.(true);render();status.textContent='Selecting and copying files…';
  pending=(async()=>{
   try{
    const result=await api.addSiteAttachments(MAX_SITE_ATTACHMENTS-items.length);
    if(result?.cancelled){status.textContent='Selection cancelled.';return;}
    items=validateSiteAttachments([...items,...(result.attachments??[])]);changed();
    status.textContent=(result.attachments?.length??0)+' file(s) added. Save the site to keep them.'+(result.errors?.length?' '+result.errors.map(error=>error.name+': '+error.error).join(' '):'');
   }catch(error){status.textContent='Files could not be added: '+error.message;}
   finally{busy=false;onBusy?.(false);render();}
  })();
 };
 api?.onSiteAttachmentProgress?.(progress=>{if(busy)status.textContent='Copying '+progress.name+' · '+size(progress.received)+' / '+size(progress.total);});
 document.addEventListener('atlas-before-state-save',event=>{if(busy)event.detail?.waitUntil?.(pending);});
 render();
 return {element:root,set(value=[]){if(busy)return;items=validateSiteAttachments(value);render();},snapshot:()=>validateSiteAttachments(items),get busy(){return busy;}};
}

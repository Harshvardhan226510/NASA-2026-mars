export const MAX_SITE_ATTACHMENTS=32;
export const ATTACHMENT_ID=/^attachment-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const previews=new Set(['image/png','image/jpeg','image/gif','image/webp','video/mp4','video/webm','video/quicktime']);
export function validateSiteAttachments(input=[]){
 if(!Array.isArray(input)||input.length>MAX_SITE_ATTACHMENTS)throw Error('A marked site supports up to '+MAX_SITE_ATTACHMENTS+' attachments.');
 const seen=new Set();
 return input.map(item=>{
  if(!item||!ATTACHMENT_ID.test(item.id)||seen.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>240||/[\u0000-\u001f]/.test(item.name)||!Number.isSafeInteger(item.bytes)||item.bytes<0||!/^[a-f0-9]{64}$/.test(item.sha256)||!Number.isFinite(Date.parse(item.addedAt)))throw Error('Invalid site attachment reference.');
  seen.add(item.id);
  return {id:item.id,name:item.name,bytes:item.bytes,sha256:item.sha256,addedAt:new Date(item.addedAt).toISOString(),mediaType:previews.has(item.mediaType)?item.mediaType:'application/octet-stream'};
 });
}

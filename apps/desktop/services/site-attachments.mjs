import {mkdir,readFile,writeFile,rename,stat,statfs,open,lstat,realpath,unlink,copyFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {validateSiteAttachments,ATTACHMENT_ID,MAX_SITE_ATTACHMENTS} from '../web/src/site-attachments.js';

function mediaType(bytes){
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)))return 'image/gif';
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
 if(bytes.toString('ascii',4,8)==='ftyp')return bytes.toString('ascii',8,12)==='qt  '?'video/quicktime':'video/mp4';
 if(bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]))&&bytes.includes(Buffer.from('webm')))return 'video/webm';
 return 'application/octet-stream';
}

export function safeAttachmentName(name){
 const clean=path.basename(name).replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[ .]+$/,'').slice(0,200)||'attachment.bin';
 return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean)?'_'+clean:clean;
}

export class SiteAttachmentStore{
 constructor(directory){this.directory=path.resolve(directory);this.file=path.join(this.directory,'index.json');this.entries=[];this.pending=Promise.resolve();}
 async load(){
  try{
   if((await stat(this.file)).size>8*1024*1024)throw Error('Attachment index exceeds its size limit');
   const entries=JSON.parse(await readFile(this.file,'utf8'));
   if(!Array.isArray(entries)||entries.length>20000)throw Error('Invalid attachment index');
   const seen=new Set();
   this.entries=entries.map(entry=>{const clean=validateSiteAttachments([entry])[0];if(seen.has(clean.id)||!Number.isFinite(entry.mtimeMs))throw Error('Invalid attachment index');seen.add(clean.id);return {...clean,mtimeMs:entry.mtimeMs};});
  }catch(error){if(error.code!=='ENOENT'){await rename(this.file,this.file+'.invalid-'+Date.now());this.recovered=true;}}
  return this;
 }
 metadata(entry){const {mtimeMs,...metadata}=entry;return metadata;}
 importFiles(files,{onProgress=()=>{}}={}){
  if(!Array.isArray(files)||!files.length||files.length>MAX_SITE_ATTACHMENTS||files.some(file=>typeof file!=='string'||!path.isAbsolute(file)))throw Error('Choose 1–'+MAX_SITE_ATTACHMENTS+' local files.');
  const task=this.pending.catch(()=>{}).then(async()=>{
   const attachments=[],errors=[];
   for(const [index,file] of files.entries()){
    try{attachments.push(await this.copy(file,progress=>onProgress({...progress,index:index+1,count:files.length})));}
    catch(error){errors.push({name:path.basename(file),error:error.message});}
   }
   return {attachments,errors};
  });this.pending=task;return task;
 }
 async copy(source,onProgress){
  if(this.entries.length>=20000)throw Error('The local attachment library is full.');
  await mkdir(this.directory,{recursive:true});
  const handle=await open(source,'r');const id='attachment-'+randomUUID(),part=path.join(this.directory,id+'.part'),target=path.join(this.directory,id+'.bin');
  try{
   const before=await handle.stat();if(!before.isFile()||!Number.isSafeInteger(before.size))throw Error('Choose a regular local file.');
   const disk=await statfs(this.directory);if(disk.bavail*disk.bsize<before.size+64*1024**2)throw Error('Not enough free storage to copy this attachment.');
   const hash=createHash('sha256');let received=0,header=Buffer.alloc(0),last=0;
   const progress=()=>onProgress({name:path.basename(source),received,total:before.size});progress();
   const inspect=new Transform({transform(chunk,_encoding,callback){hash.update(chunk);received+=chunk.length;if(header.length<4096)header=Buffer.concat([header,chunk.subarray(0,4096-header.length)]);if(Date.now()-last>=200){last=Date.now();progress();}callback(null,chunk);}});
   await pipeline(handle.createReadStream({autoClose:false}),inspect,createWriteStream(part,{flags:'wx',mode:0o600}));
   const after=await handle.stat();if(received!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs)throw Error('The selected file changed while it was being copied. Try again.');
   await rename(part,target);const info=await stat(target);
   const entry={id,name:safeAttachmentName(path.basename(source)),bytes:received,sha256:hash.digest('hex'),mediaType:mediaType(header),addedAt:new Date().toISOString(),mtimeMs:info.mtimeMs};
   const next=[...this.entries,entry],index=JSON.stringify(next);if(Buffer.byteLength(index)>8*1024*1024)throw Error('The local attachment index is full.');await writeFile(this.file+'.tmp',index,{mode:0o600});await rename(this.file+'.tmp',this.file);this.entries=next;progress();return this.metadata(entry);
  }finally{await handle.close();await unlink(part).catch(error=>{if(error.code!=='ENOENT')throw error;});}
 }
 async asset(id){
  if(!ATTACHMENT_ID.test(id))throw Error('Invalid attachment identifier');
  const entry=this.entries.find(item=>item.id===id);if(!entry)throw Error('This attachment is not stored on this device. Attach the file again.');
  const relative=id+'.bin',target=path.join(this.directory,relative),info=await lstat(target);
  if(!info.isFile()||info.isSymbolicLink()||info.size!==entry.bytes||info.mtimeMs!==entry.mtimeMs)throw Error('The local attachment is missing or changed. Attach the file again.');
  const [base,resolved]=await Promise.all([realpath(this.directory),realpath(target)]);if(path.dirname(resolved)!==base)throw Error('Attachment path escapes local storage');
  return {base,relative,path:resolved,...this.metadata(entry)};
 }
 async status(ids){
  if(!Array.isArray(ids)||ids.length>MAX_SITE_ATTACHMENTS||ids.some(id=>!ATTACHMENT_ID.test(id)))throw Error('Invalid attachment identifiers');
  return Promise.all(ids.map(async id=>{try{await this.asset(id);return {id,available:true};}catch{return {id,available:false};}}));
 }
 async saveCopy(id,destination){const asset=await this.asset(id);const base=await realpath(this.directory);let resolved;try{resolved=await realpath(destination);}catch(error){if(error.code!=='ENOENT')throw error;resolved=path.join(await realpath(path.dirname(destination)),path.basename(destination));}if(resolved===base||resolved.startsWith(base+path.sep))throw Error('Choose a destination outside the attachment library.');await copyFile(asset.path,destination);return true;}
}

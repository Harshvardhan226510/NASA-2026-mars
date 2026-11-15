import {readFile,writeFile,mkdir,rename,stat} from 'node:fs/promises';
import path from 'node:path';

const MAX_BYTES=24*1024*1024;
export function validateUIState(value){
 if(value?.schema!=='mars-desktop-ui/1'||!value.preferences||typeof value.preferences!=='object'||Array.isArray(value.preferences))throw Error('Invalid saved application state');
 const entries=Object.entries(value.preferences);
 if(entries.length>64||entries.some(([key,text])=>!/^mars-(?:atlas|field-atlas)-[\w-]{1,96}$/.test(key)||typeof text!=='string'||Buffer.byteLength(text)>12*1024*1024))throw Error('Invalid application preference');
 const clean={schema:'mars-desktop-ui/1',preferences:Object.fromEntries(entries)};
 if(Buffer.byteLength(JSON.stringify(clean))>MAX_BYTES)throw Error('Saved application state exceeds its storage limit');
 return clean;
}

export class UIStateStore{
 constructor(directory){this.directory=directory;this.file=path.join(directory,'ui-state.json');this.value=null;this.pending=Promise.resolve();}
 async load(){
  try{if((await stat(this.file)).size>MAX_BYTES)throw Error('Saved state exceeds size limit');this.value=validateUIState(JSON.parse(await readFile(this.file,'utf8')));}
  catch(error){if(error.code!=='ENOENT'){await rename(this.file,this.file+'.invalid-'+Date.now());this.recovered=true;}}
  return this;
 }
 snapshot(){return this.value?structuredClone(this.value):null;}
 save(value){
  const clean=validateUIState(value),bytes=JSON.stringify(clean);
  this.pending=this.pending.catch(()=>{}).then(async()=>{
   await mkdir(this.directory,{recursive:true});await writeFile(this.file+'.tmp',bytes,{mode:0o600});await rename(this.file+'.tmp',this.file);this.value=clean;
  });
  return this.pending;
 }
}

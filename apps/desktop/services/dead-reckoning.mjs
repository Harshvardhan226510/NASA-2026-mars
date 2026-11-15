import {mkdir,readFile,writeFile,rename,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {createDRSession,engageDR,pauseDR,acceptDRSample,restoreDRSession} from '../web/src/dead-reckoning.js';
export class DeadReckoningService extends EventEmitter{
 constructor(directory){super();this.directory=directory;this.state=null;this.pending=Promise.resolve();this.warning=null;}
 async load(){try{const file=path.join(this.directory,'latest.json');if((await stat(file)).size>8*1024**2)throw Error('Saved position session is too large');this.state=restoreDRSession(JSON.parse(await readFile(file,'utf8')));this.warning='Previous session restored paused. Check the start and select Engage to accept new readings.';}catch(error){if(error.code!=='ENOENT'){const original=path.join(this.directory,'latest.json'),backup=path.join(this.directory,'latest.invalid-'+randomUUID()+'.json');await rename(original,backup).catch(()=>{});this.warning='Previous position session could not be restored. A readable session is required before re-engaging; set a new start.';}}return this;}
 snapshot(){return {state:structuredClone(this.state),warning:this.warning,deviceConnected:false,localInput:this.localInput??null};}
 async save(state){await mkdir(path.join(this.directory,'sessions'),{recursive:true});const data=JSON.stringify(state);if(data.length>8*1024**2)throw Error('Position session exceeds storage limit');const archive=path.join(this.directory,'sessions',state.id+'.json');await writeFile(archive+'.tmp',data,{mode:0o600});await rename(archive+'.tmp',archive);const latest=path.join(this.directory,'latest.json');await writeFile(latest+'.tmp',data,{mode:0o600});await rename(latest+'.tmp',latest);}
 change(operation){const next=this.pending.catch(()=>{}).then(async()=>{const candidate=operation(structuredClone(this.state));await this.save(candidate);this.state=candidate;this.warning=null;const snapshot=this.snapshot();this.emit('change',snapshot);return snapshot;});this.pending=next;return next;}
 setStart(value){return this.change(state=>{if(state?.phase==='engaged')throw Error('Pause before setting a new starting location');return createDRSession(value?.point,value?.options,randomUUID());});}
 engage(){return this.change(state=>engageDR(state,randomUUID()));}
 pause(){return this.change(state=>{if(!state)throw Error('Set a starting location first');return pauseDR(state);});}
 ingest(samples,{external=false}={}){if(!Array.isArray(samples)||!samples.length||samples.length>200||JSON.stringify(samples).length>256*1024)return Promise.reject(Error('Submit between 1 and 200 bounded samples'));return this.change(state=>{
  if(external&&state?.options.mode==='manual')throw Error('Select Gear readings or Ready positions before sending live input');
  for(const sample of samples)acceptDRSample(state,sample);
  return state;
 });}
 async flush(){await this.pending.catch(()=>{});}
}

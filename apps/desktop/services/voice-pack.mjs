import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,lstat,stat,statfs,realpath,copyFile,open,rename,mkdtemp,rm,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {NetworkPolicy} from './network-policy.mjs';
import source from '../runtime/voice-output-config.json' with {type:'json'};
const hashPattern=/^[a-f0-9]{64}$/;
async function digest(file){const hash=createHash('sha256');for await(const part of createReadStream(file))hash.update(part);return hash.digest('hex');}
function safeName(name){return typeof name==='string'&&name.length<=240&&name.split('/').every(part=>/^[A-Za-z0-9_.+! -]+$/.test(part)&&!['.','..'].includes(part)&&!/[. ]$/.test(part)&&!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));}
export function validateVoiceEntry(entry){
 if(!entry||!/^ares-voice-[a-z0-9-]{1,100}$/.test(entry.id)||!['win32','linux'].includes(entry.platform)||!['x64','arm64'].includes(entry.architecture)||!Number.isSafeInteger(entry.bytes)||entry.bytes<1||entry.bytes>512*1024**2||!hashPattern.test(entry.sha256)||!Array.isArray(entry.files)||!entry.files.length||entry.files.length>5000)throw Error('Invalid optional voice catalogue entry');
 const names=new Set();let total=0;
 for(const file of entry.files){if(!safeName(file.path)||names.has(file.path.toLowerCase())||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>256*1024**2||!hashPattern.test(file.sha256))throw Error('Invalid voice file inventory');names.add(file.path.toLowerCase());total+=file.bytes;}
 if(total>1024**3||entry.installedBytes!==total||!safeName(entry.executable)||!safeName(entry.model)||!entry.files.some(file=>file.path===entry.executable&&file.executable===true)||!entry.files.some(file=>file.path===entry.model&&file.sha256===source.voice.files[0].sha256)||!entry.files.some(file=>file.path===entry.model+'.json'&&file.sha256===source.voice.files[1].sha256))throw Error('Voice package inventory or model identity differs from the app');
 return entry;
}
export class VoicePackService{
 constructor({directory,temporaryDirectory,settings,catalog,python,fetcher,notify=()=>{}}){Object.assign(this,{directory:path.resolve(directory),temporaryDirectory:path.resolve(temporaryDirectory),settings,catalog,python,fetcher,notify});this.job=null;this.synthesis=null;this.synthesisSequence=0;this.pendingSpeechId=null;this.verified=new Map();}
 entries(){return this.catalog.entries.filter(entry=>entry.approved===true&&entry.platform===process.platform&&entry.architecture===process.arch).map(validateVoiceEntry);}
 selected(){return this.entries().find(entry=>entry.id===this.settings.value.voicePackId);}
 async status(){const entry=this.selected();let installed=false;if(entry)installed=await stat(path.join(this.directory,entry.id,entry.executable)).then(info=>info.isFile()).catch(()=>false);return {installed,name:entry?.name,mode:this.settings.value.voiceOutputMode??'auto',setupComplete:this.settings.value.voiceSetupComplete===true,setupRequested:this.settings.value.voiceSetupRequested===true,catalog:this.entries().map(({id,name,bytes,installedBytes,licence,sourceURL,url})=>({id,name,bytes,installedBytes,temporaryBytes:bytes+installedBytes,licence,sourceURL,downloadAvailable:typeof url==='string'&&url.startsWith('https://')})),progress:this.job?.progress};}
 async configure(value){if(!value||typeof value!=='object')throw Error('Invalid voice settings');if(value.mode!==undefined){if(!['auto','system','pack'].includes(value.mode))throw Error('Invalid voice output mode');this.settings.value.voiceOutputMode=value.mode;}if(value.completeSetup===true)this.settings.value.voiceSetupComplete=true;await this.settings.save();return this.status();}
 async verify(entry){if(this.verified.has(entry.id))return this.verified.get(entry.id);const pending=(async()=>{for(const file of entry.files){const target=path.join(this.directory,entry.id,...file.path.split('/')),info=await lstat(target);if(!info.isFile()||info.isSymbolicLink()||info.size!==file.bytes||await digest(target)!==file.sha256)throw Error('Installed offline voice failed verification; reinstall it from the approved source.');}})();this.verified.set(entry.id,pending);try{await pending;}catch(error){this.verified.delete(entry.id);throw error;}}
 start(id,consent){
  if(consent!==true)throw Error('Confirm the optional voice download first');
  if(this.job&&['downloading','verifying','installing'].includes(this.job.progress.state))throw Error('An optional voice installation is already active');
  const entry=this.entries().find(item=>item.id===id);if(!entry||!/^https:\/\//.test(entry.url))throw Error('No approved voice download is available for this build');
  const job={controller:new AbortController(),progress:{id,state:'downloading',received:0,total:entry.bytes}};this.job=job;
  const update=value=>{job.progress={...job.progress,...value};this.notify(job.progress);};
  job.promise=this.install(entry,job.controller.signal,update).catch(error=>update({state:job.controller.signal.aborted?'paused':'failed',error:job.controller.signal.aborted?'Voice installation paused. Retry to resume.':error.message}));return true;
 }
 async importArchive(file){
  if(this.job&&['downloading','verifying','installing'].includes(this.job.progress.state))throw Error('Pause the current voice installation first');
  const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>512*1024**2)throw Error('Choose a regular approved voice ZIP');
  const entry=this.entries().find(item=>item.bytes===info.size&&item.sha256);if(!entry)throw Error('No voice pack with this size is approved for this platform');
  if(await digest(file)!==entry.sha256)throw Error('Voice ZIP checksum differs from the approved component');
  const job={controller:new AbortController(),progress:{id:entry.id,state:'verifying',received:entry.bytes,total:entry.bytes}};this.job=job;
  const update=value=>{job.progress={...job.progress,...value};this.notify(job.progress);};
  await mkdir(this.directory,{recursive:true});const archive=path.join(this.directory,entry.id+'.zip');
  if(path.resolve(file)!==path.resolve(archive)){const target=await lstat(archive).catch(error=>{if(error.code==='ENOENT')return null;throw error;});if(target?.isSymbolicLink())throw Error('Voice archive destination cannot be a link');await copyFile(file,archive);}
  try{await this.install(entry,job.controller.signal,update);return this.status();}catch(error){update({state:'failed',error:error.message});throw error;}
 }
 pause(){this.job?.controller.abort(Error('Voice installation paused'));}
 async install(entry,signal,update){
  await mkdir(this.directory,{recursive:true});const base=await realpath(this.directory);if(base!==this.directory)throw Error('Voice storage cannot use a link');
  const target=path.join(base,entry.id),archive=path.join(base,entry.id+'.zip'),partial=archive+'.part';
  if(await lstat(target).catch(()=>null)){await this.verify(entry);this.settings.value.voicePackId=entry.id;await this.settings.save();update({state:'installed',received:entry.bytes});return;}
  const partialInfo=await lstat(partial).catch(error=>{if(error.code==='ENOENT')return null;throw error;});if(partialInfo&&(partialInfo.isSymbolicLink()||!partialInfo.isFile()||partialInfo.size>entry.bytes))throw Error('Invalid partial voice download');
  const archiveInfo=await lstat(archive).catch(error=>{if(error.code==='ENOENT')return null;throw error;});if(archiveInfo&&(archiveInfo.isSymbolicLink()||!archiveInfo.isFile()))throw Error('Invalid voice archive');
  let offset=partialInfo?.size??0;const disk=await statfs(base,{bigint:true});if(disk.bavail*disk.bsize<BigInt(entry.bytes-offset+entry.installedBytes+64*1024**2))throw Error('Insufficient free space for the voice download and installation');
  if(!(archiveInfo?.size===entry.bytes&&await digest(archive)===entry.sha256)){
   // This scoped policy permits only this explicitly requested, catalogue-pinned transfer.
   // It does not enable online maps or external speech services in the application.
   const transfer=new NetworkPolicy('online');
   if(offset<entry.bytes){const response=await transfer.fetch(this.fetcher,entry.url,{headers:offset?{Range:`bytes=${offset}-`}:{},signal});if(!response.ok||(response.headers.get('content-type')??'').includes('text/html')){await response.body?.cancel();throw Error('Optional voice source is unavailable or requires access');}if(offset&&response.status===200)offset=0;else if(offset&&(response.status!==206||!response.headers.get('content-range')?.startsWith(`bytes ${offset}-`))){await response.body?.cancel();throw Error('Invalid voice download resume range');}else if(!offset&&response.status!==200){await response.body?.cancel();throw Error('Unexpected voice source response');}const declared=response.headers.get('content-length');if(declared&&Number(declared)!==entry.bytes-offset){await response.body?.cancel();throw Error('Voice download size changed');}const handle=await open(partial,partialInfo?'r+':'wx');if(partialInfo&&(await handle.stat()).ino!==partialInfo.ino){await handle.close();throw Error('Partial voice download changed unexpectedly');}if(!offset)await handle.truncate(0);let received=offset,last=0;try{for await(const chunk of response.body){if(signal.aborted)throw signal.reason;if(received+chunk.length>entry.bytes)throw Error('Voice download exceeded pinned size');let position=0;while(position<chunk.length){const written=await handle.write(chunk,position,chunk.length-position,received+position);if(!written.bytesWritten)throw Error('Voice storage write failed');position+=written.bytesWritten;}received+=chunk.length;if(Date.now()-last>350){last=Date.now();update({state:'downloading',received});}}}finally{await handle.close();}if(received!==entry.bytes)throw Error('Voice download interrupted. Retry to resume.');}
   if(signal.aborted)throw signal.reason;update({state:'verifying',received:entry.bytes});if(await digest(partial)!==entry.sha256){await rm(partial,{force:true});throw Error('Optional voice checksum mismatch; retry a fresh download');}await rename(partial,archive);
  }
  if(signal.aborted)throw signal.reason;update({state:'installing',received:entry.bytes});let stage;
  try{stage=await mkdtemp(path.join(base,'stage-'));const result=await this.python.run('science.voice_pack',{archive,destination:stage,files:entry.files},signal);if(result.code!==0||result.data.schema!=='ares-voice-install/1')throw Error(result.data.error??'Voice unpacking failed');if(signal.aborted)throw signal.reason;await rename(stage,target);stage=null;this.verified.delete(entry.id);await this.verify(entry);this.settings.value.voicePackId=entry.id;this.settings.value.voiceSetupComplete=true;await this.settings.save();await rm(archive,{force:true});update({state:'installed'});}finally{if(stage&&path.dirname(path.resolve(stage))===base)await rm(stage,{recursive:true,force:true});}
 }
 async cleanup(){await mkdir(this.directory,{recursive:true});const base=await realpath(this.directory);if(base!==this.directory)throw Error('Voice storage cannot use a link');for(const item of await readdir(base,{withFileTypes:true})){const target=path.resolve(base,item.name);if(item.isDirectory()&&/^stage-[A-Za-z0-9]+$/.test(item.name)&&path.dirname(target)===base)await rm(target,{recursive:true,force:true});}await mkdir(this.temporaryDirectory,{recursive:true,mode:0o700});if((await lstat(this.temporaryDirectory)).isSymbolicLink())throw Error('Invalid speech output temporary directory');for(const item of await readdir(this.temporaryDirectory,{withFileTypes:true})){const target=path.resolve(this.temporaryDirectory,item.name);if(item.isDirectory()&&/^reply-[A-Za-z0-9]+$/.test(item.name)&&path.dirname(target)===this.temporaryDirectory)await rm(target,{recursive:true,force:true});}}
 async synthesize(id,text){
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id)||typeof text!=='string'||text.length<1||text.length>4000)throw Error('Invalid spoken reply');
  const entry=this.selected();if(!entry)throw Error('Install the optional offline voice pack in ARES Voice settings');const previous=this.synthesis;this.cancelSpeech();const sequence=++this.synthesisSequence;this.pendingSpeechId=id;if(previous)await previous.done;if(sequence!==this.synthesisSequence)throw Error('Speech cancelled');this.pendingSpeechId=null;
  const job={id,child:null,cancelled:false};job.done=new Promise(resolve=>{job.finish=resolve;});this.synthesis=job;let temporary;
  try{await this.verify(entry);if(job.cancelled)throw Error('Speech cancelled');temporary=await mkdtemp(path.join(this.temporaryDirectory,'reply-'));if(job.cancelled)throw Error('Speech cancelled');const output=path.join(temporary,'reply.wav'),directory=path.join(this.directory,entry.id);
   await new Promise((resolve,reject)=>{const child=spawn(path.join(directory,...entry.executable.split('/')),['--model',path.join(directory,...entry.model.split('/')),'--output',output],{cwd:directory,windowsHide:true,stdio:['pipe','ignore','ignore'],env:{...process.env,OMP_NUM_THREADS:'2',PYTHONNOUSERSITE:'1'}});job.child=child;let timedOut=false;const timer=setTimeout(()=>{timedOut=true;child.kill();},120000);child.stdin.on('error',()=>{});child.once('error',()=>{clearTimeout(timer);reject(Error('Offline voice engine could not start'));});child.once('close',code=>{clearTimeout(timer);if(job.cancelled)reject(Error('Speech cancelled'));else if(timedOut)reject(Error('Offline speech generation timed out'));else if(code!==0)reject(Error('Offline speech generation failed'));else resolve();});child.stdin.end(JSON.stringify({text}));});
   if(job.cancelled)throw Error('Speech cancelled');if((await stat(output)).size>8*1024**2)throw Error('Spoken reply exceeded audio limit');const wav=await readFile(output);if(wav.length<44||wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')throw Error('Offline voice returned invalid audio');return new Uint8Array(wav);
  }finally{try{if(temporary&&path.dirname(path.resolve(temporary))===this.temporaryDirectory)await rm(temporary,{recursive:true,force:true});}finally{if(this.synthesis===job)this.synthesis=null;job.finish();}}
 }
 cancelSpeech(id){if(!id||this.pendingSpeechId===id){++this.synthesisSequence;this.pendingSpeechId=null;}if(this.synthesis&&(!id||this.synthesis.id===id)){this.synthesis.cancelled=true;this.synthesis.child?.kill();}}
 stop(){this.pause();this.cancelSpeech();}
}

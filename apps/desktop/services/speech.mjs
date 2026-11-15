import {spawn} from 'node:child_process';
import {createReadStream,existsSync} from 'node:fs';
import {mkdir,mkdtemp,writeFile,readFile,stat,lstat,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import config from '../runtime/speech-config.json' with {type:'json'};

// Accept only the app's canonical, bounded mono PCM WAV; no user-controlled paths or codecs.
export function validateSpeechWav(input){
 if(!(input instanceof Uint8Array)||input.byteLength<44||input.byteLength>44+16000*2*config.maxSeconds)throw Error('Record between 0.25 and 30 seconds of speech');
 const wav=Buffer.from(input.buffer,input.byteOffset,input.byteLength),bytes=wav.length-44;
 if(wav.toString('ascii',0,4)!=='RIFF'||wav.readUInt32LE(4)!==wav.length-8||wav.toString('ascii',8,12)!=='WAVE'||wav.toString('ascii',12,16)!=='fmt '||wav.readUInt32LE(16)!==16||wav.readUInt16LE(20)!==1||wav.readUInt16LE(22)!==1||wav.readUInt32LE(24)!==16000||wav.readUInt32LE(28)!==32000||wav.readUInt16LE(32)!==2||wav.readUInt16LE(34)!==16||wav.toString('ascii',36,40)!=='data'||wav.readUInt32LE(40)!==bytes||bytes%2||bytes<8000)throw Error('Expected a 16 kHz mono PCM speech recording');
 let energy=0;for(let i=44;i<wav.length;i+=2)energy+=(wav.readInt16LE(i)/32768)**2;
 return {wav,silent:Math.sqrt(energy/(bytes/2))<0.003};
}
async function digest(file){const hash=createHash('sha256');for await(const part of createReadStream(file))hash.update(part);return hash.digest('hex');}
export class SpeechService{
 constructor({directory,temporaryDirectory}){this.directory=directory;this.temporaryDirectory=path.resolve(temporaryDirectory);this.executable=path.join(directory,process.platform==='win32'?'whisper-cli.exe':'whisper-cli');this.model=path.join(directory,config.model.filename);this.active=null;this.verified=null;}
 status(){const available=[this.executable,this.model,path.join(this.directory,'BUILD_MANIFEST.json')].every(existsSync);return {available,language:'English',maxSeconds:config.maxSeconds,state:this.active?'transcribing':available?'installed':'unavailable',message:available?'Offline speech input installed. Review the transcript before sending.':'Offline voice input is not installed in this build. Text commands remain available.'};}
 async cleanup(){
  await mkdir(this.temporaryDirectory,{recursive:true,mode:0o700});
  if((await lstat(this.temporaryDirectory)).isSymbolicLink())throw Error('Invalid speech temporary directory');
  for(const entry of await readdir(this.temporaryDirectory,{withFileTypes:true})){
   const target=path.resolve(this.temporaryDirectory,entry.name);
   if(entry.isDirectory()&&/^clip-[A-Za-z0-9]+$/.test(entry.name)&&path.dirname(target)===this.temporaryDirectory)await rm(target,{recursive:true,force:true});
  }
 }
 async verify(){
  if(this.verified)return this.verified;
  this.verified=(async()=>{
   if(!this.status().available)throw Error(this.status().message);
   const manifest=JSON.parse(await readFile(path.join(this.directory,'BUILD_MANIFEST.json'),'utf8'));
   if(manifest.schema!==config.schema||manifest.commit!==config.commit||manifest.platform!==process.platform||manifest.architecture!==process.arch||!Array.isArray(manifest.files))throw Error('Offline speech runtime identity differs from this app');
   for(const name of [path.basename(this.executable),config.model.filename]){
    const expected=manifest.files.find(file=>file.path===name),file=path.join(this.directory,name);
    if(!expected||!Number.isSafeInteger(expected.bytes)||!/^[a-f0-9]{64}$/.test(expected.sha256)||(await lstat(file)).isSymbolicLink()||(await stat(file)).size!==expected.bytes||await digest(file)!==expected.sha256)throw Error('Offline speech component failed verification');
    if(name===config.model.filename&&(expected.bytes!==config.model.bytes||expected.sha256!==config.model.sha256))throw Error('Unexpected speech recognition model');
   }
  })().catch(error=>{this.verified=null;throw error;});
  return this.verified;
 }
 async transcribe(input,signal){
  if(this.active)throw Error('A voice recording is already being transcribed');
  const {wav,silent}=validateSpeechWav(input);if(silent)return {text:'',reason:'No clear speech detected. Try speaking closer to the microphone.'};
  const job={child:null,cancelled:false};this.active=job;let directory;
  const cancel=()=>{job.cancelled=true;job.child?.kill();};signal?.addEventListener('abort',cancel,{once:true});
  try{
   await this.verify();if(signal?.aborted||job.cancelled)throw Error('Voice input cancelled');
   await mkdir(this.temporaryDirectory,{recursive:true,mode:0o700});directory=await mkdtemp(path.join(this.temporaryDirectory,'clip-'));
   const audio=path.join(directory,'recording.wav'),output=path.join(directory,'transcript');await writeFile(audio,wav,{mode:0o600,flag:'wx'});
   if(signal?.aborted||job.cancelled)throw Error('Voice input cancelled');
   await new Promise((resolve,reject)=>{
    const child=spawn(this.executable,['--model',this.model,'--file',audio,'--language','en','--threads',String(Math.min(4,os.availableParallelism())),'--no-gpu','--no-fallback','--max-context','0','--output-json','--output-file',output,'--no-prints'],{cwd:this.directory,windowsHide:true,stdio:['ignore','ignore','ignore']});job.child=child;
    let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;child.kill();},120000);
    child.once('error',error=>{clearTimeout(timeout);reject(Error('Offline speech engine could not start: '+error.code));});
    child.once('close',code=>{clearTimeout(timeout);if(timedOut)reject(Error('Speech recognition timed out. Try a shorter recording.'));else if(job.cancelled)reject(Error('Voice input cancelled'));else if(code!==0)reject(Error('Offline speech recognition failed. Text commands remain available.'));else resolve();});
   });
   if(job.cancelled)throw Error('Voice input cancelled');
   const result=output+'.json';if((await stat(result)).size>256*1024)throw Error('Speech transcript exceeded its size limit');
   const parsed=JSON.parse(await readFile(result,'utf8'));if(!Array.isArray(parsed.transcription)||parsed.transcription.some(item=>typeof item.text!=='string'))throw Error('Invalid speech transcript');
   const text=parsed.transcription.map(item=>item.text).join(' ').replace(/\[.*?\]|<\|.*?\|>/g,' ').replace(/\s+/g,' ').trim();
   if(text.length>4000)throw Error('Voice transcript is too long');
   return {text,reason:text?undefined:'No clear speech detected. Try again.'};
  }finally{
   signal?.removeEventListener('abort',cancel);
   try{if(directory&&path.dirname(path.resolve(directory))===this.temporaryDirectory)await rm(directory,{recursive:true,force:true});}finally{if(this.active===job)this.active=null;}
  }
 }
 stop(){if(this.active){this.active.cancelled=true;this.active.child?.kill();}}
}

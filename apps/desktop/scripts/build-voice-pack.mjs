// Explicit build-host preparation only. Never invoked by app startup or installation.
import {spawnSync} from 'node:child_process';
import {mkdir,stat} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import config from '../runtime/voice-output-config.json' with {type:'json'};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),platform=process.platform+'-'+process.arch,wheel=config.engine.wheels[platform];
if(!wheel)throw Error('Build the optional voice pack on native Windows x64 or Linux ARM64');
const downloads=path.join(root,'runtime/downloads/voice-output');await mkdir(downloads,{recursive:true});
async function digest(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function pinnedDownload(url,file,spec){if(await stat(file).then(info=>info.size===spec.bytes).catch(()=>false)&&await digest(file)===spec.sha256)return;const response=await fetch(url);if(!response.ok)throw Error('Pinned voice build source unavailable');let size=0;const bounded=new TransformStream({transform(chunk,controller){size+=chunk.length;if(size>spec.bytes)throw Error('Voice build source exceeded pinned size');controller.enqueue(chunk);}});await pipeline(Readable.fromWeb(response.body.pipeThrough(bounded)),createWriteStream(file));if(size!==spec.bytes||await digest(file)!==spec.sha256)throw Error('Voice build source checksum mismatch');}
const release='https://github.com/OHF-Voice/piper1-gpl/releases/download/v'+config.engine.version;
await pinnedDownload(release+'/'+wheel.filename,path.join(downloads,wheel.filename),wheel);
await pinnedDownload(release+'/piper_tts-1.8.0.tar.gz',path.join(downloads,'piper_tts-1.8.0.tar.gz'),{bytes:24276117,sha256:'830588aded347df579c91a32703e0fc2a3685d84f1e3533b14f2de69135d4904'});
for(const file of config.voice.files)await pinnedDownload(`https://huggingface.co/${config.voice.repository}/resolve/${config.voice.revision}/${config.voice.directory}/${file.path}`,path.join(downloads,file.path),file);
function run(exe,args){const result=spawnSync(exe,args,{cwd:root,windowsHide:true,stdio:'inherit'});if(result.status!==0)throw Error('Optional voice build failed: '+exe+' ('+(result.error?.message??result.status)+')');}
const python=process.env.MARS_BUILD_PYTHON??(process.platform==='win32'?'python':'python3'),environment=path.join(root,'runtime/staging/voice-build-venv');run(python,['-m','venv',environment]);const buildPython=path.join(environment,process.platform==='win32'?'Scripts/python.exe':'bin/python');
run(buildPython,['-m','pip','install',path.join(downloads,wheel.filename),'onnxruntime==1.23.2','numpy==2.3.5','pathvalidate==3.3.1','pyinstaller==6.17.0']);
run(buildPython,['-m','pip','download','--no-deps','--no-binary',':all:','--dest',downloads,'pyinstaller==6.17.0']);
run(buildPython,['-m','PyInstaller','--noconfirm','--clean','--onedir','--name','mars-voice','--collect-all','piper','--collect-all','onnxruntime','--collect-all','numpy','--distpath',path.join(root,'runtime/staging/voice-output'),'--workpath',path.join(root,'artifacts/voice-output-build'),'--specpath',path.join(root,'artifacts'),path.join(root,'runtime/voice_entry.py')]);
run(buildPython,[path.join(root,'scripts/prepare-voice-pack.py'),root,process.platform,process.arch]);
console.log('Prepared a separate optional voice archive and unapproved release descriptor. No installer or acceptance result is implied.');

// Explicit preparation step for final builds. Never runs on app startup or npm install.
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile,copyFile,stat,rename,rm} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import config from '../runtime/speech-config.json' with {type:'json'};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!((process.platform==='win32'&&process.arch==='x64')||(process.platform==='linux'&&process.arch==='arm64')))throw Error('Speech recipe supports native Windows x64 and Linux ARM64 hosts');
const staging=path.join(root,'runtime/staging'),source=path.join(staging,'whisper-source'),build=path.join(staging,'whisper-build'),output=path.join(staging,'speech');await mkdir(output,{recursive:true});
function run(exe,args,capture=false){const result=spawnSync(exe,args,{cwd:root,windowsHide:true,stdio:capture?'pipe':'inherit',encoding:'utf8'});if(result.status!==0)throw Error(`Speech preparation failed: ${exe} (${result.error?.message??result.status})`);return result.stdout?.trim();}
async function digest(file){const hash=createHash('sha256');for await(const part of createReadStream(file))hash.update(part);return hash.digest('hex');}
if(!await stat(path.join(source,'.git')).catch(()=>null))run('git',['clone','--depth','1','--branch',config.tag,config.repository+'.git',source]);
if(run('git',['-C',source,'rev-parse','HEAD'],true)!==config.commit)throw Error('Speech source differs from pinned revision');
if(run('git',['-C',source,'status','--porcelain','--untracked-files=no'],true))throw Error('Speech source contains modifications');
run('cmake',['-S',source,'-B',build,...(process.platform==='win32'?['-A','x64']:[]),'-DCMAKE_BUILD_TYPE=Release','-DCMAKE_POLICY_DEFAULT_CMP0091=NEW','-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded','-DBUILD_SHARED_LIBS=OFF','-DGGML_NATIVE=OFF','-DGGML_BACKEND_DL=OFF','-DGGML_CUDA=OFF','-DGGML_VULKAN=OFF','-DGGML_BLAS=OFF','-DGGML_OPENMP=OFF','-DGGML_CPU_KLEIDIAI=OFF','-DWHISPER_BUILD_IS_DEV=OFF','-DWHISPER_BUILD_TESTS=OFF','-DWHISPER_BUILD_SERVER=OFF','-DWHISPER_BUILD_EXAMPLES=ON','-DWHISPER_CURL=OFF','-DWHISPER_SDL2=OFF','-DWHISPER_COMMON_FFMPEG=OFF']);
run('cmake',['--build',build,'--config','Release','--target','whisper-cli','-j','2']);
const name=process.platform==='win32'?'whisper-cli.exe':'whisper-cli';await copyFile(path.join(build,'bin',...(process.platform==='win32'?['Release']:[]),name),path.join(output,name));
await copyFile(path.join(source,'LICENSE'),path.join(output,'WHISPER_CPP_LICENSE.txt'));
// The converted model publisher declares MIT. Preserve both that card and original model licence.
const licenceURL=`https://raw.githubusercontent.com/openai/whisper/v20250625/LICENSE`;
for(const [name,url] of [['WHISPER_MODEL_LICENSE.txt',licenceURL],['WHISPER_MODEL_CARD.md',`https://huggingface.co/${config.model.repository}/raw/${config.model.revision}/README.md`]]){const response=await fetch(url);if(!response.ok)throw Error('Speech licence unavailable');await writeFile(path.join(output,name),Buffer.from(await response.arrayBuffer()));}
const model=path.join(output,config.model.filename);
if(await digest(model).catch(()=>null)!==config.model.sha256){
 const partial=model+'.part';try{const response=await fetch(`https://huggingface.co/${config.model.repository}/resolve/${config.model.revision}/${config.model.filename}`);if(!response.ok)throw Error('Pinned speech model unavailable');let received=0;const limit=new TransformStream({transform(chunk,controller){received+=chunk.length;if(received>config.model.bytes)throw Error('Speech model exceeded pinned size');controller.enqueue(chunk);}});await pipeline(Readable.fromWeb(response.body.pipeThrough(limit)),createWriteStream(partial));if(received!==config.model.bytes||await digest(partial)!==config.model.sha256)throw Error('Speech model checksum mismatch');await rename(partial,model);}catch(error){await rm(partial,{force:true});throw error;}
}
const files=[];for(const name of [path.basename(model),path.basename(process.platform==='win32'?'whisper-cli.exe':'whisper-cli'),'WHISPER_CPP_LICENSE.txt','WHISPER_MODEL_LICENSE.txt','WHISPER_MODEL_CARD.md']){const file=path.join(output,name);files.push({path:name,bytes:(await stat(file)).size,sha256:await digest(file)});}
await writeFile(path.join(output,'BUILD_MANIFEST.json'),JSON.stringify({...config,platform:process.platform,architecture:process.arch,files},null,2)+'\n');
console.log('Prepared offline English speech runtime. Microphone, transcription accuracy, latency and platform acceptance still require testing.');

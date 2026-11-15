import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile,cp,readdir,stat} from 'node:fs/promises';
import {createWriteStream,createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const commit='dde879bc4f954b809892fd0d660515f42536394a',tag='b12032',licenseHash='94f29bbed6a22c35b992c5c6ebf0e7c92f13b836b90f36f461c9cf2f0f1d010d';
const output=path.join(root,'runtime/staging/inference');await mkdir(output,{recursive:true});
function run(exe,args,options={}){const result=spawnSync(exe,args,{cwd:root,stdio:'inherit',...options});if(result.status!==0)throw Error(`Runtime build failed: ${exe} (exit ${result.status})`);return result;}
async function digest(file){const hash=createHash('sha256');for await(const part of createReadStream(file))hash.update(part);return hash.digest('hex');}
if(process.platform==='win32'&&process.arch==='x64'){
 const archive=path.join(root,'runtime/downloads/llama-b12032-bin-win-cpu-x64.zip');await mkdir(path.dirname(archive),{recursive:true});const expected='5296f5d18bb7d422c7c26f4bb9bc796d9d4f41e1312a8c296cff475bdc60d0d4';
 if(await digest(archive).catch(()=>null)!==expected){const response=await fetch(`https://github.com/ggml-org/llama.cpp/releases/download/${tag}/llama-${tag}-bin-win-cpu-x64.zip`);if(!response.ok)throw Error('Official runtime release unavailable');await pipeline(Readable.fromWeb(response.body),createWriteStream(archive));if(await digest(archive)!==expected)throw Error('Official runtime checksum mismatch');}
 const listed=run('tar',['-tf',archive],{encoding:'utf8',stdio:'pipe'}).stdout.split(/\r?\n/).filter(Boolean);if(listed.some(name=>path.isAbsolute(name)||name.includes('\\')||name.split('/').includes('..')))throw Error('Unsafe paths in official runtime archive');run('tar',['-xf',archive,'-C',output]);
 const response=await fetch(`https://raw.githubusercontent.com/ggml-org/llama.cpp/${commit}/LICENSE`);if(!response.ok)throw Error('Runtime licence unavailable');const license=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(license).digest('hex')!==licenseHash)throw Error('Runtime licence checksum mismatch');await writeFile(path.join(output,'LLAMA_LICENSE.txt'),license);
}else if(process.platform==='linux'&&process.arch==='arm64'){
 const source=path.join(root,'runtime/staging/llama-source'),build=path.join(root,'runtime/staging/llama-build');if(!await stat(path.join(source,'.git')).catch(()=>null))run('git',['clone','--depth','1','--branch',tag,'https://github.com/ggml-org/llama.cpp.git',source]);
 const head=run('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8',stdio:'pipe'}).stdout.trim();if(head!==commit)throw Error('Runtime source commit differs from the pinned revision');
 run('cmake',['-S',source,'-B',build,'-DCMAKE_BUILD_TYPE=Release','-DBUILD_SHARED_LIBS=OFF','-DGGML_NATIVE=OFF','-DGGML_BACKEND_DL=OFF','-DGGML_CPU_KLEIDIAI=OFF','-DGGML_CUDA=OFF','-DGGML_VULKAN=OFF','-DGGML_BLAS=OFF','-DLLAMA_BUILD_TESTS=OFF','-DLLAMA_BUILD_EXAMPLES=OFF','-DLLAMA_BUILD_APP=OFF','-DLLAMA_BUILD_UI=OFF','-DLLAMA_USE_PREBUILT_UI=OFF','-DLLAMA_OPENSSL=OFF','-DLLAMA_SUBPROCESS=OFF','-DLLAMA_BUILD_SERVER=ON']);run('cmake',['--build',build,'--config','Release','--target','llama-server','-j','2']);
 await cp(path.join(build,'bin'),output,{recursive:true});await cp(path.join(source,'LICENSE'),path.join(output,'LLAMA_LICENSE.txt'));
}else throw Error('This runtime recipe supports Windows x64 and native Linux ARM64 build hosts');
const executable=path.join(output,process.platform==='win32'?'llama-server.exe':'llama-server');const version=run(executable,['--version'],{encoding:'utf8',stdio:'pipe'});const identity=(version.stdout??'')+(version.stderr??'');const embeddedCommit=identity.match(/commit ([a-f0-9]{7,40})/i)?.[1]?.toLowerCase();if(!embeddedCommit||!commit.startsWith(embeddedCommit))throw Error('Inference executable identity differs from the pinned source: '+identity.slice(-500));
const files=[];for(const name of await readdir(output)){const file=path.join(output,name);if((await stat(file)).isFile()&&name!=='BUILD_MANIFEST.json')files.push({path:name,bytes:(await stat(file)).size,sha256:await digest(file)});}
await writeFile(path.join(output,'BUILD_MANIFEST.json'),JSON.stringify({schema:'ares-native-runtime/1',repository:'https://github.com/ggml-org/llama.cpp',commit,tag,platform:process.platform,architecture:process.arch,version:identity.trim(),files},null,2)+'\n');console.log('Verified app-managed runtime:',identity.trim());

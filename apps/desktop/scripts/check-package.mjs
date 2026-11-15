import {listPackage} from '@electron/asar';
import {stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
export default async function checkPackage(context){
 const resources=path.join(context.appOutDir,'resources'),names=new Set(listPackage(path.join(resources,'app.asar')).map(name=>name.replaceAll('\\','/').replace(/^\//,'')));
 for(const required of ['desktop/main.mjs','desktop/preload.cjs','services/server.mjs','services/field-input.mjs','services/point-inspector.mjs','web/src/point-inspector.js','web/src/crew-map.js','services/speech.mjs','services/voice-pack.mjs','services/dead-reckoning.mjs','web/src/dead-reckoning.js','runtime/voice-pack-catalog.json','runtime/voice-output-config.json','runtime/speech-config.json','web/dist/index.html','web/dist/desktop-speech-worklet.js','web/dist/vendor/cesium/Cesium.js','web/src/ortho-mask-provenance.json','maps/starter-manifest.json','runtime/model-catalog.json'])if(!names.has(required))throw Error('Required packaged asset missing: '+required);
 for(const name of names)if(name.endsWith('.gguf')||name.endsWith('en_US-ljspeech-medium.onnx')||name.includes('runtime/staging/voice-output')||name.startsWith('data/nasa_mars_authentic_'))throw Error('Weights or unrelated training data must not enter base installer: '+name);
 const windows=context.electronPlatformName==='win32',runtime=path.join(resources,'runtime');
 for(const required of ['mars-science/'+(windows?'mars-science.exe':'mars-science'),'inference/'+(windows?'llama-server.exe':'llama-server'),'inference/LLAMA_LICENSE.txt','chatml.jinja','speech/'+(windows?'whisper-cli.exe':'whisper-cli'),'speech/ggml-tiny.en.bin','speech/BUILD_MANIFEST.json','speech/WHISPER_CPP_LICENSE.txt','speech/WHISPER_MODEL_LICENSE.txt','speech/WHISPER_MODEL_CARD.md'])if(!(await stat(path.join(runtime,required))).isFile())throw Error('Private runtime missing: '+required);
 const science=spawnSync(path.join(runtime,'mars-science',windows?'mars-science.exe':'mars-science'),['celestial.moons'],{input:JSON.stringify({at:'2026-10-19T12:00:00Z'}),encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4*1024*1024});
 if(science.status!==0)throw Error('Packaged science check failed: '+science.stderr);const packet=JSON.parse(science.stdout);if(packet.schema!=='mars-moons/1')throw Error('Packaged scientific response has wrong schema');
 const inference=spawnSync(path.join(runtime,'inference',windows?'llama-server.exe':'llama-server'),['--version'],{encoding:'utf8',windowsHide:true,timeout:10000});if(inference.status!==0)throw Error('Packaged inference executable cannot run');
 console.log('Verified packaged viewer/provenance, private science output, native inference executable, and excluded weights/training data.');
}

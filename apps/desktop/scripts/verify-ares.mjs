import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ModelRegistry} from '../services/models.mjs';
import {InferenceService} from '../services/inference.mjs';
import {chatML} from '../services/ares-context.mjs';
import {NetworkPolicy} from '../services/network-policy.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=JSON.parse(await readFile(path.join(root,'runtime/model-catalog.json'),'utf8')).entries[0];
const directory=await mkdtemp(path.join(root,'artifacts/ares-integration-'));
const models=await new ModelRegistry(directory).load();
const policy=new NetworkPolicy('offline');const rawFetch=globalThis.fetch.bind(globalThis);let externalAttempts=0;
const inference=new InferenceService({executable:path.join(root,'runtime/staging/inference/llama-server.exe'),template:path.join(root,'runtime/chatml.jinja'),models,fetcher:(input,options)=>{const url=new URL(input);if(url.origin!==inference.origin){externalAttempts++;throw Error('Unauthorized non-loopback inference request');}return rawFetch(input,options);}});
const restore=policy.installNativeGuards();
const report={model:source.name,purpose:'Official unmodified base integration only; NOT Mars fine-tuned ARES',mode:'offline',sourceSha256:source.sha256};
try{
 await assert.rejects(inference.chat({model:'ares-mars',messages:[{role:'user',content:'Hello'}]}),/Import an authorized/);
 const imported=await models.import(path.join(root,'artifacts/models',source.filename),source);const selected=await models.selected();report.gguf={name:imported,architecture:selected.metadata['general.architecture'],storedTensorScalars:selected.storedTensorScalars,nominalFamily:'Qwen2.5-1.5B (publisher model family; stored GGUF tensors can duplicate tied weights)',quantization:selected.metadata['general.file_type'],tensors:selected.tensors};
 const started=performance.now();const result=await inference.chat({model:'ares-mars',messages:[{role:'system',content:'This is a runtime integration check. Reply with exactly READY and no other words.'},{role:'user',content:'Return the required test word.'}]});report.coldRequestMilliseconds=performance.now()-started;assert.match(result.message.content,/ready/i);report.response=result;report.runtime=await inference.status();
 const applied=await rawFetch(inference.origin+'/apply-template',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+inference.key},body:JSON.stringify({messages:[{role:'user',content:'hello'}],add_generation_prompt:true})});assert.equal(applied.status,200);const appliedBody=await applied.json();assert.equal(appliedBody.prompt,chatML([{role:'user',content:'hello'}]));report.exactChatMLTemplateVerified=true;
 const warm=await inference.chat({model:'ares-mars',messages:[{role:'system',content:'Use only these facts: a map can have missing coverage; a map view centre is not a person location; coarse terrain cannot resolve small obstacles. State uncertainty. Do not invent observations or operational clearance.'},{role:'user',content:'Explain these three limitations in a clear paragraph of about 120 words.'}]});report.warmRequest={usage:warm.usage,timings:warm.timings,text:warm.message.content};
 const response=await rawFetch(inference.origin+'/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Hello'}]})});report.unauthenticatedStatus=response.status;await response.body?.cancel();assert.equal(response.status,401);
 await assert.rejects(inference.chat({model:'ares-mars',messages:[{role:'system',content:'Use only the supplied evidence.'},{role:'user',content:'word '.repeat(3000)}]}),/context|input tokens/i);report.overlongContextRejected=true;
 if(process.platform==='win32'){const memory=spawnSync('powershell.exe',['-NoProfile','-Command',`$atlas=Get-Process -Id ${inference.child.pid}; @{workingSet=$atlas.WorkingSet64;peakWorkingSet=$atlas.PeakWorkingSet64;cpuSeconds=$atlas.TotalProcessorTime.TotalSeconds}|ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true});if(memory.status===0)try{report.processMemory=JSON.parse(memory.stdout);}catch{}}
 report.externalAttempts=externalAttempts;assert.equal(externalAttempts,0);const child=inference.child;const closed=new Promise(resolve=>child.once('close',resolve));inference.stop();await closed;await assert.rejects(rawFetch(inference.origin+'/health',{signal:AbortSignal.timeout(1000)}));report.ownedServerClosed=true;
 await writeFile(path.join(root,'artifacts/ares-integration-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(error){report.error=error.stack;await writeFile(path.join(root,'artifacts/ares-integration-report.json'),JSON.stringify(report,null,2)+'\n');throw error;}finally{inference.stop();restore();}

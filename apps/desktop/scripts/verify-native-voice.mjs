import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {Settings} from '../desktop/settings.mjs';
import {PythonService} from '../services/python.mjs';
import {VoicePackService} from '../services/voice-pack.mjs';
import {SpeechService} from '../services/speech.mjs';
const root=process.cwd(),platform=process.platform+'-'+process.arch;
await mkdir('artifacts',{recursive:true});const temporary=await mkdtemp(path.join(root,'artifacts/native-voice-'));
const entry=JSON.parse(await readFile(`release/optional-voice/voice-component-${platform}.json`,'utf8'));entry.approved=true;
const settings=new Settings(temporary);await settings.load();
const python=new PythonService({executable:path.join(root,'runtime/staging/mars-science',process.platform==='win32'?'mars-science.exe':'mars-science'),cwd:path.join(root,'web'),packaged:true});
const voice=new VoicePackService({directory:path.join(temporary,'packs'),temporaryDirectory:path.join(temporary,'output'),settings,catalog:{entries:[entry]},python,fetcher:()=>{throw Error('No voice download is permitted during offline verification');}});
const speech=new SpeechService({directory:path.join(root,'runtime/staging/speech'),temporaryDirectory:path.join(temporary,'input')});
const report={platform,archiveSha256:entry.sha256,archiveBytes:entry.bytes,installedBytes:entry.installedBytes,humanMicrophoneTested:false,speakerPlaybackTested:false};
try{
 await voice.cleanup();await speech.cleanup();const started=performance.now();await voice.importArchive(path.join(root,'release/optional-voice',entry.filename));report.verifiedExtractionMilliseconds=performance.now()-started;assert.equal((await voice.status()).installed,true);
 const text='Mars Field Atlas is ready for local navigation.';const before=performance.now();const audio=await voice.synthesize(randomUUID(),text);report.synthesisMilliseconds=performance.now()-before;const wav=Buffer.from(audio);assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(22),1);assert.equal(wav.readUInt16LE(34),16);report.wavBytes=wav.length;
 await writeFile(path.join(temporary,'generated.wav'),wav);
 const rate=wav.readUInt32LE(24),sourceSamples=(wav.length-44)/2,count=Math.floor(sourceSamples*16000/rate),pcm=Buffer.alloc(44+count*2);wav.copy(pcm,0,0,44);pcm.writeUInt32LE(pcm.length-8,4);pcm.writeUInt32LE(16000,24);pcm.writeUInt32LE(32000,28);pcm.writeUInt32LE(count*2,40);
 for(let i=0;i<count;i++)pcm.writeInt16LE(wav.readInt16LE(44+Math.min(sourceSamples-1,Math.floor(i*rate/16000))*2),44+i*2);
 const recognitionStart=performance.now();const transcript=await speech.transcribe(pcm);report.transcriptionMilliseconds=performance.now()-recognitionStart;report.syntheticTestText=text;report.syntheticTranscript=transcript.text;assert.match(transcript.text,/ready|local|navigation/i);assert.ok(transcript.text.length>10);
 assert.deepEqual(await readdir(path.join(temporary,'input')),[]);assert.deepEqual(await readdir(path.join(temporary,'output')),[]);report.temporaryAudioCleaned=true;
 const cancelId=randomUUID(),generation=voice.synthesize(cancelId,'A longer cancellation test. '.repeat(30));voice.cancelSpeech(cancelId);await assert.rejects(generation,/cancel/i);report.cancelBeforeGenerationPassed=true;
 report.passed=true;
}catch(error){report.error=error.stack;throw error;}finally{voice.stop();speech.stop();python.stop();await writeFile(`artifacts/native-voice-${platform}.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));

function pcmWav(chunks,length,sampleRate){
 const source=new Float32Array(length);let offset=0;for(const chunk of chunks){source.set(chunk,offset);offset+=chunk.length;}
 const count=Math.floor(length*16000/sampleRate),bytes=new Uint8Array(44+count*2),view=new DataView(bytes.buffer);
 const ascii=(at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
 ascii(0,'RIFF');view.setUint32(4,bytes.length-8,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,count*2,true);
 // Average each source interval when downsampling; avoid depending on a browser-specific WAV codec.
 for(let i=0;i<count;i++){const from=i*sampleRate/16000,to=(i+1)*sampleRate/16000;let sum=0,weight=0;for(let j=Math.floor(from);j<Math.ceil(to)&&j<length;j++){const w=Math.min(j+1,to)-Math.max(j,from);if(w>0){sum+=source[j]*w;weight+=w;}}const value=Math.max(-1,Math.min(1,sum/(weight||1)));view.setInt16(44+i*2,Math.round(value*(value<0?32768:32767)),true);}
 return bytes;
}
export class DesktopSpeechInput{
 constructor({onState,onTranscript,onError,onStart}){Object.assign(this,{onState,onTranscript,onError,onStart});this.state='idle';this.sequence=0;this.chunks=[];this.length=0;this.abortOnHide=()=>{if(document.hidden)this.cancel();};document.addEventListener('visibilitychange',this.abortOnHide);window.addEventListener('pagehide',()=>this.cancel());window.addEventListener('blur',()=>this.cancel());const panel=document.getElementById('assistant-panel');if(panel){this.panelObserver=new MutationObserver(()=>{if(panel.hidden)this.cancel();});this.panelObserver.observe(panel,{attributes:true,attributeFilter:['hidden']});}}
 setState(state,message){this.state=state;this.onState(state,message);}
 async toggle(){if(this.state==='recording')return this.finish();if(this.state==='idle')return this.start();this.cancel();}
 async start(){
  const sequence=++this.sequence;this.setState('starting','Opening microphone…');this.onStart?.();
  try{
   const status=await window.marsDesktop.beginVoice();if(sequence!==this.sequence){void window.marsDesktop.cancelVoice(status.id).catch(()=>{});return;}
   this.session=status.id;
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone capture is unavailable. Use text commands.');
   const stream=await navigator.mediaDevices.getUserMedia({video:false,audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   if(sequence!==this.sequence){stream.getTracks().forEach(track=>track.stop());return;}
   this.stream=stream;stream.getAudioTracks()[0]?.addEventListener('ended',()=>{if(this.state==='recording'){this.cancel();this.onError('Microphone disconnected. Try recording again.');}});
   this.context=new AudioContext({sampleRate:16000});const context=this.context;await context.resume();
   await context.audioWorklet.addModule('/desktop-speech-worklet.js');if(sequence!==this.sequence)return;
   this.chunks=[];this.length=0;this.sampleRate=context.sampleRate;this.source=context.createMediaStreamSource(stream);this.capture=new AudioWorkletNode(context,'atlas-speech-capture');
   this.capture.port.onmessage=event=>{if(this.state!=='recording')return;const maximum=this.sampleRate*status.maxSeconds;const room=maximum-this.length;const chunk=event.data.subarray(0,room);if(chunk.length){this.chunks.push(chunk);this.length+=chunk.length;}if(this.length>=maximum)void this.finish();};
   this.source.connect(this.capture);this.capture.connect(context.destination);this.setState('recording','Listening locally. Click Stop recording when finished (30 seconds maximum).');this.timer=setTimeout(()=>void this.finish(),status.maxSeconds*1000);
  }catch(error){if(sequence!==this.sequence)return;this.cancel();const message=error.name==='NotAllowedError'?'Microphone access was denied. Allow it in your system microphone settings, then try again.':error.name==='NotFoundError'?'No microphone was found. Connect one and try again.':error.message;this.onError(message);}
 }
 release(){clearTimeout(this.timer);this.capture?.port.close();this.source?.disconnect();this.capture?.disconnect();this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;const context=this.context;this.context=null;void context?.close().catch(()=>{});this.capture=null;this.source=null;}
 async finish(){
  if(this.state!=='recording')return;const sequence=this.sequence,id=this.session;this.setState('transcribing','Transcribing on this device… Click Cancel to discard.');this.release();
  try{const bytes=pcmWav(this.chunks,this.length,this.sampleRate);this.chunks=[];this.length=0;const result=await window.marsDesktop.transcribeVoice(id,bytes);if(sequence!==this.sequence)return;this.session=null;this.setState('idle',result.text?'Review the transcript, then press Send.':result.reason);if(result.text)this.onTranscript(result.text);}
  catch(error){void window.marsDesktop.cancelVoice(id).catch(()=>{});if(sequence===this.sequence){this.session=null;this.setState('idle');this.onError(error.message);}}finally{if(sequence===this.sequence){this.chunks=[];this.length=0;}}
 }
 cancel(){const active=this.state!=='idle';++this.sequence;this.setState('idle',active?'Voice input cancelled.':undefined);this.release();this.chunks=[];this.length=0;const id=this.session;this.session=null;if(id)void window.marsDesktop.cancelVoice(id).catch(()=>{});}
}

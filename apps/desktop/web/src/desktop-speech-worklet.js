// No playback: this worklet copies microphone PCM into the app's bounded recording buffer.
class AtlasSpeechCapture extends AudioWorkletProcessor{
 process(inputs){const channels=inputs[0];if(channels?.length){const mono=new Float32Array(channels[0].length);for(const channel of channels)for(let i=0;i<mono.length;i++)mono[i]+=channel[i]/channels.length;this.port.postMessage(mono,[mono.buffer]);}return true;}
}
registerProcessor('atlas-speech-capture',AtlasSpeechCapture);

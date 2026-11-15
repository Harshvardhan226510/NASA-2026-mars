"""Private Piper process: local English model only; no server, download or OS voices."""
import argparse
import json
from pathlib import Path
import sys
import wave

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--model',required=True)
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    raw=sys.stdin.read(32769)
    if len(raw)>32768: raise ValueError('Speech text is too long')
    text=json.loads(raw).get('text')
    if not isinstance(text,str) or not 1<=len(text)<=4000: raise ValueError('Speech text must contain 1–4000 characters')
    import onnxruntime as ort
    from piper import PiperVoice
    from piper.config import PiperConfig
    model=Path(args.model)
    config=json.loads(Path(str(model)+'.json').read_text(encoding='utf-8'))
    if config.get('espeak',{}).get('voice')!='en': raise ValueError('Expected the approved offline English voice')
    options=ort.SessionOptions()
    options.intra_op_num_threads=2
    options.inter_op_num_threads=1
    session=ort.InferenceSession(str(model),sess_options=options,providers=['CPUExecutionProvider'])
    voice=PiperVoice(session=session,config=PiperConfig.from_dict(config))
    total=0
    with wave.open(args.output,'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(voice.config.sample_rate)
        for chunk in voice.synthesize(text):
            pcm=chunk.audio_int16_bytes
            total+=len(pcm)
            if total>8*1024*1024-44: raise ValueError('Speech output exceeded audio limit')
            output.writeframes(pcm)
    print(json.dumps({'ok':True}))

if __name__=='__main__':
    try: main()
    except Exception:
        # Do not log the user's reply or internal library exception text.
        print(json.dumps({'ok':False,'error':'Offline voice generation failed'}))
        sys.exit(2)

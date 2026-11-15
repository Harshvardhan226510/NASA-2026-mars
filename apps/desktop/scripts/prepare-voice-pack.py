"""Assemble optional output engine, provenance, licences and English voice off-device."""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import zipfile

root=Path(sys.argv[1]).resolve()
platform,arch=sys.argv[2:4]
config=json.loads((root/'runtime/voice-output-config.json').read_text())
staging=root/'runtime/staging/voice-output'
downloads=root/'runtime/downloads/voice-output'
voice=staging/'voice'
voice.mkdir(exist_ok=True)
for item in config['voice']['files']: shutil.copy2(downloads/item['path'],voice/item['path'])
notices=staging/'NOTICES'
notices.mkdir(exist_ok=True)
for dist in importlib.metadata.distributions():
    for item in dist.files or []:
        if any('license' in part.lower() or 'copying' in part.lower() or part.lower()=='notice' for part in Path(str(item)).parts):
            source=Path(dist.locate_file(item))
            if source.is_file():
                safe=str(item).replace('..','_').replace('\\','/')
                destination=notices/dist.metadata['Name']/safe
                destination.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(source,destination)
for name in ('LICENSE','LICENSE.txt'):
    source=Path(sys.base_prefix)/name
    if source.is_file(): shutil.copy2(source,notices/('Python-'+name))
sources=staging/'SOURCE'
sources.mkdir(exist_ok=True)
shutil.copy2(downloads/'piper_tts-1.8.0.tar.gz',sources/'piper_tts-1.8.0.tar.gz')
shutil.copy2(downloads/'pyinstaller-6.17.0.tar.gz',sources/'pyinstaller-6.17.0.tar.gz')
shutil.copy2(root/'runtime/voice_entry.py',sources/'voice_entry.py')
(sources/'voice-output-config.json').write_text(json.dumps(config,indent=2)+'\n',encoding='utf-8')
(notices/'installed-requirements.txt').write_text(subprocess.check_output([sys.executable,'-m','pip','freeze'],text=True),encoding='utf-8')
(notices/'README.txt').write_text('Optional ARES offline spoken replies. Piper 1.8.0 is GPL-3.0; engine source and wrapper source are in SOURCE. Dependency licences are preserved under NOTICES. The English voice model card is in voice/MODEL_CARD; it identifies LJ Speech as public domain. No voice accuracy or hardware latency acceptance is implied by this archive.\n',encoding='utf-8')
files=[]
seen=set()
for file in sorted(staging.rglob('*')):
    if file.is_symlink() and (not file.is_file() or staging.resolve() not in file.resolve().parents): raise ValueError('Voice source link escapes the frozen runtime')
    # ZIP entries contain regular file bytes, never executable symlinks.
    if not file.is_file(): continue
    name=file.relative_to(staging).as_posix()
    if len(name)>240 or any(not re.fullmatch(r'[A-Za-z0-9_.+! -]+',part) or part in ('.','..') or part.endswith(('.',' ')) or re.fullmatch(r'(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?',part) for part in name.split('/')) or name.casefold() in seen: raise ValueError('Unsupported voice package path: '+name)
    seen.add(name.casefold())
    data=file.read_bytes()
    files.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'executable':bool(file.stat().st_mode&0o111)})
output=root/'release/optional-voice'
output.mkdir(parents=True,exist_ok=True)
archive=output/f'ares-voice-{platform}-{arch}.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=False) as bundle:
    for item in files: bundle.write(staging/item['path'],item['path'])
archive_hash=hashlib.sha256(archive.read_bytes()).hexdigest()
exe='mars-voice/mars-voice'+('.exe' if platform=='win32' else '')
for item in files:
    if item['path']==exe: item['executable']=True
entry={'id':f'ares-voice-piper-1-8-0-{platform}-{arch}-{archive_hash[:12]}','name':config['voice']['name'],'platform':platform,'architecture':arch,'filename':archive.name,'bytes':archive.stat().st_size,'sha256':archive_hash,'installedBytes':sum(item['bytes'] for item in files),'files':files,'executable':exe,'model':'voice/en_US-ljspeech-medium.onnx','licence':'Piper GPL-3.0; bundled dependency notices; voice publisher model card included','sourceURL':config['engine']['repository']+'/tree/'+config['engine']['commit'],'approved':False,'url':None,'acceptance':'Pending voice and clean-install tests; not yet an approved downloadable component'}
(output/f'voice-component-{platform}-{arch}.json').write_text(json.dumps(entry,indent=2)+'\n',encoding='utf-8')
print('Prepared separate optional voice archive:',archive)

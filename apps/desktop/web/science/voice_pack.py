"""Strict extraction of a checksum-pinned optional voice ZIP; called only by desktop IPC."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import zipfile

def extract_request(request):
    archive=Path(request['archive'])
    destination=Path(request['destination'])
    expected=request['files']
    if not archive.is_absolute() or not destination.is_absolute() or not isinstance(expected,list) or not 1<=len(expected)<=5000:
        raise ValueError('Invalid optional component installation request')
    if destination.is_symlink() or not destination.is_dir() or any(destination.iterdir()):
        raise ValueError('Voice staging directory must be empty')
    by_name={}
    collisions=set()
    for item in expected:
        name=item['path']
        parts=PurePosixPath(name).parts
        if not isinstance(name,str) or not parts or len(name)>240 or any(not re.fullmatch(r'[A-Za-z0-9_.+! -]+',part) or part in ('.','..') or part.endswith(('.',' ')) or re.fullmatch(r'(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?',part) for part in parts) or '\\' in name or PurePosixPath(name).is_absolute() or name!=str(PurePosixPath(name)):
            raise ValueError('Unsafe path in voice package')
        if name.casefold() in collisions or type(item['bytes']) is not int or not 0<=item['bytes']<=256*1024**2 or not re.fullmatch('[a-f0-9]{64}',item['sha256']):
            raise ValueError('Invalid voice file inventory')
        collisions.add(name.casefold())
        by_name[name]=item
    if sum(item['bytes'] for item in expected)>1024**3:
        raise ValueError('Voice package exceeds installed size limit')
    with zipfile.ZipFile(archive) as bundle:
        entries=bundle.infolist()
        if len(entries)!=len(expected) or len({item.filename for item in entries})!=len(entries):
            raise ValueError('Voice ZIP inventory differs from approved files')
        for item in entries:
            spec=by_name.get(item.filename)
            mode=item.external_attr>>16
            if not spec or item.is_dir() or (stat.S_IFMT(mode) not in (0,stat.S_IFREG)) or item.flag_bits&1 or item.file_size!=spec['bytes']:
                raise ValueError('Unexpected or unsafe voice ZIP entry')
        base=destination.resolve(strict=True)
        for item in entries:
            spec=by_name[item.filename]
            target=base.joinpath(*PurePosixPath(item.filename).parts)
            if base not in target.resolve().parents:
                raise ValueError('Voice file escapes staging directory')
            target.parent.mkdir(parents=True,exist_ok=True)
            digest=hashlib.sha256()
            received=0
            with bundle.open(item) as source, target.open('xb') as output:
                while True:
                    chunk=source.read(1024*1024)
                    if not chunk: break
                    received+=len(chunk)
                    if received>spec['bytes']: raise ValueError('Voice ZIP expands beyond declared size')
                    digest.update(chunk)
                    output.write(chunk)
            if received!=spec['bytes'] or digest.hexdigest()!=spec['sha256']:
                raise ValueError('Voice file checksum mismatch')
            os.chmod(target,0o755 if spec.get('executable') else 0o644)
    return {'schema':'ares-voice-install/1','files':len(expected),'bytes':sum(item['bytes'] for item in expected)}

if __name__=='__main__':
    try: print(json.dumps(extract_request(json.load(sys.stdin))))
    except (ValueError,TypeError,KeyError,OSError,zipfile.BadZipFile) as error:
        print(json.dumps({'status':'error','error':str(error)}))
        sys.exit(2)

import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync,mkdirSync} from 'node:fs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const windows=process.platform==='win32',python=process.env.MARS_BUILD_PYTHON??(windows?'python':'python3');
function run(exe,args){const result=spawnSync(exe,args,{cwd:root,stdio:'inherit'});if(result.status!==0)throw Error(`Scientific runtime build failed: ${exe} (exit ${result.status})`);}
run(python,['-m','venv',path.join(root,'.venv-build')]);
const buildPython=path.join(root,'.venv-build',windows?'Scripts/python.exe':'bin/python');
run(buildPython,['-m','pip','install','-r',path.join(root,'web/requirements.txt'),'pyinstaller==6.17.0']);
run(buildPython,['-m','PyInstaller','--noconfirm','--clean','--onedir','--name','mars-science','--paths',path.join(root,'web'),'--collect-all','spiceypy','--add-data',path.join(root,'web/data/moons')+(windows?';':':')+'data/moons','--distpath',path.join(root,'runtime/staging'),'--workpath',path.join(root,'artifacts/python-build'),'--specpath',path.join(root,'artifacts'),path.join(root,'runtime/science_entry.py')]);
mkdirSync(path.join(root,'runtime'),{recursive:true});const freeze=spawnSync(buildPython,['-m','pip','freeze'],{encoding:'utf8'});if(freeze.status!==0)throw Error('Scientific dependency inventory failed');writeFileSync(path.join(root,'runtime/science-build-requirements.txt'),freeze.stdout);

run(buildPython,['-c',`import sys, pathlib, importlib.metadata, shutil
out=pathlib.Path(r"${root.replaceAll('\\','/')}" )/'runtime/staging/mars-science/NOTICES'
out.mkdir(parents=True,exist_ok=True)
for name in ('numpy','spiceypy','pyinstaller'):
    dist=importlib.metadata.distribution(name)
    for item in dist.files or []:
        rel=pathlib.Path(str(item))
        if any('license' in part.lower() or 'copying' in part.lower() for part in rel.parts):
            src=pathlib.Path(dist.locate_file(item))
            if src.is_file():
                dest=out/name/rel.name
                dest.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(src,dest)
for name in ('LICENSE.txt','LICENSE'):
    src=pathlib.Path(sys.base_prefix)/name
    if src.is_file(): shutil.copy2(src,out/('Python-'+name))
`]);

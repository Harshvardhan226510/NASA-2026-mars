"""Promote exact successful CI artifacts; never rebuild or upload GGUF weights."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile

REPO = os.environ['GITHUB_REPOSITORY']
RUN = os.environ['BUILD_RUN']
SHA = os.environ['BUILD_SHA']
VERSION = os.environ['RELEASE_VERSION']
if not re.fullmatch(r'[1-9][0-9]{0,17}', RUN): raise ValueError('Invalid run ID')
if not re.fullmatch(r'[0-9a-f]{40}', SHA): raise ValueError('Invalid full source SHA')
if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', VERSION): raise ValueError('Invalid version')
TAG = 'v' + VERSION
OUT = Path('release-upload')

def gh(*args):
    return subprocess.check_output(['gh', *args], text=True)

def api(endpoint):
    return json.loads(gh('api', 'repos/' + REPO + '/' + endpoint))

def digest(file):
    with file.open('rb') as handle: return hashlib.file_digest(handle, 'sha256').hexdigest()

def unique(name):
    files = list(Path('downloaded').rglob(name))
    if len(files) != 1 or not files[0].is_file(): raise ValueError('Expected exactly one ' + name)
    return files[0]

def validate():
    run = api('actions/runs/' + RUN)
    if run['head_sha'] != SHA or run['status'] not in {'in_progress', 'completed'}:
        raise ValueError('Source workflow must match the exact requested SHA')
    if run['path'] != '.github/workflows/desktop-build.yml' or run['head_repository']['full_name'] != REPO or run['head_branch'] != 'main':
        raise ValueError('Expected the desktop workflow on this repository main')
    jobs = [job for job in api('actions/runs/' + RUN + '/jobs')['jobs'] if job['name'] in {'windows', 'linux-arm64'}]
    if {j['name'] for j in jobs} != {'windows', 'linux-arm64'} or any(j['conclusion'] != 'success' for j in jobs):
        raise ValueError('Both exact native jobs must pass')
    releases = api('releases?per_page=100')
    if any(release['tag_name'] == TAG for release in releases):
        raise ValueError('Version already exists; do not overwrite any existing release')
    if any(ref['ref'] == 'refs/tags/'+TAG for ref in api('git/matching-refs/tags/'+TAG)):
        raise ValueError('Tag already exists; refuse to move an existing tag')
    print('Validated successful desktop source', SHA, 'run', RUN)

def prepare():
    validate()
    OUT.mkdir(exist_ok=False)
    inventory = {'schema':'mars-desktop-release/1', 'version':VERSION, 'sourceSha':SHA, 'buildRun':int(RUN), 'assets':[], 'nativeVoice':{}}
    for name in [f'Mars-Field-Atlas-{VERSION}-x64-setup.exe', f'Mars-Field-Atlas-{VERSION}-arm64.deb']:
        source = unique(name)
        if source.stat().st_size < 100_000_000: raise ValueError('Incomplete app artifact ' + name)
        if name.endswith('.exe') and source.open('rb').read(2) != b'MZ': raise ValueError('Invalid Windows executable')
        shutil.copyfile(source, OUT/name)
    deb = OUT/f'Mars-Field-Atlas-{VERSION}-arm64.deb'
    for field, expected in [('Version', VERSION), ('Architecture','arm64')]:
        if subprocess.check_output(['dpkg-deb','-f',str(deb),field],text=True).strip() != expected:
            raise ValueError('Unexpected Debian ' + field)
    expected_elf = {'mars-field-atlas-desktop','mars-science','llama-server','whisper-cli'}
    found = set()
    process = subprocess.Popen(['dpkg-deb','--fsys-tarfile',str(deb)],stdout=subprocess.PIPE)
    with tarfile.open(fileobj=process.stdout,mode='r|') as archive:
        for member in archive:
            if member.name.endswith(('.gguf','.onnx')): raise ValueError('Optional weights leaked into app')
            name = Path(member.name).name
            if name in expected_elf and member.isfile():
                header = archive.extractfile(member).read(20)
                if header[:4] != b'\x7fELF' or int.from_bytes(header[18:20],'little') != 183:
                    raise ValueError('Expected native AArch64 executable ' + name)
                found.add(name)
    while process.stdout.read(1024*1024): pass
    if process.wait() or found != expected_elf: raise ValueError('Missing native Debian runtime: ' + str(expected_elf-found))
    inventory['debian'] = {'architecture':'arm64','version':VERSION,'nativeExecutables':sorted(found)}
    for platform in ['win32-x64','linux-arm64']:
        descriptor_file = unique('voice-component-' + platform + '.json')
        descriptor = json.loads(descriptor_file.read_text())
        name = 'ares-voice-' + platform + '.zip'
        if descriptor['filename'] != name: raise ValueError('Unexpected voice filename')
        source = unique(name)
        if source.stat().st_size != descriptor['bytes'] or digest(source) != descriptor['sha256']:
            raise ValueError('Voice ZIP differs from exact native descriptor')
        native_file = unique('native-voice-' + platform + '.json')
        native = json.loads(native_file.read_text())
        if native.get('platform') != platform or native.get('archiveSha256') != descriptor['sha256'] or native.get('passed') is not True or native.get('temporaryAudioCleaned') is not True or native.get('cancelBeforeGenerationPassed') is not True or not native.get('syntheticTranscript'):
            raise ValueError('Missing successful native speech evidence for exact ZIP')
        inventory['nativeVoice'][platform] = native
        for file in [source,descriptor_file,native_file]: shutil.copyfile(file,OUT/file.name)
    for name in ['TEST_REPORT.md','KNOWN_LIMITATIONS.md','THIRD_PARTY_NOTICES.md']:
        shutil.copyfile(name, OUT/name)
    shutil.copyfile('docs/ARES_OPTIONAL_VOICE.md',OUT/'ARES_OPTIONAL_VOICE.md')
    for file in sorted(OUT.iterdir()): inventory['assets'].append({'name':file.name,'bytes':file.stat().st_size,'sha256':digest(file)})
    (OUT/'BUILD_VERIFICATION.json').write_text(json.dumps(inventory,indent=2)+'\n')
    (OUT/'SHA256SUMS.txt').write_text(''.join(digest(file)+'  '+file.name+'\n' for file in sorted(OUT.iterdir())))
    print(json.dumps(inventory,indent=2))
    with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as summary:
        summary.write('Verified exact Windows x64 / Bookworm ARM64 app and optional voice assets.\n\nSource: '+SHA+'\n\n'+(OUT/'SHA256SUMS.txt').read_text())

def publish():
    validate()
    if not (OUT/'BUILD_VERIFICATION.json').is_file(): raise ValueError('Prepared inventory is missing')
    for line in (OUT/'SHA256SUMS.txt').read_text().splitlines():
        expected,name = line.split('  ',1)
        if Path(name).name != name or digest(OUT/name) != expected: raise ValueError('Prepared asset changed')
    notes = Path('docs/RELEASE_'+VERSION+'.md')
    if not notes.is_file(): raise ValueError('Write explicit release notes for this version')
    gh('release','create',TAG,'--repo',REPO,'--target',SHA,'--draft','--title','Pyxis Desktop '+VERSION,'--notes-file',str(notes))
    gh('release','upload',TAG,*[str(f) for f in sorted(OUT.iterdir())],'--repo',REPO)
    matches = [release for release in api('releases?per_page=100') if release['tag_name']==TAG]
    if len(matches) != 1: raise ValueError('Expected exactly one new release draft')
    release = matches[0]
    if not release['draft']: raise ValueError('Expected unpublished draft')
    actual = {asset['name']:asset for asset in release['assets']}
    if set(actual) != {f.name for f in OUT.iterdir()}: raise ValueError('Release asset inventory mismatch')
    for file in OUT.iterdir():
        if actual[file.name]['size'] != file.stat().st_size or actual[file.name].get('digest') != 'sha256:'+digest(file):
            raise ValueError('GitHub upload digest mismatch: '+file.name)
    gh('release','edit',TAG,'--repo',REPO,'--draft=false','--latest')
    print(gh('release','view',TAG,'--repo',REPO,'--json','url,isDraft,tagName'))

{'validate':validate,'prepare':prepare,'publish':publish}[sys.argv[1]]()

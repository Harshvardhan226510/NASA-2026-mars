"""Explicit, checksum-pinned official base download for integration testing only."""
import argparse,hashlib,json,pathlib,shutil,urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--download',action='store_true');args=parser.parse_args()
if not args.download:parser.error('Use --download to request the official unmodified Qwen base for integration testing; this is not Mars fine-tuned ARES.')
entry=json.loads((root/'runtime/model-catalog.json').read_text(encoding='utf-8'))['entries'][0]
directory=root/'artifacts/models';directory.mkdir(parents=True,exist_ok=True);target=directory/entry['filename'];partial=target.with_suffix('.gguf.part')
def digest(file):
 h=hashlib.sha256()
 with file.open('rb') as source:
  for chunk in iter(lambda:source.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
if target.exists() and target.stat().st_size==entry['bytes'] and digest(target)==entry['sha256']:
 print('Verified cached official base:',target);raise SystemExit(0)
if shutil.disk_usage(directory).free<entry['bytes']+512*1024*1024:raise RuntimeError('Insufficient free space for the explicit base-model test')
size=0;threshold=0
with urllib.request.urlopen(entry['url'],timeout=90) as response,partial.open('wb') as output:
 if 'text/html' in response.headers.get('Content-Type',''):raise RuntimeError('Model source returned HTML instead of authorized GGUF content')
 for chunk in iter(lambda:response.read(1024*1024),b''):
  size+=len(chunk)
  if size>entry['bytes']:raise RuntimeError('Model source exceeded its pinned size')
  output.write(chunk)
  if size-threshold>=100*1024*1024:print(f'Official base test download: {size}/{entry["bytes"]} bytes',flush=True);threshold=size
if size!=entry['bytes'] or digest(partial)!=entry['sha256']:raise RuntimeError('Official base-model size/checksum mismatch')
partial.replace(target);print('Official base verified; NOT Mars fine-tuned:',target)

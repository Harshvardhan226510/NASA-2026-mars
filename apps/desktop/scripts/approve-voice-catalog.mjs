// Run only after the final build/test gate and platform voice acceptance.
// Example: node scripts/approve-voice-catalog.mjs --tested https://approved-host/release/ descriptor.json ...
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateVoiceEntry} from '../services/voice-pack.mjs';
const [flag,address,...descriptors]=process.argv.slice(2);
if(flag!=='--tested'||!address||!descriptors.length||!/^https:\/\//.test(address))throw Error('Supply --tested, an approved HTTPS asset directory and tested platform descriptors');
const base=new URL(address);if(base.username||base.password||base.search||base.hash)throw Error('Use an HTTPS asset directory without credentials or query parameters');if(!base.pathname.endsWith('/'))base.pathname+='/';
const entries=[];
for(const descriptor of descriptors){const entry=validateVoiceEntry(JSON.parse(await readFile(descriptor,'utf8')));if(!/^ares-voice-[a-z0-9-]+\.zip$/.test(entry.filename))throw Error('Invalid voice archive filename');entry.url=new URL(entry.filename,base).href;entry.approved=true;entry.acceptance='Platform voice and clean-install tests approved by release preparer';entries.push(entry);}
if(new Set(entries.map(entry=>entry.platform+'-'+entry.architecture)).size!==entries.length)throw Error('Supply at most one pack per platform');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');await writeFile(path.join(root,'runtime/voice-pack-catalog.json'),JSON.stringify({schema:'ares-optional-voice-catalog/1',entries},null,2)+'\n');
console.log('Wrote pinned optional-voice catalogue. Publish the exact tested ZIP assets at the configured URLs before shipping this catalogue.');

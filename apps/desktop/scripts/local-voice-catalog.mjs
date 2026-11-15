// Called after the native voice self-check, before packaging that platform.
import {readFile,writeFile} from 'node:fs/promises';
import {validateVoiceEntry} from '../services/voice-pack.mjs';
const file=`release/optional-voice/voice-component-${process.platform}-${process.arch}.json`;
const entry=validateVoiceEntry(JSON.parse(await readFile(file,'utf8')));
entry.approved=true;entry.url=null;entry.acceptance='Exact archive passed the native local synthesis/extraction check; install from the matching private release ZIP.';
await writeFile('runtime/voice-pack-catalog.json',JSON.stringify({schema:'ares-optional-voice-catalog/1',entries:[entry]},null,2)+'\n');

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {EventEmitter} from 'node:events';
import os from 'node:os';
import path from 'node:path';
import {UIStateStore,validateUIState} from '../services/ui-state.mjs';
import {createPreferencePersistence,preferenceSnapshot} from '../web/src/desktop-persistence.js';
import {saveBeforeClose} from '../desktop/save-on-close.mjs';

class Storage{
 constructor(entries={}){this.values=new Map(Object.entries(entries));}
 get length(){return this.values.size;}key(index){return [...this.values.keys()][index];}
 getItem(key){return this.values.get(key)??null;}setItem(key,value){this.values.set(key,String(value));}removeItem(key){this.values.delete(key);}
}
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));
async function directory(t){const target=await mkdtemp(path.join(os.tmpdir(),'atlas-ui-state-'));t.after(()=>rm(target,{recursive:true,force:true}));return target;}

test('a new process and a fresh localhost origin restore mission, display and map draft state',async t=>{
 const target=await directory(t),store=await new UIStateStore(target).load();
 const firstOrigin=new Storage({'unrelated-secret':'excluded','mars-atlas-session-v1':JSON.stringify({camera:{lon:77.43,lat:18.44,height:5000},view:'split',route:{start:[77,18],goal:[78,19]}}),'mars-atlas-appearance':'color','mars-atlas-missions-v1':'[{"name":"Field plan"}]','mars-atlas-map-download-draft-v1':JSON.stringify({section:'custom',sourceSelection:{mode:'lasso',selection:{polygon:[[77,18],[78,18],[77,19]]}},locationSelections:{places:[{placeId:'hirise-jezero',id:'hirise-jezero:ctx:12'}]}})});
 const first=createPreferencePersistence({api:{readUIState:async()=>store.snapshot(),saveUIState:value=>store.save(value)},storage:firstOrigin});await first.ready;await first.flush();
 const moduleURL=new URL('../services/ui-state.mjs',import.meta.url).href;
 const code="const {UIStateStore}=await import(process.argv[1]);const store=await new UIStateStore(process.argv[2]).load();process.stdout.write(JSON.stringify(store.snapshot()));";
 const child=await promisify(execFile)(process.execPath,['--input-type=module','-e',code,moduleURL,target]);
 const saved=JSON.parse(child.stdout),secondOrigin=new Storage();
 const second=createPreferencePersistence({api:{readUIState:async()=>saved,saveUIState:value=>store.save(value)},storage:secondOrigin});await second.ready;
 assert.deepEqual(preferenceSnapshot(secondOrigin),preferenceSnapshot(firstOrigin));assert.equal(secondOrigin.getItem('unrelated-secret'),null);
 assert.equal(JSON.parse(secondOrigin.getItem('mars-atlas-map-download-draft-v1')).section,'custom');
 secondOrigin.removeItem('mars-atlas-missions-v1');await second.flush();
 assert.equal(Object.hasOwn((await new UIStateStore(target).load()).snapshot().preferences,'mars-atlas-missions-v1'),false);
});

test('corrupt saved UI is preserved separately and starts with recoverable empty state',async t=>{
 const target=await directory(t);await writeFile(path.join(target,'ui-state.json'),'{broken');
 const store=await new UIStateStore(target).load();assert.equal(store.snapshot(),null);assert.equal(store.recovered,true);
 assert.ok((await readdir(target)).some(name=>name.startsWith('ui-state.json.invalid-')));
 await store.save({schema:'mars-desktop-ui/1',preferences:{'mars-atlas-appearance':'grayscale'}});
 assert.equal(JSON.parse(await readFile(store.file,'utf8')).preferences['mars-atlas-appearance'],'grayscale');
});

test('preference validation bounds storage and excludes arbitrary keys and non-string values',()=>{
 for(const preferences of [{'outside-app':'x'},{'mars-atlas-invalid':{}},{'mars-atlas-large':'x'.repeat(12*1024*1024+1)}])assert.throws(()=>validateUIState({schema:'mars-desktop-ui/1',preferences}));
 assert.throws(()=>validateUIState({schema:'other',preferences:{}}));
});

class Window extends EventEmitter{
 constructor(){super();this.closed=0;this.webContents={isDestroyed:()=>false};}
 close(){let prevented=false;this.emit('close',{preventDefault:()=>{prevented=true;}});if(!prevented)this.closed++;}
}

test('normal close waits for the latest save and repeated close requests do not duplicate it',async()=>{
 const window=new Window();let complete,calls=0;
 saveBeforeClose(window,{save:()=>{calls++;return new Promise(resolve=>{complete=resolve;});},onFailure:()=>assert.fail('unexpected save failure')});
 window.close();window.close();await nextTurn();assert.equal(window.closed,0);assert.equal(calls,1);
 complete();await nextTurn();assert.equal(window.closed,1);
});

test('a failed close-time save keeps the window open so saving can be retried',async()=>{
 const window=new Window();let fail=true,reported=0;
 saveBeforeClose(window,{save:async()=>{if(fail)throw Error('Disk unavailable');},onFailure:async error=>{assert.match(error.message,/Disk/);reported++;return false;}});
 window.close();await nextTurn();assert.equal(window.closed,0);assert.equal(reported,1);
 fail=false;window.close();await nextTurn();assert.equal(window.closed,1);
});

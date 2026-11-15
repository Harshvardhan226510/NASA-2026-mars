import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainModelEligible,TerrainModelPool} from '../src/spacecraft-models.js';
const detail={located:true,hasModel:true,visible:true,inView:true,view:'3d',quality:{source:'CTX',metres:5.087},pixelMetres:4,distance:2500};
const spec=(id,signature=id)=>({id,signature});
const flush=()=>new Promise(r=>setImmediate(r));
const event=()=>{const listeners=new Set();return {addEventListener(fn){listeners.add(fn);return()=>listeners.delete(fn);},raise(){for(const fn of [...listeners])fn();}};};
test('automatic models require actual detailed CTX at the object, visible close terrain and a known location/model',()=>{
 assert.equal(terrainModelEligible(detail),true);assert.equal(terrainModelEligible({...detail,view:'split'}),true);
 for(const patch of [{located:false},{hasModel:false},{visible:false},{inView:false},{view:'2d'},{quality:null},{quality:{source:'Viking',metres:5.1}},{quality:{source:'CTX',metres:10.2}},{quality:{source:'CTX',metres:NaN}},{quality:{source:'CTX',metres:null}},{pixelMetres:30},{distance:25000}])assert.equal(terrainModelEligible({...detail,...patch}),false,JSON.stringify(patch));
 assert.equal(terrainModelEligible({...detail,quality:null,forced:true}),true);assert.equal(terrainModelEligible({...detail,quality:null,forced:true,visible:false}),false);assert.equal(terrainModelEligible({...detail,forced:true,view:'2d'}),false);
 // Local models that already passed the CTX gate survive imagery metadata
 // eviction, but admission never bypasses view, layer or local-range guards.
 assert.equal(terrainModelEligible({...detail,quality:null,admitted:true}),true);
 for(const patch of [{visible:false},{inView:false},{view:'2d'},{distance:25000},{pixelMetres:30}])assert.equal(terrainModelEligible({...detail,quality:null,admitted:true,...patch}),false);
});
test('multiple local models share a bounded download pool; an unchanged view never reloads or triggers an idle loop',async()=>{
 const pending=[],attached=[],disposed=[],callbacks=new Map();let changes=0;
 const pool=new TerrainModelPool({load:s=>new Promise(resolve=>pending.push({id:s.id,resolve})),dispose:m=>disposed.push(m.id),watch:(m,cb)=>{attached.push(m.id);callbacks.set(m.id,cb);return()=>{};},onChange:()=>changes++});
 pool.setDesired([spec('a'),spec('b'),spec('c')]);await flush();assert.deepEqual(pending.map(x=>x.id),['a','b']);
 pool.setDesired([spec('a'),spec('b'),spec('c')]);assert.equal(changes,1);
 pending[0].resolve({id:'a',errorEvent:event()});await flush();assert.deepEqual(pending.map(x=>x.id),['a','b','c']);assert.equal(pool.state('a'),'loading');callbacks.get('a').ready();assert.equal(pool.state('a'),'ready');assert.equal(pool.ready('a').id,'a');
 pending[1].resolve({id:'b',errorEvent:event()});pending[2].resolve({id:'c',errorEvent:event()});await flush();callbacks.get('b').ready();callbacks.get('c').ready();assert.equal(pool.entries.size,3);assert.deepEqual(attached,['a','b','c']);assert.deepEqual(disposed,[]);
 const lastChanges=changes;pool.setDesired([spec('a'),spec('b'),spec('c')]);assert.equal(changes,lastChanges);assert.equal(pending.length,3);
});
test('a model resolving after leaving the view is destroyed before attachment; active watches stop on hiding',async()=>{
 let finish,cancelled=0;const attached=[],disposed=[];
 const pool=new TerrainModelPool({load:s=>new Promise(resolve=>{finish=()=>resolve({id:s.id,errorEvent:event()});}),dispose:m=>disposed.push(m.id),watch:(m)=>{attached.push(m.id);return()=>cancelled++;}});
 pool.setDesired([spec('late')]);await flush();pool.setDesired([]);finish();await flush();assert.deepEqual(attached,[]);assert.deepEqual(disposed,['late']);
 pool.setDesired([spec('ready')]);await flush();finish();await flush();assert.deepEqual(attached,['ready']);pool.setDesired([]);assert.equal(cancelled,1);assert.deepEqual(disposed,['late','ready']);
});
test('position/source changes replace only that model and failure retries are bounded',async()=>{
 let time=0,loads=0,cancels=0,fail=false;const disposed=[],callbacks=[];
 const pool=new TerrainModelPool({clock:()=>time,load:async s=>{loads++;if(fail)throw Error('Unavailable');return {id:s.signature,errorEvent:event()};},dispose:m=>disposed.push(m.id),watch:(_m,cb)=>{callbacks.push(cb);return()=>cancels++;}});
 pool.setDesired([spec('rover','position-1')]);await flush();callbacks[0].ready();pool.setDesired([spec('rover','position-2')]);await flush();assert.deepEqual(disposed,['position-1']);assert.equal(cancels,1);assert.equal(loads,2);
 callbacks[1].failed();await flush();assert.equal(pool.state('rover'),'error');assert.deepEqual(disposed,['position-1','position-2']);fail=true;pool.setDesired([spec('rover','position-2')]);await flush();assert.equal(loads,2);
 time=60001;pool.setDesired([spec('rover','position-2')]);await flush();assert.equal(loads,3);assert.equal(pool.state('rover'),'error');assert.equal(pool.ready('rover'),null);
});
test('asynchronous model render errors retire the model without disturbing other spacecraft',async()=>{
 const models=new Map(),callbacks=new Map(),disposed=[];
 const pool=new TerrainModelPool({load:async s=>{const model={id:s.id,errorEvent:event()};models.set(s.id,model);return model;},dispose:m=>disposed.push(m.id),watch:(m,cb)=>{callbacks.set(m.id,cb);return()=>{};}});
 pool.setDesired([spec('a'),spec('b')]);await flush();callbacks.get('a').ready();callbacks.get('b').ready();models.get('a').errorEvent.raise();await flush();assert.equal(pool.state('a'),'error');assert.equal(pool.state('b'),'ready');assert.deepEqual(disposed,['a']);
});

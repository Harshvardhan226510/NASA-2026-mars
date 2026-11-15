import test from 'node:test';import assert from 'node:assert/strict';
import {HORIZON_WORKSPACES,workspaceForAction,useHorizonInterface} from '../src/interface-workspaces.js';
test('Horizon is opt-in; existing Orbit builds and unrelated query parameters keep their interface',()=>{
 assert.equal(useHorizonInterface(undefined,''),false);assert.equal(useHorizonInterface(undefined,'?region=JEZERO'),false);assert.equal(useHorizonInterface(undefined,'?ui=horizon'),true);assert.equal(useHorizonInterface('horizon',''),true);assert.equal(useHorizonInterface('horizon','?ui=orbit'),false);assert.equal(useHorizonInterface(undefined,'?ui=unknown'),false);
});
test('all existing primary scientific and planning actions remain reachable in the four workspaces',()=>{
 assert.deepEqual(HORIZON_WORKSPACES.map(g=>g.id),['explore','science','plan','system']);
 for(const action of ['explore','layers','measure','routes','solar','dust','seismic','missions','system','plan','saved'])assert.ok(workspaceForAction(action),action);
 assert.equal(workspaceForAction('assistant'),null);assert.equal(workspaceForAction('unknown'),null);
 assert.equal(new Set(HORIZON_WORKSPACES.flatMap(g=>g.tools.map(t=>g.id+':'+t.id))).size,19);
 assert.equal(workspaceForAction('sites'),'plan');
});
test('planning workspaces preserve field work and persistence rather than exposing only route generation',()=>{
 assert.equal(workspaceForAction('deploy'),'plan');assert.equal(workspaceForAction('routes'),'plan');assert.equal(workspaceForAction('measure'),'plan');assert.equal(workspaceForAction('plan'),'plan');assert.equal(workspaceForAction('saved'),'plan');
 assert.deepEqual(HORIZON_WORKSPACES[0].tools.map(t=>t.directory),['regions','values','user-sites','spacecraft','more']);assert.deepEqual(HORIZON_WORKSPACES[3].tools.filter(t=>t.moon).map(t=>t.moon),['phobos','deimos']);
});

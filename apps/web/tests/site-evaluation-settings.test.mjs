import test from 'node:test';
import assert from 'node:assert/strict';
import {SITE_EDITOR_FIELDS,siteEditorDefaults,evaluatedSiteDraft} from '../src/site-evaluation-settings.js';
import {validateSiteOptions} from '../src/site-evaluation.js';
import {upsertUserSite,validateUserSites} from '../src/user-sites.js';
import {MISSION_SCHEMA,validateMission} from '../src/mission-state.js';

test('landing and base scenarios expose different parameters and retain independent settings',()=>{
 const at='2026-11-08T00:00:00Z',landing=siteEditorDefaults('landing',at),base=siteEditorDefaults('base',at);
 validateSiteOptions(landing);validateSiteOptions(base);
 assert.ok(SITE_EDITOR_FIELDS.landing.includes('maxElevation'));assert.ok(SITE_EDITOR_FIELDS.landing.includes('surroundingBuffer'));
 assert.ok(!SITE_EDITOR_FIELDS.base.includes('maxElevation'));assert.ok(SITE_EDITOR_FIELDS.base.includes('sols'));assert.ok(SITE_EDITOR_FIELDS.base.includes('radius'));
 assert.ok(!SITE_EDITOR_FIELDS.landing.includes('sols'));assert.ok(!SITE_EDITOR_FIELDS.landing.includes('radius'));
 assert.ok(base.slope<landing.slope);assert.ok(base.roughness<landing.roughness);assert.equal(landing.weights.sun,0);assert.equal(base.weights.sun+base.weights.ice+base.weights.resources,65);
 base.slope=7;base.weights.sun=50;assert.equal(landing.slope,10);assert.equal(siteEditorDefaults('base',at).weights.sun,30);
 assert.throws(()=>siteEditorDefaults('unknown',at));
});
test('marking evaluated candidates stores their exact centre, type, settings and uncertainty without duplicate updates',()=>{
 const result={name:'South ridge',evaluated_at:'2026-11-08T12:00:00Z',options:siteEditorDefaults('base','2026-11-08T00:00:00Z'),lower:40,upper:75,coverage:.65,constraint_status:'unknown',source:{label:'HRSC/MOLA',sample_m:200,analysis_spacing_m:200}};
 const draft=evaluatedSiteDraft(result,'user-evaluated',{isValue:true,tags:['Review']});
 assert.deepEqual(draft.center,[77.43,18.44]);assert.equal(draft.evaluationKind,'base');assert.equal(draft.isValue,true);assert.match(draft.description,/40–75/);assert.match(draft.description,/coverage: 65%/);assert.match(draft.description,/200 m/);assert.match(draft.description,/not verified/);
 const landing=evaluatedSiteDraft({...result,options:siteEditorDefaults('landing',result.options.at)},'user-landing');assert.match(landing.description,/Vehicle elevation ceiling/);assert.equal(landing.evaluationKind,'landing');assert.ok(!landing.isValue);
 let records=upsertUserSite([],draft);records=upsertUserSite(records,{...draft,name:'Updated ridge'});assert.equal(records.length,1);
 const restored=validateUserSites(JSON.parse(JSON.stringify(records)));assert.equal(restored[0].evaluationKind,'base');assert.deepEqual(restored[0].tags,['Review']);
 const mission=validateMission({schema:MISSION_SCHEMA,userSites:restored,measurement:{points:[]},route:{targets:[]}});assert.equal(mission.userSites[0].evaluationKind,'base');
 assert.throws(()=>validateUserSites([{...draft,evaluationKind:'bogus'}]));
});

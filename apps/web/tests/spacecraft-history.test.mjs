import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SPACECRAFT_MISSIONS,SPACECRAFT_MISSION_IDS,SPACECRAFT_TRAVEL,MISSION_CRUISES} from '../src/spacecraft-history-data.js';
import {missionFor,launchDate,travelDistance,normalizeOdometer,mergeOdometers,travelFor,fetchOdometers,appendSpacecraftHistory} from '../src/spacecraft-history.js';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const catalog=json('../public/spacecraft/catalog.json');
const curiosity=json('../data/spacecraft/curiosity-current.geojson');
const perseverance=json('../data/spacecraft/perseverance-current.geojson');
const checked='2026-10-22T05:00:00Z';

test('all 41 spacecraft have a parent mission and a primary launch source',()=>{
 assert.equal(catalog.objects.length,41);
 for(const item of catalog.objects){
  const mission=missionFor(item.id);assert.ok(mission,item.id);
  assert.match(mission.launch,/^\d{4}-\d{2}-\d{2}$/);assert.ok(Number.isFinite(Date.parse(mission.launch)));
  assert.ok(mission.lead&&mission.summary);
 }
 const records=[...Object.values(SPACECRAFT_MISSIONS),...Object.values(SPACECRAFT_TRAVEL),...Object.values(MISSION_CRUISES)];
 for(const record of records){const url=new URL(record.source);assert.equal(url.protocol,'https:');assert.match(url.hostname,/(^|\.)(nasa\.gov|esa\.int|cnsa\.gov\.cn|isro\.gov\.in|mhi\.com)$/);}
 assert.deepEqual(Object.keys(SPACECRAFT_MISSION_IDS).sort(),catalog.objects.map(x=>x.id).sort());
});

test('carried hardware inherits its mission launch, with UTC date boundaries preserved',()=>{
 assert.equal(missionFor('ingenuity'),missionFor('perseverance'));
 assert.equal(missionFor('spirit_platform'),missionFor('spirit'));
 assert.equal(missionFor('opportunity_platform'),missionFor('opportunity'));
 assert.equal(missionFor('ds2_amundsen').launch,missionFor('mars_polar_lander').launch);
 assert.equal(launchDate(missionFor('opportunity').launch),'8 July 2003');
 assert.equal(launchDate(missionFor('hope').launch),'19 July 2020');
});

test('rover driving, helicopter flights, carrier cruises and missing totals stay distinct',()=>{
 assert.equal(travelFor({id:'curiosity',kind:'rover'}).kind,'surface');
 assert.equal(travelFor({id:'ingenuity',kind:'helicopter'}).kind,'flight');
 assert.equal(travelFor({id:'mro',kind:'orbiter'}).kind,'cruise');
 assert.equal(travelFor({id:'tianwen1_lander',kind:'lander'}).kind,'cruise');
 assert.equal(travelFor({id:'zhurong',kind:'rover'}).km,1.921);
 assert.equal(travelFor({id:'spirit_platform',kind:'landing_platform'}),null);
 assert.equal(travelFor({id:'hope',kind:'orbiter'}),null);
 assert.equal(travelDistance(.1),'100 m');assert.equal(travelDistance(500000000),'500 million km');
});

test('NASA odometers use cumulative metres and keep their published sol',()=>{
 const c=normalizeOdometer('curiosity',curiosity,checked),p=normalizeOdometer('perseverance',perseverance,checked);
 assert.ok(Math.abs(c.km-38.48016)<1e-9);assert.notEqual(c.km,curiosity.features[0].properties.dist_km);
 assert.equal(c.sol,5045);assert.equal(c.checked,'2026-10-22');assert.equal(p.sol,2009);assert.ok(Math.abs(p.km-45.223649)<1e-9);
 for(const metres of [-1,NaN,Infinity,10000001,'38480.16',null]){
  const bad=structuredClone(curiosity);bad.features[0].properties.dist_total_m=metres;
  assert.throws(()=>normalizeOdometer('curiosity',bad,checked));
 }
 assert.throws(()=>normalizeOdometer('curiosity',perseverance,checked));
 assert.throws(()=>normalizeOdometer('ingenuity',curiosity,checked));
});

test('stale feeds cannot roll odometers back, while newer published revisions can replace them',()=>{
 const original=mergeOdometers(undefined,[]),old=normalizeOdometer('curiosity',curiosity,checked);
 const stale={...old,sol:5044,km:1};
 const retained=mergeOdometers(original,[['curiosity',stale]]);assert.equal(retained.get('curiosity').km,38.48016);
 const revised={...old,sol:5046,km:38.4};
 assert.equal(mergeOdometers(retained,[['curiosity',revised]]).get('curiosity'),revised);
 assert.equal(original.get('curiosity').km,38.48016);
 assert.equal(mergeOdometers(original,[['curiosity',{...old,km:NaN}]]).get('curiosity').km,38.48016);
});

test('one unavailable NASA feed does not discard the other rover odometer',async()=>{
 const records=await fetchOdometers(async url=>url.includes('/MSL/')?new Response(JSON.stringify(curiosity)):new Response('Unavailable',{status:503}),checked);
 assert.equal(records.length,1);assert.equal(records[0][0],'curiosity');assert.equal(records[0][1].sol,5045);
 const allFailed=await fetchOdometers(async()=>{throw Error('Offline');},checked);assert.deepEqual(allFailed,[]);
 const oversized=await fetchOdometers(async()=>new Response('x'.repeat(65537)),checked);assert.deepEqual(oversized,[]);
});

test('selected descriptions explain missing travel and preserve source links',()=>{
 const previous=globalThis.document;
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.attributes={};}
  append(...children){this.children.push(...children);}
  setAttribute(key,value){this.attributes[key]=value;}
 }
 globalThis.document={createElement:tag=>new Element(tag)};
 const flatten=node=>[node,...node.children.flatMap(flatten)];
 const render=item=>{const root=new Element('div');appendSpacecraftHistory(root,item);return flatten(root);};
 try{
  const nodes=render({id:'spirit_platform',kind:'landing_platform'}),text=nodes.map(n=>n.textContent).join(' ');
  assert.match(text,/NASA · United States/);assert.match(text,/10 June 2003/);assert.match(text,/Fixed landing hardware/);assert.doesNotMatch(text,/7\.73/);
  assert.ok(nodes.find(n=>n.tagName==='a'&&n.href===missionFor('spirit').source));
  const mro=render({id:'mro',kind:'orbiter'}).map(n=>n.textContent).join(' ');assert.match(mro,/500 million km/);assert.match(mro,/Cumulative orbital distance is not included/);
  const hope=render({id:'hope',kind:'orbiter'}).map(n=>n.textContent).join(' ');assert.match(hope,/No verified cumulative travel total published/);assert.match(hope,/Mitsubishi Heavy Industries/);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

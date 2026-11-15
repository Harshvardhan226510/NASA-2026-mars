import test from 'node:test';
import assert from 'node:assert/strict';
import {FieldInput} from '../services/field-input.mjs';
import {createPointInspector} from '../services/point-inspector.mjs';

test('crew fixes are separated by member, with duplicate, stale, and provenance checks', () => {
  let now=Date.parse('2026-11-15T08:00:00Z');
  const input=new FieldInput(()=>now);
  const fix={crewId:'eva-1',name:'Field Lead',sourceId:'tx1',frame:'mars-east-planetocentric',
    point:[77.43,18.44],simulated:true,at:new Date(now).toISOString(),accuracyMeters:3};
  assert.equal(input.addCrewLocation(fix).accepted,true);
  assert.equal(input.addCrewLocation(fix).duplicate,true);
  input.addCrewLocation({...fix,crewId:'eva-2',name:'Scout'});
  assert.throws(()=>input.addCrewLocation({...fix,point:[77.5,18.44]}),{status:409});
  now+=10001;
  assert.deepEqual(input.crewLocations().crew.map(item=>[item.crewId,item.fresh]),[['eva-1',false],['eva-2',false]]);
  input.addCrewLocation({...fix,at:new Date(now).toISOString()});
  assert.equal(input.crewLocations().crew[0].fresh,true);
  assert.throws(()=>input.addCrewLocation({...fix,at:new Date(now).toISOString(),sourceId:'tx2'}),{status:409});
});

test('inspector withholds derived relief and shadow when terrain sources disagree', async () => {
  const source={id:'first',gridMeters:200};
  let count=0;
  const mission={queryTerrain:async points=>points.map(point=>({
    point,elevationMeters:100,slopeDegrees:1,source:count++===0?source:{...source,id:'other'},
  }))};
  const inspect=createPointInspector(mission,'unused');
  const packet=await inspect('terrain',[77.43,18.44],'2026-11-15T08:00:00Z');
  assert.equal(packet.terrain.source.id,'first');
  assert.equal(packet.neighborhood,null);
  assert.equal(packet.shadow,null);
});

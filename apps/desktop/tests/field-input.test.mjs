import test from 'node:test';
import assert from 'node:assert/strict';
import {FieldInput} from '../services/field-input.mjs';

const now = Date.parse('2026-11-15T08:00:00Z');
const at = new Date(now).toISOString();

test('suit input distinguishes omitted metrics, stale data, and out-of-order retries', () => {
  let clock = now;
  const input = new FieldInput(() => clock);
  const sample = {sourceId:'pack-1',suitId:'eva-1',simulated:true,at,metrics:{oxygenPercent:62,batteryPercent:88}};
  assert.equal(input.addTelemetry(sample).accepted,true);
  assert.equal(input.addTelemetry(sample).duplicate,true);
  assert.throws(() => input.addTelemetry({...sample,metrics:{oxygenPercent:101}}),{status:422});
  assert.throws(() => input.addTelemetry({...sample,metrics:{oxygenPercent:60}}),{status:409});
  assert.equal(input.telemetry().suits[0].fresh,true);
  clock += 10001;
  assert.equal(input.telemetry().suits[0].fresh,false);
  input.addTelemetry({...sample,at:new Date(clock).toISOString(),metrics:{oxygenPercent:54}});
  assert.deepEqual(input.telemetry().suits[0].metrics,{oxygenPercent:54});
});

test('seismic input retains an explicitly sourced waveform and rejects conflicting IDs', () => {
  const input = new FieldInput(() => now);
  const event = {id:'e-1',sourceId:'seis',frame:'mars-east-planetocentric',point:[77.43,18.44],kind:'impact',
    simulated:true,at,sampleRateHz:20,velocityMicrometersPerSecond:[0,-2,5,-3,0]};
  assert.throws(() => input.addEvent({...event,point:[280,0]}));
  assert.throws(() => input.addEvent({...event,velocityMicrometersPerSecond:[0,Infinity]}),{status:422});
  assert.equal(input.addEvent(event).accepted,true);
  assert.equal(input.addEvent(event).duplicate,true);
  assert.throws(() => input.addEvent({...event,kind:'other'}),{status:409});
  assert.deepEqual(input.seismic().events[0].velocityMicrometersPerSecond,event.velocityMicrometersPerSecond);
});

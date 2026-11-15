import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {DeadReckoningService} from '../services/dead-reckoning.mjs';
import {startDeadReckoningInput} from '../services/dead-reckoning-input.mjs';

test('a separate local client can submit readings and positions only for its engaged run', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'atlas-dr-api-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const service = await new DeadReckoningService(directory).load();
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const {port} = probe.address();
  await new Promise(resolve => probe.close(resolve));
  const token = 'a'.repeat(64);
  const listener = await startDeadReckoningInput(service, {port, token});
  t.after(() => listener.stop());
  const base = `http://127.0.0.1:${port}/v1/dead-reckoning`;
  const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
  const read = () => fetch(`${base}/status`, {headers}).then(response => response.json());
  const send = samples => fetch(`${base}/samples`, {method: 'POST', headers, body: JSON.stringify(samples)});
  const motion = {kind: 'motion', distanceMeters: 1, headingDegrees: 90, headingReference: 'map-north'};
  function packet(state, body = motion) {
    return {sessionId: state.sessionId, runId: state.runId, sourceId: state.sourceId,
      sequence: state.lastSequence + 1, timestampMs: Math.max(state.lastTimestamp, state.engagedAt) + 1000, ...body};
  }

  assert.equal((await fetch(`${base}/status`)).status, 403);
  assert.equal((await fetch(`${base}/status`, {headers: {...headers, Origin: 'https://example.com'}})).status, 403);
  assert.equal((await fetch(`${base}/samples`, {method: 'POST', headers, body: ' '.repeat(256 * 1024 + 1)})).status, 413);
  assert.equal((await read()).phase, 'idle');
  await service.setStart({point: [0, 0], options: {mode: 'manual'}});
  await service.engage();
  assert.equal((await send([packet(await read())])).status, 422);

  await service.pause();
  await service.setStart({point: [0, 0], options: {mode: 'readings', sourceId: 'pi-gear'}});
  await service.engage();
  const start = await read();
  const first = packet(start);
  const accepted = await send([first]);
  assert.equal(accepted.status, 200);
  const estimate = await accepted.json();
  assert.ok(estimate.point[0] > 0);
  assert.equal(estimate.lastSequence, 1);
  assert.equal((await send([first])).status, 422);
  await service.pause();
  assert.equal((await send([packet(estimate)])).status, 422);
  await service.engage();
  assert.notEqual((await read()).runId, start.runId);
  assert.equal((await send([packet(estimate)])).status, 422);

  await service.pause();
  await service.setStart({point: [10, 10], options: {mode: 'positions', sourceId: 'pi-gear'}});
  await service.engage();
  const position = await read();
  const ready = await send([packet(position, {kind: 'position', frame: position.frame, point: [10, 10], errorMeters: 4})]);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).errorMeters, 4);
  const restored = await new DeadReckoningService(directory).load();
  assert.equal(restored.state.phase, 'paused');
  assert.equal(restored.state.trail.at(-1).errorMeters, 4);
});

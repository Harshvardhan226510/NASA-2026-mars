import {isDeepStrictEqual} from 'node:util';
import {freshLocation,LOCATION_FRAME,LOCATION_MAX_AGE_MS,locationFix} from '../web/src/external-location.js';

export const SUIT_METRICS = Object.freeze({
  oxygenPercent: ['Oxygen reserve', '%', 0, 100],
  oxygenPartialPressureKPa: ['Oxygen partial pressure', 'kPa', 0, 200],
  suitPressureKPa: ['Suit pressure', 'kPa', 0, 200],
  carbonDioxidePartialPressureKPa: ['CO₂ partial pressure', 'kPa', 0, 200],
  batteryPercent: ['Battery', '%', 0, 100],
  coolantTempC: ['Coolant temperature', '°C', -100, 150],
  heartRateBpm: ['Heart rate', 'bpm', 0, 300],
  oxygenRemainingMinutes: ['Reported oxygen time remaining', 'min', 0, 1440],
});

function fail(message, status = 422) {
  throw Object.assign(Error(message), {status});
}

function number(value, min, max, field) {
  if (!Number.isFinite(value) || value < min || value > max) {
    fail(`${field} must be a number from ${min} to ${max}.`);
  }
  return value;
}

function id(value, field) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(value)) fail(`Invalid ${field}.`);
  return value;
}

function packet(input, point) {
  const {at, sourceId} = locationFix({
    at: input.at, sourceId: input.sourceId, frame: input.frame ?? 'mars-east-planetocentric', point,
  });
  if (typeof input.simulated !== 'boolean') fail('Set simulated to true or false.');
  return {at, sourceId, simulated: input.simulated};
}

export class FieldInput {
  constructor(clock = Date.now) {
    this.clock = clock;
    this.suits = new Map();
    this.crew = new Map();
    this.events = new Map();
    this.routes = new Map([
      ['GET /v1/crew/locations', () => this.crewLocations()],
      ['POST /v1/crew/locations', (_query, body) => this.addCrewLocation(body)],
      ['GET /v1/seismic/events', () => this.seismic()],
      ['POST /v1/seismic/events', (_query, body) => this.addEvent(body)],
      ['GET /v1/suit/telemetry', () => this.telemetry()],
      ['POST /v1/suit/telemetry', (_query, body) => this.addTelemetry(body)],
    ]);
  }

  addCrewLocation(input) {
    const fix = locationFix(input);
    const crewId = id(input.crewId, 'crew ID');
    if (typeof input.name !== 'string' || !input.name.trim() ||
        input.name.length > 80 || /[\x00-\x1F\x7F]/.test(input.name)) fail('Provide a crew name of up to 80 characters.');
    if (typeof input.simulated !== 'boolean') fail('Set simulated to true or false.');
    const age = this.clock() - Date.parse(fix.at);
    if (age < -5000 || age > 60000) fail('Send a fix from the last minute, with at most five seconds of clock lead.');
    const location = {...fix,crewId,name:input.name.trim(),simulated:input.simulated};
    const previous = this.crew.get(crewId);
    if (previous) {
      if (isDeepStrictEqual(previous,location)) return {accepted:true,duplicate:true,crewId};
      if (previous.sourceId!==location.sourceId || previous.simulated!==location.simulated || Date.parse(previous.at)>=Date.parse(location.at)) {
        fail('Crew source or simulation mode mismatch, or timestamp did not advance.',409);
      }
    } else if (this.crew.size>=32) fail('Up to 32 crew members are supported per session.',429);
    this.crew.set(crewId,location);
    return {accepted:true,crewId};
  }

  crewLocations() {
    const nowMs=this.clock();
    return {frame:LOCATION_FRAME,nowMs,maxAgeSeconds:LOCATION_MAX_AGE_MS/1000,
      crew:[...this.crew.values()].map(fix=>({...structuredClone(fix),fresh:freshLocation(fix,nowMs)}))};
  }

  addEvent(input) {
    if (!input || input.frame !== 'mars-east-planetocentric') fail('Provide an event in the Mars coordinate frame.');
    const common = packet(input, input.point);
    if (Date.parse(common.at) > this.clock() + 5000) fail('Event timestamp is in the future.');
    if (!['marsquake', 'impact', 'explosion', 'other'].includes(input.kind)) fail('Unknown seismic event kind.');
    const event = {
      ...common, id: id(input.id, 'event id'), kind: input.kind, frame: input.frame, point: [...input.point],
      magnitude: input.magnitude == null ? null : number(input.magnitude, -5, 12, 'magnitude'),
      sampleRateHz: number(input.sampleRateHz, 0.1, 1000, 'sampleRateHz'),
    };
    if (!Array.isArray(input.velocityMicrometersPerSecond) || input.velocityMicrometersPerSecond.length < 2 ||
        input.velocityMicrometersPerSecond.length > 4096) fail('Provide 2–4096 ground velocity samples.');
    event.velocityMicrometersPerSecond = input.velocityMicrometersPerSecond.map(value => number(value, -1e9, 1e9, 'sample'));
    const previous = this.events.get(event.id);
    if (previous && !isDeepStrictEqual(previous, event)) fail('Event ID already exists with different data.', 409);
    if (previous) return {accepted: true, duplicate: true, id: event.id};
    if (this.events.size >= 32) this.events.delete(this.events.keys().next().value);
    this.events.set(event.id, event);
    return {accepted: true, id: event.id};
  }

  addTelemetry(input) {
    if (!input || !input.metrics || typeof input.metrics !== 'object' || Array.isArray(input.metrics)) fail('Provide suit metrics.');
    const sample = {...packet(input, [0, 0]), suitId: id(input.suitId, 'suit ID'), metrics: {}};
    const age = this.clock() - Date.parse(sample.at);
    if (age < -5000 || age > 60000) fail('Send a timestamp from the last minute, with at most five seconds of clock lead.');
    const entries = Object.entries(input.metrics);
    if (!entries.length) fail('Provide one or more suit metrics.');
    for (const [key, value] of entries) {
      if (!Object.hasOwn(SUIT_METRICS, key)) fail(`Unsupported suit metric: ${key}.`);
      const [, , min, max] = SUIT_METRICS[key];
      sample.metrics[key] = number(value, min, max, key);
    }
    const previous = this.suits.get(sample.suitId);
    if (previous) {
      if (isDeepStrictEqual(previous, sample)) return {accepted: true, duplicate: true};
      if (previous.sourceId !== sample.sourceId || Date.parse(previous.at) >= Date.parse(sample.at)) {
        fail('Suit source mismatch or timestamp did not advance.', 409);
      }
    } else if (this.suits.size >= 32) fail('Up to 32 suits are supported per session.', 429);
    this.suits.set(sample.suitId, sample);
    return {accepted: true};
  }

  seismic() {
    return {events: [...this.events.values()].reverse()};
  }

  telemetry() {
    const nowMs = this.clock();
    return {nowMs, maxAgeSeconds: 10, suits: [...this.suits.values()].map(sample => ({
      ...sample, fresh: nowMs - Date.parse(sample.at) <= 10000,
    }))};
  }

  status() {
    return {...this.seismic(), ...this.telemetry(), metrics: SUIT_METRICS};
  }
}

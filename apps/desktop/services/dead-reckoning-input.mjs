import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {readBody} from './server.mjs';

const HOST = '127.0.0.1';
const MAX_BYTES = 256 * 1024;
const STATUS = '/v1/dead-reckoning/status';
const SAMPLES = '/v1/dead-reckoning/samples';

function status(state) {
  const last = state?.trail.at(-1);
  return {
    phase: state?.phase ?? 'idle',
    mode: state?.options.mode ?? null,
    sessionId: state?.id ?? null,
    runId: state?.runId ?? null,
    sourceId: state?.options.sourceId ?? null,
    frame: state?.frame ?? null,
    engagedAt: state?.engagedAt ?? null,
    lastSequence: state?.lastSequence ?? 0,
    lastTimestamp: last?.timestampMs ?? null,
    nowMs: Date.now(),
    point: last?.point ?? null,
    errorMeters: last?.errorMeters ?? null,
  };
}

export async function startDeadReckoningInput(service, {port, token, routes = new Map()}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw Error('Set MARS_ATLAS_DR_PORT to a free port from 1 to 65535.');
  }
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    throw Error('Set MARS_ATLAS_DR_TOKEN to a random 64-character hexadecimal token.');
  }
  const authorization = Buffer.from(`Bearer ${token}`);
  let submitting = false;
  let missionPost = false;
  let stopping = false;
  const server = http.createServer({
    requestTimeout: 10000,
    headersTimeout: 5000,
    connectionsCheckingInterval: 1000,
    keepAliveTimeout: 1000,
    maxHeaderSize: 8192,
  }, async (req, res) => {
    function reply(code, data) {
      if (res.destroyed) return;
      res.writeHead(code, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Connection': 'close'});
      res.end(JSON.stringify(data));
    }
    const supplied = Buffer.from(req.headers.authorization ?? '');
    if (req.headers.host !== `${HOST}:${port}` || req.headers.origin !== undefined ||
        req.headers['sec-fetch-site'] !== undefined || supplied.length !== authorization.length ||
        !timingSafeEqual(supplied, authorization)) {
      return reply(403, {error: 'Authorized local client required'});
    }
    if (!req.url?.startsWith('/')) return reply(400, {error: 'Invalid request path'});
    const url = new URL(`http://${HOST}:${port}${req.url}`);
    const action = routes.get(`${req.method} ${url.pathname}`);
    if (url.pathname === STATUS && req.method === 'GET') {
      return reply(200, status(service.state));
    }
    if (url.pathname !== SAMPLES && !action) return reply(url.pathname === STATUS ? 405 : 404, {error: 'Unsupported endpoint or method'});
    if (url.pathname === SAMPLES && req.method !== 'POST') return reply(405, {error: 'Use POST for sample batches'});
    if (action && req.method === 'GET') {
      try {return reply(200, await action(url.searchParams));}
      catch (error) {return reply(error.status ?? (error.code ? 503 : 422), {error: error.code ? 'Local data is unavailable' : error.message});}
    }
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return reply(415, {error: 'Use application/json'});
    }
    const length = req.headers['content-length'];
    if (!length) return reply(411, {error: 'Content-Length is required'});
    if (Number(length) > MAX_BYTES) return reply(413, {error: 'Request exceeds 256 KiB'});
    if ((action ? missionPost : submitting) || stopping) return reply(503, {error: 'Input is busy. Check status before retrying.'});

    if (action) missionPost = true;
    else submitting = true;
    try {
      const samples = await readBody(req, MAX_BYTES);
      if (stopping) return reply(503, {error: 'Input is shutting down'});
      if (action) return reply(200, await action(url.searchParams, samples));
      const {state} = await service.ingest(samples, {external: true});
      reply(200, status(state));
    } catch (error) {
      if (error.code) return reply(503, {error: 'Unable to save or receive samples. Check status before retrying.'});
      reply(error.status ?? 422, {error: error.message});
    } finally {
      if (action) missionPost = false;
      else submitting = false;
    }
  });
  server.maxConnections = 16;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, () => {
      server.off('error', reject);
      resolve();
    });
  });
  return {
    stop() {
      stopping = true;
      return new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections();
      });
    },
  };
}

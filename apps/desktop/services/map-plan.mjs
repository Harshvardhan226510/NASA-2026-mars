import {stat, statfs} from 'node:fs/promises';
import path from 'node:path';
import {pointInSelection} from '../web/src/map-area.js';
import {validateDownload, downloadFingerprint} from './downloads.mjs';
import {defaultMapChoices, mapOption, starterOption, normalizeChoices, containsPoint} from '../web/src/map-selection.js';

const GiB = 1024 ** 3;
const headroom = bytes => bytes ? Math.ceil(bytes * .1) + 64 * 1024 ** 2 : 0;
async function freeSpace(directory) {
  let candidate = path.resolve(directory);
  for (;;) {
    try {
      const disk = await statfs(candidate, {bigint: true});
      const bytes = disk.bavail * disk.bsize;
      return bytes <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(bytes) : Number.MAX_SAFE_INTEGER;
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code) || path.dirname(candidate) === candidate) return null;
      candidate = path.dirname(candidate);
    }
  }
}
export class MapPlan {
  constructor({settings, registry, downloads, policy, catalog, starter, directory, notify = () => {}}) {
    Object.assign(this, {settings, registry, downloads, policy, directory, notify});
    this.entries = catalog.entries.filter(entry => entry.approved).map(validateDownload);
    if (new Set(this.entries.map(entry => entry.manifest.id)).size !== this.entries.length) throw Error('Duplicate approved map ID');
    this.catalogOptions = [starterOption(starter), ...this.entries.map(entry => mapOption(entry.manifest)).filter(Boolean)];
    this.reservations = new Map();
    for (const item of settings.value.mapProgressiveReservations ?? []) {
      if (typeof item?.id === 'string' && /^[a-z0-9][a-z0-9._-]{1,79}$/.test(item.id)
        && /^[a-f0-9]{20}$/.test(item.fingerprint) && Number.isSafeInteger(item.bytes) && item.bytes >= 0)
        this.reservations.set(item.id + ':' + item.fingerprint, item);
    }
    for (const entry of registry.entries.filter(entry => entry.downloadReason === 'progressive')) {
      const item = {id: entry.manifest.id, fingerprint: downloadFingerprint(entry.manifest),
        bytes: entry.manifest.files.reduce((sum, file) => sum + file.bytes, 0)};
      this.reservations.set(item.id + ':' + item.fingerprint, item);
    }
    this.queue = [];
    this.blocked = new Map();
    this.visiting = false;
    this.scheduling = false;
    this.downloads.on('progress', job => {
      if (job.state === 'installed') this.notify({id: job.id, state: job.state});
      if (['installed', 'failed', 'paused'].includes(job.state)) {
        void this.pump().catch(error => this.notify({error: error.message}));
      }
    });
  }
  get options() {
    const options = [...this.catalogOptions], ids = new Set(options.map(option => option.id));
    for (const entry of this.registry.entries) {
      const option = mapOption(entry.manifest);
      if (option && !ids.has(option.id)) {options.push(option); ids.add(option.id);}
    }
    return options;
  }
  get choices() {
    return normalizeChoices(this.settings.value.mapChoices ?? defaultMapChoices(), this.options);
  }
  validateInput(value) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.regionalIds) || value.regionalIds.length > 1000
      || value.regionalIds.some(id => typeof id !== 'string' || id.length > 80)
      || typeof value.globalId !== 'string' || value.globalId.length > 80
      || typeof value.progressive !== 'boolean' || !Number.isFinite(value.cacheGiB)) throw Error('Invalid map choices');
    if(value.imageryAppearance!=null&&!["color","grayscale"].includes(value.imageryAppearance))throw Error("Invalid download appearance");
    const normalized=normalizeChoices(value,this.options);
    if(value.areaSelection!=null&&!normalized.areaSelection)throw Error('This area and quality do not have complete catalogue footprint coverage. Choose another quality or smaller bounds.');
    return normalized;
  }
  selected(choices) {
    const ids = [choices.globalId, ...choices.regionalIds, ...choices.areaPackageIds];
    return this.entries.filter(entry => ids.includes(entry.manifest.id));
  }
  async snapshot(input) {
    const choices = input ? this.validateInput(input) : this.choices;
    const installed = await this.registry.list();
    const selected = this.selected(choices);
    const selectedOptions = this.options.filter(o => [choices.globalId, ...choices.regionalIds, ...choices.areaPackageIds].includes(o.id));
    let installedBytes = choices.globalId === this.options[0].id ? this.options[0].bytes : 0;
    let retainedDownloadBytes = 0, remainingDownloadBytes = 0, additionalDiskBytes = 0;
    const blockers = [];
    for (const option of selectedOptions.filter(option => !option.included)) {
      const entry = selected.find(entry => entry.manifest.id === option.id);
      const registered = this.registry.entries.find(item => item.manifest.id === option.id);
      const existing = installed.find(item => item.id === option.id);
      if (registered) {
        if (existing.available && (!entry || downloadFingerprint(registered.manifest) === downloadFingerprint(entry.manifest))) {
          installedBytes += existing.bytes;
          continue;
        }
        blockers.push(option.name + ': reconnect its storage or unregister the existing version before downloading it again.');
        continue;
      }
      if (!entry) {blockers.push(option.name + ': no approved download is available. Reconnect its storage or import the package folder.'); continue;}
      const estimate = await this.downloads.estimate(entry);
      retainedDownloadBytes += estimate.retainedBytes;
      remainingDownloadBytes += estimate.remainingBytes;
      additionalDiskBytes += estimate.remainingBytes;
    }
    const progressiveReservedBytes = this.progressiveReservedBytes();
    const freeBytes = await freeSpace(await this.directory());
    const installationHeadroomBytes = headroom(additionalDiskBytes);
    return {
      options: this.options, choices, installed, jobs: this.downloads.snapshot(),
      otherEntries: this.entries.filter(entry => !entry.manifest.presentation?.imageryAppearance),
      directory: await this.directory(), mode: this.policy.mode,
      savedChoices: this.choices, queue: [...this.queue],
      plan: {
        selectedBytes: selectedOptions.reduce((sum, o) => sum + o.bytes, 0),
        includedStarterBytes: this.options[0].bytes,
        installedBytes, retainedDownloadBytes, remainingDownloadBytes, additionalDiskBytes,
        installationHeadroomBytes, requiredFreeBytes: additionalDiskBytes + installationHeadroomBytes,
        freeBytes, blockers,
        progressiveLimitBytes: choices.cacheGiB * GiB, progressiveReservedBytes,
        progressiveRemainingBytes: Math.max(0, choices.cacheGiB * GiB - progressiveReservedBytes),
        enoughSpace: freeBytes == null ? null : freeBytes >= additionalDiskBytes + installationHeadroomBytes,
        notices: [...this.blocked.values()],
      },
    };
  }
  progressiveReservedBytes() {
    return [...this.reservations.values()].reduce((sum, item) => sum + item.bytes, 0);
  }
  async saveReservations() {
    this.settings.value.mapProgressiveReservations = [...this.reservations.values()];
    await this.settings.save();
  }
  async apply(input, download = false) {
    const choices = this.validateInput(input);
    this.settings.value.mapChoices = choices;
    await this.settings.save();
    this.blocked.clear();
    const permitted = new Set([choices.globalId, ...choices.regionalIds, ...choices.areaPackageIds]);
    this.queue = this.queue.filter(job => permitted.has(job.id));
    for (const job of this.downloads.snapshot()) {
      if (job.reason === 'progressive' && ['downloading', 'verifying'].includes(job.state)
        && (!choices.progressive || !permitted.has(job.id) || this.progressiveReservedBytes() > choices.cacheGiB * GiB)) this.downloads.cancel(job.id);
    }
    // Global packages are exclusive; regional imported packages keep their independent activation.
    let changed = false;
    for (const entry of this.registry.entries) if (entry.manifest.presentation?.scope === 'global') {
      const active = entry.manifest.id === choices.globalId;
      if (entry.active !== active) {entry.active = active; changed = true;}
    }
    if (changed) await this.registry.save();
    if (download && this.policy.mode === 'online') {
      const plan = await this.snapshot(choices);
      if (plan.plan.blockers.length) throw Error(plan.plan.blockers[0]);
      if (plan.plan.enoughSpace === false && !choices.progressive) throw Error('Not enough free space for the selected maps.');
      for (const entry of this.selected(choices)) {
        if (entry.manifest.presentation?.scope === 'regional' && choices.progressive) continue;
        this.enqueue(entry.manifest.id, 'selected');
      }
      await this.pump();
    }
    return this.snapshot();
  }
  enqueue(id, reason) {
    if (this.registry.entries.some(entry => entry.manifest.id === id) || this.queue.some(job => job.id === id)) return;
    const existing = this.downloads.snapshot().find(job => job.id === id);
    if (['downloading', 'verifying'].includes(existing?.state)) return;
    this.queue.push({id, reason});
  }
  async pump() {
    if (this.scheduling || this.policy.mode !== 'online') return;
    this.scheduling = true;
    try {
      if (this.downloads.snapshot().some(job => ['downloading', 'verifying'].includes(job.state))) return;
      while (this.queue.length) {
        const next = this.queue.shift();
        if (this.registry.entries.some(entry => entry.manifest.id === next.id)) continue;
        const entry = this.entries.find(entry => entry.manifest.id === next.id);
        if (!entry) continue;
        let newReservation;
        if (next.reason === 'progressive') {
          if (!this.choices.progressive || ![...this.choices.regionalIds,...this.choices.areaPackageIds].includes(next.id)) continue;
          const bytes = entry.manifest.files.reduce((sum, file) => sum + file.bytes, 0);
          const key = entry.manifest.id + ':' + downloadFingerprint(entry.manifest);
          if (this.progressiveReservedBytes() + (this.reservations.has(key) ? 0 : bytes) > this.choices.cacheGiB * GiB) {
            this.blocked.set(next.id, entry.manifest.name + ': progressive storage limit reached. Increase the limit or download this map explicitly.');
            continue;
          }
          if (!this.reservations.has(key)) {
            if (this.reservations.size >= 2000) {this.blocked.set(next.id, 'Progressive reservation limit reached. Use an explicit download.'); continue;}
            this.reservations.set(key, {id: entry.manifest.id, fingerprint: downloadFingerprint(entry.manifest), bytes});
            newReservation = key;
            await this.saveReservations();
          }
        }
        this.blocked.delete(next.id);
        try {this.downloads.start(entry, {reason: next.reason});}
        catch (error) {if (newReservation) {this.reservations.delete(newReservation); await this.saveReservations();} throw error;}
        break;
      }
    } finally {this.scheduling = false;}
  }
  async pause(id) {
    if (id === '*') {
      this.settings.value.mapChoices = {...this.choices, progressive: false};
      await this.settings.save();
      this.queue = [];
      for (const job of this.downloads.snapshot()) if (['downloading', 'verifying'].includes(job.state)) this.downloads.cancel(job.id);
      return;
    }
    this.queue = this.queue.filter(job => job.id !== id);
    this.downloads.cancel(id);
  }
  async retry(id) {
    const entry = this.entries.find(entry => entry.manifest.id === id);
    if (!entry) throw Error('Map is not in the approved catalogue');
    if (this.policy.mode !== 'online') throw Error('Select Online Mode before downloading');
    if (this.registry.entries.some(item => item.manifest.id === id)) throw Error('Map is already registered. Reconnect its storage or unregister it before reinstalling.');
    this.blocked.delete(id);
    this.enqueue(id, 'selected');
    await this.pump();
  }
  async visit(value) {
    if (this.visiting || this.policy.mode !== 'online') return;
    const choices=this.choices;
    if(!choices.progressive)return;
    if (!Array.isArray(value?.point) || value.point.length !== 2 || !value.point.every(Number.isFinite)
      || Math.abs(value.point[0]) > 180 || Math.abs(value.point[1]) > 90
      || !Number.isFinite(value.metresPerPixel) || value.metresPerPixel <= 0 || value.metresPerPixel > 1e6) return;
    this.visiting = true;
    try {
      for (const option of this.options) {
        if (![...choices.regionalIds,...choices.areaPackageIds].includes(option.id) || !containsPoint(option.bounds, value.point)
          || value.metresPerPixel > Math.max(500, option.imageryMetersPerPixel * 8)) continue;
        if(!choices.regionalIds.includes(option.id)&&choices.areaSelection&&!pointInSelection(value.point,choices.areaSelection))continue;
        // A manual pause/failure remains paused until an explicit retry.
        if (this.downloads.snapshot().some(job => job.id === option.id)) continue;
        this.enqueue(option.id, 'progressive');
      }
      await this.pump();
    } finally {this.visiting = false;}
  }
  globalEntry() {
    return this.registry.entries.find(entry => entry.active && entry.manifest.id === (this.settings.value.mapChoices?.globalId??defaultMapChoices().globalId)
      && entry.manifest.presentation?.scope === 'global'&&entry.manifest.presentation.imageryAppearance===(this.settings.value.mapChoices?.imageryAppearance??'grayscale'));
  }
  async globalMap() {
    const entry = this.globalEntry();
    if (!entry) return null;
    const available = await stat(entry.root).then(s => s.isDirectory()).catch(() => false);
    return {
      id: entry.manifest.id, name: entry.manifest.name, available, credit: entry.manifest.provenance.credit,
      imageryMetersPerPixel: entry.manifest.presentation.imageryMetersPerPixel,
      terrainMetersPerPixel: entry.manifest.presentation.terrainMetersPerPixel ?? null,
      ...entry.manifest.planetTiles,
    };
  }
  async tile(query) {
    if (!['imagery', 'terrain'].includes(query.kind)) return null;
    const entry = this.globalEntry(), tile = entry?.manifest.planetTiles?.[query.kind];
    if (!entry || !tile) return null;
    const values = ['z', 'y', 'x'].map(key => /^\d{1,6}$/.test(String(query[key])) ? Number(query[key]) : NaN);
    const [z, y, x] = values;
    if (!values.every(Number.isInteger) || z > tile.maximumLevel || y >= 2 ** z || x >= 2 ** (z + 1))
      throw Object.assign(Error('Selected global map has no tile at this detail level.'), {status: 404});
    const relative = tile.template.replace('{z}', z).replace('{y}', y).replace('{x}', x);
    return this.registry.asset(entry.manifest.id, relative);
  }
}

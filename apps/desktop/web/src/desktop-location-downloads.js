import {MAP_SOURCES, sourceMapEstimate, sourceMeters} from './source-map-plan.js';
import {formatBytes, formatResolution} from './map-selection.js';

const world = {bounds: [-180, -90, 180, 90]};
const places = Object.entries(MAP_SOURCES).filter(([, product]) => product.group === 'HiRISE');

function summary(selection, sourceId, level, appearance) {
  const plan = sourceMapEstimate(selection, level, appearance, sourceId);
  return {
    sourceId, level, selection: plan.selection, appearance: plan.appearance,
    resolution: plan.metresPerPixel, maximumBytes: plan.maximumBytes, tileCount: plan.tileCount, partial:plan.partial,
  };
}

export function worldDownloadOptions(appearance) {
  const options = [];
  for (const [sourceId, product] of Object.entries(MAP_SOURCES)) {
    if (product.group === 'HiRISE') continue;
    for (let level = product.min; level <= product.max; level++) {
      try {options.push({...summary(world, sourceId, level, appearance), id: sourceId + ':' + level});}
      catch {break;}
    }
  }
  return options;
}

export function locationDownloadOptions(baseResolution, appearance) {
  const groups = new Map();
  for (const [placeId, place] of places) {
    const selection = {bounds: place.coverage};
    for (const [sourceId, product] of Object.entries(MAP_SOURCES)) {
      if (product.group === 'HiRISE' && sourceId !== placeId) continue;
      for (let level = product.min; level <= product.max; level++) {
        if (sourceMeters(level, sourceId) >= baseResolution * .999) continue;
        let plan;
        try {plan = summary(selection, sourceId, level, appearance);}
        catch {break;}
        const family = product.group === 'HiRISE' ? 'HiRISE' : product.name;
        const key = family + ':' + plan.resolution;
        if (!groups.has(key)) groups.set(key, {key, family, resolution: plan.resolution, terrain: product.role === 'terrain', places: []});
        groups.get(key).places.push({
          ...plan, id: placeId + ':' + sourceId + ':' + level,
          placeId, name: place.name.replace('HiRISE · ', ''),
        });
      }
    }
  }
  return [...groups.values()].sort((a, b) => b.resolution - a.resolution || a.family.localeCompare(b.family));
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function createLocationDownloads({getState, onAppearanceChange, onChange, onPreview, download, enableDownloads, cancel, sourceStatus, initial}) {
  const whole = element('details', null, 'map-section map-download-section');
  whole.name = 'map-download-section';whole.open = true;
  whole.append(element('summary', '1. Whole Mars'));
  whole.addEventListener('toggle',()=>{if(whole.open)onPreview(world);});
  const appearanceLabel = element('label', 'Download appearance');
  const appearance = element('select');
  appearance.id = 'map-download-appearance';appearanceLabel.htmlFor = appearance.id;
  for (const [value, label] of [['grayscale', 'Grayscale'], ['color', 'Color']]) {
    const option = element('option', label);option.value = value;appearance.append(option);
  }
  const qualityLabel = element('label', 'Whole Mars quality');
  const quality = element('select');quality.id = 'map-world-quality';qualityLabel.htmlFor = quality.id;
  const wholeDownload = element('button', 'Download whole Mars', 'map-primary');
  wholeDownload.type = 'button';
  const wholeStatus = element('p', null, 'map-muted');wholeStatus.setAttribute('role', 'status');
  const wholeCancel=element('button','Cancel download');wholeCancel.type='button';wholeCancel.hidden=true;
  wholeCancel.onclick=()=>cancel().catch(error=>{wholeStatus.textContent=error.message;});
  whole.append(appearanceLabel,appearance,qualityLabel,quality,wholeDownload,wholeCancel,wholeStatus);

  const locations = element('details', null, 'map-section map-download-section');
  locations.name = 'map-download-section';
  locations.append(element('summary', '3. High-resolution locations (optional)'));
  const productLabel=element('label','Location map');
  const product=element('select');product.id='map-location-product';productLabel.htmlFor=product.id;
  for(const [value,label] of [['ctx','CTX imagery'],['hirise','HiRISE imagery'],['viking','Viking imagery'],['hrsc-relief','HRSC / MOLA relief'],['hrsc-elevation','HRSC / MOLA elevation'],['themis','THEMIS infrared']]){
    const option=element('option',label);option.value=value;product.append(option);
  }
  product.value=initial?.product??'ctx';
  const groupsHost = element('div');
  const selectedSummary=element('div',null,'map-selected-locations');
  const locationDownload = element('button', 'Download selected locations', 'map-primary');locationDownload.type = 'button';
  const locationStatus = element('p', null, 'map-muted');locationStatus.setAttribute('role', 'status');
  const cancelButton = element('button', 'Cancel downloads');cancelButton.type = 'button';cancelButton.hidden = true;
  cancelButton.onclick = () => cancel().catch(error => {locationStatus.textContent = error.message;});
  locations.append(productLabel,product,groupsHost,selectedSummary,locationDownload,cancelButton,locationStatus);

  let worldOptions = [], groups = [], selectedWorld = initial?.whole ?? '';
  let selectedPlaces = new Map((initial?.places ?? []).map(entry => [entry.placeId, entry.id]));
  let busy = false, disposed = false,progressTimer;

  function selectedPlans() {
    const global = worldOptions.find(option => option.id === selectedWorld);
    const selected = groups.flatMap(group => group.places).filter(place => selectedPlaces.get(place.placeId) === place.id);
    return [...(global ? [global] : []), ...selected];
  }

  function updateButtons() {
    const unavailable = busy || getState().downloadBusy;
    wholeDownload.hidden = !selectedWorld;
    wholeDownload.disabled = unavailable;
    locationDownload.disabled = unavailable || !selectedPlaces.size;
    wholeDownload.textContent = getState().mode === 'online' ? 'Download whole Mars' : 'Go online to download';
    locationDownload.textContent = getState().mode === 'online' ? 'Download selected locations' : 'Go online to download locations';
    for (const input of [...whole.querySelectorAll('select'), product,...groupsHost.querySelectorAll('input'),...selectedSummary.querySelectorAll('button')]) input.disabled = unavailable;
    cancelButton.hidden = !unavailable;wholeCancel.hidden=!unavailable;
  }

  function renderPlaces() {
    const open = new Set([...groupsHost.querySelectorAll('details[open]')].map(node => node.dataset.group));
    groupsHost.replaceChildren();
    const family=product.value==='hirise'?'HiRISE':MAP_SOURCES[product.value]?.name;
    const visibleGroups=groups.filter(group=>group.family===family);
    if (!visibleGroups.length) groupsHost.append(element('p', 'No finer coverage is available for this base quality.', 'map-muted'));
    for (const group of visibleGroups) {
      const panel = element('details', null, 'map-resolution-group');panel.dataset.group = group.key;
      const selected = group.places.filter(place => selectedPlaces.get(place.placeId) === place.id).length;
      const resolution = group.terrain ? Math.round(group.resolution) + ' m grid' : formatResolution(group.resolution);
      panel.append(element('summary', resolution + ' · ' + group.family + (selected ? ' · ' + selected + ' selected' : '')));
      panel.open = open.has(group.key) || selected > 0;
      for (const place of group.places) {
        const label = element('label', null, 'map-check map-place');
        const checkbox = element('input');checkbox.type = 'checkbox';checkbox.checked = selectedPlaces.get(place.placeId) === place.id;
        checkbox.id='map-location-'+place.id;
        checkbox.setAttribute('aria-label', place.name + ' · ' + resolution + ' · ' + group.family);
        checkbox.onchange = () => {
          if (checkbox.checked) {selectedPlaces.set(place.placeId, place.id);onPreview(place.selection);}
          else selectedPlaces.delete(place.placeId);
          renderPlaces();updateButtons();onChange();
          document.getElementById(checkbox.id)?.focus({preventScroll:true});
        };
        const text = element('span', place.name);text.append(element('small', 'Up to ' + formatBytes(place.maximumBytes)+(place.appearance!==getState().choices.imageryAppearance?' · Grayscale only':'')));
        label.append(checkbox, text);panel.append(label);
      }
      groupsHost.append(panel);
    }
    selectedSummary.replaceChildren();
    for(const place of selectedPlans().filter(plan=>plan.placeId)){
      const row=element('div',null,'map-selected-location');
      const text=element('span',place.name+' · '+formatResolution(place.resolution));
      const remove=element('button','Remove');remove.type='button';remove.setAttribute('aria-label','Remove '+place.name);
      remove.onclick=()=>{selectedPlaces.delete(place.placeId);renderPlaces();updateButtons();onChange();};
      row.append(text,remove);selectedSummary.append(row);
    }
  }

  function refresh() {
    const state = getState();appearance.value = state.choices.imageryAppearance;
    worldOptions = worldDownloadOptions(appearance.value);
    quality.replaceChildren();
    const included = element('option', 'Included · ' + formatResolution(state.options.find(option => option.id === state.choices.globalId)?.imageryMetersPerPixel ?? 5210));included.value = '';quality.append(included);
    const families = new Map();
    for (const option of worldOptions) {
      const product = MAP_SOURCES[option.sourceId];
      if (!families.has(product.name)) {const group = element('optgroup');group.label = product.name;families.set(product.name, group);quality.append(group);}
      const label = product.role === 'terrain' ? Math.round(option.resolution) + ' m grid' : formatResolution(option.resolution);
      const node = element('option', label + ' · up to ' + formatBytes(option.maximumBytes)+(option.partial?' · Partial coverage':'')+(option.appearance!==appearance.value?' · Grayscale only':''));node.value = option.id;families.get(product.name).append(node);
    }
    if (!worldOptions.some(option => option.id === selectedWorld)) selectedWorld = '';
    quality.value = selectedWorld;
    const global=worldOptions.find(option=>option.id===selectedWorld);
    const baseResolution=global&&MAP_SOURCES[global.sourceId].role==='imagery'?global.resolution:state.options.find(option=>option.id===state.choices.globalId)?.imageryMetersPerPixel??5210;
    groups = locationDownloadOptions(baseResolution, appearance.value);
    const available = new Set(groups.flatMap(group => group.places).map(place => place.id));
    selectedPlaces = new Map([...selectedPlaces].filter(([, id]) => available.has(id)));
    renderPlaces();updateButtons();
  }

  async function run(plans, status) {
    if (!plans.length || busy || getState().downloadBusy) return;
    if (getState().mode !== 'online') {try {await enableDownloads();} catch (error) {status.textContent = error.message;} return;}
    busy = true;updateButtons();status.textContent = 'Starting download…';
    let completed=0;
    progressTimer=setInterval(()=>void statusQuery().catch(()=>{}),600);
    async function statusQuery(){
      const job=await sourceStatus();
      if(!disposed&&job?.state==='downloading')status.textContent=completed+' / '+plans.length+' maps ready · '+job.completed+' / '+job.total+' tiles · '+formatBytes(job.received);
    }
    try {
      await download(plans, (index, total, job) => {
        completed=index;
        if (!disposed) status.textContent = index + ' / ' + total + ' ready offline · ' + formatBytes(job.received);
      });
    } catch (error) {if (!disposed) status.textContent = error.message;}
    finally {clearInterval(progressTimer);busy = false;if (!disposed) updateButtons();}
  }
  product.onchange=()=>{renderPlaces();onChange();};
  quality.onchange = () => {selectedWorld = quality.value;refresh();onPreview(world);onChange();};
  appearance.onchange = () => {onAppearanceChange(appearance.value);refresh();onChange();};
  wholeDownload.onclick = () => run(worldOptions.filter(option => option.id === selectedWorld), wholeStatus);
  locationDownload.onclick = () => run(selectedPlans().filter(plan => plan.placeId), locationStatus);
  refresh();
  return {
    whole, locations, refresh, updateButtons, plans: selectedPlans,
    selection() {return {whole: selectedWorld, product:product.value, places: groups.flatMap(group => group.places).filter(place => selectedPlaces.get(place.placeId) === place.id).map(({placeId, id}) => ({placeId, id}))};},
    dispose() {disposed = true;clearInterval(progressTimer);},
  };
}

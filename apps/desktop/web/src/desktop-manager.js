import {selectionShape} from './map-area.js';
import {desktopState} from './desktop-mode.js';
import {formatBytes, formatResolution, regionalGroups, normalizeChoices, selectPlace, supportsAppearance} from './map-selection.js';
import './desktop-manager.css';
import {createAreaPicker} from './desktop-map-area.js';
import {createLocationDownloads} from './desktop-location-downloads.js';
import {sourceMapEstimate,sourceStorageRequired} from './source-map-plan.js';
let mapDownloadDraft;
const draftKey='mars-atlas-map-download-draft-v1';
function savedMapDraft(){
 try{const draft=JSON.parse(localStorage.getItem(draftKey)??'null');if(!draft||typeof draft!=='object'||Array.isArray(draft))return;
  if(draft.sourceSelection?.selection){try{selectionShape(draft.sourceSelection.selection);}catch{delete draft.sourceSelection;}}
  const locations=draft.locationSelections;if(locations)locations.places=Array.isArray(locations.places)?locations.places.filter(place=>typeof place?.placeId==='string'&&typeof place.id==='string').slice(0,32):[];
  return draft;
 }catch{}
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const button = (text, action, className = '') => {
  const node = el('button', className, text);
  node.type = 'button';
  node.onclick = action;
  return node;
};
function section(title, description) {
  const node = el('section', 'map-section');
  node.append(el('h3', '', title));
  if (description) node.append(el('p', 'map-muted', description));
  return node;
}
function coverage(option) {
  const details = el('details', 'map-coverage');
  details.append(el('summary', '', 'Coverage and source'));
  const [w, s, e, n] = option.bounds;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 360 180');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Coverage bounds from ' + w + ' to ' + e + ' degrees east, ' + s + ' to ' + n + ' degrees latitude');
  const background = document.createElementNS(svg.namespaceURI, 'rect');
  for (const [key, value] of Object.entries({x: 0, y: 0, width: 360, height: 180, fill: '#0c161e', stroke: '#728a9460'})) background.setAttribute(key, value);
  svg.append(background);
  const rectangle = document.createElementNS(svg.namespaceURI, 'rect');
  for (const [key, value] of Object.entries({x: w + 180, y: 90 - n, width: Math.max(e - w, .6), height: Math.max(n - s, .6), fill: '#efa67866', stroke: '#efa678', 'stroke-width': .8})) rectangle.setAttribute(key, value);
  svg.append(rectangle);
  details.append(svg, el('p', 'map-muted', 'Bounds: ' + option.bounds.map(v => v.toFixed(3)).join(', ') + ' (west, south, east, north). Bounds can contain source gaps.'));
  details.append(el('p', 'map-muted', option.source), el('p', 'map-muted', option.credit));
  return details;
}
export async function openMapManager(api, {preview = false, overviewSources} = {}) {
  const modal = el('dialog', 'map-manager');
  modal.dataset.desktopMaps = 'true';
  modal.setAttribute('aria-labelledby', 'map-manager-title');
  const header = el('div', 'map-header');
  const title = el('h2', '', 'Map Manager');
  title.id = 'map-manager-title';
  const subtitle = el('p', 'map-muted', 'Whole Mars, named locations or a custom area.');
  const close = button('Close', () => modal.close(), 'map-close');
  const heading = el('div');
  heading.append(title, subtitle);
  header.append(heading, close);
  const body = el('div', 'map-body'), main = el('div', 'map-main'), aside = el('aside', 'map-storage');
  aside.setAttribute('aria-label', 'Storage estimate');
  const workspace = el('div','map-workspace-host');
  body.append(main, workspace);
  const status = el('p', 'map-status');
  status.setAttribute('role', 'status');
  const footer = el('div', 'map-footer'), actions = el('div', 'map-actions');
  const save = button('Save choices', () => apply(false));
  const download = button('Download selection', () => apply(true), 'map-primary');
  actions.append(save, download);
  footer.append(status, actions);
  modal.append(header, body, footer);
  document.body.append(modal);
  modal.showModal();
  let areaPicker,locationDownloads,customPlan;
  let downloadBusy=false,cancelRequested=false;
  let state, choices, timer, request = 0, busy = false, alive = true;
  const unsubscribers = [];
  modal.addEventListener('close', () => {
    rememberDraft(false);
    alive = false;
    areaPicker?.dispose();
    locationDownloads?.dispose();
    clearTimeout(timer);
    unsubscribers.forEach(unsubscribe => unsubscribe());
    modal.remove();
  }, {once: true});
  function message(text, error = false) {
    status.textContent = text;
    status.dataset.error = String(error);
  }
  function updateButtons() {
    const unavailable = busy || !state || state.plan.blockers.length > 0;
    save.disabled = busy || !state;
    download.hidden = !state?.plan.remainingDownloadBytes;
    download.disabled = unavailable || state.mode !== 'online'
      || !choices.progressive && state.plan.enoughSpace === false;
    download.textContent = choices?.progressive ? 'Download base · detail as explored' : 'Download selection';
  }
  async function estimate() {
    clearTimeout(timer);
    const ticket = ++request;
    download.disabled = true;
    aside.setAttribute('aria-busy', 'true');
    try {
      const next = await api.mapManagerState(choices);
      if (!alive || ticket !== request) return;
      state = next;
      renderStorage();
      updateButtons();
    } catch (error) {
      if (alive && ticket === request) message(error.message, true);
    } finally {
      if (alive && ticket === request) aside.removeAttribute('aria-busy');
    }
  }
  function changed(note = 'Choices changed. Save when you are ready.') {
    message(note);
    clearTimeout(timer);
    areaPicker?.refresh();
    locationDownloads?.refresh();renderSourceStorage();
    renderRegions();
    renderProgressive();
    download.disabled = true;
    timer = setTimeout(estimate, 180);
  }
  const globalSection = section('1. Whole Mars map', 'Quality controls the base map available everywhere. Regional imagery and terrain can be sharper.');
  const appearanceLabel=el('label','map-field-label','Download appearance'),appearanceSelect=el('select');appearanceSelect.id='map-download-appearance';appearanceLabel.htmlFor=appearanceSelect.id;
  for(const [value,name] of [['grayscale','Grayscale'],['color','Color — where source packages are available']]){const option=el('option','',name);option.value=value;appearanceSelect.append(option);}
  appearanceSelect.onchange=()=>{choices=normalizeChoices({...choices,imageryAppearance:appearanceSelect.value},state.options);renderGlobalOptions();renderGlobalDetails();changed('Download appearance changed. Incompatible area/place selections were removed. Select the available qualities again.');};
  const appearanceNote=el('p','map-muted','Color comes from the publisher. Grayscale uses the publisher’s grayscale tiles when available or a local conversion. Some products offer grayscale only.');
  const globalLabel = el('label', 'map-field-label', 'Quality');
  globalLabel.htmlFor = 'map-global-quality';
  const globalSelect = el('select');
  globalSelect.id = 'map-global-quality';
  const globalDetails = el('div');
  globalSelect.onchange = () => {
    const previous = choices.regionalIds.length;
    const previousArea=choices.areaSelection;
    choices = normalizeChoices({...choices, globalId: globalSelect.value}, state.options);
    renderGlobalDetails();
    changed(previousArea&&!choices.areaSelection?'The added area was removed because it no longer improves the base map or has matching coverage. Choose its quality again.':previous > choices.regionalIds.length ? (previous - choices.regionalIds.length) + ' regional selection(s) removed because they no longer improve the base map.' : undefined);
  };
  globalSection.append(appearanceLabel,appearanceSelect,appearanceNote,globalLabel, globalSelect, globalDetails);
  if(!preview&&api.downloadSourceMap)globalSection.append(button('Choose a whole-Mars source and resolution',()=>areaPicker?.selectWholeSource()));
  const regionSection = section('Saved regional packages');
  const regionList = el('div');
  const areaHost=el('div');
  regionSection.append(regionList);
  const progressiveSection = section('3. Progressive loading', 'Keep exploring the installed base while selected regional detail downloads in the background.');
  const progressiveControls = el('div');
  progressiveSection.append(progressiveControls);
  const installedSection = el('details','map-section');
  installedSection.append(el('summary','','Your maps'));
  const installedList = el('div');
  const importButton = button('Import package folder', async () => {
    importButton.disabled = true;
    message('Checking package files and checksums…');
    try {
      const result = await api.importMap();
      message(result?.error ?? (result?.cancelled ? 'Import cancelled.' : 'Package verified and registered. Reload maps to use newly imported coverage.'), Boolean(result?.error));
      await refresh();
    } catch (error) {message(error.message, true);}
    finally {importButton.disabled = false;}
  });
  installedSection.append(installedList, importButton);
  const jobsSection = section('Downloads');
  const jobs = el('div');
  const pauseAll = button('Pause all downloads', async () => {
    try {await api.pauseDownload('*'); choices.progressive=false; renderProgressive(); message('All downloads paused and progressive downloads switched off. Retry a map to continue.'); await refresh();}
    catch (error) {message(error.message, true);}
  });
  jobsSection.append(jobs, pauseAll);
  const otherSection = section('Other approved packages', 'These older packages do not declare a verified download appearance. They remain separate from your Color/Grayscale selection.');
  const otherList = el('div');
  otherSection.append(otherList);
  const advanced = el('details','map-section map-advanced');
  advanced.append(el('summary','','More options'),globalSection,regionSection,progressiveSection,jobsSection,otherSection,aside,actions);
  const customSection=el('details','map-section map-download-section');
  customSection.addEventListener('toggle',()=>{if(customSection.open)areaPicker?.showSelection();});
  customSection.name='map-download-section';customSection.append(el('summary','','2. Custom area'),areaHost);
  const totalStorage=el('p','map-callout');totalStorage.setAttribute('role','status');
  const progressiveNote=el('p','map-muted','Progressive zoom levels are included for smoother loading and use more storage.');
  main.append(customSection,totalStorage,progressiveNote,installedSection,advanced);
  footer.replaceChildren(status);
  function renderGlobalOptions(){
    globalSelect.replaceChildren();
    appearanceSelect.value=choices.imageryAppearance;
    for (const option of state.options.filter(o => o.scope === 'global'&&supportsAppearance(o,choices.imageryAppearance)).sort((a, b) => b.imageryMetersPerPixel - a.imageryMetersPerPixel)) {
      const node = el('option', '', option.qualityLabel + ' · ' + formatResolution(option.imageryMetersPerPixel) + ' · ' + (option.included ? 'Included' : formatBytes(option.bytes)));
      node.value = option.id;
      globalSelect.append(node);
    }
    globalSelect.value = choices.globalId;
    globalSection.hidden = globalSelect.options.length < 2;
  }
  function renderGlobalDetails() {
    globalDetails.replaceChildren();
    const option = state.options.find(o => o.id === choices.globalId);
    globalDetails.append(el('p', 'map-quality-note', formatResolution(option.imageryMetersPerPixel) + ' imagery · ' + (option.included ? 'Included with the app' : formatBytes(option.bytes))));
    globalDetails.append(el('p', 'map-muted', option.description));
    if (option.terrainMetersPerPixel) globalDetails.append(el('p', 'map-muted', 'Terrain grid: ' + formatResolution(option.terrainMetersPerPixel) + '. Imagery and elevation have separate resolutions.'));
    if (state.options.filter(o => o.scope === 'global'&&supportsAppearance(o,choices.imageryAppearance)).length === 1) globalDetails.append(el('p', 'map-empty', 'Additional qualities will appear here as verified global packages become available.'));
    globalDetails.append(el('p','map-muted','Download appearance: '+(choices.imageryAppearance==='color'?'Color · '+(option.colorKind??'see source'):'Grayscale')));
    globalDetails.append(coverage(option));
  }
  function renderRegions() {
    const openGroups = new Set([...regionList.querySelectorAll('details[open]')].map(node => node.dataset.resolution));
    const focused = document.activeElement?.id;
    regionList.replaceChildren();
    const groups = regionalGroups(state.options, choices);
    regionSection.hidden = progressiveSection.hidden = !groups.length;
    if (!groups.length) {
      regionList.append(el('p', 'map-empty', 'No saved regional packages.'));
      return;
    }
    for (const group of groups) {
      const details = el('details', 'map-resolution-group');
      details.dataset.resolution = String(group.resolution);
      details.open = openGroups.has(String(group.resolution)) || group.places.some(option => choices.regionalIds.includes(option.id));
      const selected = group.places.filter(option => choices.regionalIds.includes(option.id)).length;
      details.append(el('summary', '', formatResolution(group.resolution) + ' · ' + group.places.length + ' place(s)' + (selected ? ' · ' + selected + ' selected' : '')));
      for (const option of group.places) {
        const row = el('div', 'map-place');
        const label = el('label', 'map-check');
        const checkbox = el('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'map-select-' + option.id;
        checkbox.checked = choices.regionalIds.includes(option.id);
        checkbox.onchange = () => {
          choices = selectPlace(choices, option, checkbox.checked, state.options);
          changed();
        };
        const text = el('span');
        const installed = state.installed.find(item => item.id === option.id);
        text.append(el('strong', '', option.placeName), el('small', '', formatBytes(option.bytes) + (installed ? installed.available ? ' · Installed' : ' · Storage missing or changed' : '')));
        label.append(checkbox, text);
        row.append(label, el('p', 'map-muted', 'Imagery: ' + formatResolution(option.imageryMetersPerPixel) + ' · Terrain: ' + (option.terrainMetersPerPixel ? formatResolution(option.terrainMetersPerPixel) : 'See source metadata')), coverage(option));
        details.append(row);
      }
      regionList.append(details);
    }
    if (focused?.startsWith('map-select-')) document.getElementById(focused)?.focus({preventScroll: true});
  }
  function renderProgressive() {
    progressiveControls.replaceChildren();
    const label = el('label', 'map-check');
    const toggle = el('input');
    toggle.type = 'checkbox';
    toggle.checked = choices.progressive;
    toggle.onchange = () => {choices.progressive = toggle.checked; changed();};
    label.append(toggle, el('span', '', 'Download selected detail as I explore'));
    const limitLabel = el('label', 'map-field-label', 'Progressive storage limit');
    limitLabel.htmlFor = 'map-cache-limit';
    const limit = el('select');
    limit.id = 'map-cache-limit';
    for (const gib of [1, 2, 5, 10, 20, 50, 100]) {
      const option = el('option', '', gib + ' GiB');
      option.value = gib;
      option.selected = gib === choices.cacheGiB;
      limit.append(option);
    }
    limit.disabled = !choices.progressive;
    limit.onchange = () => {choices.cacheGiB = Number(limit.value); changed();};
    progressiveControls.append(label,
      el('p', 'map-callout', 'Uses more storage for smoother revisits. Requires Online Mode.'),
      limitLabel, limit,
      el('p', 'map-muted', 'Applies to selected saved regional packages.'));
  }
  function renderStorage() {
    const p = state.plan;
    aside.replaceChildren(el('span', 'map-eyebrow', 'STORAGE'), el('h3', '', 'Your selection'));
    const summary = el('dl', 'map-storage-numbers');
    const add = (label, value, strong = false) => {
      const row = el('div', strong ? 'map-storage-total' : '');
      row.append(el('dt', '', label), el('dd', '', value));
      summary.append(row);
    };
    add('Download appearance',choices.imageryAppearance==='color'?'Color':'Grayscale');
    add('Selected map data', formatBytes(p.selectedBytes));
    add('Already installed', formatBytes(p.installedBytes));
    if (p.retainedDownloadBytes) add('Saved download progress', formatBytes(p.retainedDownloadBytes));
    add('Still to download', formatBytes(p.remainingDownloadBytes), true);
    add('Free space needed', formatBytes(p.requiredFreeBytes));
    add('Free on this drive', formatBytes(p.freeBytes));
    aside.append(summary, el('p', 'map-muted', 'Free space needed includes an installation allowance. Estimates cover all selected maps, including detail downloaded later. The bundled starter stays installed.'));
    if (choices.progressive) {
      const cache = el('div', 'map-cache-summary');
      cache.append(el('strong', '', 'Progressive downloads'),
        el('p', '', formatBytes(p.progressiveReservedBytes) + ' reserved / ' + choices.cacheGiB + ' GiB limit'),
        el('p', 'map-muted', 'Reserved space includes completed and interrupted automatic packages, including files kept after unregistering. No maps are silently deleted.'));
      aside.append(cache);
    }
    if (p.enoughSpace === false) aside.append(el('p', 'map-callout map-warning', 'Not enough free space for every selected map. Choose fewer maps or another drive.'));
    if (p.freeBytes == null) aside.append(el('p', 'map-callout', 'Free space could not be read. Space is checked again before each download.'));
    for (const text of [...p.blockers, ...p.notices]) aside.append(el('p', 'map-callout map-warning', text));
    aside.append(el('h4', '', 'Download location'), el('p', 'map-directory', state.directory));
    const choose = button('Choose storage', async () => {
      try {
        const result = await api.chooseDataDirectory();
        if (!result.cancelled) {message('Download location changed. Existing maps stay in their current folders.'); await refresh();}
      } catch (error) {message(error.message, true);}
    });
    aside.append(choose, el('p', 'map-muted', 'Choosing a folder sets where future downloads go. It does not install maps or move existing files.'));
    aside.append(el('p', 'map-mode ' + (state.mode === 'offline' ? 'map-warning' : ''), state.mode === 'offline' ? 'OFFLINE MODE · Save choices or import files. Switch to Online Mode to download.' : 'ONLINE MODE · Downloads are available.'));
    aside.append(button('Reload maps', () => api.reloadMaps()));
  }
  function renderJobs() {
    jobs.replaceChildren();
    if (!state.jobs.length) jobs.append(el('p', 'map-muted', 'No downloads yet.'));
    for (const job of state.jobs) {
      const row = el('div', 'map-download');
      const option = state.options.find(o => o.id === job.id);
      row.append(el('strong', '', option?.name ?? job.id), el('p', 'map-muted', job.state + ' · ' + formatBytes(job.received) + ' / ' + formatBytes(job.total) + (job.speed ? ' · ' + formatBytes(job.speed) + '/s' : '')));
      const progress = el('progress');
      progress.max = Math.max(1, job.total ?? 0);
      progress.value = job.received ?? 0;
      progress.setAttribute('aria-label', (option?.name ?? job.id) + ' download');
      row.append(progress);
      if (job.error) row.append(el('p', 'map-warning', job.error));
      if (['downloading', 'verifying'].includes(job.state)) row.append(button('Pause', async () => {
        try {await api.pauseDownload(job.id);}
        catch (error) {message(error.message, true);}
      }));
      if (['failed', 'paused'].includes(job.state)) {
        const retry = button('Retry / resume', async () => {
          try {await api.startDownload(job.id); await refresh();}
          catch (error) {message(error.message, true);}
        });
        retry.disabled = state.mode !== 'online';
        row.append(retry);
      }
      jobs.append(row);
    }
    pauseAll.hidden = !state.jobs.some(job => ['downloading', 'verifying'].includes(job.state));
    for (const queued of state.queue ?? []) jobs.append(el('p', 'map-muted', 'Queued · ' + (state.options.find(option => option.id === queued.id)?.name ?? queued.id)));
  }
  function renderInstalled() {
    installedList.replaceChildren();
    installedList.append(el('p', 'map-quality-note', 'Bundled starter · Available · Coarse CTX/Viking overview and measured MOLA elevation'));
    for (const pkg of state.installed) {
      const row = el('div', 'map-installed');
      row.append(el('strong', '', pkg.name + ' · ' + pkg.version),
        el('p', 'map-muted', formatBytes(pkg.bytes) + ' · ' + (pkg.available ? pkg.active ? 'Active' : 'Inactive' : 'Storage missing or files changed')),
        el('p', 'map-muted', pkg.credit));
      if (pkg.integration === 'registered-data-only') row.append(el('p', 'map-muted', 'Registered data only; this package does not supply a map layer.'));
      const controls = el('div', 'map-actions');
      if (['native-cog', 'source-imagery', 'source-terrain'].includes(pkg.integration)) {
        const activate = button(pkg.active ? 'Deactivate' : 'Activate', async () => {
          try {await api.activateMap(pkg.id, !pkg.active); await refresh();}
          catch (error) {message(error.message, true);}
        });
        activate.disabled = !pkg.available && !pkg.active;
        controls.append(activate);
      }
      controls.append(button('Unregister · keep files', async () => {
        try {await api.removeMap(pkg.id); message('Registration removed. The map files were kept.'); await refresh();}
        catch (error) {message(error.message, true);}
      }));
      row.append(controls);
      installedList.append(row);
    }
  }
  function rememberDraft(open=true){
    if(!alive||!areaPicker||!locationDownloads)return;
    const draft={choices,sourceSelection:areaPicker.selection(),locationSelections:locationDownloads.selection(),section:customSection.open?'custom':locationDownloads.locations.open?'locations':'whole',open};
    mapDownloadDraft=draft;
    try{localStorage.setItem(draftKey,JSON.stringify(draft));document.dispatchEvent(new Event('atlas-preferences-change'));}catch(error){message('Map choices could not be saved. '+error.message,true);document.dispatchEvent(new CustomEvent('atlas-state-save-error',{detail:{message:error.message}}));}
  }
  function selectedSourcePlans(){
    const plans=[...(locationDownloads?.plans()??[]),...(customPlan?[customPlan]:[])];
    return [...new Map(plans.map(plan=>[JSON.stringify([plan.sourceId,plan.level,plan.appearance,plan.selection]),plan])).values()];
  }
  function renderSourceStorage(){
    const plans=selectedSourcePlans();
    const bytes=plans.reduce((sum,plan)=>sum+sourceStorageRequired(plan),0);
    const exceeded=state?.plan.freeBytes!=null&&bytes>state.plan.freeBytes;
    totalStorage.dataset.exceeded=String(exceeded);
    totalStorage.textContent='Storage needed · up to '+formatBytes(bytes)+(state?.plan.freeBytes==null?'':' · '+formatBytes(state.plan.freeBytes)+' free')+(exceeded?' · Storage exceeded':'');
    rememberDraft();
  }
  async function enableSourceDownloads(){
    rememberDraft();sessionStorage.setItem('atlas-map-download-draft',JSON.stringify(mapDownloadDraft));
    try{await api.setMode('online');}catch(error){sessionStorage.removeItem('atlas-map-download-draft');throw error;}
  }
  async function cancelSourceDownloads(){cancelRequested=true;await api.cancelSourceMap();}
  async function downloadSources(plans,onProgress=()=>{}){
    if(downloadBusy)throw Error('Wait for the current map download.');
    const required=plans.reduce((sum,plan)=>sum+sourceStorageRequired(plan.tileCount!=null?plan:sourceMapEstimate(plan.selection,plan.level,plan.appearance,plan.sourceId)),0);
    if(state.plan.freeBytes!=null&&required>state.plan.freeBytes)throw Error('Storage exceeded. Choose fewer locations, a lower resolution or another drive.');
    downloadBusy=true;cancelRequested=false;areaPicker?.refresh();locationDownloads?.updateButtons();
    let result;
    try{
      for(const [index,plan] of plans.entries()){
        if(cancelRequested)throw Error('Downloads cancelled.');
        result=await api.downloadSourceMap({selection:plan.selection,sourceId:plan.sourceId,level:plan.level,appearance:plan.appearance});
        onProgress(index+1,plans.length,result);
      }
      if(alive)await refresh();
      return result;
    }finally{downloadBusy=false;if(alive){areaPicker?.refresh();locationDownloads?.updateButtons();}}
  }
  async function refresh() {
    const next = await api.mapManagerState(choices);
    if (!alive) return;
    state = next;
    choices ??= structuredClone(state.choices);
    areaPicker?.refresh(); locationDownloads?.refresh();renderSourceStorage();renderStorage(); renderInstalled(); renderJobs(); updateButtons();
  }
  async function apply(startDownloads) {
    busy = true;
    updateButtons();
    clearTimeout(timer);
    ++request;
    try {
      state = await api.applyMapChoices(choices, startDownloads);
      if (!alive) return;
      choices = structuredClone(state.choices);
      message(preview ? 'Preview choices updated for this page only. No files, downloads, or application settings changed.' : startDownloads ? choices.progressive ? 'Choices saved. The base is queued; selected detail downloads as you explore.' : 'Choices saved. Missing maps are queued for download.' : 'Choices saved. Reload maps to apply a changed global quality. Regional detail can be refreshed as it installs.');
      renderStorage(); renderJobs();
    } catch (error) {if (alive) message(error.message, true);}
    finally {busy = false; if (alive) updateButtons();}
  }
  try {
    state = await api.mapManagerState();
    if (!alive) return modal;
    let restored;
    try{restored=JSON.parse(sessionStorage.getItem('atlas-map-download-draft')??'null');sessionStorage.removeItem('atlas-map-download-draft');}catch{}
    restored??=mapDownloadDraft??savedMapDraft();
    choices = normalizeChoices(restored?.choices??state.choices,state.options);
    areaPicker=createAreaPicker({getState:()=>({...state,choices,downloadBusy,customAreaActive:customSection.open}),overviewSources,initialSelection:restored?.sourceSelection,sourceApi:api.downloadSourceMap?{...api,downloadSourceMap:input=>downloadSources([input]),cancelSourceMap:cancelSourceDownloads}:null,onEnableDownloads:enableSourceDownloads,onPlanChange:plan=>{customPlan=plan;renderSourceStorage();},onAppearanceChange:value=>{choices=normalizeChoices({...choices,imageryAppearance:value},state.options);renderGlobalOptions();renderGlobalDetails();changed('');},onPreviewChange:value=>{choices.selectionPreviewAppearance=value;rememberDraft();},onSelect:selection=>{choices=normalizeChoices({...choices,areaSelection:selection},state.options);changed(selection?"Area added. Storage includes its complete covering packages. Save choices to keep it.":"Area selection removed. Map files are kept.");}});
    areaHost.append(areaPicker.element);
    workspace.append(areaPicker.mapElement);
    if(api.downloadSourceMap){
      locationDownloads=createLocationDownloads({getState:()=>({...state,choices,downloadBusy,customAreaActive:customSection.open}),initial:restored?.locationSelections,
        onAppearanceChange:value=>{choices=normalizeChoices({...choices,imageryAppearance:value},state.options);areaPicker.refresh();},
        onChange:renderSourceStorage,onPreview:selection=>areaPicker.previewSelection(selection),download:downloadSources,enableDownloads:enableSourceDownloads,cancel:cancelSourceDownloads,sourceStatus:()=>api.sourceMapStatus()});
      main.prepend(locationDownloads.whole);customSection.after(locationDownloads.locations);
      for(const section of [customSection,locationDownloads.locations,locationDownloads.whole])section.addEventListener('toggle',()=>rememberDraft());
      areaHost.addEventListener('change',()=>rememberDraft());
      const saveDraft=()=>rememberDraft();document.addEventListener('atlas-map-draft-save-request',saveDraft);unsubscribers.push(()=>document.removeEventListener('atlas-map-draft-save-request',saveDraft));
      if(restored?.section==='custom')customSection.open=true;else if(restored?.section==='locations')locationDownloads.locations.open=true;
      renderSourceStorage();
    }
    renderGlobalOptions();
    renderGlobalDetails(); renderRegions(); renderProgressive(); renderStorage(); renderInstalled(); renderJobs();
    otherSection.hidden = !state.otherEntries.length;
    for (const entry of state.otherEntries) {
      const row = el('div', 'map-installed');
      row.append(el('strong', '', entry.manifest.name), el('p', 'map-muted', entry.manifest.provenance.credit));
      const downloadOther = button('Download / retry', async () => {
        try {await api.startDownload(entry.manifest.id); await refresh();}
        catch (error) {message(error.message, true);}
      });
      downloadOther.disabled = state.mode !== 'online';
      row.append(downloadOther);
      otherList.append(row);
    }
    if (preview) message('Preview · Example data');
    unsubscribers.push(api.onDownload(job => {
      if (!alive) return;
      const index = state.jobs.findIndex(item => item.id === job.id);
      if (index >= 0) state.jobs[index] = job; else state.jobs.push(job);
      renderJobs();
      if (['installed', 'failed', 'paused'].includes(job.state)) void refresh().catch(error => message(error.message, true));
    }));
    if (api.onMapsChanged) unsubscribers.push(api.onMapsChanged(() => void refresh().catch(error => message(error.message, true))));
    updateButtons();
  } catch (error) {message(error.message, true); save.disabled = true; download.disabled = true;}
  return modal;
}
if (desktopState) {
  let active;
  document.addEventListener('atlas-map-manager', async () => {
    if (active?.isConnected) {active.focus(); return;}
    // Claim the opening state before asynchronous IPC returns.
    const pending = {isConnected: true, focus() {}};
    active = pending;
    const modal = await openMapManager({...window.marsDesktop, reloadMaps: () => location.reload()});
    if (active === pending) active = modal;
  });
  document.addEventListener('atlas-interface-ready',()=>{if(sessionStorage.getItem('atlas-map-download-draft')||savedMapDraft()?.open===true)document.dispatchEvent(new Event('atlas-map-manager'));},{once:true});
}

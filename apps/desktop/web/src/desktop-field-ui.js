import {endpoints} from './desktop-api-catalog.js';
import {destination} from './terrain-metrics.js';

const node = (tag, text) => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  return element;
};

function button(label, action) {
  const element = node('button', label);
  element.type = 'button';
  element.onclick = action;
  return element;
}

function panel(title) {
  const dialog = node('dialog');
  dialog.className = 'atlas-field-dialog';
  dialog.setAttribute('aria-label', title);
  dialog.append(button('Close', () => dialog.close()), node('h2', title));
  document.body.append(dialog);
  return dialog;
}

export function installFieldControls(api) {
  const guide = panel('Local APIs');
  const guideStatus = node('p');
  guide.append(guideStatus, node('p', 'Before launching Atlas, set MARS_ATLAS_DR_PORT to a free port and MARS_ATLAS_DR_TOKEN to a random 64-character hexadecimal token. Calls use Authorization: Bearer <token>. Use a native client on this machine.'));
  guide.append(node('p', 'POST bodies use application/json and Content-Length, up to 256 KiB. Coordinates are [east longitude, planetocentric latitude] in degrees. Set frame to mars-east-planetocentric where required. Use UTC ISO timestamps for at.'));
  const example = node('pre');
  guide.append(example, button('Copy connection example', async () => {
    try {await navigator.clipboard.writeText(example.textContent);}
    catch {example.tabIndex = 0;example.focus();}
  }));
  const entries = endpoints.map(([method,path,title,schema]) => {
    const section = node('details');
    const summary = node('summary', `${method} ${path} · ${title}`);
    const url = node('code');
    section.append(summary,url,node('p',schema));
    guide.append(section);
    return {url,path};
  });
  const metricsGuide = node('p');
  entries.at(-1).url.parentElement.append(metricsGuide);
  const showGuide = async () => {
    if (!guide.open) guide.showModal();
    try {
      const state = await api.fieldStatus();
      const base = `http://127.0.0.1:${state.api.port ?? 47831}`;
      guideStatus.textContent = state.api.port ? `Listening at ${base}` : (state.api.error ?? 'Listener is off. The endpoints below show example port 47831.');
      for (const {url,path} of entries) url.textContent = base + path;
      example.textContent = `curl -H "Authorization: Bearer <token>" ${base}/v1/location/status`;
      metricsGuide.textContent = Object.entries(state.metrics).map(([key,[,unit,min,max]]) => `${key} (${unit}, ${min}–${max})`).join(' · ');
    } catch (error) {guideStatus.textContent = error.message;}
  };

  const field = panel('Field telemetry');
  field.id = 'atlas-field-telemetry';
  const status = node('p');
  const suits = node('section');
  const seismic = node('section');
  const events = node('select');
  events.setAttribute('aria-label','Seismic event');
  const readout = node('p');
  const canvas = node('canvas');
  canvas.width = 600;
  canvas.height = 120;
  canvas.setAttribute('aria-label','Seismogram waveform');
  const playStatus = node('p');
  const replay = button('Locate and replay', () => {
    const event = currentEvents.find(item => item.id === events.value);
    if (!event || document.documentElement.dataset.atlasReady !== 'true') {
      playStatus.textContent = 'Wait for the map to finish loading and select an event.';
      return;
    }
    field.close();
    document.dispatchEvent(new CustomEvent('atlas-seismic-replay', {detail:event}));
  });
  field.append(status,node('h3','Space suits'),suits,node('h3','Seismic events'),seismic);
  seismic.append(events,readout,canvas,replay,playStatus);
  let currentEvents = [], eventSignature = '', refreshing = false, timer;
  function showWaveform() {
    const event = currentEvents.find(item => item.id === events.value);
    replay.disabled = canvas.hidden = !event;
    readout.textContent = event ? `${event.simulated ? 'Simulated' : 'External feed'} · ${event.kind} · ${event.at} · ${event.sourceId} · ${event.sampleRateHz} Hz` : 'Waiting for seismic events.';
    if (!event) return;
    const samples = event.velocityMicrometersPerSecond;
    const peak = Math.max(1e-9,...samples.map(Math.abs));
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = '#eca76f';
    ctx.beginPath();
    samples.forEach((value,i) => ctx.lineTo(i/(samples.length-1)*canvas.width,60-value/peak*55));
    ctx.stroke();
    readout.append(` · Peak ${Number(peak.toPrecision(3))} µm/s`);
  }
  events.onchange = showWaveform;
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const data = await api.fieldStatus();
      if (!field.open) return;
      status.textContent = data.api.port ? `Receiving on 127.0.0.1:${data.api.port} · Session data · Seismic replay shows relative amplitude` : (data.api.error ?? 'Local API is off. See APIs for setup.');
      suits.replaceChildren(...(data.suits.length ? data.suits.map(suit => {
        const article = node('article');
        article.append(node('strong',suit.suitId),node('p',`${suit.fresh ? 'Fresh' : 'Stale'} · ${suit.simulated ? 'Simulated' : 'External feed'} · ${suit.sourceId} · ${suit.at}`));
        const values = node('dl');
        for (const [key,[name,unit]] of Object.entries(data.metrics)) {
          const value = suit.metrics[key];
          values.append(node('dt',name),node('dd',value == null ? 'Unavailable' : `${value} ${unit}`));
        }
        article.append(values);
        return article;
      }) : [node('p','Waiting for suit telemetry.')]));
      currentEvents = data.events;
      const signature = JSON.stringify(data.events.map(({id,at}) => [id,at]));
      if (signature !== eventSignature || !events.options.length) {
        const selected = events.value;
        events.replaceChildren(...data.events.map(event => Object.assign(node('option',`${event.kind} · ${event.id}`),{value:event.id})));
        if (data.events.some(event => event.id === selected)) events.value = selected;
        eventSignature = signature;
        showWaveform();
      }
    } catch (error) {status.textContent = error.message;}
    finally {refreshing = false;}
  }
  field.addEventListener('close',() => clearInterval(timer));
  const apiButton = button('APIs',showGuide);
  const fieldButton = button('Telemetry',() => {
    if (field.open) return;
    field.showModal();
    void refresh();
    timer = setInterval(refresh,1000);
  });
  const attach = () => document.querySelector('.ui-header-tools')?.prepend(apiButton,fieldButton);
  apiButton.className = fieldButton.className = 'atlas-field-top-button';
  document.addEventListener('atlas-interface-ready',attach);
  attach();
}

export function installSeismicReplay({viewer,map,mini,leaflet,locate}) {
  const C = window.Cesium;
  let animation, cleanup = () => {};
  document.addEventListener('atlas-seismic-replay',({detail:event}) => {
    cancelAnimationFrame(animation);
    cleanup();
    const [lon,lat] = event.point;
    locate(event.point);
    const ellipsoid = viewer.scene.globe.ellipsoid;
    const position = C.Cartesian3.fromDegrees(lon,lat,0,ellipsoid);
    const label = `${event.simulated ? 'Simulated' : 'Waveform replay'} · ${event.kind}`;
    const marker = viewer.entities.add({position, label:{text:label, font:'14px sans-serif',heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Infinity}});
    const rings = [map,mini].filter(Boolean).map(surface => leaflet.polygon([],{
      color:'#ffb27a',interactive:false,className:'atlas-seismic-pulse',
    }).addTo(surface));
    const bearings = Array.from({length:36},(_,index) => index*Math.PI/18);
    const samples = event.velocityMicrometersPerSecond;
    const peak = Math.max(1e-9,...samples.map(Math.abs));
    const started = performance.now();
    const duration = Math.max(3000,Math.min(10000,1000*samples.length/event.sampleRateHz));
    let radius = 50, intensity = 0;
    const ring = viewer.entities.add({position,ellipse:{
      semiMajorAxis:new C.CallbackProperty(() => radius,false),
      semiMinorAxis:new C.CallbackProperty(() => radius,false),
      material:new C.ColorMaterialProperty(new C.CallbackProperty(() => C.Color.ORANGE.withAlpha(intensity*.35),false)),
      height:0,
      heightReference:C.HeightReference.CLAMP_TO_GROUND,
    }});
    cleanup = () => {
      viewer.entities.remove(marker);
      viewer.entities.remove(ring);
      for (const item of rings) item.remove();
      viewer.scene.requestRender();
    };
    function tick(now) {
      const progress = Math.min(1,(now-started)/duration);
      const index = Math.min(samples.length-1,Math.floor(progress*samples.length));
      intensity = .15+.85*Math.abs(samples[index])/peak;
      radius = 50+progress*7500;
      const outline = bearings.map(angle => {
        const [east,north] = destination(lon,lat,Math.sin(angle)*radius,Math.cos(angle)*radius);
        return [north,lon+((east-lon+540)%360-180)];
      });
      for (const item of rings) item.setLatLngs(outline).setStyle({opacity:intensity,fillOpacity:intensity*.2});
      viewer.scene.requestRender();
      if (progress < 1) animation = requestAnimationFrame(tick);
      else cleanup();
    }
    animation = requestAnimationFrame(tick);
  });
}

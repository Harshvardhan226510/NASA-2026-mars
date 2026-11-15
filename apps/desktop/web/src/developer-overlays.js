import L from 'leaflet';
import {planetImageryProvider} from './context-display.js';
import {CTXLayer} from './context-imagery.js';

export function installDeveloperOverlays({viewer, map, mini, ellipsoid, imageryReady}) {
  const C = window.Cesium;
  const globeObservations = new C.CustomDataSource('Developer observations');
  viewer.dataSources.add(globeObservations);
  const flatObservations = [map, mini].map(view => L.layerGroup().addTo(view));
  const imagery = new Map();
  let observationRevision = 0;
  let imageryRevision = 0;

  async function refreshObservations() {
    const revision = ++observationRevision;
    const features = [];
    let offset = 0;
    do {
      const response = await fetch(`/api/desktop/observations?offset=${offset}`);
      if (!response.ok || revision !== observationRevision) return;
      const page = await response.json();
      features.push(...page.features);
      offset = page.nextOffset;
    } while (offset !== null && offset < 5000);
    if (revision !== observationRevision) return;
    globeObservations.entities.removeAll();
    for (const layer of flatObservations) layer.clearLayers();
    for (const feature of features) {
      const [lon, lat] = feature.geometry.coordinates;
      const {label, kind, at} = feature.properties;
      globeObservations.entities.add({id: feature.id, name: label, position: C.Cartesian3.fromDegrees(lon, lat, 0, ellipsoid),
        point: {pixelSize: 8, color: C.Color.CYAN, outlineColor: C.Color.BLACK, outlineWidth: 1, heightReference: C.HeightReference.CLAMP_TO_GROUND}});
      for (const layer of flatObservations) {
        const text = document.createElement('span');
        text.textContent = `${label} · ${kind} · ${at}`;
        L.circleMarker([lat, lon], {radius: 4, color: '#45e5ec', weight: 2}).bindTooltip(text).addTo(layer);
      }
    }
    viewer.scene.requestRender();
  }

  async function refreshImagery() {
    const revision = ++imageryRevision;
    const response = await fetch('/api/desktop/source-maps');
    if (!response.ok) return;
    const packages = await response.json();
    if (revision !== imageryRevision) return;
    const active = new Set(packages.map(item => item.id));
    for (const [id, layers] of imagery) {
      if (active.has(id)) continue;
      for (const layer of layers.globe) viewer.imageryLayers.remove(layer);
      for (const layer of layers.flat) layer.remove();
      imagery.delete(id);
    }
    for (const item of packages) {
      if (imagery.has(item.id)) continue;
      const url = `/api/desktop/source-imagery?id=${encodeURIComponent(item.id)}&z={z}&y={y}&x={x}`;
      const globe = [], flat = [];
      for (const [w, s, e, n] of item.bounds) {
        const provider = planetImageryProvider(C, {url, rectangle: C.Rectangle.fromDegrees(w, s, e, n),
          tilingScheme: new C.GeographicTilingScheme({ellipsoid}), tileWidth: item.tilePixels, tileHeight: item.tilePixels,
          maximumLevel: item.level, credit: item.credit}, {source: item.productName, nativeMeters: item.metresPerPixel,
          sharedImages: true, onReady: imageryReady});
        globe.push(viewer.imageryLayers.addImageryProvider(provider));
        for (const view of [map, mini]) flat.push(new CTXLayer({url, tilePixels: item.tilePixels,
          bounds: [[s, w], [n, e]], maxNativeZoom: item.level, maxZoom: 23, attribution: item.credit,
          source: item.productName, nativeMeters: item.metresPerPixel, polarOverview: false, maskEdges: false,
          bootstrapOverview: false, keepBuffer: 1}).addTo(view));
      }
      imagery.set(item.id, {globe, flat, item});
    }
    const ordered=[...imagery.values()].sort((a,b)=>b.item.metresPerPixel-a.item.metresPerPixel);
    for(const layers of ordered){
      for(const layer of layers.globe)viewer.imageryLayers.raiseToTop(layer);
      for(const layer of layers.flat)layer.bringToFront();
    }
    viewer.scene.requestRender();
  }

  const run = task => void task().catch(error => console.warn('Local map layer unavailable', error.message));
  window.marsDesktop.onObservationsChanged(() => run(refreshObservations));
  window.marsDesktop.onMapsChanged(() => run(refreshImagery));
  run(refreshObservations);
  run(refreshImagery);
  return {
    qualityAt(point, flatView) {
      const [lon, lat] = point;
      for (const {globe, flat, item} of [...imagery.values()].reverse().sort((a,b)=>a.item.metresPerPixel-b.item.metresPerPixel)) {
        if (!item.bounds.some(([w,s,e,n]) => lon >= w && lon <= e && lat >= s && lat <= n)) continue;
        const layers = flatView ? flat.filter((_, index) => index % 2 === 0) : globe.map(layer => layer.imageryProvider);
        for (const layer of layers) {
          const quality = layer.qualityAt(lon, lat);
          if (quality) return {...quality, appearance: item.appearance};
        }
      }
      return null;
    },
  };
}

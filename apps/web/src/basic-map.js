import L from 'leaflet';
import {R} from './raster.js';
import {BASE_URL,BASE_CREDIT,CTX_URL,CTX_CREDIT} from './planet.js';
import {CTXLayer,GrayscaleBaseLayer} from './context-imagery.js';
import {coordinateText} from './surface-readout.js';
import {basicDestinations,basicSelection} from './basic-map-data.js';
import {appendSpacecraftHistory} from './spacecraft-history.js';
import {mapPinSVG,PIN_SIZE,PIN_ANCHOR} from './map-marker-style.js';
import {recoveryURL} from './graphics-startup.js';

export async function openBasicMap(){
 document.dispatchEvent(new Event('atlas-startup-error'));
 document.body.classList.remove('graphics-startup-failed','split','moon-view');document.body.classList.add('graphics-basic','two-d');
 const host=document.getElementById('map2d');host.hidden=false;
 const crs=L.extend({},L.CRS.EPSG4326,{distance(a,b){const r=Math.PI/180,h=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}});
 const map=L.map(host,{crs,maxZoom:23,zoomSnap:0}).setView([0,0],1);L.control.scale({imperial:false,maxWidth:130}).addTo(map);
 const toolbar=document.createElement('section');toolbar.className='graphics-basic-toolbar';toolbar.setAttribute('aria-label','Basic 2D map');toolbar.innerHTML='<div><strong>Basic 2D map</strong><p>Surface imagery, places and spacecraft pins. Retry 3D to open the full workspace.</p></div><label>Jump to a place<select id="basic-place"><option value="">Choose a place or spacecraft…</option></select></label><a id="basic-retry">Retry 3D</a>';
 toolbar.querySelector('a').href=recoveryURL(location.href);document.getElementById('workspace').append(toolbar);
 const readout=document.createElement('section');readout.className='graphics-basic-readout';readout.setAttribute('aria-label','Basic map coordinates and imagery');readout.innerHTML='<span id="basic-centre"></span><span id="basic-cursor">Move over the map for coordinates</span><span id="basic-quality">Loading imagery…</span>';document.getElementById('workspace').append(readout);
 const layers=[new GrayscaleBaseLayer({url:BASE_URL,maxNativeZoom:0,maxZoom:23,noWrap:false,attribution:BASE_CREDIT,keepBuffer:0}),new GrayscaleBaseLayer({url:BASE_URL,maxNativeZoom:7,maxZoom:23,noWrap:false,attribution:BASE_CREDIT,keepBuffer:1}),new CTXLayer({url:CTX_URL,opticalGaps:{base:BASE_URL,primary:CTX_URL},maxNativeZoom:12,maxZoom:23,noWrap:false,attribution:CTX_CREDIT,keepBuffer:1})];
 const update=()=>{const c=map.getCenter(),lon=((c.lng+180)%360+360)%360-180;document.getElementById('basic-centre').textContent='Centre · '+coordinateText([lon,c.lat]);const q=layers.map(l=>l.qualityAt(lon,c.lat)).filter(Boolean).sort((a,b)=>a.metres-b.metres)[0];document.getElementById('basic-quality').textContent=q?`Loaded ${q.source} · ≈${q.metres.toLocaleString(undefined,{maximumFractionDigits:1})} m / px`:'Loading imagery at the view centre…';};
 for(const layer of layers){layer.on('tileload',update);layer.addTo(map);}
 map.on('moveend zoomend',update);map.on('mousemove click',e=>{document.getElementById('basic-cursor').textContent='Cursor · '+coordinateText([e.latlng.lng,e.latlng.lat]);});
 const crosshair=document.createElement('div');crosshair.className='ui-centre-crosshair';crosshair.setAttribute('aria-hidden','true');crosshair.innerHTML='<svg viewBox="0 0 24 24" fill="none"><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="3"/></svg>';host.append(crosshair);
 document.getElementById('home').onclick=()=>map.setView([0,0],1);
 const [places,craft]=await Promise.allSettled(['/regions.json','/spacecraft/catalog.json'].map(async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Place catalogue unavailable');return r.json();}));
 const destinations=basicDestinations(places.status==='fulfilled'?places.value:[],craft.status==='fulfilled'?craft.value?.objects:[]),select=document.getElementById('basic-place');
 for(const d of destinations){const option=document.createElement('option');option.value=d.id;option.textContent=d.name;select.append(option);if(d.item){const popup=document.createElement('div'),title=document.createElement('strong');title.textContent=d.name;popup.append(title);appendSpacecraftHistory(popup,d.item);L.marker([d.point[1],d.point[0]],{title:d.name,icon:L.icon({iconUrl:mapPinSVG(d.item.kind),iconSize:PIN_SIZE,iconAnchor:PIN_ANCHOR})}).addTo(map).bindPopup(popup,{maxHeight:350,maxWidth:300});}}
 const visit=d=>{if(Array.isArray(d.bounds)&&d.bounds.length===4&&d.bounds.every(Number.isFinite)&&d.bounds[0]<d.bounds[2]&&d.bounds[1]<d.bounds[3])map.fitBounds([[d.bounds[1],d.bounds[0]],[d.bounds[3],d.bounds[2]]],{padding:[40,40]});else map.setView([d.point[1],d.point[0]],d.zoom??13);};
 select.onchange=()=>{const d=destinations.find(d=>d.id===select.value);if(d)visit(d);};const selected=basicSelection(location.hash,destinations);if(selected){select.value=selected.id??'';visit(selected);}update();
 if(!destinations.length){const note=document.createElement('p');note.textContent='Place lists are temporarily unavailable. You can still pan and zoom the map.';toolbar.append(note);}
 return map;
}

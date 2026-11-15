import L from 'leaflet';
import {windImage} from './wind-image.js';
import {sampleWind,windStatus} from './wind-data.js';
import {windColor} from './wind-flow-field.js';
import {createWindFlows} from './wind-flow.js';
const $=id=>document.getElementById(id),el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;},utc=value=>new Date(value).toISOString().replace('T',' ').replace('.000Z',' UTC');
const FlatWind=L.GridLayer.extend({createTile(coords,done){const image=this.options.image(coords.x,coords.y,coords.z),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);queueMicrotask(()=>done(null,canvas));return canvas;}});
export class WindLayer{
 constructor(viewer,map,mini){
  this.viewer=viewer;this.maps=[map,mini];this.opacity=.55;this.animate=true;this.unit='km/h';this.generation=0;
  const controls=$('wind-controls');this.status=el('p');this.status.setAttribute('role','status');this.details=el('p');this.readout=el('output');this.readout.id='wind-centre-value';
  const unitLabel=el('label','Speed units');this.unitSelect=el('select');this.unitSelect.setAttribute('aria-label','Wind speed units');for(const value of ['km/h','m/s']){const o=el('option',value);o.value=value;this.unitSelect.append(o);}unitLabel.append(this.unitSelect);
  const flowLabel=el('label','Animated wind trails');this.motionInput=el('input');this.motionInput.type='checkbox';this.motionInput.checked=true;this.motionInput.setAttribute('aria-label','Animate wind trails');flowLabel.className='wind-arrow-option';flowLabel.append(this.motionInput);
  const motionNote=el('small','White trails follow the modeled air flow. Motion is accelerated for visibility, not physical travel time. Reduced-motion settings show still trails.');
  this.refreshButton=el('button','Check model update');this.saveButton=el('button','Save wind data');const actions=el('div');actions.className='weather-actions';actions.append(this.refreshButton,this.saveButton);controls.append(this.status,this.details,this.readout,unitLabel,flowLabel,motionNote,actions);
  this.unitSelect.onchange=()=>{this.unit=this.unitSelect.value;this.legend();this.updateReadout();};this.motionInput.onchange=()=>{this.animate=this.motionInput.checked;this.flows?.forEach(flow=>flow.setEnabled(this.active&&this.animate));};this.refreshButton.onclick=()=>this.refresh();this.saveButton.onclick=()=>this.save();
  viewer.imageryLayers.layerAdded.addEventListener(()=>{if(this.layer)viewer.imageryLayers.raiseToTop(this.layer);});
  this.timer=setInterval(()=>{if(this.active&&!document.hidden){this.legend();if(Date.now()-(this.lastCheck??0)>300000)this.refresh();}},60000);this.timer.unref?.();
 }
 setActive(item){if(item?.id===this.active?.id)return;this.active=item;this.generation++;$('wind-controls').hidden=!item;$('wind-legend').hidden=!item;if(!item){this.controller?.abort();this.clear();return;}this.status.textContent='Loading NASA wind model…';this.refresh();}
 clear(){if(this.layer)this.viewer.imageryLayers.remove(this.layer,true);this.layer=null;this.flat?.forEach(l=>l.remove());this.flat=null;this.flows?.forEach(flow=>flow.setEnabled(false));this.viewer.scene.requestRender();}
 async refresh(){
  if(!this.active||this.loading)return;this.loading=true;this.refreshButton.disabled=true;this.saveButton.disabled=true;const generation=this.generation;this.controller=new AbortController();const timeout=setTimeout(()=>this.controller.abort(),45000);
  try{const response=await fetch('/api/wind',{signal:this.controller.signal}),packet=await response.json();if(generation!==this.generation)return;
   if(!response.ok||packet.schema!=='mars-wind/1'||packet.health?.state==='unavailable'||!Array.isArray(packet.east))throw Error('NASA wind model unavailable');
   const changed=!this.packet||this.packet.model_time!==packet.model_time||this.packet.provenance.at(-1)?.sha256!==packet.provenance.at(-1)?.sha256;this.packet=packet;this.clientFailure=false;this.lastCheck=Date.now();if(changed||!this.layer)this.draw();this.legend();this.updateReadout();
  }catch{if(generation===this.generation){this.clientFailure=true;this.lastCheck=Date.now();if(this.packet){if(!this.layer)this.draw();this.legend();}else{this.status.textContent='NASA wind model unavailable. No wind coverage is assumed.';$('wind-legend-title').textContent='Wind speed · source unavailable';$('wind-legend-note').textContent='No live observations or zero-wind values are substituted.';}}}
  finally{clearTimeout(timeout);this.loading=false;if(generation===this.generation){this.refreshButton.disabled=false;this.saveButton.disabled=!this.packet;}else if(this.active)this.refresh();}
 }
 draw(){
  if(!this.active||!this.packet)return;this.clear();const C=window.Cesium,scheme=new C.GeographicTilingScheme({ellipsoid:this.viewer.scene.globe.ellipsoid}),cache=new Map(),grid=this.packet;
  const image=(x,y,z)=>{const key=`${z}/${y}/${x}`;if(cache.has(key))return cache.get(key);const c=windImage(grid,x,y,z);cache.set(key,c);if(cache.size>64)cache.delete(cache.keys().next().value);return c;};
  const provider={tilingScheme:scheme,rectangle:scheme.rectangle,tileWidth:256,tileHeight:256,minimumLevel:0,maximumLevel:2,hasAlphaChannel:true,errorEvent:new C.Event(),credit:new C.Credit('NASA GSFC Mars Explorer · EMARS modeled climatology'),getTileCredits(){},pickFeatures(){},async requestImage(x,y,z){return image(x,y,z);}};
  this.layer=new C.ImageryLayer(provider,{alpha:this.opacity});this.viewer.imageryLayers.add(this.layer);this.flat=this.maps.map(map=>{const pane=map.getPane('wind')??map.createPane('wind');pane.style.zIndex='354';pane.style.pointerEvents='none';return new FlatWind({pane:'wind',image,tileSize:256,maxNativeZoom:2,maxZoom:23,opacity:this.opacity,keepBuffer:0,noWrap:false,attribution:provider.credit.html}).addTo(map);});
  this.flows??=createWindFlows(this.viewer,this.maps);this.flows.forEach(flow=>{flow.setData(grid);flow.setOpacity(this.opacity);flow.setEnabled(this.animate);});this.viewer.scene.requestRender();
 }
 setOpacity(value){this.opacity=Math.max(0,Math.min(1,value));if(this.layer)this.layer.alpha=this.opacity;this.flat?.forEach(l=>l.setOpacity(this.opacity));this.flows?.forEach(flow=>flow.setOpacity(this.opacity));this.viewer.scene.requestRender();}
 legend(){
  if(!this.active||!this.packet)return;const p=this.packet,mult=this.unit==='km/h'?3.6:1,health=this.clientFailure?'Update request failed · previous model retained':windStatus(p);this.status.textContent=health+' · not live weather measurements';this.details.textContent=`Model time: ${utc(p.model_time)}. Source: ${p.model_label}. Retrieved: ${utc(p.retrieved_at)}. ${p.spatial_support} Height is not supplied by the source.`;
  $('wind-legend-title').textContent='Wind speed · EMARS climatology';$('wind-legend-units').textContent=this.unit+' · flowing trails point downwind';$('wind-legend-low').textContent='0';$('wind-legend-high').textContent=(100/3.6*mult).toFixed(this.unit==='km/h'?0:1)+'+';
  $('wind-legend-ramp').style.background=`linear-gradient(to right,${Array.from({length:11},(_,i)=>{const t=i/10;return `rgb(${windColor(t*100/3.6).slice(0,3).join(',')}) ${t*100}%`;}).join(',')})`;
  $('wind-legend-note').textContent=`${p.model_label} · model time ${utc(p.model_time)} · ${health}. Historical climate analogue, not a current measured weather field. Coverage: ${p.latitude_bounds?.[0]}° to ${p.latitude_bounds?.[1]}°; polar caps outside this range are unknown.`;
 }
 updateLocation(point){this.point=point;this.updateReadout();}
 updateReadout(){
  if(!this.active||!this.packet)return;const point=this.point,value=point?sampleWind(this.packet,...point):null;
  const text=value?`View centre: ${(value.speed*(this.unit==='km/h'?3.6:1)).toFixed(1)} ${this.unit}${value.bearing_to===null?' · calm; no flow bearing':' · flow toward '+value.bearing_to.toFixed(0)+'° from north'}`:point?'No model grid at this latitude; polar caps outside the source coordinates stay uncolored.':'Point the view centre at the surface for a wind readout.';
  this.readout.textContent=text;$('wind-legend-value').textContent=text;
 }
 save(){if(!this.packet)return;const url=URL.createObjectURL(new Blob([JSON.stringify(this.packet,null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download='mars-emars-wind-'+this.packet.model_time.slice(0,13).replace('T','-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}

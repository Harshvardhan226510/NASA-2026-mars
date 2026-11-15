import L from 'leaflet';
import {FEEDS,observationState,forecastState} from './space-weather-contracts.js';
import {seriesPath,number,date,age} from './space-weather-view.js';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
const svgEl=tag=>document.createElementNS('http://www.w3.org/2000/svg',tag);
export class SpaceWeatherLayer{
 constructor(viewer,map,mini){
  this.viewer=viewer;this.maps=[map,mini];this.version=0;this.days=7;this.cache=new Map();this.onVisibility=()=>{if(!document.hidden&&this.item)this.refresh();};document.addEventListener('visibilitychange',this.onVisibility);
  this.root=$('space-weather-controls');this.root.replaceChildren();
  const historyLabel=el('label','History window');this.history=el('select');this.history.setAttribute('aria-label','Observation history window');for(const days of [3,7,30]){const option=el('option',days+' days');option.value=String(days);this.history.append(option);}this.history.value='7';historyLabel.append(this.history);this.historyLabel=historyLabel;
  const channelLabel=el('label','Detector / channel');this.channel=el('select');this.channel.setAttribute('aria-label','Detector or particle channel');channelLabel.append(this.channel);this.channelLabel=channelLabel;
  const controls=el('div',undefined,'weather-actions');this.refreshButton=el('button','Check for updates');this.saveButton=el('button','Save source data');controls.append(this.refreshButton,this.saveButton);
  this.state=el('p',undefined,'weather-state');this.state.setAttribute('role','status');this.value=el('strong',undefined,'weather-value');this.metadata=el('dl',undefined,'weather-metadata');
  this.chartWrap=el('figure',undefined,'weather-chart');this.chart=svgEl('svg');this.chart.setAttribute('viewBox','0 0 300 120');this.chart.setAttribute('role','img');this.caption=el('figcaption');this.chartWrap.append(this.chart,this.caption);
  this.entries=el('div',undefined,'weather-entries');this.focus=el('button','Show Gale reference location');this.focus.onclick=()=>this.focusGale();
  this.root.append(this.state,this.value,this.metadata,historyLabel,channelLabel,this.chartWrap,this.entries,this.focus,controls);
  this.history.onchange=()=>{this.days=Number(this.history.value);this.refresh(true);};this.channel.onchange=()=>{this.selectedChannel=this.channel.value;this.renderData();};this.refreshButton.onclick=()=>this.refresh(true);this.saveButton.onclick=()=>this.save();
  this.hud=$('space-weather-hud');this.timer=setInterval(()=>{if(this.item&&!document.hidden){this.renderState();const ttl=FEEDS[this.item.feed].ttl*1000;if(Date.now()-(this.lastCheck??0)>ttl)this.refresh();}},60000);this.timer.unref?.();
 }
 setActive(item){
  if(this.item?.id===item?.id)return;this.version++;this.abort?.abort();this.item=item;this.packet=null;this.selectedChannel=null;this.root.hidden=!item;this.hud.hidden=!item;this.showMarker(false);
  if(!item)return;this.historyLabel.hidden=!['rad','mex'].includes(item.feed);this.focus.hidden=item.feed!=='rad';this.entries.replaceChildren();this.chartWrap.hidden=true;this.metadata.replaceChildren();this.value.textContent='';this.state.textContent='Loading source data…';this.hud.replaceChildren(el('strong',item.name),el('small','Loading source data…'));this.refresh();
 }
 async refresh(force=false){
  if(!this.item||this.loading)return;const version=this.version,item=this.item,key=item.feed+':'+this.days;
  const previous=this.cache.get(key);if(!force&&previous&&Date.now()-previous.checked<FEEDS[item.feed].ttl*1000){this.packet=previous.packet;this.lastCheck=previous.checked;this.renderData();return;}
  this.loading=true;this.refreshButton.disabled=true;this.saveButton.disabled=true;this.abort=new AbortController();let timeout=setTimeout(()=>this.abort.abort(),65000);
  try{const response=await fetch('/api/space-weather?'+new URLSearchParams({feed:item.feed,days:String(this.days)}),{signal:this.abort.signal});const packet=await response.json();if(version!==this.version)return;
   if(!response.ok||packet.schema!=='mars-space-weather/1'||packet.feed!==item.feed||packet.health?.state==='unavailable')throw Error('Source unavailable');
   this.packet=packet;this.lastCheck=Date.now();this.cache.set(key,{packet,checked:this.lastCheck});this.clientFailure=false;this.renderData();
  }catch{if(version!==this.version)return;this.clientFailure=true;if(!this.packet&&previous)this.packet=previous.packet;if(this.packet)this.renderData();else{this.state.textContent='Source unavailable. Coverage remains unknown; try again later.';this.hud.replaceChildren(el('strong',item.name),el('small','Source unavailable · no coverage assumed'));}}
  finally{clearTimeout(timeout);this.loading=false;if(version===this.version){this.refreshButton.disabled=false;this.saveButton.disabled=!this.packet;}else if(this.item)this.refresh();}
 }
 detail(name,value){this.metadata.append(el('dt',name),el('dd',value));}
 renderState(){
  if(!this.item||!this.packet)return;const p=this.packet;let status;
  if(p.feed==='ipath'){const run=p.runs?.[0];status=run?forecastState(run.channels[0])+' · experimental forecast':'No validated Mars prediction';}
  else if(p.feed==='donki'){const current=p.events?.filter(e=>Date.parse(e.predicted_arrival)>Date.now()).length??0;status=current?current+' future arrival estimate'+(current===1?'':'s'):'No future Mars arrivals listed · not an all-clear';}
  else{const reading=observationState(p.latest_observed_at,Date.now(),p.kind==='earth_context');status=reading.label+' · '+age(reading.age_hours)+' old';}
  const health=this.clientFailure?'Update request failed · showing previous data':p.health.state==='cached_fallback'?'Source refresh failed · '+(p.health.fallback_source??'last good data'):'';
  this.state.textContent=status+(health?'\n'+health:'');this.state.dataset.stale=health||status.includes('Expired')||status.includes('Old')?'true':'false';this.hud.replaceChildren(el('strong',this.item.name),el('small',status),el('small',p.domain));
 }
 renderData(){
  const p=this.packet;if(!p)return;this.metadata.replaceChildren();this.entries.replaceChildren();this.value.textContent='';this.chartWrap.hidden=true;this.channelLabel.hidden=true;this.renderState();
  this.detail('Record type',({measured_quicklook:'Measured quicklook',measured_indicator:'Measured spacecraft indicator',forecast:'Experimental forecast',earth_context:'Earth observation · context'})[p.kind]);this.detail('Coverage',p.domain);this.detail('Retrieved',date(p.retrieved_at));this.detail('Published','Not supplied by the source');
  if(p.latest_observed_at)this.detail('Latest valid observation',date(p.latest_observed_at));this.detail('Spatial support',p.spatial_support);
  if(p.feed==='ipath')this.renderForecast();else if(p.feed==='donki')this.renderArrivals();else this.renderSeries();
  for(const warning of p.warnings??[])this.entries.append(el('p',warning,'weather-warning'));
  const source=el('details'),summary=el('summary','Source records & checksums');source.append(summary);
  for(const raw of p.provenance??[]){const a=el('a','Source response ↗');a.href=raw.url;a.target='_blank';a.rel='noopener';source.append(a,el('small','Retrieved '+date(raw.retrieved_at)+' · SHA-256 '+raw.sha256));}this.entries.append(source);this.showMarker(p.feed==='rad');this.saveButton.disabled=false;
 }
 plot(points,options,caption){
  const data=seriesPath(points,options);this.chart.replaceChildren();this.chartWrap.hidden=false;this.caption.textContent=caption;
  if(!data.path){this.chartWrap.hidden=true;this.entries.append(el('p','No valid samples in this channel. Missing coverage remains unknown.'));return;}
  const line=svgEl('path');line.setAttribute('d',data.path);line.setAttribute('fill','none');line.setAttribute('stroke','#f5b181');line.setAttribute('stroke-width','1.7');this.chart.append(line);this.chart.setAttribute('aria-label',caption+'; range '+number(data.bounds.minY)+' to '+number(data.bounds.maxY));
  const range=el('small','Range '+number(data.bounds.minY)+'–'+number(data.bounds.maxY)+' · '+data.valid_count+' valid samples');this.entries.append(range);
 }
 renderSeries(){
  const p=this.packet,channels=p.channels??[];if(!channels.length){this.entries.append(el('p','No valid channel metadata.'));return;}
  this.channelLabel.hidden=false;const selected=this.selectedChannel??(channels.some(c=>c.id===p.default_channel)?p.default_channel:channels.find(c=>c.id.includes('>=10'))?.id??channels[0].id);this.channel.replaceChildren(...channels.map(c=>{const o=el('option',c.label);o.value=c.id;return o;}));this.channel.value=selected;
  const preferred=this.item.channel,choice=this.selectedChannel??(preferred&&channels.some(c=>c.id===preferred)?preferred:selected);this.channel.value=choice;
  const channel=channels.find(c=>c.id===choice)??channels[0],samples=p.samples??[],latest=[...samples].reverse().find(s=>Number.isFinite(s.values[channel.id]));this.value.textContent=(latest?number(latest.values[channel.id]):'Unknown')+' '+channel.unit;
  if(latest)this.detail('Selected channel sample',date(latest.time)+(latest.satellite?' · GOES-'+latest.satellite:''));
  this.detail('Quantity',channel.label);if(channel.material)this.detail('Detector material',channel.material);if(channel.species)this.detail('Particle population',channel.species);this.detail('Quality',channel.quality);this.detail('Uncertainty','Not supplied by this quicklook feed');
  this.plot(samples.map(s=>({x:Date.parse(s.time),y:s.values[channel.id]??null})),{gap:FEEDS[p.feed].gap*1000},'UTC · '+(samples.length?date(samples[0].time)+' to '+date(samples.at(-1).time):'No history')+' · '+channel.unit+' · gaps are not joined');
  const table=el('details'),summary=el('summary','Recent samples');table.append(summary);const list=el('ol');for(const row of samples.slice(-8))list.append(el('li',date(row.time)+' · '+number(row.values[channel.id])+' '+channel.unit));table.append(list);this.entries.append(table);
  if(p.feed==='solar-flares')for(const event of [...p.events].reverse().slice(0,10)){const card=el('article',undefined,'weather-event');card.append(el('strong',event.classification+' · '+date(event.peak_time)),el('small','Began '+date(event.begin)+' · ended '+date(event.end)),el('small','GOES-'+event.satellite+' · Earth-view solar event'));this.entries.append(card);}
 }
 renderForecast(){
  const p=this.packet,run=p.runs?.[0];if(!run){this.entries.append(el('p','No validated Mars proton predictions.'));return;}
  this.detail('Issued',date(run.issue_time));this.detail('Model',run.model.short_name);this.detail('Target / species','Mars heliospheric observer / protons');
  if(this.item.view==='spectrum'){
   const spectrum=p.spectrum;if(!spectrum||spectrum.run_id!==run.id){this.entries.append(el('p','A matching differential spectrum is unavailable for this run.'));return;}
   this.channelLabel.hidden=false;const now=Date.now(),nearest=spectrum.samples.reduce((best,s)=>Math.abs(Date.parse(s.time)-now)<Math.abs(Date.parse(best.time)-now)?s:best,spectrum.samples[0]);
   const selected=this.selectedChannel??nearest?.time;this.channel.replaceChildren(...spectrum.samples.map(s=>{const o=el('option',date(s.time));o.value=s.time;return o;}));this.channel.value=selected;const sample=spectrum.samples.find(s=>s.time===selected)??nearest;
   if(!sample)return;this.value.textContent='Proton spectrum · '+spectrum.unit;this.detail('Forecast sample time',date(sample.time));this.plot(spectrum.energies.map((energy,i)=>({x:energy,y:sample.values[i]})),{logX:true,logY:true},'Log energy (MeV) / log differential intensity · zero values omitted from log chart');
  }else{this.value.textContent='Predicted integral proton flux';for(const channel of run.channels){const card=el('article',undefined,'weather-event');card.append(el('strong',(channel.energy.max===-1?'≥'+channel.energy.min:channel.energy.min+'–'+channel.energy.max)+' MeV · peak '+number(channel.peak)+' pfu'),el('p',forecastState(channel)),el('small','Window '+date(channel.start)+' → '+date(channel.end)),el('small','Predicted peak '+date(channel.peak_time)));this.entries.append(card);}}
  this.entries.append(el('p','Model threshold results are not EVA clearance. Channels overlap and are not added together. This forecast does not provide surface dose.','weather-warning'));
  const history=el('details'),summary=el('summary','Recent model issues');history.append(summary);for(const previous of p.runs)history.append(el('p',date(previous.issue_time)+' · '+forecastState(previous.channels[0])+' · '+previous.model.short_name));this.entries.append(history);
 }
 renderArrivals(){
  const p=this.packet;this.value.textContent=(p.events?.length??0)+' Mars arrival estimates in the queried history';this.detail('Latest simulation completion',date(p.latest_model_completion));this.detail('Query window','Last 30 days of model runs');
  for(const event of (p.events??[]).slice(0,12)){const card=el('article',undefined,'weather-event');card.append(el('strong',date(event.predicted_arrival)),el('p',Date.parse(event.predicted_arrival)>Date.now()?'Predicted arrival · not an observed event':'Past prediction · arrival not confirmed'),el('small','Run completed '+date(event.model_completion_time)),el('small',event.simulation_id+(event.glancing?' · glancing blow':'')));if(event.link){const link=el('a','View source run ↗');link.href=event.link;link.target='_blank';link.rel='noopener';card.append(link);}this.entries.append(card);}
  if(!p.events?.length)this.entries.append(el('p','No Mars impacts listed in the query. This does not establish quiet conditions.'));
  this.entries.append(el('p','Each card is a model run; revisions of the same CME are not independent events. CME/shock arrival is not SEP onset.','weather-warning'));
 }
 showMarker(show){
  if(!show){if(this.marker)this.marker.show=false;this.flatMarkers?.forEach(m=>m.remove());this.viewer.scene.requestRender();return;}
  if(!this.marker){const C=window.Cesium;this.marker=new C.CustomDataSource('RAD local observation reference');this.marker.entities.add({position:C.Cartesian3.fromDegrees(137.44,-4.59,0,this.viewer.scene.globe.ellipsoid),point:{pixelSize:10,color:C.Color.fromCssColorString('#f5b181'),outlineColor:C.Color.BLACK,outlineWidth:2,heightReference:C.HeightReference.CLAMP_TO_GROUND},label:{text:'RAD · Gale reference',font:'12px sans-serif',fillColor:C.Color.WHITE,outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-22),heightReference:C.HeightReference.CLAMP_TO_GROUND}});this.viewer.dataSources.add(this.marker);this.flatMarkers=this.maps.map(map=>L.circleMarker([-4.59,137.44],{radius:6,color:'#f5b181',fillOpacity:.9}).bindTooltip('RAD · Gale reference; not the rover position at observation time.'));}
  this.marker.show=true;this.flatMarkers.forEach((m,i)=>m.addTo(this.maps[i]));this.viewer.scene.requestRender();
 }
 focusGale(){const C=window.Cesium;this.viewer.camera.flyTo({destination:C.Cartesian3.fromDegrees(137.44,-4.59,220000,this.viewer.scene.globe.ellipsoid),duration:2});for(const map of this.maps)map.setView([-4.59,137.44],7);}
 save(){if(!this.packet)return;const url=URL.createObjectURL(new Blob([JSON.stringify(this.packet,null,2)],{type:'application/json'})),link=el('a');link.href=url;link.download='mars-'+this.packet.feed+'-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}

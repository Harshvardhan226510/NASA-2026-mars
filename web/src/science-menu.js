import {MineralDetections} from './mineral-detections.js';
import {SCIENCE_CATALOG,SCIENCE_GROUPS,VISIBLE_SCIENCE_CATALOG} from './science-catalog.js';
import {ScientificLayer} from './scientific-layer.js';
import {ContourLayer} from './contour-layer.js';
import {overlayExplanation} from './overlay-explanations.js';
import {SpaceWeatherLayer} from './space-weather-layer.js';
import {WindLayer} from './wind-layer.js';
import {EnvironmentLayer} from './environment-layer.js';
import {SourceOverlays} from './source-overlays.js';
import {referenceVariant} from './reference-display.js';
import {EXTRA_VARIANT_LABELS} from './additional-static-overlays.js';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
const variantLabels={'mons-weh':'Global hydrogen · includes both poles (MONS)','ice-0_1':'SWIM · 0–1 m sensing depth','ice-1_5':'SWIM · 1–5 m sensing depth','ice-5':'SWIM · >5 m sensing depth','glass-clay':'TES · glass / sheet silicates (ambiguous)'};
export class ScienceMenu{
 constructor(viewer,map,mini){
  this.viewer=viewer;this.maps=[map,mini];this.raster=new ScientificLayer(viewer,map,mini);this.contours=new ContourLayer(viewer,map,mini);this.dynamic=new SpaceWeatherLayer(viewer,map,mini);this.wind=new WindLayer(viewer,map,mini);this.environment=new EnvironmentLayer(viewer,map,mini,this.raster);this.sources=new SourceOverlays(viewer,map,mini);this.minerals=new MineralDetections(viewer,this.maps);this.rows=new Map();this.preferredRows=new Map();this.render();
  $('science-variant').onchange=()=>{const variant=referenceVariant(this.active,$('science-variant').value);if(variant===null)return;this.explain(this.active,variant);this.raster.setActive(this.active,variant);};$('science-opacity').oninput=()=>{const value=Number($('science-opacity').value)/100;this.raster.setOpacity(value);this.wind.setOpacity(value);this.environment.setOpacity(value);this.sources.setOpacity(value);$('science-opacity-value').value=$('science-opacity').value+'%';};
  $('science-retry').onclick=()=>{ $('science-retry').hidden=true;this.active?.engine==='wind'?this.wind.refresh():this.raster.retry();};$('contour-interval').onchange=()=>{this.contours.interval=Number($('contour-interval').value);this.contours.update();};
 }
 row(item){const row=el('div',undefined,'science-option'+(!item.engine?' science-unavailable':'')),label=el('label'),input=el('input');input.type='checkbox';input.disabled=!item.engine;if(item.engine)input.dataset.mapLayer=item.key;else input.title=item.reason;
  const title=el('span',item.name,'science-option-name'),badge=el('span',item.type==='static'?'Static':'Dynamic','science-type '+item.type);label.append(input,title,badge);row.append(label);
  if(!item.engine){const status=el('small',item.dependencyLabel??'Model / validation needed','science-unavailable-note');row.title=item.reason;row.append(status);}
  else{row.dataset.overlayKey=item.key;const rows=this.rows.get(item.key)??[];rows.push(row);this.rows.set(item.key,rows);input.addEventListener('change',()=>{if(input.checked)this.preferredRows.set(item.key,row);});}return row;
 }
 placeDetails(item,id){
  const node=$(id);for(const rows of this.rows.values())for(const row of rows)if(row.contains(node)){row.classList.remove('science-expanded');const input=row.querySelector('input');input.removeAttribute('aria-controls');input.removeAttribute('aria-expanded');}
  node.hidden=!item;if(!item)return;
  const row=this.preferredRows.get(item.key)??this.rows.get(item.key)?.[0];if(!row)return;row.append(node);row.classList.add('science-expanded');const input=row.querySelector('input');input.setAttribute('aria-controls',id);input.setAttribute('aria-expanded','true');
 }
 explain(item,variant=item?.asset){if(!item)return;const info=overlayExplanation(item,variant);$('science-shows').textContent=info.shows;$('science-reading').textContent=info.reading;$('science-limits').textContent=info.limits;}
 render(){
  const recommended=$('science-recommended'),more=$('science-groups'),weather=$('solar-space-weather');recommended.replaceChildren();more.replaceChildren();weather.replaceChildren();
  for(const item of VISIBLE_SCIENCE_CATALOG.filter(x=>x.recommended))recommended.append(this.row(item));
  for(const group of SCIENCE_GROUPS){if(group.id===8){for(const item of VISIBLE_SCIENCE_CATALOG.filter(x=>x.group===8))weather.append(this.row(item));continue;}const detail=el('details',undefined,'science-category'),summary=el('summary',group.name),list=el('div',undefined,'science-category-list');for(const item of VISIBLE_SCIENCE_CATALOG.filter(x=>x.group===group.id))list.append(this.row(item));detail.append(summary,list);more.append(detail);}
  const count=type=>VISIBLE_SCIENCE_CATALOG.filter(x=>x.type===type&&x.group!==8),available=type=>count(type).filter(x=>x.engine).length;$('science-count').textContent=`${available('static')} of ${count('static').length} static · ${available('dynamic')} of ${count('dynamic').length} dynamic available`;
 }
 apply(state){
  this.contours.setVisible(Boolean(state.contours));this.placeDetails(state.contours?SCIENCE_CATALOG.find(x=>x.engine==='contours'):null,'contour-options');
  const context=SCIENCE_CATALOG.find(x=>x.group===8&&x.engine&&state[x.key]),item=SCIENCE_CATALOG.find(x=>x.group!==8&&x.engine&&x.engine!=='contours'&&state[x.key]);this.placeDetails(context,'solar-weather-selection');if(context){$('solar-weather-title').textContent=context.name;$('solar-weather-description').textContent=context.description;$('solar-weather-coverage').textContent=context.coverage;$('solar-weather-sources').replaceChildren(...context.sources.map(source=>{const a=el('a',source.title+' ↗');a.href=source.url;a.target='_blank';a.rel='noopener';return a;}));$('solar-weather-selection').append($('space-weather-controls'));}else if(item?.engine==='feed')$('science-selection').append($('space-weather-controls'));this.placeDetails(item,'science-selection');this.dynamic.setActive(context??(item?.engine==='feed'?item:null));if(context)this.dynamic.hud.hidden=true;this.wind.setActive(item?.engine==='wind'?item:null);this.environment.setActive(['environment','solar','solar-terrain'].includes(item?.engine)?item:null);this.sources.setActive(['history-dust','history-uv','relay'].includes(item?.engine)?item:null);if(this.active?.id===item?.id)return;this.active=item;
  $('science-selection').hidden=!item;$('science-reference-controls').hidden=!item||!['reference','terrain','geology','wind','environment','solar','solar-terrain','history-dust','relay'].includes(item.engine);$('science-retry').hidden=true;
  if(item){$('science-selected-title').textContent=item.name;$('science-description').textContent=item.description;$('science-coverage').textContent=item.coverage;$('science-source-links').replaceChildren(...item.sources.map(source=>{const a=el('a',source.title+' ↗');a.href=source.url;a.target='_blank';a.rel='noopener';return a;}));$('science-status').textContent='';
   $('science-variant').replaceChildren(...(item.variants??[]).map(id=>{const o=el('option',EXTRA_VARIANT_LABELS[id]??variantLabels[id]??(id.endsWith('-sigma')?'Published statistical uncertainty (1σ)':SCIENCE_CATALOG.find(x=>x.id===id)?.name??id));o.value=id;return o;}));$('science-variant-label').hidden=!item.variants;$('science-variant').hidden=!item.variants;this.explain(item);
  }
  if(item?.engine!=='solar-terrain')this.raster.setActive(item&&['terrain','reference','geology'].includes(item.engine)?item:null);this.hydrated(item?.engine==='points');
 }
 hydrated(show){$('mineral-legend').hidden=!show;return this.minerals.setVisible(show);}
}

import {SCIENCE_CATALOG,SCIENCE_CONTEXT_KEYS,SCIENCE_HEATMAP_KEYS,CONSOLIDATED_OVERLAY_IDS,consolidatedOverlayKey} from './science-catalog.js';
const defaults={regions:true,science:true,minerals:true,resources:true,userSites:true,spacecraft:true,moons:true,boundaries:true,footprints:true,measurements:true,routes:true,graticule:false,...Object.fromEntries(SCIENCE_CATALOG.filter(x=>x.engine).map(x=>[x.key,false]))};
export function restoreLayerSelection(saved){const next={...defaults};for(const key of Object.keys(defaults))if(typeof saved?.[key]==='boolean')next[key]=saved[key];for(const key of CONSOLIDATED_OVERLAY_IDS)if(next[key]){next[key]=false;next[consolidatedOverlayKey(key)]=true;}const context=SCIENCE_CONTEXT_KEYS.find(key=>next[key]);for(const key of SCIENCE_CONTEXT_KEYS)next[key]=key===context;const selected=SCIENCE_HEATMAP_KEYS.find(key=>next[key]);return selected?layerSelection(next,selected,true):next;}
const storageKey='mars-field-atlas-layer-preferences-v2';
const firstView={science:false,minerals:false,resources:false,boundaries:false};
function browserLayerSelection(){
 const saved=JSON.parse(localStorage.getItem(storageKey));
 if(saved)return restoreLayerSelection(saved);
 const legacy=JSON.parse(localStorage.getItem('mars-field-atlas-layers-v1'));
 // Earlier builds seeded footprints off. Enable them once for existing browsers.
 const initial=restoreLayerSelection({...firstView,...legacy,footprints:true});
 try{localStorage.setItem(storageKey,JSON.stringify(initial));}catch{}
 return initial;
}
const $=id=>document.getElementById(id);
export function layerSelection(state,key,show){const next={...state};key=consolidatedOverlayKey(key);for(const old of CONSOLIDATED_OVERLAY_IDS)if(old in next)next[old]=false;if(!(key in defaults))return next;next[key]=show;if(show&&SCIENCE_CONTEXT_KEYS.includes(key))for(const other of SCIENCE_CONTEXT_KEYS)if(other!==key)next[other]=false;if(show&&(SCIENCE_CONTEXT_KEYS.includes(key)||SCIENCE_CATALOG.some(x=>x.key===key&&x.engine==='feed')))for(const item of SCIENCE_CATALOG)if(item.engine==='feed'&&item.key!==key)next[item.key]=false;if(show&&SCIENCE_HEATMAP_KEYS.includes(key))for(const other of SCIENCE_HEATMAP_KEYS)if(other!==key)next[other]=false;return next;}
export function allLayerSelection(state,show){const next={...state};for(const key of Object.keys(defaults))if(![...SCIENCE_HEATMAP_KEYS,...SCIENCE_CONTEXT_KEYS,'contours','graticule'].includes(key)||!show)next[key]=show;return next;}
export function applyLayerVisibility(input,moons,apply){
 // Hiding moons can synchronously leave orbital mode and reapply these layers.
 // Resolve that transition before deciding which surface layers are suppressed.
 moons?.setVisible(input.moons);
 apply(moons?.exploring?Object.fromEntries(Object.entries(input).map(([key,value])=>[key,key==='moons'?value:false])):input);
}

export class LayerControls{
 constructor(onChange){
  this.onChange=onChange;this.state=restoreLayerSelection(firstView);
  try{this.state=browserLayerSelection();}catch{}
  const selected=SCIENCE_HEATMAP_KEYS.find(key=>this.state[key]);if(selected)this.state=layerSelection(this.state,selected,true);
  for(const input of document.querySelectorAll('[data-map-layer]'))input.addEventListener('change',()=>this.set(input.dataset.mapLayer,input.checked));
  $('layers-hide-all').onclick=()=>this.all(false);$('layers-show-all').onclick=()=>this.all(true);
  // The existing observation shortcut controls the same footprint layer.
  $('footprints').addEventListener('change',()=>this.set('footprints',$('footprints').checked));
  this.sync();
 }
 set(key,show){if(!(key in defaults))return;this.state=layerSelection(this.state,key,show);this.changed();}
 all(show){this.state=allLayerSelection(this.state,show);this.changed();}
 restore(saved){this.state=restoreLayerSelection(saved);this.changed();}
 changed(){
  try{localStorage.setItem(storageKey,JSON.stringify(this.state));}catch{}
  this.sync();this.onChange(this.state);
 }
 sync(){
  for(const input of document.querySelectorAll('[data-map-layer]'))input.checked=this.state[input.dataset.mapLayer];
  $('footprints').checked=this.state.footprints;
  for(const key of ['regions','science','minerals','resources','spacecraft'])$(`legend-${key}`).hidden=!this.state[key];
  $('pin-legend').hidden=!['regions','science','minerals','resources','spacecraft'].some(key=>this.state[key]);
 }
}

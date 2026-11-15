import L from 'leaflet';
import {coverageBounds} from './comms-model.js';
import {wrapRouteLongitude} from './route-geometry.js';
import {firstReturnBreach,forecastFromFix,localReturnCell,returnCell,returnFixMargins,returnLimits,returnMargins,routeConsumption,RETURN_STATES} from './return-feasibility.js';

const el=(tag,text,cls)=>{const item=document.createElement(tag);if(text)item.textContent=text;if(cls)item.className=cls;return item;};
const value=(n,unit='')=>Number.isFinite(n)?`${n.toLocaleString(undefined,{maximumFractionDigits:2})}${unit?' '+unit:''}`:'Unknown';
const coordinate=(degrees,positive,negative)=>`${Math.abs(degrees).toFixed(5)}°${degrees<0?negative:positive}`;
const position=p=>`${coordinate(p[1],'N','S')}, ${coordinate(wrapRouteLongitude(p[0]),'E','W')}`;

export class ReturnSafetyPanel{
 constructor(workbench,root){
  this.workbench=workbench;this.host=workbench.host;
  this.summary=el('div',null,'eva-return-summary');
  const legLabel=el('label','Inspect leg');this.leg=el('select');
  this.leg.add(new Option('Outward','outward'));this.leg.add(new Option('Return','return'));legLabel.append(this.leg);
  this.leg.onchange=()=>{this.sample.value=0;this.useFix=false;this.render();};
  const sampleLabel=el('label','Position along leg');this.sample=el('input');
  Object.assign(this.sample,{type:'range',min:0,max:0,value:0,step:1});sampleLabel.append(this.sample);
  this.sample.oninput=()=>{this.useFix=false;this.render(false);};
  this.sample.onchange=()=>this.render();
  this.fixButton=el('button','Use latest position fix');this.fixButton.type='button';
  this.fixButton.onclick=()=>{this.useFix=true;this.leg.value=this.fix.leg;this.render();};
  this.zoom=el('button','Zoom to expedition');this.zoom.type='button';this.zoom.onclick=()=>this.host.fit();
  const mapLabel=el('label','Show return region and boundary','walk-check');this.toggle=el('input');this.toggle.type='checkbox';this.toggle.checked=true;
  this.toggle.onchange=()=>this.draw();mapLabel.prepend(this.toggle);
  this.readout=el('div',null,'eva-return-readout');this.readout.setAttribute('aria-live','polite');
  this.legend=el('p','Green · Within reserves   Amber · Speed dependent   Red · Outside reserves or no modeled path   Gray · Unknown','walk-note');
  const actions=el('div',null,'eva-return-actions');actions.append(this.fixButton,this.zoom);
  root.append(el('h3','Return safety'),this.summary,legLabel,sampleLabel,actions,mapLabel,this.legend,this.readout,
   el('p','The shaded region shows which cells could return with the resources remaining at the selected position. Each cell uses its minimum-energy terrain path to the return point. Day and night travel speeds bracket the estimate. Limits apply within the loaded terrain window.','walk-note'));

  this.mapLayers=workbench.maps.map(map=>{
   const pane=map.getPane('returnSafety')??map.createPane('returnSafety');pane.style.zIndex='396';pane.style.pointerEvents='none';
   map.on('moveend',()=>this.syncWorldCopies());
   return L.layerGroup().addTo(map);
  });
  const C=window.Cesium;this.source=new C.CustomDataSource('EVA return safety');this.host.viewer.dataSources.add(this.source);
 }
 setFix(fix,leg,actual){
  this.fix={...fix,leg,actual};this.useFix=true;this.leg.value=leg;
  this.render();
  this.workbench.renderSafety();
 }
 clearFix(){this.fix=null;this.useFix=false;}
 reset(){this.clearFix();this.leg.value='outward';this.sample.value=0;}
 preview(leg,point,distance){
  const w=this.workbench;if(!w.state.config.round_trip||!w.returnField||w.pendingReports)return null;
  const spent=routeConsumption(w.budget?.progress[leg],distance);
  return returnMargins(returnCell(w.returnField,point),w.state.config,spent,returnLimits(w.state.config,w.state.crew??[],spent));
 }
 currentFix(){
  const w=this.workbench;if(!this.fix||!w.state.config.round_trip)return null;
  const {position:point,actual,distance:distance_m,offRoute,leg,accuracy}=this.fix;
  const spent=actual??(offRoute?null:routeConsumption(w.budget?.progress[leg],distance_m));
  const limits=returnLimits(w.state.config,w.state.crew??[],spent),field=w.pendingReports?null:w.returnField;
  return {point,distance_m,spent,...returnFixMargins(field,point,accuracy,w.state.config,spent,limits)};
 }
 current(){
  const w=this.workbench,leg=this.leg.value,samples=w.returns?.[leg]??[];
  if(this.useFix&&this.fix){
   const sample=this.currentFix();
   return {spent:sample?.spent,sample,accuracy:this.fix.accuracy,actual:this.fix.actual};
  }
  const sample=samples[Number(this.sample.value)]??samples[0];
  return {sample,spent:sample?.spent};
 }
 render(updateMap=true){
  const w=this.workbench,field=w.returnField,data=w.returns??{outward:[],return:[]};
  if(this.result!==this.host.result||this.profile!==w.state.profile){this.result=this.host.result;this.profile=w.state.profile;this.reset();}
  const leg=this.leg.value,samples=data[leg];
  this.leg.options[1].disabled=!data.return.length;
  if(leg==='return'&&!samples.length&&!this.useFix){this.leg.value='outward';this.sample.value=0;return this.render(updateMap);}
  this.sample.max=Math.max(0,samples.length-1);this.sample.disabled=!samples.length;this.leg.disabled=!data.outward.length&&!data.return.length;
  this.fixButton.disabled=!this.fix;this.zoom.disabled=!this.host.result;this.toggle.disabled=field?.status!=='ready'||Boolean(w.pendingReports);
  const dataNote=w.pendingReports?'Recalculate to apply changed obstacle reports.'
   :!w.state.config.round_trip?'Enable a round trip in Mission.'
   :field?.status==='blocked'?'The exact return cell is excluded by terrain slope or a reported obstacle. Choose an accessible return point.'
   :field?.status==='unknown'?'Terrain at the chosen return point is unavailable. Choose a measured return point.'
   :field?.status!=='ready'?'Calculate the current round trip to load return costs. Recalculate an imported or restored mission to rebuild this grid.'
   :`${data.outward.length} outward and ${data.return.length} return positions checked at the route profile’s sampling. Terrain grid ${value(field.spacing_m,'m')}.`;
  this.summary.replaceChildren(el('p',dataNote,'walk-note'));
  const {sample,actual,accuracy}=this.current();
  const updated=Boolean(this.useFix&&sample&&actual&&this.fix.leg==='outward'&&!this.fix.offRoute&&data.outward.length);
  const forecast=updated?[sample,...forecastFromFix(data.outward,routeConsumption(w.budget.progress.outward,this.fix.distance),this.fix,w.state.config,w.state.crew??[],field)]:data.outward;
  const breach=this.breach=firstReturnBreach(forecast);
  if(updated)this.summary.append(el('p','The outlook from this fix uses the entered consumption plus scheduled travel and work remaining from here.','walk-note'));
  if(breach)this.summary.append(el('strong',`Point of no return · first modeled ${breach.sample.status==='blocked'?'path failure':'reserve breach'} at ${value(breach.sample.distance_m,'m')} outward.`),
   el('p',breach.lastWithin?`Last evaluated sample within reserves at ${value(breach.lastWithin.distance_m,'m')}. The boundary lies at the route’s sampling precision.`:'No earlier sample in this outlook was confirmed within reserves.','walk-note'));
  else if(forecast.length){
   const uncertain=forecast.filter(s=>s.status!=='within').length;
   this.summary.append(el('p',uncertain?`${uncertain} outward positions have speed-dependent or unknown margins. A point of no return cannot be ruled out there.`:'All sampled outward positions in this outlook are within modeled reserves.'));
  }
  this.readout.replaceChildren();
  if(sample){
   const status=RETURN_STATES[sample.status],title=el('strong',status.label);title.style.color=status.color;this.readout.append(title,
    el('p',`${position(sample.point)} · ${this.useFix?'position fix':'planned position'} · ${value(sample.distance_m,'m')} along ${this.leg.value} leg.`,'walk-note'));
   if(this.useFix)this.readout.append(el('p',`${actual?'Entered consumption':'Projected consumption from the mission schedule'} · reported location uncertainty ±${value(accuracy,'m')}. ${this.fix.offRoute&&!actual?'Enter actual consumption for an off-route fix.':''}`,'walk-note'));
   if(sample.positionUncertain)this.readout.append(el('p','The reported position uncertainty crosses return zones. The figures below apply at the centre of the fix.','walk-note'));
   if(sample.day)this.readout.append(el('p',`${value(sample.distance,'m')} to return · ${value(sample.day.time)}–${value(sample.slow.time,'min')} modeled travel including breaks.`));
   if(sample.margins.length){
    const list=el('dl',null,'eva-return-margins');
    for(const {label,unit,best,worst} of sample.margins)list.append(el('dt',label),el('dd',best===worst?value(best,unit):`${value(worst)} to ${value(best,unit)}`));
    this.readout.append(el('p','Margin above configured reserves','walk-note'),list);
   }
  }
  if(updateMap)this.draw();
 }
 syncWorldCopies(){
  if(!this.bounds)return;
  const [west,south,east,north]=this.bounds;
  for(const [i,map] of this.workbench.maps.entries()){
   const shift=360*Math.round((map.getCenter().lng-(west+east)/2)/360);
   this.images?.[i].setBounds([[south,west+shift],[north,east+shift]]);
   for(const {point,markers} of this.pins??[])markers[i].setLatLng([point[1],point[0]+360*Math.round((map.getCenter().lng-point[0])/360)]);
  }
 }
 clearMap(){
  this.generation=(this.generation??0)+1;
  this.source.entities.removeAll();this.mapLayers.forEach(layer=>layer.clearLayers());this.pins=[];this.images=null;this.bounds=null;
  if(this.imagery)this.host.viewer.imageryLayers.remove(this.imagery);
  this.imagery=null;this.host.viewer.scene.requestRender();
 }
 pin(point,label,color){
  const C=window.Cesium,{viewer}=this.host;
  this.source.entities.add({position:C.Cartesian3.fromDegrees(...point,0,viewer.scene.globe.ellipsoid),
   point:{pixelSize:10,color:C.Color.fromCssColorString(color),outlineColor:C.Color.BLACK,outlineWidth:2,heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Infinity},
   label:{text:label,font:'600 12px sans-serif',showBackground:true,pixelOffset:new C.Cartesian2(0,-18),heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Infinity}});
  const markers=this.mapLayers.map(layer=>L.circleMarker([point[1],point[0]],{radius:5,weight:2,color:'#15232d',fillColor:color,fillOpacity:1,interactive:false}).bindTooltip(label,{permanent:true,direction:'top',offset:[0,-7]}).addTo(layer));
  this.pins.push({point,markers});
 }
 draw(){
  const w=this.workbench,replay=w.tab==='replay'?w.replay?.mapState:null;
  const field=replay?replay.field:w.returnField,config=replay?.config??w.state.config,crew=w.state.crew??[];
  const {sample,spent}=replay?{sample:replay.sample,spent:replay.sample.spent}:this.current(),breach=replay?null:this.breach;
  const visible=!w.root.hidden&&w.visible&&(w.tab==='feasibility'&&this.toggle.checked||replay?.show)&&!w.pendingReports&&Boolean(sample)&&(field?.status==='ready'||Boolean(replay?.obstacle));
  const limits=replay?replay.limits:returnLimits(config,crew,spent);
  const key=visible?JSON.stringify([w.tab,w.host.result?.metadata?.mission_id,field?.status,config,limits,sample.point,spent,breach?.sample.point,replay?.obstacle]):null;
  if(key===this.drawn)return;
  this.drawn=key;this.clearMap();
  if(!visible)return;
  if(breach)this.pin(breach.sample.point,'Point of no return',RETURN_STATES.over.color);
  if(replay?.obstacle)this.pin(replay.obstacle.point,'Simulated blockage',RETURN_STATES.blocked.color);
  if(!breach||breach.sample.point.some((v,i)=>v!==sample.point[i]))this.pin(sample.point,replay?'Rehearsal position':'Inspected position',RETURN_STATES[sample.status].color);
  if(!limits||field?.status!=='ready'){this.bounds=[sample.point[0],0,sample.point[0],0];this.syncWorldCopies();this.host.viewer.scene.requestRender();return;}
  const radius=Math.hypot(field.rows,field.cols)*field.spacing_m/2,bounds=coverageBounds(field.center,radius);
  const [west,south,east,north]=bounds,canvas=document.createElement('canvas'),size=replay?128:256;
  canvas.width=canvas.height=size;
  const context=canvas.getContext('2d'),frame=context.createImageData(size,size),cache=new Map();
  for(let row=0;row<size;row++)for(let col=0;col<size;col++){
   let x,y;
   try{[x,y]=field.projection.forward([west+(east-west)*(col+.5)/size,north-(north-south)*(row+.5)/size]);}catch{continue;}
   const cell=localReturnCell(field,x,y);if(!cell)continue;
   const key=cell.status==='ready'?`${cell.distance}/${cell.energy}`:cell.status;
   let color=cache.get(key);
   if(!color){const status=returnMargins(cell,config,spent,limits).status;color=[...RETURN_STATES[status].rgb,160];cache.set(key,color);}
   frame.data.set(color,4*(row*size+col));
  }
  context.putImageData(frame,0,0);
  this.bounds=bounds;const url=canvas.toDataURL();
  this.images=this.mapLayers.map(layer=>L.imageOverlay(url,[[south,west],[north,east]],{pane:'returnSafety',opacity:.72,interactive:false}).addTo(layer));
  this.syncWorldCopies();
  const {viewer}=this.host,C=window.Cesium,generation=this.generation;
  const full=east-west>=360,rectangle=C.Rectangle.fromDegrees(full?-180:wrapRouteLongitude(west),south,full?180:wrapRouteLongitude(east),north);
  C.SingleTileImageryProvider.fromUrl(url,{rectangle,ellipsoid:viewer.scene.globe.ellipsoid}).then(provider=>{
   if(generation!==this.generation)return;
   this.imagery=new C.ImageryLayer(provider,{alpha:.72});viewer.imageryLayers.add(this.imagery);viewer.scene.requestRender();
  }).catch(()=>{if(generation===this.generation&&this.legend)this.legend.textContent='Return region available on the 2D map and overview. The 3D overlay could not load.';});
 }
}

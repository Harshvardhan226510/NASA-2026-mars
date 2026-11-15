import {routeTerrain} from './route-terrain.js';
import {routeProjection} from './route-geometry.js';
import {destination} from './terrain-metrics.js';
import {coordinateText} from './surface-readout.js';
import {HAZARD_STATES,hazardInspector,routeHazardSegments} from './eva-hazards.js';
import {action,el,field,fmt,sourceLink} from './eva-tools-ui.js';

const priority={blocked:0,unknown:1,caution:2,limited:3,open:4};
export class EvaHazardPanel{
 constructor(workbench,root){
  this.w=workbench;this.host=workbench.host;
  this.roughness=el('input');Object.assign(this.roughness,{type:'number',min:.05,max:50,step:.05,value:.75});
  this.roughness.onchange=()=>{if(this.roughness.reportValidity()){this.cache=null;this.render();this.refreshLocal();}};
  this.leg=el('select');this.leg.add(new Option('Outward','outward'));this.leg.add(new Option('Return','return'));this.leg.onchange=()=>this.render();
  this.segment=el('select');this.segment.onchange=()=>this.selectSegment();
  this.highlight=action('Highlight segment on map',()=>this.selectSegment());
  this.inspection=el('div',null,'eva-field-readout');
  this.status=el('p',null,'walk-note');this.status.setAttribute('role','status');
  this.local=el('section');this.localStatus=el('p',null,'walk-note');
  this.canvas=el('canvas');this.canvas.width=this.canvas.height=260;this.canvas.className='eva-hazard-grid';this.canvas.hidden=true;
  this.canvas.tabIndex=0;this.canvas.setAttribute('aria-label','Local traverse hazards, north up. Use arrow keys to inspect cells.');
  this.canvas.onkeydown=event=>{
   const shift={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
   if(!shift||!this.cells?.length)return;
   event.preventDefault();const [x,y]=this.selectedCell??[15,15];
   this.inspectCell(x+shift[0],y+shift[1]);
  };
  this.canvas.onclick=event=>{
   if(!this.cells?.length)return;
   const rect=this.canvas.getBoundingClientRect(),side=31,column=Math.min(side-1,Math.floor((event.clientX-rect.left)*side/rect.width)),row=Math.min(side-1,Math.floor((event.clientY-rect.top)*side/rect.height));
   this.inspectCell(column,row);
  };
  this.local.append(el('h4','Local terrain at the crosshair'),action('Analyse crosshair area',()=>this.loadLocal()),this.localStatus,this.canvas);
  this.localCell=el('p',null,'walk-note');this.local.append(this.localCell);
  const rock=action('Log a rock or obstacle at crosshair',()=>{
   const point=this.host.centre();if(!point){this.w.message('Move the crosshair onto Mars first.');return;}
   this.w.showTab('log');
   for(const [id,value] of [['kind','obstacle'],['lat',point[1]],['lon',point[0]],['note','']])document.getElementById('walk-log-'+id).value=value;
   document.getElementById('walk-log-note').focus();
  });
  root.append(el('h3','Terrain hazards'),el('p','Classification uses selected planning thresholds. Roughness is the RMS relief after removing local slope. At 2 m sampling or finer, isolated raised relief is flagged for inspection. Field reports identify specific rocks or obstacles.','walk-note'),
   field('Roughness threshold · m',this.roughness),field('Inspect route leg',this.leg),this.status,field('Route segment · highest concern first',this.segment),this.highlight,this.inspection,rock,this.local);
 }
 limits(){return {slope:this.host.result?.metadata?.max_slope_deg??Number(document.getElementById('route-slope').value),roughness:this.roughness.valueAsNumber};}
 results(leg){
  const w=this.w,result=this.host.result,limits=this.limits(),grid=w.resultId===result?.metadata?.mission_id?w.grid:null;
  const reports=this.reports(),key=JSON.stringify([w.state.profile,leg,limits,reports]);
  if(this.cache?.result===result&&this.cache.grid===grid&&this.cache.key===key)return this.cache;
  const inspector=hazardInspector(grid,result?.metadata?.source,limits,reports),route=leg==='return'?result?.return_route:result?.routes[w.state.profile];
  return this.cache={result,grid,key,inspector,segments:routeHazardSegments(route,result?.metadata??{},inspector,limits)};
 }
 render(){
  if(this.w.root.hidden||this.w.tab!=='hazards')return;
  const old=this.segment.value,{segments,inspector,result}=this.results(this.leg.value);
  this.rows=[...segments].sort((a,b)=>priority[a.state]-priority[b.state]||((b.intensity??0)-(a.intensity??0))||b.slope-a.slope);
  this.segment.replaceChildren(...this.rows.map((s,i)=>new Option(`${fmt(s.from,'m')}–${fmt(s.to,'m')} · ${HAZARD_STATES[s.state].label}`,String(i))));
  if(this.rows[Number(old)])this.segment.value=old;
  this.segment.disabled=this.highlight.disabled=!segments.length;
  const source=result?.metadata?.source;
  this.status.textContent=segments.length?`${segments.length} segments · ${source?.label??'Unknown source'} · ≈${fmt(source?.sample_m,'m')} source · ${inspector.fine?'local roughness enabled':'local roughness requires measured data and cells at 30 m or finer'}.`:'Calculate a route to inspect its precise segments.';
  this.selectSegment(false);
 }
 selectSegment(highlight=true){
  const s=this.rows?.[Number(this.segment.value)];this.inspection.replaceChildren();
  if(!s)return;
  const status=HAZARD_STATES[s.state],label=el('strong',status.label);label.style.color=status.color;
  this.inspection.append(label,el('p',`${coordinateText(s.a)} → ${coordinateText(s.b)}`),
   el('p',`Along-route grade ${fmt(s.gradient,'°')} · maximum sampled slope ${fmt(s.slope,'°')} · roughness ${fmt(s.roughness,'m')}.`),
   el('p',`Modeled travel cost ${fmt(s.energy,'kJ')} · ${fmt(s.intensity,'J/m')}. ${s.gap?'Sampling intervals exceed the route grid. ':''}${s.raisedCandidate?'Raised relief candidate. ':''}${s.report?'Obstacle report · '+s.report.note:''}`));
  if(highlight){
   this.host.highlightSample({lon:s.b[0],lat:s.b[1]},status.color);
   this.w.draw();
  }
 }
 selected(){return this.rows?.[Number(this.segment.value)];}
 reports(){return this.w.state.logs.filter(entry=>entry.kind==='obstacle'&&entry.active);}
 async loadLocal(point=this.host.centre()){
  if(!point){this.localStatus.textContent='Move the crosshair onto Mars first.';return;}
  this.controller?.abort();const controller=this.controller=new AbortController();
  this.localGrid=null;this.canvas.hidden=true;this.localCell.textContent='';this.localStatus.textContent='Loading measured terrain…';
  try{
   const points=[point,destination(...point,-140,-140),destination(...point,140,140)];
   const grid=await routeTerrain(points,{catalog:this.host.catalog(),preferred:this.host.dataset(),spacing:1,signal:controller.signal,
    onProgress:message=>{if(!controller.signal.aborted)this.localStatus.textContent=message;}});
   controller.signal.throwIfAborted();this.localGrid=grid;this.localPoint=point;this.refreshLocal();
  }catch(error){if(!controller.signal.aborted)this.localStatus.textContent=error.message;}
 }
 refreshLocal(){
  const grid=this.localGrid;if(!grid)return;
  const inspector=hazardInspector(grid,grid.source,this.limits(),this.reports()),resolution=inspector.spacing;
  this.localStatus.replaceChildren(document.createTextNode(`${coordinateText(this.localPoint)} · ${grid.source.label} · ≈${fmt(resolution,'m')} effective sampling. ${inspector.fine?'Select a cell to inspect. North is up.':'Regional terrain can screen broad slopes. Fine roughness and small obstacles remain unresolved.'}`));
  if(grid.source.url)this.localStatus.append(' ',sourceLink('Terrain source ↗',grid.source.url));
  const side=31,middle=(side-1)/2,size=this.canvas.width/side,context=this.canvas.getContext('2d');
  const step=grid.resolution_meters,window=Math.min((grid.cols-3)*step/2,(grid.rows-3)*step/2,middle*resolution);
  const projection=routeProjection(grid.center),[x,y]=projection.forward(this.localPoint);this.cells=[];
  for(let row=0;row<side;row++)for(let col=0;col<side;col++){
   const point=projection.inverse([x+(col-middle)*window/middle,y+(middle-row)*window/middle]),data=inspector.inspect(point);this.cells.push({point,data});
   context.fillStyle=HAZARD_STATES[data.state].color;context.fillRect(col*size,row*size,size,size);
  }
  this.canvas.hidden=false;
  this.inspectCell(middle,middle,false);
 }
 inspectCell(x,y,highlight=true){
  const col=Math.min(30,Math.max(0,x)),row=Math.min(30,Math.max(0,y)),cell=this.cells[row*31+col];
  this.selectedCell=[col,row];if(cell)this.showCell(cell,highlight);
 }
 showCell({point,data},highlight=true){
  this.localCell.textContent=`${coordinateText(point)} · ${HAZARD_STATES[data.state].label} · slope ${fmt(data.metrics?.slope,'°')} · roughness ${fmt(data.fine?data.metrics?.roughness:null,'m')}.${data.raisedCandidate?' Raised relief candidate. Check the local imagery.':''}${data.report?' '+data.report.note:''}`;
  if(highlight)this.host.highlightSample({lon:point[0],lat:point[1]},HAZARD_STATES[data.state].color);
 }
}

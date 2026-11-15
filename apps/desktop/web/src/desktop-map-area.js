import {areaQualities,selectionShape,splitArea,circleOutline,marsRadiusBetween} from './map-area.js';
import {formatBytes,formatResolution,supportsAppearance} from './map-selection.js';
import {sourceMapEstimate,MAP_SOURCES,sourceCoverage,sourceMeters,sourceStorageRequired} from './source-map-plan.js';
const make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
export function createAreaPicker({getState,onSelect,onPreviewChange,sourceApi,onEnableDownloads,onAppearanceChange,onPlanChange,initialSelection,overviewSources={grayscale:['/globe-overview-0.jpg','/globe-overview-1.jpg'],color:['/color-overview-0.jpg','/color-overview-1.jpg']}}){
 const host=make('section');host.className='map-section map-area-picker';
 const mapView=make('div');mapView.className='map-workspace';
 const map=document.createElementNS('http://www.w3.org/2000/svg','svg');map.classList.add('map-area-map');map.setAttribute('viewBox','0 0 360 180');map.setAttribute('role','img');map.setAttribute('aria-label','Mars overview. Drag to trace a closed lasso. Coordinate fields below provide a keyboard alternative.');
 const ns=map.namespaceURI;
 overviewSources.grayscale.forEach((url,i)=>{const image=document.createElementNS(ns,'image');for(const [key,value] of Object.entries({href:url,x:i*180,y:0,width:180,height:180,preserveAspectRatio:'none'}))image.setAttribute(key,value);map.append(image);});
 const overlay=document.createElementNS(ns,'g');map.append(overlay);
 const mapStatus=make('p');mapStatus.className='map-muted';mapStatus.setAttribute('role','status');
 for(const image of map.querySelectorAll('image'))image.addEventListener('error',()=>{mapStatus.textContent='The bundled overview could not load. You can still enter coordinate bounds below.';});
 const previewLabel=make('label','Selection map appearance'),previewSelect=make('select');previewSelect.id='map-selection-preview-appearance';previewLabel.htmlFor=previewSelect.id;
 for(const [value,name] of [['grayscale','Grayscale'],['color','Color']]){const option=make('option',name);option.value=value;previewSelect.append(option);}
 const previewNote=make('p');previewNote.hidden=true;
 function previewAppearance(){const value=getState().choices.selectionPreviewAppearance??'grayscale';previewSelect.value=value;[...map.querySelectorAll('image')].forEach((image,i)=>image.setAttribute('href',overviewSources[value][i]));previewNote.textContent=value==='color'?'Preview: publisher-colorized Viking overview; not native high-resolution RGB. This does not change your download appearance.':'Preview: bundled grayscale CTX/Viking overview. This does not change your download appearance.';}
 previewSelect.onchange=()=>{onPreviewChange?.(previewSelect.value);previewAppearance();};
 const methodLabel=make('label','Selection method'),methods=make('select');methods.id='map-area-method';methodLabel.htmlFor=methods.id;
 const help=make('p');help.className='map-muted';
 const controls=make('div');controls.className='map-actions';
 const zoom=make('button','Zoom to selected area'),reset=make('button','Reset view');zoom.type=reset.type='button';controls.append(zoom,reset);
 const form=make('form');form.className='map-area-coordinates';const inputs=[];
 for(const [i,label] of ['West longitude','South latitude','East longitude','North latitude'].entries()){
  const field=make('label',label),input=make('input');input.type='number';input.step='any';input.min=i%2===0?'-180':'-90';input.max=i%2===0?'180':'90';input.required=true;field.append(input);form.append(field);inputs.push(input);
 }
 const apply=make('button','Use coordinates');apply.type='submit';form.append(apply);
 const convention=make('p','East-positive degrees. Use negative values for west and south.');convention.className='map-muted';
 const qualityLabel=make('label','Quality for this area'),quality=make('select');quality.id='map-area-quality';qualityLabel.htmlFor=quality.id;
 const result=make('p');result.className='map-muted';result.setAttribute('role','status');
 const add=make('button','Add covering packages to selection');add.type='button';add.disabled=true;
 const remove=make('button','Remove added area');remove.type='button';remove.onclick=()=>{onSelect(null);refresh();};
 const circleForm=make('form');circleForm.className='map-area-coordinates';
 const circleInputs=[];
 for(const [label,min,max,value] of [['Centre longitude',-180,180,0],['Centre latitude',-89.999999,89.999999,0],['Radius (km)',.001,5000,10]]){
  const field=make('label',label),input=make('input');input.type='number';input.step='any';input.min=min;input.max=max;input.value=value;input.required=true;field.append(input);circleForm.append(field);circleInputs.push(input);
 }
 const useCircle=make('button','Use centre and radius');useCircle.type='submit';circleForm.append(useCircle);
 const selected=make('p');selected.className='map-callout';
 const catalogue=make('details');catalogue.className='map-catalogue-area';catalogue.append(make('summary','Use a saved package'),qualityLabel,quality,result,add,selected,remove);
 host.append(methodLabel,methods,form,convention,circleForm,catalogue);
 const mapTools=make('div');mapTools.className='map-preview-controls';mapTools.append(previewLabel,previewSelect,controls);
 mapView.append(mapTools,map,help,mapStatus);
 let polygon=null,circle=null,mode="rectangle";
 let bounds=null,view=[0,0,360,180],drag=null,groups=[];
 let editing=false,disposed=false,progressTimer;
 const direct=make('section'), sourceProduct=make('select'),sourceQuality=make('select');
 const sourceNote=make('p'),sourceProgress=make('p');
 const appearanceLabel=make('label','Download appearance'),appearance=make('select');
 const sourceDownload=make('button','Download map'),sourceCancel=make('button','Cancel download');
 let sourceBusy=false,sourcePlan=null,sourceOptions=[];
 let preferredSource=initialSelection?.sourceId;
 let preferredLevel=initialSelection?.level;
 sourceProduct.id='map-source-product';sourceQuality.id='map-source-resolution';appearance.id='map-source-appearance';
 appearanceLabel.htmlFor=appearance.id;
 sourceDownload.className='map-primary';sourceDownload.dataset.sourceDownload='true';
 sourceDownload.type=sourceCancel.type='button';sourceCancel.hidden=true;
 sourceNote.className='map-callout';sourceNote.setAttribute('role','status');
 sourceProgress.className='map-muted';sourceProgress.setAttribute('role','status');
 if(sourceApi?.downloadSourceMap){
  direct.className='map-source-controls';
  const productLabel=make('label','Map'),resolutionLabel=make('label','Resolution');
  productLabel.htmlFor=sourceProduct.id;resolutionLabel.htmlFor=sourceQuality.id;
  sourceProduct.onchange=()=>{preferredSource=sourceProduct.value;preferredLevel=null;refreshSource();};
  sourceQuality.onchange=()=>{preferredLevel=Number(sourceQuality.value);showSourcePlan();};
  appearance.onchange=()=>{onAppearanceChange?.(appearance.value);refreshSource();};
  sourceCancel.onclick=()=>sourceApi.cancelSourceMap().catch(error=>{sourceProgress.textContent=error.message;});
  sourceDownload.onclick=async()=>{
   if(!sourcePlan||sourceBusy||editing)return;
   if(getState().mode!=='online'){
    try{await onEnableDownloads?.();}catch(error){sourceProgress.textContent=error.message;}
    return;
   }
   const {selection,level,appearance,sourceId}=sourcePlan;
   const product=MAP_SOURCES[sourceId];
   sourceBusy=true;showSourcePlan();
   sourceProgress.textContent='Starting download…';
   progressTimer=setInterval(()=>void sourceApi.sourceMapStatus().then(job=>{
    if(!disposed&&job?.state==='downloading')sourceProgress.textContent=job.completed+' / '+job.total+' tiles · '+formatBytes(job.received);
   }).catch(()=>{}),600);
   try{
    const job=await sourceApi.downloadSourceMap({selection,level,appearance,sourceId});
    if(!disposed)sourceProgress.textContent='Ready offline · '+product.name+' · '+formatBytes(job.received)+(job.missing?' · '+job.missing+' source gaps':'');
   }catch(error){if(!disposed)sourceProgress.textContent=error.message;}
   finally{clearInterval(progressTimer);sourceBusy=false;if(!disposed)showSourcePlan();}
  };
  direct.append(productLabel,sourceProduct,resolutionLabel,sourceQuality,appearanceLabel,appearance,sourceNote,sourceDownload,sourceCancel,sourceProgress);
  host.append(direct);
 }
 function showSourcePlan(){
  const state=getState();
  const unavailable=sourceBusy||state.downloadBusy;
  sourcePlan=sourceOptions.find(plan=>String(plan.level)===sourceQuality.value)??null;
  sourceProduct.disabled=!sourceProduct.options.length||unavailable||editing;
  sourceQuality.disabled=!sourceOptions.length||unavailable||editing;
  appearance.disabled=!sourcePlan||unavailable||editing;
  appearanceLabel.hidden=appearance.hidden=!sourcePlan||appearance.options.length<2;
  methods.disabled=unavailable;
  for(const input of [...form.querySelectorAll('input,button'),...circleForm.querySelectorAll('input,button')])input.disabled=unavailable;
  sourceCancel.hidden=!sourceBusy;
  const required=sourcePlan?sourceStorageRequired(sourcePlan):0;
  const enoughSpace=state.plan?.freeBytes==null||required<=state.plan.freeBytes;
  sourceDownload.disabled=!sourcePlan||unavailable||editing;
  onPlanChange?.(editing?null:sourcePlan);
  sourceDownload.textContent=sourceBusy?'Downloading…':state.mode==='online'?'Download map':'Go online to download';
  if(editing){sourceNote.textContent='Apply the coordinates to update this selection.';return;}
  if(!sourcePlan){
   sourceNote.textContent=bounds?'No downloadable resolution here. Choose another map or a smaller area.':'Draw an area on the map.';
   return;
  }
  const product=MAP_SOURCES[sourcePlan.sourceId];
  sourceNote.textContent='Up to '+formatBytes(sourcePlan.maximumBytes)+' · '+sourcePlan.tileCount+' tiles'+
   (state.plan?.freeBytes==null?'':' · '+formatBytes(state.plan.freeBytes)+' free')+
   (!enoughSpace?' · Storage exceeded':'')+
   (product.sparse?' · Coverage has gaps':'')+

   (state.mode==='online'?'':' · Internet needed');
 }
 function refreshSource(){
  if(!sourceApi?.downloadSourceMap)return;
  const previousProduct=preferredSource??sourceProduct.value;
  const previousLevel=preferredLevel??Number(sourceQuality.value);
  sourceProduct.replaceChildren();sourceQuality.replaceChildren();sourceOptions=[];
  if(!bounds){
   sourceProduct.append(make('option','Select an area first'));
   sourceQuality.append(make('option','Select an area first'));
   showSourcePlan();sourceProduct.disabled=sourceQuality.disabled=true;return;
  }
  const shape=selectionShape({bounds,polygon,circle});
  const whole=bounds.every((value,i)=>value===[-180,-90,180,90][i]);
  const productGroups=new Map();
  for(const [id,product] of Object.entries(MAP_SOURCES)){
   if((whole&&product.group==='HiRISE')||!sourceCoverage(shape,product).length)continue;
   if(!productGroups.has(product.group)){
    const group=make('optgroup');group.label=product.group;productGroups.set(product.group,group);sourceProduct.append(group);
   }
   const option=make('option',product.name);option.value=id;productGroups.get(product.group).append(option);
  }
  if([...sourceProduct.options].some(option=>option.value===previousProduct))sourceProduct.value=previousProduct;
  const sourceId=sourceProduct.value,product=MAP_SOURCES[sourceId];
  if(!product){sourceProduct.append(make('option','No coverage here'));sourceQuality.append(make('option','No coverage here'));showSourcePlan();sourceProduct.disabled=sourceQuality.disabled=true;return;}
  appearance.replaceChildren();
  for(const [value,label] of product.role==='terrain'||product.grayscaleOnly?[['grayscale','Grayscale']]:[['grayscale','Grayscale'],['color','Color']]){
   const option=make('option',label);option.value=value;appearance.append(option);
  }
  appearance.value=product.role==='terrain'||product.grayscaleOnly?'grayscale':getState().choices.imageryAppearance;
  appearanceLabel.hidden=appearance.hidden=appearance.options.length===1;
  for(let level=product.min;level<=product.max;level++){
   let plan;
   try{plan=sourceMapEstimate(shape,level,appearance.value,sourceId);}catch{continue;}
   sourceOptions.push(plan);
   const spacing=sourceMeters(level,sourceId);
   const label=product.role==='terrain'?Math.round(spacing).toLocaleString()+' m grid':formatResolution(spacing);
   const option=make('option',label+' · up to '+formatBytes(plan.maximumBytes));option.value=level;
   sourceQuality.append(option);
  }
  if(previousProduct===sourceId&&sourceOptions.some(plan=>plan.level===previousLevel))sourceQuality.value=String(previousLevel);
  else if(sourceOptions.length){const free=getState().plan?.freeBytes;const fitting=sourceOptions.filter(plan=>free==null||sourceStorageRequired(plan)<=free);sourceQuality.value=String((fitting.at(-1)??sourceOptions[0]).level);}
  else sourceQuality.append(make('option','Choose a smaller area'));
  preferredSource=null;preferredLevel=null;
  showSourcePlan();
 }
 function draw(shape={bounds,polygon,circle}){
  overlay.replaceChildren();
  let outline=shape.polygon;
  if(drag){try{outline=drag.mode==='lasso'?drag.points:dragShape(drag).polygon;}catch{outline=null;}}
  if(outline?.length){const path=document.createElementNS(ns,drag?'polyline':'polygon');for(const [key,value] of Object.entries({points:outline.map(p=>(p[0]+180)+','+(90-p[1])).join(' '),fill:drag?'none':'#efa67844',stroke:'#ffe1ad','stroke-width':2,'vector-effect':'non-scaling-stroke','stroke-linejoin':'round'}))path.setAttribute(key,value);overlay.append(path);return;}
  if(!shape.bounds)return;
  for(const b of splitArea(shape.bounds)){const rect=document.createElementNS(ns,'rect');for(const [key,value] of Object.entries({x:b[0]+180,y:90-b[3],width:b[2]-b[0],height:b[3]-b[1],fill:'#efa67844',stroke:'#ffe1ad','stroke-width':2,'vector-effect':'non-scaling-stroke'}))rect.setAttribute(key,value);overlay.append(rect);}
 }
 function read(){if(inputs.some(input=>input.value.trim()===''))throw Error('Enter all four coordinate bounds.');const b=inputs.map(input=>Number(input.value));splitArea(b);return b;}
 function setShape(value){const shape=selectionShape(value);editing=false;bounds=shape.bounds;polygon=shape.polygon??null;circle=shape.circle??null;if(circle)circleInputs.forEach((input,i)=>input.value=String(i<2?circle.center[i]:Number((circle.radiusMeters/1000).toFixed(3))));inputs.forEach((input,i)=>input.value=String(Number(bounds[i].toFixed(6))));draw();refresh();}
 function setBounds(b){setShape({bounds:b});}
 function point(event){
  const matrix=map.getScreenCTM();
  const local=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
  return [Math.max(0,Math.min(360,local.x)),Math.max(0,Math.min(180,local.y))];
 }
 const geo=event=>{const p=point(event);return [p[0]-180,90-p[1]];};
 function dragShape(d){
  const a=d.start,b=d.end;
  if(d.mode==='circle'){const spec={center:a,radiusMeters:marsRadiusBetween(a,b)};return {circle:spec,polygon:circleOutline(spec)};}
  if(d.mode==='rectangle'){const bounds=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];return {bounds,polygon:[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[2],bounds[3]],[bounds[0],bounds[3]]]};}
  return {polygon:d.points};
 }
 map.addEventListener('pointerdown',event=>{if(event.button!==0||drag||sourceBusy||getState().downloadBusy||!getState().customAreaActive||mode==='coordinates')return;event.preventDefault();const start=geo(event);drag={id:event.pointerId,mode,start,end:start,points:[start],previous:bounds?{bounds:[...bounds],...(polygon?{polygon:polygon.map(p=>[...p])}:{}),...(circle?{circle}: {})}:null};map.setPointerCapture(event.pointerId);editing=true;quality.disabled=true;add.disabled=true;showSourcePlan();});
 map.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const next=geo(event);drag.end=next;if(drag.mode==='lasso'){const last=drag.points.at(-1);if(Math.hypot(next[0]-last[0],next[1]-last[1])<view[2]/350)return;if(drag.points.length>=250)drag.points=drag.points.filter((_,i)=>i%2===0);drag.points.push(next);}draw();});
 const restore=previous=>{editing=false;if(previous)setShape(previous);else{bounds=null;polygon=null;circle=null;draw();refresh();}};
 map.addEventListener('pointerup',event=>{if(!drag||event.pointerId!==drag.id)return;const d=drag;d.end=geo(event);drag=null;map.releasePointerCapture(event.pointerId);if(d.points.length>3&&Math.hypot(d.points[0][0]-d.points.at(-1)[0],d.points[0][1]-d.points.at(-1)[1])<1e-8)d.points.pop();try{const shape=dragShape(d);if(d.mode==='rectangle')delete shape.polygon;setShape(shape);mapStatus.textContent=(d.mode==='circle'?'Circle radius '+(circle.radiusMeters/1000).toFixed(2)+' km':d.mode==='lasso'?'Closed lasso':'Rectangle')+' selected. Choose a quality below.';}catch(error){restore(d.previous);mapStatus.textContent=error.message;}});
 map.addEventListener('pointercancel',event=>{if(drag?.id===event.pointerId){const previous=drag.previous;drag=null;restore(previous);}});
 circleForm.onsubmit=event=>{event.preventDefault();try{if(circleInputs.some(input=>input.value.trim()===''))throw Error('Enter a centre and radius.');setShape({circle:{center:circleInputs.slice(0,2).map(input=>Number(input.value)),radiusMeters:Number(circleInputs[2].value)*1000}});mapStatus.textContent='Circle updated from centre and radius.';}catch(error){mapStatus.textContent=error.message;}};
 circleInputs.forEach(input=>input.addEventListener('input',()=>{editing=true;quality.disabled=true;add.disabled=true;showSourcePlan();}));
 function setMode(next){
  mode=next;methods.value=next;
  form.hidden=convention.hidden=mode!=='coordinates';circleForm.hidden=mode!=='circle';
  help.textContent=!getState().customAreaActive?'Open Custom area to draw a selection.':mode==='circle'?'Drag from the centre to the edge.':mode==='lasso'?'Draw a closed outline.':mode==='rectangle'?'Drag to select a rectangle.':mode==='coordinates'?'Enter coordinates in the sidebar.':'Select an area or a place from the sidebar.';
  map.setAttribute('aria-label','Mars selection map. '+help.textContent);
 }
 for(const [value,label] of [['rectangle','Rectangle'],['circle','Circle'],['lasso','Lasso'],['coordinates','Coordinates']]){
  const option=make('option',label);option.value=value;methods.append(option);
 }

 methods.onchange=()=>{
  setMode(methods.value);sourceProgress.textContent='';
  bounds=null;polygon=circle=null;editing=false;draw();refresh();
 };
 form.onsubmit=event=>{event.preventDefault();try{setBounds(read());mapStatus.textContent='Area updated from coordinates.';}catch(error){mapStatus.textContent=error.message;}};
 inputs.forEach(input=>input.addEventListener('input',()=>{editing=true;quality.disabled=true;add.disabled=true;showSourcePlan();}));
 function frameBounds(bounds){if(bounds[0]>bounds[2]){mapStatus.textContent='This area crosses the longitude boundary. Use Whole Mars to see both parts.';return;}const width=Math.min(360,Math.max(bounds[2]-bounds[0],(bounds[3]-bounds[1])*2)*1.15),height=width/2;view=[Math.max(0,Math.min(360-width,(bounds[0]+bounds[2])/2+180-width/2)),Math.max(0,Math.min(180-height,90-(bounds[1]+bounds[3])/2-height/2)),width,height];map.setAttribute('viewBox',view.join(' '));}
 zoom.onclick=()=>{if(bounds)frameBounds(bounds);};
 reset.onclick=()=>{view=[0,0,360,180];map.setAttribute('viewBox',view.join(' '));};
 function selectionStatus(){
  const {choices}=getState();selected.hidden=!choices.areaSelection;remove.hidden=!choices.areaSelection;
  if(choices.areaSelection)selected.textContent=(choices.areaSelection.circle?'Added circle ('+(choices.areaSelection.circle.radiusMeters/1000).toFixed(2)+' km radius): ':choices.areaSelection.polygon?'Added lasso: ':'Added rectangle / coordinate area: ')+choices.areaSelection.bounds.map(n=>n.toFixed(3)).join(', ')+' · '+formatResolution(choices.areaSelection.resolution)+' · '+choices.areaPackageIds.length+' covering package(s).';
 }
 function details(){
  const group=groups.find(g=>String(g.resolution)===quality.value);
  add.disabled=!group?.complete||quality.disabled;
  result.textContent=group?group.packages.length+' complete package(s) · '+formatBytes(group.bytes)+(group.complete?' · Catalogue footprints cover these bounds.':' · Only partial footprint coverage is available; choose another quality or a smaller area.'):'No package quality is available for these bounds. The bundled base remains usable.';
 }
 function refresh(){
  previewAppearance();selectionStatus();refreshSource();quality.replaceChildren();groups=[];quality.disabled=!bounds;catalogue.hidden=true;
  if(!bounds){result.textContent='Select an area to see available qualities.';return;}
  const state=getState();groups=areaQualities(state.options.filter(o=>supportsAppearance(o,state.choices.imageryAppearance)),state.choices.globalId,{bounds,polygon,circle});
  catalogue.hidden=!groups.some(group=>group.complete);quality.disabled=catalogue.hidden;
  const placeholder=make('option','Choose a quality…');placeholder.value='';quality.append(placeholder);
  for(const group of groups){const option=make('option',formatResolution(group.resolution)+' · '+formatBytes(group.bytes)+(group.complete?'':' · Partial coverage'));option.value=group.resolution;option.disabled=!group.complete;quality.append(option);}
  const saved=state.choices.areaSelection;
  if(saved&&JSON.stringify(saved.bounds)===JSON.stringify(bounds)&&JSON.stringify(saved.polygon??null)===JSON.stringify(polygon))quality.value=String(saved.resolution);
  details();
 }
 quality.onchange=details;
 add.onclick=()=>{const group=groups.find(g=>String(g.resolution)===quality.value);if(!bounds||!group?.complete||quality.disabled)return;onSelect({bounds:[...bounds],...(polygon?{polygon:polygon.map(p=>[...p])}:{}),...(circle?{circle}:{}),resolution:group.resolution});refresh();};
 const saved=initialSelection?.selection??getState().choices.areaSelection;
 setMode(['rectangle','circle','lasso','coordinates'].includes(initialSelection?.mode)?initialSelection.mode:saved?.circle?'circle':saved?.polygon?'lasso':saved?'coordinates':'rectangle');
 if(saved)setShape(saved);else refresh();
 return {
  element:host,mapElement:mapView,refresh,
  plan(){return editing?null:sourcePlan;},
  previewSelection(value){const shape=selectionShape(value);draw(shape);frameBounds(shape.bounds);mapStatus.textContent='';help.textContent='Location preview. Open Custom area to draw.';},
  showSelection(){setMode(mode);draw();if(bounds)frameBounds(bounds);},
  selection(){return {mode,selection:bounds?{bounds,polygon:polygon??undefined,circle:circle??undefined}:null,sourceId:sourceProduct.value,level:Number(sourceQuality.value)};},
  dispose(){disposed=true;clearInterval(progressTimer);},
  selectWholeSource(){setMode('world');setBounds([-180,-90,180,90]);reset.click();sourceProduct.focus({preventScroll:true});}
 };
}

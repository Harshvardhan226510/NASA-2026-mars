import {marsDistance} from './measurement-geometry.js';
import {heading} from './eva-navigation.js';
import {coordinateText} from './surface-readout.js';
import {action,el,field,fmt,sourceLink} from './eva-tools-ui.js';
import './eva-tools.css';

export const ROVER_VIEWS=[
 {id:'jezero-landing',name:'Jezero landing site',rover:'Perseverance',point:[77.45088572,18.44462715],basis:'Initial NASA MMGIS waypoint · rover stationary before first drive',
  instrument:'Navcams',sol:'Sol 2',panorama:true,image:'https://d2pn8kiwq2w21t.cloudfront.net/original_images/jpegPIA24422.jpg',credit:'NASA/JPL-Caltech',
  evidence:'Exposed clasts and uneven ground are visible around the landing site. Inspect the near field before selecting a footpath.',
  source:'https://www.jpl.nasa.gov/images/pia24422-perseverance-navcams-360-degree-panorama/',location:'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json'},
 {id:'bright-angel',name:'Cheyava Falls study area',rover:'Perseverance',point:[77.30513,18.49744],basis:'Approximate Bright Angel study location',
  instrument:'WATSON',sol:'Sol 1212',panorama:false,image:'/eva-evidence/cheyava-falls.webp',credit:'NASA/JPL-Caltech/MSSS',
  evidence:'Close-up of a veined rock face. It documents local texture and offers limited evidence about the surrounding approach.',
  source:'https://science.nasa.gov/resource/perseverance-finds-a-rock-with-leopard-spots/'},
 {id:'gale-boxwork',name:'Mount Sharp boxwork region',rover:'Curiosity',point:[137.38772,-4.79689],basis:'Approximate Mount Sharp study location',
  instrument:'Mastcam',sol:'Sols 4451–4454',panorama:true,image:'/eva-evidence/gale-boxwork.webp',credit:'NASA/JPL-Caltech/MSSS',
  evidence:'Low ridges, hollows and broken ground are visible. The image supports scouting around rough terrain at the survey area.',
  source:'https://www.jpl.nasa.gov/images/pia26559-curiositys-first-360-degree-view-of-boxwork-patterns/',location:'https://science.nasa.gov/mission/msl-curiosity/location-map/'}
];

export function nearbyRoverViews(point){
 return ROVER_VIEWS.map(view=>({...view,distance:point?marsDistance(point,view.point):null})).sort((a,b)=>(a.distance??0)-(b.distance??0));
}

export class RoverGroundView{
 constructor({centre,locate,reports,analyse}){
  Object.assign(this,{centre,locate,reports,analyse});
  const dialog=this.dialog=el('dialog',null,'eva-tool-dialog');
  dialog.setAttribute('aria-label','Rover ground imagery');
  const close=action('Close',()=>dialog.close());close.className='eva-dialog-close';
  this.choose=el('select');this.choose.onchange=()=>this.show();
  this.meta=el('p',null,'eva-muted');
  this.viewport=el('div',null,'eva-panorama');
  this.viewport.tabIndex=0;this.viewport.setAttribute('aria-label','Rover photo. Panoramas can be scrolled left and right.');
  this.viewport.addEventListener('scroll',()=>this.direction());
  this.viewport.onkeydown=event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();this.viewport.scrollBy({left:event.key==='ArrowLeft'?-150:150});}};
  let drag=null;
  this.viewport.onpointerdown=event=>{
   if(event.pointerType==='touch'||!this.view?.panorama)return;
   drag={x:event.clientX,scroll:this.viewport.scrollLeft};this.viewport.setPointerCapture(event.pointerId);
  };
  this.viewport.onpointermove=event=>{if(drag)this.viewport.scrollLeft=drag.scroll-(event.clientX-drag.x);};
  this.viewport.onlostpointercapture=()=>{drag=null;};
  this.image=el('img');this.image.draggable=false;this.image.referrerPolicy='no-referrer';
  this.image.onload=()=>{this.error.textContent='';this.direction();};
  this.image.onerror=()=>{this.error.textContent='The image could not load. Open the NASA source below to view the original.';};
  this.viewport.append(this.image);
  this.error=el('p',null,'eva-muted');this.error.setAttribute('role','status');
  this.bearing=el('output');this.bearing.setAttribute('aria-live','off');
  this.left=action('Look left',()=>this.viewport.scrollBy({left:-220,behavior:'smooth'}));
  this.right=action('Look right',()=>this.viewport.scrollBy({left:220,behavior:'smooth'}));
  this.hazards=el('div');this.sources=el('p',null,'eva-source-links');
  const actions=el('div',null,'eva-tool-actions');
  actions.append(action('Locate on map',()=>{dialog.close();this.locate(this.view.point);}),action('Analyse nearby terrain',()=>{dialog.close();this.analyse(this.view.point);}));
  const directions=el('div',null,'eva-tool-actions');directions.append(this.left,this.bearing,this.right);
  dialog.append(close,el('h2','Rover ground imagery'),field('Mapped rover view',this.choose),this.meta,this.viewport,this.error,directions,actions,this.hazards,this.sources);
  dialog.addEventListener('close',()=>{this.image.removeAttribute('src');});
  document.body.append(dialog);
 }
 open(point=this.centre()){
  this.point=point;this.views=nearbyRoverViews(point);
  this.choose.replaceChildren(...this.views.map(item=>new Option(`${item.rover} · ${item.name}${item.distance===null?'':' · '+fmt(item.distance/1000,'km',2)}`,item.id)));
  if(!this.dialog.open)this.dialog.showModal();
  this.show();
 }
 show(){
  const view=this.view=this.views.find(item=>item.id===this.choose.value);
  const distance=view.distance;
  this.meta.textContent=`${view.instrument} · ${view.sol} · ${coordinateText(view.point)} · ${view.basis}.${distance!==null&&distance>1?` From crosshair ${fmt(distance/1000,'km',2)} · bearing ${fmt(heading(this.point,view.point),'°',0)} true.`:''}`;
  this.viewport.dataset.panorama=String(view.panorama);
  this.image.alt=`${view.rover} ${view.instrument} photograph of ${view.name}`;this.image.src=view.image;
  this.viewport.scrollLeft=0;this.left.hidden=this.right.hidden=!view.panorama;
  this.error.textContent='';this.direction();
  this.hazards.replaceChildren(el('h3','Nearby terrain context'),el('p',view.evidence));
  const reports=this.reports().map(e=>({...e,distance:marsDistance(e.point,view.point)})).filter(e=>e.distance<=1500).sort((a,b)=>a.distance-b.distance);
  const list=el('ul');for(const e of reports)list.append(el('li',`${fmt(e.distance,'m',0)} · ${coordinateText(e.point)} · ${e.note||'Obstacle reported by crew'}`));
  this.hazards.append(reports.length?list:el('p','No active field obstacle reports within 1.5 km of this mapped view.','eva-muted'));
  this.sources.replaceChildren(el('strong',view.credit),sourceLink('NASA image and details ↗',view.source));
  if(view.location)this.sources.append(sourceLink('Location reference ↗',view.location));
 }
 direction(){
  if(!this.view)return;
  if(!this.view.panorama){this.bearing.textContent='Close-up photograph';return;}
  const width=this.image.clientWidth;
  const angle=width?Math.min(359,Math.round((this.viewport.scrollLeft+this.viewport.clientWidth/2)*360/width)):null;
  this.bearing.textContent=angle===null?'360° panorama':`${angle}° relative to image start`;
 }
}

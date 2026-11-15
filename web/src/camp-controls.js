import L from 'leaflet';
import {mapPinSVG,mapLabel,PIN_SIZE,PIN_ANCHOR} from './map-marker-style.js';
import {aboveHorizon} from './value-geometry.js';
import {coordinateText} from './surface-readout.js';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
export class CampControls{
 constructor(host){
  this.host=host;
  const C=window.Cesium;this.source=new C.CustomDataSource('Declared camp');host.viewer.dataSources.add(this.source);this.layers=[host.map,host.mini].map(map=>L.layerGroup().addTo(map));host.viewer.camera.changed.addEventListener(()=>this.visibility());[host.map,host.mini].forEach(map=>map.on('moveend zoomend',()=>this.drawFlat()));
  const head=document.querySelector('#sidebar .ui-drawer-top');
  this.go=node('button');this.go.type='button';this.go.id='explore-go-camp';this.go.className='camp-shortcut';
  this.go.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m3 11 9-8 9 8v10h-6v-7H9v7H3Z"/></svg><span></span>';
  this.goLabel=this.go.querySelector('span');
  this.go.onclick=()=>{if(host.camp())host.visit();};head?.insertBefore(this.go,head.querySelector('button'));
  this.return=node('button','Return to camp');this.return.id='mission-return-camp';this.return.type='button';this.return.className='mission-camp-shortcut';this.return.title='Plan a return route from the current view centre to the declared camp';this.return.onclick=()=>host.returnToCamp();document.getElementById('ui-mission-menu')?.prepend(this.return);
  this.destination=node('button','Use camp as destination');this.destination.id='route-camp-destination';this.destination.type='button';this.destination.onclick=()=>host.destination();document.getElementById('route-centre-goal')?.parentElement.append(this.destination);
  this.summary=node('section');this.summary.className='explore-camp';this.summary.id='explore-camp';this.summary.setAttribute('aria-label','Declared camp');
  this.label=node('strong');this.coords=node('small');const deploy=node('button','Deploy on site');deploy.type='button';deploy.onclick=()=>host.deploy();
  const actions=node('div');actions.className='pyxis-camp-actions';actions.append(deploy);
  if(host.assignPerimeter){const perimeter=node('button','Camp perimeter');perimeter.type='button';perimeter.onclick=()=>host.assignPerimeter(host.camp());actions.append(perimeter);}
  this.summary.append(this.label,this.coords,actions);document.getElementById('region-menu')?.prepend(this.summary);
  document.addEventListener('atlas-mission-change',()=>this.update());this.update();
 }
 update(){
  const camp=this.host.camp();
  this.goLabel.textContent=camp?'Go to camp':'Set up camp';
  this.go.title=camp?'Go to '+camp.name:'Evaluate a base station site to declare camp';
  if(camp)delete this.go.dataset.action;
  else this.go.dataset.action='camp-setup';
  this.return.disabled=this.destination.disabled=!camp;
  this.summary.hidden=!camp;
  if(camp){this.label.textContent=camp.name;this.coords.textContent=`Declared camp · ${coordinateText(camp.point)}`;}
  const signature=JSON.stringify(camp);
  if(signature!==this.signature){this.signature=signature;this.source.entities.removeAll();if(camp){const C=window.Cesium,e=this.source.entities.add({id:'declared-camp',position:C.Cartesian3.fromDegrees(...camp.point,0,this.host.viewer.scene.globe.ellipsoid),billboard:{image:mapPinSVG('camp'),width:PIN_SIZE[0],height:PIN_SIZE[1],verticalOrigin:C.VerticalOrigin.BOTTOM,heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Infinity},label:mapLabel(C,{text:'Camp · '+camp.name,pixelOffset:new C.Cartesian2(0,-45),heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Infinity})});e.campPoint=camp.point;}this.drawFlat();this.host.changed?.();}
  this.visibility();
 }
 visibility(){const camp=this.host.camp(),C=window.Cesium;for(const e of this.source.entities.values){e.show=Boolean(camp&&!this.host.inSpace()&&aboveHorizon(camp.point,this.host.viewer.camera.positionWC));e.label.show=e.show&&C.Cartesian3.distance(this.host.viewer.camera.positionWC,e.position.getValue(C.JulianDate.now()))<150000;}this.host.viewer.scene.requestRender();}
 drawFlat(){const camp=this.host.camp();this.layers.forEach((layer,i)=>{layer.clearLayers();if(!camp)return;const map=[this.host.map,this.host.mini][i],p=[camp.point[1],camp.point[0]+360*Math.round((map.getCenter().lng-camp.point[0])/360)];L.marker(p,{icon:L.icon({iconUrl:mapPinSVG('camp'),iconSize:PIN_SIZE,iconAnchor:PIN_ANCHOR}),title:'Declared camp: '+camp.name,alt:'Declared camp',bubblingMouseEvents:false}).bindTooltip(node('span','Camp · '+camp.name),{direction:'top',offset:[0,-37]}).on('click',event=>{if(!this.host.flatPick({...event,latlng:{lng:camp.point[0],lat:camp.point[1]}}))this.host.visit();}).addTo(layer);});}
}

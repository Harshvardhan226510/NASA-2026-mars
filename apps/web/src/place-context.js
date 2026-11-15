import {pickViewFocus,reticlePoint} from './view-focus.js';
const rad=Math.PI/180,km=3396.19;
export const signedLongitude=lon=>((lon+180)%360+360)%360-180;
export function distanceKm(a,b){const dlat=(b[1]-a[1])*rad,dlon=signedLongitude(b[0]-a[0])*rad,h=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlon/2)**2;return 2*km*Math.asin(Math.min(1,Math.sqrt(h)));}
export function inFeature(point,feature){const [w,s,e,n]=feature.bounds360,lon=((point[0]%360)+360)%360;return point[1]>=s&&point[1]<=n&&(w<=e?lon>=w&&lon<=e:lon>=w||lon<=e);}
export function locatePlace(point,widthKm,features,regions=[]){
 const relevant=features.filter(f=>f.diameterKm>=Math.max(.1,widthKm*.35));
 const containing=relevant.filter(f=>inFeature(point,f)).sort((a,b)=>a.diameterKm-b.diameterKm);
 // Catalogue extents identify context; they are not precise ground polygons.
 const here=containing[0];const study=regions.filter(r=>r.category==='Landing studies').map(r=>({...r,distance:distanceKm(point,r.center)})).sort((a,b)=>a.distance-b.distance)[0];
 if(study&&study.distance<75&&(!here||here.diameterKm>150))return {title:`${study.distance<3?'At':'Near'} ${study.name}`,detail:`${study.distance.toFixed(1)} km from study centre${here?' · '+here.name:''}`};
 const close=features.filter(f=>f.diameterKm>=Math.max(.1,widthKm*.08)&&(!here||f.diameterKm<here.diameterKm/3)).map(f=>({f,d:distanceKm(point,f.center)})).filter(o=>o.d<Math.min(80,o.f.diameterKm*.7)&&widthKm<o.f.diameterKm*7).sort((a,b)=>a.d-b.d)[0];
 if(close&&!inFeature(point,close.f))return {title:`Near ${close.f.name}${close.f.type==='Crater'?' Crater':''}`,detail:`${close.d.toFixed(1)} km from named centre${here?' · '+here.name:''}`};
 if(here)return {title:here.type==='Crater'?`${here.name} Crater`:here.name,detail:`View centre · ${here.type} · USGS/IAU catalogue extent`};
 const nearby=relevant.map(f=>({f,d:distanceKm(point,f.center)})).sort((a,b)=>a.d-b.d)[0];
 if(nearby&&nearby.d<Math.max(30,Math.min(300,widthKm*.7)))return {title:`Near ${nearby.f.name}${nearby.f.type==='Crater'?' Crater':''}`,detail:`${nearby.d.toFixed(1)} km from named centre`};
 return {title:point[1]>75?'North polar region':point[1]<-75?'South polar region':'Martian surface',detail:'No named feature at this view scale'};
}
export function placeRegion(f){const [w,s,e,n]=f.bounds360,lon=f.center[0],span=e-w===360?360:Math.max(.003,(e-w+360)%360),west=lon-signedLongitude(lon-w),east=west+span;return {id:'PLACE_'+f.id,name:f.type==='Crater'?f.name+' Crater':f.name,category:'Named places',center:f.center,bbox:[west,s,east,n===s?s+.003:n],description:`${f.type} · ${f.diameterKm.toLocaleString()} km catalogue diameter. Named-feature extent from the USGS/IAU Gazetteer; fine-image availability is independent of the name.`,archiveUrl:f.source};}
export function coordinateRegion(lon,lat){
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90)return null;
 return {id:'COORDINATES',name:'Coordinate view',category:'Surface explorer',center:[lon,lat],bbox:[lon-.08,Math.max(-90,lat-.08),lon+.08,Math.min(90,lat+.08)],description:'Explore this position in the global photographic mosaic. View-centre names and available fine coverage update as you traverse.',archiveUrl:'https://murray-lab.caltech.edu/CTX/V01/SceneView/MurrayLabCTXmosaic.html'};
}
const coordinateNumber='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const coordinatePair=new RegExp(`^(${coordinateNumber})(?:\\s*,\\s*|\\s+)(${coordinateNumber})$`);
export function parseCoordinateSearch(query){
 const match=query.trim().replaceAll('−','-').match(coordinatePair);
 // Search text is latitude first, while map coordinates are longitude first.
 return match?[Number(match[2]),Number(match[1])]:null;
}
export class PlaceContext{
 constructor(viewer,map,{regions,onEnter,view,onPosition,focus}){this.focus=focus;this.viewer=viewer;this.map=map;this.regions=regions;this.onEnter=onEnter;this.view=view;this.onPosition=onPosition;this.features=[];this.last=0;}
 async load(){const r=await fetch('/mars-gazetteer.json');if(!r.ok)throw new Error('Place-name catalogue is unavailable.');const data=await r.json();this.features=data.features;const $=id=>document.getElementById(id),types=[...new Set(this.features.map(f=>f.type))].sort();for(const type of types){const option=document.createElement('option');option.value=option.textContent=type;$('more-type').append(option);}$('more-search').oninput=()=>this.list();$('more-type').onchange=()=>this.list();$('coordinate-form').onsubmit=e=>{e.preventDefault();const lon=Number($('go-lon').value),lat=Number($('go-lat').value);const point=coordinateRegion(lon,lat);if(point)this.onEnter(point);};this.list();this.viewer.scene.postRender.addEventListener(()=>{if(performance.now()-this.last<250)return;this.last=performance.now();this.update();});this.map.on('moveend zoomend',()=>{if(this.view()==='2d')this.update();});this.update();}
 list(){const $=id=>document.getElementById(id),q=$('more-search').value.trim().toLocaleLowerCase(),type=$('more-type').value,found=this.features.filter(f=>(type==='all'||f.type===type)&&f.name.toLocaleLowerCase().includes(q));$('more-count').textContent=`${found.length.toLocaleString()} of ${this.features.length.toLocaleString()} named places${found.length>100?' · showing first 100; search to narrow':''}`;$('more-list').replaceChildren(...found.slice(0,100).map(f=>{const button=document.createElement('button');button.className='region-row';button.setAttribute('aria-label','Visit '+f.name);const name=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small'),arrow=document.createElement('span');strong.textContent=f.name;small.textContent=f.type+' · '+f.diameterKm.toLocaleString()+' km';name.append(strong,small);arrow.textContent='↗';button.append(name,arrow);button.onclick=()=>this.visit(f);return button;}));}
 visit(f){const match=this.regions().find(r=>r.name.toLowerCase()===f.name.toLowerCase()||(f.name==='Gale'&&r.id==='GALE'));this.onEnter(match??placeRegion(f));}
 position(){if(this.view()==='2d'){const s=reticlePoint(this.map.getContainer()),p=this.map.containerPointToLatLng([s.x,s.y]),b=this.map.getBounds();return {point:[signedLongitude(p.lng),p.lat],width:Math.min(360,Math.abs(b.getEast()-b.getWest()))*rad*km*Math.max(.02,Math.cos(p.lat*rad))};}return this.focus?this.focus():pickViewFocus(this.viewer);}
 update(){const $=id=>document.getElementById(id),p=this.position();if(!p){$('location-name').textContent='Looking above the horizon';$('location-detail').textContent='Pan back to the surface to identify a place';this.onPosition?.(null);return;}const context=locatePlace(p.point,p.width,this.features,this.regions());$('location-name').textContent=context.title;$('location-detail').textContent=context.detail;$('location-context').dataset.longitude=p.point[0].toFixed(5);$('location-context').dataset.latitude=p.point[1].toFixed(5);this.onPosition?.(p);}
}

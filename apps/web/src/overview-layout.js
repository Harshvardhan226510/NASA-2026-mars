import {groundMetresPerPixel,zoomForGroundScale} from './compare.js';

// The walk overview keeps a fixed local scale even when the camera tilts up.
export function walkOverviewTarget(camera,C,map){
 const {longitude,latitude}=camera.positionCartographic;
 const lat=C.Math.toDegrees(latitude),rawLon=C.Math.toDegrees(longitude);
 if(!Number.isFinite(lat)||!Number.isFinite(rawLon))return null;
 const current=map.getCenter(),lon=rawLon+360*Math.round((current.lng-rawLon)/360);
 const zoom=Math.round(zoomForGroundScale(lat,4));
 const unchanged=map.getZoom()===zoom&&map.distance(current,[lat,lon])<groundMetresPerPixel(lat,zoom);
 return {point:[lat,lon],zoom,unchanged};
}

// Leaflet caches a zero/stale size while its overview is hidden. Reveal and
// measure it before positioning tiles and overlays; never pan during resizing.
export function showOverview(map,container){
 container.hidden=false;
 map.invalidateSize({pan:false,animate:false});
}
export function watchOverviewLayout(map,container,{Observer=ResizeObserver}={}){
 let width=0,height=0;
 const observer=new Observer(()=>{
  const node=map.getContainer(),w=node.clientWidth,h=node.clientHeight;
  if(!w||!h){width=0;height=0;return;}
  if(w===width&&h===height)return;
  width=w;height=h;
  const centre=map.getCenter(),zoom=map.getZoom();
  map.invalidateSize({pan:false,animate:false});
  map.setView(centre,zoom,{animate:false,reset:true});
 });
 observer.observe(container);observer.observe(map.getContainer());
 return ()=>observer.disconnect();
}

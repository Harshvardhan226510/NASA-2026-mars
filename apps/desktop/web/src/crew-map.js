import L from 'leaflet';
import {coordinateText} from './surface-readout.js';

export function installCrewMap({viewer,map,mini,inSpace,api}) {
  const C=window.Cesium, ellipsoid=viewer.scene.globe.ellipsoid;
  const source=new C.CustomDataSource('Crew locations');
  viewer.dataSources.add(source);
  const flats=[map,mini].map(item=>L.layerGroup().addTo(item));
  const markers=new Map();
  let crew=[], pending=false, available=false;
  function render() {
    const visible=!inSpace();
    source.show=visible;
    const active=new Set();
    for(const fix of crew) {
      active.add(fix.crewId);
      const key=JSON.stringify(fix);
      if(markers.get(fix.crewId)?.key===key)continue;
      remove(fix.crewId);
      const [lon,lat]=fix.point;
      const status=[fix.simulated?'Simulated':null,fix.fresh?null:'Stale'].filter(Boolean).join(' · ');
      const label=fix.name+(status?' · '+status:'');
      const color=fix.fresh?(fix.simulated?'#ffca86':'#8af2cf'):'#c1c7d0';
      const entity=source.entities.add({name:label,position:C.Cartesian3.fromDegrees(lon,lat,0,ellipsoid),
        point:{pixelSize:10,color:C.Color.fromCssColorString(color),outlineColor:C.Color.BLACK,outlineWidth:2,heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Infinity},
        label:{text:label,font:'13px system-ui',showBackground:true,pixelOffset:new C.Cartesian2(8,-13),horizontalOrigin:C.HorizontalOrigin.LEFT,
          heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Infinity,distanceDisplayCondition:new C.DistanceDisplayCondition(0,400000)}});
      entity.crewFix=fix;
      const flat=flats.map(group=>{
        const tip=document.createElement('span');
        tip.textContent=`${label} · ${coordinateText(fix.point)} · ${fix.at}`;
        return L.circleMarker([lat,lon],{radius:6,color,fillOpacity:.8,weight:2,bubblingMouseEvents:false,className:'atlas-crew-fix'}).bindTooltip(tip)
          .on('click',()=>document.dispatchEvent(new CustomEvent('atlas-inspect-point',{detail:fix.point}))).addTo(group);
      });
      markers.set(fix.crewId,{key,entity,flat});
    }
    for(const id of markers.keys())if(!active.has(id))remove(id);
    viewer.scene.requestRender();
  }
  function remove(id) {
    const marker=markers.get(id);
    if(!marker)return;
    source.entities.remove(marker.entity);
    marker.flat.forEach((layer,index)=>flats[index].removeLayer(layer));
    markers.delete(id);
  }
  function sync() {
    const visible=!inSpace();
    if(source.show!==visible){source.show=visible;viewer.scene.requestRender();}
  }
  async function refresh() {
    if(pending)return;
    pending=true;
    try {
      const next=await api.crewStatus();
      available=next.enabled;
      if(JSON.stringify(next.crew)!==JSON.stringify(crew)){crew=next.crew;render();}
      else sync();
    } catch {available=false;crew=[];render();}
    finally {pending=false;}
  }
  void refresh();
  const timer=setInterval(refresh,1500);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  return {snapshot:()=>({crew,available}),sync};
}

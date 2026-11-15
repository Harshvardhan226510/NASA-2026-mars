import L from 'leaflet';
import {PointInspector} from './point-inspector.js';
import {installCrewMap} from './crew-map.js';
import {hasSurfacePosition} from './spacecraft-data.js';
import {coverageCell,coverageStates} from './comms-model.js';
import {routeProjection} from './route-geometry.js';
import {distance,line,missing,nearest,number} from './point-inspector-data.js';

function coverageAt(comms,point) {
  const scenario=comms.safetySnapshot(), result=scenario?.result;
  const hit=result&&coverageCell(result,routeProjection(result.center).forward(point));
  if(!hit)return missing('Communications coverage','No computed coverage cell at this point.');
  const condition=coverageStates.find(item=>item.id===hit.id)?.label;
  return line('Communications coverage',condition??'Unknown','Modeled',
    `Pyxis ground-link scenario · ${Math.round(result.cell)} m grid · ${distance(hit.distance/1000)} from tower`+
    (Number.isFinite(hit.margin)?` · ${number(hit.margin,1)} dB estimated margin.`:'.'));
}

function nearbyMission({crew,available},host,point,observations) {
  const people=nearest(point,crew,50);
  const rows=people.map(fix=>line(fix.name,distance(fix.distance)+' away'+(fix.fresh?'':' · Stale'),
    fix.simulated?'Simulated':'Observed',
    `Crew fix · ${fix.sourceId} · ${fix.at} · ${fix.accuracyMeters==null?'Accuracy unavailable':`${fix.accuracyMeters} m reported accuracy`}`));
  if(!people.length)rows.push(missing('Crew locations',available?'No reported crew fix within 50 km.':'Crew listener is off.'));
  const vehicles=host.spacecraft.items.filter(hasSurfacePosition).map(item=>({name:item.name,
    point:[item.location.lon_east,item.location.lat_planetocentric],location:item.location}));
  for(const item of nearest(point,vehicles,50)){
    const at=Number.isInteger(item.location.sol)?`Sol ${item.location.sol}`:item.location.epoch;
    rows.push(line(item.name,distance(item.distance)+' from published position','Observed',
      ['Recorded spacecraft localization',at,'Placement uncertainty unavailable'].filter(Boolean).join(' · '),item.location.source));
  }
  if(!nearest(point,vehicles,50,1).length)rows.push(missing('Rovers and landers','No published surface position within 50 km.'));
  const equipment=host.deployer.deployed.map(item=>({point:item.coords,name:item.name??item.typeId}));
  const assets=nearest(point,equipment,50);
  rows.push(...assets.map(item=>line(item.name,distance(item.distance)+' from planned placement','Simulated','Equipment in current Atlas plan.')));
  if(!assets.length)rows.push(missing('Deployed equipment','No planned equipment within 50 km.'));
  const camp=host.camp();
  if(camp?.point){
    const [entry]=nearest(point,[camp],Number.MAX_VALUE,1);
    if(entry)rows.push(line('Declared camp',distance(entry.distance)+' away','Simulated','Current mission plan.'));
  }
  for(const item of observations)rows.push(line(item.label,distance(item.distanceMeters/1000)+' away',
    item.dataKind==='measured'?'Observed':item.dataKind==='modeled'?'Modeled':'User record',
    `${item.kind} · ${item.at} · ${item.source??'Source unspecified'}`));
  rows.push(coverageAt(host.comms,point));
  return rows;
}

export function installPointTools(host) {
  const {viewer,map,mini,api}=host, C=window.Cesium;
  const crew=installCrewMap({viewer,map,mini,inSpace:host.inSpace,api});
  const overlays=[map,mini].map(surface=>L.layerGroup().addTo(surface));
  let pin=null, observations=[], query=0;
  const inspector=new PointInspector({
    marker(point){
      const revision=++query;
      observations=[];
      if(pin)viewer.entities.remove(pin);
      for(const overlay of overlays)overlay.clearLayers();
      if(point){
        const [lon,lat]=point;
        pin=viewer.entities.add({
          position:C.Cartesian3.fromDegrees(lon,lat,0,viewer.scene.globe.ellipsoid),
          point:{pixelSize:10,color:C.Color.ORANGE,outlineColor:C.Color.WHITE,outlineWidth:2,
            heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Infinity},
        });
        for(const overlay of overlays)L.circleMarker([lat,lon],{
          color:'#ffd098',radius:6,weight:2,fillOpacity:.55,interactive:false,
        }).addTo(overlay);
        void api.nearbyObservations(point).then(items=>{
          if(revision===query){observations=items;inspector.renderMission();}
        }).catch(()=>{});
      }
      viewer.scene.requestRender();
    },
    landmarks:()=>host.places.features.map(item=>({name:item.name,point:item.center,url:item.source})),
    terrain:(point,at)=>api.inspectPoint('terrain',point,at),
    environment:point=>api.inspectPoint('environment',point),
    targets:point=>{
      const samples=nearest(point,host.values.sites.filter(item=>!item.userDefined)
        .map(item=>({...item,point:item.center})),50,5);
      return samples.length?samples.map(item=>line(item.name,distance(item.distance)+' from catalogue centre',
        'Published evidence',[item.category,item.evidence,item.summary,item.coordinateNote,item.validation].filter(Boolean).join(' · '),item.sources?.[0]?.url))
        :[missing('Nearby science targets','No published research target within 50 km.')];
    },
    mission:point=>nearbyMission(crew.snapshot(),host,point,observations),
    imageCoverage:host.imageCoverage,
    offline:host.offline,
    rover:(point,id)=>host.rover.open(point,id),
    route(point){host.route.open(true);host.route.setPoint('goal',point);host.route.status('Inspector point set as the route destination.');},
    evaluate(point,mode){
      if(Math.abs(point[1])>89){host.evaluator.message('Site evaluation requires a point between 89°S and 89°N.');return;}
      host.evaluator.panel.hidden=false;
      host.evaluator.open(mode);
      host.evaluator.place(point,host.evaluator.editors[mode]);
    },
    waypoint(point){
      if(host.sites.attachments?.busy)return;
      host.sites.open();
      if(host.sites.unsaved) {
        host.sites.message('Save or cancel the current site before adding the inspector point.');
        return;
      }
      host.sites.newSite();
      host.sites.place(point);
    },
    save:async(point,label)=>{
      await api.saveInspectorObservation(point,label);
      const revision=query,items=await api.nearbyObservations(point);
      if(revision===query){observations=items;inspector.renderMission();}
    },
    ask:(point,evidence)=>host.assistant.inspectReport(point,evidence),
  });
  return {
    get picking(){return inspector.picking;},
    select:point=>inspector.select(point),
    setPicking:value=>inspector.setPicking(value),
    syncSpace(){
      crew.sync();
      if(pin)pin.show=!host.inSpace();
    },
  };
}

import L from 'leaflet';
import {detectionClusters,paintDetections,detectionHover,geographicDetectionGroups,projectDetectionGroups} from './detection-display.js';

const FlatDetections=L.Layer.extend({
 initialize(options){L.setOptions(this,options);},
 onAdd(map){this.map=map;this.canvas=L.DomUtil.create('canvas','mineral-detections');this.canvas.setAttribute('aria-hidden','true');map.getPanes().overlayPane.append(this.canvas);this.hover=detectionHover(map.getContainer(),()=>this.groups??[]);map.on('move zoom resize',this.draw,this);this.draw();},
 onRemove(map){map.off('move zoom resize',this.draw,this);this.hover.destroy();this.canvas.remove();},
 draw(){const map=this.map,{x:width,y:height}=map.getSize();L.DomUtil.setPosition(this.canvas,map.containerPointToLayerPoint([0,0]));this.groups=detectionClusters(this.options.points,p=>{const lon=p.lon+360*Math.round((map.getCenter().lng-p.lon)/360);return map.latLngToContainerPoint([p.lat,lon]);},{width,height});paintDetections(this.canvas,this.groups,width,height,devicePixelRatio);this.options.onDraw?.(this.groups);this.hover?.hide();}
});

export class MineralDetections{
 constructor(viewer,maps){
  this.viewer=viewer;this.maps=maps;this.dirty=true;
  this.canvas=document.createElement('canvas');this.canvas.className='mineral-detections';this.canvas.setAttribute('aria-hidden','true');this.canvas.hidden=true;viewer.scene.canvas.parentElement.append(this.canvas);
  this.hover=detectionHover(viewer.scene.canvas.parentElement,()=>this.visible?this.groups??[]:[]);
  viewer.camera.changed.addEventListener(()=>{this.dirty=true;});viewer.camera.moveEnd.addEventListener(()=>{this.dirty=true;viewer.scene.requestRender();});viewer.scene.globe.tileLoadProgressEvent.addEventListener(()=>{this.dirty=true;});
  viewer.scene.preRender.addEventListener(()=>this.draw());
 }
 async setVisible(show){
  this.visible=show;this.canvas.hidden=!show;this.hover.hide();this.flat?.forEach((layer,i)=>show?layer.addTo(this.maps[i]):layer.remove());if(!show)return;
  try{
   this.pending??=fetch('/scientific/hydrated-sites.json').then(r=>{if(!r.ok)throw Error();return r.json();}).catch(e=>{this.pending=null;throw e;});
   const data=await this.pending;if(!this.visible)return;
   if(!this.points){const C=window.Cesium,ellipsoid=this.viewer.scene.globe.ellipsoid;this.points=data.points.map(p=>({...p,world:C.Cartesian3.fromDegrees(p.lon,p.lat,0,ellipsoid)}));this.geographicGroups=geographicDetectionGroups(this.points);this.flat=this.maps.map((map,i)=>new FlatDetections({points:this.points,onDraw:groups=>{if(i===0&&document.body.classList.contains('two-d'))this.readout(groups);}}).addTo(map));}
   document.getElementById('science-status').textContent=`${data.points.length.toLocaleString()} published detection locations. Globe badges count records in fixed 10° geographic cells; rotation does not regroup them. Zoom closer for individual detections.`;
   this.dirty=true;this.viewer.scene.requestRender();
  }catch(error){console.warn('Hydrated-mineral display unavailable',error);if(this.visible)document.getElementById('science-status').textContent='Published detection markers could not load. Turn this layer off and on to retry.';}
 }
 draw(){
  if(!this.visible||!this.points)return;
  const C=window.Cesium,scene=this.viewer.scene,camera=scene.camera,width=scene.canvas.clientWidth,height=scene.canvas.clientHeight;
  // Compare the actual view on every rendered frame: camera.changed is normally
  // thresholded and is too coarse for labels during a small drag or wheel zoom.
  const key=[width,height,...C.Matrix4.toArray(camera.viewMatrix)].join(',');if(!this.dirty&&this.key===key)return;this.key=key;this.dirty=false;
  const ellipsoid=scene.globe.ellipsoid,occluder=new C.EllipsoidalOccluder(ellipsoid,camera.positionWC),direction=new C.Cartesian3(),normal=new C.Cartesian3();
  const project=p=>{
   if(!occluder.isPointVisible(p.world)||C.Cartesian3.dot(C.Cartesian3.subtract(p.world,camera.positionWC,direction),camera.directionWC)<=0)return null;
   // Leave room for the whole badge inside a globe view instead of letting
   // counts spill across the limb. Local tilted views retain their markers.
   if(camera.positionCartographic.height>1000000&&-C.Cartesian3.dot(ellipsoid.geodeticSurfaceNormal(p.world,normal),direction)/C.Cartesian3.magnitude(direction)<.3)return null;
   const projected=C.SceneTransforms.worldToWindowCoordinates(scene,p.world);
   if(!projected||projected.x<0||projected.y<0||projected.x>width||projected.y>height)return null;
   if(camera.positionCartographic.height>1000000)return projected;
   // Only visible local markers read already-loaded heights. No extra terrain
   // requests, and no planet-wide height walk on each animation frame.
   const h=scene.globe.getHeight(C.Cartographic.fromDegrees(p.lon,p.lat))??0,reference=scene.verticalExaggerationRelativeHeight??0,displayHeight=(h-reference)*(scene.verticalExaggeration??1)+reference;
   return C.SceneTransforms.worldToWindowCoordinates(scene,C.Cartesian3.fromDegrees(p.lon,p.lat,displayHeight,ellipsoid));
  };
  const groups=camera.positionCartographic.height>1000000?projectDetectionGroups(this.geographicGroups,project,{width,height}):detectionClusters(this.points,project,{width,height});
  this.groups=groups;paintDetections(this.canvas,groups,width,height,devicePixelRatio);this.hover.hide();if(!document.body.classList.contains('two-d'))this.readout(groups);
 }
 readout(groups){const count=groups.reduce((n,g)=>n+g.points.length,0),readout=document.getElementById('mineral-visible-count');
  if(readout)readout.textContent=`${count.toLocaleString()} records in visible groups · ${groups.length.toLocaleString()} markers`;
 }
}

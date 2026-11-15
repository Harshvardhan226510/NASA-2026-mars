// Use the visible reticle in CSS coordinates, including resized/split views.
// Cesium pick rays and Leaflet container points both expect client pixels,
// independent of the canvas drawing-buffer scale used by compatible graphics.
export function reticlePoint(element){
 const bounds=element.getBoundingClientRect(),host=element.closest?.('#globe,#map2d')??element;
 const marker=host.querySelector?.('.ui-centre-crosshair'),rect=marker?.getBoundingClientRect();
 if(rect?.width&&rect?.height&&bounds.width&&bounds.height)return {
  x:(rect.left+rect.width/2-bounds.left)*element.clientWidth/bounds.width,
  y:(rect.top+rect.height/2-bounds.top)*element.clientHeight/bounds.height
 };
 return {x:element.clientWidth/2,y:element.clientHeight/2};
}
export function clientPoint(element,x,y){
 const bounds=element.getBoundingClientRect();
 return {x:(x-bounds.left)*element.clientWidth/bounds.width,y:(y-bounds.top)*element.clientHeight/bounds.height};
}
export function pickViewFocus(viewer,{C=window.Cesium,pickPreview}={}){
 const {scene,camera,canvas}=viewer,ellipsoid=scene.globe.ellipsoid,p=reticlePoint(canvas),screen=new C.Cartesian2(p.x,p.y);
 const ray=camera.getPickRay(screen);
 const hit=pickPreview?.(screen)??(ray?scene.globe.pick(ray,scene):null)??camera.pickEllipsoid(screen,ellipsoid);
 if(!hit)return null;
 const carto=ellipsoid.cartesianToCartographic(hit),distance=C.Cartesian3.distance(camera.positionWC,hit);
 return {point:[C.Math.toDegrees(carto.longitude),C.Math.toDegrees(carto.latitude)],width:distance*Math.tan((camera.frustum.fovy??1)/2)*2*canvas.clientWidth/Math.max(1,canvas.clientHeight)/1000};
}

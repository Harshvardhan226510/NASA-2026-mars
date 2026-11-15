import {aboveHorizon} from './value-geometry.js';
import {measurementWorldPosition} from './measurement-terrain.js';

// A hover must only read loaded terrain. Scene.sampleHeight invokes another
// pick render and temporarily changes the scene camera/depth state.
export function projectMeasurementPin(C,scene,point,surface){
 const camera=scene.camera;
 if(!aboveHorizon(point,camera.positionWC))return null;
 const world=measurementWorldPosition(C,scene,point,surface);
 if(C.Cartesian3.dot(C.Cartesian3.subtract(world,camera.positionWC,new C.Cartesian3()),camera.directionWC)<=0)return null;
 const screen=C.SceneTransforms.worldToWindowCoordinates(scene,world);
 return screen&&Number.isFinite(screen.x)&&Number.isFinite(screen.y)&&screen.x>=0&&screen.y>=0&&screen.x<=scene.canvas.clientWidth&&screen.y<=scene.canvas.clientHeight?screen:null;
}

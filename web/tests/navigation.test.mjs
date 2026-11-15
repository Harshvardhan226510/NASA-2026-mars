import test from 'node:test';
import assert from 'node:assert/strict';
import {groundSteps,groundSpeeds,MapNavigation} from '../src/navigation.js';
const keys=(...codes)=>new Set(codes);
test('orbital navigation uses Mars terrain or its reference surface without re-entering the depth renderer',()=>{
 const previous=globalThis.window;globalThis.window={Cesium:{}};
 try{
  const terrain={x:1,y:2,z:3},reference={x:4,y:5,z:6},screen={x:400,y:250};let ground=terrain,depthCalls=0;
  const host={spaceFocus:()=>true,dataset:()=>null,surface:()=>null,viewer:{scene:{globe:{ellipsoid:{},pick:()=>ground},pickPositionSupported:true,pickPosition(){depthCalls++;throw Error('Reentrant model-lighting render');}},camera:{getPickRay:()=>({}),pickEllipsoid:()=>reference}}};
  assert.equal(MapNavigation.prototype.point.call(host,screen),terrain);ground=undefined;assert.equal(MapNavigation.prototype.point.call(host,screen),reference);host.viewer.camera.pickEllipsoid=()=>undefined;assert.equal(MapNavigation.prototype.point.call(host,screen),undefined);assert.equal(depthCalls,0);
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
test('surface navigation retains depth picking for prepared opaque terrain meshes',()=>{
 const previous=globalThis.window;globalThis.window={Cesium:{}};
 try{const mesh={x:7,y:8,z:9},host={spaceFocus:()=>false,dataset:()=>null,surface:()=>null,viewer:{scene:{globe:{ellipsoid:{},pick:()=>undefined},pickPositionSupported:true,pickPosition:()=>mesh},camera:{getPickRay:()=>({})}}};assert.equal(MapNavigation.prototype.point.call(host,{x:1,y:2}),mesh);}
 finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
test('default ground travel covers 80 metres per second at both 60 and 10 fps',()=>{
 for(const fps of [10,60]){const total=Array.from({length:fps},()=>groundSteps(keys('KeyW'),1/fps)[0]).reduce((a,b)=>a+b,0);assert.ok(Math.abs(total-80)<1e-9);}
});
test('Space and either Shift use the selected movement speed',()=>{
 assert.equal(groundSteps(keys('Space'),.1,groundSpeeds.fast)[2],40);
 for(const shift of ['ShiftLeft','ShiftRight'])assert.equal(groundSteps(keys(shift),.1)[2],-8);
 assert.equal(groundSteps(keys('Space','ShiftLeft'),.1)[2],0);
 assert.deepEqual(groundSteps(keys('KeyW','Space','ShiftLeft'),.1,groundSpeeds.explore,false),[8,0,0]);
 assert.deepEqual(groundSteps(keys('ShiftLeft'),.1,groundSpeeds.explore,false),[0,0,0]);
});
test('combined ground controls do not accelerate diagonally and opposite keys cancel',()=>{
 assert.ok(Math.abs(Math.hypot(...groundSteps(keys('KeyW','KeyD','Space'),.1))-8)<1e-9);
 assert.deepEqual(groundSteps(keys('KeyW','KeyS','KeyA','KeyD'),.1),[0,0,0]);
});
test('returning after a long frame cannot jump across kilometres of terrain',()=>{
 assert.equal(groundSteps(keys('KeyW'),20,groundSpeeds.fast)[0],100);
 assert.equal(groundSteps(keys('KeyW'),-1)[0],0);
});

test('ground entry converts the displayed terrain to true scale before placing the camera',()=>{
 const old=globalThis.window;const destinations=[];globalThis.window={Cesium:{Cartesian3:{fromRadians:(lon,lat,height)=>({lon,lat,height})}}};
 try{let cancelled=0,clamped=0;const camera={heading:.2,cancelFlight(){cancelled++;},setView(view){destinations.push(view.destination);},flyTo(){throw Error('Ground entry must not animate through terrain');}};const host={viewer:{camera,canvas:{focus(){}},scene:{globe:{ellipsoid:{cartesianToCartographic:()=>({longitude:1,latitude:.01,height:-8400})}}}},clamp(){clamped++;}};MapNavigation.prototype.land.call(host,{},3);assert.deepEqual(destinations,[{lon:1,lat:.01,height:-2798}]);assert.equal(cancelled,1);assert.equal(clamped,1);}finally{globalThis.window=old;}
});

test('Walk clearance stays above the rendered terrain even when a finer cached tile is lower',()=>{
 const previous=globalThis.window;
 const cameraPosition={longitude:1,latitude:0,height:-2980};
 const fromRadians=(longitude,latitude,height,ellipsoid,result={})=>Object.assign(result,{longitude,latitude,height});
 globalThis.window={Cesium:{Math:{toDegrees:x=>x},Ray:class{origin={};direction={};},Cartesian3:{fromRadians,negate:(p,out)=>{out.x=-p.x;}}}};
 try{
  const camera={positionCartographic:cameraPosition},ellipsoid={geodeticSurfaceNormalCartographic:(p,out)=>{out.x=1;},cartesianToCartographic:p=>p};
  const globe={ellipsoid,getHeight:()=>-9000,pick(ray){assert.equal(ray.origin.longitude,1);assert.equal(ray.origin.height,100_000);assert.equal(ray.direction.x,-1);return {height:-8700};}};
  let frames=0;
  const navigation=Object.create(MapNavigation.prototype);
  Object.assign(navigation,{mode:'ground',renderedRelief:3,surface:()=>({sampleHeight:()=>-3010}),viewer:{camera,scene:{globe,verticalExaggeration:1,requestRender(){frames++;}}}});
  navigation.clamp();
  assert.equal(camera.position.height,-2898);
  assert.equal(frames,1);
  cameraPosition.height=-2800;
  globe.getHeight=()=>-8250;
  navigation.clamp();
  assert.equal(camera.position.height,-2898,'a higher cached tile does not leave the camera floating above the visible ground');
  globe.pick=()=>undefined;
  navigation.clamp();
  assert.equal(camera.position.height,-2898,'looking away retains the last rendered floor at the standing position');
  navigation.mode='pan';cameraPosition.height=-2700;camera.position=undefined;
  navigation.clamp();
  assert.equal(camera.position,undefined);
 }finally{globalThis.window=previous;}
});

test('Walk follows a falling floor and a single Space press rises and lands',()=>{
 const old=globalThis.window;globalThis.window={Cesium:{Cartesian3:{fromRadians:(longitude,latitude,height)=>({longitude,latitude,height})}}};
 try{
  let floor=-1500,position={longitude:1,latitude:0,height:floor+2};
  const camera={get positionCartographic(){return position;},set position(value){position=value;}};
  const navigation=Object.create(MapNavigation.prototype);
  Object.assign(navigation,{mode:'ground',held:keys(),terrainFloor:()=>floor,viewer:{camera,scene:{globe:{ellipsoid:{}},requestRender(){}}}});
  floor-=50;
  navigation.clamp();
  assert.equal(position.height,floor+2);
  const space=repeat=>({code:'Space',repeat,preventDefault(){}});
  navigation.key(space(false));const first=navigation.jumpMotion;
  assert.ok(first);assert.equal(navigation.held.size,0);
  let high=position.height;
  for(let i=0;i<150;i++){
   if(!navigation.jumpMotion)break;
   navigation.key(space(true));assert.equal(navigation.jumpMotion,first);
   navigation.advanceJump(.025);navigation.clamp();high=Math.max(high,position.height);
  }
  assert.ok(high>floor+6.8&&high<floor+7);
  assert.equal(position.height,floor+2);
  assert.equal(navigation.jumpMotion,null);
  navigation.key(space(true));assert.equal(navigation.jumpMotion,null);
  navigation.key(space(false));navigation.advanceJump(.1);navigation.clamp();floor+=3;navigation.clamp();
  assert.equal(position.height,floor+2,'higher terrain interrupts the jump without clipping');
  assert.equal(navigation.jumpMotion,null);
 }finally{globalThis.window=old;}
});

test('zoom-out moves along the outward surface normal even when the viewed hill is above the camera',()=>{
 const old=globalThis.window;const moves=[];class V{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}static subtract(a,b){return new V(a.x-b.x,a.y-b.y,a.z-b.z);}static magnitude(v){return Math.hypot(v.x,v.y,v.z);}static normalize(v){const n=V.magnitude(v);return new V(v.x/n,v.y/n,v.z/n);}}
 globalThis.window={Cesium:{Cartesian3:V}};
 try{const host={mode:'pan',regional:true,point:()=>new V(1,0,1),centre:()=>({}),clamp(){},viewer:{camera:{positionWC:new V(),cancelFlight(){},move(direction,amount){moves.push({direction,amount});}},scene:{globe:{ellipsoid:{geodeticSurfaceNormal:()=>new V(0,0,1)}},requestRender(){}}}};MapNavigation.prototype.zoom.call(host,-160,true);assert.deepEqual(moves[0].direction,new V(0,0,1));assert.ok(moves[0].amount>0);MapNavigation.prototype.zoom.call(host,160,true);assert.equal(moves[1].amount,0,'near-limit zoom-in cannot reverse into zoom-out');}finally{globalThis.window=old;}
});

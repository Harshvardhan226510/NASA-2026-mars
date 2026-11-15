import test from 'node:test';
import assert from 'node:assert/strict';
import {sunModel,AU_METERS,SUN_RADIUS_METERS} from '../src/sun-model.js';
import {marsSun} from '../src/solar-geometry.js';
import {SolarLighting} from '../src/solar-lighting.js';
import {readFile} from 'node:fs/promises';

test('Sun enlargement defaults on, restores an explicit off preference, and lives in the system menu',async t=>{
 const previous=globalThis.localStorage;t.after(()=>{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;});
 for(const [saved,expected] of [[null,true],['true',true],['false',false],['invalid',true]]){
  globalThis.localStorage={getItem:key=>key==='mars-atlas-sun-enlarged-v1'?saved:null};
  const lighting=new SolarLighting({scene:{}},{});clearInterval(lighting.timer);assert.equal(lighting.sunEnlarged,expected);
 }
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),system=html.match(/<section id="moons-panel"[\s\S]*?<\/section>/)?.[0];
 assert.match(system,/Enlarge Sun<\/span><input id="sun-enlarge" type="checkbox" checked aria-describedby="sun-display-note"/);
 assert.equal((html.match(/id="sun-enlarge"/g)??[]).length,1);
});

test('Sun centre uses AU distance without adding a Mars radius or display compression',()=>{
 const m=sunModel({distance_au:1,subsolar_lon:90,declination:0});
 assert.equal(m.distance_m,149597870700);assert.equal(m.diameter_m,1391400000);
 assert.ok(Math.abs(m.position[0])<.0001);assert.equal(m.position[1],AU_METERS);assert.equal(m.position[2],0);
 assert.ok(Math.abs(m.angular_diameter_deg-.5329)<.0001);
});
test('solar disc becomes smaller at aphelion and direction agrees with Mars24',()=>{
 const near=sunModel({distance_au:1.381,subsolar_lon:-180,declination:-25}),far=sunModel({distance_au:1.666,subsolar_lon:180,declination:25});
 assert.ok(near.angular_diameter_deg>.385&&near.angular_diameter_deg<.387);
 assert.ok(far.angular_diameter_deg>.319&&far.angular_diameter_deg<.321);
 assert.ok(near.angular_diameter_deg>far.angular_diameter_deg);
 for(const date of ['2000-01-06','2026-11-03','2030-12-01']){
  const sun=marsSun(date),m=sunModel(sun),[x,y,z]=m.position;
  assert.ok(Math.abs(Math.hypot(x,y,z)-sun.distance_au*AU_METERS)<.0001);
  assert.ok(Math.abs(Math.atan2(y,x)*180/Math.PI-sun.subsolar_lon)<1e-10);
  assert.ok(Math.abs(Math.asin(z/m.distance_m)*180/Math.PI-sun.declination)<1e-10);
 }
});
test('missing or invalid solar geometry never becomes a made-up default position',()=>{
 for(const sun of [null,{}, {distance_au:0,subsolar_lon:0,declination:0},{distance_au:1,subsolar_lon:NaN,declination:0},{distance_au:1,subsolar_lon:0,declination:91}])assert.throws(()=>sunModel(sun));
});
test('renderer uses physical units, an isolated source, depth occlusion and sufficient far range',t=>{
 const previous=globalThis.window;t.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
 class Cartesian3{
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  static fromArray(v,i=0,out=new Cartesian3()){[out.x,out.y,out.z]=v.slice(i,i+3);return out;}
  static normalize(v,out){const n=Math.hypot(v.x,v.y,v.z);Object.assign(out,{x:v.x/n,y:v.y/n,z:v.z/n});return out;}
  static negate(v,out){Object.assign(out,{x:-v.x,y:-v.y,z:-v.z});return out;}
  static distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}
 }
 class Color{static fromCssColorString(){return new Color();}}
 class CustomDataSource{constructor(){this.entities={add:options=>options};}}
 globalThis.window={Cesium:{Cartesian3,Color,CustomDataSource,CallbackPositionProperty:class{constructor(get){this.getValue=get;}},DirectionalLight:class{constructor(options){Object.assign(this,options);}},ShadowMode:{DISABLED:0,RECEIVE_ONLY:1}}};
 const sources=[],viewer={dataSources:{add:s=>sources.push(s)},camera:{positionWC:new Cartesian3(3396190,0,0),frustum:{near:1,far:500000000}},scene:{globe:{},requestRender(){}}};
 const lighting=Object.assign(Object.create(SolarLighting.prototype),{viewer,enabled:true,shadows:false,currentTime:()=> '2026-11-03T00:00:00Z',updateTelemetryOnly(){}});
 lighting.initSunEntity();lighting.update();
 assert.equal(sources.length,1);assert.equal(sources[0],lighting.sunSource);
 const b=lighting.sunEntity.billboard;assert.equal(b.sizeInMeters,true);assert.equal(b.width*b.scale,2*SUN_RADIUS_METERS);assert.equal(b.height*b.scale,2*SUN_RADIUS_METERS);assert.equal(b.disableDepthTestDistance,0);
 assert.ok(b.width<65536&&b.height<65536,'image dimensions must fit Cesium compressed attributes');
 assert.match(decodeURIComponent(b.image),/cx="128" cy="128" r="128"/,'visible disc fills the physical diameter');
 const expected=sunModel(marsSun(lighting.currentTime()));assert.ok(Math.abs(Math.hypot(...Object.values(lighting.sunPosition))-expected.distance_m)<.0001);
 assert.ok(viewer.camera.frustum.far>Cartesian3.distance(viewer.camera.positionWC,lighting.sunPosition)+SUN_RADIUS_METERS);assert.equal(viewer.camera.frustum.near,1);
 const light=viewer.scene.light.direction;assert.ok(Math.abs(Math.hypot(light.x,light.y,light.z)-1)<1e-12);
 const originalPosition={...lighting.sunPosition},originalFar=viewer.camera.frustum.far;
 lighting.setSunEnlarged(true);assert.equal(b.sizeInMeters,false);assert.equal(b.width,64);assert.equal(b.height,64);assert.equal(b.scale,1);
 assert.match(decodeURIComponent(b.image),/cx="48" cy="48" r="13"/);assert.match(decodeURIComponent(b.image),/cx="48" cy="48" r="46"/);
 assert.deepEqual({...lighting.sunPosition},originalPosition);assert.equal(viewer.camera.frustum.far,originalFar);assert.equal(viewer.scene.light.direction,light);assert.equal(b.disableDepthTestDistance,0);
 lighting.setSunEnlarged(false);assert.equal(b.sizeInMeters,true);assert.equal(b.width*b.scale,2*SUN_RADIUS_METERS);assert.deepEqual({...lighting.sunPosition},originalPosition);
 lighting.enabled=false;lighting.update();assert.equal(lighting.sunEntity.show,false);assert.equal(viewer.camera.frustum.far,500000000);assert.equal(viewer.camera.frustum.near,1);
 lighting.enabled=true;lighting.update();viewer.camera.frustum.far*=2;const otherFar=viewer.camera.frustum.far;lighting.enabled=false;lighting.update();assert.equal(viewer.camera.frustum.far,otherFar,'do not overwrite a far plane subsequently changed by another feature');
 const previousDocument=globalThis.document;t.after(()=>{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;});
 const note={textContent:''};globalThis.document={getElementById:id=>id==='solar-scale-note'?note:null};
 SolarLighting.prototype.updateTelemetryOnly.call(lighting);
 assert.match(note.textContent,/238\.8 million km/,'metres must convert to millions of kilometres, not millions of metres');
 assert.match(note.textContent,/0\.334° physical apparent diameter/);
 lighting.sunEnlarged=true;SolarLighting.prototype.updateTelemetryOnly.call(lighting);assert.match(note.textContent,/enlarged for visibility/);assert.match(note.textContent,/238\.8 million km/);assert.doesNotMatch(note.textContent,/No size enlargement/);
});

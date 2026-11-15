import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedPoint,coordinateText,elevationText,sourceTerrain,loadedImage} from '../src/surface-readout.js';

test('cursor coordinates normalize wrapped 2D worlds and reject sky / invalid positions',()=>{
 assert.deepEqual(normalizedPoint([497,-4.8]),[137,-4.8]);
 assert.equal(coordinateText([497,-4.8]),'4.80000°S · 137.00000°E');
 assert.deepEqual(normalizedPoint([0,90]),[0,90]);
 for(const p of [null,[0,91],[NaN,0],[0,Infinity]])assert.equal(normalizedPoint(p),null);
 assert.equal(elevationText(NaN),'Elevation unavailable');assert.equal(elevationText(-3488),'Elev. ≈ −3,488 m');
});

test('cursor elevation reads physical DEM height and excludes display exaggeration / unknown coverage',()=>{
 const surface={sourceElevation:()=>-3500,sampleHeight:()=>-10500,qualityAt:()=>({terrain:1,nativeTerrain:true})};
 assert.deepEqual(sourceTerrain([137,-4.8],surface,{},()=>null),{height:-3500,source:'HiRISE DEM',spacing:1});
 surface.qualityAt=()=>({terrainTransition:true});
 const fallback={height:-3400,source:'HRSC/MOLA',spacing:200};
 assert.equal(sourceTerrain([137,-4.8],surface,{},()=>fallback),fallback);
 assert.equal(sourceTerrain([137,-4.8],null,{},()=>({height:NaN})),null);
});

test('display resolution reports loaded imagery rather than promised native resolution',()=>{
 const overview={source:'CTX / Viking overview',metres:5210},providers=[{source:'CTX',metres:5.1},{source:'Viking',metres:232}];
 assert.equal(loadedImage({overview,providers}),overview);
 assert.deepEqual(loadedImage({native:{imagery:2},overview,providers}),{source:'HiRISE',metres:2});
 assert.deepEqual(loadedImage({providers,polar:true}),providers[1]);
 assert.equal(loadedImage({providers,color:{}}),null);
 assert.equal(loadedImage(),null);
});

export const inside=(point,b)=>point[0]>=b[0]&&point[0]<=b[2]&&point[1]>=b[1]&&point[1]<=b[3];
export function availableDetail(catalog,key){
 const ready=catalog.datasets.filter(d=>d.region===key&&d.status==='complete'&&d.terrain?.length&&d.imagery?.length);
 const candidates=ready.length?ready:(catalog.pilots??[]).filter(d=>d.region===key);
 if(!candidates.length)return null;return {imagery:Math.min(...candidates.map(d=>Math.max(...d.imagery_grid_m))),initial:!ready.length,count:candidates.length};
}
export function coverageText(dataset,focus,quality,loading){
 if(!dataset)return {text:'Global context · high-resolution footprints are marked in Places',kind:'context'};
 const native=Math.max(...dataset.imagery_grid_m),value=native<1?native.toFixed(2):native.toFixed(1);
 if(!inside(focus,dataset.bounds))return {text:'Outside this high-resolution footprint · no native coverage at view centre',kind:'outside'};
 if(!quality)return {text:loading?`High-resolution footprint · ${value} m imagery available · loading here`:'No measured imagery at view centre · footprint contains gaps',kind:loading?'loading':'outside'};
 if(quality.terrainTransition)return {text:`High-resolution imagery ≈${quality.imagery.toFixed(2)} m · display terrain transitions to global context here`,kind:'context'};
 if(quality.imagery<=native*2&&quality.nativeTerrain===false)return {text:`High-resolution imagery ≈${quality.imagery.toFixed(2)} m · terrain currently uses global context`,kind:'detail'};
 const detailed=quality.imagery<=native*2&&(!quality.terrain||quality.terrain<=Math.max(...dataset.dem_grid_m)*2);
 return {text:detailed?`High detail at view centre · imagery ≈${quality.imagery.toFixed(2)} m${quality.mesh?` · terrain mesh ≈${quality.mesh.toFixed(1)} m`:''}`:`High-resolution footprint · displayed imagery ≈${quality.imagery.toFixed(1)} m · ${loading?'loading finer detail':value+' m source available on zoom'}`,kind:detailed?'detail':loading?'loading':'context'};
}

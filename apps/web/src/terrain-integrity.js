// Reject a systematic tile-wide elevation disagreement, not isolated mountains
// or deep craters. MOLA is an independent measured reference, never a zero plane.
export function auditTerrainReference(tile,reference,{samples=9,limit=1500}={}){
 const residuals=[],edges=[[],[],[],[]],{grid,width,bounds:b}=tile;
 for(let row=0;row<samples;row++)for(let col=0;col<samples;col++){
  const x=Math.round(col/(samples-1)*(width-1)),y=Math.round(row/(samples-1)*(width-1));
  const h=grid[y*width+x],base=reference(b[0]+x/(width-1)*(b[2]-b[0]),b[3]-y/(width-1)*(b[3]-b[1]));
  if(Number.isFinite(h)&&Number.isFinite(base)){const delta=h-base;residuals.push(delta);if(row===0)edges[0].push(delta);if(row===samples-1)edges[1].push(delta);if(col===0)edges[2].push(delta);if(col===samples-1)edges[3].push(delta);}
 }
 if(residuals.length<samples*samples*.7)return {valid:false,reason:'insufficient_reference_samples'};
 residuals.sort((a,b)=>a-b);const median=residuals[Math.floor(residuals.length/2)],sign=Math.sign(median);
 const agreement=residuals.filter(v=>Math.sign(v)===sign&&Math.abs(v)>limit).length/residuals.length;
 // A damaged tile can overlap valid elevations along its low edge. Requiring
 // 70% consensus let the Olympus 7/50/35 plateau through despite a 2.6 km
 // median error and a >6 km western edge. A clear 60% majority still excludes
 // isolated summits/craters, without letting that low edge veto rejection.
 // A narrow corrupted border can pass a whole-tile median. Reject only a
 // nearly unanimous multi-kilometre edge offset against independent MOLA.
 // An isolated summit or crater on an edge cannot satisfy this consensus.
 const badEdges=edges.map((values,index)=>{const sorted=[...values].sort((a,b)=>a-b),m=sorted[Math.floor(sorted.length/2)]??0,f=values.filter(v=>Math.sign(v)===Math.sign(m)&&Math.abs(v)>limit*2).length/samples;return {index,median:m,fraction:f};}).filter(e=>Math.abs(e.median)>limit*2&&e.fraction>=.875);
 return {valid:!(Math.abs(median)>limit&&agreement>=.6)&&!badEdges.length,medianResidual:median,systematicFraction:agreement,samples:residuals.length,badEdges};
}

// Reuse only this observation's geographically containing, measured image.
export function retainedImagery(samples,bounds){
 return [...samples].filter(s=>s.bounds[0]<=bounds[0]&&s.bounds[1]<=bounds[1]&&s.bounds[2]>=bounds[2]&&s.bounds[3]>=bounds[3]&&Number.isFinite(s.image.gridMeters)).sort((a,b)=>a.image.gridMeters-b.image.gridMeters)[0];
}
export function imagePlacement(source,bounds,size){return [(source[0]-bounds[0])/(bounds[2]-bounds[0])*size,(bounds[3]-source[3])/(bounds[3]-bounds[1])*size,(source[2]-source[0])/(bounds[2]-bounds[0])*size,(source[3]-source[1])/(bounds[3]-bounds[1])*size];}
export function cropMeasuredImage(sample,bounds,size=512){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.gridMeters=sample.metres??sample.image.gridMeters;canvas.getContext('2d').drawImage(sample.image,...imagePlacement(sample.bounds,bounds,size));return canvas;}

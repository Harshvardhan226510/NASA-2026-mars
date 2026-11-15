// A fixed planet-wide scale: colors never change when a tile or view changes.
export const ELEVATION_STOPS=[[-8000,[38,57,117]],[-4000,[46,135,175]],[0,[112,185,156]],[4000,[220,207,123]],[8000,[230,148,81]],[12000,[184,83,76]],[16000,[147,109,154]],[22000,[247,237,227]]];
export function elevationColor(height){
 if(!Number.isFinite(height))return [0,0,0,0];
 const clamped=Math.max(-8000,Math.min(22000,height));
 const i=Math.max(1,ELEVATION_STOPS.findIndex(s=>s[0]>=clamped)),a=ELEVATION_STOPS[i-1],b=ELEVATION_STOPS[i],t=(clamped-a[0])/(b[0]-a[0]);
 return [...a[1].map((v,c)=>Math.round(v+(b[1][c]-v)*t)),255];
}
export function elevationPixels(bounds,size,sample){
 const pixels=new Uint8ClampedArray(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const lon=bounds[0]+(x+.5)/size*(bounds[2]-bounds[0]),lat=bounds[3]-(y+.5)/size*(bounds[3]-bounds[1]);
  pixels.set(elevationColor(sample(lon,lat)),(y*size+x)*4);
 }return pixels;
}

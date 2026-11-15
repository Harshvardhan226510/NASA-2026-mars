import {terrainMetrics,horizonMetric,terrainMetricValue,solarTerrain} from './terrain-metrics.js';
import {overlayColor} from './science-style.js';
import {yieldToBrowser} from './yield-to-browser.js';
export async function scientificPixels(item,{sample,spacing,confidence,style,bounds,size,signal,terrainContext}){
 signal?.throwIfAborted();const pixels=new Uint8ClampedArray(size*size*4);
 for(let row=0;row<size;row++){
  for(let col=0;col<size;col++){
   // Endpoint sampling gives adjacent imagery tiles the same boundary texels.
   const lon=bounds[0]+col/(size-1)*(bounds[2]-bounds[0]),lat=bounds[3]-row/(size-1)*(bounds[3]-bounds[1]);let value;
   let coverage=1;
   if(item.engine==='reference'){const pixel=sample(lon,lat);if(typeof pixel==='object'&&pixel!==null){value=pixel.value;coverage=pixel.coverage;}else value=pixel;}
   else if(item.metric==='confidence')value=Number.isFinite(sample(lon,lat))?confidence:NaN;
   else if(item.metric==='solar-terrain')value=solarTerrain(sample,lon,lat,spacing,item.solar);
   else if(['sky','shield','horizon'].includes(item.metric))value=horizonMetric(sample,lon,lat,spacing,item.metric==='horizon'?'horizon':item.metric==='shield');
   else value=terrainMetricValue(terrainMetrics(sample,lon,lat,spacing),item.metric);
   const color=overlayColor(value,style.min,style.max,item.id);
   const fine=item.engine!=='reference'&&terrainContext?.(lon,lat);
   if(fine){let next;if(item.metric==='confidence')next=1;else if(item.metric==='solar-terrain')next=solarTerrain(fine.sample,lon,lat,fine.spacing,item.solar);else if(['sky','shield','horizon'].includes(item.metric))next=horizonMetric(fine.sample,lon,lat,fine.spacing,item.metric==='horizon'?'horizon':item.metric==='shield');else next=terrainMetricValue(terrainMetrics(fine.sample,lon,lat,fine.spacing),item.metric);
    if(Number.isFinite(next)){const ink=overlayColor(next,style.min,style.max,item.id);for(let c=0;c<4;c++)color[c]=Math.round(color[c]*(1-fine.weight)+ink[c]*fine.weight);}
   }
   color[3]=Math.round(color[3]*Math.max(0,Math.min(1,coverage)));
   pixels.set(color,(row*size+col)*4);
  }
  if(row%32===31)await yieldToBrowser(signal);
 }
 signal?.throwIfAborted();return pixels;
}

import {yieldToBrowser} from './yield-to-browser.js';
import {sampleReference} from './scientific-data.js';

// Display-only area averages. Keep the verified native grid for numeric readouts
// and coverage: an overview must never turn an unobserved cell into a detection.
const pyramidCache=new WeakMap();
export async function referencePyramid(grid,signal){
 signal?.throwIfAborted();
 if(pyramidCache.has(grid))return pyramidCache.get(grid);
 const levels=[grid];
 while(levels.at(-1).width%2===0&&levels.at(-1).height%2===0&&levels.at(-1).width>1&&levels.at(-1).height>1){
  const source=levels.at(-1),width=Math.ceil(source.width/2),height=Math.ceil(source.height/2),values=new Float32Array(width*height).fill(NaN),coverage=new Float32Array(width*height);
  for(let y=0;y<height;y++){
   for(let x=0;x<width;x++){
    let sum=0,count=0;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
     const sx=2*x+dx,sy=2*y+dy;if(sx>=source.width||sy>=source.height)continue;
     const i=sy*source.width+sx,v=source.values[i],weight=source.coverage?.[i]??1;if(Number.isFinite(v)){sum+=v*weight;count+=weight;}
    }
    if(count)values[y*width+x]=sum/count;coverage[y*width+x]=count/4;
   }
   if(y%128===127){await yieldToBrowser(signal);}
  }
  signal?.throwIfAborted();levels.push({...grid,width,height,values,coverage});
 }
 // A pole is a single point, rather than a longitude-dependent fan of texels.
 for(const level of levels){
  level.poles=[0,level.height-1].map(row=>{let sum=0,count=0;for(let x=0;x<level.width;x++){const v=level.values[row*level.width+x];if(Number.isFinite(v)){sum+=v;count++;}}return count?sum/count:NaN;});
 }
 pyramidCache.set(grid,levels);return levels;
}

function bilinear(grid,lon,lat){
 const [west,south,east,north]=grid.bounds,w=grid.width,h=grid.height;
 const px=(((lon-west)%360+360)%360)/(east-west)*w-.5,py=Math.max(0,Math.min(h-1,(north-lat)/(north-south)*h-.5));
 const ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
 let sum=0,coverage=0;
 for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
  const weight=(dx?fx:1-fx)*(dy?fy:1-fy);if(weight===0)continue;
  const x=((ix+dx)%w+w)%w,y=Math.min(h-1,iy+dy),value=grid.values[y*w+x];
  // Normalize over measured neighbors. Falling back to the nearest raw cell
  // here created hard stripes wherever a bilinear footprint touched NoData.
  if(!Number.isFinite(value))continue;
  const measuredWeight=weight*(grid.coverage?.[y*w+x]??1);
  sum+=value*measuredWeight;coverage+=measuredWeight;
 }
 if(!coverage)return {value:NaN,coverage:0};
 sum/=coverage;
 const halfCell=(north-south)/h/2;
 if(north===90&&lat>90-halfCell){const t=(lat-(90-halfCell))/halfCell;sum=sum*(1-t)+grid.poles[0]*t;}
 if(south===-90&&lat<-90+halfCell){const t=((-90+halfCell)-lat)/halfCell;sum=sum*(1-t)+grid.poles[1]*t;}
 return {value:sum,coverage};
}

export function sampleReferencePixel(levels,lon,lat,footprint=0){
 const native=sampleReference(levels[0],lon,lat);if(!Number.isFinite(native))return {value:NaN,coverage:0};
 const grid=levels[0],cell=Math.max((grid.bounds[2]-grid.bounds[0])/grid.width,(grid.bounds[3]-grid.bounds[1])/grid.height);
 const lod=Math.max(0,Math.min(levels.length-1,Math.log2(Math.max(1,footprint/cell)))),low=Math.floor(lod),high=Math.min(levels.length-1,low+1),t=lod-low;
 const a=bilinear(levels[low],lon,lat),b=t?bilinear(levels[high],lon,lat):a;
 const coverage=a.coverage*(1-t)+b.coverage*t;
 return {value:coverage?((a.coverage?a.value*a.coverage*(1-t):0)+(t&&b.coverage?b.value*b.coverage*t:0))/coverage:NaN,coverage};
}
export function sampleReferenceDisplay(levels,lon,lat,footprint=0){return sampleReferencePixel(levels,lon,lat,footprint).value;}

export function referenceStyle(item,grid){return {min:grid?.display?.min??item.min,max:grid?.display?.max??item.max,title:grid?.display?.title??item.name,note:grid?.display?.note};}

// Mission restoration also dispatches change on hidden controls. Only a real
// published component selection may start a reference-raster request.
export function referenceVariant(item,value){return item?.engine==='reference'&&item.variants?.includes(value)?value:null;}

import windows from './eva-elevation-index.json' with {type:'json'};

const records=new Map();
const products=[
 {label:'USGS Mars 2020 Jezero CTX DTM',url:'https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-ctx-dtm-mosaic'},
 {label:'NASA Mars Trek Gale HiRISE DTM',url:'https://trek.nasa.gov/mars/trekarcgis/rest/services/Gale_DEM_SMG_1m/ImageServer'}
];

export function evaElevationWindow(bounds){return windows.find(({bounds:b})=>b[0]<=bounds[0]&&b[1]<=bounds[1]&&b[2]>=bounds[2]&&b[3]>=bounds[3]);}

export function sampleEvaHeight(values,{bounds:[w,s,e,n],width,height},lon,lat){
 if(lon<w||lon>e||lat<s||lat>n)return NaN;
 const x=(lon-w)/(e-w)*(width-1),y=(n-lat)/(n-s)*(height-1),col=Math.min(width-2,Math.floor(x)),row=Math.min(height-2,Math.floor(y)),u=x-col,v=y-row;
 const a=values[row*width+col],b=values[row*width+col+1],c=values[(row+1)*width+col],d=values[(row+1)*width+col+1];
 return [a,b,c,d].includes(-32768)?NaN:(a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;
}

export async function loadEvaElevation(entry){
 let task=records.get(entry.id);
 if(!task){
  task=(async()=>{
   const response=await fetch(`/eva-elevation/${entry.id}.bin?v=1`,{signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('The regional EVA terrain packet is unavailable.');
   const data=new DataView(await response.arrayBuffer());
   if(data.byteLength!==entry.width*entry.height*2)throw Error('Incomplete regional EVA terrain packet.');
   return Int16Array.from({length:entry.width*entry.height},(_,i)=>data.getInt16(i*2,true));
  })();
  records.set(entry.id,task);task.catch(()=>records.delete(entry.id));
 }
 const values=await task;
 return {...products[entry.source],metres:20,sample:(lon,lat)=>sampleEvaHeight(values,entry,lon,lat)};
}

// The viewer uses planetocentric latitude and signed east-positive longitude.
const intervals=[.000001,.000002,.000005,.00001,.00002,.00005,.0001,.0002,.0005,.001,.002,.005,.01,.02,.05,.1,.2,.5,1,2,5,10,15,30,45,60,90];
export function gridInterval(span){return intervals.find(step=>step>=Math.max(0,span)/6)??90;}
export function coordinateLabel(value,axis,step=1){
 if(axis==='lon'){value=((value+180)%360+360)%360-180;if(Math.abs(value+180)<1e-8)return '180°';}
 const decimals=Math.max(0,Math.min(6,Math.ceil(-Math.log10(step)))),amount=Number(Math.abs(value).toFixed(decimals));
 if(amount===0)return axis==='lat'?'Equator · 0°':'0°';
 return amount.toFixed(decimals).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'')+'°'+(axis==='lat'?(value<0?'S':'N'):(value<0?'W':'E'));
}

// Bounded tile-local geometry. Very coarse ancestors stay transparent instead
// of enumerating millions of fine grid lines while the camera is near ground.
export function coordinateGrid(bounds,{latStep,lonStep},size=256){
 const [west,south,east,north]=bounds,span=east-west,height=north-south,lines=[],labels=[];
 if(![...bounds,latStep,lonStep,size].every(Number.isFinite)||span<=0||height<=0||latStep<=0||lonStep<=0)return {lines,labels};
 const x=lon=>(lon-west)/span*size,y=lat=>(north-lat)/height*size;
 const lonPixels=lonStep/span*size,latPixels=latStep/height*size;
 const indices=(low,high,step,offset=0)=>{
  const first=Math.ceil(low/step-offset-1e-8),last=Math.floor(high/step-offset+1e-8);
  if(last-first>40)return [];return Array.from({length:Math.max(0,last-first+1)},(_,i)=>(first+i+offset)*step);
 };
 const meridians=lonPixels>=24?indices(west,east,lonStep):[],parallels=latPixels>=24?indices(south,north,latStep).filter(lat=>Math.abs(lat)<90-1e-8):[];
 for(const lon of meridians)lines.push({axis:'lon',coordinate:lon,from:[x(lon),0],to:[x(lon),size],major:Math.abs(lon%180)<1e-8});
 for(const lat of parallels)lines.push({axis:'lat',coordinate:lat,from:[0,y(lat)],to:[size,y(lat)],major:Math.abs(lat)<1e-8});
 if(lonPixels>=90&&latPixels>=90){
  // Include anchors just outside the tile so clipped text continues seamlessly
  // in its neighbor. Text never becomes a map marker or intercepts a click.
  const lonPad=72/size*span,latPad=20/size*height;
  const labelLons=indices(west-lonPad,east+lonPad,lonStep),labelLats=indices(Math.max(-85,south-latPad),Math.min(85,north+latPad),latStep,.5);
  for(const lon of labelLons)for(const lat of labelLats)labels.push({x:x(lon)+6,y:y(lat),text:coordinateLabel(lon,'lon',lonStep)});
  const latLons=indices(west-lonPad,east+lonPad,lonStep,.5),latLats=indices(Math.max(-85,south-latPad),Math.min(85,north+latPad),latStep);
  for(const lat of latLats)for(const lon of latLons)labels.push({x:x(lon),y:y(lat)-8,text:coordinateLabel(lat,'lat',latStep)});
 }
 return {lines,labels};
}

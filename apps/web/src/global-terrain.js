export const MARS_RADIUS_M = 3396190;
export const MOLA_WIDTH = 1440, MOLA_HEIGHT = 720;
export function decodeTopography(buffer){if(buffer.byteLength!==MOLA_WIDTH*MOLA_HEIGHT*2)throw new Error('Unexpected MOLA topography byte size');const d=new DataView(buffer),values=new Float32Array(MOLA_WIDTH*MOLA_HEIGHT);for(let i=0;i<values.length;i++){const v=d.getInt16(i*2,false);if(v===-32768)throw new Error('Missing MOLA topography pixel');values[i]=v;}return values;}
export function wrapLongitude(longitude){return ((longitude%360)+360)%360;}
export function decodeRadius(buffer){
 if(buffer.byteLength!==MOLA_WIDTH*MOLA_HEIGHT*2)throw new Error('Unexpected MOLA radius byte size');
 const d=new DataView(buffer), values=new Float32Array(MOLA_WIDTH*MOLA_HEIGHT);
 for(let i=0;i<values.length;i++)values[i]=d.getInt16(i*2,false)+3396000-MARS_RADIUS_M;
 return values;
}
export function sampleHeight(values,longitude,latitude){
 const x=wrapLongitude(longitude)*4-.5, y=Math.max(0,Math.min(MOLA_HEIGHT-1,(90-latitude)*4-.5));
 const x0=Math.floor(x), y0=Math.floor(y), tx=x-x0, ty=y-y0;
 const index=(xx,yy)=>yy*MOLA_WIDTH+((xx%MOLA_WIDTH)+MOLA_WIDTH)%MOLA_WIDTH;
 const a=values[index(x0,y0)],b=values[index(x0+1,y0)],c=values[index(x0,Math.min(719,y0+1))],d=values[index(x0+1,Math.min(719,y0+1))];
 const sampled=(a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty;
 if(Math.abs(latitude)<=89.875)return sampled;
 let polar=poleHeights.get(values);if(!polar){polar=[0,0];for(let i=0;i<MOLA_WIDTH;i++){polar[0]+=values[i]/MOLA_WIDTH;polar[1]+=values[(MOLA_HEIGHT-1)*MOLA_WIDTH+i]/MOLA_WIDTH;}poleHeights.set(values,polar);}
 const weight=Math.min(1,(Math.abs(latitude)-89.875)/.125);return sampled*(1-weight)+polar[latitude>0?0:1]*weight;
}
const poleHeights=new WeakMap();
export function terrainProvider(C,ellipsoid,values){
 const tilingScheme=new C.GeographicTilingScheme({ellipsoid});
 const tileHeights=(x,y,level)=>{
  const r=tilingScheme.tileXYToRectangle(x,y,level), out=new Float32Array(33*33);
  for(let row=0;row<33;row++)for(let col=0;col<33;col++)out[row*33+col]=sampleHeight(values,C.Math.toDegrees(r.west+(r.east-r.west)*col/32),C.Math.toDegrees(r.north-(r.north-r.south)*row/32));
  return out;
 };
 const provider=new C.CustomHeightmapTerrainProvider({ellipsoid,tilingScheme,width:33,height:33,credit:'NASA/MGS MOLA · MEGR90N000CB · 4 pixels/degree',callback:tileHeights});
 const original=provider.requestTileGeometry.bind(provider);
 provider.requestTileGeometry=(x,y,level,request)=>{
  const result=original(x,y,level,request);
  if(!result)return result;
  return Promise.resolve(result).then(data=>{
   if(level>=6){return new C.HeightmapTerrainData({buffer:tileHeights(x,y,level),width:33,height:33,childTileMask:0});}
   return data;
  });
 };
 return provider;
}

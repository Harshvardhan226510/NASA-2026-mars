import {fromFile} from 'geotiff';
import {writeFile,mkdir} from 'node:fs/promises';

const inputs=[process.argv[2],process.argv[3]];
if(inputs.some(x=>!x))throw Error('Usage: node scripts/prepare-eva-elevation.mjs JEZERO_20M.tif GALE_20M.tif');
const products=[
 {id:'jezero-bright-angel',source:0,bounds:[77.282,18.477,77.327,18.514]},
 {id:'jezero-three-forks',source:0,bounds:[77.381,18.434,77.424,18.472]},
 {id:'gale-boxwork',source:1,bounds:[137.352,-4.840,137.414,-4.775]}
];
const radius=3396190,k=Math.PI*radius/180,output=new URL('../public/eva-elevation/',import.meta.url);
await mkdir(output,{recursive:true});
const index=[];
for(const {id,source,bounds} of products){
 const tiff=await fromFile(inputs[source]);
 try{
  const image=await tiff.getImage(),[x,y]=image.getOrigin(),[dx,dy]=image.getResolution(),scale=source===0?k:1;
  const [w,s,e,n]=bounds.map(v=>v*scale),col0=Math.floor((w-x)/dx),col1=Math.ceil((e-x)/dx),row0=Math.floor((n-y)/dy),row1=Math.ceil((s-y)/dy);
  if(col0<0||row0<0||col1>image.getWidth()||row1>image.getHeight())throw Error(`Window outside ${id} source.`);
  const width=col1-col0,height=row1-row0,nodata=image.getGDALNoData(),[heights]=await image.readRasters({window:[col0,row0,col1,row1]});
  const bytes=Buffer.alloc(width*height*2);
  heights.forEach((h,i)=>bytes.writeInt16LE(Number.isFinite(h)&&h!==nodata&&h>=-15000&&h<=30000?Math.round(h):-32768,i*2));
  index.push({id,width,height,bounds:[(x+(col0+.5)*dx)/scale,(y+(row1-.5)*dy)/scale,(x+(col1-.5)*dx)/scale,(y+(row0+.5)*dy)/scale],source});
  await writeFile(new URL(`${id}.bin`,output),bytes);
 }finally{await tiff.close();}
}
await writeFile(new URL('../src/eva-elevation-index.json',import.meta.url),JSON.stringify(index,null,2)+'\n');

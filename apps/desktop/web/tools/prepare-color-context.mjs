import {mkdir,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const out=process.argv[2];if(!out)throw Error('Provide a temporary tile directory.');await mkdir(out,{recursive:true});const sources=[];
for(let i=0;i<128;i+=4){
 const batch=await Promise.all(Array.from({length:4},async(_,j)=>{const n=i+j,x=n%16,y=Math.floor(n/16),url=`https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/3/${y}/${x}.jpg`;
  let bytes;for(let attempt=0;attempt<3;attempt++){try{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);bytes=Buffer.from(await r.arrayBuffer());if(bytes[0]!==255||bytes[1]!==216||bytes.at(-1)!==217)throw Error('Invalid JPEG');break;}catch(e){if(attempt===2)throw e;}}
  const file=`${y}-${x}.jpg`;await writeFile(out+'/'+file,bytes);return {x,y,z:3,url,file,sha256:createHash('sha256').update(bytes).digest('hex')};
 }));sources.push(...batch);if(i%32===0)console.log(`Color context: ${sources.length}/128 verified tiles`);
}
await writeFile(out+'/sources.json',JSON.stringify(sources,null,2));

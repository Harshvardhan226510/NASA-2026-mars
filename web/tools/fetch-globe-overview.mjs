import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
if(!process.argv[2])throw new Error('Usage: node tools/fetch-globe-overview.mjs <temporary-input-directory>');
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const addresses=[];for(const kind of ['imagery','baseline'])for(let y=0;y<4;y++)for(let x=0;x<8;x++)addresses.push({kind,x,y,z:2});
const records=[];
for(let i=0;i<addresses.length;i+=4){
 const batch=await Promise.all(addresses.slice(i,i+4).map(async a=>{
  const file=`${a.kind}-${a.y}-${a.x}.tile`,url=`https://mars-field-atlas.vercel.app/api/planet?kind=${a.kind}&z=2&y=${a.y}&x=${a.x}`;
  for(let attempt=0;attempt<3;attempt++){try{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(a.kind==='imagery'&&r.status===404)return {...a,missing:true,url};if(!r.ok)throw new Error('HTTP '+r.status);const bytes=Buffer.from(await r.arrayBuffer());await writeFile(join(out,file),bytes);return {...a,file,url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}catch(e){if(attempt===2)throw new Error(`${file}: ${e.message}`);}}
 }));records.push(...batch);console.log(`Verified ${records.length}/${addresses.length} overview tiles`);
}
await writeFile(join(out,'sources.json'),JSON.stringify(records,null,2));console.log(out);

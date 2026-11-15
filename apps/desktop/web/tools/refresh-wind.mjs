import {mkdir,writeFile,rename} from 'node:fs/promises';
import {collectWind} from '../science/wind.mjs';
const root=new URL('../data/wind/',import.meta.url);await mkdir(new URL('raw/',root),{recursive:true});
const packet=await collectWind({onRaw:async({raw,metadata})=>{try{await writeFile(new URL('raw/'+metadata.sha256+'.txt',root),raw,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}}});
await writeFile(new URL('bootstrap.json.tmp',root),JSON.stringify(packet)+'\n');await rename(new URL('bootstrap.json.tmp',root),new URL('bootstrap.json',root));
console.log(JSON.stringify({source:packet.source,model_time:packet.model_time,model:packet.model_label,cells:packet.valid_cells,nlon:packet.nlon,nlat:packet.nlat,max_m_s:packet.maximum_speed,retrieved_at:packet.retrieved_at}));

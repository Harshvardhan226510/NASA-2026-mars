// Run in a durable workspace/worker. Never uses the serverless filesystem as storage.
import {mkdir,readFile,writeFile,rename,open,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {collectFeed} from '../science/space-weather.mjs';
import {FEEDS} from '../src/space-weather-contracts.js';
const root=new URL('../data/space-weather/',import.meta.url),lock=new URL('refresh.lock',root);
await mkdir(root,{recursive:true});const handle=await open(lock,'wx').catch(()=>{throw Error('A space-weather snapshot refresh is already running.');});
try{
 let previous={schema:'mars-space-weather-bootstrap/1',feeds:{}};try{previous=JSON.parse(await readFile(new URL('bootstrap.json',root),'utf8'));}catch{}
 const now=new Date(),feeds={...previous.feeds},report=[];await mkdir(new URL('raw/',root),{recursive:true});await mkdir(new URL('audit/',root),{recursive:true});
 // Bound upstream load: two sources at a time; per-source discovery is sequential.
 const captured=new Map(),archive=feed=>async entry=>{const list=captured.get(feed)??[];list.push(entry.metadata);captured.set(feed,list);const file=new URL('raw/'+entry.metadata.sha256+'.txt',root);try{await writeFile(file,entry.raw,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}},names=Object.keys(FEEDS);
 for(let i=0;i<names.length;i+=2){
  const outcomes=await Promise.allSettled(names.slice(i,i+2).map(feed=>collectFeed(feed,{days:30,now,onRaw:archive(feed)})));
  for(let j=0;j<outcomes.length;j++){
   const feed=names[i+j],result=outcomes[j];
   if(result.status!=='fulfilled'){report.push({feed,ok:false,error:result.reason.message,provenance:captured.get(feed)??[]});console.log(JSON.stringify({feed,ok:false,error:result.reason.message}));continue;}
   const {packet,raw}=result.value;
   for(const entry of raw){const file=new URL('raw/'+entry.metadata.sha256+'.txt',root);try{await writeFile(file,entry.raw,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}}
   const old=previous.feeds[feed],identity=packet.latest_observed_at??packet.latest_issue_time??packet.latest_model_completion??null;
   packet.first_seen_at=identity&&identity===(old?.latest_observed_at??old?.latest_issue_time??old?.latest_model_completion)?old.first_seen_at:new Date().toISOString();
   packet.first_seen_scope='Latest-record identity in this durable snapshot worker; initial backfill is not a publication-delay measurement.';
   feeds[feed]=packet;report.push({feed,ok:true,samples:packet.samples?.length??0,runs:packet.runs?.length??0,events:packet.events?.length??0,latest:identity,raw_bytes:raw.reduce((n,r)=>n+r.raw.length,0),provenance:captured.get(feed)??[]});console.log(JSON.stringify({...report.at(-1),provenance:undefined}));
  }
 }
 const completed=new Date().toISOString(),audit={started_at:now.toISOString(),completed_at:completed,results:report};
 await writeFile(new URL('audit/'+completed.replace(/[:.]/g,'-')+'.json',root),JSON.stringify(audit,null,2)+'\n');
 const target=new URL('bootstrap.json',root),temp=fileURLToPath(target)+'.tmp';
 await writeFile(temp,JSON.stringify({schema:previous.schema,generated_at:completed,feeds})+'\n');await rename(temp,target);
 if(report.some(r=>!r.ok))process.exitCode=1;
}finally{await handle.close();await unlink(lock);}

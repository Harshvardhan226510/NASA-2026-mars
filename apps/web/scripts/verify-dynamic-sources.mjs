import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {collectFeed} from '../science/space-weather.mjs';
import {CONTEXT_FEEDS} from '../src/space-weather-context.js';
import {collectEnvironment} from '../science/environment.mjs';
import {ENVIRONMENT_PARAMETERS,environmentTime} from '../src/environment-data.js';
const space=new URL('../data/space-weather/',import.meta.url),env=new URL('../data/environment/',import.meta.url),bootstrap=JSON.parse(await readFile(new URL('bootstrap.json',space),'utf8')),fields={},at=environmentTime();
await mkdir(new URL('raw/',env),{recursive:true});
for(const feed of Object.keys(CONTEXT_FEEDS)){
 const {packet}=await collectFeed(feed,{onRaw:async r=>writeFile(new URL('raw/'+r.metadata.sha256+'.txt',space),r.raw)});bootstrap.feeds[feed]=packet;console.log(feed,packet.samples.length,packet.latest_observed_at);
}
bootstrap.updated_at=new Date().toISOString();await writeFile(new URL('bootstrap.json',space),JSON.stringify(bootstrap));
for(const param of Object.keys(ENVIRONMENT_PARAMETERS)){
 fields[param]=await collectEnvironment(param,{at,onRaw:async r=>writeFile(new URL('raw/'+r.metadata.sha256+'.txt',env),r.raw)});console.log(param,fields[param].units,fields[param].model_time);
}
await writeFile(new URL('verified-snapshot.json',env),JSON.stringify({verified_at:new Date().toISOString(),fields}));

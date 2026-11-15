import http from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm','.woff2':'font/woff2','.glb':'model/gltf-binary','.webp':'image/webp','.lerc':'application/octet-stream'};
export const CSP="default-src 'self'; script-src 'self' blob: 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https:; worker-src 'self' blob:; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'";
function equal(a,b){const x=Buffer.from(a??''),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export async function readBody(req,max=4000000){let size=0;const parts=[];for await(const part of req){size+=part.length;if(size>max){const e=Error('Request exceeds size limit');e.status=413;throw e;}parts.push(part);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{const e=Error('Invalid JSON');e.status=400;throw e;}}
export async function serveFile(req,res,base,relative,{contentType,mediaRanges=false}={}){const lexical=path.resolve(base,relative);if(!lexical.startsWith(path.resolve(base)+path.sep)){res.writeHead(403).end();return;}const resolved=await realpath(lexical);const safeBase=await realpath(base);if(!resolved.startsWith(safeBase+path.sep)||resolved===safeBase){res.writeHead(403).end();return;}const info=await stat(resolved);if(!info.isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',contentType??types[path.extname(resolved)]??'application/octet-stream');res.setHeader('Accept-Ranges','bytes');let start=0,end=info.size-1;if(req.headers.range){const suffix=mediaRanges&&/^bytes=-(\d+)$/.exec(req.headers.range);const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match&&!suffix){res.writeHead(416).end();return;}if(suffix){const count=Number(suffix[1]);if(!Number.isSafeInteger(count)||count<1){res.writeHead(416).end();return;}start=Math.max(0,info.size-count);}else{start=Number(match[1]);end=match[2]?Number(match[2]):end;if(mediaRanges)end=Math.min(end,info.size-1);}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||end>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);}res.setHeader('Content-Length',end-start+1);if(req.method==='HEAD'||info.size===0){res.end();return;}await pipeline(createReadStream(resolved,{start,end}),res);}
export async function startServer({webRoot,policy,python,log=()=>{},registry,inference,localMaps,mapPlan,missionApi,sourceMaps,siteAttachments}={}){
 const token=randomBytes(32).toString('hex'),handlers=new Map();let origin;
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 const server=http.createServer(async(req,res)=>{res.setHeader('Content-Security-Policy',CSP);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');try{
  if(req.headers.host!==new URL(origin).host||!equal(req.headers['x-atlas-token'],token)||(req.headers.origin&&req.headers.origin!==origin)){json(res,403,{error:'Application session required'});return;}
  const url=new URL(req.url,origin);let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{json(res,400,{error:'Invalid path'});return;}if(pathname.includes('\\')||pathname.includes('\0')){json(res,400,{error:'Invalid path'});return;}
  if(pathname==='/api/desktop/site-attachment'&&siteAttachments){
   if(!['GET','HEAD'].includes(req.method)){json(res,405,{error:'Use GET or HEAD'});return;}
   const asset=await siteAttachments.asset(url.searchParams.get('id'));
   res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");res.setHeader('Content-Disposition',asset.mediaType==='application/octet-stream'?'attachment':'inline');
   await serveFile(req,res,asset.base,asset.relative,{contentType:asset.mediaType,mediaRanges:true});return;
  }
  if(pathname==='/api/desktop/status'){json(res,200,{mode:policy.mode,globalMap:await mapPlan?.globalMap()??null,sourceTerrain:sourceMaps?.terrainCoverage()??[],starter:'CTX/Viking overview; MOLA 4 pixels/degree',model:inference?(await inference.status()).state:'unavailable',registryWarning:registry?.recoveredMessage,python:Boolean(python?.executable)});return;}
  if(pathname==='/api/desktop/observations'&&missionApi&&req.method==='GET'){json(res,200,await missionApi.list(url.searchParams));return;}
  if(pathname==='/api/desktop/source-maps'&&sourceMaps&&req.method==='GET'){json(res,200,sourceMaps.list());return;}
  if(pathname==='/api/desktop/source-imagery'&&sourceMaps&&req.method==='GET'){
   const asset=await sourceMaps.asset(url.searchParams);
   if(!asset){res.writeHead(404).end();return;}
   await serveFile(req,res,asset.root,asset.path);return;
  }
  if(pathname==='/api/packages'){json(res,200,await registry?.list()??[]);return;}
  if(pathname.startsWith('/packages/')&&registry){const [, ,id,...parts]=pathname.split('/');const asset=await registry.asset(id,parts.join('/'));res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");res.setHeader('Content-Disposition','attachment');await serveFile(req,res,asset.root,asset.path);return;}
  if(pathname==='/api/spacecraft'&&policy.mode==='offline'&&!url.searchParams.size){const historical=JSON.parse(await readFile(path.join(webRoot,'data/spacecraft/bootstrap.json'),'utf8'));json(res,200,{...historical,health:{state:'historical_offline'},offline:true});return;}
  if(pathname==='/api/planet'&&sourceMaps&&req.method==='GET'&&url.searchParams.get('kind')==='terrain'){
   const local=await sourceMaps.terrainTile(Object.fromEntries(url.searchParams));
   if(local){res.setHeader('Cache-Control','no-store');await serveFile(req,res,local.root,local.path);return;}
  }
  if(pathname==='/api/planet'&&mapPlan&&req.method==='GET'){const local=await mapPlan.tile(Object.fromEntries(url.searchParams));if(local){res.setHeader('Cache-Control','no-store');await serveFile(req,res,local.root,local.path);return;}}
  if(pathname==='/api/catalog'&&policy.mode==='offline'){json(res,200,localMaps?await localMaps.catalog():{schema:'mars-drive-cog-catalog/1',datasets:[],pilots:[],build_status:'complete',desktop_coverage:'coarse-starter-only'});return;}
  if(pathname==='/api/route'||pathname==='/api/moons'){
   if(pathname==='/api/route'&&req.method==='GET'){json(res,200,{status:python?.executable?'ready':'unavailable',profiles:['direct_safe','apf_survey','deep_science']});return;}
   if(pathname==='/api/route'&&req.method!=='POST'||pathname==='/api/moons'&&req.method!=='GET'){json(res,405,{error:'Unsupported method'});return;}
   if(pathname==='/api/moons'&&([...url.searchParams.keys()].some(k=>k!=='at')||url.searchParams.getAll('at').length>1)){json(res,400,{error:'Only one UTC at parameter is supported'});return;}
   const controller=new AbortController();res.on('close',()=>controller.abort());const result=await python.run(pathname==='/api/route'?'routing.service':'celestial.moons',pathname==='/api/route'?await readBody(req):{at:url.searchParams.get('at')},controller.signal);json(res,result.code===2||result.data.status==='error'?400:200,result.data);return;
  }
  if(pathname==='/api/ares'||pathname==='/api/chat'){if(!inference){json(res,503,{error:'ARES runtime unavailable; deterministic commands remain available.'});return;}if(req.method==='GET'){json(res,200,await inference.status());return;}if(req.method!=='POST'){json(res,405,{error:'Unsupported method'});return;}const controller=new AbortController();res.on('close',()=>controller.abort());json(res,200,await inference.chat(await readBody(req,262144),controller.signal));return;}
  if(pathname.startsWith('/api/')){const name=pathname.slice(5);if(!['catalog','raster','context','surface','elevation','planet','space-weather','wind','spacecraft','environment','geology'].includes(name)){json(res,404,{error:'Unknown endpoint'});return;}if(policy.mode==='offline'&&!(localMaps&&['raster','surface','elevation'].includes(name))){json(res,503,{error:'This source requires Online Mode or an installed compatible local dataset.',coverage:'unavailable'});return;}
   if(!handlers.has(name))handlers.set(name,(await import(pathToFileURL(path.join(webRoot,'api',name+'.mjs')))).default);req.query=Object.fromEntries(url.searchParams);res.status=n=>{res.statusCode=n;return res;};res.json=v=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));};await handlers.get(name)(req,res);return;
  }
  if(!['GET','HEAD'].includes(req.method)){json(res,405,{error:'Unsupported method'});return;}await serveFile(req,res,path.join(webRoot,'dist'),pathname==='/'?'index.html':'.'+pathname);
 }catch(error){log('service-error',{message:error.message});if(res.headersSent){res.destroy();return;}json(res,error.status??(error.code==='ENOENT'?404:503),{error:error.code==='ENOENT'?'Local asset unavailable':error.message});}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin=`http://127.0.0.1:${server.address().port}`;
 return {origin,token,server,async stop(){python?.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}

import http from 'node:http';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const port=Number(process.env.MARS_PORT??8770);
const vite=await createServer({server:{middlewareMode:true,ws:port===8770?undefined:{port:port+17008,host:'127.0.0.1'},watch:process.env.MARS_TEST_STABLE==='1'?null:undefined},appType:'spa'});
const routes=Object.fromEntries(await Promise.all(['catalog','raster','context','surface','elevation','planet','geology','space-weather','wind','spacecraft','environment'].map(async k=>[k,(await import(`./api/${k}.mjs`)).default])));
let injectedFailures=0;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');const handler=routes[url.pathname.split('/').pop()];
 if(url.pathname==='/api/moons'){
  res.setHeader('Content-Type','application/json');if(req.method!=='GET'){res.statusCode=405;res.end('{}');return;}
  if([...url.searchParams.keys()].some(k=>k!=='at')||url.searchParams.getAll('at').length>1){res.statusCode=400;res.end('{"error":"Only one UTC at parameter is supported."}');return;}
  const child=spawn(process.env.MARS_PYTHON??'python',['-m','celestial.moons'],{cwd:process.cwd(),windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,...(process.env.MARS_MOON_LIB?{PYTHONPATH:process.env.MARS_MOON_LIB}:{})}}),out=[];let errors='';const timer=setTimeout(()=>child.kill(),55000);child.stdout.on('data',x=>out.push(x));child.stderr.on('data',x=>{errors+=x.toString();});
  child.on('error',()=>{clearTimeout(timer);if(!res.writableEnded){res.statusCode=503;res.end('{"error":"Moon runtime unavailable."}');}});child.on('close',code=>{clearTimeout(timer);if(res.writableEnded)return;res.statusCode=code===2?400:code?503:200;if(code&&code!==2){console.warn('local_moons_failed',errors.slice(-1000));res.end('{"error":"Moon ephemerides unavailable."}');}else res.end(Buffer.concat(out));});child.stdin.end(JSON.stringify({at:url.searchParams.get('at')}));return;
 }
 if(url.pathname==='/api/route'){
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'){res.end(JSON.stringify({status:'ready',profiles:['direct_safe','apf_survey','deep_science']}));return;}
  if(req.method!=='POST'){res.statusCode=405;res.end('{}');return;}
  const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4_000_000){res.statusCode=413;res.end('{"error":"The sampled terrain request exceeds 4 MB. Use coarser cell spacing."}');return;}parts.push(chunk);}
  const child=spawn(process.env.MARS_PYTHON??'python',['-m','routing.service'],{cwd:process.cwd(),windowsHide:true,stdio:['pipe','pipe','pipe']}),out=[];let errors='';
  const timer=setTimeout(()=>child.kill(),295000);child.stdout.on('data',x=>out.push(x));child.stderr.on('data',x=>{errors+=x.toString();});
  child.on('error',()=>{clearTimeout(timer);if(!res.writableEnded){res.statusCode=503;res.end('{"error":"Python routing runtime is unavailable. Install requirements.txt."}');}});
  child.on('close',code=>{clearTimeout(timer);if(res.writableEnded)return;if(code){console.warn('local_route_failed',errors.slice(-1500));res.statusCode=500;res.end('{"error":"The local route engine did not finish."}');}else{const body=Buffer.concat(out).toString();try{const data=JSON.parse(body);res.statusCode=data.status==='error'?400:200;res.end(body);}catch{res.statusCode=500;res.end('{"error":"The route engine returned an invalid response."}');}}});child.stdin.end(Buffer.concat(parts));return;
 }
 // Optional QA mode reuses unchanged display packets from the live archive;
 // elevation and application code still run locally. No bulk files are staged.
 if(process.env.MARS_TEST_REFERENCE_SURFACE==='1'&&url.pathname==='/api/surface'){
  try{const r=await fetch('https://mars-field-atlas.vercel.app'+url.pathname+url.search,{signal:AbortSignal.timeout(60000)});res.statusCode=r.status;res.setHeader('Content-Type',r.headers.get('Content-Type')??'application/octet-stream');res.end(Buffer.from(await r.arrayBuffer()));}catch{res.statusCode=503;res.end();}return;
 }
 if(process.env.MARS_TEST_TERRAIN_RECOVERY==='1'&&url.pathname==='/api/raster'&&url.searchParams.get('asset')?.endsWith('/terrain/dem-overview')&&req.headers.range?.startsWith('bytes=131072-')&&injectedFailures<3){
  console.log('Injected terrain read failure',++injectedFailures);
  res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"controlled recovery check"}');return;
 }
 if(url.pathname==='/api/ares'||url.pathname==='/api/chat'){
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'){res.end(JSON.stringify({status:'ready',model:'ares-mars'}));return;}
  if(req.method!=='POST'){res.statusCode=405;res.end('{}');return;}
  const parts=[];for await(const chunk of req){parts.push(chunk);}
  const payload=Buffer.concat(parts).toString();
  try{
   const r=await fetch('http://127.0.0.1:11434/api/chat',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:payload,
    signal:AbortSignal.timeout(60000)
   });
   const data=await r.text();
   res.statusCode=r.status;
   res.end(data);
  }catch(err){
   res.statusCode=503;
   res.end(JSON.stringify({error:'Local ARES model engine unavailable',details:err.message}));
  }
  return;
 }
 if(url.pathname.startsWith('/api/')&&handler){req.query=Object.fromEntries(url.searchParams);res.status=s=>{res.statusCode=s;return res;};res.json=v=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));};await handler(req,res);}else vite.middlewares(req,res);
});
server.listen(port,'127.0.0.1',()=>console.log('Local map: http://127.0.0.1:'+port));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close();vite.close();});

// Only public map tiles are cached. Catalogues, credentials and changing feeds
// always use their normal network path. Source versions remain in every key.
const CACHE='mars-atlas-public-tiles-v1',MAX_BYTES=96*1024*1024,MAX_ITEMS=512,MAX_AGE=30*86400000;
let writes=Promise.resolve();
let inventory,usedBytes=0;
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
function eligible(request){const u=new URL(request.url);return request.method==='GET'&&u.origin===self.location.origin&&(['/api/planet','/api/surface','/api/elevation'].includes(u.pathname)||/^\/prepared\/tiles\/[a-f0-9]{64}\.webp$/.test(u.pathname))&&!request.headers.has('range');}
async function index(cache){
 if(inventory)return;
 const records=new Map();let total=0;
 for(const request of await cache.keys()){
  const r=await cache.match(request),bytes=Number(r?.headers.get('X-Atlas-Bytes'))||0;
  records.set(request.url,{request,bytes});total+=bytes;
 }
 inventory=records;usedBytes=total;
}
function touch(request){const key=request.url,record=inventory?.get(key);if(record){inventory.delete(key);inventory.set(key,record);}}
async function store(cache,request,response){
 const bytes=await response.arrayBuffer();if(bytes.byteLength>2_000_000)return;
 const headers=new Headers(response.headers);headers.delete('Content-Encoding');headers.delete('Content-Length');headers.set('X-Atlas-Cached-At',String(Date.now()));headers.set('X-Atlas-Bytes',String(bytes.byteLength));
 await index(cache);
 const key=request.url,previous=inventory.get(key);
 await cache.put(request,new Response(bytes,{status:200,headers}));
 usedBytes+=bytes.byteLength-(previous?.bytes??0);inventory.delete(key);inventory.set(key,{request,bytes:bytes.byteLength});
 while(inventory.size>MAX_ITEMS||usedBytes>MAX_BYTES){const [old,entry]=inventory.entries().next().value;await cache.delete(entry.request);inventory.delete(old);usedBytes-=entry.bytes;}
}
self.addEventListener('fetch',event=>{
 if(!eligible(event.request))return;
 event.respondWith((async()=>{
  let cache,cached;try{cache=await caches.open(CACHE);cached=await cache.match(event.request);}catch{}
  if(cached&&Date.now()-Number(cached.headers.get('X-Atlas-Cached-At'))<MAX_AGE){
   touch(event.request);
   return cached;
  }
  const response=await fetch(event.request);
  if(cache&&response.ok&&/^(image\/|application\/octet-stream)/.test(response.headers.get('Content-Type')??'')&&!/(private|no-store)/i.test(response.headers.get('Cache-Control')??'')){
   const copy=response.clone();writes=writes.catch(()=>{}).then(()=>store(cache,event.request,copy));event.waitUntil(writes.catch(()=>{}));
  }
  return response;
 })());
});

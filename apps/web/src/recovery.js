// A rejected GeoTIFF read may poison its internal block cache. Reopen that
// file before a later attempt rather than reusing the rejected decoder state.
export class RasterFileCache {
 constructor(load,limit=12){this.load=load;this.limit=limit;this.files=new Map();}
 async read(key,reader){
  let file=this.files.get(key);
  if(file)this.files.delete(key);
  else file=Promise.resolve().then(()=>this.load(key));
  this.files.set(key,file);
  while(this.files.size>this.limit)this.files.delete(this.files.keys().next().value);
  try{return await reader(await file);}
  catch(error){if(this.files.get(key)===file)this.files.delete(key);throw error;}
 }
 clear(prefix){if(prefix===undefined)this.files.clear();else for(const key of this.files.keys())if(key.startsWith(prefix))this.files.delete(key);}
}

export async function recoverSurfaceRead(task,{alive=()=>true,onRetry,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 for(let attempt=0;attempt<3;attempt++){
  if(!alive())throw new DOMException('The map view changed.','AbortError');
  try{return await task();}
  catch(error){
   if(!alive()||error?.permanent||attempt===2)throw error;
   onRetry?.(attempt+1);
   await wait(1500*2**attempt);
  }
 }
}

export function mapErrorMessage(error){
 const message=error?.message??String(error);
 if(error instanceof AggregateError||/Request failed|Failed to fetch|fetch failed|NetworkError/i.test(message))
  return 'Surface data could not be loaded after retrying. Select Refresh available data to try again.';
 return message;
}

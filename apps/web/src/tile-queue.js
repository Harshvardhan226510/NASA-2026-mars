export class TileQueue{
 constructor(limit=4,cacheLimit=48){this.limit=limit;this.cacheLimit=cacheLimit;this.active=0;this.jobs=new Map();this.queue=[];this.cache=new Map();}
 get(key,task,signal){
  if(signal?.aborted)return Promise.reject(new DOMException('View changed.','AbortError'));
  if(this.cache.has(key)){const value=this.cache.get(key);this.cache.delete(key);this.cache.set(key,value);return Promise.resolve(value);}
  let job=this.jobs.get(key);if(!job){job={key,task,controller:new AbortController(),consumers:new Set(),started:false};this.jobs.set(key,job);this.queue.push(job);}
  const promise=new Promise((resolve,reject)=>{const consumer={resolve,reject,signal};consumer.abort=()=>{job.consumers.delete(consumer);reject(new DOMException('View changed.','AbortError'));if(!job.consumers.size){job.controller.abort();if(this.jobs.get(key)===job)this.jobs.delete(key);}};job.consumers.add(consumer);signal?.addEventListener('abort',consumer.abort,{once:true});});this.drain();return promise;
 }
 drain(){while(this.active<this.limit&&this.queue.length){const job=this.queue.shift();if(!job.consumers.size||job.controller.signal.aborted)continue;this.active++;job.started=true;Promise.resolve().then(()=>job.task(job.controller.signal)).then(value=>{if(!job.controller.signal.aborted){this.cache.set(job.key,value);while(this.cache.size>this.cacheLimit)this.cache.delete(this.cache.keys().next().value);}for(const c of job.consumers)c.resolve(value);},e=>{for(const c of job.consumers)c.reject(e);}).finally(()=>{for(const c of job.consumers)c.signal?.removeEventListener('abort',c.abort);job.consumers.clear();if(this.jobs.get(job.key)===job)this.jobs.delete(job.key);this.active--;this.drain();});}}
}

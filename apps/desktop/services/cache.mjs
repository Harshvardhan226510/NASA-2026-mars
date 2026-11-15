export class BoundedCache {
 constructor({maxBytes=64*1024*1024,maxEntries=512,clock=()=>Date.now()}={}){this.maxBytes=maxBytes;this.maxEntries=maxEntries;this.clock=clock;this.bytes=0;this.entries=new Map();}
 remove(key){const old=this.entries.get(key);if(old)this.bytes-=old.bytes;this.entries.delete(key);}
 async get(key){const value=this.entries.get(key);if(!value)return undefined;if(value.expires<=this.clock()){this.remove(key);return undefined;}this.entries.delete(key);this.entries.set(key,value);return JSON.parse(value.json);}
 async set(key,value,{ttl=300}={}){if(!Number.isFinite(ttl)||ttl<=0){this.remove(key);return;}const json=JSON.stringify(value);if(json===undefined)return;const bytes=Buffer.byteLength(json);if(bytes>Math.min(this.maxBytes,2*1024*1024))return;this.remove(key);this.entries.set(key,{json,bytes,expires:this.clock()+ttl*1000});this.bytes+=bytes;while(this.bytes>this.maxBytes||this.entries.size>this.maxEntries)this.remove(this.entries.keys().next().value);}
}
const pool=new BoundedCache();
export function getCache({namespace='default'}={}){return {get:key=>pool.get(namespace+'\0'+key),set:(key,value,options)=>pool.set(namespace+'\0'+key,value,options)};}

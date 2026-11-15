import {BaseClient,BaseResponse} from 'geotiff';
let active=0;const queue=[],pending=new Map();
async function bounded(task){if(active<4)active++;else await new Promise(resolve=>queue.push(resolve));try{return await task();}finally{const next=queue.shift();if(next)next();else active--;}}
class RangeResponse extends BaseResponse{
 constructor(status,headers,data){super();this.code=status;this.headers=headers;this.data=data;}
 get status(){return this.code;}
 getHeader(name){return this.headers.get(name)??undefined;}
 async getData(){return this.data;}
}
export class RangeClient extends BaseClient{
 constructor(url,{fetcher=fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){super(url);this.fetcher=fetcher;this.wait=wait;}
 async request({headers,signal}={}){
  const key=this.url+'|'+new Headers(headers).get('range');
  if(pending.has(key))return pending.get(key);
  const read=bounded(async()=>{
   for(let attempt=0;attempt<3;attempt++){
    try{
     const performFetch=this.fetcher;
     const response=await performFetch(this.url,{headers,signal});
     if([429,502,503,504].includes(response.status)&&attempt<2){await response.body?.cancel();await this.wait(1000*2**attempt);continue;}
     if(!response.ok||response.status!==206||Number(response.headers.get('content-length')??0)>2097152){await response.body?.cancel();const error=new Error('Surface data is temporarily unavailable. Use Refresh available data to retry.');error.status=response.status;error.permanent=!response.ok&&!([429,502,503,504].includes(response.status));throw error;}
     const data=await response.arrayBuffer();
     return new RangeResponse(response.status,response.headers,data);
    }catch(error){if(error.permanent||signal?.aborted||attempt===2){console.warn('map_range_failed',this.url,error.status??'',error.message);throw error;}await this.wait(1000*2**attempt);}
   }
  });
  pending.set(key,read);try{return await read;}finally{pending.delete(key);}
 }
}

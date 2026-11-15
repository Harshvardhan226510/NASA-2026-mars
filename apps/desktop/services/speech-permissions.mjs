// A short lease is opened only by the main-frame push-to-talk IPC request.
export function permitsMicrophone({contents,mainContents,permission,url,origin,isMainFrame,audioOnly,leaseUntil,now=Date.now()}){
 try{return Boolean(mainContents&&!mainContents.isDestroyed()&&contents===mainContents&&permission==='media'&&isMainFrame===true&&audioOnly&&now<leaseUntil&&new URL(url).origin===origin&&new URL(url).pathname==='/');}catch{return false;}
}

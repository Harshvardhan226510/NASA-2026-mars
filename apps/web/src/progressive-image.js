// Show measured coarse terrain while a finer tile is pending. A late coarse
// result must never overwrite a completed finer one.
export async function progressiveImage(primary,coarse,onImage,signal){
 let shown=false,fine=false;const deliver=(image,isFine)=>{signal?.throwIfAborted();if(!image||fine&&!isFine)return;if(isFine)fine=true;onImage(image,!shown);shown=true;};
 const results=await Promise.allSettled([Promise.resolve(primary).then(v=>deliver(v,true)),Promise.resolve(coarse).then(v=>deliver(v,false))]);signal?.throwIfAborted();if(!shown)throw results.find(r=>r.status==='rejected')?.reason??Error('Overlay source unavailable.');
}

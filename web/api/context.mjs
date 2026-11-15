export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).end();
 try{
  const response=await fetch('https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg004/megr90n000cb.img',{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('MOLA source unavailable.');
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==2073600)throw new Error('MOLA source size changed.');
  res.setHeader('Content-Type','application/octet-stream');res.setHeader('Cache-Control','public, max-age=86400, s-maxage=86400');res.end(bytes);
 }catch(error){console.error('context_read_failed',error.message);res.status(502).json({error:'Global context elevation unavailable.'});}
}

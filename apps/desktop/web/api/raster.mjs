import {catalog,assets,parseRange,boundedDriveRead,cachedRange} from './drive.mjs';
export default async function handler(req,res){
 if(!['GET','HEAD'].includes(req.method))return res.status(405).end();
 const key=req.query.asset;
 if(typeof key!=='string'||key.length>200)return res.status(400).json({error:'Choose a published map asset.'});
 try{
  const asset=assets(await catalog()).get(key);
  if(!asset)return res.status(404).json({error:'Map asset not found.'});
  const size=Number(asset.bytes),range=req.headers.range;
  if(!Number.isSafeInteger(size)||size<1||size>=24_000_000)throw new Error('Unverified asset size.');
  res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Type',asset.mime??'image/tiff');
  if(req.method==='HEAD'){res.setHeader('Content-Length',String(size));res.setHeader('Cache-Control','public, max-age=3600');return res.status(200).end();}
  if(!range&&asset.mime!=='image/jpeg')return res.status(416).json({error:'Request a bounded byte range.'});
  const bounds=range?parseRange(range,size):null;
  const normalizedRange=bounds?`bytes=${bounds.start}-${bounds.end}`:undefined;
  const result=bounds?await cachedRange(asset,normalizedRange,bounds.end-bounds.start+1):await boundedDriveRead(asset.id,{maxBytes:2_097_152});
  if(bounds&&result.contentRange!==`bytes ${bounds.start}-${bounds.end}/${size}`)throw new Error('Drive range identity differs from the published asset.');
  if(bounds&&result.bytes.length!==bounds.end-bounds.start+1)throw new Error('Truncated Drive raster range.');
  res.setHeader('Vary','Range');res.setHeader('Cache-Control',bounds?'private, max-age=86400':'public, max-age=86400, s-maxage=86400');
  if(result.contentRange)res.setHeader('Content-Range',result.contentRange);
  res.setHeader('Content-Length',String(result.bytes.length));res.setHeader('X-Map-Storage',asset.id.startsWith('local_')?'Verified local package':'Google Drive');
  res.status(bounds?206:200).end(result.bytes);
 }catch(error){console.error('raster_read_failed',key,error.message);res.setHeader('Cache-Control','no-store');res.status(503).json({error:'This Drive raster could not be read. Retry shortly.'});}
}

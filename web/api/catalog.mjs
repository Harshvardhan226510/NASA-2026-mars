import {catalog} from './drive.mjs';
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).end();
 try{const data=await catalog();res.setHeader('Cache-Control','public, max-age=15, s-maxage=30');res.json(data);}
 catch(error){console.error('catalog_read_failed',error.message);res.setHeader('Cache-Control','no-store');res.status(503).json({error:'The Drive map catalogue is temporarily unavailable.'});}
}

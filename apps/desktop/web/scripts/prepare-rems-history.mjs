// Stream the official PDS table, retaining the raw-response hash. A 15-minute
// LMST bin reports mean/range/count, and the range of published SYSTEMATIC
// uncertainties. It never divides those uncertainties by sqrt(sample count).
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const REMS_ROOT='https://atmos.nmsu.edu/PDS/data/PDS4/msl_rems_bundle/';
export function uvRow(line){
 const p=line.trim().split(',').map(Number);
 if(p.length!==24||!Number.isInteger(p[0])||!p.every(Number.isFinite))throw Error('Unexpected REMS UV row schema');
 // Columns 13–18 are the calibrated channels, 19–24 their uncertainties.
 return {sol:p[0],lmst:p[1],zenith:p[2],values:p.slice(12,18).map(x=>x===-999?null:x),uncertainties:p.slice(18,24).map(x=>x===-999?null:x)};
}
export function addUvRow(bins,row){
 if(row.lmst<0||row.lmst>=24||row.zenith<0||row.zenith>55)return;
 const key=row.sol+':'+Math.floor(row.lmst*4);let bin=bins.get(key);
 if(!bin){bin={sol:row.sol,lmst:Math.floor(row.lmst*4)/4+.125,channels:Array.from({length:6},()=>({sum:0,count:0,min:Infinity,max:-Infinity,uncertainty_min:Infinity,uncertainty_max:-Infinity,uncertainty_count:0}))};bins.set(key,bin);}
 row.values.forEach((value,i)=>{if(value===null)return;const c=bin.channels[i];c.sum+=value;c.count++;c.min=Math.min(c.min,value);c.max=Math.max(c.max,value);const u=row.uncertainties[i];if(u!==null&&u>=0){c.uncertainty_min=Math.min(c.uncertainty_min,u);c.uncertainty_max=Math.max(c.uncertainty_max,u);c.uncertainty_count++;}});
}
export function finishUvBins(bins){return [...bins.values()].sort((a,b)=>a.sol-b.sol||a.lmst-b.lmst).map(b=>({...b,channels:b.channels.map(c=>({mean:c.count?c.sum/c.count:null,min:c.count?c.min:null,max:c.count?c.max:null,count:c.count,uncertainty_min:c.uncertainty_count?c.uncertainty_min:null,uncertainty_max:c.uncertainty_count?c.uncertainty_max:null,uncertainty_count:c.uncertainty_count}))}));}
async function main(){
 const base='data_uv_corrected/REMS_UVS_3401_3500',labelResponse=await fetch(REMS_ROOT+base+'.xml');if(!labelResponse.ok)throw Error('PDS label unavailable');const label=await labelResponse.text();
 const rows=Number(label.match(/<records>(\d+)<\/records>/)?.[1]);if(rows!==724717)throw Error('Source changed; review the new label before repackaging');
 const instrumentResponse=await fetch(REMS_ROOT+'document/REMS_INST.CAT');if(!instrumentResponse.ok)throw Error('Instrument definitions unavailable');const instrument=await instrumentResponse.text();
 const response=await fetch(REMS_ROOT+base+'.TAB');if(!response.ok)throw Error('PDS table unavailable');
 const hash=createHash('sha256'),bins=new Map();let text='',count=0,bytes=0,firstSol=Infinity,lastSol=-Infinity;const consume=line=>{const row=uvRow(line);firstSol=Math.min(firstSol,row.sol);lastSol=Math.max(lastSol,row.sol);addUvRow(bins,row);count++;};
 for await(const chunk of response.body){hash.update(chunk);bytes+=chunk.length;text+=Buffer.from(chunk).toString('ascii');let newline;while((newline=text.indexOf('\n'))>=0){const line=text.slice(0,newline);text=text.slice(newline+1);if(line.trim())consume(line);}if(bytes%50000000<chunk.length)console.log('UV source MB',Math.round(bytes/1e6));}
 if(text.trim())consume(text);if(count!==rows)throw Error('Incomplete PDS table');
 const date=tag=>label.match(new RegExp('<'+tag+'>([^<]+)</'+tag+'>'))?.[1];
 const packet={schema:'mars-rems-uv-history/1',kind:'historical_local_observation',source:'NASA PDS REMS corrected UV, REMS_UVS_3401_3500',units:'W/m²',time_basis:'Mars Science Laboratory sol / local mean solar time (LMST); bins are not UTC',label_time_bounds:{start:date('start_date_time'),end:date('stop_date_time')},observed_sol_range:[firstSol,lastSol],coverage_warning:'The product filename and label nominal bounds reach sol 3500 / June 2022, but the retrieved table rows end at sol 3423. Only actual row coverage is displayed.',product_lidvid:label.match(/<logical_identifier>([^<]+)<\/logical_identifier>/)?.[1]+'::'+label.match(/<version_id>([^<]+)<\/version_id>/)?.[1],prepared_at:new Date().toISOString(),channels:[{id:'A',band_nm:[315,370]},{id:'B',band_nm:[280,320]},{id:'C',band_nm:[220,280]},{id:'ABC',band_nm:[200,370]},{id:'D',band_nm:[230,290]},{id:'E',band_nm:[300,350]}],provenance:[{url:REMS_ROOT+base+'.TAB',sha256:hash.digest('hex'),bytes,rows:count},{url:REMS_ROOT+base+'.xml',sha256:createHash('sha256').update(label).digest('hex')},{url:REMS_ROOT+'document/REMS_INST.CAT',sha256:createHash('sha256').update(instrument).digest('hex'),purpose:'Published instrument band definitions'}],aggregation:'15-minute LMST bins: arithmetic mean, observed min/max and valid sample count; min/max of published systematic uncertainties are kept separately. No uncertainty reduction or overlapping-band addition.',limitations:'Local rover archive (2022); not live and not a global UV field. Instrument bands differ from standard UVA/UVB definitions. Zenith >55° and -999 are excluded as unavailable, not zero. Gale marker is a regional reference, not the rover position at each sample.',bins:finishUvBins(bins)};
 const output=new URL('../public/science/history/rems-uv.json',import.meta.url);await mkdir(new URL('.',output),{recursive:true});await writeFile(output,JSON.stringify(packet)+'\n');console.log(JSON.stringify({rows:count,bins:packet.bins.length,bytes,observed_sol_range:packet.observed_sol_range}));
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();

import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {PackageRegistry} from '../services/packages.mjs';
import {NetworkPolicy} from '../services/network-policy.mjs';
import {LocalMapProvider,setLocalMapProvider} from '../services/local-maps.mjs';
import {DownloadManager} from '../services/downloads.mjs';
import {startServer} from '../services/server.mjs';
import {PythonService} from '../services/python.mjs';
import {tileVersion,unpackTile,planTiles} from '../web/src/lod.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),fixture=path.join(root,'artifacts/authentic-overview-package');
const manifest=JSON.parse(await readFile(path.join(fixture,'manifest.json'),'utf8'));
const workspace=await mkdtemp(path.join(root,'artifacts/map-integration-'));
const registry=await new PackageRegistry(path.join(workspace,'user')).load();
const policy=new NetworkPolicy('online');const rawFetch=globalThis.fetch.bind(globalThis);
const report={source:'Two genuine checksum-pinned Arcadia source overview COGs; no synthetic map data',workspace};
if(process.argv.includes('--exercise-download')){
 const sources=Object.entries(manifest.sourceFiles).map(([fileId,file])=>({path:file,provider:'google-drive',fileId}));
 const entry={approved:true,manifest,sources};const downloadDirectory=path.join(workspace,'download-storage');
 const fingerprint=createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0,20);
 const stage=path.join(downloadDirectory,'downloads',manifest.id+'-'+fingerprint);await mkdir(stage,{recursive:true});
 await writeFile(path.join(stage,manifest.files[0].path+'.part'),(await readFile(path.join(fixture,manifest.files[0].path))).subarray(0,256));
 const downloads=new DownloadManager({registry,policy,fetcher:(input,options)=>policy.fetch(rawFetch,input,options),directory:()=>downloadDirectory});
 const job=downloads.start(entry);await downloads.jobs.get(job).promise;const status=downloads.snapshot()[0];assert.equal(status.state,'installed',status.error);report.download={state:status.state,total:status.total,resumedBytes:status.resumedBytes,restartedSources:status.restartedSources};
}else{await registry.import(fixture);report.download='Not run';}
policy.setMode('offline');const provider=new LocalMapProvider(registry,policy);setLocalMapProvider(provider);
const service=await startServer({webRoot:path.join(root,'web'),policy,python:new PythonService(),registry,localMaps:provider});
let externalAttempts=0;const restoreNative=policy.installNativeGuards();globalThis.fetch=(input,options)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(url.origin!==service.origin){externalAttempts++;throw Error('Integration test blocked external request');}return rawFetch(input,options);};
try{
 const headers={'x-atlas-token':service.token};
 const catalog=await fetch(service.origin+'/api/catalog',{headers}).then(r=>r.json());assert.equal(catalog.datasets.length,1);const dataset=catalog.datasets[0];assert.equal(dataset.desktopStorage,'verified-local-package');assert.ok(dataset.terrain[0].id.startsWith('local_'));
 const raster=await fetch(service.origin+'/api/raster?asset='+encodeURIComponent(dataset.id+'/imagery/'+dataset.imagery[0].key),{headers:{...headers,Range:'bytes=0-1023'}});assert.equal(raster.status,206,await raster.clone().text());assert.deepEqual(Buffer.from(await raster.arrayBuffer()),(await readFile(path.join(fixture,'imagery-overview.tif'))).subarray(0,1024));
 await Promise.all(Array.from({length:12},async()=>{await provider.catalog();const concurrent=await fetch(service.origin+'/api/raster?asset='+encodeURIComponent(dataset.id+'/imagery/'+dataset.imagery[0].key),{headers:{...headers,Range:'bytes=0-1023'}});assert.equal(concurrent.status,206,await concurrent.clone().text());assert.equal((await concurrent.arrayBuffer()).byteLength,1024);}));report.concurrentCatalogueAndRangeReads=12;
 const surface=await fetch(service.origin+'/api/surface?dataset='+encodeURIComponent(dataset.id)+'&v='+tileVersion(dataset)+'&tile=overview',{headers});assert.equal(surface.status,200,await surface.clone().text());const packet=unpackTile(await surface.arrayBuffer());const finite=[...packet.heights].filter(Number.isFinite);assert.ok(finite.length>1000);assert.ok(packet.pixels.some((value,index)=>index%2===1&&value>0));assert.ok(packet.terrainGrid>1&&packet.imageryGrid>1);
 let best=null;for(let row=32;row<480;row++)for(let col=32;col<480;col++){const i=(row*512+col)*2;if(packet.pixels[i+1]<128)continue;const score=(row-256)**2+(col-256)**2;if(!best||score<best.score)best={row,col,score};}if(best)report.validFocus=[dataset.bounds[0]+(best.col+.5)/512*(dataset.bounds[2]-dataset.bounds[0]),dataset.bounds[3]-(best.row+.5)/512*(dataset.bounds[3]-dataset.bounds[1])];
 if(report.validFocus){const [lon,lat]=report.validFocus;const [tile]=planTiles(dataset,[lon-.01,lat-.01,lon+.01,lat+.01],3,report.validFocus,9);const detail=await fetch(service.origin+'/api/surface?dataset='+encodeURIComponent(dataset.id)+'&v='+tileVersion(dataset)+'&tile='+encodeURIComponent(tile.id),{headers});assert.equal(detail.status,200);const fine=unpackTile(await detail.arrayBuffer());const values=new Set();for(let i=0;i<fine.pixels.length;i+=2)if(fine.pixels[i+1]>=128)values.add(fine.pixels[i]);assert.ok(values.size>10,'Close view must retain real photographic variation instead of a blank tile');report.closeView={distinctPhotographicValues:values.size,imageryMetersPerPixel:fine.imageryGrid};}
 report.offline={catalogueDatasets:catalog.datasets.length,originalRasterRangeExact:true,finiteElevationNodes:finite.length,totalElevationNodes:packet.heights.length,imageryMetersPerPixel:packet.imageryGrid,terrainMetersPerNode:packet.terrainGrid,externalAttempts};assert.equal(externalAttempts,0);
 await registry.setActive(manifest.id,false);assert.equal((await provider.catalog()).datasets.length,0);report.activation=true;
 await registry.setActive(manifest.id,true);assert.equal((await provider.catalog()).datasets.length,1);report.reactivation=true;
 await writeFile(path.join(root,'artifacts/local-map-integration-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{globalThis.fetch=rawFetch;restoreNative();setLocalMapProvider(undefined);await service.stop();}

import {spawnSync} from 'node:child_process';
import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const result=spawnSync(process.execPath,[path.join(root,'web/node_modules/vite/bin/vite.js'),'build'],{cwd:path.join(root,'web'),stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
await cp(path.join(root,'web/src/desktop-speech-worklet.js'),path.join(root,'web/dist/desktop-speech-worklet.js'));
const cesium=path.join(root,'node_modules/cesium/Build/Cesium');await cp(cesium,path.join(root,'web/dist/vendor/cesium'),{recursive:true});
for(const notice of ['LICENSE.md','ThirdParty.json','ThirdParty.extra.json'])await cp(path.join(root,'node_modules/cesium',notice),path.join(root,'web/dist/vendor/cesium',notice));
const assets=['globe-overview-0.jpg','globe-overview-1.jpg','color-overview-0.jpg','color-overview-1.jpg','mola-topography.dat','globe-overview-provenance.json','mola-provenance.json','color-context-provenance.json'];
const files=[];for(const name of assets){const bytes=await readFile(path.join(root,'web/public',name));files.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await mkdir(path.join(root,'maps'),{recursive:true});await writeFile(path.join(root,'maps/starter-manifest.json'),JSON.stringify({schema:'mars-starter/1',id:'mars-global-overview',version:'1.0.0',bounds:[-180,-90,180,90],coordinates:'east-positive planetocentric degrees',elevationDatum:'MOLA published topography relative to Mars areoid',imageryMetersPerPixelAtEquator:5210,elevationPixelsPerDegree:4,credit:'NASA/JPL/MSSS; Caltech Murray Lab; NASA Viking; NASA/MGS MOLA',redistributionStatus:'Release rights audit pending; source credits retained',limitations:'Coarse overview only. No HiRISE coverage or operational navigation clearance implied.',files},null,2)+'\n');
console.log('Built production viewer, local Cesium assets, and authentic starter inventory.');

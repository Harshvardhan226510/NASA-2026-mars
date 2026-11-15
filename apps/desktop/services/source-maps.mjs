import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, statfs, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import Lerc from 'lerc';
import {sourceMapEstimate, sourceMapTiles, sourceStorageRequired, mapSource, sourceMeters, sourceCoverage} from '../web/src/source-map-plan.js';
import {geographicBounds} from '../web/src/planet-grid.js';
import {normalizeTile} from '../web/api/planet.mjs';
import {pointInSelection, selectionShape} from '../web/src/map-area.js';

const relative = ({z, y, x}, product) => 'tiles/'+z+'/'+y+'/'+x+'.'+product.extension;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const tileQuery = query => ['z','y','x'].map(key => /^\d{1,8}$/.test(query.get(key)??'') ? Number(query.get(key)) : NaN);

async function fetchTile(fetcher, url, signal, product, sourceId) {
  const response = await fetcher(url, {headers: {'Accept-Encoding': 'identity'}, signal: AbortSignal.any([signal, AbortSignal.timeout(25000)])});
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    if (product.sparse && [204, 404, 410].includes(response.status)) return null;
    throw Object.assign(Error(product.name+' returned HTTP '+response.status),{retryable:response.status===429||response.status>=500});
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > product.tileBytes) throw Error('Source tile exceeds its storage limit.');
    chunks.push(chunk);
  }
  try {
    return normalizeTile(Buffer.concat(chunks), product.role==='terrain'?'terrain':sourceId==='ctx'?'imagery':'baseline');
  } catch (error) {
    if (product.sparse && error.sourceMissing) return null;
    throw Error(product.name+' returned an invalid tile: '+(error?.message??String(error)),{cause:error});
  }
}

async function downloadTile(fetcher,url,signal,product,sourceId,tile) {
  for (let attempt=0; ; attempt++) {
    signal.throwIfAborted();
    try {return await fetchTile(fetcher,url,signal,product,sourceId);}
    catch (error) {
      signal.throwIfAborted();
      if (attempt===2 || error.retryable===false) {
        throw Error(`${product.name}, tile ${tile.z}/${tile.y}/${tile.x}: ${error.message}`,{cause:error});
      }
      await delay(500*2**attempt,undefined,{signal});
    }
  }
}

function inventory(entry) {
  if (!entry.active || !entry.manifest.sourceImagery) return null;
  const {level, appearance, selection, sourceId='viking', gaps=[]} = entry.manifest.sourceImagery;
  try {
    const product = mapSource(sourceId);
    const bounds = sourceCoverage(selectionShape(selection),product);
    if (!bounds.length || !Number.isInteger(level) || level<product.min || level>product.max) return null;
    return {id:entry.manifest.id,sourceId,product,selection,bounds,level,appearance,gaps:gaps.length,
      name:entry.manifest.name,credit:product.credit,metresPerPixel:sourceMeters(level,sourceId),tilePixels:product.pixels};
  } catch {return null;}
}

export function validateSourceImagery(manifest) {
  if (!manifest.sourceImagery) return;
  const {level, appearance, selection, sourceId='viking', gaps=[]} = manifest.sourceImagery;
  const product=mapSource(sourceId);
  const plan=sourceMapEstimate(selection,level,appearance,sourceId);
  const stored=new Set(manifest.files.map(file=>file.path));
  if(!Array.isArray(gaps)||gaps.length>plan.tileCount||(gaps.length&&!product.sparse)||stored.size+gaps.length!==plan.tileCount)
    throw Error('Incomplete or inconsistent source tile inventory');
  const missing=new Set(gaps);
  if(missing.size!==gaps.length||gaps.some(file=>stored.has(file)))throw Error('Invalid source gaps');
  let finest=false;
  for(const tile of sourceMapTiles(plan)){
    const file=relative(tile,product);
    if(!stored.has(file)&&!missing.has(file))throw Error('Incomplete or inconsistent source tile inventory');
    if(tile.z===level&&stored.has(file))finest=true;
  }
  if(!finest)throw Error('No source tiles at the selected resolution');
}

export class SourceMaps {
  constructor({registry, policy, fetcher, directory, prepareTile, notify}) {
    Object.assign(this,{registry,policy,fetcher,directory,prepareTile,notify});
    this.job=null;
    this.terrainCache=new Map();
    this.inventoryCache=new WeakMap();
  }

  status() {return this.job;}

  stop() {
    this.controller?.abort();
    return this.pending?.catch(()=>{});
  }

  layers() {
    return this.registry.entries.filter(entry=>entry.active&&entry.manifest.sourceImagery).map(entry=>{
      if(!this.inventoryCache.has(entry.manifest))this.inventoryCache.set(entry.manifest,inventory(entry));
      return this.inventoryCache.get(entry.manifest);
    }).filter(Boolean);
  }

  list() {
    return this.layers().filter(item=>item.product.role==='imagery').map(({product,selection,...item})=>({...item,productName:product.name}));
  }

  terrainCoverage() {
    return this.layers().filter(item=>item.product.role==='terrain').map(({level,bounds})=>({level,bounds}));
  }

  async start(input) {
    if(this.pending)throw Error('A source map download is already running.');
    this.pending=this.install(input);
    try{return await this.pending;}
    finally{this.pending=null;}
  }

  async install({selection,level,appearance,sourceId='viking'}) {
    if(this.policy.mode!=='online')throw Error('Select Online Mode before downloading a map.');
    const product=mapSource(sourceId),plan=sourceMapEstimate(selection,level,appearance,sourceId);
    appearance=plan.appearance;
    const id=sourceId+'-'+sha256(JSON.stringify([plan.selection,level,appearance])).slice(0,24);
    const existing=this.registry.entries.find(entry=>entry.manifest.id===id);
    if(existing){
      if(!await this.registry.available(existing))throw Error('Saved map files are missing or changed. Unregister the map in Your maps, then download it again.');
      if(!existing.active)await this.registry.setActive(id,true);
      this.job={state:'installed',received:existing.manifest.files.reduce((total,file)=>total+file.bytes,0),completed:plan.tileCount,total:plan.tileCount,missing:existing.manifest.sourceImagery.gaps?.length??0};
      this.notify({id,state:'installed'});
      return {id,partial:plan.partial,...this.job};
    }
    const controller=this.controller=new AbortController();
    this.job={state:'downloading',received:0,completed:0,total:plan.tileCount,missing:0};
    let staging;
    const base=path.resolve(this.directory());
    try{
      await mkdir(base,{recursive:true});
      const disk=await statfs(base);
      if(disk.bavail*disk.bsize<sourceStorageRequired(plan))throw Error('Insufficient free storage for this selection. Choose a lower resolution or another drive.');
      if(plan.tileCount>1000000)throw Error('This selection exceeds the supported map index size. Download it in smaller sections.');
      staging=await mkdtemp(path.join(base,id+'-'));
      const files=[],gaps=[];
      const url=product.urlForAppearance?.(appearance)??product.url;
      for(const tile of sourceMapTiles(plan)){
        const file=relative(tile,product);
        const source=await downloadTile(this.fetcher,url(tile.x,tile.y,tile.z),controller.signal,product,sourceId,tile);
        const bytes=!source?null:product.role==='terrain'?source.bytes:this.prepareTile(source,appearance,product,sourceId);
        if(!bytes){gaps.push(file);if(tile.z===level)this.job.missing++;}
        else{
          if(!bytes.length||bytes.length>product.tileBytes)throw Error('Converted imagery exceeds the tile size limit.');
          const target=path.join(staging,file);
          await mkdir(path.dirname(target),{recursive:true});
          await writeFile(target,bytes);
          files.push({path:file,bytes:bytes.length,sha256:sha256(bytes)});
          this.job.received+=bytes.length;
        }
        this.job.completed++;
      }
      controller.signal.throwIfAborted();
      if(!files.some(file=>file.path.startsWith('tiles/'+level+'/')))throw Error('This source has no imagery or elevation at the selected quality and location.');
      const [w,s,e,n]=plan.selection.bounds;
      const manifest={schema:'mars-map-package/1',id,version:'1.0.0',name:product.name+' · '+Number(plan.metresPerPixel.toPrecision(3))+' m/px'+(product.role==='terrain'?' grid':''),
        bounds:w<e?[w,s,e,n]:[-180,s,180,n],coordinates:'east-positive planetocentric degrees',
        elevationDatum:product.role==='terrain'?'Mars areoid':'Imagery only',sourceImagery:{sourceId,level,appearance,selection:plan.selection,gaps},files,
        provenance:{source:product.reference,credit:product.credit,rights:'Publisher attribution retained',service:new URL(url(0,0,0)).origin,
          transformation:sourceId==='viking'&&appearance==='grayscale'?'Grayscale derived from publisher-colorized imagery':product.role==='terrain'?'Numeric source elevation':'Display tiles'}};
      await writeFile(path.join(staging,'manifest.json'),JSON.stringify(manifest));
      const installed=await this.registry.import(staging);
      staging=null;
      this.job.state='installed';
      this.notify({id,state:'installed'});
      return {id:installed.id,partial:plan.partial,...this.job};
    }catch(error){
      this.job.state=controller.signal.aborted?'cancelled':'failed';
      this.job.error=error?.message??String(error);
      throw error instanceof Error?error:Error(this.job.error);
    }finally{
      try{if(staging&&path.dirname(path.resolve(staging))===base)await rm(staging,{recursive:true,force:true});}
      finally{this.controller=null;}
    }
  }

  async asset(query) {
    const [z,y,x]=tileQuery(query);
    if(![z,y,x].every(Number.isInteger)||z>17||y>=2**z||x>=2**(z+1))return null;
    const item=this.layers().find(item=>item.id===query.get('id')&&item.product.role==='imagery');
    if(!item||z>item.level)return null;
    return this.registry.asset(item.id,relative({x,y,z},item.product)).catch(()=>null);
  }

  async terrainTile(query) {
    const [z,y,x]=['z','y','x'].map(key=>/^\d{1,6}$/.test(String(query[key]))?Number(query[key]):NaN);
    if(![z,y,x].every(Number.isInteger)||z<1||z>7||y>=2**z||x>=2**(z+1))return null;
    for(const item of this.layers()){
      if(item.product.role!=='terrain'||z>item.level)continue;
      const file=await this.registry.asset(item.id,relative({x,y,z},item.product)).catch(()=>null);
      if(file)return file;
    }
    return null;
  }

  async terrainGridAt(point, layers=this.layers()) {
    const matches=layers.filter(item=>item.product.role==='terrain'&&item.bounds.some(([w,s,e,n])=>point[0]>=w&&point[0]<=e&&point[1]>=s&&point[1]<=n)&&pointInSelection(point,item.selection))
      .sort((a,b)=>b.level-a.level);
    for(const item of matches){
      const z=item.level,columns=2**(z+1),rows=2**z;
      const x=Math.min(columns-1,Math.floor((point[0]+180)/360*columns)),y=Math.min(rows-1,Math.floor((90-point[1])/180*rows));
      const file=await this.registry.asset(item.id,relative({x,y,z},item.product)).catch(()=>null);
      if(!file)continue;
      const key=path.join(file.root,file.path);
      if(this.terrainCache.has(key))return this.terrainCache.get(key);
      const bytes=await readFile(key);
      const data=Lerc.decode(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
      if(data.width!==513||data.height!==513)throw Error('Invalid saved elevation grid');
      const grid=data.pixels[0];
      if(data.mask)for(let i=0;i<grid.length;i++)if(!data.mask[i])grid[i]=NaN;
      const result={grid,width:513,bounds:geographicBounds(x,y,z),gridMeters:item.metresPerPixel,credit:item.credit};
      this.terrainCache.set(key,result);
      while(this.terrainCache.size>8)this.terrainCache.delete(this.terrainCache.keys().next().value);
      return result;
    }
    return null;
  }
}

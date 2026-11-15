import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {marsSun,solarAt} from '../web/src/solar-geometry.js';
import {destination} from '../web/src/terrain-metrics.js';
import {MARS_RADIUS_M} from '../web/src/global-terrain.js';

export function createPointInspector(mission,webRoot) {
  let radiationArchive;
  async function terrainAt(point,at) {
    const [terrain]=await mission.queryTerrain([point]);
    const {source,elevationMeters:height}=terrain;
    if(!Number.isFinite(height)||!Number.isFinite(source?.gridMeters)||Math.abs(point[1])>=89.9)return {terrain};
    const step=source.gridMeters;
    const offsets=[-1,0,1].flatMap(north=>[-1,0,1].map(east=>[east,north])).filter(([e,n])=>e||n);
    const neighbors=offsets.map(([east,north])=>destination(...point,east*step,north*step));
    let sun;
    try {sun=solarAt(marsSun(at),...point);} catch {}
    const ray=[];
    if(sun?.elevation>0&&step<=1000){
      const angle=sun.azimuth*Math.PI/180;
      for(let i=1;i<=8;i++)ray.push(destination(...point,Math.sin(angle)*step*i,Math.cos(angle)*step*i));
    }
    const samples=await mission.queryTerrain([...neighbors,...ray]);
    const compatible=sample=>sample?.source?.id===source.id&&sample.source.gridMeters===step&&Number.isFinite(sample.elevationMeters);
    const around=samples.slice(0,neighbors.length);
    const heights=[height,...around.map(sample=>sample.elevationMeters)];
    const neighborhood=around.every(compatible)?{rangeMeters:Math.max(...heights)-Math.min(...heights)}:null;
    let shadow=null;
    const along=samples.slice(neighbors.length);
    if(ray.length&&along.every(compatible)){
      const blocked=along.some((sample,i)=>{
        const angle=(i+1)*step/MARS_RADIUS_M, radius=MARS_RADIUS_M+sample.elevationMeters;
        return Math.atan2(radius*Math.cos(angle)-MARS_RADIUS_M-height,radius*Math.sin(angle))>sun.elevation*Math.PI/180;
      });
      shadow={at,reachMeters:ray.length*step,blocked};
    }
    return {terrain,neighborhood,shadow};
  }
  async function environmentAt(point) {
    const archiveAt=await mission.environmentArchiveTimes();
    const now=new Date().toISOString();
    const fields=await Promise.all(['Tair','Tsurf','Psurf'].map(async parameter=>{
      const query={lon:point[0],lat:point[1],parameter};
      const measured=await mission.environment(new URLSearchParams({...query,at:now,kind:'measured'}));
      const archive=archiveAt[parameter]?await mission.environment(new URLSearchParams({...query,at:archiveAt[parameter],kind:'modeled'})):null;
      return {parameter,observed:measured.observations?.[0]??null,archive};
    }));
    radiationArchive??=readFile(path.join(webRoot,'data','space-weather','bootstrap.json'),'utf8').then(JSON.parse).then(data=>data.feeds?.rad).catch(()=>null);
    const rad=await radiationArchive;
    const channel=rad?.channels?.find(item=>item.id===rad.default_channel);
    const sample=channel&&rad.samples?.findLast(item=>Number.isFinite(item.values?.[channel.id]));
    const radiation=sample?{time:sample.time,value:sample.values[channel.id],unit:channel.unit,label:channel.label}:null;
    return {fields,radiation};
  }
  return (section,point,at)=>{
    if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90)throw Error('Invalid Mars point.');
    if(section==='terrain')return terrainAt(point,at);
    if(section==='environment')return environmentAt(point);
    throw Error('Unknown inspector section.');
  };
}

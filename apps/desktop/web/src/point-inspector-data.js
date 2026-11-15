import {distanceKm} from './place-context.js';
import {loadReference,sampleReference} from './scientific-data.js';
import {geologyImage} from './geology-tiles.js';
import {GEOLOGY_MAX_LEVEL,validateGeologyLegend} from './geology-grid.js';
import {geographicBounds} from './planet-grid.js';
import {marsSun,solarAt,SOLAR_SOURCE} from './solar-geometry.js';
import {spacingText} from './surface-readout.js';

export const line=(name,value,kind,detail='',url)=>({name,value,kind,detail,url});
export const missing=(name,detail)=>line(name,'Unavailable','Unavailable',detail);
export const number=(value,digits=2)=>Number.isFinite(value)?value.toLocaleString(undefined,{maximumFractionDigits:digits}):'Unavailable';
export const distance=(value)=>number(value,2)+' km';
export const inside=([lon,lat],[w,s,e,n])=>lat>=s&&lat<=n&&(w<=e?lon>=w&&lon<=e:lon>=w||lon<=e);
export function nearest(point,items,radius,limit=4) {
  return items.filter(item=>Array.isArray(item.point)&&item.point.length===2&&item.point.every(Number.isFinite))
    .map(item=>({...item,distance:distanceKm(point,item.point)}))
    .filter(item=>item.distance<=radius).sort((a,b)=>a.distance-b.distance).slice(0,limit);
}
export function tileAt(point,z) {
  const rows=2**z;
  return {x:Math.min(rows*2-1,Math.floor((point[0]+180)/180*rows)),y:Math.min(rows-1,Math.floor((90-point[1])/180*rows)),z};
}
async function json(url,signal) {
  const response=await fetch(url,{signal});
  if(!response.ok)throw Error('Source unavailable');
  return response.json();
}
let referenceManifest;
const mineralBands = [
  ['olivine-abundance','Olivine'],['pyroxene-abundance','Pyroxene'],
  ['feldspar-abundance','Feldspar'],['hematite-abundance','Hematite'],['glass-clay','Glass / sheet silicates'],
];
const iceBands=[['ice-0_1','Ice consistency (0–1 m sensing band)']];
async function referenceRows(point,signal,update) {
  const manifest=await (referenceManifest??=json('/scientific/manifest.json').catch(error=>{referenceManifest=null;throw error;}));
  for(const [key,name] of [...mineralBands,...iceBands,['water-equivalent-hydrogen','Water-equivalent hydrogen']]) {
    signal.throwIfAborted();
    const asset=manifest.layers[key];
    if(!asset||!inside(point,asset.bounds)){update([missing(name,'Outside the source coverage.')]);continue;}
    try {
      const grid=await loadReference(asset,{signal});
      const value=sampleReference(grid,...point);
      if(!Number.isFinite(value)){update([missing(name,'No valid source cell at the selected point.')]);continue;}
      const source=asset.sources?.[0];
      const ice=key.startsWith('ice-');
      let note=ice?'Regional composite. This is evidence consistency.':key==='water-equivalent-hydrogen'
        ?'NASA Odyssey GRS observations 2002–2005. Hydrogen can occur in different materials.'
        :'Regional TES spectral unmixing estimate. Local composition and extractable grade are unknown.';
      if(key==='water-equivalent-hydrogen'&&manifest.layers[key+'-sigma']){
        try {
          const sigma=sampleReference(await loadReference(manifest.layers[key+'-sigma'],{signal}),...point);
          if(Number.isFinite(sigma))note+=` Published 1σ: ${number(sigma,3)} ${grid.units}.`;
        } catch {signal.throwIfAborted();}
      }
      update([line(name,`${number(value,3)} ${grid.units}`,'Derived',
        [source?.title,grid.native_sampling,note].filter(Boolean).join(' · '),source?.url)]);
    } catch {signal.throwIfAborted();update([missing(name,'The reference grid could not be read.')]);}
  }
}

async function geologyRow(point,signal) {
  const {x,y,z}=tileAt(point,GEOLOGY_MAX_LEVEL);
  const reference='https://pubs.usgs.gov/sim/3292/';
  try {
    const [legend,image]=await Promise.all([
      json('/geology/legend.json',signal).then(validateGeologyLegend),geologyImage(x,y,z,signal),
    ]);
    const [w,s,e,n]=geographicBounds(x,y,z);
    const ix=Math.floor((point[0]-w)/(e-w)*256),iy=Math.floor((n-point[1])/(n-s)*256);
    if(ix<1||iy<1||ix>254||iy>254)return line('Geology','Mapped unit unavailable at tile edge','Unavailable','USGS SIM 3292 · 1:20 million',reference);
    const data=image.getContext('2d').getImageData(ix-1,iy-1,3,3).data;
    const rgb='#'+Array.from(data.slice(0,3)).map(v=>v.toString(16).padStart(2,'0')).join('');
    const units=legend.units.filter(unit=>unit.color.toLowerCase()===rgb);
    if(units.length!==1||!data.every((value,i)=>value===(i%4===3?255:data[i%4]))){
      return line('Geology','No unambiguous mapped unit','Unavailable','USGS SIM 3292 · 1:20 million cartographic map',reference);
    }
    return line('Geology',`${units[0].code} · ${units[0].name}`,'Derived',
      'USGS SIM 3292 · 1:20 million. Regional map interpretation identified from the published unit color.',reference);
  } catch {signal.throwIfAborted();return line('Geology','Geologic tiles unavailable','Unavailable','USGS SIM 3292 · 1:20 million',reference);}
}

export async function scienceAt(point,signal,update) {
  await Promise.all([geologyRow(point,signal).then(row=>update([row])),referenceRows(point,signal,update)]);
  return [missing('Resource potential','Regional mineral and ice evidence does not establish accessible deposits, purity, or reserves.')];
}

export function terrainRows(packet) {
  if(!packet?.terrain)return [missing('Elevation and slope','No physical terrain sample was returned.')];
  const {terrain:t,neighborhood,shadow}=packet;
  const credit=t.source?.credit??t.source?.id;
  const basis=`${credit} · ${spacingText(t.source?.gridMeters)} grid · ${t.source?.datum??'datum unavailable'}`;
  return [
    Number.isFinite(t.elevationMeters)?line('Elevation',number(t.elevationMeters,0)+' m','Derived',basis+' · sampled measured DEM'):missing('Elevation',basis+' · no valid sample.'),
    Number.isFinite(t.slopeDegrees)?line('Slope',number(t.slopeDegrees,1)+'°','Derived',basis+' · grid-scale slope'):missing('Slope','A valid source neighborhood is required.'),
    neighborhood?line('Local relief',number(neighborhood.rangeMeters,0)+' m','Derived',
      `Range across a 3 × 3 neighborhood at ${spacingText(t.source.gridMeters)} spacing. ${credit}.`):missing('Local relief','A complete neighborhood from one terrain source is required.'),
    shadow?line('Terrain shadow',shadow.blocked?'Terrain blocks the modeled Sun':'No blocking terrain sampled','Modeled',
      `${shadow.at} · Tested to ${spacingText(shadow.reachMeters)} at ${spacingText(t.source.gridMeters)} spacing using ${credit}. Farther or finer obstacles are unresolved.`):missing('Terrain shadow','Needs usable fine terrain along the sunward line.'),
  ];
}

export function solarRows(point,at) {
  try {
    const solar=solarAt(marsSun(at),...point);
    return [line('Sunlight',`Sun ${number(solar.elevation,1)}° elevation · ${number(solar.azimuth,1)}° azimuth`,'Modeled',
      `NASA GISS Mars24 · ${at} · geometric horizon`,SOLAR_SOURCE)];
  } catch {return [missing('Sunlight','The selected time is outside Mars24 coverage.')];}
}

export function environmentRows(packet) {
  const rows=[];
  for(const item of packet.fields) {
    const name={Tair:'Air temperature',Tsurf:'Surface temperature',Psurf:'Surface pressure'}[item.parameter];
    if(item.observed) {
      const v=item.observed;
      rows.push(line(name,`${number(v.value)} ${v.units}`,'Observed',`${v.source} · ${v.at} · ${distance(v.distanceMeters/1000)} from selected point · sensor uncertainty unavailable`));
    }
    if(item.archive?.value!=null){
      const m=item.archive;
      rows.push(line(name,`${number(m.value)} ${m.units}`,'Modeled',
        `${m.model??'NASA EMARS'} · ${m.availableModelTime} · ${m.spatialSupport??'coarse regional grid'} · archived climatology, past scenario`));
    }
    if(!item.observed&&item.archive?.value==null)rows.push(missing(name,'No nearby submitted measurement or valid archived cell.'));
  }
  if(packet.radiation){
    const {label,time,unit,value}=packet.radiation;
    rows.push(line('Radiation context',`${number(value)} ${unit}`,'Observed',
      `NASA Curiosity RAD · ${label} · ${time} · Curiosity traverse record only. Local dose at the selected point is unavailable.`,
      'https://spdf.gsfc.nasa.gov/pub/data/aaa_planetary/msl/rad/'));
  } else rows.push(missing('Radiation','No location-specific dose product is available.'));
  return rows;
}

import {normalizedPoint} from './surface-readout.js';
export function basicDestinations(regions,objects){
 const source=Array.isArray(regions)?regions:regions?.regions;
 const places=(Array.isArray(source)?source:[]).flatMap(r=>{if(!r||typeof r.id!=='string'||typeof r.name!=='string')return [];const point=normalizedPoint(r.center);return point?[{id:'region:'+r.id,name:r.name,point,bounds:r.bbox}]:[];});
 const spacecraft=(Array.isArray(objects)?objects:[]).flatMap(item=>{if(!item||item.domain!=='mars_surface'||typeof item.id!=='string'||typeof item.name!=='string')return [];const l=item.location,point=normalizedPoint([l?.lon_east,l?.lat_planetocentric]);return point?[{id:'spacecraft:'+item.id,name:item.name,point,item}]:[];});
 return [...places,...spacecraft];
}
export function basicSelection(hash,destinations){
 const p=new URLSearchParams(hash.replace(/^#/,''));
 if(p.get('region')==='COORDINATES'&&p.get('lon')?.trim()&&p.get('lat')?.trim()){const point=normalizedPoint([Number(p.get('lon')),Number(p.get('lat'))]);if(point)return {point,zoom:7};}
 const id=p.has('spacecraft')?'spacecraft:'+p.get('spacecraft'):'region:'+p.get('region');
 return destinations.find(d=>d.id===id)??null;
}

import {measurementBoundary,measurementPoint,polygonMetrics} from './measurement-geometry.js';

export const MAX_PERIMETERS=30;
export const MAX_PERIMETER_POINTS=64;
export const PERIMETERS_KEY='pyxis-perimeters-v1';

export function lassoVertices(stroke){
 const first=stroke[0],last=stroke.at(-1);
 const ring=stroke.length>3&&Math.hypot(first[0]-last[0],first[1]-last[1])<6?stroke.slice(0,-1):stroke;
 const area=ring.reduce((sum,[x,y],i)=>{
  const next=ring[(i+1)%ring.length];
  return sum+x*next[1]-y*next[0];
 },0);
 if(ring.length<3||Math.abs(area)<160)throw Error('Drag a loop around an area.');
 const count=Math.min(ring.length,MAX_PERIMETER_POINTS);
 return Array.from({length:count},(_,i)=>ring[Math.round(i*(ring.length-1)/(count-1))]);
}

export function perimeterPoint(point){
 if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90)throw Error('Invalid perimeter coordinates.');
 return measurementPoint(point);
}

export function validatePerimeter(input){
 if(typeof input?.id!=='string'||!/^perimeter-[a-z0-9-]{1,90}$/i.test(input.id))throw Error('Invalid perimeter identifier.');
 const name=typeof input.name==='string'?input.name.trim():'';
 if(!name||name.length>80)throw Error('Enter a perimeter name of up to 80 characters.');
 if(!Array.isArray(input.points)||input.points.length>MAX_PERIMETER_POINTS+1)throw Error('A perimeter supports up to 64 vertices.');
 const points=measurementBoundary(input.points.map(perimeterPoint));
 if(points.length>MAX_PERIMETER_POINTS)throw Error('A perimeter supports up to 64 vertices.');
 const {invalidReason}=polygonMetrics(points);
 if(invalidReason)throw Error(invalidReason);
 const target=input.target;
 let association=null;
 if(target?.kind==='site'&&typeof target.id==='string'&&/^user-[a-z0-9-]{1,90}$/i.test(target.id))association={kind:'site',id:target.id};
 else if(target?.kind==='camp')association={kind:'camp',point:perimeterPoint(target.point)};
 else if(target!=null)throw Error('Choose a marked site or the declared camp.');
 return {id:input.id,name,points,target:association};
}

export function validatePerimeters(input=[]){
 if(!Array.isArray(input)||input.length>MAX_PERIMETERS)throw Error('Up to 30 perimeters can be saved.');
 const records=input.map(validatePerimeter);
 if(new Set(records.map(record=>record.id)).size!==records.length)throw Error('Repeated perimeter identifiers.');
 return records;
}

export function mergePerimeters(previous,incoming){
 const records=new Map(validatePerimeters(previous).map(record=>[record.id,record]));
 for(const record of validatePerimeters(incoming))records.set(record.id,record);
 return validatePerimeters([...records.values()]);
}

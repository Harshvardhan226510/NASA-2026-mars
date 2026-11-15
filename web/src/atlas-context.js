import {SCIENCE_CATALOG} from './science-catalog.js';
import {sampleReference} from './scientific-data.js';
import {sampleWind} from './wind-data.js';
import {sampleEnvironment} from './environment-data.js';
import {overlayExplanation} from './overlay-explanations.js';
export function atlasDataDescription({query='',point,item,reference,wind,environment,environmentItem,quality}={}){
 const q=query.toLowerCase(),subject=SCIENCE_CATALOG.find(x=>q.includes(x.name.toLowerCase()))??(/\bwind\b/.test(q)?SCIENCE_CATALOG.find(x=>x.id==='wind-speed'):null)??item;
 const messages=[point?`Map centre: ${point[1].toFixed(5)}° latitude, ${point[0].toFixed(5)}° east longitude.`:'The centre crosshair is off the surface.'];
 if(subject){const info=overlayExplanation(subject);messages.push(subject.name+': '+info.shows,info.reading,info.limits);if(!subject.engine)messages.push('This product is unavailable: '+subject.reason);}
 else messages.push('No scientific overlay is selected. Ask about a named layer or use the command guide.');
 if(subject?.engine==='reference'&&subject.key===item?.key&&reference&&point){const value=sampleReference(reference,...point);messages.push(Number.isFinite(value)?`Original source cell: ${value.toPrecision(5)} ${reference.units}.`:'No source retrieval at the map centre.');}
 if(subject?.engine==='wind'){const value=point&&wind?sampleWind(wind,...point):null;messages.push(wind?`NASA EMARS modeled climatology at ${wind.model_time}; ${value?`speed ${value.speed.toFixed(2)} m/s, east ${value.east.toFixed(2)} m/s, north ${value.north.toFixed(2)} m/s`:'no model coverage at the centre'}.`:'The wind grid is not loaded. Apply wind speed to retrieve it.');}
 if(environment&&environmentItem?.key===subject?.key&&point){const value=sampleEnvironment(environment,...point);messages.push(`Model hour ${environment.model_time}; ${value===null?'no coverage':value.toPrecision(5)+' '+environment.units}.`);}
 if(quality)messages.push('Loaded surface quality: '+quality);
 messages.push('Missing values remain unknown. Model fields, dated observations and calculated geometry are distinct; these are not continuous rover telemetry.');return messages.join('\n\n');
}

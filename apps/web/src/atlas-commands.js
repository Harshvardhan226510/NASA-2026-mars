import {SCIENCE_CATALOG,consolidatedOverlayKey} from './science-catalog.js';
const normalized=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aliases={wind:'wind-speed','wind speed':'wind-speed','wind direction':'wind-direction',elevation:'elevation-gradient',slope:'slope-steepness',roughness:'terrain-roughness',ruggedness:'terrain-ruggedness',curvature:'terrain-curvature',gravity:'gravity-anomalies','magnetic field':'crustal-magnetic-field-strength','hydrated minerals':'hydrated-minerals-clay-signatures','mineral composition':'mineral-composition'};
export function parseAtlasCommand(query){
 const q=normalized(query).replace(/^please /,'');if(q==='focus on map'||q==='hide interface')return {type:'focus',show:true};if(q==='show interface'||q==='exit focus mode')return {type:'focus',show:false};
 const dust=/^(run|evaluate|predict|calculate).*(dust|storm)/.test(q);if(dust){const target={};for(const [word,key] of [['latitude','lat'],['longitude','lon'],['wind','windMps'],['elevation','elevationKm'],['ls','ls'],['ltst','ltst']]){const match=String(query).match(new RegExp('\\b'+word+'\\s*[:=]?\\s*(-?\\d+(?:\\.\\d+)?)','i'));if(match)target[key]=Number(match[1]);}return {type:'dust',target};}
 const toggle=q.match(/^(?:apply|enable|show|activate|turn on|hide|disable|deactivate|turn off) (.+)$/);if(!toggle)return null;
 const show=!/^(?:hide|disable|deactivate|turn off) /.test(q),name=toggle[1].replace(/^(?:the )| (?:layer|overlay)$/g,'').trim();
 if(['all pins','pins','markers'].includes(name))return {type:'pins',show};if(name==='all layers')return {type:'all',show};
 if(['sunlight','lighting','terrain shadows','shadows'].includes(name))return {type:'feature',id:/shadow/.test(name)?'solar-shadows':'solar-enable',show};
 if(['coordinate grid','latitude longitude grid','grid'].includes(name))return {type:'layer',key:'graticule',show};
 const item=SCIENCE_CATALOG.find(x=>(normalized(x.name.replace(/\s*[·(].*$/,''))===name||normalized(x.key)===name||normalized(x.name).replace(/ abundance$/,'')===name||normalized(x.id)===name||aliases[name]===x.id));
 if(!item)return null;if(!item.engine)return {type:'unavailable',label:item.name,reason:item.reason};
 const mineral=['olivine-abundance','pyroxene-abundance','hematite-abundance','feldspar-abundance'];
 return {type:'layer',key:consolidatedOverlayKey(item.key),variant:mineral.includes(item.id)?item.asset:undefined,show,label:item.name};
}
export async function runAtlasCommand(command,actions){
 if(!command||!actions)return null;let message;
 if(command.type==='unavailable')return command.label+': '+command.reason;
 if(command.type==='layer'){await actions.layer(command.key,command.show,command.variant);message=`${command.label??command.key}: ${command.show?'enabled':'hidden'}.`;}
 else if(command.type==='pins'){for(const key of ['regions','science','minerals','resources','spacecraft','boundaries','footprints'])await actions.layer(key,command.show);message=`Map markers ${command.show?'shown':'hidden'}.`;}
 else if(command.type==='all'){await actions.all(command.show);message=`Map layer visibility updated.`;}
 else if(command.type==='focus'){await actions.focus(command.show);message=command.show?'Map focus enabled.':'Interface restored.';}
 else if(command.type==='feature'){await actions.feature(command.id,command.show);message=`${command.id==='solar-shadows'?'Terrain shadows':'Sunlight'} ${command.show?'enabled':'disabled'}.`;}
 else if(command.type==='dust'){const result=await actions.dust(command.target);const value=(k,u='')=>Number.isFinite(result?.[k])?result[k].toFixed(2)+u:'unknown';message=(result?.inputNote??'No validated dust forecast is available.')+` Inputs: latitude ${value('lat','°')}, longitude ${value('lon','°E')}, Ls ${value('ls','°')}, LTST ${value('ltst',' h')}, elevation ${value('elevationKm',' km')}, wind ${value('windMps',' m/s')}.`;}
 return message;
}
export const ATLAS_COMMAND_GUIDE=[['Layers','Apply wind speed layer','Apply slope steepness layer','Hide wind speed layer','Show coordinate grid','Hide pins','Show pins'],['Map controls','Focus on map','Show interface','Switch to 2D','Switch to split compare mode','Navigate to Jezero'],['Sunlight and models','Turn on sunlight','Turn off terrain shadows','Evaluate dust model','Run dust model latitude -42.5 longitude 70 wind 20'],['Missions','What is our mission status?','Which science stop can we remove to recover a 25% return reserve?','Can we return from here?','Explain the Deep Science risk score','Show return safety','Compare all 3 routes','Return to camp']];

export const WIND_SOURCE='https://psg.gsfc.nasa.gov/apps/mars/';
export const WIND_GRID=WIND_SOURCE+'index.php?param=Wind';
export function windHour(now=Date.now()){const date=new Date(now);date.setUTCMinutes(0,0,0);return date.toISOString();}
export function windForm(modelTime){
 const date=new Date(modelTime);if(!Number.isFinite(+date))throw Error('Invalid model time');
 // The provider only honors its complete form when location is present.
 return new URLSearchParams({location:'Syrtis Major',latitude:'9.9',longitude:'70',dateyear:String(date.getUTCFullYear()),datemonth:String(date.getUTCMonth()+1),dateday:String(date.getUTCDate()),datetime:date.toISOString().slice(11,16),units:'SI',model:'EMARS',modelmode:'Optimum'});
}
export function windMetadata(html,requestedTime){
 const value=name=>{const tag=html.match(new RegExp('<input\\b[^>]*\\bname="'+name+'"[^>]*>','i'))?.[0];return tag?.match(/\bvalue="([^"]*)"/i)?.[1];};
 const month=html.match(/getElementById\("datemonth"\)\.value\s*=\s*"(\d+)"/)?.[1];
 const values=[value('dateyear'),month,value('dateday'),value('datetime')];
 if(values.some(v=>!v))throw Error('NASA model-time confirmation is unavailable');
 const echoed=new Date(`${values[0]}-${String(values[1]).padStart(2,'0')}-${String(values[2]).padStart(2,'0')}T${values[3]}:00Z`).toISOString();
 if(echoed!==requestedTime||value('model')!=='EMARS'||value('modelmode')!=='Optimum')throw Error('NASA did not confirm the requested model/time');
 const text=html.match(/Climatological data based on\s+(EMARS\s+MY\d+[^<]*)</)?.[1]?.trim();
 if(!text||text.length>120)throw Error('NASA climatology identity is unavailable');
 return {model_time:echoed,model_label:text,source_mars_year:Number(text.match(/MY(\d+)/)[1]),observation_time:null,issue_time:null,height_m:null,height_note:'Wind evaluation height is not specified by this feed.'};
}
export function normalizeWind(raw,metadata,provenance=[]){
 const h=raw?.header;if(h?.param!=='Wind'||h.unit!=='km/h')throw Error('NASA wind parameter or units changed');
 const {nlon,nlat,lons,lats}=h;
 if(!Number.isInteger(nlon)||!Number.isInteger(nlat)||nlon<3||nlat<3||nlon>360||nlat>181||lons?.length!==nlon||lats?.length!==nlat||raw.data?.length!==nlon*nlat||raw.vector?.length!==nlon*nlat)throw Error('NASA wind-grid dimensions changed');
 for(const [axis,lo,hi] of [[lons,0,360],[lats,-90,90]])if(axis.some((v,i)=>!Number.isFinite(v)||v<lo||v>hi||(i&&v<=axis[i-1])))throw Error('Invalid wind coordinate axis');
 const step=lons[1]-lons[0];if(Math.abs(step*nlon-360)>.01||lons.some((v,i)=>i&&Math.abs(v-lons[i-1]-step)>.01))throw Error('Wind longitude grid no longer wraps globally');
 const component=v=>v===null?null:typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<1e6?v/3.6:null;
 const east=raw.data.map(component),north=raw.vector.map(component);let valid=0,maxSpeed=0;
 for(let i=0;i<east.length;i++){if(east[i]===null||north[i]===null){east[i]=null;north[i]=null;}else{valid++;maxSpeed=Math.max(maxSpeed,Math.hypot(east[i],north[i]));}}
 if(!valid)throw Error('No valid wind components');
 return {schema:'mars-wind/1',kind:'modeled_climatology',source:'NASA/GSFC Mars Explorer · EMARS',source_url:WIND_SOURCE,...metadata,units:'m/s',original_units:'km/h',component_convention:'eastward / northward; arrows point downwind',lons,lats,nlon,nlat,east,north,valid_cells:valid,maximum_speed:maxSpeed,longitude_step_deg:step,latitude_bounds:[lats[0],lats.at(-1)],spatial_support:`${nlon} × ${nlat} model grid; ${step}° longitude and provider latitude coordinates. No local gust resolution.`,quality_flags:null,uncertainty:null,provenance,usable_for_mission_safety:false};
}
const bracket=(axis,value)=>{let lo=0,hi=axis.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(axis[mid]<=value)lo=mid;else hi=mid;}return [lo,hi];};
export function sampleWind(grid,lon,lat){
 if(!grid||!Number.isFinite(lon)||!Number.isFinite(lat)||lat<grid.lats[0]||lat>grid.lats.at(-1))return null;
 lon=((lon%360)+360)%360;const xs=grid.lons,ys=grid.lats,n=grid.nlon;let a,b,x0,x1;
 if(lon<xs[0]){a=n-1;b=0;x0=xs[a]-360;x1=xs[0];}
 else if(lon>=xs.at(-1)){a=n-1;b=0;x0=xs[a];x1=xs[0]+360;}
 else{[a,b]=bracket(xs,lon);x0=xs[a];x1=xs[b];}
 const [c,d]=bracket(ys,lat),tx=(lon-x0)/(x1-x0),ty=(lat-ys[c])/(ys[d]-ys[c]),indices=[c*n+a,c*n+b,d*n+a,d*n+b],weights=[(1-tx)*(1-ty),tx*(1-ty),(1-tx)*ty,tx*ty];let east=0,north=0;
 for(let i=0;i<4;i++){if(weights[i]<1e-12)continue;const k=indices[i];if(grid.east[k]===null||grid.north[k]===null)return null;east+=weights[i]*grid.east[k];north+=weights[i]*grid.north[k];}
 const speed=Math.hypot(east,north);return {east,north,speed,bearing_to:speed>.01?(Math.atan2(east,north)*180/Math.PI+360)%360:null};
}
export function windStatus(packet,now=Date.now()){
 const age=(now-Date.parse(packet.model_time))/3600000;
 if(packet.health?.state==='cached_fallback')return 'Cached climatology · source refresh unavailable';
 return age>=2?'Older climatology model time':'Automatically refreshed climatology';
}

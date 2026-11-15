export const SPACECRAFT_FEEDS=Object.freeze({
 curiosity:'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints_current.json',
 perseverance:'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints_current.json',
 ingenuity:'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/m20_heli_waypoints_current.json'
});
export const spacecraftLongitude=value=>value>=-180&&value<180?value:((value+180)%360+360)%360-180;
export const hasSurfacePosition=item=>item?.domain==='mars_surface'&&Number.isFinite(item.location?.lon_east)&&Number.isFinite(item.location?.lat_planetocentric)&&Math.abs(item.location.lat_planetocentric)<=90;
export function normalizeSpacecraftPosition(id,data,{retrievedAt,lastModified=null,sha256=null}={}){
 if(!SPACECRAFT_FEEDS[id])throw new Error('Unknown spacecraft feed');
 if(data?.type!=='FeatureCollection'||data.features?.length!==1)throw new Error('Expected one current localization');
 const f=data.features[0],c=f.geometry?.coordinates,p=f.properties;
 if(f.geometry?.type!=='Point'||!Array.isArray(c)||!p||!Number.isFinite(c[0])||c[0]<-180||c[0]>360||!Number.isFinite(c[1])||Math.abs(c[1])>90)throw new Error('Invalid spacecraft coordinates');
 const sol=p.sol??p.Sol,lon=spacecraftLongitude(c[0]),lat=c[1];
 if(!Number.isInteger(sol)||sol<0||!Number.isFinite(Date.parse(retrievedAt)))throw new Error('Invalid localization metadata');
 // Fail closed on an unrelated file rather than moving a rover to another mission.
 if(id==='curiosity'&&(lon<130||lon>145||lat< -10||lat>0)||id!=='curiosity'&&(lon<70||lon>85||lat<10||lat>25))throw new Error('Localization outside mission region');
 const h=p.elev_geoid??p.Elev_Geoid;
 return {lon_east:lon,lat_planetocentric:lat,classification:'last_published_localization',source:SPACECRAFT_FEEDS[id],uncertainty_m:null,sol,earth_date:typeof p.Earth_Date==='string'?p.Earth_Date:null,elevation_m:Number.isFinite(h)&&h!==-9999?h:null,elevation_datum:'source geoid; not WGS84 ellipsoidal altitude',record_id:typeof p.RMC==='string'?p.RMC:null,flight:Number.isInteger(p.Flight)?p.Flight:null,retrieved_at:retrievedAt,file_last_modified:lastModified,raw_sha256:sha256};
}
export function positionSummary(item){
 const l=item.location;
 if(!hasSurfacePosition(item))return item.kind==='orbiter'?'No timestamped orbital position':'Exact surface position unverified';
 if(item.id==='ingenuity')return `Final flight ${l.flight??72} · ${l.earth_date??'18 January 2024'}`;
 if(l.classification==='last_published_localization')return `Latest published position · Sol ${l.sol}`;
 if(l.classification==='final_recorded_traverse_endpoint')return `Final recorded position · Sol ${l.sol_end}`;
 return l.classification==='rounded_initial_CTX_impact_localization'?'Approximate impact location':'Published reference position';
}
export function trackLines(data){
 const out=[];
 for(const f of data?.features??[]){const g=f.geometry;for(const raw of g?.type==='LineString'?[g.coordinates]:g?.type==='MultiLineString'?g.coordinates:[]){let line=[];for(const c of raw){if(!Array.isArray(c)||!Number.isFinite(c[0])||!Number.isFinite(c[1])||Math.abs(c[1])>90){if(line.length>1)out.push(line);line=[];continue;}const point=[spacecraftLongitude(c[0]),c[1]];if(line.length&&Math.abs(point[0]-line.at(-1)[0])>180){if(line.length>1)out.push(line);line=[];}line.push(point);}if(line.length>1)out.push(line);}}
 const joined=[];
 for(const raw of out){const line=raw.filter((p,i)=>!i||p[0]!==raw[i-1][0]||p[1]!==raw[i-1][1]);if(line.length<2)continue;const last=joined.at(-1);if(last&&Math.abs(last.at(-1)[0]-line[0][0])<1e-10&&Math.abs(last.at(-1)[1]-line[0][1])<1e-10)last.push(...line.slice(1));else joined.push(line);}
 // Bound geometry work without changing source connectivity or drawing across gaps.
 return joined.flatMap(line=>{const parts=[];for(let i=0;i<line.length-1;i+=2047)parts.push(line.slice(i,i+2048));return parts;});
}

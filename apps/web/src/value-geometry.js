import {mapPinSVG} from './map-marker-style.js';
const R=3396190,rad=Math.PI/180;
export const valueCategories={science:{label:'Scientific interest',color:'#c1a5f2',symbol:'S'},minerals:{label:'Mineral prospects',color:'#e8c16a',symbol:'M'},resources:{label:'Crew resource candidates',color:'#79cedb',symbol:'W'}};
export function aboveHorizon(center,camera){const [lon,lat]=center,p=lat*rad,l=lon*rad,length=Math.hypot(camera.x,camera.y,camera.z);return (Math.cos(p)*Math.cos(l)*camera.x+Math.cos(p)*Math.sin(l)*camera.y+Math.sin(p)*camera.z)/length>(R-10000)/length;}
export function studyRing(site,steps=64){if(site.geometry?.type==='Polygon')return site.geometry.coordinates[0];const [lon,lat]=site.center,a=site.radiusKm*1000/R,p=lat*rad,l=lon*rad;return Array.from({length:steps+1},(_,i)=>{const t=i/steps*Math.PI*2,q=Math.asin(Math.sin(p)*Math.cos(a)+Math.cos(p)*Math.sin(a)*Math.cos(t)),w=l+Math.atan2(Math.sin(t)*Math.sin(a)*Math.cos(p),Math.cos(a)-Math.sin(p)*Math.sin(q));return [((w/rad+540)%360)-180,q/rad];});}
export function studyRings(site){return site.geometry?.type==='Polygon'?site.geometry.coordinates:[studyRing(site)];}
export function studyBounds(site){const [lon,lat]=site.center,d=site.radiusKm*1000/R/rad,x=d/Math.max(.02,Math.cos(lat*rad));return [lon-x,Math.max(-90,lat-d),lon+x,Math.min(90,lat+d)];}
// Leaflet needs a continuous longitude sequence at the antimeridian.
export function leafletStudyRing(site,reference=site.center[0]){const anchor=site.center[0]+360*Math.round((reference-site.center[0])/360);return studyRing(site).map(([lon,lat])=>[lat,lon+360*Math.round((anchor-lon)/360)]);}
export function leafletStudyRings(site,reference=site.center[0]){const anchor=site.center[0]+360*Math.round((reference-site.center[0])/360);return studyRings(site).map(ring=>ring.map(([lon,lat])=>[lat,lon+360*Math.round((anchor-lon)/360)]));}
export function discoveryBounds(site){const [w,s,e,n]=studyBounds(site);return w < -180?[[w+360,s,180,n],[-180,s,e,n]]:e>180?[[w,s,180,n],[-180,s,e-360,n]]:[[w,s,e,n]];}
const contains=(p,b)=>p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3];
export function siteDatasets(catalog,site){return (catalog?.datasets??[]).filter(d=>d.status==='complete'&&d.terrain?.length&&d.imagery?.length&&contains(site.center,d.bounds)).sort((a,b)=>Math.max(...a.imagery_grid_m)-Math.max(...b.imagery_grid_m));}
export function siteCoverage(catalog,site){const ds=siteDatasets(catalog,site),b=studyBounds(site),full=ds.find(d=>contains([b[0],b[1]],d.bounds)&&contains([b[2],b[3]],d.bounds));return ds.length?{datasets:ds,kind:full?'footprint':'partial',text:`${Math.max(...ds[0].imagery_grid_m).toFixed(2)} m HiRISE available at anchor · ${full?'window inside footprint; pixel audit pending':'partial study-window coverage'}`}:{datasets:[],kind:'pending',text:'CTX context · HiRISE preparation required'};}
export const markerSVG=mapPinSVG;

import {distanceKm} from './place-context.js';
export const measuredEvidence=new Set(['spectral_detection','radar_assessment','rover_measurement']);
export function filterValueSites(sites,{category='all',query='',landing=null,radiusKm=100,evidence='all'}={}){
 const q=query.trim().toLocaleLowerCase();
 return sites.filter(s=>(category==='all'||s.category===category)&&(!landing||distanceKm(s.center,landing.center)<=radiusKm)&&(evidence==='all'||(evidence==='measurements'?measuredEvidence.has(s.evidenceClass):!measuredEvidence.has(s.evidenceClass)))&&(!q||`${s.name} ${s.type} ${s.summary} ${s.evidence} ${s.sourceRecord?.product??''}`.toLocaleLowerCase().includes(q))).sort((a,b)=>landing?distanceKm(a.center,landing.center)-distanceKm(b.center,landing.center):0);
}
export function screenClusters(sites,project,cellSize=38){
 const groups=new Map();
 for(const site of sites){const p=project(site),key=`${site.category}:${Math.floor(p.x/cellSize)}:${Math.floor(p.y/cellSize)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(site);}
 return [...groups.values()];
}

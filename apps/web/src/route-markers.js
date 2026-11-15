// Label actual grid endpoints, but never move scientific target coordinates
// onto a nearby path: proximity is not a visit or a coordinate correction.
export function routeMarkers(result,start,goal,targets=[],profile='deep_science'){
 const route=result?.routes?.[profile]?.waypoints?.length?result.routes[profile]:Object.values(result?.routes??{}).find(r=>r.waypoints?.length);
 const first=route?.waypoints?.[0],last=route?.waypoints?.at(-1);let manual=0,site=0;
 return [...(first||start?[{point:first?[first.lon,first.lat]:start,label:'A'}]:[]),...(last||goal?[{point:last?[last.lon,last.lat]:goal,label:'B'}]:[]),...targets.filter(t=>t.point).map(t=>({point:t.point,label:t.origin==='catalogue'?`V${++site}`:`C${++manual}`}))];
}

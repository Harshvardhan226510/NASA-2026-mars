export const HORIZON_WORKSPACES=Object.freeze([
 {id:'explore',label:'Explore',icon:'explore',description:'Find a place, a research site or a spacecraft.',tools:[
  {id:'regions',label:'Places',directory:'regions'}, {id:'values',label:'Research',directory:'values'}, {id:'user-sites',label:'My sites',directory:'user-sites'}, {id:'spacecraft',label:'Spacecraft',directory:'spacecraft'}, {id:'more',label:'More',directory:'more'}]},
 {id:'science',label:'Science',icon:'layers',description:'Read the landscape and understand its environment.',tools:[
  {id:'layers',label:'Layers',title:'Map layers',note:'Imagery, elevation and scientific overlays.',icon:'layers'},
  {id:'solar',label:'Sunlight',title:'Sunlight & shadows',note:'Illumination, shadows and solar context.',icon:'solar'},
  {id:'dust',label:'Weather',title:'Weather & dust',note:'NASA context and experimental model scenarios.',icon:'dust'},
  {id:'seismic',label:'Seismic',title:'Seismic Lab',note:'InSight observations and seismic analysis.',icon:'seismic'}]},
 {id:'plan',label:'Plan',icon:'routes',description:'Build a route, prepare a Marswalk and keep a field record.',tools:[
  {id:'sites',label:'Sites',title:'Landing & base sites',note:'Compare footprint terrain, sunlight and nearby resource evidence.',icon:'explore'},
  {id:'deploy',label:'Equipment',title:'Plan Mission',note:'Place conceptual equipment and inspect scenario estimates.',icon:'deploy'},
  {id:'routes',label:'Routes',title:'Route planner',note:'Compare terrain-aware paths and science opportunities.',icon:'routes'},
  {id:'measure',label:'Measure',title:'Measure',note:'Connected distances and enclosed areas.',icon:'measure'},
  {id:'plan',label:'Marswalk',title:'Marswalk',note:'Round trip, reserves, stations, communications and field log.',icon:'plan'},
  {id:'saved',label:'Saved',title:'Saved missions',note:'Reopen, share, import and export a complete plan.',icon:'saved'}]},
 {id:'system',label:'Mars system',icon:'system',description:'Moons, orbiters and the passage of time.',tools:[
  {id:'system',label:'Overview',target:'moons-system'}, {id:'phobos',label:'Phobos',moon:'phobos'}, {id:'deimos',label:'Deimos',moon:'deimos'}, {id:'orbiters',label:'Orbiters',target:'orbiters-list'}]}
]);
const actionGroups=Object.fromEntries(HORIZON_WORKSPACES.flatMap(group=>group.tools.filter(tool=>!tool.directory&&!tool.moon&&!tool.target).map(tool=>[tool.id,group.id])));
export function workspaceForAction(action){return ({...actionGroups,explore:'explore',system:'system',missions:'plan'})[action]??null;}
export function useHorizonInterface(buildVariant,search=''){return (new URLSearchParams(search).get('ui')??buildVariant)==='horizon';}

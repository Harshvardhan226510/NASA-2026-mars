import {R} from './raster.js';
import {routeProjection} from './route-geometry.js';

export const COMMS_FIELDS=[
 ['radius','Map radius · km',5,.5,60],['frequency','Frequency · MHz',450,30,40000],
 ['towerHeight','Tower antenna · m',12,.5,150],['receiverHeight','Receiver antenna · m',1.7,.5,150],
 ['power','Transmit power · W',5,.001,10000],['txGain','Transmit gain · dBi',2,-20,60],
 ['rxGain','Receive gain · dBi',0,-20,60],['sensitivity','Receiver sensitivity · dBm',-105,-160,-30],
 ['losses','Cable / other losses · dB',2,0,70],['reserve','Required margin · dB',10,0,60]
];
export const COVERAGE={
 covered:{id:1,label:'Coverage',rgb:[54,208,153]},
 marginal:{id:2,label:'Marginal · Fresnel clearance',rgb:[255,192,79]},
 weak:{id:3,label:'Below required margin',rgb:[120,141,239]},
 blocked:{id:4,label:'Terrain blocked',rgb:[247,104,94]},
 unknown:{id:5,label:'Terrain unknown',rgb:[156,170,177]}
};
export const coverageStates=Object.values(COVERAGE);
const DEG=Math.PI/180;
export function commsParameters(input={}){
 return Object.fromEntries(COMMS_FIELDS.map(([key,label,initial,min,max])=>{
  const value=input[key]??initial;
  if(!Number.isFinite(value)||value<min||value>max)throw Error(`${label} must be between ${min} and ${max}.`);
  return [key,value];
 }));
}
export function commsScenario(input){
 if(input==null)return null;
 const p=input.point;
 if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)throw Error('Invalid communications tower coordinates.');
 return {point:[...p],settings:commsParameters(input.settings)};
}

export function freeSpaceLoss(distance,frequency){return 20*Math.log10(4*Math.PI*Math.max(1,distance)*frequency*1e6/299792458);}

// Heights are from the physical DEM. Curvature is the short-path spherical
// sagitta, d1*d2/(2R), appropriate to the simulator's <=60 km Mars links.
export function predictLink(settings,txGround,rxGround,distance,sample,step){
 if(!Number.isFinite(txGround)||!Number.isFinite(rxGround))return {id:COVERAGE.unknown.id,margin:NaN};
 const start=txGround+settings.towerHeight,end=rxGround+settings.receiverHeight;
 const slant=Math.hypot(distance,end-start),count=Math.max(2,Math.ceil(distance/step));
 const receive=30+10*Math.log10(settings.power)+settings.txGain+settings.rxGain-settings.losses-freeSpaceLoss(slant,settings.frequency);
 const margin=receive-settings.sensitivity,wavelength=299.792458/settings.frequency;
 let missing=false,marginal=false;
 for(let i=1;i<count;i++){
  const t=i/count,terrain=sample(t);
  if(!Number.isFinite(terrain)){missing=true;continue;}
  const d1=distance*t,d2=distance-d1,clearance=start+(end-start)*t-(d1*d2)/(2*R)-terrain;
  if(clearance<0)return {id:COVERAGE.blocked.id,margin:NaN};
  if(slant>0&&clearance<.6*Math.sqrt(wavelength*slant*t*(1-t)))marginal=true;
 }
 const id=missing?COVERAGE.unknown.id:margin<settings.reserve?COVERAGE.weak.id:marginal?COVERAGE.marginal.id:COVERAGE.covered.id;
 return {id,margin:missing?NaN:margin};
}

function localTerrain(grid){
 const projection=routeProjection(grid.center),step=grid.resolution_meters,halfX=(grid.cols-1)/2,halfY=(grid.rows-1)/2;
 const sample=(x,y)=>{
  const u=x/step+halfX,v=halfY-y/step;
  if(u<0||v<0||u>grid.cols-1||v>grid.rows-1)return NaN;
  const col=Math.min(grid.cols-2,Math.floor(u)),row=Math.min(grid.rows-2,Math.floor(v)),fx=u-col,fy=v-row;
  const top=grid.elevation_matrix[row],bottom=grid.elevation_matrix[row+1],a=top[col],b=top[col+1],c=bottom[col],d=bottom[col+1];
  if(a===null||b===null||c===null||d===null)return NaN;
  return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;
 };
 return {projection,sample};
}

export function coverageGrid(grid,{point,settings}){
 const {projection,sample}=localTerrain(grid),[tx,ty]=projection.forward(point),height=sample(tx,ty),radius=settings.radius*1000;
 if(!Number.isFinite(height))throw Error('Elevation is missing at this tower position. Move it onto a measured part of the map.');
 const spacing=grid.resolution_meters,half=Math.min(56,Math.max(1,Math.ceil(radius/spacing))),width=half*2+1,cell=radius/half;
 const states=new Uint8Array(width*width),margins=new Float32Array(states.length);margins.fill(NaN);
 const counts=Array(6).fill(0),range=Array(6).fill(0);
 const step=Math.max(spacing*.55,grid.source.sample_m*.5,radius/170);
 for(let row=0;row<width;row++)for(let col=0;col<width;col++){
  const dx=(col-half)*cell,dy=(half-row)*cell,distance=Math.hypot(dx,dy);
  if(distance>radius+1e-6)continue;
  const result=predictLink(settings,height,sample(tx+dx,ty+dy),distance,t=>sample(tx+dx*t,ty+dy*t),step);
  const i=row*width+col;states[i]=result.id;margins[i]=result.margin;counts[result.id]++;range[result.id]=Math.max(range[result.id],distance);
 }
 return {center:grid.center,tx,ty,width,half,cell,radius,states,margins,counts,range,height};
}

export function coverageCell(result,xy){
 const dx=xy[0]-result.tx,dy=xy[1]-result.ty;
 if(Math.hypot(dx,dy)>result.radius)return null;
 const col=Math.round(dx/result.cell)+result.half,row=result.half-Math.round(dy/result.cell),index=row*result.width+col,id=result.states[index];
 if(!id)return null;
 return {id,margin:result.margins[index],distance:Math.hypot(dx,dy)};
}

// Geographic bounds of the calculation circle, allowing a continuous longitude
// interval across the antimeridian. A pole-crossing circle spans all longitudes.
export function coverageBounds([lon,lat],radius){
 const angle=radius/R,delta=angle/DEG;
 if(Math.abs(lat)+delta>=90)return [-180,Math.max(-90,lat-delta),180,Math.min(90,lat+delta)];
 const wide=Math.asin(Math.sin(angle)/Math.cos(lat*DEG))/DEG;
 return [lon-wide,Math.max(-90,lat-delta),lon+wide,Math.min(90,lat+delta)];
}

export function coverageWindow(point,radius){
 const {inverse}=routeProjection(point),d=radius*1.12;
 return [inverse([-d,-d]),inverse([d,-d]),inverse([-d,d]),inverse([d,d])];
}

export function containsCoverage(grid,point,radius){
 const [x,y]=routeProjection(grid.center).forward(point),half=(Math.min(grid.rows,grid.cols)-1)*grid.resolution_meters/2;
 return Math.max(Math.abs(x),Math.abs(y))+radius*1.02<half;
}

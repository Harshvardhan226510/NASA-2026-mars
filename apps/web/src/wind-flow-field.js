import {sampleWind} from './wind-data.js';

// NASA Mars Explorer's vcolor(): blue → green → red, 0–100 km/h.
// Only display color saturates; the numerical wind remains unmodified.
export function windColor(speed){
 if(!Number.isFinite(speed))return [0,0,0,0];
 const angle=Math.max(0,Math.min(1,speed*3.6/100))*Math.PI;
 return [Math.floor(Math.max(0,-Math.cos(angle))*255),Math.floor(Math.max(0,Math.sin(angle))*255),Math.floor(Math.max(0,Math.cos(angle),-Math.sin(angle))*255),255];
}

export function projectedWind(grid,point,project){
 const [lon,lat,height=0]=point,value=sampleWind(grid,lon,lat);if(!value)return null;
 if(value.speed<.05)return [0,0];
 // Equal surface-distance tangent offsets; each view supplies its projection.
 const delta=.04,origin=project(lon,lat,height),east=project(lon+delta/Math.cos(lat*Math.PI/180),lat,height),north=project(lon,lat+delta,height);
 if(!origin||!east||!north)return null;
 const x=(east[0]-origin[0])*value.east+(north[0]-origin[0])*value.north,y=(east[1]-origin[1])*value.east+(north[1]-origin[1])*value.north,length=Math.hypot(x,y);
 if(!Number.isFinite(length)||length<1e-9)return null;
 // Accelerated display motion, NOT physical travel time or extra model detail.
 const speed=Math.min(90,value.speed*1.65);return [x/length*speed,y/length*speed];
}

export function screenWindField(grid,width,height,locate,project,spacing=Math.max(12,Math.ceil(Math.sqrt(width*height/2200)))){
 const columns=Math.ceil(width/spacing)+1,rows=Math.ceil(height/spacing)+1,vectors=new Float32Array(columns*rows*2).fill(NaN),seeds=[];
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
  const x=Math.min(width-1,i*spacing),y=Math.min(height-1,j*spacing),point=locate(x,y);if(!point)continue;
  const value=projectedWind(grid,point,project);if(!value)continue;
  const k=(j*columns+i)*2;vectors[k]=value[0];vectors[k+1]=value[1];if(Math.hypot(...value)>.08)seeds.push([x,y]);
 }
 return {width,height,spacing,columns,rows,vectors,seeds};
}

export function sampleFlow(field,x,y){
 if(x<0||y<0||x>=field.width-1||y>=field.height-1)return null;
 const {spacing,columns,vectors}=field,i=Math.floor(x/spacing),j=Math.floor(y/spacing),tx=x/spacing-i,ty=y/spacing-j;
 let u=0,v=0;for(const [dx,dy,w] of [[0,0,(1-tx)*(1-ty)],[1,0,tx*(1-ty)],[0,1,(1-tx)*ty],[1,1,tx*ty]]){
  if(w<1e-10)continue;const k=((j+dy)*columns+i+dx)*2;if(!Number.isFinite(vectors[k])||!Number.isFinite(vectors[k+1]))return null;u+=vectors[k]*w;v+=vectors[k+1]*w;
 }
 return [u,v];
}

export class WindParticles{
 constructor(field,random=Math.random){this.field=field;this.random=random;this.particles=[];const count=Math.min(5500,Math.ceil(field.seeds.length*field.spacing**2/180));for(let i=0;i<count;i++){const p={};this.spawn(p,true);this.particles.push(p);}}
 spawn(p,initial=false){
  const f=this.field;if(!f.seeds.length){p.age=Infinity;return;}
  for(let attempt=0;attempt<12;attempt++){
   const [x,y]=f.seeds[Math.floor(this.random()*f.seeds.length)];p.x=x+(this.random()-.5)*f.spacing;p.y=y+(this.random()-.5)*f.spacing;
   if(sampleFlow(f,p.x,p.y)){p.life=2.5+this.random()*2;p.age=initial?this.random()*p.life:0;return;}
  }p.age=Infinity;
 }
 advance(seconds,segment){
  const dt=Math.max(0,Math.min(.08,seconds));for(const p of this.particles){
   if(p.age>=p.life||!Number.isFinite(p.age)){this.spawn(p);continue;}p.age+=dt;
   const a=sampleFlow(this.field,p.x,p.y);if(!a){p.age=Infinity;continue;}
   const mid=sampleFlow(this.field,p.x+a[0]*dt/2,p.y+a[1]*dt/2);if(!mid){p.age=Infinity;continue;}
   const x=p.x+mid[0]*dt,y=p.y+mid[1]*dt;if(!sampleFlow(this.field,x,y)){p.age=Infinity;continue;}
   segment(p.x,p.y,x,y);p.x=x;p.y=y;
  }
 }
}

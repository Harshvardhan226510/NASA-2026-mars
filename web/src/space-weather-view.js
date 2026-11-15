// Plotting helpers keep missing values and temporal gaps visible.
export function number(value){return value===null||value===undefined||!Number.isFinite(value)?'Unknown':value!==0&&(Math.abs(value)<.01||Math.abs(value)>=100000)?value.toExponential(2):value.toLocaleString(undefined,{maximumFractionDigits:3});}
export function date(value){return value?new Date(value).toISOString().replace('T',' ').replace('.000Z',' UTC'):'Not supplied';}
export function age(hours){return hours===null?'unknown':hours<1?Math.round(hours*60)+' min':hours<48?hours.toFixed(1)+' h':(hours/24).toFixed(1)+' days';}
export function seriesPath(points,{gap=Infinity,logX=false,logY=false,width=300,height=120}={}){
 const valid=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&(!logX||p.x>0)&&(!logY||p.y>0));
 if(!valid.length)return {path:'',bounds:null};
 const transform=(v,log)=>log?Math.log10(v):v,xs=valid.map(p=>transform(p.x,logX)),ys=valid.map(p=>transform(p.y,logY));
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),dx=maxX-minX||1,dy=maxY-minY||Math.max(1,Math.abs(maxY)*.1);
 let path='',previous=null;
 for(const p of points){if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||(logX&&p.x<=0)||(logY&&p.y<=0)){previous=null;continue;}
  const x=10+(transform(p.x,logX)-minX)/dx*(width-20),y=height-10-(transform(p.y,logY)-minY)/dy*(height-20),join=previous&&p.x-previous.x<=gap;
  path+=(join?'L':'M')+x.toFixed(2)+','+y.toFixed(2);previous=p;
 }
 return {path,bounds:{minX:Math.min(...valid.map(p=>p.x)),maxX:Math.max(...valid.map(p=>p.x)),minY:Math.min(...valid.map(p=>p.y)),maxY:Math.max(...valid.map(p=>p.y))},valid_count:valid.length};
}

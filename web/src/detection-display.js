// Fixed screen anchors keep badges apart and keep every anchor on a real
// detection. A cluster is a count of records, never a mineral deposit boundary.
export function detectionClusters(points,project,{width,height,separation=42,padding=20}={}){
 const cells=new Map(),groups=[];
 for(const point of points){
  const p=project(point);
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<padding||p.y<padding||p.x>width-padding||p.y>height-padding)continue;
  const x=Math.floor(p.x/separation),y=Math.floor(p.y/separation);let nearest=null,distance=separation**2;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)for(const group of cells.get(`${x+dx}/${y+dy}`)??[]){const d=(p.x-group.x)**2+(p.y-group.y)**2;if(d<=distance){nearest=group;distance=d;}}
  if(nearest){nearest.points.push(point);continue;}
  const group={x:p.x,y:p.y,points:[point]},key=`${x}/${y}`;groups.push(group);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(group);
 }
 return groups;
}

export function detectionBadge(count){
 if(count===1)return {radius:4,label:''};
 return {radius:count<10?11:count<100?14:18,label:count>999?'999+':String(count)};
}

export function detectionAt(groups,x,y){return groups.find(g=>Math.hypot(g.x-x,g.y-y)<=detectionBadge(g.points.length).radius+3);}

export function detectionHover(host,getGroups){
 const tip=document.createElement('div');tip.className='mineral-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;host.append(tip);
 const hide=()=>{tip.hidden=true;},move=e=>{
  if(e.target.closest('button,input,select,a,.map-tool-panel'))return hide();
  const rect=host.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,group=detectionAt(getGroups(),x,y);if(!group)return hide();
  const p=group.points[0];tip.textContent=group.points.length>1?`${group.points.length} nearby detection records · zoom to separate`:`Hydrated mineral detection · ${p.products}`;
  tip.style.left=Math.max(6,Math.min(rect.width-238,x+16))+'px';tip.style.top=Math.max(6,Math.min(rect.height-65,y+16))+'px';tip.hidden=false;
 };
 host.addEventListener('pointermove',move,{passive:true});host.addEventListener('pointerleave',hide);
 return {hide,destroy(){host.removeEventListener('pointermove',move);host.removeEventListener('pointerleave',hide);tip.remove();}};
}

export function paintDetections(canvas,groups,width,height,ratio=1){
 ratio=Math.min(2,Math.max(1,ratio));const w=Math.round(width*ratio),h=Math.round(height*ratio);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 canvas.style.width=width+'px';canvas.style.height=height+'px';
 const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
 ctx.font='600 11px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const group of groups){
  const {radius,label}=detectionBadge(group.points.length);
  ctx.beginPath();ctx.arc(group.x,group.y,radius+2,0,Math.PI*2);ctx.fillStyle='#07121cc9';ctx.fill();
  ctx.beginPath();ctx.arc(group.x,group.y,radius,0,Math.PI*2);ctx.fillStyle=label?'#27243bea':'#d9b9fa';ctx.fill();ctx.strokeStyle='#dbb9fb';ctx.lineWidth=1.3;ctx.stroke();
  if(label){ctx.fillStyle='#fff3ff';ctx.fillText(label,group.x,group.y+.5);}
 }
}

export function geographicDetectionGroups(points,step=10){
 const groups=new Map();for(const p of points){if(!Number.isFinite(p.lon)||!Number.isFinite(p.lat))continue;const lon=((p.lon+180)%360+360)%360,key=`${Math.floor(lon/step)}/${Math.min(Math.ceil(180/step)-1,Math.floor((90-p.lat)/step))}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
 return [...groups.values()];
}
export function projectDetectionGroups(groups,project,{width,height,padding=20}={}){
 return groups.flatMap(points=>{const p=project(points[0]);return p&&p.x>=padding&&p.y>=padding&&p.x<=width-padding&&p.y<=height-padding?[{x:p.x,y:p.y,points}]:[];});
}

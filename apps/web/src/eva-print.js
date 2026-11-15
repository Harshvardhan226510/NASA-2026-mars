export function previewChecklist({title,summary,source,stations,route}){
 const dialog=document.createElement('dialog');dialog.className='eva-print';dialog.setAttribute('aria-label','Field checklist');
 const make=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const header=make('div',''),close=make('button','Close preview'),print=make('button','Print / save as PDF');
 close.onclick=()=>dialog.close();print.onclick=()=>window.print();header.append(close,print);
 dialog.append(header,make('h1',title),make('p',summary),make('p',source));
 dialog.append(make('h2','Route and departure checks'));
 const checks=make('ul','');for(const item of route)checks.append(make('li','□ '+item));dialog.append(checks);
 dialog.append(make('h2','Station tasks'));
 for(const station of stations){
  dialog.append(make('h3','□ '+station.name),make('p',station.question),make('p',`Kit — ${station.equipment}`),make('p',`Record — ${station.expected}`),make('p',`Planned work — ${station.minutes} min · ${station.status}`));
 }
 dialog.append(make('p','Field observations __________________________________________________'),make('p','Check real conditions and equipment through the mission operator. Pyxis budgets are illustrative scenarios.'));
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}

export function binaryTerrainSTL(heights,{rows,cols,width=120,relief=1}={}){
 if(rows<2||cols<2||heights.length!==rows*cols||!heights.every(Number.isFinite))throw Error('A complete measured elevation window is needed for this print.');
 const dx=width/(cols-1),base=2,min=Math.min(...heights),dy=dx;
 const grid=(x,y)=>[x*dx,(rows-1-y)*dy,base+(heights[y*cols+x]-min)*relief];
 const below=p=>[p[0],p[1],0],tris=[];
 const quad=(a,b,c,d)=>tris.push([a,b,c],[a,c,d]);
 for(let y=0;y<rows-1;y++)for(let x=0;x<cols-1;x++){
  const a=grid(x,y),b=grid(x,y+1),c=grid(x+1,y+1),d=grid(x+1,y);quad(a,b,c,d);quad(below(d),below(c),below(b),below(a));
  for(const [edge,u,v] of [[x===0,a,b],[y===rows-2,b,c],[x===cols-2,c,d],[y===0,d,a]])if(edge)quad(v,u,below(u),below(v));
 }
 const buffer=new ArrayBuffer(84+50*tris.length),out=new DataView(buffer);out.setUint32(80,tris.length,true);
 for(const [i,[a,b,c]] of tris.entries()){
  const u=b.map((x,j)=>x-a[j]),v=c.map((x,j)=>x-a[j]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],size=Math.hypot(...n)||1;
  [...n.map(x=>x/size),...a,...b,...c].forEach((x,j)=>out.setFloat32(84+i*50+j*4,x,true));
 }
 return buffer;
}

export function saveTerrainSTL(grid,route=[]){
 const stride=Math.max(1,Math.ceil((Math.max(grid.rows,grid.cols)-1)/64));
 const indices=size=>[...Array.from({length:Math.ceil((size-1)/stride)},(_,i)=>i*stride),size-1];
 const ys=indices(grid.rows),xs=indices(grid.cols);
 const original=grid.elevation_matrix;if(original.some(row=>row.some(h=>!Number.isFinite(h))))throw Error('The planning window contains unmeasured elevations. The printable model needs a complete grid.');
 const heights=ys.flatMap(y=>xs.map(x=>original[y][x]));
 const relief=120/((grid.cols-1)*grid.resolution_meters),mask=new Set();
 for(const point of route)if(Array.isArray(point)&&point.length>=2){const [row,col]=point;if(Number.isInteger(row)&&Number.isInteger(col)&&row>=0&&col>=0&&row<grid.rows&&col<grid.cols)mask.add(`${Math.min(ys.length-1,Math.round(row/stride))}/${Math.min(xs.length-1,Math.round(col/stride))}`);}
 const model=binaryTerrainSTL(heights.map((h,i)=>h+(mask.has(`${Math.floor(i/xs.length)}/${i%xs.length}`)?1/relief:0)),{rows:ys.length,cols:xs.length,relief});
 const url=URL.createObjectURL(new Blob([model],{type:'model/stl'})),a=document.createElement('a');a.href=url;a.download='pyxis-marswalk-terrain.stl';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

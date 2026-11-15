export const graphicsFailure=error=>/webgl|graphics context|rendering context/i.test(error?.message??'');

export function graphicsOptions(mode='standard'){
 const options={showRenderLoopErrors:false};
 if(mode!=='standard')Object.assign(options,{msaaSamples:1,contextOptions:{requestWebgl1:mode==='webgl1',allowTextureFilterAnisotropic:false,webgl:{alpha:false,antialias:false,stencil:true,powerPreference:'default',preserveDrawingBuffer:false,failIfMajorPerformanceCaveat:false}}});
 return options;
}

export class GraphicsStartupError extends Error{
 constructor(errors){super('The browser could not start the 3D graphics renderer.',{cause:errors.at(-1)?.error});this.name='GraphicsStartupError';this.attempts=errors;}
}

export async function startGraphics(create,{compatible=false,clear=()=>{},wait=ms=>new Promise(r=>setTimeout(r,ms)),onAttempt=()=>{}}={}){
 const errors=[],modes=compatible?['compatible','webgl1']:['standard','compatible','webgl1'];
 for(const mode of modes){
  onAttempt(mode);
  try{return {viewer:await create(graphicsOptions(mode),mode),mode};}
  catch(error){clear();if(!graphicsFailure(error))throw error;errors.push({mode,error});}
  if(mode!==modes.at(-1))await wait(250);
 }
 throw new GraphicsStartupError(errors);
}

export function recoveryURL(href,basic=false){
 const url=new URL(href);if(basic)url.searchParams.set('map','basic2d');else{url.searchParams.delete('map');url.searchParams.set('graphics','compatible');}return url.href;
}

export function showGraphicsRecovery(error,{runtime=false,document:doc=document,location:loc=location}={}){
 if(doc.getElementById('graphics-recovery'))return;
 console.error(runtime?'map_render_stopped':'map_startup_failed',error);
 doc.dispatchEvent(new Event('atlas-startup-error'));
 doc.body.classList.add('graphics-startup-failed');
 const card=doc.createElement('section');card.id='graphics-recovery';card.className='graphics-recovery';card.setAttribute('role','alert');card.setAttribute('aria-labelledby','graphics-recovery-title');
 const heading=doc.createElement('h2');heading.id='graphics-recovery-title';heading.textContent=runtime?'The 3D view stopped':'The 3D view couldn’t start';
 const message=doc.createElement('p');message.textContent=graphicsFailure(error)||error instanceof GraphicsStartupError?'The browser couldn’t start or keep its graphics renderer. You can retry with lighter graphics or continue browsing the surface in Basic 2D.':'The map could not finish loading. Retry the map, or continue with the basic surface view.';
 const actions=doc.createElement('div');actions.className='graphics-recovery-actions';
 for(const [label,basic] of [['Retry 3D',false],['Open Basic 2D',true]]){const link=doc.createElement('a');link.textContent=label;link.href=recoveryURL(loc.href,basic);actions.append(link);}
 const note=doc.createElement('p');note.className='graphics-recovery-note';note.textContent='Your saved missions stay in this browser. Basic 2D supports imagery, places and spacecraft pins.';
 const details=doc.createElement('details'),summary=doc.createElement('summary'),text=doc.createElement('pre');summary.textContent='Error details';text.textContent=error?.cause?.message??error?.message??String(error);details.append(summary,text);
 card.append(heading,message,actions,note,details);doc.getElementById('workspace').append(card);actions.firstElementChild.focus();
}

export function watchGraphics(viewer,onFailure){
 let stopped=false;
 const fail=error=>{if(stopped)return;stopped=true;viewer.useDefaultRenderLoop=false;onFailure(error);};
 const lost=event=>{event.preventDefault();fail(new Error('The browser lost its WebGL graphics context.'));};
 viewer.canvas.addEventListener('webglcontextlost',lost);
 const remove=viewer.scene.renderError.addEventListener((_scene,error)=>fail(error));
 return ()=>{viewer.canvas.removeEventListener('webglcontextlost',lost);remove();};
}

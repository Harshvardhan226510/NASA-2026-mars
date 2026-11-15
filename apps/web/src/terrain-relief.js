// Display exaggeration belongs to the scene, never to the physical DEM provider.
// Keep one datum across the globe and selected observations to avoid a step when
// selecting a strip. Cesium updates terrain bounds, skirts and clamped objects.
export const ENHANCED_RELIEF_SCALE=3;
export const RELIEF_STORAGE_KEY='mars-atlas-terrain-relief-v1';
export function reliefScale(enabled){return enabled?ENHANCED_RELIEF_SCALE:1;}
export class TerrainRelief{
 constructor(viewer,{surface=()=>null,controls=[],storage,onChange=()=>{}}={}){
  Object.assign(this,{viewer,surface,controls,storage,onChange});this.enabled=true;
  try{const saved=storage?.getItem(RELIEF_STORAGE_KEY);if(saved==='false'||saved==='true')this.enabled=saved==='true';}catch{}
  for(const input of controls)input.addEventListener('change',()=>this.set(input.checked));this.apply();
 }
 get scale(){return reliefScale(this.enabled);}
 set(enabled){this.enabled=Boolean(enabled);try{this.storage?.setItem(RELIEF_STORAGE_KEY,String(this.enabled));}catch{}this.apply();}
 apply(){
  const scene=this.viewer.scene;scene.verticalExaggeration=this.scale;scene.verticalExaggerationRelativeHeight=0;
  this.surface()?.setExaggeration(this.scale);
  for(const input of this.controls)input.checked=this.enabled;
  this.onChange(this.scale);scene.requestRender();
 }
}

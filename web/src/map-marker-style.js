// Shared screen-space styling; source coordinates and visibility rules stay intact.
export const PIN_SIZE = Object.freeze([32, 38]);
export const PIN_ANCHOR = Object.freeze([16, 36]);

const glyphs = {
 camp:'<path d="M8 29 20 12 32 29H8Zm12-17v17m0-23v6m0-6h9l-3 3 3 3h-9"/>',
 saved:'<path d="M13 11h14v20l-7-5-7 5V11Z"/>',
 region:'<path d="m10 25 7-11 5 7 3-4 6 8H10Z M15 18l2 3 3-2"/>',
 science:'<path d="M16 11h8 M18 11v8l-6 9h16l-6-9v-8 M16 23h8"/><circle cx="21" cy="25" r=".8" fill="currentColor"/>',
 minerals:'<path d="m20 10 9 9-9 10-9-10 9-9Z M11 19h18 M20 10l-4 9 4 10 4-10-4-9Z"/>',
 resources:'<path d="M20 10c-2 4-8 9-8 14a8 8 0 0 0 16 0c0-5-6-10-8-14Z M16 24a4 4 0 0 0 4 4"/>',
 rover:'<rect x="12" y="16" width="16" height="8" rx="2"/><path d="M22 16v-6h5 M12 27h16"/><circle cx="14" cy="26" r="2"/><circle cx="26" cy="26" r="2"/>',
 helicopter:'<path d="M20 10v18 M9 13h22 M13 18l14 6 M13 29l7-6 7 6"/><rect x="16" y="18" width="8" height="5"/>',
 lander:'<path d="M14 16h12l2 8H12l2-8Z M15 24l-5 6 M25 24l5 6 M20 16V10 M16 10h8"/>',
 failed_lander:'<path d="m14 14 12 12 M14 26l12-12"/><circle cx="20" cy="20" r="11"/>',
};
const colors={region:'#abe5d4',science:'#cfb7ff',minerals:'#f4cf83',resources:'#8ae1eb'};

export function mapPinSVG(kind, selected=false) {
 if(kind==='camp')return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="96" viewBox="0 0 40 48"><path d="m20 2 17 9v20l-17 9L3 31V11Z" fill="#102c2c" stroke="#a4e5d2" stroke-width="2"/><path d="M20 40v4" stroke="#a4e5d2" stroke-width="2"/><g fill="none" stroke="#d6fff0" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${glyphs.camp}</g><circle cx="20" cy="45" r="2" fill="#a4e5d2"/></svg>`);
 const accent=colors[kind]??'#f4cf83',glyph=glyphs[kind]??glyphs.lander;
 // Render the vector at 2.5× display size so Cesium's texture atlas stays sharp.
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="96" viewBox="0 0 40 48"><circle cx="20" cy="21" r="18" fill="#060d16" fill-opacity=".4"/><path d="M20 34v8" stroke="#09121b" stroke-width="5" stroke-linecap="round"/><path d="M20 34v8" stroke="${accent}" stroke-width="1.5"/><circle cx="20" cy="20" r="16" fill="${selected?'#25463f':'#11232e'}" stroke="${selected?'#ffffff':accent}" stroke-width="${selected?2.5:1.5}"/><circle cx="20" cy="20" r="13" fill="none" stroke="${accent}" stroke-opacity=".15"/><g color="${accent}" fill="none" stroke="${accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${glyph}</g><circle cx="20" cy="44" r="2" fill="${accent}"/></svg>`);
}

export function mapLabel(C, options={}) {
 return {font:'600 14px "Segoe UI", sans-serif',fillColor:C.Color.fromCssColorString('#f3f8fb'),style:C.LabelStyle.FILL,outlineWidth:0,showBackground:true,backgroundColor:C.Color.fromCssColorString('#101e2bef'),backgroundPadding:new C.Cartesian2(9,6),...options};
}

export function renderScale(width,height,pixelRatio=1) {
 const dpr=Number.isFinite(pixelRatio)?Math.max(1,pixelRatio):1;
 const area=Number.isFinite(width*height)&&width>0&&height>0?width*height:1;
 // Cap both density and total canvas size on larger / high-DPI laptops.
 return Math.min(2,dpr,Math.max(1,Math.sqrt(6000000/area)));
}

export function sharpenMap(viewer,host=window,{maxScale=2}={}) {
 // Compatible graphics avoids hardware MSAA. Keep inexpensive post-process
 // edge smoothing so thin terrain annotations do not become stair-stepped.
 if(viewer.scene.postProcessStages?.fxaa)viewer.scene.postProcessStages.fxaa.enabled=true;
 const update=()=>{viewer.useBrowserRecommendedResolution=true;viewer.resolutionScale=Math.min(maxScale,renderScale(viewer.canvas.clientWidth,viewer.canvas.clientHeight,host.devicePixelRatio));viewer.scene.requestRender();};
 update();host.addEventListener('resize',update);
 return ()=>host.removeEventListener('resize',update);
}

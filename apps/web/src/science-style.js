// Fixed scales across the planet; zoom and viewport never rescale the values.
const palettes={
 terrain:[[39,79,112],[63,130,145],[160,190,163],[235,203,125],[202,106,75]],
 minerals:[[48,48,83],[92,80,137],[153,117,180],[209,165,199],[249,221,201]],
 water:[[40,61,104],[45,111,151],[66,169,184],[152,211,207],[222,244,229]],
 heat:[[49,58,110],[106,89,143],[186,116,133],[235,165,114],[251,224,162]],
 air:[[44,65,106],[68,112,145],[119,172,181],[192,215,202],[242,231,174]],
 diverging:[[40,79,165],[44,157,194],[70,78,87],[224,151,64],[180,51,83]],
 aspect:[[192,107,149],[216,170,99],[109,177,139],[81,142,183],[139,122,184],[192,107,149]],
 gray:[[25,36,49],[235,235,219]]
};
const classes={
 'relay-visibility':[[0,'0',[39,79,112]],[1,'1',[58,120,138]],[2,'2',[121,166,156]],[3,'3',[190,195,148]],[4,'4',[228,184,115]],[5,'5',[202,106,75]]],
 'terrain-data-confidence':[[0,'MOLA fallback',[78,133,174]],[1,'HRSC / MOLA',[225,190,118]]],
 'terrain-landform-classification':[[0,'Depression',[89,143,180]],[1,'Intermediate',[174,189,169]],[2,'Ridge',[210,168,109]],[3,'Slope',[173,119,159]]],
 'terrain-accessibility-classification':[[0,'<5°',[96,168,154]],[1,'5–15°',[209,200,132]],[2,'15–30°',[221,150,105]],[3,'≥30°',[178,100,111]]]
};
function palette(kind){
 if(kind==='slope-aspect')return palettes.aspect;
 if(kind==='terrain-curvature')return palettes.diverging;
 if(kind==='terrain-hillshade-fixed-lighting')return palettes.gray;
 if(/ice|hydrogen|frost|cloud/.test(kind))return palettes.water;
 if(/mineral|olivine|pyroxene|hematite|feldspar|glass-clay|potassium|thorium/.test(kind))return palettes.minerals;
 if(/temperature|thermal|infrared|uv/.test(kind))return palettes.heat;
 if(/atmospher|solar|illumination/.test(kind))return palettes.air;
 return palettes.terrain;
}
export function overlayColor(value,min,max,kind=''){
 if(!Number.isFinite(value))return [0,0,0,0];
 const discrete=classes[kind];if(discrete){const index=Math.max(0,Math.min(discrete.length-1,Math.round(value)));return [...discrete[index][2],255];}
 const signed=min<0&&max>0&&/curvature|gravity|magnetic/.test(kind);if(signed){const factor=kind==='terrain-curvature'?.00001:.035,span=value<0?-min:max;value=Math.sign(value)*span*Math.asinh(Math.abs(value)/span/factor)/Math.asinh(1/factor);}
 const t=kind==='slope-aspect'?((value%360+360)%360)/360:Math.max(0,Math.min(1,(value-min)/(max-min))),ramp=min<0&&max>0&&kind!=='slope-aspect'?palettes.diverging:palette(kind),p=t*(ramp.length-1),i=Math.min(ramp.length-2,Math.floor(p)),f=p-i;
 return [...ramp[i].map((v,c)=>Math.round(v+(ramp[i+1][c]-v)*f)),255];
}
export function overlayScale(kind,min,max){
 if(classes[kind])return {classes:classes[kind].map(([value,label,color])=>({value,label,color:`rgb(${color.join(',')})`}))};
 const ticks=kind==='slope-aspect'?['N','E','S','W','N']:[min,min+(max-min)/2,max].map(v=>Number(v.toPrecision(3)).toLocaleString());
 const stops=Array.from({length:33},(_,i)=>{const value=min+(max-min)*i/32;return `rgb(${overlayColor(value,min,max,kind).slice(0,3).join(',')}) ${i/32*100}%`;});
 return {ticks,background:`linear-gradient(to right,${stops.join(',')})`};
}

export function renderOverlayScale(ramp,ends,kind,min,max){
 const scale=overlayScale(kind,min,max);ramp.hidden=Boolean(scale.classes);ends.classList.toggle('science-class-scale',Boolean(scale.classes));ends.replaceChildren();
 if(scale.classes){for(const {label,color} of scale.classes){const chip=document.createElement('span'),swatch=document.createElement('i');swatch.style.background=color;chip.append(swatch,document.createTextNode(label));ends.append(chip);}}
 else{ramp.style.background=scale.background;for(const value of scale.ticks){const tick=document.createElement('span');tick.textContent=value;ends.append(tick);}}
}

import provenance from './ortho-mask-provenance.json' with {type:'json'};
const labels=new Map(provenance.labels.map(p=>[p.dataset_id,p]));
export function hasRecoverableNull(dataset){
 const label=labels.get(dataset.id),stretch=dataset.display_radiometry;
 // For these audited 8-bit products, DN 0 is CORE_NULL, while a valid DN 1
 // remains >=1 after this recorded stretch. A clipped or wider stretch is
 // ambiguous and must not be repaired by guessing from displayed brightness.
 return Boolean(label&&label.product_id===dataset.ortho_source_id&&label.sample_bits===8&&label.core_null===0&&stretch?.source_low===0&&stretch.source_high>0&&stretch.source_high<=255);
}
export function restoreOrthoMask(pixels,dataset){
 if(!hasRecoverableNull(dataset))return 0;let corrected=0;
 for(let i=0;i<pixels.length;i+=2)if(pixels[i]===0&&pixels[i+1]!==0){pixels[i+1]=0;corrected++;}
 return corrected;
}

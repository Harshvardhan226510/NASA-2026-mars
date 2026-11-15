export function el(tag,text,cls){
 const node=document.createElement(tag);
 if(text!==undefined&&text!==null)node.textContent=text;
 if(cls)node.className=cls;
 return node;
}
export function action(text,handler,cls){
 const button=el('button',text,cls);button.type='button';button.onclick=handler;return button;
}
export function sourceLink(title,url){
 const anchor=el('a',title);anchor.href=url;anchor.target='_blank';anchor.rel='noopener';return anchor;
}
export function field(label,input){
 const wrapper=el('label',label);wrapper.append(input);return wrapper;
}
export const fmt=(n,unit='',digits=1)=>Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:digits})+(unit?' '+unit:''):'Unknown';

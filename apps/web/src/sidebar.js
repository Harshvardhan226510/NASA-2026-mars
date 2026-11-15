export function sidebarControls(onResize){
 const button=document.getElementById('sidebar-toggle'),sidebar=document.getElementById('sidebar');
 let collapsed=document.body.dataset.interface==='orbit';
 const apply=()=>{document.body.classList.toggle('sidebar-collapsed',collapsed);sidebar.hidden=collapsed;button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',collapsed?'Open explorer':'Close explorer');button.title=collapsed?'Open explorer':'Close explorer';requestAnimationFrame(onResize);};
 button.onclick=()=>{collapsed=!collapsed;apply();};apply();
}

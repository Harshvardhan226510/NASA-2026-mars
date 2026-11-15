import {coordinateText,normalizedPoint,spacingText} from './surface-readout.js';
import {distanceKm} from './place-context.js';
import {nearbyRoverViews} from './rover-ground-view.js';
import {REGIONAL_IMAGERY} from './regional-sources.js';
import {distance,environmentRows,inside,line,missing,nearest,number,scienceAt,solarRows,terrainRows,tileAt} from './point-inspector-data.js';

const sections=['Geography','Science','Environment','Imagery','Mission'];
const node=(tag,text)=>Object.assign(document.createElement(tag),text?{textContent:text}:{});
const button=(label,click)=>Object.assign(node('button',label),{type:'button',onclick:click});

function record(row,action) {
  const item=node('article');
  const heading=node('div');
  heading.append(node('strong',row.name),node('small',row.kind));
  item.append(heading,node('p',row.value));
  if(row.detail)item.append(node('small',row.detail));
  if(/^https?:\/\//.test(row.url??''))item.append(Object.assign(node('a','Source'),{href:row.url,target:'_blank',rel:'noopener noreferrer'}));
  if(action)item.append(action);
  return item;
}

function photo(row,url) {
  const image=node('img');
  image.src=url;image.alt=row.name;image.loading='lazy';image.referrerPolicy='no-referrer';
  image.onerror=()=>image.replaceWith(node('small','Image could not be retrieved.'));
  return record(row,image);
}

export class PointInspector {
  constructor(host) {
    this.host=host;
    this.rows=new Map();
    this.groups=new Map();
    this.panel=node('aside');
    this.panel.id='atlas-point-inspector';
    this.panel.hidden=true;
    this.panel.setAttribute('aria-label','Mars point inspector');
    this.toggle=button('Inspect',()=>this.setPicking(!this.picking));
    this.toggle.className='atlas-field-top-button';
    this.toggle.setAttribute('aria-controls',this.panel.id);
    this.toggle.setAttribute('aria-pressed','false');
    const heading=node('header');
    const title=node('h2','Point inspector');
    this.fold=button('Collapse',()=>{
      this.contents.hidden=!this.contents.hidden;
      this.fold.textContent=this.contents.hidden?'Expand':'Collapse';
      this.fold.setAttribute('aria-expanded',String(!this.contents.hidden));
    });
    this.fold.setAttribute('aria-expanded','true');
    heading.append(title,this.fold,button('Close',()=>this.close()));
    this.coordinates=node('p');
    this.coordinates.className='point-inspector-coordinates';
    this.contents=node('div');
    this.contents.className='point-inspector-scroll';
    this.help=node('p','Click or tap Mars in 2D or 3D. Active map tools keep their current controls.');
    const actions=node('div');
    actions.className='point-inspector-actions';
    this.actions=actions;
    for(const [label,run] of [
      ['Plan route',point=>host.route(point)],
      ['Evaluate landing site',point=>host.evaluate(point,'landing')],
      ['Evaluate base site',point=>host.evaluate(point,'base')],
      ['Add waypoint',point=>host.waypoint(point)],
      ['Compare locations',()=>this.compare()],
      ['Save observation',()=>{this.observation.hidden=false;this.observation.elements.label.focus();}],
      ['Ask ARES',point=>host.ask(point,this.evidence())],
    ])actions.append(button(label,()=>{if(this.point)run([...this.point]);}));
    this.observation=node('form');
    this.observation.hidden=true;
    const label=node('label','Observation label');
    const input=Object.assign(node('input'),{name:'label',required:true,maxLength:160});
    label.append(input);
    this.observationStatus=node('p');
    this.observationStatus.setAttribute('role','status');
    const save=Object.assign(node('button','Save'),{type:'submit'});
    this.observation.append(label,save,this.observationStatus);
    this.observation.onsubmit=async event=>{
      event.preventDefault();
      const selection=this.point, label=input.value;
      if(!selection||!label.trim())return;
      save.disabled=true;
      try {
        await host.save(selection,label.trim());
        if(this.point===selection){this.observationStatus.textContent='Saved in local observations.';input.value='';}
      } catch(error){if(this.point===selection)this.observationStatus.textContent=error.message;}
      finally {save.disabled=false;}
    };
    this.comparison=node('div');
    this.comparison.hidden=true;
    this.contents.append(this.help,actions,this.observation,this.comparison);
    for(const name of sections){
      const section=node('details'),summary=node('summary',name),body=node('div');
      section.open=['Geography','Science','Environment'].includes(name);
      section.append(summary,body);
      this.groups.set(name,{section,body});
      this.contents.append(section);
    }
    this.panel.append(heading,this.coordinates,this.contents);
    document.body.append(this.panel);
    document.querySelector('.ui-header-tools')?.prepend(this.toggle);
    document.addEventListener('atlas-inspect-point',event=>this.select(event.detail));
    this.setReportVisible(false);
  }

  setReportVisible(visible) {
    this.actions.hidden=!visible;
    for(const {section} of this.groups.values())section.hidden=!visible;
  }

  setPicking(value) {
    this.picking=value;
    this.toggle.setAttribute('aria-pressed',String(value));
    document.body.classList.toggle('point-inspector-picking',value);
    if(value){this.panel.hidden=false;this.help.textContent='Click or tap a point on Mars.';}
    else this.help.textContent='Select Inspect in the top bar to pick another point.';
  }

  close() {
    this.setPicking(false);
    this.controller?.abort();
    clearInterval(this.missionTimer);
    this.panel.hidden=true;
    this.host.marker(null);
  }

  select(value) {
    const point=normalizedPoint(value);
    if(!point)return;
    this.controller?.abort();
    clearInterval(this.missionTimer);
    this.controller=new AbortController();
    const {signal}=this.controller;
    const at=new Date().toISOString();
    this.point=point;
    this.rows.clear();
    this.panel.hidden=false;
    this.host.marker(point);
    this.coordinates.textContent=coordinateText(point);
    this.help.textContent=this.picking?'Click another point to update this report.':'Select Inspect to pick a different point.';
    this.setReportVisible(true);
    this.observation.reset();
    this.observation.hidden=true;
    this.observationStatus.textContent='';
    for(const {body} of this.groups.values())body.replaceChildren(node('p','Loading…'));
    const named=nearest(point,this.host.landmarks(),100);
    const places=named.map(p=>line(p.name,distance(p.distance)+' from named centre','Observed','USGS/IAU Gazetteer · centre distance',p.url));
    if(!places.length)places.push(missing('Named landmarks','No catalogue centre within 100 km.'));
    const solar=solarRows(point,at);
    const science=this.host.targets(point);
    this.set('Geography',places);
    this.set('Science',science);
    this.set('Environment',solar);
    this.renderMission();
    this.missionTimer=setInterval(()=>this.renderMission(),3000);
    this.updateComparison();
    const run=(promise,apply,failed)=>Promise.resolve(promise).then(value=>{
      if(!signal.aborted)apply(value);
    }).catch(()=>{if(!signal.aborted)failed();});
    this.terrainPromise=this.host.terrain(point,at);
    run(this.terrainPromise,packet=>{
      const result=terrainRows(packet);
      this.set('Geography',[...result.filter(row=>row.name!=='Terrain shadow'),...places]);
      this.shadowRows=result.filter(row=>row.name==='Terrain shadow');
      this.renderEnvironment();
      this.updateComparison();
    },()=>this.set('Geography',[missing('Physical terrain','The terrain query failed.'),...places]));
    this.shadowRows=[];this.weatherRows=[];
    run(this.host.environment(point),packet=>{this.weatherRows=environmentRows(packet);this.renderEnvironment();},
      ()=>{this.weatherRows=[missing('Environmental data','The local archives could not be read.')];this.renderEnvironment();});
    const showScience=(rows)=>this.set('Science',[...rows,...science]);
    const reference=[];
    run(scienceAt(point,signal,rows=>{if(!signal.aborted){reference.push(...rows);showScience(reference);}}),
      rows=>showScience([...reference,...rows]),()=>showScience([...reference,missing('Reference data','No additional source cells could be loaded.')]));
    run(this.renderImagery(point,signal),()=>{},()=>this.set('Imagery',[missing('Imagery','No associated imagery could be read.')]));
  }

  set(name,rows) {
    this.rows.set(name,rows);
    this.groups.get(name).body.replaceChildren(...rows.map(row=>record(row)));
  }

  renderEnvironment() {
    const sunlight=(this.rows.get('Environment')??[]).filter(row=>row.name==='Sunlight');
    this.set('Environment',[...sunlight,...this.shadowRows,...this.weatherRows]);
  }

  renderMission() {
    if(!this.point||this.panel.hidden)return;
    const rows=this.host.mission(this.point);
    const signature=JSON.stringify(rows);
    if(signature===this.missionSignature&&this.rows.has('Mission'))return;
    this.missionSignature=signature;
    this.set('Mission',rows);
  }

  async renderImagery(point,signal) {
    const body=this.groups.get('Imagery').body;
    const coverage=this.host.imageCoverage(point);
    const base=line('Orbital imagery',coverage?coverage.source:'Bundled Mars overview','Observed',
      coverage?`Loaded map sampling ≈${spacingText(coverage.metres)} per pixel. Acquisition time and registration uncertainty are unavailable here.`
        :'CTX/Viking starter imagery · coarse global coverage. Acquisition time varies.');
    const rover=nearbyRoverViews(point).filter(item=>item.distance<=50000);
    const roverRows=rover.map(item=>line(`${item.rover} · ${item.name}`,item.panorama?'Panorama':'Photograph','Observed',
      `${item.instrument} · ${item.sol} · ${distance(item.distance/1000)} away · ${item.basis} · ${item.credit}`,item.source));
    this.rows.set('Imagery',[base,...roverRows]);
    body.replaceChildren(record(base),photo(line('Hemisphere overview','Bundled CTX / Viking','Observed',
      'Coarse context image for the selected hemisphere.'),`/globe-overview-${point[0]<0?0:1}.jpg`));
    for(const [index,item] of rover.entries()){
      const onlineOnly=this.host.offline()&&!item.image.startsWith('/');
      const tile=onlineOnly?record(roverRows[index],node('small','Image needs Online Mode.')):photo(roverRows[index],item.image);
      if(!onlineOnly)tile.append(button('Open rover imagery',()=>this.host.rover(point,item.id)));
      body.append(tile);
    }
    if(!rover.length)body.append(record(missing('Rover photographs and panoramas','No catalogued view within 50 km.')));
    const response=await fetch('/api/desktop/source-maps',{signal});
    if(!response.ok)return;
    const packages=(await response.json()).filter(item=>item.bounds.some(bounds=>inside(point,bounds))).sort((a,b)=>a.metresPerPixel-b.metresPerPixel);
    signal.throwIfAborted();
    for(const item of packages.slice(0,3)){
      const {x,y,z}=tileAt(point,item.level);
      const url=`/api/desktop/source-imagery?id=${encodeURIComponent(item.id)}&z=${z}&y=${y}&x=${x}`;
      body.append(photo(line(item.productName,'Installed orbital tile','Observed',
        `${item.credit} · ≈${spacingText(item.metresPerPixel)}/px · coverage may contain gaps.`),url));
    }
    if(!this.host.offline()){
      const regional=Object.entries(REGIONAL_IMAGERY).filter(([,source])=>inside(point,source.bounds)).sort(([,a],[,b])=>a.metres-b.metres)[0];
      if(regional){
        const [kind,source]=regional,{x,y,z}=tileAt(point,source.max);
        body.append(photo(line(source.name,'Source tile','Observed',
          `NASA Mars Trek · nominal source ${source.metres} m/px. Publisher coverage may have gaps.`),
          `/api/planet?kind=${kind}&z=${z}&y=${y}&x=${x}`));
      }
    }
  }

  compare() {
    const anchor=this.anchor={point:[...this.point],rows:[...(this.rows.get('Geography')??[])]};
    void this.terrainPromise.then(packet=>{
      if(this.anchor===anchor){anchor.rows=terrainRows(packet);this.updateComparison();}
    }).catch(()=>{});
    this.setPicking(true);
    this.updateComparison();
  }

  updateComparison() {
    if(!this.anchor)return;
    this.comparison.hidden=false;
    const {point,rows}=this.anchor;
    const other=this.rows.get('Geography')??[];
    const summary=node('p',`A · ${coordinateText(point)} | B · ${coordinateText(this.point)} · ${distance(distanceKm(point,this.point))} surface separation`);
    const measures=['Elevation','Slope'].map(name=>{
      const a=rows.find(row=>row.name===name),b=other.find(row=>row.name===name);
      const detail=[a?.detail,b?.detail].filter(Boolean);
      const item=node('p',`${name} · A ${a?.value??'unavailable'} · B ${b?.value??'unavailable'}`);
      if(detail.length)item.append(node('small',' · '+[...new Set(detail)].join(' | ')));
      return item;
    });
    this.comparison.replaceChildren(node('strong','Compare points'),summary,...measures,button('Clear comparison',()=>{
      this.comparison.hidden=true;this.anchor=null;
    }));
  }

  evidence() {
    return [...this.rows.values()].flat().map(row=>`${row.kind} · ${row.name}: ${row.value}. ${row.detail}`).join('\n');
  }
}

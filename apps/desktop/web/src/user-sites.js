import {validateSiteAttachments} from './site-attachments.js';
import {siteLocationFix} from './external-location.js';
export const USER_SITES_KEY='mars-atlas-user-sites-v1',MAX_USER_SITES=200;
export const USER_SITE_CATEGORIES=Object.freeze({science:'Science',minerals:'Minerals',resources:'Resources'});
export const USER_SITE_TAG_PRESETS=Object.freeze(['Done','Review','Search in detail']);
const MAX_TAGS=8,MAX_TAG_LENGTH=32;
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const trimTag=value=>value.trim().replace(/\s+/g,' ');
export const userSiteTagKey=tag=>trimTag(tag).toLowerCase();
function validateTags(input=[]){
 if(!Array.isArray(input))throw Error('Invalid site tags.');
 const tags=new Map();
 for(const value of input){
  if(typeof value!=='string')throw Error('Site tags must be text.');
  const tag=trimTag(value),key=userSiteTagKey(tag);
  if(!tag||tags.has(key))continue;
  if(tag.length>MAX_TAG_LENGTH||/[,\p{Cc}]/u.test(tag))throw Error(`Use up to ${MAX_TAG_LENGTH} characters per tag and separate tags with commas.`);
  tags.set(key,USER_SITE_TAG_PRESETS.find(preset=>userSiteTagKey(preset)===key)??tag);
  if(tags.size>MAX_TAGS)throw Error(`Use up to ${MAX_TAGS} tags per site.`);
 }
 return [...tags.values()];
}
export function validateUserSite(input){
 if(!input||typeof input!=='object')throw Error('Invalid saved site.');
 const id=text(input.id,100),name=text(input.name,80),p=input.center;
 if(!/^user-[a-zA-Z0-9-]{1,90}$/.test(id))throw Error('Invalid saved site identifier.');
 if(!name)throw Error('Give your site a name.');
 if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)throw Error('Enter a latitude from −90 to 90 and longitude from −180 to 180.');
 if(!Object.hasOwn(USER_SITE_CATEGORIES,input.category))throw Error('Choose Science, Minerals or Resources.');
 if(input.evaluationKind!==undefined&&!['landing','base'].includes(input.evaluationKind))throw Error('Invalid evaluation type.');
 return {id,name,attachments:validateSiteAttachments(input.attachments),description:text(input.description,2000),tags:validateTags(input.tags),center:[...p],isValue:input.isValue===true,category:input.category,...(input.evaluationKind?{evaluationKind:input.evaluationKind}:{}),...(input.locationFix?{locationFix:siteLocationFix(input.locationFix,p)}:{})};
}
export function validateUserSites(input=[]){
 if(!Array.isArray(input)||input.length>MAX_USER_SITES)throw Error(`Up to ${MAX_USER_SITES} marked sites can be saved.`);
 const sites=input.map(validateUserSite);
 if(new Set(sites.map(s=>s.id)).size!==sites.length)throw Error('Repeated saved site identifiers.');
 return sites;
}
export function upsertUserSite(sites,input){const clean=validateUserSite(input),next=validateUserSites(sites),i=next.findIndex(s=>s.id===clean.id);if(i<0)next.push(clean);else next[i]=clean;return validateUserSites(next);}
export function userValueSite(input){
 const s=validateUserSite(input);
 return {...s,userDefined:true,personalValue:s.isValue,radiusKm:.25,summary:s.description||'A location marked by you.',
  type:s.isValue?`Your ${USER_SITE_CATEGORIES[s.category].toLowerCase()} site of value`:'Your marked site',
  evidence:'User supplied · unverified',evidenceClass:'user_defined',coordinateNote:'Location marked by a user',
  validation:'The name, description and value category are user supplied. This designation is a planning preference; it does not establish a scientific detection or resource deposit.',sources:[]};
}
export function userValueSites(sites){return validateUserSites(sites).filter(s=>s.isValue).map(userValueSite);}

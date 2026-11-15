import {isDeepStrictEqual} from 'node:util';
import {locationFix,freshLocation,LOCATION_FRAME,LOCATION_MAX_AGE_MS} from '../web/src/external-location.js';
const reject=(message,status=422)=>{throw Object.assign(Error(message),{status});};

export class LocationInput{
 constructor({clock=Date.now}={}){
  this.clock=clock;this.fixes=new Map();
  this.routes=new Map([
   ['GET /v1/location/status',()=>this.status()],
   ['POST /v1/location/fixes',(_query,body)=>this.accept(body)],
  ]);
 }
 accept(input){
  const fix=locationFix(input),age=this.clock()-Date.parse(fix.at);
  if(age < -5000||age>60000)reject('Fix timestamp must be within the last minute and no more than five seconds ahead. Synchronize device clocks.');
  const previous=this.fixes.get(fix.sourceId);
  if(previous&&Date.parse(fix.at)<=Date.parse(previous.at)){
   if(isDeepStrictEqual(previous,fix))return {accepted:true,duplicate:true,fix,fresh:freshLocation(fix,this.clock())};
   reject('This source already supplied the same or a later timestamp.',409);
  }
  if(!previous&&this.fixes.size>=32)reject('Up to 32 location sources are supported per app session.',429);
  this.fixes.set(fix.sourceId,fix);
  return {accepted:true,fix:structuredClone(fix),fresh:freshLocation(fix,this.clock())};
 }
 status(){return {frame:LOCATION_FRAME,maxAgeSeconds:LOCATION_MAX_AGE_MS/1000,nowMs:this.clock(),sources:[...this.fixes.values()].map(fix=>({...structuredClone(fix),fresh:freshLocation(fix,this.clock())}))};}
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {mountVoiceActivity,voiceOrbState} from '../src/voice-activity.js';
import {MODE_FRAMES,resolvePreset} from '../src/vendor/thinking-orbs/engine.js';

test('listening and speech use distinct upstream orb presets with valid geometry',()=>{
 const names=['idle','listening','speaking'].map(voiceOrbState);assert.deepEqual(names,['breathing','listening','composing']);
 const frames=names.map(name=>{const p=resolvePreset(name,64),frame=MODE_FRAMES[p.mode](64,.6*p.speed,p.opts);assert.ok(frame.dots.length>0);for(const dot of frame.dots)for(const v of Object.values(dot))if(typeof v==='number')assert.ok(Number.isFinite(v));return frame;});
 assert.notDeepEqual(frames[1],frames[2]);
});

test('voice indicator follows listening, response and completion events and announces distinct states',()=>{
 const previous=globalThis.MutationObserver;let changed;
 globalThis.MutationObserver=class{constructor(fn){changed=fn;}observe(){}};
 try{
  const classes=new Set(),label={textContent:''},root={dataset:{},classList:{contains:c=>classes.has(c)},querySelector:()=>label};
  mountVoiceActivity(root);assert.equal(root.dataset.voiceState,'idle');
  classes.add('active');changed();assert.equal(label.textContent,'Listening to you');
  classes.delete('active');classes.add('speaking');changed();assert.equal(label.textContent,'ARES speaking');
  classes.delete('speaking');changed();assert.equal(root.dataset.voiceState,'idle');assert.equal(label.textContent,'Voice idle');
  classes.add('active');classes.add('speaking');changed();assert.equal(root.dataset.voiceState,'speaking');
 }finally{if(previous===undefined)delete globalThis.MutationObserver;else globalThis.MutationObserver=previous;}
});

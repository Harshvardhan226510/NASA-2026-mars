import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('interface sources contain valid UTF-8 without garbled display symbols',()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 function files(directory){return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(directory,entry.name);
  return entry.isDirectory()?files(file):/\.(js|css|html)$/.test(entry.name)?[file]:[];
 });}
 const decoder=new TextDecoder('utf-8',{fatal:true});
 // UTF-8 punctuation decoded as Windows-1252 leaves these characteristic pairs.
 const garbled=/\u00c2[\u00a0-\u00bf]|\u00e2[\u0080-\u00bf\u2000-\u21ff]|\ufffd/u;
 for(const file of [path.join(root,'index.html'),...files(path.join(root,'src'))]){
  const text=decoder.decode(readFileSync(file));
  assert.doesNotMatch(text,garbled,path.relative(root,file)+' contains corrupted display text');
 }
});

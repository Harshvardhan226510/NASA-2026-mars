import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile,unlink,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {SiteAttachmentStore,safeAttachmentName} from '../services/site-attachments.mjs';
import {startServer} from '../services/server.mjs';
import {NetworkPolicy} from '../services/network-policy.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
async function temporary(t){const directory=await mkdtemp(path.join(os.tmpdir(),'atlas-attachments-'));t.after(()=>rm(directory,{recursive:true,force:true}));return directory;}

test('attachments are copied independently of original files and survive a fresh library instance',async t=>{
 const directory=await temporary(t),source=path.join(directory,'surface photo.png');await writeFile(source,png);
 const store=await new SiteAttachmentStore(path.join(directory,'library')).load(),progress=[];
 const added=await store.importFiles([source],{onProgress:value=>progress.push(value)});assert.deepEqual(added.errors,[]);assert.equal(added.attachments.length,1);
 const attachment=added.attachments[0];assert.equal(attachment.mediaType,'image/png');assert.equal(attachment.bytes,png.length);assert.equal(progress.at(-1).received,png.length);
 await unlink(source);const restored=await new SiteAttachmentStore(store.directory).load();assert.deepEqual(await readFile((await restored.asset(attachment.id)).path),png);
 const destination=path.join(directory,'saved copy.png');await restored.saveCopy(attachment.id,destination);assert.deepEqual(await readFile(destination),png);
 assert.equal((await restored.status([attachment.id]))[0].available,true);
 await assert.rejects(()=>restored.asset('../outside'),/identifier/);
});

test('unknown files are retained as downloads and a failed file does not lose other selected attachments',async t=>{
 const directory=await temporary(t),fake=path.join(directory,'not-an-image.png');await writeFile(fake,'<html><script>not an image</script></html>');
 const store=await new SiteAttachmentStore(path.join(directory,'library')).load();const result=await store.importFiles([path.join(directory,'missing.txt'),fake]);
 assert.equal(result.errors.length,1);assert.equal(result.attachments.length,1);assert.equal(result.attachments[0].mediaType,'application/octet-stream');
 const asset=await store.asset(result.attachments[0].id);await assert.rejects(()=>store.saveCopy(asset.id,store.file),/library/);
 await writeFile(asset.path,'changed');assert.equal((await store.status([asset.id]))[0].available,false);
 assert.equal(safeAttachmentName('CON.txt'),'_CON.txt');assert.equal(safeAttachmentName('a\u0000b.txt'),'a_b.txt');
});

test('attachment links cannot follow a substituted symlink outside the library',async t=>{
 const directory=await temporary(t),source=path.join(directory,'report.txt');await writeFile(source,'field notes');
 const store=await new SiteAttachmentStore(path.join(directory,'library')).load();const {attachments:[item]}=await store.importFiles([source]);const asset=await store.asset(item.id);await unlink(asset.path);
 try{await symlink(source,asset.path,'file');}catch(error){if(['EPERM','EACCES'].includes(error.code)){t.skip('Host does not permit file symlinks');return;}throw error;}
 await assert.rejects(()=>store.asset(item.id),/missing or changed/);
});

test('the authenticated server serves preview types and video byte ranges without exposing files as scripts',async t=>{
 const directory=await temporary(t),source=path.join(directory,'clip.mp4');const bytes=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(120,17)]);await writeFile(source,bytes);
 const report=path.join(directory,'report.html');await writeFile(report,'<script>example</script>');
 const store=await new SiteAttachmentStore(path.join(directory,'library')).load();const {attachments:[video,file]}=await store.importFiles([source,report]);
 const server=await startServer({webRoot:directory,policy:new NetworkPolicy(),siteAttachments:store});t.after(()=>server.stop());
 const url=server.origin+'/api/desktop/site-attachment?id='+video.id,headers={'x-atlas-token':server.token};
 assert.equal((await fetch(url)).status,403);
 const range=await fetch(url,{headers:{...headers,Range:'bytes=0-65535'}});assert.equal(range.status,206);assert.equal(range.headers.get('content-type'),'video/mp4');assert.deepEqual(Buffer.from(await range.arrayBuffer()),bytes);
 const suffix=await fetch(url,{headers:{...headers,Range:'bytes=-8'}});assert.equal(suffix.status,206);assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),bytes.subarray(-8));
 const head=await fetch(url,{method:'HEAD',headers});assert.equal(head.headers.get('content-length'),String(bytes.length));assert.equal((await head.arrayBuffer()).byteLength,0);
 const generic=await fetch(server.origin+'/api/desktop/site-attachment?id='+file.id,{headers});assert.equal(generic.headers.get('content-type'),'application/octet-stream');assert.equal(generic.headers.get('content-disposition'),'attachment');assert.match(generic.headers.get('content-security-policy'),/sandbox/);
 assert.equal((await fetch(url,{headers:{...headers,Range:'bytes=9999-'}})).status,416);
});

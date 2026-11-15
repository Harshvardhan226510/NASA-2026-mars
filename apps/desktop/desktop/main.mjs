import {SiteAttachmentStore,safeAttachmentName} from '../services/site-attachments.mjs';
import {createPointInspector} from '../services/point-inspector.mjs';
import {FieldInput} from '../services/field-input.mjs';
import {LocationInput} from '../services/location-input.mjs';
import {UIStateStore} from '../services/ui-state.mjs';
import {saveBeforeClose} from './save-on-close.mjs';
import {app,BrowserWindow,ipcMain,Menu,dialog,shell,session,nativeImage} from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {appendFileSync,mkdirSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
import {downloadApprovedModel} from '../services/model-download.mjs';
import {ModelRegistry} from '../services/models.mjs';
import {InferenceService} from '../services/inference.mjs';
import {SpeechService} from '../services/speech.mjs';
import {VoicePackService} from '../services/voice-pack.mjs';
import {DeadReckoningService} from '../services/dead-reckoning.mjs';
import {startDeadReckoningInput} from '../services/dead-reckoning-input.mjs';
import {permitsMicrophone} from '../services/speech-permissions.mjs';
import {randomUUID} from 'node:crypto';
import {Settings} from './settings.mjs';
import {NetworkPolicy} from '../services/network-policy.mjs';
import {PythonService} from '../services/python.mjs';
import {LocalMapProvider,setLocalMapProvider} from '../services/local-maps.mjs';
import {DownloadManager} from '../services/downloads.mjs';
import {MapPlan} from '../services/map-plan.mjs';
import {PackageRegistry} from '../services/packages.mjs';
import {startServer} from '../services/server.mjs';
import {createMissionApi} from '../services/mission-api.mjs';
import {SourceMaps} from '../services/source-maps.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
app.setName('Mars Field Atlas');
if(process.env.MARS_ATLAS_USER_DATA){mkdirSync(process.env.MARS_ATLAS_USER_DATA,{recursive:true});app.setPath('userData',process.env.MARS_ATLAS_USER_DATA);}
app.commandLine.appendSwitch('disable-background-networking');app.commandLine.appendSwitch('disable-component-update');app.commandLine.appendSwitch('disable-domain-reliability');app.commandLine.appendSwitch('no-pings');
if(process.env.MARS_ATLAS_SMOKE&&process.env.MARS_ATLAS_SMOKE_AUDIO){app.commandLine.appendSwitch('use-fake-device-for-media-stream');app.commandLine.appendSwitch('use-file-for-fake-audio-capture',process.env.MARS_ATLAS_SMOKE_AUDIO);}
if(!app.requestSingleInstanceLock())app.exit(0);
let uiState,siteAttachments;
let win,service,settings,policy,inference,speech,voicePacks,deadReckoning,deadReckoningInput,missionApi,sourceMaps,voiceSession,microphoneLease=0,downloads,mapPlan,modelDownload,quitting=false;
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',event=>{if(quitting)return;event.preventDefault();quitting=true;voiceSession?.controller.abort();speech?.stop();voicePacks?.stop();inference?.stop();downloads?.stop();modelDownload?.controller.abort();Promise.allSettled([sourceMaps?.stop(),Promise.resolve(deadReckoningInput?.stop()).finally(()=>Promise.allSettled([deadReckoning?.flush(),missionApi?.flush()])),service?.stop(),settings?.save(),uiState?.pending]).finally(()=>app.quit());});
app.whenReady().then(async()=>{
try{
 const smokeEvents=[];const userData=app.getPath('userData');mkdirSync(path.join(userData,'logs'),{recursive:true});const log=(event,data={})=>{if(process.env.MARS_ATLAS_SMOKE&&smokeEvents.length<1000&&['service-error','request-failed','blocked-renderer-request','blocked-fetch','blocked-native-request'].includes(event))smokeEvents.push({event,...data});try{appendFileSync(path.join(userData,'logs','desktop.log'),JSON.stringify({at:new Date().toISOString(),event,...data})+'\n');}catch{}};
 siteAttachments=await new SiteAttachmentStore(path.join(userData,'site-attachments')).load();
 uiState=await new UIStateStore(userData).load();
 settings=new Settings(userData);await settings.load();policy=new NetworkPolicy(settings.value.mode,log);
 if(settings.value.voiceSetupRequested===undefined){const marker=path.join(process.resourcesPath,'voice-install.ini');const hasChoice=app.isPackaged&&process.platform==='win32'&&existsSync(marker);const raw=hasChoice?readFileSync(marker):null;const text=raw?(raw[0]===255&&raw[1]===254?raw.toString('utf16le'):raw.toString('utf8')):'';settings.value.voiceSetupRequested=!hasChoice||/^requested=1\s*$/m.test(text);}
 policy.installNativeGuards();
 const originalFetch=globalThis.fetch.bind(globalThis);globalThis.fetch=(input,options)=>policy.fetch(originalFetch,input,options);
 const packagedPython=path.join(process.resourcesPath,'runtime','mars-science',process.platform==='win32'?'mars-science.exe':'mars-science');
 const python=new PythonService({executable:app.isPackaged?(existsSync(packagedPython)?packagedPython:undefined):process.env.MARS_PYTHON,cwd:path.join(root,'web'),packaged:app.isPackaged});
 const registry=await new PackageRegistry(userData).load();if(registry.recoveredMessage)log('map-registry-recovered',{message:registry.recoveredMessage});
 if(process.env.MARS_ATLAS_NATIVE_PACKAGE)await registry.import(process.env.MARS_ATLAS_NATIVE_PACKAGE);
 downloads=new DownloadManager({registry,policy,fetcher:globalThis.fetch,directory:()=>settings.value.dataDirectory??path.join(userData,'maps')});
 downloads.on('progress',progress=>{if(win&&!win.webContents.isDestroyed())win.webContents.send('atlas:download-progress',progress);});
 const modelCatalog=JSON.parse(readFileSync(path.join(root,'runtime/model-catalog.json'),'utf8'));
 const downloadCatalog=JSON.parse(readFileSync(path.join(root,'maps/download-catalog.json'),'utf8'));
 mapPlan=new MapPlan({settings,registry,downloads,policy,catalog:downloadCatalog,starter:JSON.parse(readFileSync(path.join(root,'maps/starter-manifest.json'),'utf8')),directory:()=>settings.value.dataDirectory??path.join(userData,'maps'),notify:value=>{if(win&&!win.webContents.isDestroyed())win.webContents.send('atlas:maps-changed',value);}});
 const localMaps=new LocalMapProvider(registry,policy);setLocalMapProvider(localMaps);
 const models=await new ModelRegistry(userData).load();
 if(process.env.MARS_ATLAS_SMOKE_MODEL){const source=modelCatalog.entries.find(entry=>entry.filename===path.basename(process.env.MARS_ATLAS_SMOKE_MODEL));await models.import(process.env.MARS_ATLAS_SMOKE_MODEL,source);}
 const inferenceRoot=app.isPackaged?path.join(process.resourcesPath,'runtime/inference'):path.join(root,'runtime/staging/inference');
 inference=new InferenceService({executable:path.join(inferenceRoot,process.platform==='win32'?'llama-server.exe':'llama-server'),template:app.isPackaged?path.join(process.resourcesPath,'runtime/chatml.jinja'):path.join(root,'runtime/chatml.jinja'),models,fetcher:originalFetch,log});
 const speechRoot=app.isPackaged?path.join(process.resourcesPath,'runtime/speech'):path.join(root,'runtime/staging/speech');
 speech=new SpeechService({directory:speechRoot,temporaryDirectory:path.join(userData,'voice-tmp')});await speech.cleanup();
 voicePacks=new VoicePackService({directory:path.join(userData,'voice-packs'),temporaryDirectory:path.join(userData,'voice-output-tmp'),settings,catalog:JSON.parse(readFileSync(path.join(root,'runtime/voice-pack-catalog.json'),'utf8')),python,fetcher:originalFetch,notify:progress=>{if(win&&!win.webContents.isDestroyed())win.webContents.send('atlas:voice-pack-progress',progress);}});await voicePacks.cleanup();
 if(process.env.MARS_ATLAS_SMOKE&&process.env.MARS_ATLAS_SMOKE_VOICE){await voicePacks.importArchive(process.env.MARS_ATLAS_SMOKE_VOICE);await voicePacks.configure({mode:'pack'});}
 deadReckoning=await new DeadReckoningService(path.join(userData,'dead-reckoning')).load();deadReckoning.on('change',info=>{if(win&&!win.webContents.isDestroyed())win.webContents.send('atlas:dr-changed',info);});
 const webRoot=path.join(root,'web');
 missionApi=createMissionApi({directory:path.join(userData,'mission-data'),webRoot,localMaps,getSourceMaps:()=>sourceMaps,
  notify:()=>{if(win&&!win.webContents.isDestroyed())win.webContents.send('atlas:observations-changed');}});
 sourceMaps=new SourceMaps({registry,policy,directory:()=>settings.value.dataDirectory??path.join(userData,'maps'),
  fetcher:(url,options)=>policy.fetch((address,request)=>originalFetch(address,{...request,redirect:'error'}),url,options),
  prepareTile:({bytes,type},appearance,product,sourceId)=>{
   const image=nativeImage.createFromBuffer(bytes),{width,height}=image.getSize();
   if(width!==product.pixels||height!==product.pixels)throw Error(product.name+' returned an unexpected tile size.');
   const grayscale=appearance==='grayscale'&&sourceId!=='hrsc-relief';
   const bitmap=(grayscale||product.sparse)?image.toBitmap():null;
   if(product.sparse&&type==='image/png'&&!bitmap.some((value,index)=>index%4===3&&value>0))return null;
   if(!grayscale)return (product.extension==='jpg'&&type==='image/jpeg')||(product.extension==='png'&&type==='image/png')
    ?bytes:product.extension==='jpg'?image.toJPEG(92):image.toPNG();
   let changed=false;
   for(let i=0;i<bitmap.length;i+=4){
    if(bitmap[i]===bitmap[i+1]&&bitmap[i+1]===bitmap[i+2])continue;
    const gray=Math.round(.114*bitmap[i]+.587*bitmap[i+1]+.299*bitmap[i+2]);
    bitmap[i]=bitmap[i+1]=bitmap[i+2]=gray;changed=true;
   }
   if(!changed&&((product.extension==='jpg'&&type==='image/jpeg')||(product.extension==='png'&&type==='image/png')))return bytes;
   const converted=nativeImage.createFromBitmap(bitmap,{width,height});
   return product.extension==='jpg'?converted.toJPEG(90):converted.toPNG();
  },notify:value=>mapPlan.notify(value)});
 const locationInput=new LocationInput();
 const fieldInput=new FieldInput();
 const inspectPoint=createPointInspector(missionApi,webRoot);
 const inputPort=process.env.MARS_ATLAS_DR_PORT;
 const inputToken=process.env.MARS_ATLAS_DR_TOKEN;
 if(inputPort!==undefined||inputToken!==undefined){
  try{
   const port=Number(inputPort);
   deadReckoningInput=await startDeadReckoningInput(deadReckoning,{port,token:inputToken,routes:new Map([...missionApi.routes,...locationInput.routes,...fieldInput.routes])});
   deadReckoning.localInput={port};
  }catch(error){
   const message=error.code?'Could not start localhost input. Check the configured port.':error.message;
   deadReckoning.localInput={error:message};
   log('dead-reckoning-input-error',{message});
  }
 }
 service=await startServer({webRoot,policy,python,log,registry,inference,localMaps,mapPlan,missionApi,sourceMaps,siteAttachments});
 const ses=session.fromPartition('persist:mars-field-atlas');await ses.setProxy({mode:'direct'});const microphoneAllowed=(contents,permission,url,details,audioOnly)=>permitsMicrophone({contents,mainContents:win?.webContents,permission,url,origin:service.origin,isMainFrame:details.isMainFrame,audioOnly,leaseUntil:microphoneLease});
 ses.setPermissionRequestHandler((contents,permission,callback,details)=>callback(microphoneAllowed(contents,permission,details.requestingUrl,details,Array.isArray(details.mediaTypes)&&details.mediaTypes.length===1&&details.mediaTypes[0]==='audio')));
 ses.setPermissionCheckHandler((contents,permission,_origin,details)=>microphoneAllowed(contents,permission,details.requestingUrl,details,details.mediaType==='audio'));
 ses.webRequest.onBeforeRequest((details,callback)=>{const allowed=policy.rendererAllowed(details.url,service.origin,details.resourceType);if(!allowed)log('blocked-renderer-request',{url:new URL(details.url).origin,type:details.resourceType});callback({cancel:!allowed});});
 ses.webRequest.onBeforeSendHeaders((details,callback)=>{if(new URL(details.url).origin===service.origin)details.requestHeaders['x-atlas-token']=service.token;callback({requestHeaders:details.requestHeaders});});
 ses.webRequest.onCompleted(details=>{if(details.statusCode>=400)log('request-failed',{path:new URL(details.url).pathname,status:details.statusCode});});
 const windowOptions=settings.value.window;win=new BrowserWindow({width:windowOptions.width,height:windowOptions.height,minWidth:900,minHeight:640,show:false,backgroundColor:'#090d12',title:'Mars Field Atlas',webPreferences:{preload:path.join(root,'desktop','preload.cjs'),session:ses,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,webviewTag:false,spellcheck:false,backgroundThrottling:false,additionalArguments:process.env.MARS_ATLAS_SMOKE?['--atlas-smoke']:[]}});
 win.webContents.on('console-message',details=>{if(['warning','error'].includes(details.level))log('renderer-console',{level:details.level,message:details.message});});
 const assertSender=event=>{if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||new URL(event.senderFrame.url).origin!==service.origin)throw Error('Untrusted application request');};
 const flushRendererState=async()=>{if(win&&!win.webContents.isDestroyed())await win.webContents.executeJavaScript('window.__atlasSaveState?.()');await uiState.pending;};
 ipcMain.handle('atlas:add-site-attachments',async(event,limit)=>{assertSender(event);if(!Number.isInteger(limit)||limit<1||limit>32)throw Error('A site supports up to 32 attachments.');const selected=await dialog.showOpenDialog(win,{title:'Attach files to this marked site',properties:['openFile','multiSelections']});if(selected.canceled)return {cancelled:true};if(selected.filePaths.length>limit)throw Error('Choose at most '+limit+' more files for this site.');return siteAttachments.importFiles(selected.filePaths,{onProgress:progress=>{if(win&&!win.webContents.isDestroyed())win.webContents.send('atlas:site-attachment-progress',progress);}});});
 ipcMain.handle('atlas:site-attachment-status',(event,ids)=>{assertSender(event);return siteAttachments.status(ids);});
 ipcMain.handle('atlas:export-site-attachment',async(event,id)=>{assertSender(event);const asset=await siteAttachments.asset(id);const selected=await dialog.showSaveDialog(win,{title:'Save a copy of this attachment',defaultPath:safeAttachmentName(asset.name)});if(selected.canceled)return {cancelled:true};await siteAttachments.saveCopy(id,selected.filePath);return {saved:true};});
 ipcMain.handle('atlas:crew-locations',event=>{assertSender(event);return {...fieldInput.crewLocations(),enabled:Boolean(deadReckoning.localInput?.port)};});
 ipcMain.handle('atlas:inspect-point',(event,section,point,at)=>{assertSender(event);return inspectPoint(section,point,at);});
 ipcMain.handle('atlas:inspector-observations',(event,point)=>{assertSender(event);return missionApi.nearbyObservations(point);});
 ipcMain.handle('atlas:inspector-save',(event,point,label)=>{
  assertSender(event);
  return missionApi.saveObservation({id:'inspect-'+randomUUID(),kind:'waypoint',frame:'mars-east-planetocentric',
   point,label,at:new Date().toISOString(),source:'Atlas Point Inspector'});
 });
 ipcMain.handle('atlas:field-status',event=>{
  assertSender(event);
  return {...fieldInput.status(),api:{port:deadReckoning.localInput?.port??null,error:deadReckoning.localInput?.error??null}};
 });
 ipcMain.handle('atlas:location-status',event=>{assertSender(event);return {...locationInput.status(),api:{enabled:Boolean(deadReckoning.localInput?.port),port:deadReckoning.localInput?.port??null,error:deadReckoning.localInput?.error??null}};});
 ipcMain.handle('atlas:read-ui-state',event=>{assertSender(event);return uiState.snapshot();});
 ipcMain.handle('atlas:save-ui-state',(event,value)=>{assertSender(event);return uiState.save(value);});
 const selectMode=async mode=>{if(!['offline','online'].includes(mode))throw Error('Invalid network mode');await flushRendererState();policy.setMode(mode);if(mode==='offline'){downloads?.stop();await sourceMaps?.stop();modelDownload?.controller.abort(Error('Offline Mode selected'));service.server.closeAllConnections();await ses.closeAllConnections();}await settings.setMode(mode);win.webContents.reload();buildMenu();};
 const cancelVoice=()=>{voicePacks.cancelSpeech();microphoneLease=0;voiceSession?.controller.abort();voiceSession=null;speech.stop();};
 win.webContents.on('did-start-navigation',(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame)cancelVoice();});win.webContents.on('render-process-gone',cancelVoice);
 ipcMain.handle('atlas:dr-status',event=>{assertSender(event);return deadReckoning.snapshot();});
 ipcMain.handle('atlas:dr-start',(event,value)=>{assertSender(event);return deadReckoning.setStart(value);});
 ipcMain.handle('atlas:dr-engage',event=>{assertSender(event);return deadReckoning.engage();});
 ipcMain.handle('atlas:dr-pause',event=>{assertSender(event);return deadReckoning.pause();});
 ipcMain.handle('atlas:dr-input',(event,samples)=>{assertSender(event);return deadReckoning.ingest(samples);});
 ipcMain.handle('atlas:voice-pack-status',event=>{assertSender(event);return voicePacks.status();});
 ipcMain.handle('atlas:voice-pack-configure',async(event,value)=>{assertSender(event);voicePacks.cancelSpeech();return voicePacks.configure(value);});
 ipcMain.handle('atlas:voice-pack-install',(event,id,consent)=>{assertSender(event);return voicePacks.start(id,consent);});
 ipcMain.handle('atlas:voice-pack-import',async event=>{assertSender(event);const selected=await dialog.showOpenDialog(win,{title:'Install downloaded optional voice pack',properties:['openFile'],filters:[{name:'Verified voice pack',extensions:['zip']}]});if(selected.canceled)return {cancelled:true};return voicePacks.importArchive(selected.filePaths[0]);});
 ipcMain.handle('atlas:voice-pack-pause',event=>{assertSender(event);voicePacks.pause();return true;});
 ipcMain.handle('atlas:synthesize-voice',(event,id,text)=>{assertSender(event);return voicePacks.synthesize(id,text);});
 ipcMain.handle('atlas:cancel-spoken-reply',(event,id)=>{assertSender(event);if(typeof id!=='string')throw Error('Expected spoken reply identifier');voicePacks.cancelSpeech(id);return true;});
 ipcMain.handle('atlas:voice-status',event=>{assertSender(event);return speech.status();});
 ipcMain.handle('atlas:begin-voice',(event)=>{assertSender(event);if(voiceSession&&Date.now()>voiceSession.expires&&!speech.active)cancelVoice();if(voiceSession||speech.active)throw Error('Finish or cancel the current voice recording first');const status=speech.status();if(!status.available)throw Error(status.message);const id=randomUUID();voiceSession={id,controller:new AbortController(),expires:Date.now()+60000};microphoneLease=Date.now()+10000;return {id,maxSeconds:status.maxSeconds};});
 ipcMain.handle('atlas:cancel-voice',(event,id)=>{assertSender(event);if(voiceSession?.id===id)cancelVoice();return true;});
 ipcMain.handle('atlas:transcribe-voice',async(event,id,bytes)=>{assertSender(event);const active=voiceSession;if(!active||active.id!==id||Date.now()>active.expires){if(active?.id===id)cancelVoice();throw Error('Voice recording expired. Record again.');}microphoneLease=0;try{return await speech.transcribe(bytes,active.controller.signal);}finally{if(voiceSession===active)voiceSession=null;}});
 ipcMain.handle('atlas:set-mode',async(event,mode)=>{assertSender(event);await selectMode(mode);return mode;});
 ipcMain.handle('atlas:storage',event=>{assertSender(event);return {userData,mode:policy.mode};});
 ipcMain.handle('atlas:source-map-download',(event,input)=>{assertSender(event);return sourceMaps.start(input);});
 ipcMain.handle('atlas:source-map-status',event=>{assertSender(event);return sourceMaps.status();});
 ipcMain.handle('atlas:source-map-cancel',event=>{assertSender(event);return sourceMaps.stop();});
 ipcMain.handle('atlas:map-manager-state',(event,choices)=>{assertSender(event);return mapPlan.snapshot(choices);});
 ipcMain.handle('atlas:apply-map-choices',(event,choices,download)=>{assertSender(event);if(typeof download!=='boolean')throw Error('Invalid download choice');return mapPlan.apply(choices,download);});
 ipcMain.handle('atlas:visit-map',(event,value)=>{assertSender(event);return mapPlan.visit(value);});
 ipcMain.handle('atlas:download-catalog',event=>{assertSender(event);return downloadCatalog.entries.filter(entry=>entry.approved);});
 ipcMain.handle('atlas:download-status',event=>{assertSender(event);return downloads.snapshot();});
 ipcMain.handle('atlas:start-download',(event,id)=>{assertSender(event);const entry=downloadCatalog.entries.find(e=>e.manifest.id===id&&e.approved);if(!entry)throw Error('Package is not in the approved catalogue');return mapPlan.retry(entry.manifest.id);});
 ipcMain.handle('atlas:pause-download',async(event,id)=>{assertSender(event);await mapPlan.pause(id);return true;});
 ipcMain.handle('atlas:data-directory',async event=>{assertSender(event);if(downloads.snapshot().some(job=>['downloading','verifying'].includes(job.state))||mapPlan.queue.length)throw Error('Pause downloads before changing storage.');const selected=await dialog.showOpenDialog(win,{title:'Choose map data storage',properties:['openDirectory','createDirectory']});if(selected.canceled)return {cancelled:true};settings.value.dataDirectory=selected.filePaths[0];await settings.save();return {path:settings.value.dataDirectory};});
 ipcMain.handle('atlas:models',async event=>{assertSender(event);return {models:await models.list(),runtime:await inference.status(),options:models.options,download:modelDownload?.progress};});
 ipcMain.handle('atlas:model-catalog',event=>{assertSender(event);return modelCatalog.entries.filter(entry=>entry.approved);});
 ipcMain.handle('atlas:model-options',async(event,options)=>{assertSender(event);inference.stop();return models.setOptions(options);});
 ipcMain.handle('atlas:model-directory',async event=>{assertSender(event);const selected=await dialog.showOpenDialog(win,{title:'Choose model storage',properties:['openDirectory','createDirectory']});if(selected.canceled)return {cancelled:true};settings.value.modelDirectory=selected.filePaths[0];await settings.save();return {path:settings.value.modelDirectory};});
 ipcMain.handle('atlas:download-model',(event,id)=>{assertSender(event);if(modelDownload&&['downloading','verifying'].includes(modelDownload.progress?.state))throw Error('A model download is already active');const entry=modelCatalog.entries.find(entry=>entry.id===id&&entry.approved);if(!entry)throw Error('Model is not in the approved catalogue');if(policy.mode!=='online')throw Error('Select Online Mode to download weights');const job={controller:new AbortController(),progress:{state:'downloading',received:0,total:entry.bytes}};modelDownload=job;const update=progress=>{job.progress=progress;if(!win.webContents.isDestroyed())win.webContents.send('atlas:model-progress',progress);};job.promise=downloadApprovedModel(entry,{directory:settings.value.modelDirectory??path.join(userData,'models'),policy,fetcher:globalThis.fetch,models,signal:job.controller.signal,onProgress:update}).catch(error=>update({state:job.controller.signal.aborted?'paused':'failed',error:error.message}));return true;});
 ipcMain.handle('atlas:pause-model',event=>{assertSender(event);modelDownload?.controller.abort(Error('Model download paused'));return true;});
 ipcMain.handle('atlas:import-model',async event=>{assertSender(event);const picked=await dialog.showOpenDialog(win,{title:'Import authorized GGUF weights',properties:['openFile'],filters:[{name:'GGUF weights',extensions:['gguf']}]});if(picked.canceled)return {cancelled:true};try{inference.stop();return {name:await models.import(picked.filePaths[0])};}catch(error){return {error:error.message};}});
 ipcMain.handle('atlas:select-model',async(event,id)=>{assertSender(event);inference.stop();await models.select(id);return true;});
 ipcMain.handle('atlas:remove-model',async(event,id)=>{assertSender(event);inference.stop();await models.remove(id);return true;});
 ipcMain.handle('atlas:packages',async event=>{assertSender(event);return registry.list();});
 ipcMain.handle('atlas:activate-map',async(event,id,active)=>{assertSender(event);await flushRendererState();await registry.setActive(id,active);win.webContents.reload();return true;});
 ipcMain.handle('atlas:remove-map',async(event,id)=>{assertSender(event);await registry.remove(id);mapPlan.notify({id,state:'unregistered'});return true;});
 ipcMain.handle('atlas:import-map',async event=>{assertSender(event);const picked=await dialog.showOpenDialog(win,{title:'Import Mars map package folder',properties:['openDirectory']});if(picked.canceled)return {cancelled:true};try{const imported=await registry.import(picked.filePaths[0]);mapPlan.notify({id:imported.id,state:'imported'});return imported;}catch(error){return {error:error.message};}});
 function buildMenu(){Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'File',submenu:[{label:'Open data folder',click:()=>shell.openPath(userData)},{type:'separator'},{role:'quit'}]},{label:'Network',submenu:['offline','online'].map(mode=>({label:mode==='offline'?'Offline Mode':'Online Mode',type:'radio',checked:policy.mode===mode,click:()=>selectMode(mode).catch(error=>dialog.showErrorBox('Network mode',error.message))}))},{label:'View',submenu:[{label:'Reload',accelerator:'CmdOrCtrl+R',click:()=>flushRendererState().then(()=>win.webContents.reload()).catch(error=>dialog.showErrorBox('Save application state',error.message))},{role:'togglefullscreen'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},...(!app.isPackaged?[{role:'toggleDevTools'}]:[])]},{label:'Help',submenu:[{label:'Coverage and build status',click:()=>dialog.showMessageBox(win,{type:'info',message:'Mars Field Atlas — desktop foundation',detail:'Bundled coarse CTX/Viking overview and measured MOLA terrain. Fine imagery requires a compatible installed package or Online Mode. Private scientific and inference runtimes are included. Model weights are optional and separate; user model weights are imported separately; training provenance and Mars-domain validation remain incomplete. Engineering build: rights review, clean-install and Pi hardware testing remain pending.'})}]}]));}buildMenu();
 win.webContents.setWindowOpenHandler(({url})=>{try{if(policy.mode==='online'&&new URL(url).protocol==='https:')shell.openExternal(url).catch(error=>log('external-link-failed',{message:error.message}));}catch{}return {action:'deny'};});
 win.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==service.origin||new URL(url).pathname!=='/')event.preventDefault();});win.webContents.on('will-attach-webview',event=>event.preventDefault());
 win.on('close',()=>{if(!win.isMaximized())settings.value.window={...win.getNormalBounds(),maximized:false};else settings.value.window.maximized=true;});
 saveBeforeClose(win,{save:flushRendererState,onFailure:async error=>{log('state-save-failed',{message:error.message});const choice=await dialog.showMessageBox(win,{type:'warning',message:'The latest application state could not be saved.',detail:error.message,buttons:['Retry saving','Close without latest changes'],defaultId:0,cancelId:0});return choice.response===1;}});
 win.once('ready-to-show',()=>{if(windowOptions.maximized)win.maximize();win.show();});
 win.webContents.on('render-process-gone',(_event,details)=>log('renderer-exited',details));
 await win.loadURL(service.origin+'/?ui=pyxis');win.show();log('started',{mode:policy.mode,packaged:app.isPackaged});

 if(process.env.MARS_ATLAS_SMOKE){
  const out=process.env.MARS_ATLAS_SMOKE;mkdirSync(out,{recursive:true});const report={mode:policy.mode,packaged:app.isPackaged};
  try{
   for(let i=0;i<90;i++){const ready=await win.webContents.executeJavaScript("document.documentElement.dataset.atlasReady === 'true'");if(ready)break;await new Promise(resolve=>setTimeout(resolve,500));}
   report.ready=await win.webContents.executeJavaScript("document.documentElement.dataset.atlasReady === 'true'");
   await new Promise(resolve=>setTimeout(resolve,10000));report.diagnostics=await win.webContents.executeJavaScript('window.__atlasDiagnostics?.()');
   report.page=await win.webContents.executeJavaScript("({title:document.title,body:document.body.innerText.slice(-8000),canvases:document.querySelectorAll('canvas').length,bridge:typeof window.marsDesktop,node:typeof window.require})");
   writeFileSync(path.join(out,'globe.png'),(await win.webContents.capturePage()).toPNG());
   report.views={};for(const view of ['2d','split','3d']){await win.webContents.executeJavaScript(`document.querySelector('[data-view="${view}"]').click()`);await new Promise(resolve=>setTimeout(resolve,1800));report.views[view]=await win.webContents.executeJavaScript(`document.querySelector('[data-view="${view}"]').getAttribute('aria-pressed')`);writeFileSync(path.join(out,view+'.png'),(await win.webContents.capturePage()).toPNG());}
   if(process.env.MARS_ATLAS_NATIVE_PACKAGE){await win.webContents.executeJavaScript('window.__atlasSmokeRegion?.()');await new Promise(resolve=>setTimeout(resolve,2500));if(process.env.MARS_ATLAS_NATIVE_FOCUS){const point=JSON.parse(process.env.MARS_ATLAS_NATIVE_FOCUS);if(Array.isArray(point)&&point.length===2&&point.every(Number.isFinite))await win.webContents.executeJavaScript('window.__atlasSmokeFocus?.('+JSON.stringify(point)+')');}await new Promise(resolve=>setTimeout(resolve,15000));report.nativeSelection=await win.webContents.executeJavaScript('window.__atlasDiagnostics?.()');writeFileSync(path.join(out,'native-package.png'),(await win.webContents.capturePage()).toPNG());}
   await win.webContents.executeJavaScript("document.dispatchEvent(new Event('atlas-map-manager'))");await new Promise(resolve=>setTimeout(resolve,500));report.science=await originalFetch(service.origin+'/api/moons?at=2026-10-19T12%3A00%3A00Z',{headers:{'x-atlas-token':service.token}}).then(async response=>({status:response.status,schema:(await response.json()).schema}));
   report.manager=await win.webContents.executeJavaScript("Boolean(document.querySelector('dialog[data-desktop-maps][open]'))");writeFileSync(path.join(out,'map-manager.png'),(await win.webContents.capturePage()).toPNG());
   await win.webContents.executeJavaScript("document.querySelector('dialog[data-desktop-maps]')?.close();document.dispatchEvent(new Event('atlas-model-manager'))");await new Promise(resolve=>setTimeout(resolve,800));report.models=await models.list();writeFileSync(path.join(out,'model-manager.png'),(await win.webContents.capturePage()).toPNG());
   await win.webContents.executeJavaScript("document.querySelector('dialog[open]')?.close()");
   await win.webContents.executeJavaScript("document.dispatchEvent(new Event('atlas-dead-reckoning'))");await new Promise(resolve=>setTimeout(resolve,300));
   const drStart=await deadReckoning.setStart({point:[77.43,18.44],options:{mode:'manual'}});const drEngaged=await deadReckoning.engage();const dr=drEngaged.state;
   report.deadReckoning=await deadReckoning.ingest([{sessionId:dr.id,runId:dr.runId,sourceId:'manual',sequence:1,timestampMs:Date.now()+1,kind:'motion',distanceMeters:10,headingDegrees:90,headingReference:'map-north'}]);await deadReckoning.pause();await new Promise(resolve=>setTimeout(resolve,400));
   report.deadReckoningUI=await win.webContents.executeJavaScript("({panel:!document.querySelector('.dr-panel').hidden,text:document.querySelector('.dr-panel output').textContent,badge:document.querySelector('.dr-badge').textContent})");writeFileSync(path.join(out,'dead-reckoning.png'),(await win.webContents.capturePage()).toPNG());
   await win.webContents.executeJavaScript("document.querySelector('.dr-close').click();document.querySelector('[data-action=sites]').click()");await new Promise(resolve=>setTimeout(resolve,300));report.sitePanel=await win.webContents.executeJavaScript("({open:!document.getElementById('site-evaluation-panel').hidden,mode:document.getElementById('site-evaluation-mode').value})");writeFileSync(path.join(out,'site-evaluation.png'),(await win.webContents.capturePage()).toPNG());
   await win.webContents.executeJavaScript("document.getElementById('site-evaluation-close').click();document.dispatchEvent(new Event('atlas-voice-settings'))");await new Promise(resolve=>setTimeout(resolve,300));report.voiceSetup=await voicePacks.status();writeFileSync(path.join(out,'voice-setup.png'),(await win.webContents.capturePage()).toPNG());await win.webContents.executeJavaScript("document.querySelector('dialog[open]')?.close()");
   if(process.env.MARS_ATLAS_SMOKE_AUDIO){
    await win.webContents.executeJavaScript("document.getElementById('assistant-toggle').click();document.getElementById('assistant-mic').click()",true);
    for(let i=0;i<40;i++){const active=await win.webContents.executeJavaScript("document.getElementById('assistant-mic').getAttribute('aria-pressed')==='true'");if(active)break;await new Promise(resolve=>setTimeout(resolve,250));}
    await new Promise(resolve=>setTimeout(resolve,4500));await win.webContents.executeJavaScript("document.getElementById('assistant-mic').click()",true);
    for(let i=0;i<240;i++){const text=await win.webContents.executeJavaScript("document.getElementById('assistant-input').value");if(text)break;await new Promise(resolve=>setTimeout(resolve,500));}
    report.microphone=await win.webContents.executeJavaScript("({status:document.getElementById('assistant-status').textContent,transcript:document.getElementById('assistant-input').value,listening:document.getElementById('assistant-mic').getAttribute('aria-pressed'),history:document.getElementById('assistant-history').innerText})");report.microphoneInput='Controlled synthetic WAV, not a human microphone';writeFileSync(path.join(out,'microphone.png'),(await win.webContents.capturePage()).toPNG());
    if(!report.microphone.transcript||report.microphone.listening==='true')throw Error('Microphone capture/transcription did not complete');
   }
   if(process.env.MARS_ATLAS_SMOKE_MODEL){
    await win.webContents.executeJavaScript("if(document.getElementById('assistant-panel').hidden)document.getElementById('assistant-toggle').click();document.getElementById('assistant-local-model').checked=true;document.getElementById('assistant-input').value='Write two sentences explaining why a coarse terrain grid cannot resolve small boulders.';document.getElementById('assistant-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");
    for(let i=0;i<360;i++){const complete=await win.webContents.executeJavaScript("!document.getElementById('assistant-status').textContent.includes('thinking')");if(complete)break;await new Promise(resolve=>setTimeout(resolve,500));}
    report.assistant=await win.webContents.executeJavaScript("({status:document.getElementById('assistant-status').textContent,history:document.getElementById('assistant-history').innerText,voiceDisabled:document.getElementById('assistant-mic').disabled})");report.inference=await inference.status();report.concurrentMetrics=app.getAppMetrics().map(({type,memory,cpu})=>({type,memory,cpu}));writeFileSync(path.join(out,'assistant.png'),(await win.webContents.capturePage()).toPNG());
   }

  }catch(error){report.error=error.stack;}
  report.events=smokeEvents;writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));app.quit();
 }
}catch(error){dialog.showErrorBox('Mars Field Atlas could not start',error.message);app.quit();}
}).catch(error=>{dialog.showErrorBox('Mars Field Atlas startup',error.message);app.quit();});

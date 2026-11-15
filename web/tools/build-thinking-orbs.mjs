import {build} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const source=path.resolve(process.argv[2]??'');
if(!process.argv[2])throw Error('Pass a checkout of Jakubantalik/thinking-orbs.');
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
const pinned='de85557ca220332586d070d8788c0e1d6e877a0d';
if(revision!==pinned)throw Error('Use upstream revision '+pinned+' for this audited build.');
const out=fileURLToPath(new URL('../src/vendor/thinking-orbs/',import.meta.url));
await build({configFile:false,publicDir:false,build:{lib:{entry:path.join(source,'src/engine/index.ts'),formats:['es'],fileName:()=> 'engine.js'},outDir:out,emptyOutDir:false,minify:false,target:'es2022',rolldownOptions:{output:{banner:'/*! thinking-orbs 0.3.1 | Copyright (c) 2026 Jakub Antalik | MIT license: /licenses/thinking-orbs.txt */'}}}});
await fs.copyFile(path.join(source,'LICENSE'),path.join(out,'LICENSE'));
const hash=createHash('sha256').update(await fs.readFile(path.join(out,'engine.js'))).digest('hex');
await fs.writeFile(path.join(out,'provenance.json'),JSON.stringify({repository:'https://github.com/Jakubantalik/thinking-orbs',version:'0.3.1',revision,entry:'src/engine/index.ts',license:'MIT',engine_sha256:hash,build:'node tools/build-thinking-orbs.mjs <upstream-checkout>'},null,2)+'\n');

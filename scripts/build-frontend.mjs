import {mkdir,rm,copyFile,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const dist=path.join(root,'dist');
if(path.dirname(dist)!==root)throw new Error('Unsafe output path');
const repo=(process.env.GITHUB_REPOSITORY||'').split('/')[1]||'';
const base=process.env.BASE_PATH||(repo&&repo.toLowerCase()!==`${(process.env.GITHUB_REPOSITORY||'').split('/')[0].toLowerCase()}.github.io`?`/${repo}/`:'/');
if(!/^\/(?:[A-Za-z0-9._-]+\/)?$/.test(base))throw new Error(`Invalid base path: ${base}`);
await rm(dist,{recursive:true,force:true});
await mkdir(path.join(dist,'src'),{recursive:true});
for(const file of ['main.js','engine.js','fit-board.js','scenario-file.js','style.css'])await copyFile(path.join(root,'src',file),path.join(dist,'src',file));
const html=await readFile(path.join(root,'index.html'),'utf8');
await writeFile(path.join(dist,'index.html'),html.replace('<head>','<head><base href="'+base+'">'),'utf8');
await writeFile(path.join(dist,'404.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><script>location.replace(${JSON.stringify(base)})</script><a href="${base}">시뮬레이터로 이동</a></html>`,'utf8');
await writeFile(path.join(dist,'.nojekyll'),'','utf8');
console.log(`Frontend built for ${base}`);

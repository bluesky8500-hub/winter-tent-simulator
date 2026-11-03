import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';

const dist=path.resolve(import.meta.dirname,'../dist');
async function walk(dir){const out=[];for(const item of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,item.name);if(item.isDirectory())out.push(...await walk(full));else out.push(path.relative(dist,full).replaceAll('\\','/'))}return out}
const files=(await walk(dist)).sort();
const allowed=['.nojekyll','404.html','catalog.json','index.html','src/engine.js','src/main.js','src/scenario-file.js','src/style.css'].sort();
if(JSON.stringify(files)!==JSON.stringify(allowed))throw new Error(`Unexpected deployment files: ${files.join(', ')}`);
const json=await readFile(path.join(dist,'catalog.json'),'utf8');
if(/(?:\.sqlite|\.pdf|\.xlsx|data\/|legacy\/|C:\\)/i.test(json))throw new Error('Private path found in deployment JSON');
console.log('Deployment allowlist passed:',files.join(', '));

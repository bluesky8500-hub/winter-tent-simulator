import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const data=JSON.parse(await readFile(path.join(root,'deploy-source/catalog.public.json'),'utf8'));
if(data.schemaVersion!==1||!Array.isArray(data.products)||!Array.isArray(data.adoptions)||!Array.isArray(data.claims))throw new Error('Invalid public catalog');
const ids=new Set(data.claims.map(x=>x.id));
if(data.adoptions.some(x=>!ids.has(x.claimId)))throw new Error('Adopted claim missing from public catalog');
if(JSON.stringify(data).match(/(?:\.sqlite|\.pdf|\.xlsx|data\/|legacy\/|C:\\)/i))throw new Error('Private file reference in public data');
await writeFile(path.join(root,'dist/catalog.json'),JSON.stringify(data),'utf8');
console.log(`Browser catalog generated: ${data.claims.length} adopted claims`);

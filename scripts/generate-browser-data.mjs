import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const data=JSON.parse(await readFile(path.resolve(process.argv[2]??path.join(root,'catalog.generated.json')),'utf8'));
if(data.schemaVersion!==1||!Array.isArray(data.products)||!Array.isArray(data.adoptions)||!Array.isArray(data.claims))throw new Error('Invalid public catalog');
const ids=new Set(data.claims.map(x=>x.id));
if(data.adoptions.some(x=>!ids.has(x.claimId)))throw new Error('Adopted claim missing from public catalog');
const moduleIds=new Set(data.modules.map(x=>x.id)),connectorIds=new Set([...data.options,...data.modules].map(x=>x.id));
const directions=new Set(['front','rear','side']),requirements=new Set(['required','optional','included','unknown']);
if(data.dockingRules.some(rule=>rule.modules.length!==2||rule.modules.some(id=>!moduleIds.has(id))||!Array.isArray(rule.directions)||rule.directions.some(value=>!directions.has(value))||!requirements.has(rule.connectorRequirement)||(rule.connector&&!connectorIds.has(rule.connector))))throw new Error('Invalid docking rule');
if(JSON.stringify(data).match(/(?:\.sqlite|\.pdf|\.xlsx|data\/|legacy\/|C:\\)/i))throw new Error('Private file reference in public data');
await writeFile(path.join(root,'dist/catalog.json'),JSON.stringify(data),'utf8');
console.log(`Browser catalog generated: ${data.claims.length} adopted claims`);

import {readFileSync} from 'node:fs';
import {evaluate} from '../src/engine.js';

const actual=JSON.parse(readFileSync(process.argv[2]??'catalog.generated.json','utf8'));
const baseline=JSON.parse(readFileSync(process.argv[3]??'deploy-source/catalog.public.json','utf8'));
const keys={products:x=>x.id,specs:x=>x.product,modules:x=>x.id,packages:x=>x.id,options:x=>x.id,claims:x=>x.id,adoptions:x=>`${x.subject}/${x.field}`,dockingRules:x=>x.id,footprints:x=>x.key,verification:x=>x.id};
function normalize(value,section){
  if(Array.isArray(value))return value.map(x=>normalize(x)).sort((a,b)=>section&&keys[section]&&typeof a==='object'&&typeof b==='object'&&keys[section](a)!=null&&keys[section](b)!=null?keys[section](a).localeCompare(keys[section](b)):JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normalize(v,k)]));
  return value;
}
if(JSON.stringify(normalize(actual))!==JSON.stringify(normalize(baseline)))throw new Error('SQLite export differs from preserved GitHub JSON');
const scenarios=[...baseline.packages.map(p=>({packages:[p.id],options:{}})),
  {packages:['hubBase','coody10Base'],options:{proConnector:1}},
  {packages:['happyBase','airnok8Base'],options:{airnok8Connector:1}},
  {packages:['happyBase','airnok7Base'],options:{airnok7Connector:1}},
  {packages:['airnok7Base'],options:{airnok7Ground:1,airnok7FullFly:1}}];
for(const scenario of scenarios){
  const left=evaluate(scenario,baseline),right=evaluate(scenario,actual);
  for(const key of ['knownSubtotal','total','shipping','lines','docking','layout'])if(JSON.stringify(left[key])!==JSON.stringify(right[key]))throw new Error(`Price or rule drift: ${JSON.stringify(scenario)} / ${key}`);
}
console.log(`Catalog parity passed: ${baseline.products.length} products, ${baseline.claims.length} adopted claims, ${scenarios.length} price/layout scenarios`);

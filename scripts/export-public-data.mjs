import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
import path from 'node:path';

const dbPath=path.resolve(process.argv[2]??'db/catalog.sqlite');
const output=path.resolve(process.argv[3]??'deploy-source/catalog.public.json');
const db=new DatabaseSync(dbPath,{readOnly:true});
const all=sql=>db.prepare(sql).all();
const parse=JSON.parse;
const adoptions=all('SELECT * FROM current_adoption ORDER BY subject,field').map(x=>({subject:x.subject,field:x.field,claimId:x.claim_id,reason:x.reason,condition:x.condition,adoptedAt:x.adopted_at}));
const adoptedIds=new Set(adoptions.map(x=>x.claimId));
const sources=Object.fromEntries(all('SELECT * FROM source ORDER BY rowid').map(x=>[x.id,{label:x.public_label,kind:x.kind}]));
const catalog={
  schemaVersion:1,sources,
  products:all('SELECT * FROM product ORDER BY rowid').map(x=>({id:x.id,brand:x.brand,name:x.name,...(x.english_name?{englishName:x.english_name}:{}),primary:!!x.primary_candidate,type:x.type})),
  specs:all('SELECT * FROM product_spec ORDER BY rowid').map(x=>({product:x.product_id,dimensions:x.dimensions,area:x.area,weight:x.weight,fabric:x.fabric,fly:x.fly,...(x.details?{details:x.details}:{}),status:x.status,source:x.source_id,locator:x.locator})),
  modules:all('SELECT * FROM module ORDER BY rowid').map(x=>({id:x.id,product:x.product_id,name:x.name,width:x.width,length:x.length,height:x.height,footprintStatus:x.footprint_status})),
  packages:all('SELECT * FROM package ORDER BY rowid').map(x=>({id:x.id,name:x.name,modules:parse(x.modules_json),included:parse(x.included_json),gifts:parse(x.gifts_json)})),
  options:all('SELECT * FROM option_item ORDER BY rowid').map(x=>({id:x.id,name:x.name,kind:x.kind,target:x.target,max:x.max_quantity,...(x.quantity!=null?{quantity:x.quantity}:{}),...(x.condition?{condition:x.condition}:{})})),
  claims:all('SELECT * FROM claim ORDER BY rowid').filter(x=>adoptedIds.has(x.id)).map(x=>({id:x.id,subject:x.subject,field:x.field,value:parse(x.value_json),source:x.source_id,locator:x.locator,status:x.status,condition:x.condition})),
  adoptions,
  dockingRules:all('SELECT * FROM docking_rule ORDER BY rowid').map(x=>({id:x.id,modules:parse(x.modules_json),connector:x.connector,...(x.public_extra_json?parse(x.public_extra_json):{}),status:x.status,source:x.source_id,note:x.note})),
  footprints:all('SELECT * FROM footprint ORDER BY rowid').map(x=>({key:x.key,width:x.width,length:x.length,status:x.status,source:x.source_id,note:x.note})),
  verification:all('SELECT * FROM verification ORDER BY rowid').map(x=>({id:x.id,status:x.status,subject:x.subject,issue:x.issue,needed:x.needed}))
};
db.close();
writeFileSync(output,JSON.stringify(catalog,null,2)+'\n');
console.log(`Exported ${catalog.products.length} products, ${catalog.claims.length} adopted claims`);

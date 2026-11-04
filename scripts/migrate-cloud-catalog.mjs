import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const [dbPath='db/catalog.sqlite',jsonPath='deploy-source/catalog.public.json']=process.argv.slice(2);
const input=JSON.parse(readFileSync(jsonPath,'utf8'));
if(input.schemaVersion!==1)throw new Error('Unsupported public catalog schema');
const db=new DatabaseSync(path.resolve(dbPath));
db.exec('PRAGMA foreign_keys=ON');
const get=(sql,...args)=>db.prepare(sql).get(...args);
const run=(sql,...args)=>db.prepare(sql).run(...args);
const all=(sql,...args)=>db.prepare(sql).all(...args);
const hasColumn=(table,column)=>all(`PRAGMA table_info(${table})`).some(x=>x.name===column);
const addColumn=(table,column,type)=>{if(!hasColumn(table,column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)};
const json=x=>JSON.stringify(x);
const date='2026-11-04';
const migration='cloud-json-2f07c2d-2026-11-04';
const changes=[];
function history(table,id,before,after){
  if(json(before)===json(after))return;
  run('INSERT INTO catalog_row_history(table_name,row_id,before_json,after_json,source_ref,changed_at) VALUES (?,?,?,?,?,?)',table,id,json(before),json(after),migration,date);
  changes.push(`${table}:${id}`);
}
function upsert(table,idColumn,id,values){
  const before=get(`SELECT * FROM "${table}" WHERE ${idColumn}=?`,id);
  const after={...before,...values};
  if(!before) {
    const columns=Object.keys(values);
    run(`INSERT INTO "${table}" (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,...Object.values(values));
  } else if(Object.entries(values).some(([k,v])=>before[k]!==v)){
    const columns=Object.keys(values).filter(k=>k!==idColumn);
    run(`UPDATE "${table}" SET ${columns.map(k=>`${k}=?`).join(',')} WHERE ${idColumn}=?`,...columns.map(k=>values[k]),id);
  } else return;
  history(table,id,before??null,after);
}
db.exec('BEGIN');
try{
  addColumn('source','public_label','TEXT');
  addColumn('product','english_name','TEXT');
  addColumn('product_spec','details','TEXT');
  addColumn('docking_rule','public_extra_json','TEXT');
  db.exec(`CREATE TABLE IF NOT EXISTS catalog_migration(id TEXT PRIMARY KEY,source_ref TEXT NOT NULL,applied_at TEXT NOT NULL,note TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS catalog_row_history(id INTEGER PRIMARY KEY,table_name TEXT NOT NULL,row_id TEXT NOT NULL,before_json TEXT,after_json TEXT NOT NULL,source_ref TEXT NOT NULL,changed_at TEXT NOT NULL);`);
  if(get('SELECT id FROM catalog_migration WHERE id=?',migration))throw new Error(`Already applied: ${migration}`);
  for(const [id,x] of Object.entries(input.sources)){
    const old=get('SELECT * FROM source WHERE id=?',id);
    upsert('source','id',id,{id,file:old?.file??(id==='airnok7Pdf'?'판매페이지 원본은 별도 보관; 클라우드 JSON 출처 메타데이터':id==='user20261103Direct'?'사용자 직접 확인 (2026-11-03)':'클라우드 JSON 출처'),date:old?.date??date,kind:x.kind,public_label:x.label});
  }
  for(const x of input.products)upsert('product','id',x.id,{id:x.id,brand:x.brand,name:x.name,primary_candidate:+x.primary,type:x.type,english_name:x.englishName??null});
  for(const x of input.specs)upsert('product_spec','product_id',x.product,{product_id:x.product,dimensions:x.dimensions,area:x.area,weight:x.weight,fabric:x.fabric,fly:x.fly,status:x.status,source_id:x.source,locator:x.locator,details:x.details??null});
  for(const x of input.modules)upsert('module','id',x.id,{id:x.id,product_id:x.product,name:x.name,width:x.width,length:x.length,height:x.height,footprint_status:x.footprintStatus});
  for(const x of input.options){
    const old=get('SELECT * FROM option_item WHERE id=?',x.id);
    upsert('option_item','id',x.id,{id:x.id,name:x.name,kind:x.kind,target:x.target??null,max_quantity:x.max??null,quantity:x.quantity??old?.quantity??null,condition:x.condition??old?.condition??null});
  }
  for(const x of input.packages)upsert('package','id',x.id,{id:x.id,name:x.name,modules_json:json(x.modules),included_json:json(x.included),gifts_json:json(x.gifts)});
  for(const x of input.claims){
    const old=get('SELECT * FROM claim WHERE id=?',x.id);
    const values={id:x.id,subject:x.subject,field:x.field,value_json:json(x.value),source_id:x.source,locator:x.locator,status:x.status,condition:x.condition??null,recorded_at:date};
    if(old){if(old.subject!==x.subject||old.field!==x.field||old.value_json!==values.value_json)throw new Error(`Conflicting claim ID: ${x.id}`)}
    else upsert('claim','id',x.id,values);
  }
  for(const x of input.adoptions){
    const current=get('SELECT * FROM current_adoption WHERE subject=? AND field=?',x.subject,x.field);
    if(current?.claim_id===x.claimId)continue;
    if(current)throw new Error(`Unresolved adoption conflict: ${x.subject}/${x.field}: ${current.claim_id} vs ${x.claimId}`);
    const claim=get('SELECT id FROM claim WHERE id=?',x.claimId);
    if(!claim)throw new Error(`Missing adopted claim ${x.claimId}`);
    const id=`${migration}:${x.subject}:${x.field}`;
    upsert('adoption_history','id',id,{id,subject:x.subject,field:x.field,claim_id:x.claimId,reason:x.reason,condition:x.condition??null,adopted_at:x.adoptedAt});
  }
  for(const x of input.dockingRules){
    const {id,modules,connector,status,source,note,...extra}=x;
    upsert('docking_rule','id',id,{id,modules_json:json(modules),connector:connector??null,status,source_id:source,note,public_extra_json:Object.keys(extra).length?json(extra):null});
  }
  for(const x of input.footprints)upsert('footprint','key',x.key,{key:x.key,width:x.width,length:x.length,status:x.status,source_id:x.source,note:x.note});
  for(const x of input.verification){
    const old=get('SELECT * FROM verification WHERE id=?',x.id);
    upsert('verification','id',x.id,{id:x.id,status:x.status,subject:x.subject,issue:x.issue,claims_json:old?.claims_json??json([]),needed:x.needed});
  }
  run('INSERT INTO catalog_migration VALUES (?,?,?,?)',migration,'GitHub main 2f07c2d public catalog',date,`${changes.length} normalized row changes; original claims and adoption history retained`);
  db.exec('COMMIT');
  console.log(json({migration,changes}));
}catch(error){db.exec('ROLLBACK');throw error}finally{db.close()}

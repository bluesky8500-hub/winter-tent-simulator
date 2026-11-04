import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const dbPath=path.resolve(process.argv[2]??'db/catalog.sqlite');
const db=new DatabaseSync(dbPath,{readOnly:true});
const all=(sql,...args)=>db.prepare(sql).all(...args);
const one=(sql,...args)=>db.prepare(sql).get(...args);
const problems=[];
if(one('PRAGMA integrity_check').integrity_check!=='ok')problems.push('SQLite integrity_check failed');
if(all('PRAGMA foreign_key_check').length)problems.push('SQLite foreign_key_check failed');
for(const [table,min] of [['source',14],['product',9],['product_spec',9],['module',13],['package',9],['option_item',69],['claim',181],['adoption_history',73],['claim_evidence',45],['pdf_review',8],['docking_rule',13]]){
  if(one(`SELECT COUNT(*) n FROM ${table}`).n<min)problems.push(`${table} record loss`);
}
const tables=all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").map(x=>x.name);
const secret=/(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA|OPENSSH|EC|PRIVATE) KEY-----|[A-Z]:[\\/](?:Users|codex)[\\/]|(?:^|[^\w])(?:[\w.+-]+@(?:[\w.-]+\.)+[A-Za-z]{2,})(?:[^\w]|$))/i;
for(const table of tables)for(const row of all(`SELECT * FROM "${table}"`))for(const [column,value] of Object.entries(row))if(typeof value==='string'&&secret.test(value))problems.push(`Possible private value: ${table}.${column}`);
const raw=readFileSync(dbPath).toString('utf8');
if(secret.test(raw)||/(?:이군도|GundoLee|010[- ]?\d{4}[- ]?\d{4})/i.test(raw))problems.push('Possible private value in SQLite binary or free pages');
const latest=JSON.parse(readFileSync(path.resolve('deploy-source/catalog.public.json'),'utf8'));
for(const x of latest.adoptions){
  const row=one('SELECT claim_id FROM current_adoption WHERE subject=? AND field=?',x.subject,x.field);
  if(row?.claim_id!==x.claimId)problems.push(`Adoption drift: ${x.subject}/${x.field}`);
}
if(!one('SELECT id FROM catalog_migration WHERE id=?','cloud-json-2f07c2d-2026-11-04'))problems.push('Cloud migration missing');
db.close();
if(problems.length)throw new Error([...new Set(problems)].join('\n'));
console.log(`Catalog validated: ${tables.length} tables, source history and adoptions retained, no private pattern found`);

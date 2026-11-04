import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {evaluate} from '../src/engine.js';

const db=new DatabaseSync(fileURLToPath(new URL('../db/catalog.sqlite',import.meta.url)),{readOnly:true});
const catalog=JSON.parse(readFileSync(new URL('../deploy-source/catalog.public.json',import.meta.url)));
const one=(sql,...args)=>db.prepare(sql).get(...args);
after(()=>db.close());

test('7.0T 판매페이지와 사용자 직접 확인을 출처별 Claim으로 유지한다',()=>{
  assert.equal(one("SELECT value_json FROM claim WHERE id='pAirnok7'").value_json,'580000');
  assert.equal(one("SELECT value_json FROM claim WHERE id='user20261103_shipping_airnok7Base'").value_json,'15000');
  assert.equal(one("SELECT source_id FROM claim WHERE id='user20261103_price_airnok7Connector'").source_id,'user20261103Direct');
  assert.equal(one("SELECT source_id FROM claim WHERE id='airnok7User20261103:stDirections'").source_id,'user20261103Direct');
  assert.equal(one("SELECT source_id FROM claim WHERE id='airnok7Pdf20261104:dimensions'").source_id,'airnok7Pdf');
  assert.equal(one("SELECT COUNT(*) n FROM claim_evidence WHERE claim_id IN ('pAirnok7','user20261103_shipping_airnok7Base')").n,2);
  assert.equal(one("SELECT pages FROM pdf_review WHERE id='airnok7PdfReview20261104'").pages,43);
});

test('7.0T 본체와 포장 사양, 기본 포함 목록을 PDF 확인 범위로 제한한다',()=>{
  assert.deepEqual(JSON.parse(one("SELECT value_json FROM claim WHERE id='airnok7Pdf20261104:dimensions'").value_json),[300,230,190]);
  assert.deepEqual(JSON.parse(one("SELECT value_json FROM claim WHERE id='airnok7Pdf20261104:packing'").value_json),[70,35,30]);
  assert.deepEqual(JSON.parse(one("SELECT value_json FROM claim WHERE id='airnok7Pdf20261104:fabric'").value_json),{cotton:35,polyester:65});
  assert.equal(JSON.parse(one("SELECT value_json FROM claim WHERE id='airnok7Pdf20261104:floor'").value_json),'410D 립스탑 PU 코팅');
  assert.deepEqual(catalog.packages.find(x=>x.id==='airnok7Base').included,['airnok7Bag','airnok7Pump']);
  assert.equal(one("SELECT kind FROM option_item WHERE id='airnok7Pegs'").kind,'unverified');
  assert.equal(one("SELECT status FROM verification WHERE id='PDF-AIRNOK7-COMPONENTS'").status,'부분 해결');
});

test('7.0T 두 중량과 M블랙 버전 차이를 별도 Claim으로 보존한다',()=>{
  const weights=db.prepare("SELECT value_json FROM claim WHERE subject='airnok7' AND field='weightKg' ORDER BY id").all().map(x=>JSON.parse(x.value_json)).sort();
  assert.deepEqual(weights,[16.5,16.8]);
  assert.equal(one("SELECT status FROM verification WHERE id='PDF-AIRNOK7-WEIGHT'").status,'충돌');
  assert.equal(JSON.parse(one("SELECT value_json FROM claim WHERE id='airnok7Pdf20261104:mblackOld'").value_json),false);
  assert.equal(JSON.parse(one("SELECT value_json FROM claim WHERE id='airnok7Pdf20261104:mblackNew'").value_json),true);
});

test('7.0T 선택 가격과 도킹 규칙, 다른 대표 제품 가격을 유지한다',()=>{
  assert.equal(evaluate({packages:['airnok7Base'],options:{}},catalog).total,595000);
  assert.equal(evaluate({packages:['airnok7Base'],options:{airnok7Connector:1,airnok7Ground:1,airnok7FullFly:1}},catalog).total,882000);
  assert.deepEqual(catalog.dockingRules.find(x=>x.id==='airnok7St').directions,['front']);
  assert.deepEqual(catalog.dockingRules.find(x=>x.id==='airnok7Tarp').directions,['front','rear']);
  assert.equal(evaluate({packages:['campBase'],options:{}},catalog).total,2420000);
  assert.equal(evaluate({packages:['hubBase','coody10Base'],options:{proConnector:1}},catalog).knownSubtotal,3370000);
});


import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {configureCatalog,evaluate} from '../src/engine.js';
import {encodeScenarioFile,decodeScenarioFile} from '../src/scenario-file.js';
import {boxesOverlap,edgeClearance,getPlacedBox} from '../src/fit-board.js';

const catalog=JSON.parse(readFileSync(new URL('../deploy-source/catalog.public.json',import.meta.url)));
configureCatalog(catalog);

test('공개 스냅샷에는 채택 가격만 있고 원본 경로가 없다',()=>{
  assert.equal(catalog.products.length,8);
  assert.ok(catalog.claims.every(x=>catalog.adoptions.some(a=>a.claimId===x.id)));
  assert.ok(!/(?:\.sqlite|\.pdf|\.xlsx|data\/|legacy\/|C:\\)/i.test(JSON.stringify(catalog)));
});
test('정적 JSON에서 신규 배송비와 도킹 치수를 적용한다',()=>{
  const camp=evaluate({packages:['campBase'],options:{campFront:1,campSide:2,campFrontCarpet:1}});
  assert.equal(camp.knownSubtotal,2890000);assert.equal(camp.total,2890000);
  const coody=evaluate({packages:['hubBase','coody10Base'],options:{proConnector:1}});
  assert.equal(coody.knownSubtotal,3370000);assert.equal(coody.docking.status,'확정');assert.equal(coody.layout.footprint.length,6.7);
  assert.equal(evaluate({packages:['happyBase'],options:{skySwap:1}}).lines.find(x=>x.subject==='skySwap').amount,280000);
});
test('조합 파일은 공유되고 미등록 제품·옵션은 거부한다',()=>{
  const current={name:'공유 조합',packages:['campBase'],options:{campSide:2},fitPositions:{campBody:{x:1.2,y:.5,rotated:false}},fitSelected:'campBody'};
  const data=decodeScenarioFile(encodeScenarioFile(current,[current]),catalog);
  assert.deepEqual(data.saved[0],current);
  const invalid=JSON.parse(encodeScenarioFile(current,[]));invalid.current.packages=['unknown'];
  assert.throws(()=>decodeScenarioFile(JSON.stringify(invalid),catalog));
});
test('자유 배치 위치에 따라 네 방향 여유와 겹침을 계산한다',()=>{
  const camp=getPlacedBox(catalog.modules.find(x=>x.id==='campBody'),{x:1,y:1});
  assert.deepEqual(edgeClearance(camp),{left:1,right:2.5,top:1,bottom:1.8});
  const coody=getPlacedBox(catalog.modules.find(x=>x.id==='coody10Body'),{x:6,y:3});
  assert.equal(boxesOverlap(camp,coody),true);
  const moved={...coody,x:7.5,y:4.2};
  assert.equal(boxesOverlap(camp,moved),false);
});

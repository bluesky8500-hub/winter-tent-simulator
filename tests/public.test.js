import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {configureCatalog,evaluate} from '../src/engine.js';
import {encodeScenarioFile,decodeScenarioFile} from '../src/scenario-file.js';
import {boxesOverlap,edgeClearance,getPlacedBox,arrangementSummary,connectorContact,connectorIds,moveGroup} from '../src/fit-board.js';

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
test('저장한 본체 위치의 전체 경계 면적을 계산하고 커넥터 위치를 공유한다',()=>{
  const s={name:'배치',packages:['hubBase','coody10Base'],options:{proConnector:1},fitPositions:{hubBody:{x:0,y:0,rotated:false},coody10Body:{x:3.7,y:0,rotated:false}},connectorPositions:{proConnector:{x:3.65,y:1.8}},connectorLinks:{proConnector:['hubBody','coody10Body']}};
  const r=evaluate(s);const size=arrangementSummary(r.modules,catalog,s);
  assert.deepEqual(size.extent,{length:6.5,width:3.8,area:24.7,fits:true});
  const imported=decodeScenarioFile(encodeScenarioFile(s,[s]),catalog).saved[0];
  assert.deepEqual(imported.connectorPositions,s.connectorPositions);
  assert.deepEqual(imported.connectorLinks,s.connectorLinks);
});
test('연결 표시는 두 본체의 마주 보는 구간을 따르고 폭이 없으면 추정하지 않는다',()=>{
  const a={x:0,y:0,length:3.6,width:3.8},b={x:3.7,y:0.4,length:2.8,width:3.6};
  assert.deepEqual(connectorContact(a,b,0.1),{x:3.6,y:0.4,length:0.1,width:3.4,contact:3.4,depth:0.1});
  assert.equal(connectorContact(a,{...b,y:4},null),null);
  assert.equal(connectorContact(a,b,null)?.depth,null);
});
test('03에서 배치 전체를 움직여도 모듈 간 상대 위치가 유지된다',()=>{
  const boxes=[{id:'a',x:1,y:1,length:3,width:2,rotated:false},{id:'b',x:4.1,y:1,length:2,width:2,rotated:true}];
  assert.deepEqual(moveGroup(boxes,2,1).map(x=>[x.x,x.y,x.rotated]),[[3,2,false],[6.1,2,true]]);
  assert.deepEqual(moveGroup(boxes,20,20).map(x=>[x.x,x.y]),[[4.9,5],[8,5]]);
});
test('기본 포함 연결부와 선택 옵션 커넥터를 모두 배치 대상으로 찾는다',()=>{
  assert.deepEqual(connectorIds({packages:['happyBase'],options:{}},catalog),['happyConnector']);
  assert.deepEqual(connectorIds({packages:['hubBase','coody10Base'],options:{proConnector:1}},catalog),['proConnector']);
  assert.equal(catalog.modules.find(m=>m.id==='happyConnector').length,0.6);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {configureCatalog,evaluate,scenarioDisplayName} from '../src/engine.js';
import {encodeScenarioFile,decodeScenarioFile} from '../src/scenario-file.js';
import {boxesOverlap,edgeClearance,getPlacedBox,arrangementSummary,connectorContact,connectorIds,moveGroup,rotateGroup,snapDockingPlacement} from '../src/fit-board.js';

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
test('에어노크 8.0T 도킹은 전용 커넥터를 필수로 요구하지 않는다',()=>{
  const rules=catalog.dockingRules.filter(rule=>rule.id==='airnok8St'||rule.id==='airnok8Tarp');
  assert.equal(rules.length,2);
  assert.ok(rules.every(rule=>rule.connectorRequired===false&&rule.connectorRequirementSource==='user20261103Direct'));
  const without=evaluate({packages:['happyBase','airnok8Base'],options:{}});
  assert.equal(without.docking.status,'확정');
  assert.ok(!without.errors.some(error=>error.includes('도킹')));
  assert.ok(!without.lines.some(line=>line.subject==='airnok8Connector'));
  assert.equal(without.layout.footprint,null);
  const withOption=evaluate({packages:['happyBase','airnok8Base'],options:{airnok8Connector:1}});
  assert.equal(withOption.docking.status,'확정');
  assert.ok(withOption.lines.some(line=>line.subject==='airnok8Connector'));
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
test('03에서 배치 전체를 90도 회전하고 사이트 안으로 보정한다',()=>{
  const boxes=[{id:'a',x:1,y:1,length:3,width:2,rotated:false},{id:'b',x:4.1,y:1,length:2,width:2,rotated:true}];
  const rotated=rotateGroup(boxes);
  assert.deepEqual(rotated.map(x=>[x.id,x.length,x.width,x.rotated]),[['a',2,3,true],['b',2,2,false]]);
  assert.ok(rotated.every(box=>box.x>=0&&box.y>=0&&box.x+box.length<=10&&box.y+box.width<=7));
  assert.equal(Math.abs((rotated[0].y+rotated[0].width/2)-(rotated[1].y+rotated[1].width/2)),2.6);
});
test('기본 포함 연결부와 선택 옵션 커넥터를 모두 배치 대상으로 찾는다',()=>{
  assert.deepEqual(connectorIds({packages:['happyBase'],options:{}},catalog),['happyConnector']);
  assert.deepEqual(connectorIds({packages:['hubBase','coody10Base'],options:{proConnector:1}},catalog),['proConnector']);
  assert.equal(catalog.modules.find(m=>m.id==='happyConnector').length,0.6);
});
test('도킹 규칙은 방향과 커넥터 필요 상태를 구조적으로 제공한다',()=>{
  const requirements=new Set(['required','optional','included','unknown']);
  assert.ok(catalog.dockingRules.every(rule=>Array.isArray(rule.directions)&&requirements.has(rule.connectorRequirement)));
  const six=catalog.dockingRules.find(rule=>rule.id==='airnok6Tarp');
  assert.deepEqual(six.directions,['side']);assert.equal(six.connectorRequirement,'required');assert.equal(six.connectorGap,0);
  for(const id of ['airnok8St','airnok8Tarp']){
    const rule=catalog.dockingRules.find(item=>item.id===id);
    assert.equal(rule.connectorRequirement,'optional');assert.equal(rule.directGap,0);assert.equal(rule.connectorGap,.6);
  }
  assert.equal(catalog.dockingRules.filter(rule=>rule.id.startsWith('coodyFamilia')&&rule.status==='미확인').length,2);
});
test('에어노크 커넥터 필수와 선택 규칙을 구분한다',()=>{
  assert.equal(evaluate({packages:['happyBase','airnok6Base'],options:{}}).docking.status,'커넥터 미선택');
  assert.equal(evaluate({packages:['happyBase','airnok6Base'],options:{airnok6Connector:1}}).docking.status,'확정');
  assert.equal(evaluate({packages:['happyBase','airnok8Base'],options:{}}).docking.status,'확정');
  assert.ok(evaluate({packages:['airnok8Base'],options:{airnok8Connector:1}}).errors.some(error=>error.includes('적용 대상')));
  assert.ok(evaluate({packages:['campBase','happyBase'],options:{}}).errors.some(error=>error.includes('도킹 호환성')));
  assert.equal(evaluate({packages:['familiaBase','hubBase'],options:{}}).docking.status,'미확인');
});
test('8.0T 선택 커넥터는 맞춤 배치 외곽을 0.6m 확장한다',()=>{
  const moduleIds=['airnok8Body','st'];
  const direct={options:{},fitPositions:{airnok8Body:{x:1,y:1,rotated:false},st:{x:3.5,y:1,rotated:false}}};
  const directSnap=snapDockingPlacement('st',moduleIds,catalog,direct);
  assert.equal(directSnap.position.x,3.3);direct.fitPositions.st=directSnap.position;
  const expanded={options:{airnok8Connector:1},fitPositions:{airnok8Body:{x:1,y:1,rotated:false},st:{x:3.7,y:1,rotated:false}}};
  const expandedSnap=snapDockingPlacement('st',moduleIds,catalog,expanded);
  assert.equal(expandedSnap.position.x,3.9);expanded.fitPositions.st=expandedSnap.position;
  assert.ok(Math.abs(arrangementSummary(moduleIds,catalog,expanded).extent.length-arrangementSummary(moduleIds,catalog,direct).extent.length-.6)<1e-9);
});
test('6.4 측면 도킹은 커넥터를 선택해도 본체가 간격 없이 맞닿는다',()=>{
  const moduleIds=['airnok6Body','tarp'];
  const scenario={options:{airnok6Connector:1},fitPositions:{airnok6Body:{x:1,y:1,rotated:false},tarp:{x:1,y:3.5,rotated:false}}};
  const snap=snapDockingPlacement('tarp',moduleIds,catalog,scenario);
  assert.equal(snap.axis,'y');assert.equal(snap.gap,0);assert.equal(snap.position.y,3.3);
});
test('쿠디 8.0 배송비와 자동 조합명을 적용한다',()=>{
  const result=evaluate({packages:['coody8Base'],options:{}});
  assert.equal(result.lines.find(line=>line.category==='배송비').amount,20000);
  assert.equal(result.total,1209000);
  assert.equal(scenarioDisplayName({packages:['hubBase','coody10Base']},catalog),'쿠디 허브쉘터 PRO + 쿠디 10.0 PRO');
});
test('05 비교표 머리글은 데이터 셀 안에 중첩되지 않는다',()=>{
  const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.ok(source.includes('const headings=columns.map'));
  assert.ok(!source.includes('cell(x=>`<th>'));
});

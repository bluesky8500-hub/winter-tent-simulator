import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';

const db=new DatabaseSync(path.resolve(process.argv[2]??'db/catalog.sqlite'));
const migration='airnok7-pdf-review-2026-11-04';
const date='2026-11-04';
const source='airnok7Pdf';
const sha='03d293c6ca0331a369058ec1c21728ff71f118fe10b5394b7fd68bf1861f6bee';
const one=(sql,...args)=>db.prepare(sql).get(...args);
const run=(sql,...args)=>db.prepare(sql).run(...args);
const json=JSON.stringify;
function update(table,key,value,sql,args){
  const before=one(`SELECT * FROM "${table}" WHERE ${key}=?`,value);
  run(sql,...args);
  const after=one(`SELECT * FROM "${table}" WHERE ${key}=?`,value);
  if(json(before)!==json(after))run('INSERT INTO catalog_row_history(table_name,row_id,before_json,after_json,source_ref,changed_at) VALUES (?,?,?,?,?,?)',table,value,json(before),json(after),migration,date);
}
function claim(id,subject,field,value,locator,status='확정',condition='',sourceId=source){
  if(one('SELECT id FROM claim WHERE id=?',id))throw new Error(`Claim already exists: ${id}`);
  run('INSERT INTO claim VALUES (?,?,?,?,?,?,?,?,?)',id,subject,field,json(value),sourceId,locator,status,condition,date);
}
function evidence(id,claimId,locator,note){
  run('INSERT INTO claim_evidence VALUES (?,?,?,?,?,?)',id,claimId,source,locator,note,date);
}
db.exec('PRAGMA foreign_keys=ON; BEGIN');
try{
  if(one('SELECT id FROM catalog_migration WHERE id=?',migration))throw new Error('Review already applied');
  update('source','id',source,'UPDATE source SET file=?,date=? WHERE id=?',[`오투라이프 캠핑 에어텐트 에어노크 7.PDF (43쪽; SHA256 ${sha})`,date,source]);
  run('INSERT INTO pdf_review VALUES (?,?,?,?,?,?,?)','airnok7PdfReview20261104','airnok7',source,43,'43쪽 페이지별 시각 확인; 핵심 표기 확대 대조',date,`첨부 PDF SHA256 ${sha}; 원본 파일은 저장소에 포함하지 않음`);
  evidence('airnok7Pdf20261104:price','pAirnok7','1쪽','판매가 580,000원; 취소선 표시가 680,000원');
  evidence('airnok7Pdf20261104:shipping','user20261103_shipping_airnok7Base','1쪽','판매페이지에도 배송비 15,000원 표시; 기존 사용자 직접 확인 Claim 및 채택 이력 유지');
  for(const [id,subject,field,value,locator,status,condition] of [
    ['airnok7Pdf20261104:dimensions','airnok7','outerDimensionsCm',[300,230,190],'30·32쪽','확정','본체 표기; 정면 높이 190cm·후면 높이 170cm'],
    ['airnok7Pdf20261104:packing','airnok7','packingDimensionsCm',[70,35,30],'31쪽','확정','측정 방식에 따라 1~2cm 오차 가능'],
    ['airnok7Pdf20261104:fabric','airnok7','skinBlend',{cotton:35,polyester:65},'32쪽','확정','T/C 스킨'],
    ['airnok7Pdf20261104:floor','airnok7','floorMaterial','410D 립스탑 PU 코팅','28·32쪽','확정','본체 바닥 원단; 별도 타포린 그라운드시트와 구분'],
    ['airnok7Pdf20261104:airbeam','airnok7','airbeamMaterial','PVC','32쪽','확정','에어폴 소재; 직경·권장 압력은 이 표에 없음'],
    ['airnok7Pdf20261104:components','airnok7Base','listedBasicComponents',['본체','보관가방','펌프'],'2쪽','확정','상품정보 기본구성품 목록; 각 수량은 명시되지 않음'],
    ['airnok7Pdf20261104:weight165','airnok7','weightKg',16.5,'2쪽','충돌','상품정보의 무게; 본체·포장 범위 미기재'],
    ['airnok7Pdf20261104:weight168','airnok7','weightKg',16.8,'13·32쪽','충돌','상세페이지; 32쪽에는 본체라고 명시'],
    ['airnok7Pdf20261104:mblackOld','airnok7MBlackLegacy','dock7Compatible',false,'24·25쪽','확정','기존형 M블랙 타프쉘터; 도어 구조 차이'],
    ['airnok7Pdf20261104:mblackNew','airnok7MBlackRevised','dock7Compatible',true,'24·25쪽','확정','개선형 M블랙 타프쉘터; 7.0T 도킹용 지퍼 추가'],
    ['airnok7Pdf20261104:tarpDock','airnok7','tarpShelterDockShown',true,'18·20쪽','확정','10.0 타프쉘터와의 사용 이미지; 전면·후면별 가능 범위는 사용자 직접 확인 Claim 유지'],
    ['airnok7Pdf20261104:flyOptional','airnok7FullFly','basicIncluded',false,'30쪽','확정','추가 옵션으로 표기; 판매가 페이지 내 직접 표기 미확인']
  ])claim(id,subject,field,value,locator,status,condition);
  claim('airnok7User20261103:stDirections','airnok7St','dockingDirections',['front'],'2026-11-03 사용자 직접 확인','확정','10.0ST 기준; 후면 도킹 불가','user20261103Direct');
  claim('airnok7User20261103:tarpDirections','airnok7Tarp','dockingDirections',['front','rear'],'2026-11-03 사용자 직접 확인','확정','10.0 타프쉘터 기준','user20261103Direct');
  claim('airnok7User20261103:connectorRequired','airnok7','dockingConnectorRequired',true,'2026-11-03 사용자 직접 확인','확정','7.0T 전용 커넥터 필요','user20261103Direct');
  update('option_item','id','airnok7Bag',"UPDATE option_item SET condition='PDF 2쪽 기본구성품 목록; 정확 수량 미표기' WHERE id='airnok7Bag'",[]);
  update('option_item','id','airnok7Pump',"UPDATE option_item SET condition='PDF 2쪽 기본구성품 목록; 정확 수량 미표기' WHERE id='airnok7Pump'",[]);
  update('option_item','id','airnok7Pegs',"UPDATE option_item SET kind='unverified',condition='31쪽 하단 도해 일부만 보임; 2쪽 기본구성품 목록에 팩 없음. 포함 여부·수량 미확인' WHERE id='airnok7Pegs'",[]);
  update('package','id','airnok7Base','UPDATE package SET included_json=? WHERE id=?',[json(['airnok7Bag','airnok7Pump']),'airnok7Base']);
  update('verification','id','PDF-AIRNOK7-COMPONENTS',"UPDATE verification SET status='부분 해결',issue='2쪽 기본구성품 목록은 본체·보관가방·펌프. 31쪽 도해의 팩처럼 보이는 그림은 하단이 잘려 표기·수량 판독 불가',needed='팩 포함 여부와 각 부속 수량 판매자 확인' WHERE id='PDF-AIRNOK7-COMPONENTS'",[]);
  update('verification','id','PDF-AIRNOK7-WEIGHT',"UPDATE verification SET issue='2쪽 상품정보 16.5kg과 13·32쪽 상세페이지 16.8kg(32쪽 본체) 표기 충돌',claims_json=?,needed='16.5kg의 포함 범위와 정확 본체 중량 판매자 확인' WHERE id='PDF-AIRNOK7-WEIGHT'",[json(['airnok7Pdf20261104:weight165','airnok7Pdf20261104:weight168'])]);
  update('verification','id','PDF-AIRNOK7-MBLACK',"UPDATE verification SET issue='24·25쪽: 기존 M블랙은 7.0T와 도어 구조가 달라 도킹 불가; 개선형은 7.0T 도킹용 지퍼 추가',claims_json=?,needed='일반 10.0 타프쉘터와 M블랙 개선형의 판매 버전 식별 필요' WHERE id='PDF-AIRNOK7-MBLACK'",[json(['airnok7Pdf20261104:mblackOld','airnok7Pdf20261104:mblackNew'])]);
  update('verification','id','PDF-AIRNOK7-OPTIONS',"UPDATE verification SET issue='커넥터·그라운드시트·풀플라이 가격은 사용자 직접 확인 Claim 유지; 이 PDF에서는 각 옵션 단가 직접 표기 미확인. 블랙코팅 타프·확장 타프·TPU·메쉬 가격과 포함 관계 미확인' WHERE id='PDF-AIRNOK7-OPTIONS'",[]);
  run('INSERT INTO catalog_migration VALUES (?,?,?,?)',migration,`첨부 PDF SHA256 ${sha}`,date,'7.0T 43쪽 검토. 사용자 가격·도킹 채택값 유지; PDF 사실 별도 Claim 및 evidence; 팩 포함 여부 미확인으로 분리');
  db.exec('COMMIT');
  console.log('Applied 7.0T PDF review; claims/evidence/history retained');
}catch(error){db.exec('ROLLBACK');throw error}finally{db.close()}

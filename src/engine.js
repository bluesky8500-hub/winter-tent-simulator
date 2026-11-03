let activeCatalog;
export function configureCatalog(data){activeCatalog=data}

const byId=(items,id)=>items.find(x=>x.id===id);
const unique=values=>[...new Set(values)];
export const won=value=>value==null?'미확인':`${value.toLocaleString('ko-KR')}원`;

export function adoptedClaim(subject,field='price',data=activeCatalog){
  const adoption=data.adoptions.find(x=>x.subject===subject&&x.field===field);
  return adoption?data.claims.find(x=>x.id===adoption.claimId):null;
}

export function scenarioDisplayName(scenario,data=activeCatalog){
  const productIds=[];
  for(const packageId of scenario.packages||[]){
    const item=byId(data.packages,packageId);
    const productId=item?.modules.map(id=>byId(data.modules,id)?.product).find(Boolean);
    if(productId&&!productIds.includes(productId))productIds.push(productId);
  }
  const names=productIds.map(id=>byId(data.products,id)).filter(Boolean).map(product=>`${product.brand} ${product.name}`);
  return names.join(' + ')||'새 조합';
}

export function evaluate(scenario,data=activeCatalog){
  const errors=[],warnings=[],lines=[];
  const packageIds=unique(scenario.packages||[]);
  const selected=(scenario.options||{});
  const chosenPackages=packageIds.map(id=>byId(data.packages,id));
  if(chosenPackages.some(x=>!x)) errors.push('등록되지 않은 패키지가 있습니다.');
  let moduleIds=chosenPackages.filter(Boolean).flatMap(x=>x.modules);
  const selectedEntries=Object.entries(selected).filter(([,qty])=>Number(qty)>0);
  for(const [id,qty] of selectedEntries){
    const option=byId(data.options,id);
    if(!option){errors.push(`등록되지 않은 옵션: ${id}`);continue;}
    if(!Number.isInteger(Number(qty))||Number(qty)>option.max) errors.push(`${option.name}: 허용 수량 0~${option.max}`);
  }
  const count=id=>Number(selected[id]||0);
  if(count('familiaCarpetSet')+count('familiaCarpetBagSet')>1 ||
     (count('familiaCarpetSet')+count('familiaCarpetBagSet')>0 && (count('familiaFrontCarpet')||count('familiaRearCarpet'))))
    errors.push('파밀리아 카펫 세트와 포함 단품은 중복 선택할 수 없습니다.');
  if(count('familiaCarpetBagSet') && count('coodyCarpetBag'))
    errors.push('파밀리아 카펫+가방 세트에는 가방 2개가 포함되어 공용 카펫 가방과 중복 선택할 수 없습니다.');
  if(count('coody8CarpetBagSet')&&(count('coody8Carpet')||count('coody8CarpetBag'))) errors.push('8.0 PRO 카펫+가방 세트와 단품은 중복 선택할 수 없습니다.');
  if(count('airnok8SideTpu')&&scenario.color==='베이지') errors.push('베이지 기본 증정 사이드 TPU와 유료 세트는 중복 선택할 수 없습니다.');
  if(count('happyFront')) errors.push('타프쉘터 정면 TPU는 기본 포함입니다. 129,000원 별도 판매 옵션의 적용 대상은 미확인입니다.');
  if(count('skySwap')&&count('happyFront')) errors.push('SKY 변경 구성에서 정면 TPU 적용 범위는 미확인입니다.');
  if(count('skySwap')){
    if(!packageIds.includes('happyBase')) errors.push('SKY 교체는 해피패밀리 세트에서만 가능합니다.');
    moduleIds=moduleIds.map(id=>id==='tarp'?'sky':id);
    warnings.push('SKY 교체 시 포함품·도킹 외곽은 미확인입니다.');
  }
  moduleIds=unique(moduleIds);
  const activeDockingRules=data.dockingRules.filter(r=>r.modules.every(id=>moduleIds.includes(id)));
  const packageModuleSets=chosenPackages.filter(Boolean).map(item=>new Set(item.modules));
  let incompatiblePackages=false;
  for(let i=0;i<packageModuleSets.length;i++)for(let j=i+1;j<packageModuleSets.length;j++)if(!data.dockingRules.some(rule=>rule.status==='확정'&&rule.modules.some(id=>packageModuleSets[i].has(id))&&rule.modules.some(id=>packageModuleSets[j].has(id))))incompatiblePackages=true;
  if(packageIds.length>1&&incompatiblePackages) errors.push('이 패키지 조합의 도킹 호환성은 확인되지 않았습니다.');
  else if(activeDockingRules.some(r=>r.status!=='확정')) errors.push('선택한 모듈 중 도킹 정보가 미확인인 조합이 있습니다.');
  const packageProducts=unique(chosenPackages.filter(Boolean).flatMap(p=>p.modules.map(id=>byId(data.modules,id)?.product).filter(Boolean)));
  for(const [id,qty] of selectedEntries){
    const option=byId(data.options,id); if(!option)continue;
    const target=option.target;
    const valid= id==='airnok6Connector' ? packageIds.includes('airnok6Base')&&packageIds.includes('happyBase') :
      id==='airnok8Connector' ? packageIds.includes('airnok8Base')&&packageIds.includes('happyBase') :
      target==='coodyProConnector' ? packageProducts.some(p=>['hub','coody10','familia'].includes(p)) :
      target==='coody8Dock' ? packageIds.includes('coody8Base')&&packageIds.length>1 :
      target==='coodyProStandard' ? packageProducts.some(p=>['hub','coody10','familia'].includes(p)) :
      target==='airnokShared' ? packageProducts.some(p=>['happy','airnok6','airnok8'].includes(p)) :
      target==='coodyPro'||target==='coodyAccessory' ? packageProducts.some(p=>['hub','coody10','familia','coody8'].includes(p)) :
      target==='happy' ? packageIds.includes('happyBase') :
      target==='happyBase' ? packageIds.includes('happyBase') :
      moduleIds.includes(target);
    if(!valid) errors.push(`${option.name}: 적용 대상 모듈이 선택되지 않았습니다.`);
    if(id==='proClearDoor'||id==='happyDockTarp'||id==='happyExtendTarp') warnings.push(`${option.name}: ${option.condition}`);
  }
  const base=chosenPackages.filter(Boolean).map(p=>line(p.id,p.name,'기본가',1,data));
  lines.push(...base);
  for(const [id,qty] of selectedEntries){
    const option=byId(data.options,id);if(option)lines.push(line(id,option.name,option.kind==='replacement'?'모듈 교체금':'옵션',Number(qty),data));
  }
  const subtotal=lines.reduce((sum,x)=>sum+(x.amount??0),0);
  const missingPrices=lines.filter(x=>x.amount==null);
  const shipping=scenario.shipping;
  let shippingAmount=null;
  if(shipping?.status==='확정'&&Number.isInteger(shipping.amount)&&shipping.amount>=0) shippingAmount=shipping.amount;
  else if(packageIds.length&&chosenPackages.every(Boolean)){
    const fees=packageIds.map(id=>adoptedClaim(id,'shipping',data)?.value);
    if(fees.every(x=>Number.isInteger(x)&&x>=0)) shippingAmount=fees.reduce((a,b)=>a+b,0);
  }
  if(shippingAmount==null) warnings.push('배송비 적용 금액·조건 미확인');
  const discount=scenario.discount;
  let discountAmount=0;
  if(discount?.status==='확정'&&Number.isInteger(discount.amount)&&discount.amount>=0) discountAmount=discount.amount;
  else if(discount?.status==='미확인') warnings.push('세트 할인 금액 미확인');
  lines.push({subject:'discount',name:discount?'세트 할인':'별도 할인 기록 없음',category:'세트 할인',quantity:1,unitPrice:discount?.status==='확정'?-discountAmount:null,amount:discount?.status==='확정'?-discountAmount:null,status:discount?.status||'정보 없음',source:discount?.source||null});
  lines.push({subject:'shipping',name:'배송비',category:'배송비',quantity:1,unitPrice:shippingAmount,amount:shippingAmount,status:shippingAmount==null?'미확인':'확정',source:shipping?.source||'사용자 확인 · 텐트별 합산, 동시 구매 옵션 합배송'});
  const knownSubtotal=subtotal-discountAmount+(shippingAmount??0);
  const total=(errors.length||missingPrices.length||shippingAmount==null||discount?.status==='미확인')?null:knownSubtotal;
  const docking=assessDocking(moduleIds,data,selected);
  const layout=docking.status==='커넥터 미선택'&&packageIds.length>1?{status:'미확인',bodyFit:null,footprint:null,individual:[],unknown:['필수 커넥터 미선택','가이라인','차량','출입 동선']}:assessLayout(packageIds,moduleIds,data,{length:10,width:7},scenario);
  return {lines,knownSubtotal,total,missingPrices:missingPrices.map(x=>x.name),errors,warnings:unique(warnings),modules:moduleIds,docking,layout};
}

function line(subject,name,category,quantity,data){
  const adoption=data.adoptions.find(x=>x.subject===subject&&x.field==='price');
  const claim=adoption&&data.claims.find(x=>x.id===adoption.claimId);
  return {subject,name,category,quantity,unitPrice:claim?.value??null,amount:claim?.value==null?null:claim.value*quantity,status:claim?'확정':'미확인',source:claim?`${claim.source} · ${claim.locator}`:null,adoptionReason:adoption?.reason||null,condition:adoption?.condition||null};
}

export function assessDocking(moduleIds,data=activeCatalog,selected={}){
  const rules=data.dockingRules.filter(r=>r.modules.every(id=>moduleIds.includes(id)));
  if(!rules.length) return {status:'해당 없음',rules:[]};
  const confirmed=rules.filter(rule=>rule.status==='확정');
  const missing=confirmed.find(rule=>rule.connectorRequirement==='required'&&rule.connector&&!selected[rule.connector]);
  if(missing)return {status:'커넥터 미선택',ruleId:missing.id,connector:missing.connector,rules,note:`${byId(data.options,missing.connector)?.name||missing.connector} 선택이 필요합니다.`};
  if(confirmed.length&&rules.some(rule=>rule.status!=='확정'))return {status:'일부 미확인',rules,note:rules.map(rule=>rule.note).join(' / ')};
  const rule=confirmed.find(r=>r.id==='airnok6Tarp')||confirmed.find(r=>r.id.startsWith('airnok8'))||confirmed.find(r=>r.id.startsWith('coody8'))||confirmed[0]||rules[0];
  return {status:rule.status,ruleId:rule.id,connector:rule.connector,rules,note:rule.note};
}

export function assessLayout(packageIds,moduleIds,data=activeCatalog,site={length:10,width:7},scenario={}){
  const key=packageIds.length===1?packageIds[0]:packageIds.includes('hubBase')&&packageIds.includes('coody10Base')?'coodyDock':null;
  const f=data.footprints.find(x=>x.key===key);
  const individual=moduleIds.map(id=>byId(data.modules,id)).filter(x=>x&&x.width&&x.length).map(m=>({id:m.id,name:m.name,width:m.width,length:m.length}));
  if(!f||f.width==null||f.length==null||moduleIds.includes('sky')) return {status:'미확인',bodyFit:null,footprint:null,individual,unknown:['도킹 완성 외곽','가이라인','차량','출입 동선','팩다운 여유']};
  const fits=f.length<=site.length&&f.width<=site.width;
  const rearClearance=packageIds.includes('airnok8Base')&&scenario.color==='그레이카키'?1:0;
  return {status:'본체 치수만 확인',bodyFit:fits,footprint:{width:f.width,length:f.length,source:f.source,status:f.status},individual,remaining:{length:site.length-f.length,width:site.width-f.width},rearClearance,unknown:['가이라인','차량','출입 동선','팩다운 여유']};
}

export function compareQuote(result,quote){return {quote,knownSubtotal:result.knownSubtotal,difference:quote-result.knownSubtotal,matching:quote===result.knownSubtotal,finalTotalKnown:result.total!=null};}

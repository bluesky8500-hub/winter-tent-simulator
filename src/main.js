import {evaluate,won,compareQuote,configureCatalog,scenarioDisplayName} from './engine.js';
import {encodeScenarioFile,decodeScenarioFile} from './scenario-file.js';
import {renderFitBoard,arrangementSummary,connectorIds} from './fit-board.js';

const response=await fetch(new URL('../catalog.json',import.meta.url));
if(!response.ok)throw new Error(`공개 카탈로그를 불러오지 못했습니다: ${response.status}`);
const catalog=await response.json();
configureCatalog(catalog);

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const presets=[
  {name:'캠빌 3-Bay',packages:['campBase'],options:{}},
  {name:'쿠디 파밀리아',packages:['familiaBase'],options:{}},
  {name:'쿠디 허브 + 10.0 PRO',packages:['hubBase','coody10Base'],options:{proConnector:1}},
  {name:'에어노크 해피패밀리',packages:['happyBase'],options:{}}
];
let scenario={name:'',packages:['campBase'],options:{}};
let saved=readSaved();
let compareSelected=new Set();
function readSaved(){try{const x=JSON.parse(localStorage.getItem('tent-scenarios-v1')||'[]');return Array.isArray(x)?x:[]}catch{return []}}
function persist(){try{localStorage.setItem('tent-scenarios-v1',JSON.stringify(saved));return true}catch{return false}}
function withAutoName(item){return {...item,name:scenarioDisplayName(item,catalog)}}
saved=saved.map(withAutoName);persist();
function sourceLink(id){const s=catalog.sources[id];return esc(s?.label||id||'출처 미확인')}
function optionAvailable(o){const p=scenario.packages;const moduleIds=p.flatMap(id=>catalog.packages.find(x=>x.id===id)?.modules||[]);return o.id==='airnok6Connector'?p.includes('airnok6Base')&&p.includes('happyBase'):o.id==='airnok8Connector'?p.includes('airnok8Base')&&p.includes('happyBase'):o.target==='coodyDock'?p.includes('hubBase')&&p.includes('coody10Base'):o.target==='coody8Dock'?p.includes('coody8Base')&&p.length>1:o.target==='coodyProStandard'?p.some(id=>['familiaBase','hubBase','coody10Base'].includes(id)):o.target==='coodyPro'||o.target==='coodyAccessory'?p.some(id=>['familiaBase','hubBase','coody10Base','coody8Base'].includes(id)):o.target==='airnokShared'?p.some(id=>['happyBase','airnok6Base','airnok8Base'].includes(id)):['happy','happyBase'].includes(o.target)?p.includes('happyBase'):moduleIds.includes(o.target)}
function contents(s){
  const included=s.packages.flatMap(id=>catalog.packages.find(x=>x.id===id)?.included||[]).filter(id=>!(id==='tarpFrontTpuIncluded'&&s.options.skySwap)).map(id=>catalog.options.find(x=>x.id===id)).filter(Boolean);
  const gifts=[...s.packages.flatMap(id=>catalog.packages.find(x=>x.id===id)?.gifts||[]),...(s.packages.includes('airnok8Base')&&s.color==='베이지'?['airnok8BeigeFly','airnok8BeigeSideTpu']:[])].map(id=>catalog.options.find(x=>x.id===id)).filter(Boolean);
  if(s.packages.includes('airnok8Base')&&s.color==='그레이카키')included.push(catalog.options.find(x=>x.id==='airnok8GrayFly'));
  return {included:included.filter(Boolean),gifts};
}
function renderConnectorPlacement(r){
  const ids=connectorIds(scenario,catalog),modules=r.modules.map(id=>catalog.modules.find(m=>m.id===id)).filter(m=>m&&!/connector/i.test(m.id));
  $('connectorPlacement').innerHTML=ids.length?`<div class="label">커넥터 연결 위치</div>${ids.map(id=>{const o=catalog.options.find(x=>x.id===id)||catalog.modules.find(x=>x.id===id);const choices=modules.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');return `<div class="connector-row"><strong>${esc(o?.name||id)}</strong><label>첫 모듈<select data-link="${esc(id)}" data-end="0"><option value="">선택</option>${choices}</select></label><label>둘째 모듈<select data-link="${esc(id)}" data-end="1"><option value="">선택</option>${choices}</select></label></div>`}).join('')}<p class="small">6.4 커넥터는 두 본체가 맞닿아 폭을 더하지 않습니다. 8.0T 커넥터는 맞춤 배치 시 본체 사이 0.6m 확장으로 반영합니다. 그 밖의 치수 미확인 커넥터는 외곽에 합산하지 않습니다.</p>`:'';
  for(const select of $('connectorPlacement').querySelectorAll('[data-link]')){
    select.value=scenario.connectorLinks?.[select.dataset.link]?.[Number(select.dataset.end)]||catalog.dockingRules.find(rule=>rule.connector===select.dataset.link&&rule.modules.every(id=>modules.some(module=>module.id===id)))?.modules[Number(select.dataset.end)]||'';
    select.onchange=()=>{scenario.connectorLinks??={};const pair=scenario.connectorLinks[select.dataset.link]||['',''];pair[Number(select.dataset.end)]=select.value;scenario.connectorLinks[select.dataset.link]=pair;renderFitBoard($('buildLayout'),r.modules,catalog,scenario,()=>renderLayout(r));renderLayout(r)};
  }
}
function renderLayout(r){
  const summary=arrangementSummary(r.modules,catalog,scenario),f=summary.extent;
  if(!f){$('layout').innerHTML='<span class="badge uncertain">배치 치수 미확인</span>';return}
  const links=connectorIds(scenario,catalog).map(id=>{const pair=scenario.connectorLinks?.[id]||catalog.dockingRules.find(rule=>rule.connector===id&&rule.modules.every(moduleId=>r.modules.includes(moduleId)))?.modules||[];return `${catalog.options.find(x=>x.id===id)?.name||catalog.modules.find(x=>x.id===id)?.name||id}: ${pair.map(x=>catalog.modules.find(m=>m.id===x)?.name||'미지정').join(' ↔ ')}`});
  $('layout').innerHTML=`<span class="badge ${summary.unknown.length?'uncertain':''}">${summary.unknown.length?'일부 본체 치수 미확인':'확정한 본체 배치'}</span><div id="reviewBoard"></div><p><strong>본체 배치 외곽 ${f.length.toFixed(2)} × ${f.width.toFixed(2)}m · ${f.area.toFixed(2)}㎡</strong></p><p class="small">10 × 7m 사이트: ${f.fits?'본체 치수 기준 내부':'본체가 사이트 경계를 넘음'}${summary.overlap?' · 본체 겹침':''}. 외곽 면적은 빈 공간을 포함한 경계 사각형입니다.</p>${links.length?`<p class="small">커넥터 연결: ${esc(links.join(' / '))}</p>`:''}${summary.unknown.length?`<p class="small">치수 미확인: ${esc(summary.unknown.join(' · '))}</p>`:''}<p class="small">가이라인·차량·동선·팩다운 여유는 미확인입니다. 실제 설치 가능 판정은 보류합니다.</p>`;
  renderFitBoard($('reviewBoard'),r.modules,catalog,scenario,completed=>{renderFitBoard($('buildLayout'),r.modules,catalog,scenario,()=>renderLayout(r));if(completed)renderLayout(r)},{group:true});
  $('reviewBoard').addEventListener('pointerup',()=>renderLayout(r));
}
function renderControls(){
  scenario.name=scenarioDisplayName(scenario,catalog);$('scenarioName').textContent=scenario.name;
  $('presets').innerHTML=presets.map((p,i)=>`<button data-preset="${i}">${esc(p.name)}</button>`).join('');
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const p=presets[Number(b.dataset.preset)];scenario={name:'',packages:[...p.packages],options:{...p.options}};render()});
  $('packages').innerHTML=catalog.packages.map(p=>{const product=catalog.products.find(x=>x.id===catalog.modules.find(m=>m.id===p.modules[0])?.product);return `<div class="choice"><label><input type="checkbox" data-package="${p.id}" ${scenario.packages.includes(p.id)?'checked':''}> <span>${esc(product?.brand)} ${esc(p.name)} <small>${product?.primary?'주요 후보':'추가 등록'}</small></span></label></div>`}).join('');
  document.querySelectorAll('[data-package]').forEach(x=>x.onchange=()=>{scenario.packages=x.checked?[...scenario.packages,x.dataset.package]:scenario.packages.filter(id=>id!==x.dataset.package);for(const o of catalog.options.filter(x=>x.kind==='paid'||x.kind==='replacement'))if(!optionAvailable(o))delete scenario.options[o.id];render()});
  const available=catalog.options.filter(o=>(o.kind==='paid'||o.kind==='replacement')&&optionAvailable(o));
  $('options').innerHTML=(scenario.packages.includes('airnok8Base')?`<p class="option-note">8.0T는 해피패밀리 ST·타프쉘터와 커넥터 없이 도킹할 수 있습니다 (사용자 확인). 전용 커넥터는 필수 구매품이 아닙니다. 완성 외곽 치수는 미확인입니다.</p><div class="choice"><label>8.0T 색상 <select data-color><option value="" ${!scenario.color?'selected':''}>미선택</option><option value="베이지" ${scenario.color==='베이지'?'selected':''}>베이지</option><option value="그레이카키" ${scenario.color==='그레이카키'?'selected':''}>그레이카키</option></select></label></div>`:'')+(available.length?available.map(o=>{const qty=scenario.options[o.id]||0;const adoption=catalog.adoptions.find(a=>a.subject===o.id&&a.field==='price');const claim=catalog.claims.find(c=>c.id===adoption?.claimId);return `<div class="choice"><div><strong>${esc(o.name)}${o.id==='airnok8Connector'?' (선택 사항)':''}</strong><br><small>${won(claim?.value)}${o.condition?' · '+esc(o.condition):''}</small></div><select aria-label="${esc(o.name)} 수량" data-option="${o.id}">${Array.from({length:o.max+1},(_,i)=>`<option value="${i}" ${qty===i?'selected':''}>${i}개</option>`).join('')}</select></div>`}).join(''):'<p class="small">제품을 선택하면 적용 가능한 옵션이 표시됩니다.</p>');
  document.querySelector('[data-color]')?.addEventListener('change',e=>{scenario.color=e.target.value;if(scenario.color==='베이지')delete scenario.options.airnok8SideTpu;render()});
  document.querySelectorAll('[data-option]').forEach(x=>x.onchange=()=>{const id=x.dataset.option;const n=Number(x.value);if(n)scenario.options[id]=n;else delete scenario.options[id];render()});
  const items=contents(scenario);
  $('buildIncluded').innerHTML=`<div class="included-box"><strong>기본 포함</strong><p>${items.included.length?items.included.map(x=>esc(x.name)+(x.quantity?` ${x.quantity}개`:'' )).join(' · '):'기록된 항목 없음'}</p><strong>사은품</strong><p>${items.gifts.length?items.gifts.map(x=>esc(x.name)+(x.quantity?` ${x.quantity}개`:'' )).join(' · '):'기록된 항목 없음'}${items.gifts.length?' <small>행사 적용 조건 확인 필요</small>':''}</p></div>`;
}
function renderResult(){
  const r=evaluate(scenario);
  const rows=r.lines.map(x=>`<div class="row"><span>${esc(x.category)} · ${esc(x.name)}${x.quantity>1?' × '+x.quantity:''}</span><strong>${x.status==='정보 없음'?'별도 기록 없음':won(x.amount)}</strong></div>`).join('');
  const {included,gifts}=contents(scenario);
  $('result').innerHTML=`<span class="badge ${r.total==null?'uncertain':''}">${r.total==null?'최종 총액 미확인':'최종 총액 확인'}</span><div class="money ${r.total==null?'unknown':''}">${won(r.total)}</div><div class="row subtotal"><span>확인된 항목 소계</span><strong>${won(r.knownSubtotal)}</strong></div>${rows}<div class="label">기본 포함품</div><p class="small">${included.length?included.map(x=>`${esc(x.name)}${x.quantity?' '+x.quantity+'개':''}`).join(' · '):'기록된 항목 없음'}</p><div class="label">판매 당시 사은품</div><p class="small">${gifts.length?gifts.map(x=>`${esc(x.name)}${x.quantity?' '+x.quantity+'개':''} (행사 적용 확인 필요)`).join(' · '):'기록된 항목 없음'}</p><div class="warning-list">${[...r.errors.map(x=>'오류: '+x),...r.warnings].map(x=>`<div>• ${esc(x)}</div>`).join('')||'확인할 경고 없음'}</div>`;
  $('docking').innerHTML=`<span class="badge ${r.docking.status==='확정'?'':'uncertain'}">${esc(r.docking.status)}</span><p class="small">${esc((r.docking.rules||[]).map(rule=>rule.note).join(' / ')||r.docking.note||'선택된 모듈에 대한 도킹 규칙 없음')}<br>도킹 호환성과 사이트 설치 적합성은 별도로 판단합니다.</p>`;
  renderFitBoard($('buildLayout'),r.modules,catalog,scenario,()=>renderLayout(r));
  renderConnectorPlacement(r);
  renderLayout(r);
}
function renderSaved(){
  $('saved').innerHTML=saved.length?`<p class="small">비교할 조합을 선택하세요.</p><div class="saved-grid">${saved.map((s,i)=>{const r=evaluate(s);return `<div class="saved-card"><label><input type="checkbox" data-compare="${i}" ${compareSelected.has(i)?'checked':''}> <strong>${esc(s.name)}</strong></label><div class="small">${esc(s.packages.map(id=>catalog.packages.find(x=>x.id===id)?.name||id).join(' + '))}</div><div class="money" style="font-size:21px">${won(r.total)}</div><button data-load="${i}">불러오기</button><button data-delete="${i}">삭제</button></div>`}).join('')}</div>`:'<p class="small">저장한 조합이 없습니다. 현재 조합을 저장하면 선택 비교할 수 있습니다.</p>';
  document.querySelectorAll('[data-compare]').forEach(x=>x.onchange=()=>{const i=Number(x.dataset.compare);if(x.checked)compareSelected.add(i);else compareSelected.delete(i);renderComparison()});
  document.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{scenario=structuredClone(saved[Number(b.dataset.load)]);render();window.scrollTo({top:0,behavior:'smooth'})});
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{const index=Number(b.dataset.delete);saved.splice(index,1);compareSelected=new Set([...compareSelected].filter(i=>i!==index).map(i=>i>index?i-1:i));persist();renderSaved()});
  renderComparison();
}
function renderComparison(){
  const selected=[...compareSelected].sort((a,b)=>a-b).filter(i=>saved[i]);
  if(!selected.length){$('comparison').innerHTML='';return}
  const columns=selected.map(i=>{const s=saved[i],r=evaluate(s),shipping=r.lines.find(x=>x.category==='배송비')?.amount,subtotal=r.lines.filter(x=>!['배송비','세트 할인'].includes(x.category)).reduce((sum,x)=>sum+(x.amount||0),0),missing=r.lines.some(x=>!['배송비','세트 할인'].includes(x.category)&&x.amount==null),size=arrangementSummary(r.modules,catalog,s),contentsList=contents(s);return {s,r,shipping,subtotal,missing,size,contentsList}});
  const cell=fn=>columns.map(x=>`<td>${fn(x)}</td>`).join('');
  const headings=columns.map(x=>`<th scope="col">${esc(x.s.name)}</th>`).join('');
  $('comparison').innerHTML=`<div class="label">선택한 조합 비교</div><div class="ledger comparison-table"><table><thead><tr><th scope="col">항목</th>${headings}</tr></thead><tbody><tr><th scope="row">제품·옵션 금액<br><small>배송비 제외</small></th>${cell(x=>x.missing?'미확인 · 확인 소계 '+won(x.subtotal):won(x.subtotal))}</tr><tr><th scope="row">배송비</th>${cell(x=>won(x.shipping))}</tr><tr><th scope="row">최종 총액</th>${cell(x=>won(x.r.total))}</tr><tr><th scope="row">구성품</th>${cell(x=>[...x.r.modules.map(id=>catalog.modules.find(m=>m.id===id)?.name||id),...x.r.lines.filter(line=>['옵션','모듈 교체금'].includes(line.category)).map(line=>`${line.name} × ${line.quantity}`),...x.contentsList.included.map(item=>`${item.name} (기본)`),...x.contentsList.gifts.map(item=>`${item.name} (사은품·조건 확인)`)].map(item=>`<div>${esc(item)}</div>`).join(''))}</tr><tr><th scope="row">천장 높이</th>${cell(x=>x.r.modules.map(id=>{const m=catalog.modules.find(m=>m.id===id);return `<div>${esc(m?.name||id)}: ${Number.isFinite(m?.height)?`${m.height.toFixed(2)}m`:'미확인'}</div>`}).join(''))}</tr><tr><th scope="row">배치 외곽</th>${cell(x=>x.size.extent?`${x.size.extent.length.toFixed(2)} × ${x.size.extent.width.toFixed(2)}m · ${x.size.extent.area.toFixed(2)}㎡${x.size.unknown.length?' (일부 미확인)':''}`:'미확인')}</tr></tbody></table></div><p class="small">배치 외곽은 저장한 본체 위치의 경계 사각형입니다. 커넥터·가이라인 설치 여유는 치수가 확인되지 않으면 포함하지 않습니다.</p>`;
}
function renderEvidence(){
  $('specs').innerHTML=`<div class="ledger"><table><thead><tr><th>제품</th><th>외곽 치수 / 면적</th><th>중량</th><th>원단 / 플라이</th><th>상태·출처</th></tr></thead><tbody>${catalog.specs.map(s=>{const p=catalog.products.find(x=>x.id===s.product);return `<tr><td><strong>${esc(p?.brand)} ${esc(p?.name)}</strong><br><span class="small">${p?.primary?'주요 후보':'추가 등록'}</span></td><td>${esc(s.dimensions)}<br>${esc(s.area)}</td><td>${esc(s.weight)}</td><td>${esc(s.fabric)}<br>${esc(s.fly)}</td><td><span class="badge ${s.status==='충돌'?'conflict':s.status.includes('미확인')?'uncertain':''}">${esc(s.status)}</span><br>${sourceLink(s.source)} · ${esc(s.locator)}</td></tr>`}).join('')}</tbody></table></div>`;
  $('verification').innerHTML=`<div class="ledger"><table><thead><tr><th>ID</th><th>상태</th><th>내용</th><th>확인 필요</th></tr></thead><tbody>${catalog.verification.map(v=>`<tr><td>${v.id}</td><td><span class="badge ${v.status==='충돌'?'conflict':'uncertain'}">${v.status}</span></td><td>${esc(v.issue)}</td><td>${esc(v.needed)}</td></tr>`).join('')}</tbody></table></div>`;
  $('provenance').innerHTML=`<div class="ledger"><table><thead><tr><th>대상</th><th>채택값</th><th>채택 근거/조건</th><th>원본 위치</th></tr></thead><tbody>${catalog.adoptions.map(a=>{const c=catalog.claims.find(x=>x.id===a.claimId);return `<tr><td>${esc(a.subject)}</td><td>${won(c?.value)}</td><td>${esc(a.reason)}<br>${esc(a.condition)}</td><td>${sourceLink(c?.source)} · ${esc(c?.locator)}</td></tr>`}).join('')}</tbody></table></div>`;
}
function render(){renderControls();renderResult();renderSaved()}
$('save').onclick=()=>{const r=evaluate(scenario);if(r.errors.length){$('saveMsg').textContent='조합 오류를 먼저 해결해 주세요.';return}saved.push(structuredClone(withAutoName(scenario)));$('saveMsg').textContent=persist()?'저장했습니다.':'브라우저 저장소에 기록하지 못했습니다.';renderSaved()};
$('clear').onclick=()=>{scenario={name:'',packages:[],options:{}};render()};
$('export').onclick=()=>{const blob=new Blob([encodeScenarioFile(scenario,saved)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='tent-scenarios.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('shareMsg').textContent='조합 파일을 내려받았습니다.'};
$('import').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1_000_000)throw new Error('파일이 너무 큽니다.');const data=decodeScenarioFile(await file.text(),catalog);saved.push(...data.saved.map(withAutoName));if(data.current)scenario=withAutoName(data.current);if(!persist())throw new Error('브라우저 저장소에 기록하지 못했습니다.');$('shareMsg').textContent=`${data.saved.length}개 저장 조합을 가져왔습니다.`;render()}catch(error){$('shareMsg').textContent=`가져오기 실패: ${error.message}`}finally{e.target.value=''}};
renderEvidence();render();

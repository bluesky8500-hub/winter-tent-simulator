import {evaluate,won,compareQuote,configureCatalog} from './engine.js';
import {encodeScenarioFile,decodeScenarioFile} from './scenario-file.js';

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
let scenario={name:'새 조합',packages:['campBase'],options:{}};
let saved=readSaved();
function readSaved(){try{const x=JSON.parse(localStorage.getItem('tent-scenarios-v1')||'[]');return Array.isArray(x)?x:[]}catch{return []}}
function persist(){try{localStorage.setItem('tent-scenarios-v1',JSON.stringify(saved));return true}catch{return false}}
function sourceLink(id){const s=catalog.sources[id];return esc(s?.label||id||'출처 미확인')}
function optionAvailable(o){const p=scenario.packages;const moduleIds=p.flatMap(id=>catalog.packages.find(x=>x.id===id)?.modules||[]);return o.target==='coodyDock'?p.includes('hubBase')&&p.includes('coody10Base'):o.target==='coody8Dock'?p.includes('coody8Base')&&p.length>1:o.target==='coodyProStandard'?p.some(id=>['familiaBase','hubBase','coody10Base'].includes(id)):o.target==='coodyPro'||o.target==='coodyAccessory'?p.some(id=>['familiaBase','hubBase','coody10Base','coody8Base'].includes(id)):o.target==='airnokShared'?p.some(id=>['happyBase','airnok6Base','airnok8Base'].includes(id)):['happy','happyBase'].includes(o.target)?p.includes('happyBase'):moduleIds.includes(o.target)}
function renderControls(){
  $('scenarioName').value=scenario.name;
  $('presets').innerHTML=presets.map((p,i)=>`<button data-preset="${i}">${esc(p.name)}</button>`).join('');
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const p=presets[Number(b.dataset.preset)];scenario={name:p.name,packages:[...p.packages],options:{...p.options}};render()});
  $('packages').innerHTML=catalog.packages.map(p=>{const product=catalog.products.find(x=>x.id===catalog.modules.find(m=>m.id===p.modules[0])?.product);return `<div class="choice"><label><input type="checkbox" data-package="${p.id}" ${scenario.packages.includes(p.id)?'checked':''}> <span>${esc(p.name)} <small>${product?.primary?'주요 후보':'추가 등록'}</small></span></label></div>`}).join('');
  document.querySelectorAll('[data-package]').forEach(x=>x.onchange=()=>{scenario.packages=x.checked?[...scenario.packages,x.dataset.package]:scenario.packages.filter(id=>id!==x.dataset.package);for(const o of catalog.options.filter(x=>x.kind==='paid'||x.kind==='replacement'))if(!optionAvailable(o))delete scenario.options[o.id];render()});
  const available=catalog.options.filter(o=>(o.kind==='paid'||o.kind==='replacement')&&optionAvailable(o));
  $('options').innerHTML=(scenario.packages.includes('airnok8Base')?`<div class="choice"><label>8.0T 색상 <select data-color><option value="" ${!scenario.color?'selected':''}>미선택</option><option value="베이지" ${scenario.color==='베이지'?'selected':''}>베이지</option><option value="그레이카키" ${scenario.color==='그레이카키'?'selected':''}>그레이카키</option></select></label></div>`:'')+(available.length?available.map(o=>{const qty=scenario.options[o.id]||0;const adoption=catalog.adoptions.find(a=>a.subject===o.id&&a.field==='price');const claim=catalog.claims.find(c=>c.id===adoption?.claimId);return `<div class="choice"><div><strong>${esc(o.name)}</strong><br><small>${won(claim?.value)}${o.condition?' · '+esc(o.condition):''}</small></div><select aria-label="${esc(o.name)} 수량" data-option="${o.id}">${Array.from({length:o.max+1},(_,i)=>`<option value="${i}" ${qty===i?'selected':''}>${i}개</option>`).join('')}</select></div>`}).join(''):'<p class="small">제품을 선택하면 적용 가능한 옵션이 표시됩니다.</p>')+(scenario.packages.includes('happyBase')?`<div class="choice"><label>추가 정면 TPU 적용 대상 <select data-front-target><option value="">선택 안 함</option><option value="st" ${scenario.frontTpuTarget==='st'?'selected':''}>10.0ST 침실텐트</option></select></label></div>`:'');
  document.querySelector('[data-color]')?.addEventListener('change',e=>{scenario.color=e.target.value;if(scenario.color==='베이지')delete scenario.options.airnok8SideTpu;render()});
  document.querySelector('[data-front-target]')?.addEventListener('change',e=>{scenario.frontTpuTarget=e.target.value;render()});
  document.querySelectorAll('[data-option]').forEach(x=>x.onchange=()=>{const id=x.dataset.option;const n=Number(x.value);if(n)scenario.options[id]=n;else delete scenario.options[id];render()});
}
function renderResult(){
  const r=evaluate(scenario);
  const rows=r.lines.map(x=>`<div class="row"><span>${esc(x.category)} · ${esc(x.name)}${x.quantity>1?' × '+x.quantity:''}<br><small class="muted">${esc(x.source||'확인 필요')}</small></span><strong>${x.status==='정보 없음'?'별도 기록 없음':won(x.amount)}</strong></div>`).join('');
  const included=scenario.packages.flatMap(id=>catalog.packages.find(x=>x.id===id)?.included||[]).filter(id=>!(id==='tarpFrontTpuIncluded'&&scenario.options.skySwap)).map(id=>catalog.options.find(x=>x.id===id)).filter(Boolean);
  const gifts=[...scenario.packages.flatMap(id=>catalog.packages.find(x=>x.id===id)?.gifts||[]),...(scenario.packages.includes('airnok8Base')&&scenario.color==='베이지'?['airnok8BeigeFly','airnok8BeigeSideTpu']:[])].map(id=>catalog.options.find(x=>x.id===id)).filter(Boolean);
  if(scenario.packages.includes('airnok8Base')&&scenario.color==='그레이카키') included.push(catalog.options.find(x=>x.id==='airnok8GrayFly'));
  $('result').innerHTML=`<span class="badge ${r.total==null?'uncertain':''}">${r.total==null?'최종 총액 미확인':'최종 총액 확인'}</span><div class="money ${r.total==null?'unknown':''}">${won(r.total)}</div><div class="row subtotal"><span>확인된 항목 소계</span><strong>${won(r.knownSubtotal)}</strong></div>${rows}<div class="label">기본 포함품</div><p class="small">${included.length?included.map(x=>`${esc(x.name)}${x.quantity?' '+x.quantity+'개':''}`).join(' · '):'기록된 항목 없음'}</p><div class="label">판매 당시 사은품</div><p class="small">${gifts.length?gifts.map(x=>`${esc(x.name)}${x.quantity?' '+x.quantity+'개':''} (행사 적용 확인 필요)`).join(' · '):'기록된 항목 없음'}</p><div class="warning-list">${[...r.errors.map(x=>'오류: '+x),...r.warnings].map(x=>`<div>• ${esc(x)}</div>`).join('')||'확인할 경고 없음'}</div>`;
  $('docking').innerHTML=`<span class="badge ${r.docking.status==='확정'?'':'uncertain'}">${esc(r.docking.status)}</span><p class="small">${esc(r.docking.note||'선택된 모듈에 대한 도킹 규칙 없음')}<br>도킹 호환성과 사이트 설치 적합성은 별도로 판단합니다.</p>`;
  if(r.layout.footprint){const f=r.layout.footprint;$('layout').innerHTML=`<span class="badge">본체 외곽 기준 ${r.layout.bodyFit?'치수상 들어감':'치수상 초과'}</span><div class="site"><div class="tent" style="width:${f.length/10*100}%;height:${f.width/7*100}%">${esc(f.length)} × ${esc(f.width)}m</div></div><p class="small">${esc(f.status||'본체 치수')} · 남는 길이 합계 ${r.layout.remaining.length.toFixed(2)}m · 폭 합계 ${r.layout.remaining.width.toFixed(2)}m. 한쪽 여유가 아닙니다.</p>${r.layout.rearClearance?'<p class="small">그레이카키 풀플라이 후면 설치 추가공간 1.0m가 필요합니다.</p>':''}<p class="small">미확인: ${esc(r.layout.unknown.join(' · '))}. 설치 가능 판정은 보류합니다.</p>`}
  else $('layout').innerHTML=`<span class="badge uncertain">조합 외곽 미확인</span><p class="small">확인된 개별 본체: ${r.layout.individual.map(x=>`${esc(x.name)} ${x.length} × ${x.width}m`).join(' / ')||'없음'}</p><p class="small">도킹 전체 외곽과 가이라인·차량·동선이 확인되지 않아 합성 배치도를 만들지 않습니다.</p>`;
}
function renderSaved(){
  $('saved').innerHTML=saved.length?`<div class="saved-grid">${saved.map((s,i)=>{const r=evaluate(s);return `<div class="saved-card"><h3>${esc(s.name)}</h3><div class="small">${esc(s.packages.map(id=>catalog.packages.find(x=>x.id===id)?.name||id).join(' + '))}</div><div class="money" style="font-size:21px">${won(r.total)}</div><div class="small">확인 소계 ${won(r.knownSubtotal)} · 도킹 ${esc(r.docking.status)} · 배치 ${esc(r.layout.status)}</div><button data-load="${i}">불러오기</button><button data-delete="${i}">삭제</button></div>`}).join('')}</div>`:'<p class="small">저장한 조합이 없습니다. 현재 조합을 저장하면 나란히 비교할 수 있습니다.</p>';
  document.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{scenario=structuredClone(saved[Number(b.dataset.load)]);render();window.scrollTo({top:0,behavior:'smooth'})});
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{saved.splice(Number(b.dataset.delete),1);persist();renderSaved()});
}
function renderEvidence(){
  $('specs').innerHTML=`<div class="ledger"><table><thead><tr><th>제품</th><th>외곽 치수 / 면적</th><th>중량</th><th>원단 / 플라이</th><th>상태·출처</th></tr></thead><tbody>${catalog.specs.map(s=>{const p=catalog.products.find(x=>x.id===s.product);return `<tr><td><strong>${esc(p?.brand)} ${esc(p?.name)}</strong><br><span class="small">${p?.primary?'주요 후보':'추가 등록'}</span></td><td>${esc(s.dimensions)}<br>${esc(s.area)}</td><td>${esc(s.weight)}</td><td>${esc(s.fabric)}<br>${esc(s.fly)}</td><td><span class="badge ${s.status==='충돌'?'conflict':s.status.includes('미확인')?'uncertain':''}">${esc(s.status)}</span><br>${sourceLink(s.source)} · ${esc(s.locator)}</td></tr>`}).join('')}</tbody></table></div>`;
  $('verification').innerHTML=`<div class="ledger"><table><thead><tr><th>ID</th><th>상태</th><th>내용</th><th>확인 필요</th></tr></thead><tbody>${catalog.verification.map(v=>`<tr><td>${v.id}</td><td><span class="badge ${v.status==='충돌'?'conflict':'uncertain'}">${v.status}</span></td><td>${esc(v.issue)}</td><td>${esc(v.needed)}</td></tr>`).join('')}</tbody></table></div>`;
  $('provenance').innerHTML=`<div class="ledger"><table><thead><tr><th>대상</th><th>채택값</th><th>채택 근거/조건</th><th>원본 위치</th></tr></thead><tbody>${catalog.adoptions.map(a=>{const c=catalog.claims.find(x=>x.id===a.claimId);return `<tr><td>${esc(a.subject)}</td><td>${won(c?.value)}</td><td>${esc(a.reason)}<br>${esc(a.condition)}</td><td>${sourceLink(c?.source)} · ${esc(c?.locator)}</td></tr>`}).join('')}</tbody></table></div>`;
}
function render(){renderControls();renderResult();renderSaved()}
$('scenarioName').oninput=e=>scenario.name=e.target.value;
$('save').onclick=()=>{const r=evaluate(scenario);if(r.errors.length){$('saveMsg').textContent='조합 오류를 먼저 해결해 주세요.';return}saved.push(structuredClone({...scenario,name:scenario.name.trim()||'이름 없는 조합'}));$('saveMsg').textContent=persist()?'저장했습니다.':'브라우저 저장소에 기록하지 못했습니다.';renderSaved()};
$('clear').onclick=()=>{scenario={name:'새 조합',packages:[],options:{}};render()};
$('export').onclick=()=>{const blob=new Blob([encodeScenarioFile(scenario,saved)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='tent-scenarios.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('shareMsg').textContent='조합 파일을 내려받았습니다.'};
$('import').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1_000_000)throw new Error('파일이 너무 큽니다.');const data=decodeScenarioFile(await file.text(),catalog);saved.push(...data.saved);if(data.current)scenario=data.current;if(!persist())throw new Error('브라우저 저장소에 기록하지 못했습니다.');$('shareMsg').textContent=`${data.saved.length}개 저장 조합을 가져왔습니다.`;render()}catch(error){$('shareMsg').textContent=`가져오기 실패: ${error.message}`}finally{e.target.value=''}};
renderEvidence();render();

const SITE={length:10,width:7};
const round=value=>Math.round(value*100)/100;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function getPlacedBox(module,placement={}){
  const rotated=Boolean(placement.rotated);
  return {
    id:module.id,
    x:Number(placement.x)||0,
    y:Number(placement.y)||0,
    length:rotated?module.width:module.length,
    width:rotated?module.length:module.width,
    rotated
  };
}

export function edgeClearance(box,site=SITE){
  return {left:round(box.x),right:round(site.length-box.x-box.length),top:round(box.y),bottom:round(site.width-box.y-box.width)};
}

export function boxesOverlap(a,b){
  return a.x<b.x+b.length&&a.x+a.length>b.x&&a.y<b.y+b.width&&a.y+a.width>b.y;
}

export function arrangementSummary(moduleIds,catalog,scenario){
  const modules=moduleIds.map(id=>catalog.modules.find(x=>x.id===id));
  const unknown=modules.filter(x=>!Number.isFinite(x?.width)||!Number.isFinite(x?.length)).map(x=>x?.name||'미등록 모듈');
  const known=modules.filter(x=>Number.isFinite(x?.width)&&Number.isFinite(x?.length));
  const defaults=autoPositions(known);
  const boxes=known.map(x=>getPlacedBox(x,scenario.fitPositions?.[x.id]||defaults[x.id]));
  if(!boxes.length)return {boxes,unknown,extent:null,overlap:false};
  const minX=Math.min(...boxes.map(x=>x.x)),minY=Math.min(...boxes.map(x=>x.y));
  const maxX=Math.max(...boxes.map(x=>x.x+x.length)),maxY=Math.max(...boxes.map(x=>x.y+x.width));
  return {boxes,unknown,extent:{length:round(maxX-minX),width:round(maxY-minY),area:round((maxX-minX)*(maxY-minY)),fits:maxX<=SITE.length&&maxY<=SITE.width},overlap:boxes.some((box,i)=>boxes.slice(i+1).some(other=>boxesOverlap(box,other)))};
}

function autoPositions(modules){
  const positions={};let x=.2,y=.2,rowHeight=0;
  for(const module of modules){
    const length=module.length,width=module.width;
    if(x+length>SITE.length&&x>.2){x=.2;y+=rowHeight+.2;rowHeight=0}
    positions[module.id]={x:round(clamp(x,0,Math.max(0,SITE.length-length))),y:round(clamp(y,0,Math.max(0,SITE.width-width))),rotated:false};
    x+=length+.2;rowHeight=Math.max(rowHeight,width);
  }
  return positions;
}

export function renderFitBoard(container,moduleIds,catalog,scenario,onChange=()=>{}){
  const modules=moduleIds.map(id=>catalog.modules.find(module=>module.id===id)).filter(module=>Number.isFinite(module?.width)&&Number.isFinite(module?.length));
  const unknown=moduleIds.map(id=>catalog.modules.find(module=>module.id===id)).filter(module=>module&&(!Number.isFinite(module.width)||!Number.isFinite(module.length)));
  if(!modules.length){
    container.innerHTML=`<span class="badge uncertain">배치할 확인 치수 없음</span><p class="small">${unknown.length?esc(unknown.map(x=>x.name).join(' · '))+'의 본체 외곽 치수가 확인되지 않았습니다.':'제품을 선택하면 본체를 배치할 수 있습니다.'}</p>`;
    return;
  }
  scenario.fitPositions??={};
  const defaults=autoPositions(modules);
  const connectors=Object.keys(scenario.options||{}).filter(id=>scenario.options[id]>0&&/connector/i.test(id));
  scenario.connectorPositions??={};
  for(const id of connectors)scenario.connectorPositions[id]??={x:5,y:3.5};
  for(const module of modules){
    const current=scenario.fitPositions[module.id]||defaults[module.id];
    const box=getPlacedBox(module,current);
    scenario.fitPositions[module.id]={
      x:round(clamp(box.x,0,Math.max(0,SITE.length-box.length))),
      y:round(clamp(box.y,0,Math.max(0,SITE.width-box.width))),
      rotated:box.rotated
    };
  }
  let selected=scenario.fitSelected&&modules.some(x=>x.id===scenario.fitSelected)?scenario.fitSelected:modules[0].id;
  scenario.fitSelected=selected;
  container.innerHTML=`<div class="fit-toolbar"><span class="badge">모듈 위치 정하기</span><div><button class="ghost" type="button" data-fit-rotate>90° 회전</button><button class="ghost" type="button" data-fit-reset>초기 배치</button></div></div><div class="fit-site" data-fit-site aria-label="10m × 7m 텐트 배치판">${modules.map((module,index)=>`<button type="button" class="fit-tent" data-fit-id="${esc(module.id)}" style="--fit-color:${index%6}" aria-label="${esc(module.name)} 이동"><span>${esc(module.name)}</span><small></small></button>`).join('')}${connectors.map(id=>`<button type="button" class="fit-connector" data-connector-id="${esc(id)}" aria-label="${esc(catalog.options.find(x=>x.id===id)?.name||id)} 위치 이동">연결</button>`).join('')}</div><div class="fit-readout" data-fit-readout></div><p class="small fit-help">본체와 커넥터 표시를 움직여 위치를 정하세요. 커넥터는 아래에서 연결할 두 모듈을 선택합니다. 치수가 확인되지 않은 커넥터 표시는 면적에 합산하지 않습니다.</p>${unknown.length?`<p class="small">치수 미확인으로 제외: ${esc(unknown.map(x=>x.name).join(' · '))}</p>`:''}`;
  const site=container.querySelector('[data-fit-site]');
  const readout=container.querySelector('[data-fit-readout]');
  const elements=new Map([...container.querySelectorAll('[data-fit-id]')].map(element=>[element.dataset.fitId,element]));
  const refresh=()=>{
    const boxes=modules.map(module=>getPlacedBox(module,scenario.fitPositions[module.id]));
    const overlaps=new Set();
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(boxesOverlap(boxes[i],boxes[j])){overlaps.add(boxes[i].id);overlaps.add(boxes[j].id)}
    for(const box of boxes){
      const element=elements.get(box.id);const module=modules.find(x=>x.id===box.id);
      element.style.left=`${box.x/SITE.length*100}%`;element.style.top=`${box.y/SITE.width*100}%`;element.style.width=`${box.length/SITE.length*100}%`;element.style.height=`${box.width/SITE.width*100}%`;
      element.classList.toggle('selected',box.id===selected);element.classList.toggle('overlap',overlaps.has(box.id));
      element.querySelector('small').textContent=`${box.length} × ${box.width}m`;
      element.setAttribute('aria-pressed',String(box.id===selected));
    }
    for(const id of connectors){const marker=container.querySelector(`[data-connector-id="${id}"]`),p=scenario.connectorPositions[id];marker.style.left=`${p.x/SITE.length*100}%`;marker.style.top=`${p.y/SITE.width*100}%`}
    const box=boxes.find(x=>x.id===selected);const module=modules.find(x=>x.id===selected);const gap=edgeClearance(box);
    readout.innerHTML=`<strong>${esc(module.name)}</strong><div class="fit-gaps"><span>왼쪽 <b>${gap.left.toFixed(2)}m</b></span><span>오른쪽 <b>${gap.right.toFixed(2)}m</b></span><span>위 <b>${gap.top.toFixed(2)}m</b></span><span>아래 <b>${gap.bottom.toFixed(2)}m</b></span></div>${overlaps.size?'<div class="fit-alert">텐트 본체가 서로 겹쳐 있습니다.</div>':'<div class="fit-ok">현재 본체끼리 겹치지 않습니다.</div>'}`;
  };
  const select=id=>{selected=id;scenario.fitSelected=id;refresh()};
  for(const [id,element] of elements){
    element.addEventListener('pointerdown',event=>{
      event.preventDefault();select(id);element.setPointerCapture(event.pointerId);
      const start={clientX:event.clientX,clientY:event.clientY,...scenario.fitPositions[id]};
      const move=moveEvent=>{
        const rect=site.getBoundingClientRect();const module=modules.find(x=>x.id===id);const box=getPlacedBox(module,start);
        scenario.fitPositions[id]={x:round(clamp(start.x+(moveEvent.clientX-start.clientX)/rect.width*SITE.length,0,SITE.length-box.length)),y:round(clamp(start.y+(moveEvent.clientY-start.clientY)/rect.height*SITE.width,0,SITE.width-box.width)),rotated:start.rotated};refresh();onChange();
      };
      const end=()=>{element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',end);element.removeEventListener('pointercancel',end)};
      element.addEventListener('pointermove',move);element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);
    });
    element.addEventListener('click',()=>select(id));
  }
  for(const marker of container.querySelectorAll('[data-connector-id]'))marker.addEventListener('pointerdown',event=>{
    event.preventDefault();marker.setPointerCapture(event.pointerId);const id=marker.dataset.connectorId,start={clientX:event.clientX,clientY:event.clientY,...scenario.connectorPositions[id]};
    const move=e=>{const rect=site.getBoundingClientRect();scenario.connectorPositions[id]={x:round(clamp(start.x+(e.clientX-start.clientX)/rect.width*SITE.length,0,SITE.length)),y:round(clamp(start.y+(e.clientY-start.clientY)/rect.height*SITE.width,0,SITE.width))};refresh();onChange()};
    const end=()=>{marker.removeEventListener('pointermove',move);marker.removeEventListener('pointerup',end);marker.removeEventListener('pointercancel',end)};
    marker.addEventListener('pointermove',move);marker.addEventListener('pointerup',end);marker.addEventListener('pointercancel',end);
  });
  container.querySelector('[data-fit-rotate]').onclick=()=>{
    const module=modules.find(x=>x.id===selected);const current=scenario.fitPositions[selected];current.rotated=!current.rotated;const box=getPlacedBox(module,current);current.x=round(clamp(current.x,0,Math.max(0,SITE.length-box.length)));current.y=round(clamp(current.y,0,Math.max(0,SITE.width-box.width)));refresh();onChange();
  };
  container.querySelector('[data-fit-reset]').onclick=()=>{const reset=autoPositions(modules);for(const module of modules)scenario.fitPositions[module.id]=reset[module.id];refresh();onChange()};
  refresh();
}

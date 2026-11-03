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

export function connectorIds(scenario,catalog){
  return [...new Set([...scenario.packages.flatMap(id=>catalog.packages.find(p=>p.id===id)?.modules||[]).filter(id=>/connector/i.test(id)),...Object.keys(scenario.options||{}).filter(id=>scenario.options[id]>0&&/connector/i.test(id))])];
}

export function moveGroup(boxes,dx,dy,site=SITE){
  if(!boxes.length)return [];
  const minX=Math.min(...boxes.map(box=>box.x)),maxX=Math.max(...boxes.map(box=>box.x+box.length));
  const minY=Math.min(...boxes.map(box=>box.y)),maxY=Math.max(...boxes.map(box=>box.y+box.width));
  const shiftX=round(clamp(dx,-minX,site.length-maxX));
  const shiftY=round(clamp(dy,-minY,site.width-maxY));
  return boxes.map(box=>({...box,x:round(box.x+shiftX),y:round(box.y+shiftY)}));
}

export function connectorContact(a,b,depth=null){
  if(!a||!b)return null;
  const xGap=Math.max(a.x,b.x)-Math.min(a.x+a.length,b.x+b.length);
  const yGap=Math.max(a.y,b.y)-Math.min(a.y+a.width,b.y+b.width);
  const horizontal=xGap>=0&&yGap<0;
  const vertical=yGap>=0&&xGap<0;
  if((!horizontal&&!vertical)||(horizontal?xGap:yGap)>(depth??0.15)+0.05)return null;
  const first=horizontal?(a.x<b.x?a:b):(a.y<b.y?a:b);
  const second=first===a?b:a;
  const start=horizontal?Math.max(a.y,b.y):Math.max(a.x,b.x);
  const end=horizontal?Math.min(a.y+a.width,b.y+b.width):Math.min(a.x+a.length,b.x+b.length);
  if(end<=start)return null;
  const near=horizontal?first.x+first.length:first.y+first.width;
  const far=horizontal?second.x:second.y;
  const center=(near+far)/2;
  const thickness=depth??0.04;
  return horizontal?{x:round(center-thickness/2),y:round(start),length:thickness,width:round(end-start),contact:round(end-start),depth}:{x:round(start),y:round(center-thickness/2),length:round(end-start),width:thickness,contact:round(end-start),depth};
}

function connectorPreview(a,b,depth){
  if(!a||!b)return null;
  const horizontal=Math.abs(a.x+a.length/2-b.x-b.length/2)>=Math.abs(a.y+a.width/2-b.y-b.width/2);
  const thickness=depth??0.04;
  if(horizontal){
    const start=Math.max(a.y,b.y),end=Math.min(a.y+a.width,b.y+b.width);
    if(end<=start)return null;
    const edge=a.x<b.x?a.x+a.length:a.x;
    return {x:round(edge-thickness/2),y:round(start),length:thickness,width:round(end-start),contact:round(end-start),depth};
  }
  const start=Math.max(a.x,b.x),end=Math.min(a.x+a.length,b.x+b.length);
  if(end<=start)return null;
  const edge=a.y<b.y?a.y+a.width:a.y;
  return {x:round(start),y:round(edge-thickness/2),length:round(end-start),width:thickness,contact:round(end-start),depth};
}

function connectorPlaceholder(box,depth){
  if(!box)return null;
  const thickness=depth??0.04;
  return {x:round(Math.min(SITE.length-thickness,box.x+box.length)),y:box.y,length:thickness,width:box.width,contact:box.width,depth};
}

const dockingAxis=(rule,scenario)=>{
  const directionPlacement=scenario.fitPositions?.[rule.directionModule]||{};
  const rotated=Boolean(directionPlacement.rotated);
  return rule.directions?.includes('side')?(rotated?'x':'y'):(rotated?'y':'x');
};

export function dockingGap(rule,scenario){
  return Number(scenario.options?.[rule.connector])>0&&Number.isFinite(rule.connectorGap)?rule.connectorGap:rule.directGap;
}

export function snapDockingPlacement(movingId,moduleIds,catalog,scenario,threshold=.35){
  const present=new Set(moduleIds);
  const moduleById=id=>catalog.modules.find(module=>module.id===id);
  const candidates=[];
  for(const rule of catalog.dockingRules.filter(item=>item.status==='확정'&&item.modules.includes(movingId)&&item.modules.every(id=>present.has(id))&&Number.isFinite(item.directGap))){
    if(rule.connectorRequirement==='required'&&!scenario.options?.[rule.connector])continue;
    const otherId=rule.modules.find(id=>id!==movingId),movingModule=moduleById(movingId),otherModule=moduleById(otherId);
    if(!movingModule||!otherModule||!scenario.fitPositions?.[movingId]||!scenario.fitPositions?.[otherId])continue;
    const moving=getPlacedBox(movingModule,scenario.fitPositions[movingId]),other=getPlacedBox(otherModule,scenario.fitPositions[otherId]);
    const gap=dockingGap(rule,scenario),axis=dockingAxis(rule,scenario);
    const placements=axis==='x'?
      [{x:other.x-moving.length-gap,y:other.y+(other.width-moving.width)/2},{x:other.x+other.length+gap,y:other.y+(other.width-moving.width)/2}]:
      [{x:other.x+(other.length-moving.length)/2,y:other.y-moving.width-gap},{x:other.x+(other.length-moving.length)/2,y:other.y+other.width+gap}];
    for(const placement of placements){
      const x=round(clamp(placement.x,0,SITE.length-moving.length)),y=round(clamp(placement.y,0,SITE.width-moving.width));
      candidates.push({rule,otherId,gap,axis,position:{x,y,rotated:moving.rotated},distance:Math.hypot(x-moving.x,y-moving.y)});
    }
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  return candidates[0]?.distance<=threshold?candidates[0]:null;
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
  for(const [index,module] of modules.entries()){
    const length=module.length,width=module.width;
    if(x+length>SITE.length&&x>.2){x=.2;y+=rowHeight+.2;rowHeight=0}
    positions[module.id]={x:round(clamp(x,0,Math.max(0,SITE.length-length))),y:round(clamp(y,0,Math.max(0,SITE.width-width))),rotated:false};
    x+=length+(/connector/i.test(module.id)||/connector/i.test(modules[index+1]?.id||'')?0:.2);rowHeight=Math.max(rowHeight,width);
  }
  return positions;
}

export function renderFitBoard(container,moduleIds,catalog,scenario,onChange=()=>{},{group=false}={}){
  const modules=moduleIds.map(id=>catalog.modules.find(module=>module.id===id)).filter(module=>Number.isFinite(module?.width)&&Number.isFinite(module?.length));
  const unknown=moduleIds.map(id=>catalog.modules.find(module=>module.id===id)).filter(module=>module&&(!Number.isFinite(module.width)||!Number.isFinite(module.length)));
  if(!modules.length){
    container.innerHTML=`<span class="badge uncertain">배치할 확인 치수 없음</span><p class="small">${unknown.length?esc(unknown.map(x=>x.name).join(' · '))+'의 본체 외곽 치수가 확인되지 않았습니다.':'제품을 선택하면 본체를 배치할 수 있습니다.'}</p>`;
    return;
  }
  scenario.fitPositions??={};
  const defaultOrder=[...modules];
  const includedConnector=defaultOrder.find(module=>/connector/i.test(module.id));
  if(includedConnector){const index=defaultOrder.indexOf(includedConnector);defaultOrder.splice(index,1);defaultOrder.splice(1,0,includedConnector)}
  const defaults=autoPositions(defaultOrder);
  const connectors=connectorIds(scenario,catalog).filter(id=>!modules.some(module=>module.id===id));
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
  container.innerHTML=`<div class="fit-toolbar"><span class="badge">${group?'조합 전체 이동':'모듈 위치 정하기'}</span>${group?'':`<div><button class="ghost" type="button" data-fit-rotate>90° 회전</button><button class="ghost" type="button" data-fit-reset>초기 배치</button></div>`}</div><div class="fit-site" data-fit-site aria-label="10m × 7m 텐트 배치판">${modules.map((module,index)=>`<button type="button" class="fit-tent ${/connector/i.test(module.id)?'fit-connector-module':''}" data-fit-id="${esc(module.id)}" style="--fit-color:${index%6}" aria-label="${esc(module.name)} ${group?'조합 이동':'이동'}"><span>${esc(module.name)}</span><small></small></button>`).join('')}${connectors.map(id=>`<div class="fit-connector-contact" data-connector-id="${esc(id)}"></div>`).join('')}</div><div class="fit-readout" data-fit-readout></div>${group?'':'<div class="docking-guide" data-docking-guide></div>'}<p class="small fit-help">${group?'배치 전체를 드래그해 위치를 옮기세요. 01에서 모듈별 위치와 방향을 조정할 수 있습니다.':'모듈을 움직여 위치를 정하세요. 확인된 도킹 변 가까이에 놓으면 올바른 접촉 위치로 맞춰집니다.'}</p>${unknown.length?`<p class="small">치수 미확인으로 제외: ${esc(unknown.map(x=>x.name).join(' · '))}</p>`:''}`;
  const site=container.querySelector('[data-fit-site]');
  const readout=container.querySelector('[data-fit-readout]');
  const dockingGuide=container.querySelector('[data-docking-guide]');
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
    const contactNotes=[];
    for(const id of connectors){
      const marker=container.querySelector(`[data-connector-id="${id}"]`);
      const rule=catalog.dockingRules.find(rule=>rule.connector===id&&rule.modules.every(moduleId=>boxes.some(box=>box.id===moduleId)));
      const pair=scenario.connectorLinks?.[id]?.every(Boolean)?scenario.connectorLinks[id]:rule?.modules||[];
      const depth=id==='airnok8Connector'?0.6:['proConnector','coody8Connector'].includes(id)?0.1:null;
      const first=boxes.find(x=>x.id===pair[0]),second=boxes.find(x=>x.id===pair[1]);
      const contact=connectorContact(first,second,depth);
      const preview=connectorPreview(first,second,depth);
      const shown=contact||preview||connectorPlaceholder(first||boxes[0],depth);
      marker.hidden=!shown;
      if(shown){marker.style.left=`${shown.x/SITE.length*100}%`;marker.style.top=`${shown.y/SITE.width*100}%`;marker.style.width=`${shown.length/SITE.length*100}%`;marker.style.height=`${shown.width/SITE.width*100}%`;marker.title=`${catalog.options.find(x=>x.id===id)?.name||id} · ${contact?'연결 위치':'연결 위치 확인 필요'}`;marker.classList.toggle('unplaced',!contact)}
      contactNotes.push(`${esc(catalog.options.find(x=>x.id===id)?.name||id)}: ${contact?`맞닿는 면 ${round(contact.contact).toFixed(2)}m · 연결 폭 ${depth==null?'미확인':'0.10m'}`:`연결 위치 확인 필요 · 폭 ${depth==null?'미확인':'0.10m'}`}`);
    }
    const box=boxes.find(x=>x.id===selected);const module=modules.find(x=>x.id===selected);const gap=edgeClearance(box);
    readout.innerHTML=`<strong>${esc(module.name)}</strong><div class="fit-gaps"><span>왼쪽 <b>${gap.left.toFixed(2)}m</b></span><span>오른쪽 <b>${gap.right.toFixed(2)}m</b></span><span>위 <b>${gap.top.toFixed(2)}m</b></span><span>아래 <b>${gap.bottom.toFixed(2)}m</b></span></div>${overlaps.size?'<div class="fit-alert">텐트 본체가 서로 겹쳐 있습니다.</div>':'<div class="fit-ok">현재 본체끼리 겹치지 않습니다.</div>'}${contactNotes.length?`<p class="small">${contactNotes.join('<br>')}</p>`:''}`;
    if(dockingGuide){const rules=catalog.dockingRules.filter(rule=>rule.modules.includes(selected));const directions={front:'전면',rear:'후면',side:'측면'};const requirements={required:'필수',optional:'선택',included:'기본 포함',unknown:'미확인'};dockingGuide.innerHTML=rules.length?`<strong>${esc(module.name)} 도킹 참고</strong>${rules.map(rule=>{const otherId=rule.modules.find(id=>id!==selected),other=catalog.modules.find(item=>item.id===otherId);const connector=catalog.options.find(item=>item.id===rule.connector)||catalog.modules.find(item=>item.id===rule.connector);const active=moduleIds.includes(otherId);const direction=rule.directions?.length?rule.directions.map(value=>directions[value]||value).join('·'):'방향 미확인';const requirement=requirements[rule.connectorRequirement]||'미확인';const effect=rule.connectorGap===.6?' · 사용 시 60cm 확장':'';const label=rule.status==='확정'?(active?'선택됨':'결합 가능'):'미확인';return `<div class="docking-guide-row ${rule.status==='확정'?'':'unknown'}"><span class="badge ${rule.status==='확정'?'':'uncertain'}">${label}</span><div><b>${esc(other?.name||otherId)}</b><small>${esc(direction)} · 커넥터 ${esc(requirement)}${connector?` (${esc(connector.name)})`:''}${effect}</small><small>${esc(rule.note)}</small></div></div>`}).join('')}`:'<strong>등록된 도킹 정보 없음</strong><p class="small">이 모듈과 결합 가능한 대상 정보가 아직 없습니다.</p>'}
  };
  const select=id=>{selected=id;scenario.fitSelected=id;refresh()};
  for(const [id,element] of elements){
    element.addEventListener('pointerdown',event=>{
      event.preventDefault();select(id);element.setPointerCapture(event.pointerId);
      const start={clientX:event.clientX,clientY:event.clientY,...scenario.fitPositions[id]};
      const groupStart=group?modules.map(module=>getPlacedBox(module,scenario.fitPositions[module.id])):null;
      const move=moveEvent=>{
        const rect=site.getBoundingClientRect();const module=modules.find(x=>x.id===id);const box=getPlacedBox(module,start);
        const dx=(moveEvent.clientX-start.clientX)/rect.width*SITE.length,dy=(moveEvent.clientY-start.clientY)/rect.height*SITE.width;
        if(group){for(const moved of moveGroup(groupStart,dx,dy))scenario.fitPositions[moved.id]={x:moved.x,y:moved.y,rotated:moved.rotated}}
        else scenario.fitPositions[id]={x:round(clamp(start.x+dx,0,SITE.length-box.length)),y:round(clamp(start.y+dy,0,SITE.width-box.width)),rotated:start.rotated};
        refresh();onChange(false);
      };
      const end=()=>{const snap=group?null:snapDockingPlacement(id,moduleIds,catalog,scenario);if(snap){scenario.fitPositions[id]=snap.position;if(snap.rule.connector&&scenario.options?.[snap.rule.connector]){scenario.connectorLinks??={};scenario.connectorPositions??={};scenario.connectorLinks[snap.rule.connector]=[id,snap.otherId];const moving=getPlacedBox(modules.find(x=>x.id===id),scenario.fitPositions[id]),other=getPlacedBox(modules.find(x=>x.id===snap.otherId),scenario.fitPositions[snap.otherId]);scenario.connectorPositions[snap.rule.connector]={x:round((Math.max(moving.x,other.x)+Math.min(moving.x+moving.length,other.x+other.length))/2),y:round((Math.max(moving.y,other.y)+Math.min(moving.y+moving.width,other.y+other.width))/2)}}refresh();onChange(true)}element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',end);element.removeEventListener('pointercancel',end)};
      element.addEventListener('pointermove',move);element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);
    });
    element.addEventListener('click',()=>select(id));
  }
  if(!group)container.querySelector('[data-fit-rotate]').onclick=()=>{
    const module=modules.find(x=>x.id===selected);const current=scenario.fitPositions[selected];current.rotated=!current.rotated;const box=getPlacedBox(module,current);current.x=round(clamp(current.x,0,Math.max(0,SITE.length-box.length)));current.y=round(clamp(current.y,0,Math.max(0,SITE.width-box.width)));refresh();onChange(true);
  };
  if(!group)container.querySelector('[data-fit-reset]').onclick=()=>{const reset=autoPositions(defaultOrder);for(const module of modules)scenario.fitPositions[module.id]=reset[module.id];refresh();onChange(true)};
  refresh();
}

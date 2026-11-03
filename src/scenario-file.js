const format='winter-tent-scenarios';
const version=1;

export function encodeScenarioFile(current,saved){
  return JSON.stringify({format,version,current,saved,exportedAt:new Date().toISOString()},null,2);
}

export function decodeScenarioFile(text,catalog){
  const data=JSON.parse(text);
  if(data?.format!==format||data.version!==version||!Array.isArray(data.saved)||data.saved.length>100)throw new Error('지원하지 않는 조합 파일입니다.');
  const packageIds=new Set(catalog.packages.map(x=>x.id));
  const options=new Map(catalog.options.map(x=>[x.id,x]));
  const clean=item=>{
    if(!item||typeof item!=='object'||!Array.isArray(item.packages)||!item.options||typeof item.options!=='object'||Array.isArray(item.options))throw new Error('조합 형식이 올바르지 않습니다.');
    if(item.packages.length>catalog.packages.length||item.packages.some(x=>!packageIds.has(x)))throw new Error('등록되지 않은 제품이 있습니다.');
    const selected={};
    for(const [id,qty] of Object.entries(item.options)){
      const option=options.get(id);
      if(!option||!Number.isInteger(qty)||qty<0||qty>option.max)throw new Error(`옵션 값이 올바르지 않습니다: ${id}`);
      if(qty)selected[id]=qty;
    }
    return {name:String(item.name??'이름 없는 조합').slice(0,60),packages:[...new Set(item.packages)],options:selected};
  };
  return {current:data.current?clean(data.current):null,saved:data.saved.map(clean)};
}

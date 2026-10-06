const absent=Symbol('absent');
const same=(a,b)=>a===absent||b===absent?a===b:JSON.stringify(a)===JSON.stringify(b);
const copy=value=>value===absent?absent:structuredClone(value);
const plain=value=>value!==absent&&value!==null&&typeof value==='object'&&!Array.isArray(value);
export function mergeEditorProject(base,current,draft,{history=false}={}){
 const visit=(before,now,next,path)=>{
  if(same(next,before)||same(now,next))return copy(now);
  if(same(now,before))return copy(next);
  if(plain(before)&&plain(now)&&plain(next)){
   const result=Object.create(null);for(const key of new Set([...Object.keys(before),...Object.keys(now),...Object.keys(next)])){
    const value=visit(Object.hasOwn(before,key)?before[key]:absent,Object.hasOwn(now,key)?now[key]:absent,Object.hasOwn(next,key)?next[key]:absent,path+'.'+key);
    if(value!==absent)result[key]=value;
   }return result;
  }
  if([before,now,next].every(value=>Array.isArray(value)&&value.every(item=>plain(item)&&typeof item.id==='string'&&item.id))){
   const maps=[before,now,next].map(list=>new Map(list.map(item=>[item.id,item])));
   if(maps.some((map,i)=>map.size!==[before,now,next][i].length))throw Error('列表标识重复：'+path);
   const values=new Map();for(const id of new Set([...maps[0].keys(),...maps[1].keys(),...maps[2].keys()])){
    const value=visit(...maps.map(map=>map.has(id)?map.get(id):absent),path+'['+id+']');if(value!==absent)values.set(id,value);
   }
   const oldOrder=before.map(x=>x.id),nowCommon=now.filter(x=>maps[0].has(x.id)&&maps[2].has(x.id)).map(x=>x.id),nextCommon=next.filter(x=>maps[0].has(x.id)&&maps[1].has(x.id)).map(x=>x.id),commonBase=oldOrder.filter(id=>maps[1].has(id)&&maps[2].has(id));
   const nextReordered=!same(nextCommon,commonBase),nowReordered=!same(nowCommon,commonBase);
   if(!history&&nextReordered&&nowReordered&&!same(nextCommon,nowCommon))throw Error('两个窗口同时调整了列表顺序：'+path);
   const order=(nextReordered||same(now,before)?next:now).map(x=>x.id);
   for(const id of (nextReordered?now:next).map(x=>x.id))if(!order.includes(id))order.push(id);
   return order.filter(id=>values.has(id)).map(id=>values.get(id));
  }
  if(history)return now===absent&&before!==absent?absent:copy(next);
  throw Error('两个窗口修改了同一处内容，请先保留一边的修改：'+path);
 };
 if(base?.id!==current?.id||draft?.id!==current?.id)throw Error('工程已切换，请重新打开这个编辑窗口。');
 const result=visit(base,current,draft,'工程');
 if(history)return result;
 const removedRoles=new Set((base.characters||[]).filter(item=>!(draft.characters||[]).some(next=>next.id===item.id)).map(item=>item.id));
 const removedAssets=new Set((base.assets||[]).filter(item=>!(draft.assets||[]).some(next=>next.id===item.id)).map(item=>item.id));
 const roleKeys=new Set(['characterId']),assetKeys=new Set(['modelId','assetId','portraitId','imageId','logoImageId','motionId','bgmId','voiceId','seId','coverImageId','backgroundId','soundId','videoId']);
 const check=value=>{if(!value||typeof value!=='object')return;for(const [key,next] of Object.entries(value)){
  if(roleKeys.has(key)&&removedRoles.has(next)||assetKeys.has(key)&&removedAssets.has(next))throw Error('其他窗口仍在使用刚删除的角色或素材，请先调整引用后再保存。');
  if(typeof next==='object')check(next);
 }};
 for(const key of ['characters','acts','title','items','environments'])check(result[key]);
 return result;
}
export const rebaseEditorHistoryProject=(base,current,snapshot)=>mergeEditorProject(base,current,snapshot,{history:true});

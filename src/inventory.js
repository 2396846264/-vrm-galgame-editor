const maxQuantity=1_000_000;
const quantity=value=>Number.isSafeInteger(Number(value))&&Number(value)>0&&Number(value)<=maxQuantity?Number(value):0;
export function normalizeInventory(value={},items=[]){
 const valid=new Set(items.map(item=>item.id)),counts=Object.create(null),claimed=Object.create(null);
 for(const[id,count]of Object.entries(value?.counts||{}))if(valid.has(id)&&quantity(count))counts[id]=quantity(count);
 for(const[id,yes]of Object.entries(value?.claimed||{}))if(yes===true)claimed[id]=true;
 return {version:1,counts,claimed,known:[...new Set((Array.isArray(value?.known)?value.known:[]).filter(id=>valid.has(id)))],pending:(Array.isArray(value?.pending)?value.pending:[]).filter(row=>row&&valid.has(row.itemId)&&quantity(row.quantity)).map(row=>({itemId:row.itemId,quantity:quantity(row.quantity)}))};
}
export function itemDefinitionReady(item,assets){return Boolean(item?.id&&item.name?.trim()&&item.description?.trim()&&assets.some(asset=>asset.id===item.imageId&&asset.type==='image'));}
export function combinedItemRows(rows,items){
 const result=new Map();for(const row of rows||[]){const count=quantity(row?.quantity);if(!count||typeof row.itemId!=='string')throw Error('物品数量必须是大于零的整数');const total=(result.get(row.itemId)||0)+count;if(total>maxQuantity)throw Error('物品数量过大');result.set(row.itemId,total);}
 return [...result].map(([itemId,count])=>({itemId,quantity:count,item:items.find(item=>item.id===itemId)}));
}
export function choiceItemStatus(choice,state,items){
 try{const rows=combinedItemRows(choice?.requirements,items),missing=rows.filter(row=>!row.item||Number(state?.counts?.[row.itemId]||0)<row.quantity).map(row=>({...row,have:Number(state?.counts?.[row.itemId]||0),name:row.item?.name||'已删除的物品'}));return {allowed:missing.length===0,rows,missing};}catch(error){return {allowed:false,rows:[],missing:[{name:'无效的物品条件',quantity:0,have:0}],error:error.message};}
}
export function grantDialogueItems(line,state,items,assets){
 if(!line?.id||state.claimed[line.id])return [];
 const rows=combinedItemRows(line.itemGrants,items);for(const row of rows){if(!itemDefinitionReady(row.item,assets))throw Error('请补全物品的名字、正方形立绘和介绍');if((state.counts[row.itemId]||0)+row.quantity>maxQuantity)throw Error('背包物品数量过大');}
 if(!rows.length)return [];
 state.claimed[line.id]=true;
 const gained=rows.map(({itemId,quantity})=>({itemId,quantity}));for(const row of gained){state.counts[row.itemId]=(state.counts[row.itemId]||0)+row.quantity;if(!state.known.includes(row.itemId))state.known.push(row.itemId);state.pending.push(row);}
 return gained;
}
export function useChoiceItems(choice,state,items){
 const status=choiceItemStatus(choice,state,items);if(!status.allowed)return {ok:false,...status};
 const consumed=[];for(const row of status.rows)if(choice.consumeRequired===true){state.counts[row.itemId]-=row.quantity;if(!state.counts[row.itemId])delete state.counts[row.itemId];consumed.push({itemId:row.itemId,quantity:row.quantity});}return {ok:true,consumed};
}
export function validateInventoryProject(project){
 const items=project.items||[];for(const act of project.acts||[])for(const line of act.steps||[]){for(const row of combinedItemRows(line.itemGrants,items))if(!itemDefinitionReady(row.item,project.assets))throw Error('对白获得物品未设置完整：'+(row.item?.name||row.itemId));for(const choice of line.choices||[])for(const row of combinedItemRows(choice.requirements,items))if(!itemDefinitionReady(row.item,project.assets))throw Error('分支所需物品未设置完整：'+(row.item?.name||row.itemId));}return true;
}

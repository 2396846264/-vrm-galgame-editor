import {shapeKit,shapeSymmetricX} from './vehicle-shapes.js';
// Coordinates are integer cells. Authors edit x >= 0; the other half is derived.
export const blockKit={
 hull:{name:'轻型机身方块',color:'#71836a',density:100,hp:55,drag:.07},
 wing:{name:'升力机翼方块',color:'#879978',density:55,hp:40,drag:.022,aero:true},
 tail:{name:'尾翼 / 稳定面方块',color:'#879978',density:55,hp:40,drag:.025,control:true},
 armor:{name:'装甲方块',color:'#545d61',density:600,hp:180,drag:.09},
 cockpit:{name:'不透明驾驶舱方块',color:'#293d48',density:150,hp:75,drag:.07}
};
const clamp=(v,a,b,d)=>Number.isFinite(Number(v))?Math.max(a,Math.min(b,Number(v))):d;
const color=(v,d)=>/^#[\da-f]{6}$/i.test(v)?v:d;
export const cellKey=c=>c.join(',');
export function snapCell(position,grid=.125){return position.map(v=>Math.round(v/grid)||0);}
export function normalizeStructure(v={}){
 const cells=new Map();for(const b of (Array.isArray(v.blocks)?v.blocks:[]).slice(0,64000)){if(!blockKit[b?.kind]||!Array.isArray(b.cell))continue;const cell=[0,1,2].map(i=>Math.round(clamp(b.cell[i],i===0?0:-256,256,0))||0);cells.set(cellKey(cell),{cell,kind:b.kind,color:color(b.color,blockKit[b.kind].color),shape:shapeKit[b.shape]?b.shape:'cube',shapeRotation:[0,1,2].map(i=>Math.round(clamp(b.shapeRotation?.[i],-180,180,0)/90)*90)});}
 return {schemaVersion:2,vehicleType:'aircraft',name:String(v.name||'新飞机').slice(0,80),gridSize:[.5,.25,.125].includes(v.gridSize)?v.gridSize:.125,blocks:[...cells.values()],parts:Array.isArray(v.parts)?v.parts:[]};
}
export function expandedBlocks(v){return (v.blocks||[]).flatMap(b=>b.cell[0]===0?[{...b,cell:[...b.cell]}]:[{...b,cell:[...b.cell]},{...b,cell:[-b.cell[0],b.cell[1],b.cell[2]],shapeRotation:[b.shapeRotation?.[0]||0,-(b.shapeRotation?.[1]||0),-(b.shapeRotation?.[2]||0)]}]);}
export function setBlock(v,cell,kind,color,shape='cube',shapeRotation=[0,0,0]){if(cell[0]<0)throw Error('只允许建造右半边（X≥0），左半边会自动生成');if(!cell.every(n=>Number.isInteger(n)&&Math.abs(n)<=256))throw Error('超出建造网格');const key=cellKey(cell),i=v.blocks.findIndex(b=>cellKey(b.cell)===key);if(!kind){if(i>=0)v.blocks.splice(i,1);return;}if(!blockKit[kind])throw Error('未知方块');if(cell[0]===0&&!shapeSymmetricX(shape,shapeRotation))throw Error('中心线形状必须保持左右对称；横向斜面请放到右半边');if(i<0&&v.blocks.length>=64000)throw Error('最多64000个半边方块');const b={cell:cell.map(v=>v||0),kind,color:color||blockKit[kind].color,shape,shapeRotation:[...shapeRotation]};if(i<0)v.blocks.push(b);else v.blocks[i]=b;}
export function mirrorAttachment(p){return {...structuredClone(p),id:crypto.randomUUID().replaceAll('-',''),offset:[-p.offset[0],p.offset[1],p.offset[2]],rotation:[p.rotation[0],-p.rotation[1],-p.rotation[2]],mirrorOf:p.id};}
export function structureErrors(v){
 const errors=[],blocks=expandedBlocks(v),keys=new Set(blocks.map(b=>cellKey(b.cell)));if(!blocks.length)return ['请先建造机体方块'];if(blocks.some(b=>b.cell[0]===0&&!shapeSymmetricX(b.shape||'cube',b.shapeRotation||[0,0,0])))errors.push('中心线异形块必须左右对称');
 const seen=new Set(),pending=[blocks[0].cell];while(pending.length){const c=pending.pop(),key=cellKey(c);if(seen.has(key)||!keys.has(key))continue;seen.add(key);for(let a=0;a<3;a++)for(const d of [-1,1]){const n=[...c];n[a]+=d;pending.push(n);}}
 if(seen.size!==blocks.length)errors.push('存在悬空方块，请与机体连接');if(!blocks.some(b=>b.kind==='wing'&&b.cell[0]>0))errors.push('缺少升力机翼方块');if(!blocks.some(b=>b.kind==='tail'))errors.push('缺少尾翼稳定面');if(!blocks.some(b=>b.kind==='cockpit')&&!v.parts.some(p=>p.type.includes('cockpit')))errors.push('缺少不透明驾驶舱');return errors;
}
// Combine adjacent cells into rows, so simulation and drawing do not allocate one object per cell.
export function structuralRows(v){
 const rows=new Map();for(const b of expandedBlocks(v)){const key=[b.cell[0],b.cell[1],b.kind,b.color,b.shape&&b.shape!=='cube'?cellKey(b.cell):'cube'].join('|');if(!rows.has(key))rows.set(key,[]);rows.get(key).push(b);}
 const filled=new Set(expandedBlocks(v).filter(b=>!b.shape||b.shape==='cube').map(b=>cellKey(b.cell)));
 const result=[];for(const row of rows.values()){row.sort((a,b)=>a.cell[2]-b.cell[2]);let start=0;for(let i=1;i<=row.length;i++)if(i===row.length||row[i].cell[2]!==row[i-1].cell[2]+1){const a=row[start],n=i-start,g=v.gridSize||.125;result.push({id:'cell:'+cellKey(a.cell),kind:a.kind,color:a.color,position:[a.cell[0]*g,a.cell[1]*g,(a.cell[2]+(n-1)/2)*g],size:[g,g,n*g],count:n,shape:a.shape||'cube',shapeRotation:!a.shape||a.shape==='cube'?[0,0,0]:a.shapeRotation||[0,0,0],faces:[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map((dir,axis)=>{const indices=axis===4?[i-1]:axis===5?[start]:Array.from({length:n},(_,k)=>start+k);return indices.some(j=>!filled.has(cellKey(row[j].cell.map((c,k)=>c+dir[k]))));})});start=i;}}
 return result;
}

import * as THREE from 'three';
import {shapeGeometry} from './vehicle-shapes.js';

export const geometryShapes=['box','sphere','cylinder','cone','pyramid','wedge','capsule','torus','arch'];
export const geometryLimits={instances:30000,triangles:2000000,templates:2000,page:500};
const uid=()=>crypto.randomUUID(),color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
const vector=(v,min=-1e6,max=1e6)=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isFinite(x)&&x>min&&x<=max);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
function keys(v,allowed){if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error('几何体包含不支持的参数');}
function name(v){if(typeof v!=='string'||!v.trim()||v.length>200)throw Error('几何体名称需要1至200个字');return v.trim();}
function unitGeometry(shape){
 let g;
 if(shape==='box')g=new THREE.BoxGeometry(1,1,1);
 else if(shape==='sphere')g=new THREE.SphereGeometry(.5,12,8);
 else if(shape==='cylinder')g=new THREE.CylinderGeometry(.5,.5,1,12);
 else if(shape==='cone')g=new THREE.ConeGeometry(.5,1,12);
 else if(shape==='capsule')g=new THREE.CapsuleGeometry(.25,.5,4,12);
 else if(shape==='torus'||shape==='arch')g=new THREE.TorusGeometry(.35,.15,8,16,shape==='arch'?Math.PI:Math.PI*2);
 else g=shapeGeometry(shape,[1,1,1]);
 g.computeBoundingBox();const size=g.boundingBox.getSize(new THREE.Vector3()),center=g.boundingBox.getCenter(new THREE.Vector3());g.translate(-center.x,-center.y,-center.z);g.scale(1/size.x,1/size.y,1/size.z);g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export const geometryTriangles=Object.fromEntries(geometryShapes.map(shape=>{const g=unitGeometry(shape),count=(g.index?.count||g.attributes.position.count)/3;g.dispose();return[shape,count];}));
export function validateGeometryBatch(n){
 if(!Array.isArray(n.primitives)||!n.primitives.length||n.primitives.length>geometryLimits.instances)throw Error('几何体数量需要1至30000');
 for(const key of ['roughness','metalness'])if(!Number.isFinite(n[key])||n[key]<0||n[key]>1)throw Error('几何体材质参数无效');
 if(typeof n.castShadow!=='boolean')throw Error('几何体阴影参数无效');
 const ids=new Set();let triangles=0;
 for(const p of n.primitives){if(!object(p)||typeof p.id!=='string'||!p.id||p.id.length>100||ids.has(p.id)||!geometryShapes.includes(p.shape)||!vector(p.position)||!vector(p.rotation)||!vector(p.size,0,10000)||!color(p.color)||typeof p.name!=='string'||p.name.length>200)throw Error('几何体内容、颜色或尺寸无效');ids.add(p.id);triangles+=geometryTriangles[p.shape];}
 if(triangles>geometryLimits.triangles)throw Error('几何体超过200万三角面预算');return {instances:n.primitives.length,triangles};
}
export function geometrySummary(n){const shapes={},colors=new Set();for(const p of n.primitives){shapes[p.shape]=(shapes[p.shape]||0)+1;colors.add(p.color);}return{primitiveCount:n.primitives.length,shapes,colorCount:colors.size,triangles:n.primitives.reduce((sum,p)=>sum+geometryTriangles[p.shape],0)};}
function patchPrimitive(p,patch){
 keys(patch,['id','name','shape','position','rotationDegrees','size','color']);
 if(patch.name!==undefined)p.name=name(patch.name);
 if(patch.shape!==undefined){if(!geometryShapes.includes(patch.shape))throw Error('不支持这个几何体形状');p.shape=patch.shape;}
 for(const key of ['position','size','rotationDegrees'])if(patch[key]!==undefined){if(!vector(patch[key],key==='size'?0:-1e6,key==='size'?10000:1e6))throw Error('几何体位置、旋转或尺寸无效');if(key==='rotationDegrees')p.rotation=patch[key].map(THREE.MathUtils.degToRad);else p[key]=[...patch[key]];}
 if(patch.color!==undefined){if(!color(patch.color))throw Error('几何体颜色应为#RRGGBB');p.color=patch.color;}
 return p;
}
function expandTemplates(templates,gridSize,capacity){
 if(!Array.isArray(templates)||!templates.length||templates.length>geometryLimits.templates)throw Error('每批需要1至2000份几何体定义');
 const result=[];
 for(const template of templates){
  keys(template,['name','shape','position','rotationDegrees','size','color','repeat']);
  const base=patchPrimitive({id:uid(),name:'几何体',shape:'box',position:[0,0,0],rotation:[0,0,0],size:[1,1,1],color:'#a9b5c1'},Object.fromEntries(Object.entries(template).filter(([k])=>k!=='repeat'))),repeat=template.repeat;
  let count=[1,1,1],spacing=[...base.size],palette=[base.color],mode='cycle';
  if(repeat!==undefined){keys(repeat,['count','spacing','colorPalette','colorMode']);count=repeat.count;if(!Array.isArray(count)||count.length!==3||count.some(x=>!Number.isInteger(x)||x<1||x>geometryLimits.instances))throw Error('重复数量需要三个正整数');if(repeat.spacing!==undefined){if(!vector(repeat.spacing))throw Error('重复间距需要三个数字');spacing=repeat.spacing;}if(repeat.colorPalette!==undefined){if(!Array.isArray(repeat.colorPalette)||!repeat.colorPalette.length||repeat.colorPalette.length>64||repeat.colorPalette.some(v=>!color(v)))throw Error('重复配色需要1至64个颜色');palette=repeat.colorPalette;}mode=repeat.colorMode||'cycle';if(!['cycle','checker'].includes(mode))throw Error('配色模式无效');}
  const amount=count[0]*count[1]*count[2];if(result.length+amount>capacity)throw Error('场景几何体总数超过30000，请减少重复数量或删除旧块体');
  let index=0;for(let y=0;y<count[1];y++)for(let z=0;z<count[2];z++)for(let x=0;x<count[0];x++){const p={...base,id:uid(),position:base.position.map((v,i)=>v+[x,y,z][i]*spacing[i]),size:[...base.size],rotation:[...base.rotation],color:palette[(mode==='checker'?x+y+z:index)%palette.length]};if(gridSize)p.position=p.position.map(v=>Math.round(v/gridSize)*gridSize);result.push(p);index++;}
 }
 return result;
}
// Clone first: bad colors, counts, IDs or budgets leave the scene untouched.
export function buildGeometryBatch(current,args){
 keys(args,['environmentId','expectedRevision','expectedEnvironmentRevision','mode','nodeId','name','parentId','position','rotationDegrees','scale','roughness','metalness','castShadow','gridSize','primitives','primitiveIds']);
 const env=structuredClone(current),mode=args.mode||'create';if(!['create','append','replace','update','remove'].includes(mode))throw Error('几何体操作模式无效');
 if(args.gridSize!==undefined&&(!Number.isFinite(args.gridSize)||args.gridSize<.001||args.gridSize>100))throw Error('吸附网格需要0.001至100米');
 let n=env.nodes.find(n=>n.id===args.nodeId);
 if(mode==='create'){if(args.nodeId)throw Error('新建几何体组不需要nodeId');n={id:uid(),kind:'geometryBatch',name:args.name?name(args.name):'Agent搭建场景',parentId:null,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],roughness:.85,metalness:0,castShadow:true,primitives:[]};env.nodes.push(n);}else if(n?.kind!=='geometryBatch')throw Error('请指定已有的Agent几何体组nodeId');
 if(args.parentId!==undefined){if(args.parentId&&!env.nodes.some(p=>p.id===args.parentId&&p.kind==='group'))throw Error('上级必须是已有分组');n.parentId=args.parentId||null;}
 if(args.name!==undefined)n.name=name(args.name);
 for(const key of ['position','scale','rotationDegrees'])if(args[key]!==undefined){if(!vector(args[key],key==='scale'?0:-1e6))throw Error('几何体组变换无效');if(key==='rotationDegrees')n.rotation=args[key].map(THREE.MathUtils.degToRad);else n[key]=[...args[key]];}
 for(const key of ['roughness','metalness'])if(args[key]!==undefined)n[key]=args[key];if(args.castShadow!==undefined)n.castShadow=args.castShadow;
 const others=env.nodes.filter(p=>p.kind==='geometryBatch'&&p!==n).reduce((s,p)=>s+p.primitives.length,0);let created=0,updated=0,removed=0;
 if(['create','replace','append'].includes(mode)){if(args.primitiveIds!==undefined)throw Error('创建时不能指定删除ID');const existing=mode==='append'?n.primitives:[];const pieces=expandTemplates(args.primitives,args.gridSize,geometryLimits.instances-others-existing.length);n.primitives=[...existing,...pieces];created=pieces.length;}
 else if(mode==='update'){if(args.primitiveIds!==undefined||!Array.isArray(args.primitives)||!args.primitives.length||args.primitives.length>geometryLimits.templates)throw Error('更新需要1至2000个带id的几何体');const map=new Map(n.primitives.map(p=>[p.id,p])),seen=new Set();for(const patch of args.primitives){if(!object(patch)||!map.has(patch.id)||seen.has(patch.id))throw Error('几何体ID不存在或重复');seen.add(patch.id);patchPrimitive(map.get(patch.id),patch);updated++;}}
 else {if(args.primitives!==undefined||!Array.isArray(args.primitiveIds)||!args.primitiveIds.length||args.primitiveIds.length>geometryLimits.templates)throw Error('移除需要1至2000个几何体ID');const ids=new Set(args.primitiveIds);if(ids.size!==args.primitiveIds.length||args.primitiveIds.some(id=>!n.primitives.some(p=>p.id===id)))throw Error('删除的几何体不存在或ID重复');n.primitives=n.primitives.filter(p=>!ids.has(p.id));removed=ids.size;if(!n.primitives.length)env.nodes=env.nodes.filter(p=>p!==n);}
 if(n.primitives.length)validateGeometryBatch(n);
 const changed=JSON.stringify(env)!==JSON.stringify(current);if(changed)env.revision=(current.revision||0)+1;
 return {environment:env,nodeId:n.id,changed,created,updated,removed,...geometrySummary(n)};
}
export function createGeometryBatch(node){
 validateGeometryBatch(node);const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:node.roughness,metalness:node.metalness});
 for(const shape of geometryShapes){const pieces=node.primitives.filter(p=>p.shape===shape);if(!pieces.length)continue;const mesh=new THREE.InstancedMesh(unitGeometry(shape),material,pieces.length),matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion(),position=new THREE.Vector3(),size=new THREE.Vector3(),paint=new THREE.Color();for(const [i,p]of pieces.entries()){matrix.compose(position.fromArray(p.position),quaternion.setFromEuler(new THREE.Euler(...p.rotation)),size.fromArray(p.size));mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,paint.set(p.color));}mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.castShadow=node.castShadow;mesh.receiveShadow=true;mesh.userData.agentGeometry=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);}
 root.userData.agentGeometryBatch=true;return root;
}

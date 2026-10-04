import * as THREE from 'three';
import {newId} from './environment-schema.js';

export function selectedRoots(env, ids) {
  const selected=new Set(ids),map=new Map(env.nodes.map(n=>[n.id,n]));
  return env.nodes.filter(n=>selected.has(n.id)&&!ancestors(n).some(id=>selected.has(id)));
  function ancestors(n){const result=[];for(let p=n.parentId;p;p=map.get(p)?.parentId)result.push(p);return result;}
}
export function subtreeIds(env, roots) {
  const ids=new Set(roots);let changed=true;
  while(changed){changed=false;for(const n of env.nodes)if(ids.has(n.parentId)&&!ids.has(n.id)){ids.add(n.id);changed=true;}}
  return ids;
}
export function worldMatrices(env) {
  const map=new Map(env.nodes.map(n=>[n.id,n])),result=new Map();
  function world(n){if(result.has(n.id))return result.get(n.id);const local=new THREE.Matrix4().compose(new THREE.Vector3(...n.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...n.rotation)),new THREE.Vector3(...n.scale));if(n.parentId)local.premultiply(world(map.get(n.parentId)));result.set(n.id,local);return local;}
  for(const n of env.nodes)world(n);return result;
}
export function assignMatrix(node, matrix) {
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(position,rotation,scale);
  const rebuilt=new THREE.Matrix4().compose(position,rotation,scale);
  if(scale.toArray().some(v=>!Number.isFinite(v)||v<=.00001)||matrix.elements.some((v,i)=>Math.abs(v-rebuilt.elements[i])>1e-5*Math.max(1,Math.abs(v))))throw Error('这个分组的旋转和拉伸无法直接拆开。请先把分组的三个大小调成一样，再拆组。');
  const euler=new THREE.Euler().setFromQuaternion(rotation);node.position=position.toArray();node.rotation=[euler.x,euler.y,euler.z];node.scale=scale.toArray();
}
export function reparentNode(env,id,parentId) {
  const matrices=worldMatrices(env),n=env.nodes.find(n=>n.id===id);
  if(subtreeIds(env,[id]).has(parentId))throw Error('物体不能放进自己的分组里');
  const local=matrices.get(id).clone();if(parentId)local.premultiply(matrices.get(parentId).clone().invert());assignMatrix(n,local);n.parentId=parentId||null;
}
export function groupSelection(env, ids) {
  const roots=selectedRoots(env,ids).filter(n=>n.kind!=='sky');if(!roots.length)throw Error('先选择要放进分组的物体');
  const matrices=worldMatrices(env),parentId=roots.every(n=>n.parentId===roots[0].parentId)?roots[0].parentId:null;
  const center=new THREE.Vector3();for(const n of roots)center.add(new THREE.Vector3().setFromMatrixPosition(matrices.get(n.id)));center.divideScalar(roots.length);
  if(parentId)center.applyMatrix4(matrices.get(parentId).clone().invert());
  const group={id:newId(),name:'新分组',kind:'group',parentId:parentId||null,position:center.toArray(),rotation:[0,0,0],scale:[1,1,1]};env.nodes.push(group);
  const groupWorld=worldMatrices(env).get(group.id).clone().invert();for(const n of roots){assignMatrix(n,matrices.get(n.id).clone().premultiply(groupWorld));n.parentId=group.id;}return group.id;
}
export function ungroupSelection(env,ids) {
  const groups=selectedRoots(env,ids).filter(n=>n.kind==='group');if(!groups.length)throw Error('先选择要拆开的分组');
  const children=[];for(const group of groups){for(const n of env.nodes.filter(n=>n.parentId===group.id)){reparentNode(env,n.id,group.parentId);children.push(n.id);}env.nodes=env.nodes.filter(n=>n.id!==group.id);}return children;
}
export function copySelection(env,ids) {
  const roots=selectedRoots(env,ids),included=subtreeIds(env,roots.map(n=>n.id)),matrices=worldMatrices(env),nodes=structuredClone(env.nodes.filter(n=>included.has(n.id)));
  for(const n of nodes)if(roots.some(r=>r.id===n.id)){assignMatrix(n,matrices.get(n.id));n.parentId=null;}return nodes;
}
export function pasteSelection(env,clipboard) {
  const ids=new Map(clipboard.map(n=>[n.id,newId()])),nodes=structuredClone(clipboard),roots=[];
  for(const n of nodes){const original=n.id;n.id=ids.get(original);n.parentId=ids.get(n.parentId)||null;if(!n.parentId){n.position[0]+=.35;n.name+=' 副本';roots.push(n.id);}}
  if(nodes.some(n=>n.kind==='sky')&&env.nodes.some(n=>n.kind==='sky'))throw Error('每个环境只需要一个天空球');
  env.nodes.push(...nodes);return roots;
}
export function validateEnvironmentLibrary(library,assets) {
  if(!library||!Array.isArray(library.folders)||library.folders.length>200||!library.assignments||typeof library.assignments!=='object'||Array.isArray(library.assignments))throw Error('素材文件夹无效');
  const folders=new Set(library.folders);
  if(folders.size!==library.folders.length||library.folders.some(p=>typeof p!=='string'||p.length>250||p.split('/').some(s=>!s||s==='.'||s==='..'||/[\\<>:"|?*]/.test(s))))throw Error('素材文件夹名称无效');
  const assetIds=new Set(assets.map(a=>a.id));for(const [id,folder]of Object.entries(library.assignments))if(!assetIds.has(id)||typeof folder!=='string'||folder&&!folders.has(folder))throw Error('素材所在文件夹无效');return library;
}

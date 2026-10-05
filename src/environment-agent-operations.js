import * as THREE from 'three';
import {createEnvironment, newId, validateEnvironment} from './environment-schema.js';
import {subtreeIds, worldMatrices, reparentNode, groupSelection, ungroupSelection, copySelection, pasteSelection} from './environment-operations.js';

export const environmentCoordinates={units:'meters',axes:'X right, Y up, Z toward the default game camera',rotation:'rotationDegrees: XYZ Euler degrees; returned rotation is radians',transform:'position and scale are local to parent; worldPosition is read-only',camera:'position/target are world coordinates'};
const own=(o,k)=>Object.hasOwn(o,k);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
function keys(value,allowed,label){if(!object(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw Error(`${label}包含不支持的参数`);}
function vector(v,label){if(!Array.isArray(v)||v.length!==3||v.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>=1e6))throw Error(`${label}需要三个有效数字`);return [...v];}
function text(v,label){if(typeof v!=='string'||!v.trim()||v.length>200)throw Error(`${label}请输入 1 至 200 个字`);return v.trim();}
const nodeFields=['name','assetId','position','rotationDegrees','scale','visible','width','height','color','intensity','distance','castShadow','unlit','alphaCutoff'];
function patchNode(node,patch){
  keys(patch,nodeFields,'物体设置');
  const extra={model:['assetId','castShadow'],imagePlane:['assetId','width','height','unlit','alphaCutoff'],group:[],ground:['width','height','color'],light:['color','intensity','distance','castShadow'],sky:['assetId','color']}[node.kind];
  for(const [key,value]of Object.entries(patch)){
    if(!['name','position','rotationDegrees','scale','visible',...extra].includes(key))throw Error(`${node.kind}不支持 ${key}`);
    if(key==='name')node.name=text(value,'物体名称');
    else if(key==='position'||key==='scale')node[key]=vector(value,key);
    else if(key==='rotationDegrees')node.rotation=vector(value,key).map(x=>THREE.MathUtils.degToRad(x));
    else if(['visible','castShadow','unlit'].includes(key)){if(typeof value!=='boolean')throw Error(`${key}需要 true 或 false`);node[key]=value;}
    else if(key==='color'){if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw Error('颜色应为 #RRGGBB');node[key]=value;}
    else if(key==='assetId'){if(typeof value!=='string')throw Error('素材 ID 无效');node[key]=value;}
    else {if(typeof value!=='number'||!Number.isFinite(value))throw Error(`${key}需要有效数字`);if(key==='alphaCutoff'&&(value<0||value>1))throw Error('alphaCutoff 应为 0 至 1');node[key]=value;}
  }
}
export function environmentSummary(project){return (project.environments||[]).map(e=>({id:e.id,name:e.name,revision:e.revision||0,nodeCount:e.nodes.length,references:{title:project.title?.environmentId===e.id,acts:(project.acts||[]).filter(a=>a.environmentId===e.id).map(a=>({id:a.id,name:a.name}))}}));}
export function describeEnvironment(env){
  const matrices=worldMatrices(env);
  return {...structuredClone(env),coordinates:environmentCoordinates,nodes:env.nodes.map(n=>({...structuredClone(n),rotationDegrees:n.rotation.map(THREE.MathUtils.radToDeg),worldPosition:new THREE.Vector3().setFromMatrixPosition(matrices.get(n.id)).toArray()}))};
}
export function newAgentEnvironment(name,assets){const env=createEnvironment(text(name,'环境名称'));validateEnvironment(env,assets);return env;}

// Work on a clone, so a bad final operation cannot leave half a scene behind.
export function editAgentEnvironment(current,operations,assets){
  if(!Array.isArray(operations)||!operations.length||operations.length>200)throw Error('每批需要 1 至 200 个操作');
  const env=structuredClone(current),refs=Object.create(null),results=[];
  const resolve=id=>{const found=own(refs,id)?refs[id]:id;if(typeof found!=='string'||!env.nodes.some(n=>n.id===found))throw Error(`物体不存在：${id}`);return found;};
  const ids=value=>{if(!Array.isArray(value)||!value.length)throw Error('请指定物体 ID 列表');return [...new Set(value.map(resolve))];};
  const node=id=>env.nodes.find(n=>n.id===resolve(id));
  for(const [index,op]of operations.entries()){
    try{
      if(!object(op))throw Error('操作必须是对象');
      let output={op:op.op};
      if(op.op==='add'){
        keys(op,['op','kind','ref','parentId',...nodeFields],'添加物体');
        if(!['model','imagePlane','group','ground','light','sky'].includes(op.kind))throw Error('物体类型无效');
        const defaults={imagePlane:{width:8,height:4.5,unlit:true,alphaCutoff:0},ground:{width:20,height:20,color:'#b7bfae',rotation:[-Math.PI/2,0,0]},light:{color:'#ffffff',intensity:5,distance:20,castShadow:false},sky:{color:'#a8c9e6'}};
        const n={id:newId(),kind:op.kind,name:op.kind,parentId:op.parentId?resolve(op.parentId):null,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],visible:true,...defaults[op.kind]};
        patchNode(n,Object.fromEntries(nodeFields.filter(k=>own(op,k)).map(k=>[k,op[k]])));
        if(n.parentId&&node(n.parentId).kind!=='group')throw Error('上级必须是分组');
        env.nodes.push(n);output.nodeIds=[n.id];
      }else if(op.op==='update'){
        keys(op,['op','nodeId','patch'],'修改物体');const n=node(op.nodeId);patchNode(n,op.patch);output.nodeIds=[n.id];
      }else if(op.op==='remove'){
        keys(op,['op','nodeIds'],'删除物体');const removed=subtreeIds(env,ids(op.nodeIds));env.nodes=env.nodes.filter(n=>!removed.has(n.id));output.removedNodeIds=[...removed];
      }else if(op.op==='duplicate'){
        keys(op,['op','nodeIds','ref'],'复制物体');output.nodeIds=pasteSelection(env,copySelection(env,ids(op.nodeIds)));
      }else if(op.op==='group'){
        keys(op,['op','nodeIds','name','ref'],'分组');const id=groupSelection(env,ids(op.nodeIds));if(own(op,'name'))node(id).name=text(op.name,'分组名称');output.nodeIds=[id];
      }else if(op.op==='ungroup'){
        keys(op,['op','nodeIds'],'拆组');output.nodeIds=ungroupSelection(env,ids(op.nodeIds));
      }else if(op.op==='reparent'){
        keys(op,['op','nodeId','parentId'],'设置层级');const n=node(op.nodeId),parent=op.parentId?node(op.parentId):null;if(parent&&parent.kind!=='group')throw Error('上级必须是分组');reparentNode(env,n.id,parent?.id||null);output.nodeIds=[n.id];
      }else if(op.op==='snap'){
        keys(op,['op','nodeIds','gridSize'],'吸附');if(typeof op.gridSize!=='number'||!Number.isFinite(op.gridSize)||op.gridSize<.001||op.gridSize>100)throw Error('网格大小应为 0.001 至 100 米');output.nodeIds=ids(op.nodeIds);for(const id of output.nodeIds)node(id).position=node(id).position.map(x=>Math.round(x/op.gridSize)*op.gridSize);
      }else if(op.op==='settings'){
        keys(op,['op','name','background','camera','lighting'],'环境设置');
        if(own(op,'name'))env.name=text(op.name,'环境名称');if(own(op,'background'))env.background=op.background;
        if(own(op,'camera')){keys(op.camera,['position','target','fov'],'镜头');env.camera={...env.camera,...structuredClone(op.camera)};if(new THREE.Vector3(...env.camera.position).distanceTo(new THREE.Vector3(...env.camera.target))<.001)throw Error('镜头位置和目标不能重合');}
        if(own(op,'lighting')){keys(op.lighting,['color','intensity','ambientIntensity'],'灯光');env.lighting={...env.lighting,...structuredClone(op.lighting)};}
      }else throw Error('不支持的场景操作');
      if(own(op,'ref')){if(typeof op.ref!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(op.ref)||own(refs,op.ref)||env.nodes.some(n=>n.id===op.ref)||output.nodeIds?.length!==1)throw Error('ref 需要唯一短名称，且操作只能返回一个物体');refs[op.ref]=output.nodeIds[0];}
      validateEnvironment(env,assets);results.push(output);
    }catch(error){throw Error(`第 ${index+1} 个操作失败：${error.message}`);}
  }
  if(JSON.stringify(env)!==JSON.stringify(current))env.revision=(current.revision||0)+1;
  return {environment:env,refs,results,changed:env.revision!==(current.revision||0)};
}

export function environmentOwner(project,args){
  if(args.target==='title'){if(args.actId)throw Error('标题不需要 actId');return project.title;}
  if(args.target!=='act')throw Error('target 应为 title 或 act');
  const act=project.acts.find(a=>a.id===args.actId&&a.kind!=='event');if(!act)throw Error('找不到普通剧情幕');return act;
}

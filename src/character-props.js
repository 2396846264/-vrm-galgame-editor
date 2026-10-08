import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {disposeTree} from './environment-runtime.js';

export const propBoneLabels={rightHand:'右手掌',leftHand:'左手掌',head:'头部',hips:'腰部',chest:'胸部',upperChest:'上胸',spine:'脊柱',rightLowerArm:'右前臂',leftLowerArm:'左前臂',rightUpperArm:'右上臂',leftUpperArm:'左上臂',rightShoulder:'右肩',leftShoulder:'左肩',rightFoot:'右脚',leftFoot:'左脚'};
for(const [side,label]of [['right','右手'],['left','左手']]){
  for(const [finger,name]of [['Thumb','拇指'],['Index','食指'],['Middle','中指'],['Ring','无名指'],['Little','小指']]){
    const joints=finger==='Thumb'?['Metacarpal','Proximal','Distal']:['Proximal','Intermediate','Distal'];
    joints.forEach((joint,index)=>{propBoneLabels[side+finger+joint]=`${label}${name}第${['一','二','三'][index]}节`;});
  }
}
export function propBone(record,name) {
  if(name?.startsWith('bone:'))return record.vrm.scene.getObjectByName(name.slice(5));
  return record.vrm.humanoid.getRawBoneNode?.(name) || record.vrm.humanoid.getNormalizedBoneNode(name);
}
export function availablePropBones(record) {
  if(!record)return [];
  const result=Object.entries(propBoneLabels).filter(([key])=>propBone(record,key)).map(([value,label])=>({value,label}));
  const seen=new Set();record.vrm.scene.traverse(node=>{if(node.isBone && node.name && !seen.has(node.name)){seen.add(node.name);result.push({value:'bone:'+node.name,label:node.name});}});
  return result;
}
export function validatePropBinding(binding,assets) {
  if(!binding?.id || !assets.some(a=>a.id===binding.assetId && a.type==='sceneModel'))throw Error('物品模型不存在，请选择 GLB 模型');
  if(typeof binding.bone!=='string' || binding.bone.length>300)throw Error('物品骨骼无效');
  for(const key of ['position','rotation','scale'])if(!Array.isArray(binding[key]) || binding[key].length!==3 || binding[key].some(v=>!Number.isFinite(v)||Math.abs(v)>10000) || key==='scale'&&binding[key].some(v=>v<=0))throw Error('物品位置、旋转或缩放无效');
}
export function setPropRotation(binding,axis,value){
  const q=Array.isArray(binding.rotationQuaternion)&&binding.rotationQuaternion.length===4&&binding.rotationQuaternion.every(Number.isFinite)&&JSON.stringify(binding.rotationQuaternionAngles)===JSON.stringify(binding.rotation)
    ?new THREE.Quaternion().fromArray(binding.rotationQuaternion).normalize():new THREE.Quaternion().setFromEuler(new THREE.Euler(...binding.rotation.map(THREE.MathUtils.degToRad),'XYZ'));
  const direction=new THREE.Vector3().setComponent(axis,1),delta=THREE.MathUtils.degToRad(value-binding.rotation[axis]);q.premultiply(new THREE.Quaternion().setFromAxisAngle(direction,delta)).normalize();
  binding.rotation[axis]=value;binding.rotationQuaternion=q.toArray();binding.rotationQuaternionAngles=[...binding.rotation];
}
// Offsets are in metres before character-size adjustment, even for centimetre FBX rigs.
export function updatePropTransform(record,attached) {
  const {root,binding,bone}=attached;
  record.anchor.updateWorldMatrix(true,false);bone.updateWorldMatrix(true,false);
  const relativeScale=bone.getWorldScale(new THREE.Vector3()).divide(record.anchor.getWorldScale(new THREE.Vector3()));
  if(relativeScale.toArray().some(v=>Math.abs(v)<1e-8))return;
  root.position.fromArray(binding.position).divide(relativeScale);
  if(Array.isArray(binding.rotationQuaternion)&&binding.rotationQuaternion.length===4&&binding.rotationQuaternion.every(Number.isFinite)&&JSON.stringify(binding.rotationQuaternionAngles)===JSON.stringify(binding.rotation))root.quaternion.fromArray(binding.rotationQuaternion).normalize();
  else root.rotation.set(...binding.rotation.map(THREE.MathUtils.degToRad));
  root.scale.fromArray(binding.scale).divide(relativeScale);
}
export class CharacterProps {
  constructor(url){this.url=url;this.loader=new GLTFLoader();this.cache=new Map();this.generation=0;}
  load(asset){
    if(!this.cache.has(asset.id)){
      const generation=this.generation;
      const task=this.loader.loadAsync(this.url(asset)).then(gltf=>{
        if(generation!==this.generation){disposeTree(gltf.scene);return null;}
        const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),extent=Math.max(size.x,size.y,size.z);
        if(!Number.isFinite(extent)||extent<=0){disposeTree(gltf.scene);throw Error('物品模型没有可见的形状');}
        const template=new THREE.Group(),fit=.8/extent;template.add(gltf.scene);template.scale.setScalar(fit);template.position.copy(bounds.getCenter(new THREE.Vector3())).multiplyScalar(-fit);
        return template;
      }).catch(error=>{this.cache.delete(asset.id);throw error;});
      this.cache.set(asset.id,task);
    }
    return this.cache.get(asset.id);
  }
  async sync(record,bindings,visibleIds,assets,valid=()=>true){
    const token=(record.propToken||0)+1;record.propToken=token;
    const specs=(bindings||[]).filter(p=>visibleIds?.includes(p.id)||(assets.some(a=>a.id===p.assetId&&a.type==='sceneModel')&&propBone(record,p.bone)));
    const loaded=await Promise.all(specs.map(async binding=>{
      validatePropBinding(binding,assets);const bone=propBone(record,binding.bone);
      if(!bone)throw Error('模型没有这个骨骼：'+(propBoneLabels[binding.bone]||binding.bone));
      return {binding,bone,source:await this.load(assets.find(a=>a.id===binding.assetId))};
    }));
    if(record.propToken!==token || !valid())return;
    const desired=new Set(loaded.map(p=>p.binding.id));record.attachedProps ||= new Map();
    for(const [id,p]of record.attachedProps)if(!desired.has(id)){p.root.removeFromParent();record.attachedProps.delete(id);}
    for(const spec of loaded){
      if(!spec.source)continue;
      let p=record.attachedProps.get(spec.binding.id);
      if(p && p.binding.assetId!==spec.binding.assetId){p.root.removeFromParent();p=null;}
      if(!p){const root=new THREE.Group();root.name='CharacterProp:'+spec.binding.id;root.add(clone(spec.source));root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});p={root};record.attachedProps.set(spec.binding.id,p);}
      p.binding=structuredClone(spec.binding);p.bone=spec.bone;p.root.visible=Boolean(visibleIds?.includes(spec.binding.id));p.bone.add(p.root);updatePropTransform(record,p);
    }
  }
  update(record){for(const p of record.attachedProps?.values()||[])updatePropTransform(record,p);}
  clear(){this.generation++;for(const task of this.cache.values())task.then(scene=>{if(scene)disposeTree(scene);}).catch(()=>{});this.cache.clear();}
}

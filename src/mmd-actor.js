import * as THREE from 'three';
import {VRMHumanoid} from '@pixiv/three-vrm';
import {createMmdExpressions} from './mmd-expressions.js';
import {createMmdPhysics} from './mmd-physics.js';

export const mmdBoneAliases={hips:['腰','下半身','センター'],spine:['上半身'],chest:['上半身2'],upperChest:['上半身3'],neck:['首'],head:['頭'],leftEye:['左目'],rightEye:['右目']};
for(const [side,jp]of [['left','左'],['right','右']]){
 Object.assign(mmdBoneAliases,{[side+'Shoulder']:[jp+'肩',jp+'肩P'],[side+'UpperArm']:[jp+'腕'],[side+'LowerArm']:[jp+'ひじ',jp+'肘'],[side+'Hand']:[jp+'手首'],[side+'UpperLeg']:[jp+'足D',jp+'足'],[side+'LowerLeg']:[jp+'ひざD',jp+'膝D',jp+'ひざ',jp+'膝'],[side+'Foot']:[jp+'足首D',jp+'足首'],[side+'Toes']:[jp+'足先EX',jp+'つま先D',jp+'つま先']});
 for(const [finger,name]of [['Thumb','親指'],['Index','人指'],['Middle','中指'],['Ring','薬指'],['Little','小指']]){
  const joints=finger==='Thumb'?['Metacarpal','Proximal','Distal']:['Proximal','Intermediate','Distal'];
  joints.forEach((joint,index)=>{const n=finger==='Thumb'?index:index+1;mmdBoneAliases[side+finger+joint]=[jp+name+n,jp+name+String(n).replace(/\d/g,c=>String.fromCharCode(c.charCodeAt(0)+0xfee0))];});
 }
}
const canonical=name=>name.normalize('NFKC').replace(/\s/g,'');
export function mapMmdBones(bones){const byName=new Map(bones.map(b=>[canonical(b.name),b]));return Object.fromEntries(Object.entries(mmdBoneAliases).flatMap(([name,aliases])=>{const node=aliases.map(a=>byName.get(canonical(a))).find(Boolean);return node?[[name,{node}]]:[];}));}
// MMD commonly starts in an A pose. Establish a T reference on the actual
// skin skeleton before making the normalized rig, without rebinding the mesh.
function alignChain(bone,child,direction){
 if(!bone||!child)return;bone.updateWorldMatrix(true,true);
 const from=child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize(),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()),correction=new THREE.Quaternion().setFromUnitVectors(from,direction);
 bone.quaternion.premultiply(parent.clone().invert().multiply(correction).multiply(parent));bone.updateWorldMatrix(true,true);
}
export async function createMmdActor(mesh,options={}){
 const {MMDAnimationHelper}=await import('@moeru/three-mmd');
 const raw=mapMmdBones(mesh.skeleton.bones);
 for(const name of ['hips','head','leftUpperArm','rightUpperArm','leftUpperLeg','rightUpperLeg'])if(!raw[name])throw Error('MMD 模型没有找到人物骨骼：'+name+'；武器请导入“物品与模型”。');
 const rest=new Map(mesh.skeleton.bones.map(b=>[b,{position:b.position.clone(),quaternion:b.quaternion.clone()}]));
 const physics=options.physics===false?null:await createMmdPhysics(mesh);
 const colliderLinks=[];for(const side of ['左','右'])for(const name of ['足','ひざ','足首']){const from=mesh.skeleton.bones.find(b=>b.name===side+name+'D'),to=mesh.skeleton.bones.find(b=>b.name===side+name);if(from&&to)colliderLinks.push({from,to});}
 for(const [side,x]of [['left',1],['right',-1]]){alignChain(raw[side+'UpperArm']?.node,raw[side+'LowerArm']?.node,new THREE.Vector3(x,0,0));alignChain(raw[side+'LowerArm']?.node,raw[side+'Hand']?.node,new THREE.Vector3(x,0,0));}
 const scene=new THREE.Group();scene.add(mesh);scene.updateMatrixWorld(true);
 const normalized=new VRMHumanoid(raw);scene.add(normalized.normalizedHumanBonesRoot);normalized.resetNormalizedPose();
 const expressions=createMmdExpressions(mesh),helper=new MMDAnimationHelper({sync:false,pmxAnimation:true});helper.add(mesh,{physics:false});const tools=helper.objects.get(mesh),ordered=mesh.geometry.userData.MMD.bones.slice().sort((a,b)=>(a.transformationClass||0)-(b.transformationClass||0)||a.index-b.index);
 let kind='humanoid',vmdPoseReady=false;
 const vmdPose=mesh.skeleton.bones.map(bone=>({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone()}));
 const valid=b=>Number.isFinite(b.position.x)&&Number.isFinite(b.position.y)&&Number.isFinite(b.position.z)&&Number.isFinite(b.quaternion.x)&&Number.isFinite(b.quaternion.y)&&Number.isFinite(b.quaternion.z)&&Number.isFinite(b.quaternion.w);
 const restoreRaw=()=>{for(const [bone,pose]of rest){bone.position.copy(pose.position);bone.quaternion.copy(pose.quaternion);}};
 const humanoid={get normalizedRestPose(){return normalized.normalizedRestPose;},get normalizedHumanBones(){return normalized.normalizedHumanBones;},getNormalizedBoneNode(name){return kind==='vmd'?(raw[name]?.node||null):normalized.getNormalizedBoneNode(name);},getRawBoneNode:name=>raw[name]?.node||null,resetNormalizedPose:()=>normalized.resetNormalizedPose()};
 return {scene,mesh,isMmd:true,meta:{metaVersion:'1'},humanoid,normalizedRig:{humanoid:normalized,meta:{metaVersion:'1'}},expressionManager:expressions,mmdBoneMap:raw,physics,getRestPosition:bone=>rest.get(bone).position,diagnostics:{mappedBones:Object.keys(raw),deformLegs:raw.leftUpperLeg.node.name},
  setMotionKind(next){if(kind!==next){physics?.restore();expressions.restore();restoreRaw();normalized.resetNormalizedPose();vmdPoseReady=false;kind=next;physics?.clearInput();}},
  beforeAnimation(){physics?.restore();expressions.restore();if(kind==='vmd'&&vmdPoseReady)for(const pose of vmdPose){pose.bone.position.copy(pose.position);pose.bone.quaternion.copy(pose.quaternion);}},
  resetPhysics:()=>physics?.reset(),setPhysicsEnabled:value=>physics?.setEnabled(value),setPhysicsActive:value=>physics?.setActive(value),setPhysicsQuality:value=>physics?.setQuality(value),preparePhysics:valid=>physics?.prepare(valid),
  update(delta=0){
   if(kind==='vmd'){
    const invalid=mesh.skeleton.bones.find(b=>!valid(b));if(invalid)throw Error('VMD 骨骼数据无效：'+invalid.name);
    for(const pose of vmdPose){pose.position.copy(pose.bone.position);pose.quaternion.copy(pose.bone.quaternion);}vmdPoseReady=true;
    if(mesh.geometry.userData.MMD.format==='pmx')helper._animatePMXMesh(mesh,ordered,tools.ikSolver,tools.grantSolver);
    else{tools.ikSolver?.update();tools.grantSolver?.update();}
    const failed=mesh.skeleton.bones.find(b=>!valid(b));if(failed)throw Error('VMD 骨骼运算无效：'+failed.name);
   }else{normalized.update();scene.updateMatrixWorld(true);for(const {from,to}of colliderLinks){const position=from.getWorldPosition(new THREE.Vector3()),rotation=from.getWorldQuaternion(new THREE.Quaternion());to.position.copy(to.parent.worldToLocal(position));to.quaternion.copy(to.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));to.updateMatrixWorld(true);}}
   expressions.update(kind==='vmd');scene.updateMatrixWorld(true);physics?.frame(delta);
  },dispose(){physics?.dispose();helper.remove(mesh);mesh.skeleton.dispose();}
 };
}

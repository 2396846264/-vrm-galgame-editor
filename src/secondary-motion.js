import * as THREE from 'three';
import {createSecondaryCollision} from './secondary-collision.js';
import {VRMSpringBoneCollider,VRMSpringBoneColliderShapeCapsule} from '@pixiv/three-vrm';

const names=['hips','spine','chest','upperChest','neck','head','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand'];
export function secondaryMotionKind(name='') {
 if(/hair|髪|髮|发|髮|劉海|前髪|後髪|横髪|アホ毛|ponytail|bang/i.test(name))return 'hair';
 if(/skirt|coat|cloth|dress|jacket|cape|sleeve|裙|衣|服|袖|裾|スカート|マント|ケープ/i.test(name))return 'cloth';
 return 'accessory';
}
const limits={hair:{local:.52,chain:.95},cloth:{local:.35,chain:.62},accessory:{local:.65,chain:1.05}};
const depth=node=>{let n=0;for(let p=node.parent;p;p=p.parent)n++;return n;};

// Limit the displayed secondary pose, never the animation or solver input.
// References are rebuilt from the current animated body, so turning, bending,
// VMD poses and parent/helper bones do not spend the accessory's swing budget.
export function createSecondaryMotionLimits(root,selected,{getBone=()=>null,reference=null,tails=new Map()}={}) {
 const human=new Map(names.map(n=>[n,getBone(n)]).filter(([,b])=>b)),bodyBones=new Set(human.values());
 const kind=bone=>{for(let b=bone;b&&!bodyBones.has(b);b=b.parent){const k=secondaryMotionKind(b.name);if(k!=='accessory')return k;}return 'accessory';};
 const entries=[...new Set(selected)].filter(b=>b&&!bodyBones.has(b)).sort((a,b)=>depth(a)-depth(b)).map(bone=>({bone,kind:kind(bone),p:new THREE.Vector3(),q:new THREE.Quaternion(),world:new THREE.Quaternion(),tail:tails.get(bone)?.clone()||bone.children.find(c=>c.isBone&&c.position.lengthSq()>1e-12)?.position.clone()||null}));
 const byBone=new Map(entries.map(e=>[e.bone,e])),referenceMatrices=new Map(),visited=new Set(),identity=new THREE.Matrix4();
 for(const e of entries)e.localMatrix=new THREE.Matrix4();
 const collision=createSecondaryCollision(root,entries,human);
 const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),inverse=new THREE.Quaternion(),target=new THREE.Quaternion();
 let ready=false,clamps=0;
 function constrain(e){
  const b=e.bone,l=limits[e.kind];let angle=e.q.angleTo(b.quaternion);
  if(!Number.isFinite(angle)){b.quaternion.copy(e.q);clamps++;}
  else if(angle>l.local){target.copy(b.quaternion);b.quaternion.copy(e.q).slerp(target,l.local/angle);clamps++;}
  b.updateMatrix();b.matrixWorld.multiplyMatrices(b.parent.matrixWorld,b.matrix);b.matrixWorld.decompose(position,rotation,scale);angle=e.world.angleTo(rotation);
  if(angle>l.chain){target.copy(e.world).slerp(rotation,l.chain/angle);b.parent.matrixWorld.decompose(position,inverse,scale);inverse.invert();b.quaternion.copy(inverse.multiply(target));
   angle=e.q.angleTo(b.quaternion);if(angle>l.local){target.copy(b.quaternion);b.quaternion.copy(e.q).slerp(target,l.local/angle);}b.updateMatrix();b.matrixWorld.multiplyMatrices(b.parent.matrixWorld,b.matrix);clamps++;
  }
 }
 return {
  capture(){
   root.updateWorldMatrix(true,true);visited.clear();
   const world=node=>{if(!node)return identity;if(visited.has(node))return referenceMatrices.get(node);const e=byBone.get(node),ref=reference?.get(node);let local;if(e){e.p.copy(ref?.position||node.position);e.q.copy(ref?.quaternion||node.quaternion);local=e.localMatrix.compose(e.p,e.q,node.scale);}else{node.updateMatrix();local=node.matrix;}const parent=world(node.parent);let m=referenceMatrices.get(node);if(!m){m=new THREE.Matrix4();referenceMatrices.set(node,m);}m.multiplyMatrices(parent,local);visited.add(node);return m;};
   for(const e of entries){const m=world(e.bone);m.decompose(position,e.world,scale);}
   collision.capture(referenceMatrices);ready=true;
  },
  apply(){
   if(!ready)return;
   for(const e of entries){const b=e.bone;b.parent.updateWorldMatrix(true,false);b.position.copy(e.p);if(!Number.isFinite(b.quaternion.x+b.quaternion.y+b.quaternion.z+b.quaternion.w))b.quaternion.copy(e.q);constrain(e);
    if(e.tail&&e.tail.lengthSq()>1e-12)collision.solve(e,constrain);
   }
   collision.finish(constrain);root.updateMatrixWorld(true);
  },
  setEnabled(value){collision.setEnabled(value);},
  syncSpringColliders:joints=>collision.syncSpringColliders(joints,()=>new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeCapsule())),
  reset(){ready=false;},
  measure(){let localRatio=0,chainRatio=0,translation=0;for(const e of entries){localRatio=Math.max(localRatio,e.q.angleTo(e.bone.quaternion)/limits[e.kind].local);e.bone.getWorldQuaternion(rotation);chainRatio=Math.max(chainRatio,e.world.angleTo(rotation)/limits[e.kind].chain);translation=Math.max(translation,e.p.distanceTo(e.bone.position));}return {localRatio,chainRatio,translation};},
  diagnostics:()=>({bones:entries.length,clamps,collisions:collision.diagnostics().contacts,limits,...collision.diagnostics()})
 };
}

// Stage translation is a coordinate change, not a gust. Existing authored
// centres/colliders stay intact; world-space springs get a model-local centre.
export function installVrmSecondaryMotion(vrm){
 const manager=vrm.springBoneManager;if(!manager?.joints?.size)return null;
 const joints=[...manager.joints],reference=new Map(joints.map(j=>[j.bone,{position:j.bone.position.clone(),quaternion:j.bone.quaternion.clone()}]));
 for(const j of joints){if(!j.center)j.center=vrm.scene;const k=secondaryMotionKind(j.bone.name);j.settings.dragForce=Math.max(j.settings.dragForce||0,k==='cloth'?.7:.55);j.settings.stiffness=Math.max(j.settings.stiffness||0,k==='cloth'?4:2.5);}
 const guard=createSecondaryMotionLimits(vrm.scene,joints.map(j=>j.bone),{getBone:n=>vrm.humanoid.getRawBoneNode(n),reference,tails:new Map(joints.map(j=>[j.bone,j.initialLocalChildPosition]))});
 const original=manager.update.bind(manager),raw=new Map(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();let reset=true,rootReady=false,lastTime=0,resets=0;
 manager.update=delta=>{
  for(const [bone,q]of raw)bone.quaternion.copy(q);
  vrm.scene.updateWorldMatrix(true,true);vrm.scene.matrixWorld.decompose(p,q,s);const now=performance.now();
  if(rootReady&&(p.distanceTo(position)>.3||q.angleTo(rotation)>.6||s.distanceTo(scale)>.0001)||lastTime&&now-lastTime>350)reset=true;
  if(reset){manager.reset();guard.reset();resets++;reset=false;}position.copy(p);rotation.copy(q);scale.copy(s);rootReady=true;lastTime=now;
  guard.capture();if(guard.syncSpringColliders(joints))for(const j of joints)manager.addJoint(j);
  const dt=Math.min(Math.max(0,delta),.05),steps=dt>0?Math.ceil(dt/(1/60)):1;
  for(let i=0;i<steps;i++)original(dt/steps);
  for(const j of joints){let pose=raw.get(j.bone);if(!pose){pose=new THREE.Quaternion();raw.set(j.bone,pose);}pose.copy(j.bone.quaternion);}guard.apply();
 };
 vrm.setSecondaryCollisionEnabled=value=>guard.setEnabled(value);
 const previous=vrm.resetPhysics?.bind(vrm);vrm.resetPhysics=()=>{previous?.();raw.clear();reset=true;};
 return {diagnostics:()=>({...guard.diagnostics(),resets,modelLocalSprings:joints.filter(j=>j.center===vrm.scene).length}),measure:()=>guard.measure()};
}

// FBX can use the same contact repair when it has weighted, independent
// clothing/hair bones. Do not fabricate a cloth rig on rigid Mixamo meshes.
export function installFbxSecondaryMotion(vrm){
 const human=new Set(Object.values(vrm.humanoid.normalizedHumanBones).map(b=>b.node)),weighted=new Set();
 vrm.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;if(!si||!sw)return;
  for(let i=0;i<si.count;i++)for(let j=0;j<4;j++)if(sw.getComponent(i,j)>.1)weighted.add(mesh.skeleton.bones[si.getComponent(i,j)]);
 });
 const selected=[...weighted].filter(b=>{if(!b||human.has(b)||!b.children.some(c=>c.isBone&&c.position.lengthSq()>1e-12))return false;
  for(let p=b;p&&!human.has(p);p=p.parent)if(secondaryMotionKind(p.name)!=='accessory')return true;return false;
 });
 if(!selected.length)return null;
 const guard=createSecondaryMotionLimits(vrm.scene,selected,{getBone:n=>vrm.humanoid.getNormalizedBoneNode(n)}),saved=new Map();
 const restore=()=>{for(const [b,pose]of saved){b.position.copy(pose.position);b.quaternion.copy(pose.quaternion);}saved.clear();};
 const before=vrm.beforeAnimation?.bind(vrm),update=vrm.update.bind(vrm);
 vrm.beforeAnimation=()=>{restore();before?.();};
 vrm.update=delta=>{update(delta);for(const b of selected)saved.set(b,{position:b.position.clone(),quaternion:b.quaternion.clone()});guard.capture();guard.apply();};
 vrm.setSecondaryCollisionEnabled=value=>guard.setEnabled(value);
 const reset=vrm.resetPhysics?.bind(vrm);vrm.resetPhysics=()=>{restore();guard.reset();reset?.();};
 return guard;
}

import * as THREE from 'three';
const lookNames=['lookLeft','lookRight','lookUp','lookDown'];
const rad=THREE.MathUtils.degToRad;
// Capture after authored animation, restore before the next frame. Never write
// the lookAt target or an animation clip, and never rotate the head.
export function createGazeRig(vrm){
 if(vrm.isFbx)return null;
 const raw=name=>vrm.humanoid.getRawBoneNode(name),head=raw('head');
 const eyes=['leftEye','rightEye'].map(raw).filter(Boolean),look=vrm.lookAt;
 if(!head||(!look?.applier?.applyYawPitch&&eyes.length!==2))return null;
 vrm.scene.updateWorldMatrix(true,true);
 const restHead=head.getWorldQuaternion(new THREE.Quaternion());
 const normalized=['leftEye','rightEye'].map(n=>vrm.humanoid.getNormalizedBoneNode(n)).filter(Boolean);
 const affected=new Set([...eyes,...normalized]),aux=[];
 if(vrm.isMmd){
  const bones=vrm.mesh.skeleton.bones,data=vrm.mesh.geometry.userData.MMD.bones;
  const roots=new Set(eyes.map(e=>bones.indexOf(e)));
  for(const [index,b]of data.entries())if(b.grant?.affectRotation&&roots.has(b.grant.parentIndex)){
   affected.add(bones[index]);aux.push({node:bones[index],parent:bones[b.grant.parentIndex],ratio:b.grant.ratio});
  }
 }
 const rest=new Map([...affected].map(b=>[b,b.quaternion.clone()])),clips=new WeakMap();
 const authoredBones=new Set([...affected,...(vrm.isMmd?vrm.mesh.skeleton.bones.filter(b=>/両目|両眼/.test(b.name)):[])]);
 let saved=null,expressions=null;
 function restore(){
  if(saved)for(const [node,before,after]of saved)if(node.quaternion.toArray().every((v,i)=>Math.abs(v-after.toArray()[i])<1e-7))node.quaternion.copy(before);
  if(expressions)for(const [name,before,after]of expressions)if(Math.abs((vrm.expressionManager.getValue(name)||0)-after)<1e-7)vrm.expressionManager.setValue(name,before);
  saved=expressions=null;
 }
 function animated(action){
  if(!action||action.getEffectiveWeight()<=.001)return false;
  const clip=action.getClip();if(clips.has(clip))return clips.get(clip);
  const found=clip.tracks.some(track=>{
   const bone=[...authoredBones].find(b=>track.name===b.name+'.quaternion'||track.name===b.uuid+'.quaternion');
   if(!bone)return /look(?:At|Left|Right|Up|Down)/i.test(track.name)&&track.values.some(v=>Math.abs(v)>.02);
   const initial=new THREE.Quaternion().fromArray(track.values),reference=rest.get(bone)||new THREE.Quaternion();
   if(initial.angleTo(reference)>.025)return true;
   for(let i=4;i<track.values.length;i+=4)if(initial.angleTo(new THREE.Quaternion().fromArray(track.values,i))>.01)return true;
   return false;
  });clips.set(clip,found);return found;
 }
 function authored(record){
  return Boolean(look?.target||Math.abs(look?.yaw||0)>.5||Math.abs(look?.pitch||0)>.5||
   lookNames.some(n=>(vrm.expressionManager?.getValue(n)||0)>.02)||animated(record?.currentAction)||record?.fadeOutActions?.some(item=>animated(item.action)));
 }
 function frame(){
  vrm.scene.updateWorldMatrix(true,true);
  const position=head.getWorldPosition(new THREE.Vector3()),rotation=head.getWorldQuaternion(new THREE.Quaternion());
  if(look?.getFaceFrontQuaternion)rotation.multiply(look.getFaceFrontQuaternion(new THREE.Quaternion()));
  else rotation.multiply(restHead.clone().invert());
  return {position,rotation};
 }
 function inputAngle(degrees,map,expression=false){return map?.outputScale>0?Math.min(map.inputMaxValue,Math.abs(degrees)*map.inputMaxValue/(expression?15:map.outputScale))*Math.sign(degrees):degrees;}
 return {
  restore,authored,frame,
  apply(yaw,pitch){
   if(Math.abs(yaw)+Math.abs(pitch)<1e-5)return;
   saved=[...affected].map(node=>[node,node.quaternion.clone(),null]);
   if(look?.applier?.applyYawPitch){
    const a=look.applier;
    expressions=lookNames.filter(n=>vrm.expressionManager?.getExpression?.(n)).map(n=>[n,vrm.expressionManager.getValue(n)||0,0]);
    const y=inputAngle(yaw,a.rangeMapHorizontalOuter,Boolean(a.expressions)),p=inputAngle(-pitch,pitch>0?a.rangeMapVerticalDown:a.rangeMapVerticalUp,Boolean(a.expressions));
    a.applyYawPitch(y,p);
    if(a.expressions)vrm.expressionManager.update();
    expressions.forEach(row=>row[2]=vrm.expressionManager.getValue(row[0])||0);
   }else{
    const {rotation}=frame(),world=rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-rad(pitch),rad(yaw),0,'YXZ'))).multiply(rotation.clone().invert());
    for(const eye of eyes){const parent=eye.parent.getWorldQuaternion(new THREE.Quaternion());eye.quaternion.premultiply(parent.clone().invert().multiply(world).multiply(parent));}
    // MMD eye-tip meshes inherit a fraction (often -0.7) of eye rotation.
    for(const item of aux){const parent=item.node.parent.getWorldQuaternion(new THREE.Quaternion()),local=parent.clone().invert().multiply(world).multiply(parent),fraction=new THREE.Quaternion().slerp(local,item.ratio);item.node.quaternion.premultiply(fraction);}
   }
   saved.forEach(row=>row[2]=row[0].quaternion.clone());vrm.scene.updateMatrixWorld(true);
  },
  diagnostics(){return {kind:vrm.isMmd?'MMD':look?'VRM lookAt':'eye bones',eyeBones:eyes.map(b=>b.name),auxiliaryBones:aux.map(a=>a.node.name)};}
 };
}

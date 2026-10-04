
import * as THREE from 'three';
const names={Hips:'hips',Spine:'spine',Spine1:'chest',Spine2:'upperChest',Neck:'neck',Head:'head',LeftShoulder:'leftShoulder',LeftArm:'leftUpperArm',LeftForeArm:'leftLowerArm',LeftHand:'leftHand',RightShoulder:'rightShoulder',RightArm:'rightUpperArm',RightForeArm:'rightLowerArm',RightHand:'rightHand',LeftUpLeg:'leftUpperLeg',LeftLeg:'leftLowerLeg',LeftFoot:'leftFoot',RightUpLeg:'rightUpperLeg',RightLeg:'rightLowerLeg',RightFoot:'rightFoot'};
for(const side of ['Left','Right'])for(const [source,target]of [['Thumb','Thumb'],['Index','Index'],['Middle','Middle'],['Ring','Ring'],['Pinky','Little']]){
 const joints=source==='Thumb'?['Metacarpal','Proximal','Distal']:['Proximal','Intermediate','Distal'];
 joints.forEach((joint,index)=>{names[side+'Hand'+source+(index+1)]=side.toLowerCase()+target+joint;});
}
const canonical=n=>n.replace(/^.*mixamorig:?/i,'').replace(/^[^:]*:/,'');
export function createFbxActor(scene){
 let hasMesh=false;scene.traverse(o=>{if(o.isSkinnedMesh)hasMesh=true;});if(!hasMesh)throw Error('此 FBX 只有骨骼或动作，没有人物身体，请导入带蒙皮的人物 FBX');
 const bones=new Map(),rest=new Map();scene.traverse(o=>{if(o.isBone){bones.set(canonical(o.name),o);rest.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});}});
 if(!bones.has('Hips')||!bones.has('LeftArm')||!bones.has('RightArm'))throw Error('人物没有找到 Mixamo 骨骼，请检查 FBX 人物文件');
 const human=Object.fromEntries(Object.entries(names).filter(([key])=>bones.has(key)).map(([key,value])=>[value,{node:bones.get(key)}]));
 const idleTracks=[];for(const [bone,r]of rest){idleTracks.push(new THREE.QuaternionKeyframeTrack(bone.uuid+'.quaternion',[0,1],[...r.quaternion.toArray(),...r.quaternion.toArray()]));idleTracks.push(new THREE.VectorKeyframeTrack(bone.uuid+'.position',[0,1],[...r.position.toArray(),...r.position.toArray()]));}
 const imported=scene.animations[0];
 const bodyTracks=(imported?.tracks||[]).flatMap(track=>{
   const dot=track.name.lastIndexOf('.'),bone=bones.get(canonical(track.name.slice(0,dot))),property=track.name.slice(dot+1);
   if(!bone||!['quaternion','position','scale'].includes(property))return [];
   const copy=track.clone();copy.name=bone.uuid+'.'+property;return [copy];
 });
 const idleClip=bodyTracks.length?new THREE.AnimationClip(imported.name,imported.duration,bodyTracks):new THREE.AnimationClip('原始站姿',1,idleTracks);
 return {scene,isFbx:true,bones,rest,idleClip,update(){},humanoid:{normalizedHumanBones:human,getNormalizedBoneNode:name=>human[name]?.node,resetNormalizedPose(){for(const [bone,r]of rest){bone.position.copy(r.position);bone.quaternion.copy(r.quaternion);bone.scale.copy(r.scale);}}}};
}
export function retargetFbxClip(source,actor){
 const clip=source.animations[0];if(!clip)throw Error('FBX 动作文件没有动作');
 source.updateMatrixWorld(true);actor.humanoid.resetNormalizedPose();actor.scene.updateMatrixWorld(true);
 const sourceBones=new Map();source.traverse(o=>{if(o.isBone)sourceBones.set(canonical(o.name),o);});
 const sourceHip=sourceBones.get('Hips'),targetHip=actor.bones.get('Hips');if(!sourceHip)throw Error('动作没有 Mixamo 骨骼');
 const ratio=Math.abs(sourceHip.position.y)>.001?actor.rest.get(targetHip).position.y/sourceHip.position.y:1,tracks=[];
 for(const track of clip.tracks){const dot=track.name.lastIndexOf('.'),name=canonical(track.name.slice(0,dot)),property=track.name.slice(dot+1),bone=actor.bones.get(name),sourceBone=sourceBones.get(name);if(!bone||!sourceBone)continue;
 if(property==='quaternion'){const values=Array.from(track.values),inverse=sourceBone.getWorldQuaternion(new THREE.Quaternion()).invert(),sourceParent=sourceBone.parent.getWorldQuaternion(new THREE.Quaternion()),targetParent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),rest=bone.getWorldQuaternion(new THREE.Quaternion());for(let i=0;i<values.length;i+=4){const q=new THREE.Quaternion().fromArray(values,i);q.premultiply(sourceParent).multiply(inverse).multiply(rest).premultiply(targetParent).normalize().toArray(values,i);}tracks.push(new THREE.QuaternionKeyframeTrack(bone.uuid+'.quaternion',track.times,values));}
 else if(property==='position'&&name==='Hips'){const values=Array.from(track.values),start=values.slice(0,3),rest=actor.rest.get(bone).position.toArray();for(let i=0;i<values.length;i++)values[i]=rest[i%3]+(values[i]-start[i%3])*ratio;tracks.push(new THREE.VectorKeyframeTrack(bone.uuid+'.position',track.times,values));}
 }
 if(!tracks.some(t=>t.name.includes('quaternion')))throw Error('人物与动作骨骼没有对应上');return new THREE.AnimationClip(clip.name,clip.duration,tracks);
}


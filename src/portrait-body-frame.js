import * as THREE from 'three';

// Record the neutral shoulder framing once, before story animation is applied.
export function capturePortraitBodyFrame(vrm,anchor){
 const node=name=>vrm.humanoid.getNormalizedBoneNode(name),head=node('head'),hips=node('hips');
 if(!head)return null;
 anchor.updateWorldMatrix(true,true);
 const pivotName=['upperChest','chest','spine','hips'].find(name=>node(name))||'head',pivot=node(pivotName);
 return {pivotName,headOffset:head.getWorldPosition(new THREE.Vector3()).sub(pivot.getWorldPosition(new THREE.Vector3())),
  restHipsRotation:hips?.getWorldQuaternion(new THREE.Quaternion())||anchor.getWorldQuaternion(new THREE.Quaternion()),
  anchorScale:Math.max(1e-6,Math.abs(anchor.getWorldScale(new THREE.Vector3()).y))};
}

// Follow only the body's horizontal heading and shoulder location. In particular,
// never cancel head/neck rotations or their movement relative to the shoulders.
export function portraitBodyFrame(record){
 const node=name=>record.vrm.humanoid.getNormalizedBoneNode(name);
 const reference=record.portraitBodyReference||=capturePortraitBodyFrame(record.vrm,record.anchor);
 const scale=Math.abs(record.anchor.getWorldScale(new THREE.Vector3()).y),hips=node('hips');
 const turn=(hips||record.anchor).getWorldQuaternion(new THREE.Quaternion()).multiply(reference.restHipsRotation.clone().invert());
 const forward=new THREE.Vector3(0,0,1).applyQuaternion(turn);
 const yaw=forward.x*forward.x+forward.z*forward.z>1e-6?Math.atan2(forward.x,forward.z):(record.portraitBodyYaw||0);
 record.portraitBodyYaw=yaw;
 const orientation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
 const pivot=node(reference.pivotName)||hips||node('head');
 const target=pivot.getWorldPosition(new THREE.Vector3()).add(reference.headOffset.clone().multiplyScalar(scale/reference.anchorScale).applyQuaternion(orientation));
 return {target,orientation,scale};
}

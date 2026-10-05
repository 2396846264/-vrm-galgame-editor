import * as THREE from 'three';

// Match the existing 512×512 automatic VRM shoulder photograph.
// Offsets are in the actor's space; framing follows the animated head.
export function setShoulderPortraitCamera(camera,head,scale=1,orientation=new THREE.Quaternion()){
  const offset=new THREE.Vector3(-.85,.05,1.7).multiplyScalar(scale).applyQuaternion(orientation);
  const aim=new THREE.Vector3(0,.03,0).multiplyScalar(scale).applyQuaternion(orientation);
  camera.left=camera.bottom=-.20*scale;camera.right=camera.top=.20*scale;
  camera.position.copy(head).add(offset);
  camera.up.set(0,1,0).applyQuaternion(orientation);
  camera.lookAt(head.clone().add(aim));camera.updateProjectionMatrix();
}

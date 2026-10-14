import * as THREE from 'three';
// Forward and strafe follow the full camera orientation; climb stays world-up.
export function buildMovement(keys,rotation){
 const move=new THREE.Vector3(Number(keys.has('KeyD'))-Number(keys.has('KeyA')),0,Number(keys.has('KeyS'))-Number(keys.has('KeyW'))).applyQuaternion(rotation);
 move.y+=Number(keys.has('Space'))-Number(keys.has('ControlLeft')||keys.has('ControlRight'));
 return move.lengthSq()?move.normalize():move;
}

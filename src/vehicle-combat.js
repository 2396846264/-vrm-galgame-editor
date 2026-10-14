import * as THREE from 'three';
// Yaw rotates the base, pitch rotates the gun cradle. Fire follows the actual barrel.
export function aimTurret(previous,direction,dt){
 const desiredYaw=Math.atan2(-direction.x,-direction.z),desiredPitch=Math.asin(THREE.MathUtils.clamp(direction.y,-1,1)),minPitch=-.25,maxPitch=1.35;
 const yawError=Math.atan2(Math.sin(desiredYaw-previous.yaw),Math.cos(desiredYaw-previous.yaw)),delta=THREE.MathUtils.clamp(yawError,-dt*1.8,dt*1.8),yaw=previous.yaw+delta;
 const pitch=previous.pitch+THREE.MathUtils.clamp(THREE.MathUtils.clamp(desiredPitch,minPitch,maxPitch)-previous.pitch,-dt*1.2,dt*1.2);
 const barrel=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
 return {yaw,pitch,delta,direction:barrel,canFire:desiredPitch>=minPitch&&desiredPitch<=maxPitch&&barrel.dot(direction)>.999};
}

import * as THREE from 'three';
// Pick a grid-aligned orientation, then retain the author's R/T/Y adjustment.
const rotations=[];
for(const x of [0,90,-90,180])for(const y of [0,90,-90,180])for(const z of [0,90,-90,180]){
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...[x,y,z].map(v=>v*Math.PI/180)));
 if(!rotations.some(r=>Math.abs(r.q.dot(q))>1-1e-7))rotations.push({q,degrees:[x,y,z]});
}
export function facingShapeRotation(shape,cameraRotation,adjustment=[0,0,0]){
 if(!['cone','pyramid','wedge'].includes(shape))return [...adjustment];
 const toward=new THREE.Vector3(0,0,1).applyQuaternion(cameraRotation),up=new THREE.Vector3(0,1,0).applyQuaternion(cameraRotation);
 const tip=shape==='wedge'?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,1,0),side=shape==='wedge'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,-1);
 let best=rotations[0],score=-Infinity;
 for(const r of rotations){const value=tip.clone().applyQuaternion(r.q).dot(toward)*10+side.clone().applyQuaternion(r.q).dot(up);if(value>score+1e-7){best=r;score=value;}}
 const q=best.q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...adjustment.map(v=>v*Math.PI/180))));
 const e=new THREE.Euler().setFromQuaternion(q,'XYZ');return [e.x,e.y,e.z].map(v=>Math.round(v*180/Math.PI/90)*90||0);
}

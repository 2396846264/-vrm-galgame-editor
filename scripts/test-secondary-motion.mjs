import assert from 'node:assert/strict';
import * as THREE from 'three';
import {VRMSpringBoneManager,VRMSpringBoneJoint} from '@pixiv/three-vrm';
import {createSecondaryMotionLimits,installVrmSecondaryMotion} from '../src/secondary-motion.js';

const root=new THREE.Group(),hips=new THREE.Bone(),head=new THREE.Bone(),chest=new THREE.Bone(),foot=new THREE.Bone(),hair=new THREE.Bone(),tip=new THREE.Bone(),skirt=new THREE.Bone(),hem=new THREE.Bone();
root.add(hips,foot);hips.position.y=1;foot.position.y=0;hips.add(chest);chest.position.y=.4;chest.add(head);head.position.y=.2;chest.add(hair);hair.name='Hair';hair.position.set(.18,0,0);hair.add(tip);tip.position.y=-.3;hips.add(skirt);skirt.name='スカート';skirt.position.x=.23;skirt.add(hem);hem.position.y=-.3;
const map={hips,chest,head,leftFoot:foot,rightFoot:foot},getBone=n=>map[n];root.updateMatrixWorld(true);
const guard=createSecondaryMotionLimits(root,[hair,skirt],{getBone});guard.capture();const torsoPose=chest.quaternion.clone(),p=hair.position.clone();hair.position.set(50,50,50);hair.rotation.z=2.8;skirt.rotation.z=2.4;guard.apply();
assert(hair.position.equals(p),'Hair joints must not stretch away from the body');assert(hair.quaternion.angleTo(new THREE.Quaternion())<=.520001);assert(skirt.quaternion.angleTo(new THREE.Quaternion())<=.350001);assert(chest.quaternion.equals(torsoPose),'Main animation must not be clamped');
hair.rotation.set(0,0,0);skirt.rotation.set(0,0,0);root.updateMatrixWorld(true);guard.capture();hair.rotation.z=-.5;root.updateMatrixWorld(true);guard.apply();const end=tip.getWorldPosition(new THREE.Vector3());assert(end.x>.09,'Hair must be pushed out of the torso capsule');assert(guard.diagnostics().collisions>0);
// A body turn, helper bone and actor scale must not be interpreted as sway.
chest.rotation.y=1.3;hair.rotation.set(0,0,0);skirt.rotation.set(0,0,0);root.position.set(20,0,-8);root.scale.setScalar(.1);root.updateMatrixWorld(true);guard.capture();hair.rotation.z=.2;guard.apply();assert(Math.abs(hair.rotation.z-.2)<1e-6);assert.equal(chest.rotation.y,1.3);
// Exercise the installed public VRM solver, including teleport and frame gaps.
root.scale.setScalar(1);chest.rotation.y=0;hair.rotation.set(0,0,0);root.updateMatrixWorld(true);const manager=new VRMSpringBoneManager();const joint=new VRMSpringBoneJoint(hair,tip,{stiffness:.1,dragForce:0,gravityPower:3,gravityDir:new THREE.Vector3(-1,0,0)});manager.addJoint(joint);manager.setInitState();const vrm={scene:root,springBoneManager:manager,humanoid:{getRawBoneNode:getBone}};const safety=installVrmSecondaryMotion(vrm);assert(safety);assert.equal(joint.center,root);
let peak=0;for(let i=0;i<160;i++){if(i===30)root.position.x+=4;if(i===60)root.rotation.y=1.8;if(i===90)root.scale.setScalar(1.2);manager.update(i%25===0?.1:1/60);peak=Math.max(peak,hair.quaternion.angleTo(new THREE.Quaternion()));assert(hair.position.toArray().concat(hair.quaternion.toArray()).every(Number.isFinite));}
assert(peak<=.520001,'VRM swing budget must hold under gravity and stage transforms');assert(peak>.01,'Secondary motion must remain active');vrm.resetPhysics();manager.update(0);assert(safety.diagnostics().resets>=4);
console.log(JSON.stringify({ok:true,positionStable:true,mainMotionPreserved:true,bodyCollision:true,vrmMaxSwing:peak,teleportReset:true,diagnostics:safety.diagnostics()}));

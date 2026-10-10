import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPhysicsOutput} from '../src/mmd-physics-output.js';
const mesh=new THREE.Group(),torso=new THREE.Bone(),hair=new THREE.Bone(),helper=new THREE.Bone(),tip=new THREE.Bone();
mesh.add(torso);torso.add(hair);hair.add(helper);helper.add(tip);hair.position.y=1;helper.position.y=.2;tip.position.y=.2;
const body=bone=>({bone,params:{type:1,boneIndex:1}}),output=createPhysicsOutput(mesh,[body(hair),body(tip)]);
const target=angle=>{hair.rotation.z=angle;tip.rotation.z=0;mesh.updateMatrixWorld(true);};
target(0);output.apply(1/60);let peak=0;
for(let i=0;i<180;i++){target(i%2?.2:-.2);output.apply(1/60);if(i>60)peak=Math.max(peak,Math.abs(hair.rotation.z));}
assert(peak<.03,'Rapid numerical chatter should be suppressed');
output.reset();target(.3);output.apply(1/60);assert(Math.abs(hair.rotation.z-.3)<1e-8,'New pose must snap after reset');
const before=hair.quaternion.clone();target(-.3);output.apply(0);assert(hair.quaternion.angleTo(before)<1e-7,'Zero-time reads must retain displayed pose');
target(2.5);output.apply(1/60);assert(hair.quaternion.angleTo(before)<=.050001,'Sudden solver flips must not reach the displayed ornament');
// The non-physics torso and the complete filtered chain must turn together.
torso.rotation.y=1.2;target(.3);output.apply(1/60);assert.equal(torso.rotation.y,1.2);const forward=new THREE.Vector3(0,0,1).applyQuaternion(tip.getWorldQuaternion(new THREE.Quaternion()));assert(Math.abs(forward.x-Math.sin(1.2))<1e-7);
// A slow, normal sway must still be visible with a similar range.
output.reset();let range=0;
for(let i=0;i<300;i++){target(.3*Math.sin(i/60*2*Math.PI));output.apply(1/60);if(i>120)range=Math.max(range,Math.abs(hair.rotation.z));}
assert(range>.25,'Natural secondary motion must remain alive');
assert.equal(output.count,2);console.log('PASS: fast chatter reduced, slow sway retained, animated body follows immediately, helper bones do not double-transform, zero-time reads and resets are stable.');

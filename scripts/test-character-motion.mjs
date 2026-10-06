import assert from 'node:assert/strict';
import * as THREE from 'three';
import {motionPlayback,motionFeetLocked,loopMotionClip,rootTravel,updateMotionRoot,motionFinishTarget} from '../src/character-motion.js';
assert.equal(motionPlayback().placement,'free');assert.equal(motionPlayback({placement:'bounded',feet:'lock'}).placement,'inPlace');assert.equal(motionPlayback({feet:'lock'}).feet,'lock');assert.equal(motionPlayback().feet,'free');
assert.equal(motionFeetLocked({feet:'lock'},{name:'Walking'}),true);
assert.equal(motionFeetLocked({feet:'auto'},{name:'待机_自然站立'}),true);
assert.equal(motionFeetLocked({feet:'auto'},{name:'Talking'}),true);
for(const name of ['Walking','Running','Jumping','Sitting Idle','Idle Crouching Aiming','走路测试','舞蹈'])assert.equal(motionFeetLocked({feet:'auto'},{name}),false,name);
assert.equal(motionFeetLocked({feet:'free'}),false);
const anchor=new THREE.Group(),motionRoot=new THREE.Group(),scene=new THREE.Group(),hips=new THREE.Bone();hips.name='hips';hips.position.y=1;scene.add(hips);anchor.add(motionRoot);motionRoot.add(scene);
const source=new THREE.AnimationClip('walking',1,[new THREE.VectorKeyframeTrack('hips.position',[0,.5,1],[0,1,0,0,1.05,1,0,1.01,2]),new THREE.QuaternionKeyframeTrack('hips.quaternion',[0,.5,1],[0,0,0,1,0,.1,0,Math.sqrt(.99),0,.02,0,Math.sqrt(.9996)])]);
const loop=loopMotionClip(source,hips,new Map());assert.notEqual(loop,source);assert.equal(source.tracks[0].values.at(-2),Math.fround(1.01));assert.equal(loop.tracks[0].values.at(-2),1);assert.deepEqual(rootTravel(loop,hips).toArray(),[0,0,2]);
const mixer=new THREE.AnimationMixer(scene),action=mixer.clipAction(loop);action.play();const record={vrm:{humanoid:{getNormalizedBoneNode:()=>hips}},anchor,motionRoot,rootLoopTravel:rootTravel(loop,hips),motionLoops:0,currentMotionOptions:{placement:'free'},referenceHips:new THREE.Vector3(0,1,0),motionOrigin:new THREE.Vector3(0,1,0)};
mixer.addEventListener('loop',e=>record.motionLoops+=e.loopDelta);let previous=new THREE.Vector3(),maximumJump=0;
for(let i=0;i<360;i++){mixer.update(1/60);updateMotionRoot(record);const world=hips.getWorldPosition(new THREE.Vector3());if(i)maximumJump=Math.max(maximumJump,world.distanceTo(previous));previous.copy(world);}
assert.ok(previous.z>11.9,'Looping walk did not travel continuously');assert.ok(maximumJump<.05,'Loop seam teleported');
record.currentMotionOptions.placement='inPlace';record.motionLoops=0;mixer.setTime(0);for(let i=0;i<180;i++){mixer.update(1/60);updateMotionRoot(record);assert.ok(Math.abs(hips.getWorldPosition(new THREE.Vector3()).z)<1e-5,'In-place walk moved');}
assert.ok(Math.abs(hips.position.y-1)<.06,'Vertical body movement flattened');
record.currentMotionOptions.placement='free';record.motionRoot.position.set(0,0,0);record.currentAction=action;const target=motionFinishTarget(record);assert.equal(target.z,2);record.motionCarry=new THREE.Vector3(0,0,2);record.finishWorldTarget=target;record.fadeOutActions=[{}];hips.position.z=1;updateMotionRoot(record);assert.equal(hips.getWorldPosition(new THREE.Vector3()).z,2,'Returning to idle doubled the walk displacement');
record.fadeOutActions=[];hips.position.z=0;record.motionLoops=0;updateMotionRoot(record);assert.equal(hips.getWorldPosition(new THREE.Vector3()).z,2,'Returning to idle teleported to the start');
console.log('Character motion: continuous loop travel, no teleport, in-place playback, preserved source and optional/automatic foot locking passed.');

import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import {solveArmIK,normalizeMotionFit,createMotionFit,setMotionFitProfiles,motionFitProfile} from '../src/motion-fit.js';
import {exportMixamoWhite,exportMixamoObj} from '../src/mixamo-white-export.js';
import {CompatibleFBXLoader} from '../src/fbx-loader.js';
import {createFbxActor,retargetFbxClip} from '../src/fbx-character.js';

assert.equal(normalizeMotionFit({clearance:100}).clearance,.08);
setMotionFitProfiles(()=>[{id:'a',motionFit:{strength:.5},motionFitOverrides:{walk:{enabled:false}}},{id:'b',motionFit:{strength:.2}}]);
assert.equal(motionFitProfile('gallery:a').strength,.5);assert.equal(motionFitProfile('details:a','walk').enabled,false);assert.equal(motionFitProfile('b').strength,.2);
const root=new THREE.Group(),upper=new THREE.Bone(),twist=new THREE.Bone(),lower=new THREE.Bone(),hand=new THREE.Bone();root.add(upper);upper.add(twist);twist.add(lower);lower.add(hand);upper.position.set(.2,1,0);twist.position.set(.1,0,0);lower.position.set(.2,0,0);hand.position.set(.25,0,0);lower.rotation.z=-.4;root.rotation.set(.2,.7,-.1);root.scale.setScalar(1.3);root.updateMatrixWorld(true);
const a=upper.getWorldPosition(new THREE.Vector3()),b=lower.getWorldPosition(new THREE.Vector3()),c=hand.getWorldPosition(new THREE.Vector3()),len1=a.distanceTo(b),len2=b.distanceTo(c),wrist=hand.getWorldQuaternion(new THREE.Quaternion()),target=a.clone().add(new THREE.Vector3(.24,.05,.18));
solveArmIK(upper,lower,hand,target);assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(target)<1e-5);assert.ok(Math.abs(upper.getWorldPosition(new THREE.Vector3()).distanceTo(lower.getWorldPosition(new THREE.Vector3()))-len1)<1e-5);assert.ok(Math.abs(lower.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3()))-len2)<1e-5);assert.ok(hand.getWorldQuaternion(new THREE.Quaternion()).angleTo(wrist)<1e-5);
for(let i=0;i<120;i++){solveArmIK(upper,lower,hand,a.clone().add(new THREE.Vector3(3,2,1)));assert.ok(hand.quaternion.toArray().every(Number.isFinite));}
const body=new THREE.Group(),nodes={};const bone=(name,parent,p)=>{const b=new THREE.Bone();b.name=name;b.position.fromArray(p);(nodes[parent]||body).add(b);nodes[name]=b;return b;};
bone('hips',null,[0,1,0]);bone('neck','hips',[0,.5,0]);bone('head','neck',[0,.12,0]);
for(const [side,x]of [['left',1],['right',-1]]){bone(side+'UpperArm','hips',[x*.2,.43,0]);bone(side+'LowerArm',side+'UpperArm',[x*.25,-.03,0]);bone(side+'Hand',side+'LowerArm',[x*.23,0,0]);}
const actorFit={scene:body,humanoid:{getNormalizedBoneNode:n=>nodes[n]}},inside=new THREE.Vector3(.03,1.3,.01);
body.updateMatrixWorld(true);solveArmIK(nodes.leftUpperArm,nodes.leftLowerArm,nodes.leftHand,inside);
const initial=nodes.leftHand.getWorldPosition(new THREE.Vector3()),pose=nodes.leftUpperArm.quaternion.clone(),cloth=bone('Cape','hips',[0,.2,-.1]),clothPose=cloth.quaternion.clone();
const safety=createMotionFit(actorFit,{settings:()=>({enabled:true,strength:1})});safety.apply();const corrected=nodes.leftHand.getWorldPosition(new THREE.Vector3());assert.ok(corrected.distanceTo(initial)>.015,'Hand was not moved out of the torso');assert.ok(cloth.quaternion.angleTo(clothPose)<1e-6,'Cloth bone changed');
assert.ok(corrected.distanceTo(initial)<=.5*.38+1e-5,'Correction exceeded its displacement limit');assert.ok(safety.diagnostics().lastCorrection.goalError<1e-5,'IK failed to reach corrected target');
for(let i=0;i<60;i++){safety.apply();assert.ok(nodes.leftHand.getWorldPosition(new THREE.Vector3()).distanceTo(corrected)<1e-5,'Paused-frame correction accumulated');}
safety.restore();assert.ok(nodes.leftUpperArm.quaternion.angleTo(pose)<1e-6,'Disabling did not restore source pose');

globalThis.window=globalThis;globalThis.document={createElementNS(){return {addEventListener(){},removeEventListener(){},set src(v){}};}};
const load=path=>{const b=fs.readFileSync(path);return new CompatibleFBXLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const directory=process.env.VRM_TEST_ASSET_ROOT || 'work/v030-environment-fixture/assets/';
if(!fs.existsSync(directory+'fbxCharacter/贝当元帅.fbx') || !fs.existsSync(directory+'motion/移动_女性走路.fbx')) {
  console.log('PASS: synthetic arm IK, preserved lengths/wrist, unreachable targets, per-role profiles, displacement bounds and restoration. SKIP optional real-model integration: supply VRM_TEST_ASSET_ROOT.');
  process.exit(0);
}
const actor=createFbxActor(load(directory+'fbxCharacter/贝当元帅.fbx'));
actor.scene.updateMatrixWorld(true);const before=new Map(actor.bones.values().map(b=>[b,b.quaternion.clone()]));
const exported=exportMixamoWhite(actor),roundtrip=new CompatibleFBXLoader().parse(exported.buffer,''),white=createFbxActor(roundtrip);
assert.ok(exported.stats.vertices>1000);assert.ok(exported.stats.bones>=50);assert.equal(new DataView(exported.buffer).getUint32(23,true),7300,'Mixamo requires the FBX 2013 writer');
for(const [b,q]of before)assert.ok(b.quaternion.angleTo(q)<1e-5,'Export changed source pose');
const obj=exportMixamoObj(actor),objText=new TextDecoder().decode(obj.buffer);assert.equal(obj.stats.bones,0);assert.equal(objText.split('\n').filter(l=>l.startsWith('v ')).length,exported.stats.vertices);assert.equal(objText.split('\n').filter(l=>l.startsWith('f ')).length,exported.stats.triangles);
const originalBounds=new THREE.Box3().setFromObject(actor.scene,true),bounds=new THREE.Box3().setFromObject(white.scene,true);assert.ok(bounds.getSize(new THREE.Vector3()).y>10);assert.ok(bounds.getSize(new THREE.Vector3()).x>bounds.getSize(new THREE.Vector3()).y*.5);
const meshes=[];roundtrip.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});assert.equal(meshes.length,1);assert.ok(meshes[0].material.color.r>.5);assert.ok(!meshes[0].material.map);
assert.ok(meshes[0].geometry.attributes.normal?.count>1000,'White export lost surface normals');
assert.ok(meshes[0].skeleton.boneInverses.every(m=>m.elements.every(Number.isFinite)));
const motion=load(directory+'motion/移动_女性走路.fbx'),clip=retargetFbxClip(motion,white),mixer=new THREE.AnimationMixer(white.scene);mixer.clipAction(clip).play();mixer.update(.3);white.scene.updateMatrixWorld(true);assert.ok(new THREE.Box3().setFromObject(white.scene,true).getSize(new THREE.Vector3()).toArray().every(Number.isFinite));
const fit=createMotionFit(white);for(let i=0;i<180;i++){fit.restore();mixer.update(1/60);fit.apply();}assert.ok(fit.diagnostics().frames===180);fit.restore();
if(process.argv[2]){fs.mkdirSync(process.argv[2],{recursive:true});fs.writeFileSync(process.argv[2]+'/FBX测试.mixamo.fbx',new Uint8Array(exported.buffer));}
console.log(JSON.stringify({ok:true,ikPreservesLengthsAndWrist:true,unreachableTargetStable:true,perCharacterAndMotionSettings:true,binaryFbxRoundtrip:true,whiteSkinnedMesh:true,sourcePosePreserved:true,realFbx:exported.stats,mixamoMotionTracks:clip.tracks.length,fit:fit.diagnostics()}));

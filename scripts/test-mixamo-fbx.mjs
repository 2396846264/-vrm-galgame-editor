import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {CompatibleFBXLoader} from '../src/fbx-loader.js';
import {createFbxActor,retargetFbxClip} from '../src/fbx-character.js';
import {VRMStage} from '../src/renderer.js';

function rig(prefix, height, reference = false) {
  const scene = new THREE.Group(), hips = new THREE.Bone(), left = new THREE.Bone(), right = new THREE.Bone();
  hips.name=prefix+'Hips';left.name=prefix+'LeftArm';right.name=prefix+'RightArm';
  hips.position.y=height;hips.add(left,right);scene.add(hips);
  for (const bone of [hips,left,right]) bone.userData.transformData={eulerOrder:'ZYX',preRotation:[0,0,0]};
  // The export's reference T pose differs from the actual bind axes.
  if(reference){left.rotation.z=.3;right.rotation.z=-.4;}
  scene.add(new THREE.SkinnedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));
  scene.updateMatrixWorld(true);return {scene,hips,left,right};
}
const source=rig('mixamorig',100,true),target=rig('mixamorig:',2);
const aim=new THREE.Quaternion().setFromEuler(new THREE.Euler(.4,-.2,.6));
source.scene.animations=[new THREE.AnimationClip('Idle Crouching Aiming',1,[
  new THREE.QuaternionKeyframeTrack(source.left.name+'.quaternion',[0,1],[...aim.toArray(),...aim.toArray()]),
  new THREE.VectorKeyframeTrack(source.hips.name+'.position',[0,1],[10,48,20,12,50,25])])];
const actor=createFbxActor(target.scene),placed=new THREE.Group();placed.rotation.y=1.2;placed.add(target.scene);placed.updateMatrixWorld(true);
const clip=retargetFbxClip(source.scene,actor);
const output=new THREE.Quaternion().fromArray(clip.tracks[0].values).normalize();
assert.ok(output.angleTo(aim)<1e-6,'Reference T pose was subtracted a second time');
assert.deepEqual([...clip.tracks[1].values].map(v=>Math.round(v*100)/100),[0,.96,0,.04,1,.1]);
const mixer=new THREE.AnimationMixer(target.scene);mixer.clipAction(clip).play();mixer.update(0);
assert.ok(target.left.quaternion.angleTo(aim)<1e-6);assert.ok(Math.abs(target.hips.position.y-.96)<1e-6);
const unitySource=rig('mixamorig',100,true),unityTarget=rig('mixamorig:',2);
for(const bone of [unitySource.hips,unitySource.left,unitySource.right])bone.userData.transformData={eulerOrder:'ZYX'};
unitySource.scene.animations=[new THREE.AnimationClip('Unity FBX',1,[new THREE.QuaternionKeyframeTrack(unitySource.left.name+'.quaternion',[0,1],[...unitySource.left.quaternion.toArray(),...unitySource.left.quaternion.toArray()])])];
const unityClip=retargetFbxClip(unitySource.scene,createFbxActor(unityTarget.scene));
assert.ok(new THREE.Quaternion().fromArray(unityClip.tracks[0].values).normalize().angleTo(unityTarget.left.quaternion)<1e-6,'FBX with baked bind axes lost its local rotation');

// VRM uses normalized T-pose bones; retain that rotation mapping but preserve
// the source's initial crouch height and animated root-parent displacement.
const normalizedHips=new THREE.Bone();normalizedHips.name='normalizedHips';
const vrm={humanoid:{normalizedRestPose:{hips:{position:[0,2,0]}},getNormalizedBoneNode:name=>name==='hips'?normalizedHips:null},meta:{metaVersion:'1'}};
const vrmClip=VRMStage.loadMixamo(source.scene,vrm);
const position=vrmClip.tracks.find(t=>t.name.endsWith('.position'));
assert.deepEqual([...position.values].map(v=>Math.round(v*100)/100),[0,.96,0,.04,1,.1]);
const finger=new THREE.Bone();finger.name='mixamorigRightHandIndex3';source.left.add(finger);
const normalizedFinger=new THREE.Bone();normalizedFinger.name='normalizedRightIndexDistal';
source.scene.animations[0].tracks.push(new THREE.QuaternionKeyframeTrack(finger.name+'.quaternion',[0,1],[...aim.toArray(),...aim.toArray()]));
vrm.humanoid.getNormalizedBoneNode=name=>name==='hips'?normalizedHips:name==='rightIndexDistal'?normalizedFinger:null;
const fingers=VRMStage.loadMixamo(source.scene,vrm).tracks.filter(t=>t.name===normalizedFinger.name+'.quaternion');
assert.equal(fingers.length,1,'Mixamo finger tracks were discarded for VRM');
console.log(JSON.stringify({ok:true,referencePoseIsNotBindPose:true,placementYawIndependent:true,crouchHeightPreserved:true,vrmCrouchHeightPreserved:true,vrmFingerTracksPreserved:true}));

// Optional local acceptance with the author's assets. They are never committed.
if(process.argv[2]&&process.argv[3]){
  globalThis.window=globalThis;globalThis.document={createElementNS(){return {addEventListener(){},removeEventListener(){},set src(value){}};}};
  const load=path=>{const b=fs.readFileSync(path);return new CompatibleFBXLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
  const model=load(process.argv[2]),motion=load(process.argv[3]),person=createFbxActor(model),converted=retargetFbxClip(motion,person);
  let maximumError=0,keys=0;
  for(const track of motion.animations[0].tracks){
    if(!track.name.endsWith('.quaternion'))continue;
    const name=track.name.slice(0,track.name.lastIndexOf('.')).replace(/^.*mixamorig:?/i,''),bone=person.bones.get(name);
    if(!bone)continue;const out=converted.tracks.find(t=>t.name===bone.uuid+'.quaternion');
    for(let i=0;i<track.values.length;i+=4){
      const a=new THREE.Quaternion().fromArray(track.values,i).normalize(),b=new THREE.Quaternion().fromArray(out.values,i).normalize();
      maximumError=Math.max(maximumError,a.angleTo(b));keys++;
    }
  }
  assert.ok(keys>500,'The real animation was not checked');
  assert.ok(maximumError<.001,'Same-character Mixamo export no longer matches its original rotations');
  const srcHip=motion.getObjectByName('mixamorigHips')||motion.getObjectByName('mixamorig:Hips');
  const srcPosition=motion.animations[0].tracks.find(t=>t.name===srcHip.name+'.position');
  const destPosition=converted.tracks.find(t=>t.name===person.bones.get('Hips').uuid+'.position');
  const ratio=person.rest.get(person.bones.get('Hips')).position.y/srcHip.position.y;
  assert.ok(Math.abs(destPosition.values[1]-srcPosition.values[1]*ratio)<.0001);
  console.log(JSON.stringify({ok:true,realFile:process.argv[3].split(/[\\/]/).at(-1),quaternionKeys:keys,maximumErrorDegrees:maximumError*180/Math.PI,sourceHipY:srcPosition.values[1],convertedHipY:destPosition.values[1],ratio}));
}

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {migrateDialogueCast,copyDialogueCast,setDialogueActor} from '../src/dialogue-cast.js';
import {CharacterProps,propBone,updatePropTransform,validatePropBinding,availablePropBones} from '../src/character-props.js';
import {createFbxActor} from '../src/fbx-character.js';

const fingerScene=new THREE.Group(),fingerNodes={};fingerScene.add(new THREE.SkinnedMesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial()));
for(const name of ['Hips','LeftArm','RightArm','RightHand','RightHandIndex1','RightHandIndex2','RightHandIndex3','LeftHandThumb1','LeftHandThumb2','LeftHandThumb3']){const bone=new THREE.Bone();bone.name='mixamorig'+name;fingerScene.add(bone);fingerNodes[name]=bone;}
const fingerRecord={vrm:createFbxActor(fingerScene)};
assert.equal(propBone(fingerRecord,'rightIndexDistal'),fingerNodes.RightHandIndex3);assert.equal(propBone(fingerRecord,'leftThumbMetacarpal'),fingerNodes.LeftHandThumb1);
assert(availablePropBones(fingerRecord).some(b=>b.value==='rightIndexDistal'&&b.label==='右手食指第三节'));
assert(!availablePropBones(fingerRecord).some(b=>b.value==='leftLittleDistal'));

const old={characters:[{id:'a'},{id:'b'},{id:'c'},{id:'d'}],acts:[{id:'act',cast:{left:'a',center:'b',right:'c'},castSettings:{left:{size:1.5,offsetX:.2,offsetZ:1,motionId:'idle',expressionWeights:{happy:.2}}},steps:[{id:'one',characterId:'a',size:2.3,offsetX:.1,offsetZ:2,motionId:'wave',expressionWeights:{happy:.7},castPositions:{a:'right',c:'left'}},{id:'two',characterId:'d',text:'场外说话'}]}]};
migrateDialogueCast(old);const [first,second]=old.acts[0].steps;
assert.equal(first.cast.right.characterId,'a');assert.equal(first.cast.right.size,3);assert(Math.abs(first.cast.right.offsetX-.3)<1e-8);assert.equal(first.cast.right.offsetZ,3);assert.equal(first.cast.right.motionId,'wave');assert.equal(first.cast.right.expressionWeights.happy,.7);
assert.equal(first.cast.left.characterId,'c');assert(!Object.values(second.cast).some(s=>s.characterId==='d'));assert(!old.acts[0].cast);assert(!first.motionId);
const snapshot=JSON.stringify(old);migrateDialogueCast(old);assert.equal(JSON.stringify(old),snapshot);
const copied={id:'copy',cast:copyDialogueCast(first)};copied.cast.right.offsetZ=9;copied.cast.right.props.push('gun');assert.equal(first.cast.right.offsetZ,3);assert.deepEqual(first.cast.right.props,[]);
setDialogueActor(copied,'left','d');assert.equal(copied.cast.left.characterId,'d');assert.equal(first.cast.left.characterId,'c');setDialogueActor(copied,'center','a');assert.equal(copied.cast.center.characterId,'a');assert.equal(copied.cast.right.characterId,'b');
const empty={characters:[],acts:[{steps:[{id:'empty',cast:{left:{characterId:''},center:{characterId:''},right:{characterId:''}}}]}]};migrateDialogueCast(empty);assert(Object.values(empty.acts[0].steps[0].cast).every(s=>!s.characterId));

function rig(scale=1){const anchor=new THREE.Group(),model=new THREE.Group(),hand=new THREE.Bone();model.scale.setScalar(scale);hand.name='RightHand';hand.position.set(1,2,0);anchor.add(model);model.add(hand);anchor.scale.setScalar(1.5);return {anchor,hand,vrm:{scene:model,humanoid:{getNormalizedBoneNode:()=>hand}}};}
const binding={id:'gun',assetId:'asset',bone:'rightHand',position:[.01,.02,.03],rotation:[0,90,0],scale:[1,1,1]},assets=[{id:'asset',type:'sceneModel'}];validatePropBinding(binding,assets);assert.throws(()=>validatePropBinding({...binding,scale:[0,1,1]},assets));assert.throws(()=>validatePropBinding(binding,[]));
for(const scale of [1,.01,100]){
  const record=rig(scale),root=new THREE.Group();record.hand.add(root);const attached={root,bone:record.hand,binding};updatePropTransform(record,attached);
  const delta=root.getWorldPosition(new THREE.Vector3()).sub(record.hand.getWorldPosition(new THREE.Vector3()));assert(delta.distanceTo(new THREE.Vector3(.015,.03,.045))<1e-8);assert(root.getWorldScale(new THREE.Vector3()).distanceTo(new THREE.Vector3(1.5,1.5,1.5))<1e-8);
  record.hand.rotation.z=Math.PI/2;updatePropTransform(record,attached);const turned=root.getWorldPosition(new THREE.Vector3()).sub(record.hand.getWorldPosition(new THREE.Vector3()));assert(turned.distanceTo(new THREE.Vector3(-.03,.015,.045))<1e-8);
}
const raw=new THREE.Bone(),normalized=new THREE.Bone();assert.equal(propBone({vrm:{humanoid:{getRawBoneNode:()=>raw,getNormalizedBoneNode:()=>normalized}}},'rightHand'),raw);
const runtime=new CharacterProps(()=>''),record=rig(.01);runtime.load=async()=>new THREE.Group();await runtime.sync(record,[binding],['gun'],assets);assert.equal(record.attachedProps.size,1);const retained=record.attachedProps.get('gun').root;assert.equal(retained.parent,record.hand);await runtime.sync(record,[binding],[],assets);assert.equal(record.attachedProps.size,1);assert.equal(retained.visible,false);await runtime.sync(record,[binding],['gun'],assets);assert.equal(record.attachedProps.get('gun').root,retained);assert.equal(retained.visible,true);
let finish;const pending=new Promise(resolve=>finish=resolve);runtime.load=()=>pending;const loading=runtime.sync(record,[binding],['gun'],assets),hiding=runtime.sync(record,[binding],[],assets);finish(new THREE.Group());await Promise.all([loading,hiding]);assert.equal(record.attachedProps.size,1);assert.equal(record.attachedProps.get('gun').root.visible,false);
console.log('PASS: legacy frame preservation, independent dialogue rosters, actor replacement, empty stage, VRM raw bones, FBX centimetre rigs, animated attachment, visibility and stale loading.');

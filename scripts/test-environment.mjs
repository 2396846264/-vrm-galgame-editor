import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeEmbeddedImageNames} from '../src/fbx-embedded-images.js';
import * as THREE from 'three';
import {createEnvironment,validateEnvironment,migrateEnvironments} from '../src/environment-schema.js';
import {createFbxActor,retargetFbxClip} from '../src/fbx-character.js';
import {EnvironmentRuntime} from '../src/environment-runtime.js';
const assets=[{id:'image',type:'image'},{id:'model',type:'sceneModel'}];
const env=createEnvironment();env.nodes=[{id:'group',kind:'group',parentId:null,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},{id:'board',kind:'imagePlane',assetId:'image',parentId:'group',position:[0,2,-6],rotation:[0,0,0],scale:[1,1,1],width:8,height:4.5}];
validateEnvironment(env,assets);assert.deepEqual(validateEnvironment(JSON.parse(JSON.stringify(env)),assets),env);
const invalid=structuredClone(env);invalid.nodes[0].parentId='board';assert.throws(()=>validateEnvironment(invalid,assets),/循环/);
const zero=structuredClone(env);zero.nodes[1].scale[0]=0;assert.throws(()=>validateEnvironment(zero,assets),/大小/);
assert.throws(()=>validateEnvironment(env,[]),/丢失/);
const project={assets:[{id:'image',type:'image'}],title:{},acts:[{name:'旧幕',backgroundId:'image'}]};migrateEnvironments(project);const first=project.acts[0].environmentId;migrateEnvironments(project);assert.equal(project.environments.length,1);assert.equal(project.acts[0].environmentId,first);assert.equal(project.acts[0].backgroundId,'image');
function rig(prefix,scale){const root=new THREE.Group(),hip=new THREE.Bone(),left=new THREE.Bone(),right=new THREE.Bone();hip.name=prefix+'Hips';left.name=prefix+'LeftArm';right.name=prefix+'RightArm';hip.position.y=scale;left.rotation.z=.3;hip.add(left,right);root.add(hip);const mesh=new THREE.SkinnedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());root.add(mesh);root.updateMatrixWorld(true);return {root,hip,left,right};}
const target=rig('mixamorig:',2),actor=createFbxActor(target.root),source=rig('mixamorig',100);
source.root.animations=[new THREE.AnimationClip('test',1,[new THREE.QuaternionKeyframeTrack(source.left.name+'.quaternion',[0,1],[...source.left.quaternion.toArray(),...new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,.8)).toArray()]),new THREE.VectorKeyframeTrack(source.hip.name+'.position',[0,1],[0,100,0,0,150,100])])];
const clip=retargetFbxClip(source.root,actor);assert.equal(clip.tracks.length,2);const rotation=clip.tracks.find(t=>t.name.endsWith('.quaternion'));assert.ok(new THREE.Quaternion().fromArray(rotation.values).angleTo(target.left.quaternion)<1e-6);const position=clip.tracks.find(t=>t.name.endsWith('.position'));assert.deepEqual([...position.values],[0,2,0,0,3,2]);assert.equal(actor.expressionManager,undefined);assert.equal(actor.isFbx,true);
const mixer=new THREE.AnimationMixer(target.root);mixer.clipAction(clip).play();mixer.update(.5);assert.ok(Math.abs(target.hip.position.y-2.5)<1e-6);assert.ok(Math.abs(target.hip.position.z-1)<1e-6);
assert.throws(()=>createFbxActor(new THREE.Group()),/身体/);
const mixed=rig('mixamorig',100);mixed.root.animations=[new THREE.AnimationClip('body-and-face',1,[new THREE.QuaternionKeyframeTrack(mixed.left.name+'.quaternion',[0,1],[0,0,0,1,0,0,0,1]),new THREE.NumberKeyframeTrack('face.morphTargetInfluences[0]',[0,1],[0,1])])];const bodyOnly=createFbxActor(mixed.root);assert.equal(bodyOnly.idleClip.tracks.length,1);assert.ok(bodyOnly.idleClip.tracks[0].name.endsWith('.quaternion'));
console.log(JSON.stringify({ok:true,checks:['场景往返保存','层级循环拦截','零缩放拦截','缺失素材拦截','旧背景迁移不重复','Mixamo 骨骼名称对应','动作比例校正','身体动画实际求值','FBX 无表情通道','动作文件不能冒充人物']}));
const skyEnv=createEnvironment();skyEnv.nodes=[{id:'sky',kind:'sky',name:'天空',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],color:'#86b8df'}];
const runtime=new EnvironmentRuntime(new THREE.Scene());await runtime.load(skyEnv,[]);
assert.equal(runtime.objects.get('sky').children[0].material.userData.outlineParameters.visible,false);
const sameRoot=runtime.root;await runtime.load({...skyEnv,revision:4},[]);assert.equal(runtime.root,sameRoot);
const changed=structuredClone(skyEnv);changed.nodes[0].color='#557799';await runtime.load(changed,[]);assert.notEqual(runtime.root,sameRoot);runtime.clear();
console.log(JSON.stringify({skySkippedByOutline:true,saveRevisionDoesNotReloadScene:true,actualEditReloads:true}));


if(process.argv[2]){const file=readFileSync(process.argv[2]);const original=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);const before=new Uint8Array(original).slice();const result=normalizeEmbeddedImageNames(original);assert.equal(result.byteLength,original.byteLength);assert.deepEqual(new Uint8Array(original),before);const changed=new Uint8Array(result).filter((v,i)=>v!==before[i]).length;assert.ok(changed>0&&changed<40);console.log(JSON.stringify({embeddedImageRepair:true,originalUnchanged:true,changedBytes:changed}));}

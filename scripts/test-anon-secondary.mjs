import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MMDParser} from '../src/mmd-parser-compat.js';
import {mapMmdBones} from '../src/mmd-actor.js';
import {createMmdContactTails} from '../src/mmd-physics.js';
import {createSecondaryMotionLimits,secondaryMotionKind} from '../src/secondary-motion.js';

const file=process.argv[2];if(!file)throw Error('Pass the supplied Anon PMX path');
const bytes=fs.readFileSync(file),data=MMDParser.parsePmx(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),true);
const mesh=new THREE.SkinnedMesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial());
const bones=data.bones.map(b=>Object.assign(new THREE.Bone(),{name:b.name}));
for(let i=0;i<bones.length;i++){const b=data.bones[i],parent=data.bones[b.parentIndex];bones[i].position.fromArray(b.position);if(parent){bones[i].position.sub(new THREE.Vector3().fromArray(parent.position));bones[b.parentIndex].add(bones[i]);}else mesh.add(bones[i]);}
mesh.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton(bones));
mesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.vertices.flatMap(v=>v.position),3));
mesh.geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.vertices.flatMap(v=>[...v.skinIndices,0,0,0,0].slice(0,4)),4));
mesh.geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(data.vertices.flatMap(v=>[...v.skinWeights,0,0,0,0].slice(0,4)),4));
const dynamic=data.rigidBodies.filter(b=>b.type&&b.boneIndex>=0).map(b=>({bone:bones[b.boneIndex],params:{...b,position:b.position.map((p,i)=>p-data.bones[b.boneIndex].position[i])}}));
const tails=createMmdContactTails(dynamic),human=mapMmdBones(bones),rest=bones.map(b=>({b,p:b.position.clone(),q:b.quaternion.clone()}));
const hair=dynamic.filter(d=>secondaryMotionKind(d.bone.name)==='hair');assert(hair.length>10);assert(hair.some(d=>tails.has(d.bone)),'Unconnected hair tips must be protected');
const guard=createSecondaryMotionLimits(mesh,dynamic.map(d=>d.bone),{getBone:n=>human[n]?.node,tails});
const started=performance.now();let maxLocal=0,maxChain=0;
for(let frame=0;frame<120;frame++){
 for(const {b,p,q}of rest){b.position.copy(p);b.quaternion.copy(q);}
 human.head.node.rotation.y=Math.sin(frame*.09)*.85;
 if(frame===40){mesh.position.x+=30;mesh.rotation.y=.7;mesh.scale.setScalar(.1);guard.reset();}
 mesh.updateWorldMatrix(true,true);guard.capture();
 for(let i=0;i<hair.length;i++)hair[i].bone.rotation.z+=Math.sin(frame*.11+i*.15)*.48;
 guard.apply();const measure=guard.measure();maxLocal=Math.max(maxLocal,measure.localRatio);maxChain=Math.max(maxChain,measure.chainRatio);
 assert(measure.translation<1e-6,'Hair roots stretched');assert(bones.every(b=>b.quaternion.toArray().every(Number.isFinite)));
}
assert(maxLocal<=1.00001);assert(maxChain<=1.00001);assert(guard.diagnostics().segmentContacts>0);assert(guard.diagnostics().skirtLinks>0);
console.log(JSON.stringify({ok:true,model:data.metadata.modelName,bones:bones.length,hairBodies:hair.length,virtualHairTips:hair.filter(d=>tails.has(d.bone)).length,maxLocal,maxChain,averageFrameMs:(performance.now()-started)/120,diagnostics:guard.diagnostics()},null,2));

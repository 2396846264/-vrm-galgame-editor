import assert from 'node:assert/strict';
import * as THREE from 'three';
import {closestSegments} from '../src/secondary-collision.js';
import {createSecondaryMotionLimits,installFbxSecondaryMotion} from '../src/secondary-motion.js';
import {secondaryCollisionProfile,setMotionFitProfiles} from '../src/motion-fit.js';

const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),a=v(),b=v();
closestSegments(v(-1),v(1),v(0,-1),v(0,1),a,b);assert(a.distanceTo(b)<1e-10);
closestSegments(v(),v(),v(0,2),v(0,2),a,b);assert.equal(a.distanceTo(b),2);
closestSegments(v(),v(1),v(0,1),v(1,1),a,b);assert.equal(a.distanceTo(b),1);
function fixture(){
 const root=new THREE.Group(),bones={};
 const bone=(name,parent,p)=>{const n=new THREE.Bone();n.name=name;n.position.copy(p);(bones[parent]||root).add(n);bones[name]=n;return n;};
 bone('hips','',v(0,1));bone('chest','hips',v(0,.4));bone('head','chest',v(0,.2));
 for(const [side,x]of [['left',.1],['right',-.1]]){bone(side+'UpperLeg','hips',v(x));bone(side+'LowerLeg',side+'UpperLeg',v(0,-.5));bone(side+'Foot',side+'LowerLeg',v(0,-.5));}
 const hair=bone('Hair','chest',v(.2)),tip=bone('HairTip','Hair',v(0,-1));root.updateMatrixWorld(true);
 return {root,bones,bone,hair,tip,getBone:n=>bones[n]};
}
const f=fixture(),guard=createSecondaryMotionLimits(f.root,[f.hair],{getBone:f.getBone});guard.capture();
f.hair.rotation.z=-.5;guard.apply();
// Previously the tip was below the hips and the entire crossing went unnoticed.
const end=f.tip.getWorldPosition(v()),start=f.hair.getWorldPosition(v());
closestSegments(start,end,f.bones.hips.getWorldPosition(v()),f.bones.chest.getWorldPosition(v()),a,b);
assert(a.distanceTo(b)>=guard.diagnostics().bodyHeight*.055-.001,`Strand still crosses body: ${end.toArray()}`);
assert(guard.diagnostics().segmentContacts>0);assert(guard.diagnostics().residualPenetration<.001);
assert(guard.measure().localRatio<=1.000001);assert(f.hair.position.equals(v(.2)));
guard.setEnabled(false);f.hair.rotation.z=0;guard.capture();f.hair.rotation.z=-.5;guard.apply();assert(f.tip.getWorldPosition(v()).x<-.2);
assert.equal(guard.diagnostics().residualPenetration,null,'Disabled diagnostics must not report stale contacts');
guard.setEnabled(true);f.hair.rotation.z=0;guard.capture();const h=guard.diagnostics().bodyHeight;
f.bones.leftUpperLeg.rotation.x=1.4;f.bones.rightUpperLeg.rotation.x=1.4;f.bones.chest.rotation.z=.7;guard.capture();assert(Math.abs(h-guard.diagnostics().bodyHeight)<1e-9,'Crouch changed collider sizes');
f.root.scale.setScalar(.1);guard.capture();assert(Math.abs(guard.diagnostics().bodyHeight-h*.1)<1e-9);
// Detect a skirt ring, but never connect sleeves/capes to it.
const s=fixture(),selected=[];
s.bones.leftUpperLeg.position.set(.18,0,.08);
for(let i=0;i<8;i++){const angle=i*Math.PI/4,n=s.bone('Skirt'+i,'hips',v(Math.cos(angle)*.22,0,Math.sin(angle)*.22));s.bone('Hem'+i,n.name,v(0,-.45));selected.push(n);}
for(let i=0;i<4;i++){const n=s.bone('Sleeve'+i,'chest',v(.3,i*.02));s.bone('Cuff'+i,n.name,v(0,-.2));selected.push(n);}
const skirt=createSecondaryMotionLimits(s.root,selected,{getBone:s.getBone});skirt.capture();assert.equal(skirt.diagnostics().skirtLinks,8);
skirt.apply();assert(skirt.diagnostics().linkContacts>0,'Leg passing between skirt strips was missed');
for(let frame=0;frame<90;frame++){
 for(let i=0;i<8;i++)selected[i].rotation.set(Math.sin(frame*.1+i)*.3,0,Math.cos(frame*.1+i)*.3);
 skirt.apply();assert(skirt.measure().localRatio<=1.000001);assert(selected.every(n=>n.quaternion.toArray().every(Number.isFinite)));
}
// Profile is role-wide, defaults on for legacy projects, survives JSON save/load.
let roles=[{id:'role',secondaryCollision:false}];setMotionFitProfiles(()=>roles);
assert.equal(secondaryCollisionProfile('details:role'),false);roles=JSON.parse(JSON.stringify(roles));assert.equal(secondaryCollisionProfile('gallery:role'),false);
assert.equal(secondaryCollisionProfile('legacy'),true);delete roles[0].secondaryCollision;assert.equal(secondaryCollisionProfile('role'),true);
// Rigid FBX without weighted auxiliary bones must remain untouched.
assert.equal(installFbxSecondaryMotion({scene:new THREE.Group(),humanoid:{normalizedHumanBones:{}}}),null);
const fbx=fixture(),geometry=new THREE.BufferGeometry(),fbxBones=Object.values(fbx.bones),hairIndex=fbxBones.indexOf(fbx.hair);
geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.01,0,0,0,.01,0],3));
geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(Array(3).fill([hairIndex,0,0,0]).flat(),4));
geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(Array(3).fill([1,0,0,0]).flat(),4));
const skinned=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());fbx.root.add(skinned);fbx.root.updateMatrixWorld(true);skinned.bind(new THREE.Skeleton(fbxBones));
const fbxActor={scene:fbx.root,update(){},humanoid:{normalizedHumanBones:Object.fromEntries(Object.entries(fbx.bones).filter(([n])=>!/^Hair/.test(n)).map(([n,node])=>[n,{node}])),getNormalizedBoneNode:fbx.getBone}};
const fbxGuard=installFbxSecondaryMotion(fbxActor);assert(fbxGuard);fbx.hair.rotation.z=-.5;const raw=fbx.hair.quaternion.clone();fbxActor.update(1/60);
assert(fbxGuard.diagnostics().segmentContacts>0);fbxActor.beforeAnimation();assert(fbx.hair.quaternion.angleTo(raw)<1e-7,'FBX contact repair leaked into animation input');
console.log(JSON.stringify({ok:true,wholeStrandContact:true,disabledPreservesPose:true,crouchAndScaleStable:true,skirtRingOnly:true,legacyDefaultOn:true,profileRoundtrip:true,rigidFbxSafe:true,diagnostics:guard.diagnostics()}));

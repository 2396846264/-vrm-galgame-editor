import * as THREE from 'three';
import Ammo from 'ammojs-typed';
import {createPhysicsOutput} from './mmd-physics-output.js';
import {createSecondaryMotionLimits,secondaryMotionKind} from './secondary-motion.js';

let initialization,activeOwner=null,worlds=0,allocations=0;
export const mmdPhysicsStats=()=>({worlds,allocations});
async function engine(){
 return initialization||=(async()=>{
  const api=await import('@moeru/three-mmd');await api.initAmmo();
  // Track only objects created with `new`. Native getters return borrowed
  // pointers; they must never be destroyed by this owner.
  for(const key of Object.keys(Ammo))if(/^bt/.test(key)&&typeof Ammo[key]==='function'){
   const original=Ammo[key];Ammo[key]=new Proxy(original,{construct(target,args){const object=Reflect.construct(target,args);if(activeOwner&&!activeOwner.objects.has(object)){activeOwner.objects.add(object);allocations++;}return object;}});
  }
  return api.MMDPhysics;
 })();
}
export function withPhysicsModelFrame(mesh,callback){
 const parent=mesh.parent,position=mesh.position.clone(),rotation=mesh.quaternion.clone(),scale=mesh.scale.clone();mesh.updateWorldMatrix(true,true);
 const worldPosition=mesh.getWorldPosition(new THREE.Vector3()),worldRotation=mesh.getWorldQuaternion(new THREE.Quaternion()),worldScale=mesh.getWorldScale(new THREE.Vector3());
 try{mesh.parent=null;mesh.position.copy(worldPosition).divideScalar(Math.max(1e-8,Math.abs(worldScale.y)));mesh.quaternion.copy(worldRotation);mesh.scale.setScalar(1);mesh.updateMatrixWorld(true);return callback();}
 finally{mesh.parent=parent;mesh.position.copy(position);mesh.quaternion.copy(rotation);mesh.scale.copy(scale);mesh.updateMatrixWorld(true);}
}
export async function createMmdPhysics(mesh,{getBone}={}){
 const data=mesh.geometry.userData.MMD;if(!data.rigidBodies?.length)return null;
 const Physics=await engine(),owner={objects:new Set()},scope=callback=>{const previous=activeOwner;activeOwner=owner;try{return callback();}finally{activeOwner=previous;}};
 let physics;
 try{physics=scope(()=>new Physics(mesh,data.rigidBodies,data.constraints,{unitStep:1/65,maxStepNum:3}));}
 catch(error){for(const object of [...owner.objects].reverse()){Ammo.destroy(object);allocations--;}throw error;}
 worlds++;const zero=scope(()=>new Ammo.btVector3(0,0,0));
 const dynamic=physics.bodies.filter(b=>b.params.type&&b.params.boneIndex!==-1);
 for(const b of dynamic){const cloth=secondaryMotionKind(b.bone.name)==='cloth';b.body.setDamping(Math.max(b.params.positionDamping||0,cloth?.6:.45),Math.max(b.params.rotationDamping||0,cloth?.75:.6));}
 const limits=createSecondaryMotionLimits(mesh,dynamic.map(b=>b.bone),{getBone});
 // Carry the complete Bullet world with the model frame. Sliding or rotating
 // a cast slot must not leave its hair bodies behind in stage coordinates.
 const carryTransform=scope(()=>new Ammo.btTransform()),carryVector=scope(()=>new Ammo.btVector3(0,0,0)),carryQuaternion=scope(()=>new Ammo.btQuaternion(0,0,0,1));
 const previousFrame=new THREE.Matrix4(),frameDelta=new THREE.Matrix4(),carryRotation=new THREE.Quaternion(),carryPosition=new THREE.Vector3(),carryBodyRotation=new THREE.Quaternion(),carryScale=new THREE.Vector3();let frameReady=false;
 const carryFrame=()=>{
  if(frameReady&&!needsReset&&!mesh.matrixWorld.equals(previousFrame)){
   frameDelta.copy(previousFrame).invert().premultiply(mesh.matrixWorld);frameDelta.decompose(carryPosition,carryRotation,carryScale);
   for(const b of physics.bodies){const tr=b.body.getCenterOfMassTransform(),p=tr.getOrigin(),q=tr.getRotation();
    carryPosition.set(p.x(),p.y(),p.z()).applyMatrix4(frameDelta);carryBodyRotation.set(q.x(),q.y(),q.z(),q.w()).premultiply(carryRotation);
    carryVector.setValue(carryPosition.x,carryPosition.y,carryPosition.z);carryQuaternion.setValue(carryBodyRotation.x,carryBodyRotation.y,carryBodyRotation.z,carryBodyRotation.w);carryTransform.setIdentity();carryTransform.setOrigin(carryVector);carryTransform.setRotation(carryQuaternion);
    b.body.setCenterOfMassTransform(carryTransform);b.body.getMotionState().setWorldTransform(carryTransform);b.body.setInterpolationWorldTransform?.(carryTransform);
    for(const [read,write]of [['getLinearVelocity','setLinearVelocity'],['getAngularVelocity','setAngularVelocity']]){const v=b.body[read]();carryPosition.set(v.x(),v.y(),v.z()).applyQuaternion(carryRotation);carryVector.setValue(carryPosition.x,carryPosition.y,carryPosition.z);b.body[write](carryVector);}
   }
  }previousFrame.copy(mesh.matrixWorld);frameReady=true;
 };
 // The port applies a large stop ERP (.475) to every joint. On small PMX
 // accessories, contacts and locked joints then repeatedly overcorrect.
 const correction=c=>c.bodyA.params.type===2||c.bodyB.params.type===2?.475:.2;
 for(const c of physics.constraints)for(let axis=0;axis<6;axis++)c.constraint.setParam(2,correction(c),axis);
 const output=createPhysicsOutput(mesh,physics.bodies);let smoothOutput=true;
 // Bullet remains unchanged. Batch its bone output in parent order instead
 // of recursively refreshing every descendant after every hair segment.
 const depth=bone=>{let n=0;for(let p=bone.parent;p;p=p.parent)n++;return n;};
 const sortedBodies=physics.bodies.slice().sort((a,b)=>depth(a.bone)-depth(b.bone));
 const nodes=new Set(mesh.skeleton.bones);nodes.add(mesh);const originals=[...nodes].map(node=>({node,update:node.updateMatrixWorld,local:node.worldToLocal})),inverses=new Map([...nodes].map(node=>[node,new THREE.Matrix4()]));
 physics._updateBones=()=>{
  const current=new Set(),inverseReady=new Set();
  const ensure=node=>{if(!node||current.has(node))return;if(node.parent)ensure(node.parent);if(node.matrixAutoUpdate)node.updateMatrix();if(node.parent)node.matrixWorld.multiplyMatrices(node.parent.matrixWorld,node.matrix);else node.matrixWorld.copy(node.matrix);current.add(node);};
  try{
   for(const {node}of originals){node.updateMatrixWorld=function(){current.delete(this);inverseReady.delete(this);ensure(this);};node.worldToLocal=function(vector){ensure(this);if(!inverseReady.has(this)){inverses.get(this).copy(this.matrixWorld).invert();inverseReady.add(this);}return vector.applyMatrix4(inverses.get(this));};}
   for(const body of sortedBodies){ensure(body.bone);body.updateBone();}
  }finally{for(const p of originals){p.node.updateMatrixWorld=p.update;p.node.worldToLocal=p.local;}}
 };
 const input=mesh.skeleton.bones.map(bone=>({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone()}));
 let inputReady=false,inputRestored=false,enabled=true,active=true,needsReset=true,disposed=false,lastTick=0,steps=0,resets=0,warmed=false,accumulator=0,quality='balanced',fixedStep=1/65;
 const previousPosition=new THREE.Vector3(),previousRotation=new THREE.Quaternion(),previousScale=new THREE.Vector3();let rootReady=false;
 const rootBone=['腰','下半身','センター'].map(name=>mesh.skeleton.bones.find(b=>b.name===name)).find(Boolean)||mesh;
 const saveInput=()=>{for(const p of input){p.position.copy(p.bone.position);p.quaternion.copy(p.bone.quaternion);}inputReady=true;};
 const reset=()=>{physics.reset();for(const body of physics.bodies){body.body.setLinearVelocity(zero);body.body.setAngularVelocity(zero);body.body.clearForces();body.body.activate(true);}output.reset();resets++;needsReset=false;accumulator=0;};
 const frame=delta=>{
  if(disposed||!enabled||!active)return;
  // Portrait/expression readbacks can update at zero time without an animation
  // restore. Never mistake the displayed physics pose for new animation input.
  if(delta>0||inputRestored||!inputReady)saveInput();inputRestored=false;mesh.updateWorldMatrix(true,true);
  const p=rootBone.getWorldPosition(new THREE.Vector3()),q=rootBone.getWorldQuaternion(new THREE.Quaternion()),s=mesh.getWorldScale(new THREE.Vector3()),now=performance.now();
  if(rootReady&&(p.distanceTo(previousPosition)>.75||q.angleTo(previousRotation)>Math.PI/2||s.distanceTo(previousScale)>.001))needsReset=true;
  if(delta>0&&lastTick&&now-lastTick>500)needsReset=true;if(delta>0)lastTick=now;
  previousPosition.copy(p);previousRotation.copy(q);previousScale.copy(s);rootReady=true;
  limits.capture();
  withPhysicsModelFrame(mesh,()=>scope(()=>{carryFrame();if(needsReset)reset();physics._updateRigidBodies();if(delta>0){const fixed=fixedStep;accumulator+=Math.min(delta,.05);const count=Math.min(quality==='full'?3:1,Math.floor((accumulator+1e-8)/fixed));if(count){physics.world.stepSimulation(count*fixed,count,fixed);steps+=count;accumulator=Math.min(accumulator-count*fixed,fixed);}}physics._updateBones();if(smoothOutput)output.apply(delta);}));
  limits.apply();
 };
 return {frame,restore(){if(inputReady){for(const p of input){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.quaternion);}inputRestored=true;}},reset(){this.restore();needsReset=true;},
  clearInput(){inputReady=false;needsReset=true;},
  measure:()=>limits.measure(),
  ...(typeof location!=='undefined'&&new URLSearchParams(location.search).has('smoke')?{configureProbe({legacy=false}={}){smoothOutput=!legacy;fixedStep=legacy?1/60:1/65;for(const c of physics.constraints)for(let axis=0;axis<6;axis++)c.constraint.setParam(2,legacy?.475:correction(c),axis);needsReset=true;}}:{}),
  setEnabled(value){if(enabled!==value){this.restore();enabled=value;needsReset=true;}},
  setActive(value){if(active!==value){active=value;needsReset=true;}},
  setQuality(value){quality=value==='full'?'full':'balanced';},
  async prepare(valid=()=>true){if(warmed||disposed)return;warmed=true;for(let batch=0;batch<10&&!disposed&&valid();batch++){for(let i=0;i<3;i++){this.restore();frame(1/60);}await new Promise(r=>setTimeout(r,0));}lastTick=0;},
  diagnostics:()=>({enabled,active,quality,engine:'Bullet / Ammo.js WebAssembly',bodies:physics.bodies.length,joints:physics.constraints.length,steps,resets,objects:owner.objects.size,secondaryMotionSmoothing:smoothOutput,fixedStep,secondaryMotionLimits:limits.diagnostics(),modelFrameTransport:true}),
  dispose(){if(disposed)return;disposed=true;for(const c of physics.constraints)physics.world.removeConstraint(c.constraint);for(const b of physics.bodies)physics.world.removeRigidBody(b.body);for(const object of [...owner.objects].reverse()){Ammo.destroy(object);allocations--;}owner.objects.clear();worlds--;}
 };
}

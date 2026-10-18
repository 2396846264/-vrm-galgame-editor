import * as THREE from 'three';

const names=['hips','spine','chest','upperChest','neck','head','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand'];
export function secondaryMotionKind(name='') {
 if(/hair|髪|髮|发|髮|劉海|前髪|後髪|横髪|アホ毛|ponytail|bang/i.test(name))return 'hair';
 if(/skirt|coat|cloth|dress|jacket|cape|sleeve|裙|衣|服|袖|裾|スカート|マント|ケープ/i.test(name))return 'cloth';
 return 'accessory';
}
const limits={hair:{local:.52,chain:.95},cloth:{local:.35,chain:.62},accessory:{local:.65,chain:1.05}};
const depth=node=>{let n=0;for(let p=node.parent;p;p=p.parent)n++;return n;};

// Limit the displayed secondary pose, never the animation or solver input.
// References are rebuilt from the current animated body, so turning, bending,
// VMD poses and parent/helper bones do not spend the accessory's swing budget.
export function createSecondaryMotionLimits(root,selected,{getBone=()=>null,reference=null,tails=new Map()}={}) {
 const human=new Map(names.map(n=>[n,getBone(n)]).filter(([,b])=>b)),bodyBones=new Set(human.values());
 const entries=[...new Set(selected)].filter(b=>b&&!bodyBones.has(b)).sort((a,b)=>depth(a)-depth(b)).map(bone=>({bone,kind:secondaryMotionKind(bone.name),p:new THREE.Vector3(),q:new THREE.Quaternion(),world:new THREE.Quaternion(),tail:tails.get(bone)?.clone()||bone.children.find(c=>c.isBone)?.position.clone()||null,clearance:new Map()}));
 const byBone=new Map(entries.map(e=>[e.bone,e])),proxies=[],referenceMatrices=new Map(),visited=new Set(),identity=new THREE.Matrix4();
 for(const e of entries)e.localMatrix=new THREE.Matrix4();
 const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),inverse=new THREE.Quaternion(),target=new THREE.Quaternion(),candidate=new THREE.Quaternion(),pivot=new THREE.Vector3(),tail=new THREE.Vector3(),startDirection=new THREE.Vector3(),nextDirection=new THREE.Vector3(),closest=new THREE.Vector3(),axis=new THREE.Vector3(),normal=new THREE.Vector3();
 let ready=false,bodyHeight=1,clamps=0,collisions=0;
 const point=b=>b?.getWorldPosition(new THREE.Vector3());
 function body(){
  proxies.length=0;const head=point(human.get('head')),hips=point(human.get('hips')),lf=point(human.get('leftFoot')),rf=point(human.get('rightFoot'));
  if(!head||!hips)return;
  bodyHeight=Math.max(.001,head.distanceTo(lf&&rf?lf.clone().add(rf).multiplyScalar(.5):hips)*1.12);
  const add=(key,a,b,r)=>{if(a&&b&&r>0)proxies.push({key,a,b,r});};
  const neck=point(human.get('neck')),chest=point(human.get('upperChest')||human.get('chest')||human.get('spine'));
  const up=head.clone().sub(neck||hips).normalize();add('head',head,head.clone().addScaledVector(up,bodyHeight*.055),bodyHeight*.047);
  add('torso',hips,chest,bodyHeight*.065);add('hips',hips,hips,bodyHeight*.07);
  for(const side of ['left','right']){
   const leg=point(human.get(side+'UpperLeg')),knee=point(human.get(side+'LowerLeg')),foot=point(human.get(side+'Foot'));
   add(side+'Thigh',leg,knee,bodyHeight*.043);add(side+'Shin',knee,foot,bodyHeight*.031);
   add(side+'Arm',point(human.get(side+'UpperArm')),point(human.get(side+'LowerArm')),bodyHeight*.026);
   add(side+'Forearm',point(human.get(side+'LowerArm')),point(human.get(side+'Hand')),bodyHeight*.021);
  }
 }
 function distance(p,c){axis.subVectors(c.b,c.a);const t=axis.lengthSq()>1e-12?THREE.MathUtils.clamp(position.subVectors(p,c.a).dot(axis)/axis.lengthSq(),0,1):0;closest.copy(c.a).addScaledVector(axis,t);return normal.subVectors(p,closest).length();}
 function relevant(e,c){return e.kind==='hair'?/head|torso/.test(c.key):e.kind==='cloth'?!/head/.test(c.key):/head|torso|hips/.test(c.key);}
 function constrain(e){
  const b=e.bone,l=limits[e.kind];let angle=e.q.angleTo(b.quaternion);
  if(!Number.isFinite(angle)){b.quaternion.copy(e.q);clamps++;}
  else if(angle>l.local){target.copy(b.quaternion);b.quaternion.copy(e.q).slerp(target,l.local/angle);clamps++;}
  b.updateMatrix();b.matrixWorld.multiplyMatrices(b.parent.matrixWorld,b.matrix);b.matrixWorld.decompose(position,rotation,scale);angle=e.world.angleTo(rotation);
  if(angle>l.chain){target.copy(e.world).slerp(rotation,l.chain/angle);b.parent.matrixWorld.decompose(position,inverse,scale);inverse.invert();b.quaternion.copy(inverse.multiply(target));
   angle=e.q.angleTo(b.quaternion);if(angle>l.local){target.copy(b.quaternion);b.quaternion.copy(e.q).slerp(target,l.local/angle);}b.updateMatrix();b.matrixWorld.multiplyMatrices(b.parent.matrixWorld,b.matrix);clamps++;
  }
 }
 return {
  capture(){
   root.updateWorldMatrix(true,true);body();visited.clear();
   const world=node=>{if(!node)return identity;if(visited.has(node))return referenceMatrices.get(node);const e=byBone.get(node),ref=reference?.get(node);let local;if(e){e.p.copy(ref?.position||node.position);e.q.copy(ref?.quaternion||node.quaternion);local=e.localMatrix.compose(e.p,e.q,node.scale);}else{node.updateMatrix();local=node.matrix;}const parent=world(node.parent);let m=referenceMatrices.get(node);if(!m){m=new THREE.Matrix4();referenceMatrices.set(node,m);}m.multiplyMatrices(parent,local);visited.add(node);return m;};
   for(const e of entries){const m=world(e.bone);m.decompose(position,e.world,scale);if(!e.tail||e.tail.lengthSq()<1e-12)continue;tail.copy(e.tail).applyMatrix4(m);
    for(const c of proxies)if(relevant(e,c)&&!e.clearance.has(c.key))e.clearance.set(c.key,Math.max(0,distance(tail,c)/bodyHeight-.003));
   }ready=true;
  },
  apply(){
   if(!ready)return;
   for(const e of entries){const b=e.bone;b.parent.updateWorldMatrix(true,false);b.position.copy(e.p);if(!Number.isFinite(b.quaternion.x+b.quaternion.y+b.quaternion.z+b.quaternion.w))b.quaternion.copy(e.q);constrain(e);
    if(!e.tail||e.tail.lengthSq()<1e-12)continue;
    pivot.setFromMatrixPosition(b.matrixWorld);tail.copy(e.tail).applyMatrix4(b.matrixWorld);const length=pivot.distanceTo(tail);if(length<1e-8)continue;
    startDirection.subVectors(tail,pivot).normalize();let hit=false;
    for(let pass=0;pass<3;pass++)for(const c of proxies){if(!relevant(e,c))continue;const radius=Math.min(c.r,(e.clearance.get(c.key)||0)*bodyHeight);if(radius<=0)continue;const d=distance(tail,c);if(d<radius){if(d<1e-8)normal.copy(startDirection);else normal.multiplyScalar(1/d);tail.addScaledVector(normal,radius-d);tail.sub(pivot).normalize().multiplyScalar(length).add(pivot);hit=true;collisions++;}}
    if(hit){nextDirection.subVectors(tail,pivot).normalize();candidate.setFromUnitVectors(startDirection,nextDirection);b.matrixWorld.decompose(position,rotation,scale);target.copy(candidate).multiply(rotation);b.parent.matrixWorld.decompose(position,inverse,scale);inverse.invert();b.quaternion.copy(inverse.multiply(target));constrain(e);}
   }root.updateMatrixWorld(true);
  },
  reset(){ready=false;},
  measure(){let localRatio=0,chainRatio=0,translation=0;for(const e of entries){localRatio=Math.max(localRatio,e.q.angleTo(e.bone.quaternion)/limits[e.kind].local);e.bone.getWorldQuaternion(rotation);chainRatio=Math.max(chainRatio,e.world.angleTo(rotation)/limits[e.kind].chain);translation=Math.max(translation,e.p.distanceTo(e.bone.position));}return {localRatio,chainRatio,translation};},
  diagnostics:()=>({bones:entries.length,clamps,collisions,limits})
 };
}

// Stage translation is a coordinate change, not a gust. Existing authored
// centres/colliders stay intact; world-space springs get a model-local centre.
export function installVrmSecondaryMotion(vrm){
 const manager=vrm.springBoneManager;if(!manager?.joints?.size)return null;
 const joints=[...manager.joints],reference=new Map(joints.map(j=>[j.bone,{position:j.bone.position.clone(),quaternion:j.bone.quaternion.clone()}]));
 for(const j of joints){if(!j.center)j.center=vrm.scene;const k=secondaryMotionKind(j.bone.name);j.settings.dragForce=Math.max(j.settings.dragForce||0,k==='cloth'?.7:.55);j.settings.stiffness=Math.max(j.settings.stiffness||0,k==='cloth'?4:2.5);}
 const guard=createSecondaryMotionLimits(vrm.scene,joints.map(j=>j.bone),{getBone:n=>vrm.humanoid.getRawBoneNode(n),reference,tails:new Map(joints.map(j=>[j.bone,j.initialLocalChildPosition]))});
 const original=manager.update.bind(manager),raw=new Map(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();let reset=true,rootReady=false,lastTime=0,resets=0;
 manager.update=delta=>{
  for(const [bone,q]of raw)bone.quaternion.copy(q);
  vrm.scene.updateWorldMatrix(true,true);vrm.scene.matrixWorld.decompose(p,q,s);const now=performance.now();
  if(rootReady&&(p.distanceTo(position)>.3||q.angleTo(rotation)>.6||s.distanceTo(scale)>.0001)||lastTime&&now-lastTime>350)reset=true;
  if(reset){manager.reset();guard.reset();resets++;reset=false;}position.copy(p);rotation.copy(q);scale.copy(s);rootReady=true;lastTime=now;
  guard.capture();const dt=Math.min(Math.max(0,delta),.05),steps=dt>0?Math.ceil(dt/(1/60)):1;
  for(let i=0;i<steps;i++)original(dt/steps);
  for(const j of joints){let pose=raw.get(j.bone);if(!pose){pose=new THREE.Quaternion();raw.set(j.bone,pose);}pose.copy(j.bone.quaternion);}guard.apply();
 };
 const previous=vrm.resetPhysics?.bind(vrm);vrm.resetPhysics=()=>{previous?.();raw.clear();reset=true;};
 return {diagnostics:()=>({...guard.diagnostics(),resets,modelLocalSprings:joints.filter(j=>j.center===vrm.scene).length}),measure:()=>guard.measure()};
}

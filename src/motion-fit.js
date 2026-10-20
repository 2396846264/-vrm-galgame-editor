import * as THREE from 'three';

let profiles=()=>[];
export function setMotionFitProfiles(resolve){profiles=resolve;}
const number=(v,f,min,max)=>Number.isFinite(Number(v))?THREE.MathUtils.clamp(Number(v),min,max):f;
export function normalizeMotionFit(value={}){
 return {enabled:value.enabled!==false,strength:number(value.strength,.85,0,1),clearance:number(value.clearance,.015,0,.08),bodyScale:number(value.bodyScale,1,.65,1.5)};
}
export function motionFitProfile(actorKey,motionId){const id=String(actorKey).replace(/^(gallery|details):/,'');const role=profiles()?.find(role=>role.id===id);return normalizeMotionFit(role?.motionFitOverrides?.[motionId]||role?.motionFit);}
const point=b=>b.getWorldPosition(new THREE.Vector3());
const unit=(x,y,z)=>new THREE.Vector3(x,y,z);
const percentile=(values,t,fallback)=>values.length?values.sort((a,b)=>a-b)[Math.floor((values.length-1)*t)]:fallback;

// Geometry is used only for conservative body-envelope estimates. Secondary
// bones and named loose garments must not make a cape count as a large torso.
export function estimateBodyEnvelope(vrm){
 const h=vrm.humanoid,get=n=>h.getRawBoneNode?.(n)||h.getNormalizedBoneNode(n),left=get('leftUpperArm'),right=get('rightUpperArm'),hip=get('hips'),neck=get('neck')||get('head');
 if(!left||!right||!hip||!neck)return {width:.16,depth:.12};
 vrm.scene.updateMatrixWorld(true);
 const width=point(left).distanceTo(point(right))*.45,height=point(neck).distanceTo(point(hip)),center=point(hip).lerp(point(neck),.65);
 const x=point(left).sub(point(right)).normalize(),y=point(neck).sub(point(hip)).normalize(),z=x.clone().cross(y).normalize();
 const torso=new Set(['hips','spine','chest','upperChest'].map(get).filter(Boolean)),depths=[];
 vrm.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||/cape|cloak|skirt|sleeve|hair|披风|裙|袖|髪|マント/i.test(mesh.name))return;
  const g=mesh.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,p=g.attributes.position;if(!si||!sw)return;
  for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/5000))){
   let weight=0;for(let j=0;j<4;j++)if(torso.has(mesh.skeleton.bones[si.getComponent(i,j)]))weight+=sw.getComponent(i,j);
   if(weight<.7)continue;
   const v=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).sub(center);
   if(Math.abs(v.dot(x))<width*.9&&Math.abs(v.dot(y))<height*.35)depths.push(Math.abs(v.dot(z)));
  }
 });
 return {width,depth:THREE.MathUtils.clamp(percentile(depths,.8,width*.72),width*.55,width*1.15)};
}

// Analytic two-bone IK, preserving lengths and the animated wrist rotation.
// The animated elbow is the bend hint; helpers/twist bones may lie in the chain.
export function solveArmIK(upper,lower,hand,target){
 const a=point(upper),b=point(lower),c=point(hand),l1=a.distanceTo(b),l2=b.distanceTo(c);
 if(l1<1e-6||l2<1e-6)return false;
 const wrist=hand.getWorldQuaternion(new THREE.Quaternion()),direction=target.clone().sub(a),distance=THREE.MathUtils.clamp(direction.length(),Math.abs(l1-l2)+1e-5,l1+l2-1e-5);
 if(direction.lengthSq()<1e-12)return false;direction.normalize();
 const hint=b.clone().sub(a).addScaledVector(direction,-b.clone().sub(a).dot(direction));
 if(hint.lengthSq()<1e-10){hint.copy(unit(0,0,1)).addScaledVector(direction,-direction.z);if(hint.lengthSq()<1e-10)hint.copy(unit(0,1,0)).addScaledVector(direction,-direction.y);}
 hint.normalize();const cos=THREE.MathUtils.clamp((l1*l1+distance*distance-l2*l2)/(2*l1*distance),-1,1);
 const elbow=a.clone().addScaledVector(direction,l1*cos).addScaledVector(hint,l1*Math.sqrt(Math.max(0,1-cos*cos)));
 const rotate=(bone,from,to)=>{if(from.lengthSq()<1e-12||to.lengthSq()<1e-12)return;const delta=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent)).normalize();bone.updateWorldMatrix(false,true);};
 rotate(upper,b.sub(a),elbow.sub(a));
 const end=a.clone().addScaledVector(direction,distance);
 rotate(lower,point(hand).sub(point(lower)),end.sub(point(lower)));
 hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wrist));hand.updateWorldMatrix(false,true);return true;
}

export function createMotionFit(vrm,{settings=()=>normalizeMotionFit(),active=()=>true}={}){
 const h=vrm.humanoid,get=n=>h.getRawBoneNode?.(n)||h.getNormalizedBoneNode(n),arms=['left','right'].map(side=>({side,upper:get(side+'UpperArm'),lower:get(side+'LowerArm'),hand:get(side+'Hand')})).filter(a=>a.upper&&a.lower&&a.hand),hip=get('hips'),head=get('head'),neck=get('neck')||head;
 const saved=new Map(),envelope=estimateBodyEnvelope(vrm);let corrections=0,frames=0,maxCorrection=0,lastCorrection=null;
 const restore=()=>{for(const [bone,q]of saved)bone.quaternion.copy(q);saved.clear();};
 function apply(){
  restore();const s=normalizeMotionFit(settings());if(!s.enabled||!s.strength||!active()||!hip||!neck||arms.length!==2)return;
  vrm.scene.updateMatrixWorld(true);
  const origin=point(hip),top=point(neck),height=origin.distanceTo(top),x=point(arms[0].upper).sub(point(arms[1].upper)).normalize(),y=top.clone().sub(origin).normalize(),z=x.clone().cross(y).normalize();
  if(height<1e-5)return;
  // Scale with the live character, including a non-unit FBX root and placement.
  const width=point(arms[0].upper).distanceTo(point(arms[1].upper))*.45*s.bodyScale,depth=width*(envelope.depth/Math.max(envelope.width,1e-6)),padding=s.clearance*height/.55;
  const bodies=[{c:origin.clone().lerp(top,.65),r:unit(width, height*.42,depth)}, {c:origin.clone().lerp(top,.14),r:unit(width*.86,height*.26,depth*.9)}];
  if(head)bodies.push({c:point(head).lerp(top,.25),r:unit(width*.7,height*.24,depth*.9)});
  function project(p,radius){let changed=false;for(const body of bodies){const v=p.clone().sub(body.c),r=body.r.clone().addScalar(radius+padding),local=unit(v.dot(x)/r.x,v.dot(y)/r.y,v.dot(z)/r.z),d=local.length();if(d>=1)continue;if(d<1e-6)local.set(0,0,1);else local.divideScalar(d);p.copy(body.c).addScaledVector(x,local.x*r.x).addScaledVector(y,local.y*r.y).addScaledVector(z,local.z*r.z);changed=true;}return changed;}
  frames++;
  for(const arm of arms){
   for(const bone of [arm.upper,arm.lower,arm.hand])saved.set(bone,bone.quaternion.clone());
   const original=point(arm.hand),target=original.clone(),radius=width*.13;let changed=project(target,radius);
   // Sample the forearm as well as the wrist. Do not test the upper arm against
   // its shoulder socket, where overlap is intentional.
   const elbow=point(arm.lower);
   for(const t of [.35,.65]){const p=elbow.clone().lerp(original,t),out=p.clone();if(project(out,radius*.8)){target.add(out.sub(p).multiplyScalar(.55));changed=true;}}
   for(const suffix of ['MiddleProximal','IndexDistal','LittleDistal','ThumbDistal']){const finger=get(arm.side+suffix);if(!finger)continue;const p=point(finger),out=p.clone();if(project(out,radius*.3)){target.add(out.sub(p).multiplyScalar(.6));changed=true;}}
   if(changed){const delta=target.clone().sub(original),limit=height*.38;if(delta.length()>limit)delta.setLength(limit);target.copy(original).addScaledVector(delta,s.strength);const l1=point(arm.upper).distanceTo(point(arm.lower)),l2=point(arm.lower).distanceTo(original);solveArmIK(arm.upper,arm.lower,arm.hand,target);const actual=point(arm.hand);lastCorrection={height,width,l1,l2,requested:target.distanceTo(original),actual:actual.distanceTo(original),goalError:actual.distanceTo(target)};corrections++;maxCorrection=Math.max(maxCorrection,lastCorrection.actual);}
  }
 }
 return {apply,restore,diagnostics:()=>({frames,corrections,maxCorrection,envelope,lastCorrection,profile:normalizeMotionFit(settings())})};
}

// Fit the actual skin skeleton after normalized->raw transfer, before cloth.
// A normalized rig's world scale need not match its skin skeleton's scale.
// Never copy world-space IK coordinates directly between the two rigs.
export function installMotionFit(vrm,options){
 const fit=createMotionFit(vrm,options),before=vrm.beforeAnimation?.bind(vrm),update=vrm.update.bind(vrm);
 vrm.beforeAnimation=()=>{fit.restore();before?.();};
 const humanoid=vrm.normalizedRig?.humanoid||(!vrm.isFbx?vrm.humanoid:null);
 if(humanoid?.update){const transfer=humanoid.update.bind(humanoid);humanoid.update=(...args)=>{fit.restore();transfer(...args);fit.apply();};}
 else vrm.update=delta=>{fit.apply();update(delta);};
 vrm.motionFit=fit;return fit;
}

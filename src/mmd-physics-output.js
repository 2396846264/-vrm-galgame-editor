import * as THREE from 'three';

// Smooth only secondary motion, in the moving body's reference frame. The
// animation and Bullet poses stay separate: this output never feeds the solver.
export function createPhysicsOutput(mesh,bodies,{response=.065}={}){
 const dynamic=new Set(bodies.filter(b=>b.params.type&&b.params.boneIndex!==-1).map(b=>b.bone));
 const depth=b=>{let n=0;for(let p=b.parent;p;p=p.parent)n++;return n;};
 const anchors=new Map(),entries=[...dynamic].sort((a,b)=>depth(a)-depth(b)).map(bone=>{
  let anchor=bone.parent;for(let p=bone.parent;p&&p!==mesh;p=p.parent)if(dynamic.has(p))anchor=p.parent;anchor||=mesh;
  if(!anchors.has(anchor))anchors.set(anchor,{node:anchor,inverse:new THREE.Matrix4(),rotation:new THREE.Quaternion(),inverseRotation:new THREE.Quaternion()});
  return{bone,anchor:anchors.get(anchor),position:new THREE.Vector3(),rotation:new THREE.Quaternion(),targetPosition:new THREE.Vector3(),targetRotation:new THREE.Quaternion()};
 });
 let ready=false;
 const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),parentRotation=new THREE.Quaternion(),scale=new THREE.Vector3(),unused=new THREE.Vector3(),inverse=new THREE.Matrix4();
 return{reset(){ready=false;},apply(delta){
  // Zero-time pose/readback calls must neither advance nor restart smoothing.
  // The solver has already refreshed these world matrices. Rewalking the
  // entire skeleton here would undo the benefit of its batched bone output.
  if(!(delta>0)&&!ready)return;
  for(const a of anchors.values()){a.inverse.copy(a.node.matrixWorld).invert();a.node.matrixWorld.decompose(unused,a.rotation,scale);a.inverseRotation.copy(a.rotation).invert();}
  for(const e of entries)if(delta>0){e.bone.matrixWorld.decompose(e.targetPosition,e.targetRotation,scale);e.targetPosition.applyMatrix4(e.anchor.inverse);e.targetRotation.premultiply(e.anchor.inverseRotation);}
  const alpha=1-Math.exp(-Math.min(delta,.05)/response);
  const current=new Set([mesh]),ensure=node=>{if(!node||current.has(node))return;ensure(node.parent);node.updateMatrix();node.matrixWorld.multiplyMatrices(node.parent.matrixWorld,node.matrix);current.add(node);};
  for(const e of entries){
   if(!ready){e.position.copy(e.targetPosition);e.rotation.copy(e.targetRotation);}else if(delta>0){
    e.position.lerp(e.targetPosition,alpha);
    // A small constrained ornament can cross an Euler singularity in Bullet.
    // Reject abrupt residual flips while allowing the animated body to turn
    // immediately through its anchor. Normal, smaller sway uses only damping.
    const angle=e.rotation.angleTo(e.targetRotation),weight=angle>.5?Math.min(alpha,3*Math.min(delta,.05)/angle):alpha;
    e.rotation.slerp(e.targetRotation,weight);
   }
   position.copy(e.position).applyMatrix4(e.anchor.node.matrixWorld);rotation.copy(e.anchor.rotation).multiply(e.rotation);
   const parent=e.bone.parent;ensure(parent);inverse.copy(parent.matrixWorld).invert();e.bone.position.copy(position.applyMatrix4(inverse));parent.matrixWorld.decompose(unused,parentRotation,scale);e.bone.quaternion.copy(parentRotation.invert().multiply(rotation));current.delete(e.bone);ensure(e.bone);
  }
  ready=true;
 },count:entries.length};
}

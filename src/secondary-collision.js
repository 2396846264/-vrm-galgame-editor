import * as THREE from 'three';

const clamp=THREE.MathUtils.clamp;
const skirtName=/skirt|スカート|裙|裾/i;
const v=()=>new THREE.Vector3();

// Closest points on two finite segments, including collapsed/parallel segments.
export function closestSegments(a,b,c,d,outA,outB){
 const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,wx=d.x-c.x,wy=d.y-c.y,wz=d.z-c.z,rx=a.x-c.x,ry=a.y-c.y,rz=a.z-c.z;
 const aa=ux*ux+uy*uy+uz*uz,ee=wx*wx+wy*wy+wz*wz,f=wx*rx+wy*ry+wz*rz;let s=0,t=0;
 if(aa<1e-14&&ee<1e-14){outA.copy(a);outB.copy(c);return 0;}
 if(aa<1e-14)t=clamp(f/ee,0,1);
 else{const cc=ux*rx+uy*ry+uz*rz;if(ee<1e-14)s=clamp(-cc/aa,0,1);
  else{const bb=ux*wx+uy*wy+uz*wz,den=aa*ee-bb*bb;s=den>1e-14?clamp((bb*f-cc*ee)/den,0,1):0;t=(bb*s+f)/ee;
   if(t<0){t=0;s=clamp(-cc/aa,0,1);}else if(t>1){t=1;s=clamp((bb-cc)/aa,0,1);}
  }
 }
 outA.set(a.x+ux*s,a.y+uy*s,a.z+uz*s);outB.set(c.x+wx*t,c.y+wy*t,c.z+wz*t);return s;
}

// Automatic body envelopes and finite-thickness strand contacts. The native
// VRM/Bullet simulation remains the owner of dynamics; only its display pose
// is repaired here, and never fed back as next frame's animation input.
export function createSecondaryCollision(root,entries,human){
 const proxies=[],links=[],selected=new Map(entries.map(e=>[e.bone,e])),bodyBones=new Set(human.values());
 const a=v(),b=v(),ca=v(),cb=v(),normal=v(),refNormal=v(),point=v(),pivot=v(),tail=v(),local=v();
 const q=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),before=new THREE.Quaternion();
 const trial=new THREE.Quaternion(),searchAxes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)];
 const inverse=new THREE.Matrix4(),rootScale=v(),unused=v(),rootQ=new THREE.Quaternion();
 let calibrated=false,linked=false,enabled=true,baseHeight=1,height=1,contacts=0,segmentContacts=0,linkContacts=0,residual=0,residualBone='';
 const widths=new Map();
 const native=new Map(),nativeGroups=new Map();
 const world=n=>human.get(n)?.getWorldPosition(v());
 const span=(x,y)=>{const p=world(x),r=world(y);return p&&r?p.distanceTo(r):0;};
 const scale=()=>{root.matrixWorld.decompose(unused,rootQ,rootScale);return Math.max(1e-8,Math.max(Math.abs(rootScale.x),Math.abs(rootScale.y),Math.abs(rootScale.z)));};
 function calibrate(){
  const s=scale();
  // Summed limb lengths survive crouching, unlike a head-to-floor distance.
  let torso=0,previous='hips';
  for(const n of ['spine','chest','upperChest','neck','head'])if(human.has(n)){torso+=span(previous,n);previous=n;}
  const leg=Math.max(...['left','right'].map(side=>span(side+'UpperLeg',side+'LowerLeg')+span(side+'LowerLeg',side+'Foot')))
   ||Math.max(0,span('head','leftFoot')-torso,span('head','rightFoot')-torso);
  baseHeight=Math.max(.001,(torso+leg||span('hips','head')*2.65)*1.1/s);
  const shoulder=span('leftUpperArm','rightUpperArm')/s;
  widths.set('torso',clamp(shoulder*.29,baseHeight*.055,baseHeight*.085));
  // Skin samples refine radii, but are bounded by anatomy. Loose clothes,
  // spring-bone weights and long hair must not inflate the body envelope.
  const regions=new Map([['head',['head']],['leftThigh',['leftUpperLeg']],['rightThigh',['rightUpperLeg']]]);
  const samples=new Map([...regions.keys()].map(k=>[k,[]]));
  inverse.copy(root.matrixWorld).invert();
  root.traverse(mesh=>{
   if(!mesh.isSkinnedMesh||/hair|skirt|cape|cloak|袖|裙|髪/i.test(mesh.name))return;
   const g=mesh.geometry,si=g?.attributes.skinIndex,sw=g?.attributes.skinWeight,p=g?.attributes.position;
   if(!si||!sw||!p)return;
   const regionBones=new Map([...regions].map(([key,names])=>[key,new Set(names.map(n=>human.get(n)).filter(Boolean))]));
   for(let i=0;i<p.count;i+=Math.max(1,Math.ceil(p.count/1600))){
    let secondary=0;for(let j=0;j<4;j++)if(selected.has(mesh.skeleton.bones[si.getComponent(i,j)]))secondary+=sw.getComponent(i,j);
    if(secondary>.1)continue;
    for(const [key,bones]of regionBones){let weight=0;for(let j=0;j<4;j++)if(bones.has(mesh.skeleton.bones[si.getComponent(i,j)]))weight+=sw.getComponent(i,j);
     if(weight<.85)continue;
     const bone=[...bones][0];if(!bone)continue;
     mesh.getVertexPosition(i,local);local.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
     const center=bone.getWorldPosition(v()).applyMatrix4(inverse);
     // A bone-local transverse distance avoids treating limb length as radius.
     const end=bone.children.find(n=>n.isBone&&!selected.has(n));
     if(end){const axis=end.getWorldPosition(v()).applyMatrix4(inverse).sub(center).normalize();local.sub(center);local.addScaledVector(axis,-local.dot(axis));}
     else local.sub(center);
     const d=local.length();if(Number.isFinite(d)&&d>baseHeight*.01&&d<baseHeight*.15)samples.get(key).push(d);
    }
   }
  });
  for(const [key,values]of samples){values.sort((x,y)=>x-y);const nominal=baseHeight*(key==='head'?.05:.043);widths.set(key,values.length>=12?clamp(values[Math.floor(values.length*.45)],nominal*.8,nominal*1.2):nominal);}
  calibrated=true;
 }
 function body(){
  proxies.length=0;const s=scale();height=baseHeight*s;
  const add=(key,x,y,r)=>{if(x&&y&&r>0)proxies.push({key,a:x,b:y,r:r*s});};
  const head=world('head'),hips=world('hips'),neck=world('neck'),chest=world('upperChest')||world('chest')||world('spine');
  if(head&&hips){const up=head.clone().sub(neck||hips).normalize();add('head',head,head.clone().addScaledVector(up,height*.045),widths.get('head'));}
  add('neck',neck,head,baseHeight*.025);add('torso',hips,chest,widths.get('torso'));add('hips',hips,hips,baseHeight*.065);
  for(const side of ['left','right']){
   const upper=world(side+'UpperLeg'),knee=world(side+'LowerLeg'),foot=world(side+'Foot'),arm=world(side+'UpperArm');
   add(side+'Thigh',upper,knee,widths.get(side+'Thigh'));add(side+'Shin',knee,foot,baseHeight*.029);
   add(side+'Shoulder',chest,arm,baseHeight*.027);
   add(side+'Arm',arm,world(side+'LowerArm'),baseHeight*.024);
  }
 }
 const relevant=(e,c)=>e.kind==='hair'?/head|neck|torso|Shoulder/.test(c.key):e.skirt?/hips|Thigh|Shin/.test(c.key):e.kind==='cloth'?!/head|neck/.test(c.key):false;
 function endpoints(e){pivot.setFromMatrixPosition(e.bone.matrixWorld);tail.copy(e.tail).applyMatrix4(e.bone.matrixWorld);}
 function segment(e){endpoints(e);a.copy(pivot).lerp(tail,.18);b.copy(tail);}
 function radius(e,c){
  // Allow tight authored attachment zones, without turning an initially bad
  // pose into a permanent zero-radius body collider.
  const rest=e.contactClearance.get(c.key)??c.r/height;
  return Math.min(c.r+e.thickness*height,Math.max(c.r*.55,rest*height*.98));
 }
 function penetration(e,c){
  segment(e);const t=closestSegments(a,b,c.a,c.b,ca,cb),r=radius(e,c),d=ca.distanceTo(cb);
  return {depth:r-d,t,r,d};
 }
 function turn(e,from,to,constrain){
  endpoints(e);a.subVectors(from,pivot);b.subVectors(to,pivot);if(a.lengthSq()<1e-14||b.lengthSq()<1e-14)return;
  q.setFromUnitVectors(a.normalize(),b.normalize());e.bone.getWorldQuaternion(parentQ);q.multiply(parentQ);
  e.bone.parent.getWorldQuaternion(parentQ).invert();e.bone.quaternion.copy(parentQ.multiply(q)).normalize();constrain(e);
 }
 function score(e){let error=0;for(const c of proxies)if(relevant(e,c)){const p=penetration(e,c).depth;error+=Math.max(0,p)**2;}return error;}
 function solve(e,constrain){
  if(!e.tail||!enabled)return;
  let best=score(e);if(best<height*height*1e-10)return;
  const bestQ=e.bone.quaternion.clone();
  for(let pass=0;pass<4;pass++){
   for(const c of proxies){if(!relevant(e,c))continue;const hit=penetration(e,c);if(hit.depth<=height*.0001)continue;
    normal.subVectors(ca,cb);
    // Prefer the authored side when a strand has crossed the body's centre.
    closestSegments(e.contactRoot,e.contactTail,c.a,c.b,a,b);refNormal.subVectors(a,b);
    if(refNormal.lengthSq()>1e-12&&(hit.d<height*.002||normal.dot(refNormal)<0))normal.copy(refNormal);
    if(normal.lengthSq()<1e-12){normal.subVectors(e.contactTail,e.contactRoot).cross(new THREE.Vector3(0,1,0));if(normal.lengthSq()<1e-12)normal.set(0,0,1);}
    normal.normalize();point.copy(ca).addScaledVector(normal,hit.depth+height*.0002);a.copy(ca);turn(e,a,point,constrain);contacts++;segmentContacts++;
   }
   const error=score(e);if(error<best){best=error;bestQ.copy(e.bone.quaternion);}if(best<height*height*1e-10)break;
  }
  // A clear reference pose is a safe fallback when contact and swing limits
  // conflict. Search rather than blindly resetting every moving strand.
  before.copy(bestQ);
  if(best>height*height*1e-8)for(const weight of [.25,.5,.75,1]){
   e.bone.quaternion.copy(before).slerp(e.q,weight);constrain(e);const error=score(e);
   if(error<best){best=error;bestQ.copy(e.bone.quaternion);}
  }
  // A shoulder may block the straight route back to rest. Try a few bounded
  // rotations around the contact instead of pushing forever in one plane.
  if(best>height*height*2.5e-7)for(const step of [.12,.28,.48]){
   before.copy(bestQ);
   for(const axis of searchAxes)for(const sign of [-1,1]){
    trial.setFromAxisAngle(axis,step*sign);e.bone.quaternion.copy(before).multiply(trial);constrain(e);
    const error=score(e);if(error<best){best=error;bestQ.copy(e.bone.quaternion);}
   }
   if(best<height*height*2.5e-7)break;
  }
  e.bone.quaternion.copy(bestQ);constrain(e);
 }
 function buildLinks(){
  links.length=0;const layers=new Map(),hips=world('hips');if(!hips)return;
  const iq=human.get('hips').getWorldQuaternion(new THREE.Quaternion()).invert();
  for(const e of entries){if(!e.skirt||!e.tail)continue;let level=0;for(let p=e.bone.parent;p;p=p.parent)if(selected.get(p)?.skirt)level++;
   const center=e.contactTail.clone().sub(hips).applyQuaternion(iq);e.ringAngle=Math.atan2(center.z,center.x);
   if(!layers.has(level))layers.set(level,[]);layers.get(level).push(e);
  }
  for(const layer of layers.values()){
   if(layer.length<4||layer.length>32)continue;layer.sort((x,y)=>x.ringAngle-y.ringAngle);
   for(let i=0;i<layer.length;i++){const x=layer[i],y=layer[(i+1)%layer.length],angle=(y.ringAngle-x.ringAngle+Math.PI*2)%(Math.PI*2);
    const distance=x.contactTail.distanceTo(y.contactTail);
    if(angle>.05&&angle<1.8&&distance<height*.4&&Math.abs(x.contactTail.clone().sub(y.contactTail).applyQuaternion(iq).y)<height*.07)links.push({x,y});
   }
  }
 }
 return {
  capture(matrices){
   if(!calibrated)calibrate();body();
   for(const e of entries){e.skirt=false;for(let n=e.bone;n&&!bodyBones.has(n);n=n.parent){if(skirtName.test(n.name)){e.skirt=true;break;}}
    e.contactRoot??=v();e.contactTail??=v();e.contactClearance??=new Map();
    const m=matrices.get(e.bone);e.contactRoot.setFromMatrixPosition(m);if(!e.tail)continue;e.contactTail.copy(e.tail).applyMatrix4(m);
    e.thickness=clamp(e.contactRoot.distanceTo(e.contactTail)/height*.035,.0015,e.kind==='hair'?.006:.004);
    for(const c of proxies)if(relevant(e,c)&&!e.contactClearance.has(c.key)){
     a.copy(e.contactRoot).lerp(e.contactTail,.18);closestSegments(a,e.contactTail,c.a,c.b,ca,cb);e.contactClearance.set(c.key,ca.distanceTo(cb)/height);
    }
   }
   if(!linked){buildLinks();linked=true;}
  },
  solve,
  syncSpringColliders(joints,make){
   inverse.copy(root.matrixWorld).invert();const s=scale();let added=false;
   for(const c of proxies){let collider=native.get(c.key);
    if(!collider){collider=make();collider.name='AutomaticBody:'+c.key;root.add(collider);native.set(c.key,collider);added=true;}
    collider.shape.offset.copy(c.a).applyMatrix4(inverse);collider.shape.tail.copy(c.b).applyMatrix4(inverse);
    // Native contacts use the inner envelope; the output pass covers the full
    // strand thickness without fighting tight, authored attachment colliders.
    collider.shape.radius=c.r*.55/s;collider.updateWorldMatrix(true,false);
   }
   for(const j of joints){const e=selected.get(j.bone);if(!e)continue;let group=nativeGroups.get(j);
    if(!group){group={name:'Automatic body clearance',colliders:[]};nativeGroups.set(j,group);j.colliderGroups.push(group);added=true;}
    group.colliders=enabled?proxies.filter(c=>relevant(e,c)).map(c=>native.get(c.key)):[];
   }
   return added;
  },
  finish(constrain){
   if(!enabled)return;root.updateWorldMatrix(true,true);
   // Neighbour links protect the space between skirt strips. Only verified
   // skirt chains form rings; sleeves, capes and unrecognised rigs stay apart.
   for(const {x,y}of links){
    x.contactLive??=v();y.contactLive??=v();x.contactLive.copy(x.tail).applyMatrix4(x.bone.matrixWorld);y.contactLive.copy(y.tail).applyMatrix4(y.bone.matrixWorld);
    for(const c of proxies){if(!relevant(x,c))continue;
     closestSegments(x.contactLive,y.contactLive,c.a,c.b,ca,cb);const r=c.r+height*Math.min(x.thickness,y.thickness),d=ca.distanceTo(cb);if(d>=r)continue;
     normal.subVectors(ca,cb);if(d<height*.001)normal.copy(x.contactTail).add(y.contactTail).multiplyScalar(.5).sub(cb);if(normal.lengthSq()<1e-12)continue;
     normal.normalize().multiplyScalar(Math.min(r-d,height*.035));
     for(const e of [x,y]){point.copy(e.contactLive).add(normal);a.copy(e.contactLive);turn(e,a,point,constrain);}linkContacts++;
    }
   }
   residual=0;residualBone='';
   for(const e of entries){if(!e.tail)continue;e.bone.parent.updateWorldMatrix(true,false);constrain(e);solve(e,constrain);for(const c of proxies)if(relevant(e,c)){const d=penetration(e,c).depth;if(d>residual){residual=d;residualBone=e.bone.name+':'+c.key;}}}
  },
  setEnabled(value){enabled=value!==false;},
  diagnostics:()=>({enabled,bodyColliders:proxies.length,nativeBodyColliders:native.size,skirtLinks:links.length,contacts,segmentContacts,linkContacts,residualPenetration:enabled?Math.max(0,residual):null,residualBone:enabled?residualBone:'',bodyHeight:height})
 };
}

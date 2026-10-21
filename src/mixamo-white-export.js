import * as THREE from 'three';

export const mixamoJoints={Hips:['hips',null],Spine:['spine','Hips'],Spine1:['chest','Spine'],Spine2:['upperChest','Spine1'],Neck:['neck','Spine2'],Head:['head','Neck']};
for(const [side,human]of [['Left','left'],['Right','right']]){
 for(const [name,key,parent]of [['Shoulder','Shoulder','Spine2'],['Arm','UpperArm',side+'Shoulder'],['ForeArm','LowerArm',side+'Arm'],['Hand','Hand',side+'ForeArm'],['UpLeg','UpperLeg','Hips'],['Leg','LowerLeg',side+'UpLeg'],['Foot','Foot',side+'Leg'],['ToeBase','Toes',side+'Foot']])mixamoJoints[side+name]=[human+key,parent];
 for(const [finger,key]of [['Thumb','Thumb'],['Index','Index'],['Middle','Middle'],['Ring','Ring'],['Pinky','Little']]){
  const joints=finger==='Thumb'?['Metacarpal','Proximal','Distal']:['Proximal','Intermediate','Distal'];
  joints.forEach((joint,i)=>mixamoJoints[side+'Hand'+finger+(i+1)]=[human+key+joint,i?side+'Hand'+finger+i:side+'Hand']);
 }
}
const position=b=>b.getWorldPosition(new THREE.Vector3());
function align(bone,child,direction){if(!bone||!child)return;bone.updateWorldMatrix(true,true);const from=position(child).sub(position(bone));if(from.lengthSq()<1e-12)return;const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()),q=new THREE.Quaternion().setFromUnitVectors(from.normalize(),direction);bone.quaternion.premultiply(parent.clone().invert().multiply(q).multiply(parent));bone.updateWorldMatrix(false,true);}

// Export only the body and a simplified humanoid skeleton. Texture references,
// expressions, physics helpers and attached props never enter this exchange file.
export function captureMixamoWhite(vrm){
 const saved=[];vrm.scene.traverse(o=>saved.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone(),o.morphTargetInfluences?.slice()]));
 const get=n=>vrm.humanoid.getRawBoneNode?.(n)||vrm.humanoid.getNormalizedBoneNode(n);
 try{
  vrm.motionFit?.restore();vrm.humanoid.resetNormalizedPose();vrm.update(0);vrm.scene.updateMatrixWorld(true);
  for(const side of ['left','right'])for(const key of ['UpperArm','LowerArm','Hand','UpperLeg','LowerLeg','Foot'])if(!get(side+key))throw Error('白模导出缺少人体骨骼：'+side+key);
  const inverse=(vrm.scene.parent?.matrixWorld||new THREE.Matrix4()).clone().invert();
  const x=position(get('leftUpperArm')).sub(position(get('rightUpperArm'))).normalize(),up=new THREE.Vector3(0,1,0).transformDirection(vrm.scene.parent?.matrixWorld||new THREE.Matrix4());
  const right=x.clone().addScaledVector(up,-x.dot(up)).normalize();
  for(const [side,sign]of [['left',1],['right',-1]]){align(get(side+'UpperArm'),get(side+'LowerArm'),right.clone().multiplyScalar(sign));align(get(side+'LowerArm'),get(side+'Hand'),right.clone().multiplyScalar(sign));}
  vrm.scene.updateMatrixWorld(true);
  const local=b=>position(b).applyMatrix4(inverse),axis=local(get('leftUpperArm')).sub(local(get('rightUpperArm'))).normalize(),vertical=new THREE.Vector3(0,1,0),forward=axis.clone().cross(vertical).normalize();
  const hips=local(get('hips')),origin=new THREE.Vector3(hips.x,Math.min(local(get('leftFoot')).y,local(get('rightFoot')).y),hips.z);
  const convert=p=>{p.applyMatrix4(inverse).sub(origin);return new THREE.Vector3(p.dot(axis)*100,p.dot(vertical)*100,p.dot(forward)*100);};
  const joints=[],byBone=new Map(),byName=new Map();
  for(const [name,[human,parent]]of Object.entries(mixamoJoints)){
   const bone=get(human);if(!bone)continue;const joint={name:'mixamorig:'+name,key:name,parent,position:convert(position(bone)).toArray(),bone};joints.push(joint);byBone.set(bone,joints.length-1);byName.set(name,joint);
  }
  for(const joint of joints){let parent=joint.parent;while(parent&&!byName.has(parent))parent=mixamoJoints[parent]?.[1];joint.parent=parent||null;}
  const boneIndex=bone=>{for(let b=bone;b;b=b.parent)if(byBone.has(b))return byBone.get(b);return byBone.get(get('hips'));};
  const vertices=[],indices=[],weights=[];
  vrm.scene.traverse(mesh=>{
   if(!mesh.isSkinnedMesh||!mesh.visible||mesh.userData?.characterProp||/outline/i.test(mesh.name))return;
   // Props can be skinned too. Only meshes whose skeleton contains this actor.
   if(!mesh.skeleton.bones.some(b=>byBone.has(b)))return;
   const g=mesh.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,start=vertices.length/3;
   if(!p||!si||!sw)return;
   for(let i=0;i<p.count;i++){
    vertices.push(...convert(mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)).toArray());
    const merged=new Map();for(let k=0;k<4;k++){const weight=sw.getComponent(i,k);if(weight>0){const index=boneIndex(mesh.skeleton.bones[si.getComponent(i,k)]);merged.set(index,(merged.get(index)||0)+weight);}}
    const sum=[...merged.values()].reduce((a,b)=>a+b,0);weights.push(sum>0?[...merged].map(([j,w])=>[j,w/sum]):[[boneIndex(get('hips')),1]]);
   }
   const count=g.index?.count||p.count;for(let i=0;i+2<count;i+=3)indices.push(...[0,1,2].map(k=>start+(g.index?g.index.getX(i+k):i+k)));
  });
  if(!vertices.length||!indices.length)throw Error('没有可导出的蒙皮人物网格');
  if(vertices.some(v=>!Number.isFinite(v)))throw Error('人物顶点包含无效坐标');
  return {joints:joints.map(({bone,...joint})=>joint),vertices,indices,weights};
 }finally{for(const [o,p,q,s,m]of saved){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);if(m)o.morphTargetInfluences.splice(0,m.length,...m);}vrm.scene.updateMatrixWorld(true);}
}

// FBX 2013 (7.3) binary writer. Keep header, metadata and footer in sync:
// Mixamo's character mapper can reject later file versions.
export const MIXAMO_FBX_VERSION=7300;
// Explicit cluster bind matrices and bind-pose entries
// make this a skinned character, not a static mesh with renamed joints.
const node=(name,props=[],children=[])=>({name,props,children});
const scalar=(type,value)=>({type,value});
const I=v=>scalar('I',v),L=v=>scalar('L',v),D=v=>scalar('D',v),S=v=>scalar('S',v);
const A=(type,value)=>scalar(type,value);
const property=(name,type,...values)=>node('P',[S(name),S(type),S(''),S(type==='Vector3D'||type.startsWith('Lcl ')?'A':''),...values.map(type==='int'?I:D)]);
const matrix=p=>new THREE.Matrix4().makeTranslation(...p).toArray();
export function encodeMixamoFbx(data){
 const meshId=100001,geometryId=100002,materialId=100003,skinId=100004,poseId=100005,jointId=i=>200000+i,clusterId=i=>300000+i;
 const connections=[node('C',[S('OO'),L(meshId),L(0)]),node('C',[S('OO'),L(geometryId),L(meshId)]),node('C',[S('OO'),L(materialId),L(meshId)]),node('C',[S('OO'),L(skinId),L(geometryId)])];
 const normals=new Float64Array(data.vertices.length),v=new THREE.Vector3(),w=new THREE.Vector3(),n=new THREE.Vector3();
 for(let i=0;i<data.indices.length;i+=3){const [a,b,c]=data.indices.slice(i,i+3);v.fromArray(data.vertices,b*3).sub(new THREE.Vector3().fromArray(data.vertices,a*3));w.fromArray(data.vertices,c*3).sub(new THREE.Vector3().fromArray(data.vertices,a*3));n.crossVectors(v,w);for(const j of [a,b,c]){normals[j*3]+=n.x;normals[j*3+1]+=n.y;normals[j*3+2]+=n.z;}}
 for(let i=0;i<normals.length;i+=3){n.fromArray(normals,i);if(n.lengthSq()>1e-16)n.normalize();else n.set(0,1,0);n.toArray(normals,i);}
 const polygons=data.indices.map((v,i)=>i%3===2?-v-1:v),objects=[
  node('Model',[L(meshId),S('WhiteCharacter\0\x01Model'),S('Mesh')],[node('Version',[I(232)]),node('Properties70',[],[property('Lcl Translation','Lcl Translation',0,0,0),property('Lcl Rotation','Lcl Rotation',0,0,0),property('Lcl Scaling','Lcl Scaling',1,1,1)]),node('Culling',[S('CullingOff')])]),
  node('Geometry',[L(geometryId),S('WhiteBody\0\x01Geometry'),S('Mesh')],[node('Vertices',[A('d',data.vertices)]),node('PolygonVertexIndex',[A('i',polygons)]),node('LayerElementNormal',[I(0)],[node('Version',[I(101)]),node('Name',[S('')]),node('MappingInformationType',[S('ByVertice')]),node('ReferenceInformationType',[S('Direct')]),node('Normals',[A('d',normals)])]),node('LayerElementMaterial',[I(0)],[node('Version',[I(101)]),node('Name',[S('')]),node('MappingInformationType',[S('AllSame')]),node('ReferenceInformationType',[S('IndexToDirect')]),node('Materials',[A('i',[0])])]),node('Layer',[I(0)],[node('Version',[I(100)]),node('LayerElement',[],[node('Type',[S('LayerElementNormal')]),node('TypedIndex',[I(0)])]),node('LayerElement',[],[node('Type',[S('LayerElementMaterial')]),node('TypedIndex',[I(0)])])])]),
  node('Material',[L(materialId),S('White\0\x01Material'),S('')],[node('Version',[I(102)]),node('ShadingModel',[S('lambert')]),node('MultiLayer',[I(0)]),node('Properties70',[],[property('DiffuseColor','Color',.85,.85,.85),property('TransparencyFactor','Number',0)])]),
  node('Deformer',[L(skinId),S('Skin\0\x01Deformer'),S('Skin')],[node('Version',[I(101)]),node('Link_DeformAcuracy',[D(50)])])
 ];
 const poses=[node('PoseNode',[],[node('Node',[L(meshId)]),node('Matrix',[A('d',matrix([0,0,0]))])])],names=new Map(data.joints.map((j,i)=>[j.key,i]));
 const buckets=data.joints.map(()=>({indices:[],weights:[]}));data.weights.forEach((pairs,i)=>pairs.forEach(([j,w])=>{if(w>0){buckets[j].indices.push(i);buckets[j].weights.push(w);}}));
 data.joints.forEach((j,i)=>{
  const parent=names.get(j.parent),p=j.position.map((v,k)=>v-(parent===undefined?0:data.joints[parent].position[k]));
  objects.push(node('Model',[L(jointId(i)),S(j.name+'\0\x01Model'),S('LimbNode')],[node('Version',[I(232)]),node('Properties70',[],[property('Lcl Translation','Lcl Translation',...p),property('Lcl Rotation','Lcl Rotation',0,0,0),property('Lcl Scaling','Lcl Scaling',1,1,1),property('Size','double',1)])]));
  objects.push(node('NodeAttribute',[L(400000+i),S(j.name+'\0\x01NodeAttribute'),S('LimbNode')],[node('TypeFlags',[S('Skeleton')]),node('Properties70',[],[property('Size','double',1)])]));
  connections.push(node('C',[S('OO'),L(400000+i),L(jointId(i))]));
  connections.push(node('C',[S('OO'),L(jointId(i)),L(parent===undefined?0:jointId(parent))]));
  poses.push(node('PoseNode',[],[node('Node',[L(jointId(i))]),node('Matrix',[A('d',matrix(j.position))])]));
  const b=buckets[i];objects.push(node('Deformer',[L(clusterId(i)),S(j.name+'\0\x01SubDeformer'),S('Cluster')],[node('Version',[I(100)]),node('Indexes',[A('i',b.indices)]),node('Weights',[A('d',b.weights)]),node('Transform',[A('d',matrix([0,0,0]))]),node('TransformLink',[A('d',matrix(j.position))])]));
  connections.push(node('C',[S('OO'),L(clusterId(i)),L(skinId)]),node('C',[S('OO'),L(jointId(i)),L(clusterId(i))]));
 });
 objects.push(node('Pose',[L(poseId),S('BindPose\0\x01Pose'),S('BindPose')],[node('Type',[S('BindPose')]),node('Version',[I(100)]),node('NbPoseNodes',[I(poses.length)]),...poses]));
 const counts=new Map();for(const o of objects)counts.set(o.name,(counts.get(o.name)||0)+1);
 const trees=[node('FBXHeaderExtension',[],[node('FBXHeaderVersion',[I(1003)]),node('FBXVersion',[I(MIXAMO_FBX_VERSION)]),node('Creator',[S('VRM Galgame Mixamo White Export')])]),node('GlobalSettings',[],[node('Version',[I(1000)]),node('Properties70',[],[property('UpAxis','int',1),property('UpAxisSign','int',1),property('FrontAxis','int',2),property('FrontAxisSign','int',1),property('CoordAxis','int',0),property('CoordAxisSign','int',1),property('UnitScaleFactor','double',1),property('OriginalUnitScaleFactor','double',1)])]),node('Documents',[],[node('Count',[I(1)]),node('Document',[L(100000),S('Scene'),S('Scene')],[node('RootNode',[L(0)])])]),node('Definitions',[],[node('Version',[I(100)]),node('Count',[I(objects.length)]),...[...counts].map(([type,count])=>node('ObjectType',[S(type)],[node('Count',[I(count)])]))]),node('Objects',[],objects),node('Connections',[],connections),node('Takes',[],[node('Current',[S('')])])];
 return writeBinaryFbx(trees);
}
export function exportMixamoWhite(vrm){const data=captureMixamoWhite(vrm);return {buffer:encodeMixamoFbx(data),stats:{vertices:data.vertices.length/3,triangles:data.indices.length/3,bones:data.joints.length}};}

// Unrigged T-pose fallback for Mixamo's own automatic rigging. Positions use
// exactly the same captured body as the FBX; no texture/MTL dependency.
export function encodeMixamoObj(data){
 const lines=['# VRM Galgame Mixamo white character; T-pose; centimetres','o WhiteCharacter'];
 for(let i=0;i<data.vertices.length;i+=3)lines.push('v '+data.vertices.slice(i,i+3).map(v=>Number(v.toFixed(6))).join(' '));
 for(let i=0;i<data.indices.length;i+=3)lines.push('f '+data.indices.slice(i,i+3).map(v=>v+1).join(' '));
 return new TextEncoder().encode(lines.join('\n')+'\n').buffer;
}
export function exportMixamoObj(vrm){const data=captureMixamoWhite(vrm);return {buffer:encodeMixamoObj(data),stats:{vertices:data.vertices.length/3,triangles:data.indices.length/3,bones:0}};}

function writeBinaryFbx(trees){
 const encoder=new TextEncoder();
 const bytes=(n,fn)=>{const a=new Uint8Array(n);fn(new DataView(a.buffer));return a;};
 function prop({type,value}){
  const tag=encoder.encode(type);
  if(type==='S'){const s=encoder.encode(value);return [tag,bytes(4,v=>v.setUint32(0,s.length,true)),s];}
  if(type==='I')return [tag,bytes(4,v=>v.setInt32(0,value,true))];
  if(type==='L')return [tag,bytes(8,v=>v.setBigInt64(0,BigInt(value),true))];
  if(type==='D')return [tag,bytes(8,v=>v.setFloat64(0,value,true))];
  const size=type==='d'?8:4,payload=bytes(size*value.length,v=>value.forEach((x,i)=>type==='d'?v.setFloat64(i*size,x,true):v.setInt32(i*size,x,true)));
  return [tag,bytes(12,v=>{v.setUint32(0,value.length,true);v.setUint32(4,0,true);v.setUint32(8,payload.length,true);}),payload];
 }
 function prepare(n){n.nameBytes=encoder.encode(n.name);n.propBytes=n.props.flatMap(prop);n.propertySize=n.propBytes.reduce((s,b)=>s+b.length,0);n.children.forEach(prepare);n.size=13+n.nameBytes.length+n.propertySize+n.children.reduce((s,c)=>s+c.size,0)+(n.children.length?13:0);}
 trees.forEach(prepare);const rootEnd=27+trees.reduce((s,n)=>s+n.size,0)+13,padding=(16-(rootEnd+20)%16)||16,size=rootEnd+160+padding,result=new Uint8Array(size),view=new DataView(result.buffer);let offset=0;
 const put=b=>{result.set(b,offset);offset+=b.length;};put(encoder.encode('Kaydara FBX Binary  \0\x1a\0'));view.setUint32(offset,MIXAMO_FBX_VERSION,true);offset+=4;
 function write(n){const end=offset+n.size;view.setUint32(offset,end,true);view.setUint32(offset+4,n.props.length,true);view.setUint32(offset+8,n.propertySize,true);result[offset+12]=n.nameBytes.length;offset+=13;put(n.nameBytes);n.propBytes.forEach(put);n.children.forEach(write);if(n.children.length)offset+=13;if(offset!==end)throw Error('FBX 节点长度错误');}
 trees.forEach(write);offset+=13;
 // FBX 7.x footer: marker, reserved bytes, 16-byte alignment, version, trailer.
 put(new Uint8Array([0xfa,0xbc,0xab,0x09,0xd0,0xc8,0xd4,0x66,0xb1,0x76,0xfb,0x83,0x1c,0xf7,0x26,0x7e]));
 offset+=4+padding;view.setUint32(offset,MIXAMO_FBX_VERSION,true);offset+=4+120;
 put(new Uint8Array([0xf8,0x5a,0x8c,0x6a,0xde,0xf5,0xd9,0x7e,0xec,0xe9,0x0c,0xe3,0x75,0x8f,0x29,0x0b]));
 return result.buffer;
}

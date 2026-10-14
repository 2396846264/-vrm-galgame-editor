import {landingGearModel,poseLandingGear,setupWeaponModel} from './vehicle-hardware.js';
import {frontalProjection} from './vehicle-projection.js';
import {shapeGeometry,shapeKit} from './vehicle-shapes.js';
import * as THREE from 'three';
import {structuralRows,blockKit} from './vehicle-structure.js';
import {detailedPartModel} from './aircombat-detailed-models.js';
import {partKit,sockets,validateAircraft,partFamily} from './aircombat-schema.js';
function compileAircraftGeometry(blueprint,{validate=true}={}){
  const errors=validateAircraft(blueprint);if(validate&&errors.length)throw Error(errors.join('；'));
  if(blueprint.schemaVersion===2)return compileVoxelAircraft(blueprint);
  const byId=new Map(blueprint.parts.map(p=>[p.id,p])),transforms=new Map();
  function transform(p){if(transforms.has(p.id))return transforms.get(p.id);const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=p.scale||1;if(p.parentId){const parent=byId.get(p.parentId),t=transform(parent),socket=sockets(parent.type).find(s=>s.id===p.socketId);position.fromArray(socket.position).multiplyScalar(t.scale).applyQuaternion(t.rotation).add(t.position);rotation.copy(t.rotation);}position.add(new THREE.Vector3().fromArray(p.offset||[0,0,0]).applyQuaternion(rotation));rotation.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rotation||[0,0,0]).map(v=>v*Math.PI/180))));const t={position,rotation,scale};transforms.set(p.id,t);return t;}
  const parts=blueprint.parts.map(p=>{const def=partKit[p.type],t=transform(p),center=t.position.clone();if(def.center)center.add(new THREE.Vector3().fromArray(def.center).multiplyScalar(t.scale).applyQuaternion(t.rotation));else if(partFamily(p.type).startsWith('wing'))center.add(new THREE.Vector3(partFamily(p.type)==='wingLeft'?-2:2,0,0).multiplyScalar(t.scale).applyQuaternion(t.rotation));return {...p,...t,center,def,mass:def.mass*t.scale**3,health:def.hp,maxHealth:def.hp};});
  const mass=parts.reduce((n,p)=>n+p.mass,0),com=new THREE.Vector3();for(const p of parts)com.addScaledVector(p.center,p.mass/mass);
  const wingArea=parts.filter(p=>partFamily(p.type).startsWith('wing')).reduce((n,p)=>n+p.def.area*p.scale**2,0),powerHp=parts.filter(p=>partFamily(p.type)==='engine').reduce((n,p)=>n+p.powerHp,0);
  const dragArea=parts.reduce((n,p)=>n+p.def.drag*p.def.area*p.scale**2,0);
  const inertia=new THREE.Vector3();for(const p of parts){const r=p.center.clone().sub(com),d=p.def.size.map(v=>v*p.scale);inertia.x+=p.mass*((d[1]**2+d[2]**2)/12+r.y**2+r.z**2);inertia.y+=p.mass*((d[0]**2+d[2]**2)/12+r.x**2+r.z**2);inertia.z+=p.mass*((d[0]**2+d[1]**2)/12+r.x**2+r.y**2);}
  const radius=Math.max(...parts.map(p=>p.center.distanceTo(com)+Math.hypot(...p.def.size)*p.scale*.5));
  return {parts,mass,com,wingArea,powerHp,dragArea,inertia,radius,stallSpeed:Math.sqrt(2*mass*9.81/(1.225*wingArea*1.45))};
}
function wedge(span,chord,side=1){const a=0,b=span*side,t=.075;const vertices=[a,-t,-chord/2,a,-t,chord/2,b,-t,-chord*.25,b,-t,chord*.28,a,t,-chord/2,a,t,chord/2,b,t,-chord*.25,b,t,chord*.28];const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex([0,2,1,1,2,3,4,5,6,5,7,6,0,4,2,2,4,6,1,3,5,3,7,5,2,6,3,3,6,7,0,1,4,1,5,4]);g.computeVertexNormals();return g;}
export function partModel(part){if(partFamily(part.type)==='gear')return landingGearModel(part,part.def||partKit[part.type]);const root=makePartModel(part);if(['gun','turret'].includes(partFamily(part.type)))setupWeaponModel(root,{...part,def:part.def||partKit[part.type]});return root;}
function makePartModel(part){
  if(part.type.startsWith('voxel_')){const root=new THREE.Group();const geometry=shapeGeometry(part.def.shape||'cube',part.def.size);if(part.def.faces&&(!part.def.shape||part.def.shape==='cube')){const indices=[];geometry.groups.forEach((g,i)=>{if(part.def.faces[i])for(let j=g.start;j<g.start+g.count;j++)indices.push(geometry.index.array[j]);});geometry.clearGroups();geometry.setIndex(indices);}const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:part.color,roughness:.85}));root.add(m);root.userData.partId=part.id;return root;}
  if(part.type==='flap'){const root=new THREE.Group(),hinge=new THREE.Group();root.add(hinge);const m=new THREE.Mesh(new THREE.BoxGeometry(1.5,.12,.4),new THREE.MeshStandardMaterial({color:part.color,roughness:.8}));m.position.z=.2;hinge.add(m);root.userData.flap=hinge;return root;}
  const detailed=detailedPartModel(part);if(detailed)return detailed;
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:part.color,roughness:.85,flatShading:true}),dark=new THREE.MeshStandardMaterial({color:'#232d32',roughness:.8,flatShading:true});
  const mesh=(geometry,mat=material,pos=[0,0,0],rot=[0,0,0])=>{const m=new THREE.Mesh(geometry,mat);m.position.fromArray(pos);m.rotation.set(...rot);root.add(m);return m;};
  const box=(dims,pos,mat=material)=>mesh(new THREE.BoxGeometry(...dims),mat,pos);
  if(part.type==='fuselage'){const m=mesh(new THREE.CylinderGeometry(.22,.52,5.5,6,1),material,[0,0,0],[Math.PI/2,0,0]);m.scale.z=1.15;mesh(new THREE.ConeGeometry(.48,.7,6),material,[0,0,-3.1],[-Math.PI/2,0,0]);}
  else if(part.type==='cockpit'){const m=box([.83,.65,1.55],[0,.18,0]);m.rotation.x=.12;box([.72,.2,1.1],[0,.51,-.08],dark);/* All cockpit surfaces opaque; no empty interior. */}
  else if(part.type.startsWith('wing'))mesh(wedge(4,2,part.type==='wingLeft'?-1:1));
  else if(part.type==='tail'){mesh(wedge(1.6,1.05,-1));mesh(wedge(1.6,1.05,1));const fin=mesh(wedge(1.15,1.2,1),material,[0,0,.05]);fin.rotation.z=Math.PI/2;}
  else if(partFamily(part.type)==='engine'){mesh(new THREE.CylinderGeometry(.42,.35,1.35,6),material,[0,0,0],[Math.PI/2,0,0]);const prop=new THREE.Group();prop.position.z=-.76;root.add(prop);const blade=new THREE.Mesh(new THREE.BoxGeometry(.13,2.4,.07),dark);prop.add(blade);mesh(new THREE.ConeGeometry(.24,.35,6),material,[0,0,-.87],[-Math.PI/2,0,0]);root.userData.prop=prop;}
  else if(part.type==='gun'){box([.18,.18,.55],[0,0,.2]);box([.08,.08,1.3],[0,0,-.55],dark);}
  else if(part.type==='turret'){mesh(new THREE.CylinderGeometry(.42,.5,.23,6));const pivot=new THREE.Group();pivot.position.y=.25;root.add(pivot);const barrel=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,1.3),dark);barrel.position.z=-.48;pivot.add(barrel);const shield=new THREE.Mesh(new THREE.BoxGeometry(.55,.35,.3),material);pivot.add(shield);const elevation=new THREE.Group();pivot.add(elevation);elevation.add(barrel);root.userData.turret=pivot;root.userData.turretPitch=elevation;}
  else if(part.type==='bomb'){mesh(new THREE.CylinderGeometry(.17,.17,.9,6),material,[0,0,0],[Math.PI/2,0,0]);mesh(new THREE.ConeGeometry(.17,.3,6),material,[0,0,-.6],[-Math.PI/2,0,0]);box([.48,.04,.26],[0,0,.43]);box([.04,.48,.26],[0,0,.43]);}
  else if(part.type==='gear'){for(const x of [-1,1]){box([.07,.7,.07],[x,-.35,0]);mesh(new THREE.CylinderGeometry(.28,.28,.18,8),dark,[x,-.72,0],[0,0,Math.PI/2]);}}
  root.userData.partId=part.id;return root;
}
export function aircraftModel(compiled){const root=new THREE.Group(),models=new Map();for(const p of compiled.parts){const m=partModel(p);m.position.copy(p.position).sub(compiled.com);m.quaternion.copy(p.rotation);m.scale.setScalar(p.scale);root.add(m);models.set(p.id,m);}root.userData.models=models;return root;}
export function disposeAircraft(root){const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}
export function aircraftTriangles(root){let count=0;root.traverse(o=>{if(o.geometry)count+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return count;}
const triangleCache=new Map();
export function blueprintTriangles(blueprint){if(blueprint.schemaVersion===2){const m=aircraftModel(compileAircraft(blueprint,{validate:false}));const n=aircraftTriangles(m);disposeAircraft(m);return n;}return blueprint.parts.reduce((n,p)=>{if(!triangleCache.has(p.type)){const model=partModel(p);triangleCache.set(p.type,aircraftTriangles(model));disposeAircraft(model);}return n+triangleCache.get(p.type);},0);}

function compileVoxelAircraft(b){
 const rows=structuralRows(b),core=rows.filter(p=>p.kind==='hull').sort((a,b)=>Math.hypot(...a.position)-Math.hypot(...b.position))[0]||rows[0];
 const bodyStrength=Math.max(60,rows.filter(r=>['hull','armor'].includes(r.kind)).reduce((n,r)=>n+blockKit[r.kind].hp*r.count*((b.gridSize||.125)/.5)**3*shapeKit[r.shape].volume,0)*.2);
 const structural=rows.map(r=>{const d=blockKit[r.kind],g=b.gridSize||.125,type=r===core?'voxel_core':'voxel_'+r.kind;return {id:r.id,type,color:r.color,scale:1,position:new THREE.Vector3().fromArray(r.position),rotation:new THREE.Quaternion().setFromEuler(new THREE.Euler(...r.shapeRotation.map(v=>v*Math.PI/180))),center:new THREE.Vector3().fromArray(r.position),def:{...partKit[type],size:r.size,shape:r.shape,faces:r.faces,area:r.count*g*g,drag:d.drag*shapeKit[r.shape].drag,hp:d.hp*r.count*(g/.5)**3*shapeKit[r.shape].volume},mass:d.density*g**3*r.count*shapeKit[r.shape].volume,health:r===core?bodyStrength:d.hp*r.count*(g/.5)**3*shapeKit[r.shape].volume,maxHealth:r===core?bodyStrength:d.hp*r.count*(g/.5)**3*shapeKit[r.shape].volume};});
 const hardware=b.parts.map(p=>{const d=partKit[p.type],rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.rotation.map(v=>v*Math.PI/180))),position=new THREE.Vector3().fromArray(p.offset),center=position.clone();if(d.center)center.add(new THREE.Vector3().fromArray(d.center).multiplyScalar(p.scale).applyQuaternion(rotation));return {...p,def:d,rotation,position,center,mass:d.mass*p.scale**3,health:d.hp,maxHealth:d.hp};});
 const parts=[...structural,...hardware],mass=Math.max(1,parts.reduce((n,p)=>n+p.mass,0)),com=new THREE.Vector3();for(const p of parts)com.addScaledVector(p.center,p.mass/mass);
 const wingArea=Math.max(.01,parts.filter(p=>partFamily(p.type).startsWith('wing')).reduce((n,p)=>n+p.def.area*p.scale**2,0)),powerHp=parts.filter(p=>partFamily(p.type)==='engine').reduce((n,p)=>n+p.powerHp,0);
 const inertia=new THREE.Vector3(100,100,100);for(const p of parts){const r=p.center.clone().sub(com),d=p.def.size.map(v=>v*p.scale);inertia.x+=p.mass*((d[1]**2+d[2]**2)/12+r.y**2+r.z**2);inertia.y+=p.mass*((d[0]**2+d[2]**2)/12+r.x**2+r.z**2);inertia.z+=p.mass*((d[0]**2+d[1]**2)/12+r.x**2+r.y**2);}
 const radius=Math.max(1,...parts.map(p=>p.center.distanceTo(com)+Math.hypot(...p.def.size)*p.scale*.5));return {parts,mass,com,wingArea,powerHp,dragArea:parts.reduce((n,p)=>n+p.def.drag*p.def.area*p.scale**2,0),inertia,radius,stallSpeed:Math.sqrt(2*mass*9.81/(1.225*wingArea*1.45))};
}

const projectionCache=new Map();
export function compileAircraft(blueprint,options={}){
 const spec=compileAircraftGeometry(blueprint,options),key=JSON.stringify(blueprint);let cached=projectionCache.get(key);
 if(!cached){const model=aircraftModel(spec),gears=spec.parts.filter(p=>partFamily(p.type)==='gear'),phases=[];let contactHeight=0;model.updateMatrixWorld(true);for(const p of gears)for(const leg of model.userData.models.get(p.id).userData.gearLegs)contactHeight=Math.max(contactHeight,-leg.spin.getWorldPosition(new THREE.Vector3()).y+leg.radius*p.scale);
  for(const deployment of gears.length?[0,.25,.5,.75,1]:[1]){for(const p of gears)poseLandingGear(model.userData.models.get(p.id),p,deployment);phases.push(frontalProjection(model,spec.parts));}
  cached={phases,contactHeight};projectionCache.set(key,cached);if(projectionCache.size>24)projectionCache.delete(projectionCache.keys().next().value);disposeAircraft(model);
 }
 spec.gearProjections=cached.phases;spec.contactHeight=cached.contactHeight;setGearProjection(spec,1);return spec;
}
export function setGearProjection(spec,deployment){const index=spec.gearProjections.length===1?0:Math.round(THREE.MathUtils.clamp(deployment,0,1)*4);if(spec.gearProjectionIndex===index)return;spec.gearProjectionIndex=index;const projection=spec.gearProjections[index];spec.frontalArea=projection.area;spec.dragArea=0;spec.parts.forEach((p,i)=>{p.frontalArea=projection.partAreas[i];spec.dragArea+=p.def.drag*p.frontalArea;});}

import {gunBarrel} from './gun-barrel.js';
import * as T from 'three';
import {shapeGeometry} from './vehicle-shapes.js';
import {normalizeFirepower} from './firepower-schema.js';
export function firepowerModel(raw){
 const w=normalizeFirepower(raw),root=new T.Group(),yaw=new T.Group(),pitch=new T.Group();root.add(yaw);yaw.add(pitch);pitch.position.fromArray(w.pivot);const steel=new T.MeshStandardMaterial({color:'#3b454c',metalness:.55,roughness:.38}),length=w.caliber*w.calibers/1000;
 for(const b of w.blocks){const mesh=new T.Mesh(shapeGeometry(b.shape,[w.gridSize,w.gridSize,w.gridSize]),new T.MeshStandardMaterial({color:b.color,roughness:.7}));mesh.position.fromArray(b.cell.map(v=>v*w.gridSize));mesh.rotation.set(...(b.shapeRotation||[0,0,0]).map(v=>v*Math.PI/180));mesh.userData.firepowerCell=[...b.cell];yaw.add(mesh);}
 if(w.housing==='dome'){const radius=Math.max(w.gridSize*2,.45),cover=new T.Mesh(new T.SphereGeometry(radius,20,12),new T.MeshPhysicalMaterial({color:'#bce5ef',transparent:true,opacity:.25,roughness:.13,depthWrite:false,side:T.DoubleSide}));cover.position.y=w.pivot[1];cover.userData.firepowerCover=true;yaw.add(cover);}
 for(const b of w.barrels){const barrel=gunBarrel(w.caliber,length,steel);barrel.rotation.x=Math.PI/2;barrel.position.fromArray(b.offset);barrel.position.z-=length/2;barrel.userData.weaponBarrel=true;pitch.add(barrel);const collar=new T.Mesh(new T.BoxGeometry(Math.max(.1,w.caliber/500),Math.max(.1,w.caliber/500),Math.min(length*.15,.6)),steel);collar.position.fromArray(b.offset);pitch.add(collar);}
 root.userData.turret=yaw;root.userData.turretPitch=pitch;root.userData.muzzleForAim=(y,p)=>w.barrels.map(b=>new T.Vector3(...b.offset).add(new T.Vector3(0,0,-length)).applyAxisAngle(new T.Vector3(1,0,0),p).add(pitch.position).applyAxisAngle(new T.Vector3(0,1,0),y));
 return root;
}

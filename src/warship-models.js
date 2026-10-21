import {gunBarrel} from './gun-barrel.js';
import {shipFlag} from './ship-flag.js';
import {shapeGeometry} from './vehicle-shapes.js';
import * as THREE from 'three';
export function navalPartModel(p){const root=new THREE.Group(),d=p.def,paint=new THREE.MeshStandardMaterial({color:p.color,roughness:.72}),steel=new THREE.MeshStandardMaterial({color:'#303e46',roughness:.5,metalness:.35}),tan=new THREE.MeshStandardMaterial({color:'#bba982'});const box=(size,pos,parent=root,mat=paint)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.fromArray(pos);parent.add(m);return m;};
 if(p.type==='ship_flight_deck'){box(d.size,[0,0,0]);const [w,h,l]=d.size;for(const x of [-w*.43,w*.43])box([.22,.04,l*.94],[x,h/2+.025,0],root,tan);for(let z=-l*.44;z<l*.44;z+=15)box([.35,.04,7],[0,h/2+.03,z],root,tan);for(let z=l*.15;z<l*.35;z+=8)box([w*.8,.05,.2],[0,h/2+.04,z],root,steel);}
 else if(d.family==='turret'){
  const yaw=new THREE.Group();root.add(yaw);root.userData.turret=yaw;const [w,h,l]=d.size;const housing=new THREE.Mesh(new THREE.CylinderGeometry(w*.42,w*.5,h*.52,8,1),paint);housing.scale.z=l*.43/w;housing.position.y=h*.3;housing.rotation.y=Math.PI/8;yaw.add(housing);box([w*.68,.15,l*.29],[0,h*.57,0],yaw,steel);for(const side of [-1,1]){box([.1,h*.13,l*.22],[side*w*.37,h*.38,l*.02],yaw,steel);box([w*.12,.18,l*.12],[side*w*.25,h*.64,l*.06],yaw);}const ring=new THREE.Mesh(new THREE.CylinderGeometry(w*.32,w*.34,h*.13,16),steel);ring.position.y=h*.04;yaw.add(ring);const pitch=new THREE.Group();pitch.position.y=h*.45;yaw.add(pitch);root.userData.turretPitch=pitch;const n=['ship_main460','ship_main406'].includes(p.type)?3:p.type.includes('main')||p.type.includes('aa25')||p.type.includes('aa40')?2:1;
  for(let i=0;i<n;i++){const barrel=gunBarrel(d.caliber,l*.72,steel);barrel.rotation.x=Math.PI/2;barrel.position.set((i-(n-1)/2)*w*.22,0,-l*.34);barrel.userData.weaponBarrel=true;pitch.add(barrel);}
 }else if(p.type==='ship_flag'){const flag=shipFlag();flag.userData.flagImageId=p.flagImageId||'';root.add(flag);}
 else if(p.type==='ship_funnel'){box(d.size,[0,0,0]);box([d.size[0]*1.05,.5,d.size[2]*1.05],[0,d.size[1]/2,0],root,steel);}
 else if(p.type==='ship_mast'||p.type==='ship_radar'){box([.4,d.size[1],.4],[0,0,0],root,steel);box([d.size[0]+3,.25,.3],[0,d.size[1]*.25,0],root,steel);if(p.type==='ship_radar')box([5,2,.25],[0,1,0]);}
 else if(p.type==='ship_propeller'){box([.3,.3,4],[0,0,0],root,steel);const prop=new THREE.Group();prop.position.z=2;root.add(prop);for(let i=0;i<3;i++){const blade=box([.5,2.8,.15],[0,0,0],prop,tan);blade.rotation.z=i*Math.PI/3;}root.userData.prop=prop;}
 else if(p.type==='ship_bridge_module'){box(d.size,[0,0,0]);box([d.size[0]*.9,1,d.size[2]*.8],[0,d.size[1]*.22,0],root,steel);box([d.size[0]*.65,.4,d.size[2]*.7],[0,d.size[1]*.55,0],root,tan);}
 else box(d.size,[0,0,0]);root.userData.partId=p.id;return root;}

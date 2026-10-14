import * as THREE from 'three';
export function landingGearModel(part,d){
 const root=new THREE.Group(),paint=new THREE.MeshStandardMaterial({color:part.color,roughness:.7}),steel=new THREE.MeshStandardMaterial({color:'#90999b',metalness:.75,roughness:.25}),rubber=new THREE.MeshStandardMaterial({color:'#25282b',roughness:.95});
 const points=d.kit==='b25'?[[-3.6,-1.2,-.7],[3.6,-1.2,-.7],[0,-1.35,-5.4]]:d.kit==='shinden'?[[-2.1,-2,1.9],[2.1,-2,1.9],[0,-2.1,-3.25]]:d.kit==='stuka'?[[-1.9,-1,-.6],[1.9,-1,-.6],[0,-.4,4.3]]:d.kit==='bf109'?[[-1,-.85,-.5],[1,-.85,-.5],[0,-.35,3.3]]:[[-1,-.72,0],[1,-.72,0]];
 root.userData.gearLegs=[];root.userData.wheels=[];
 for(const [x,y,z]of points){const hinge=new THREE.Group();hinge.position.set(x,0,z);root.add(hinge);const radius=x===0?.23:d.kit==='b25'?.46:.35;
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,Math.abs(y),8),steel);shaft.position.y=y/2;hinge.add(shaft);const piston=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,Math.abs(y)*.42,8),paint);piston.position.y=y*.25;hinge.add(piston);
  const spin=new THREE.Group();spin.position.y=y;hinge.add(spin);const tire=new THREE.Mesh(new THREE.TorusGeometry(radius,.09,4,12),rubber);tire.rotation.y=Math.PI/2;spin.add(tire);const hub=new THREE.Mesh(new THREE.CylinderGeometry(radius*.65,radius*.65,.22,8),steel);hub.rotation.z=Math.PI/2;spin.add(hub);
  for(let i=0;i<3;i++){const spoke=new THREE.Mesh(new THREE.BoxGeometry(.24,radius*1.2,.035),paint);spoke.rotation.x=i*Math.PI/3;spin.add(spoke);}
  const door=new THREE.Mesh(new THREE.BoxGeometry(.07,Math.abs(y)*.72,.48),paint);door.position.set(x<0?-.09:.09,y*.45,.08);hinge.add(door);root.userData.gearLegs.push({hinge,x,y,radius:radius+.09,spin});root.userData.wheels.push(spin);
 }
 root.userData.partId=part.id;return root;
}
export function poseLandingGear(root,part,deployment){for(const leg of root.userData.gearLegs||[]){const a=(1-deployment)*Math.PI/2,d=part.gearFoldDirection||'backward';leg.hinge.rotation.set(0,0,0);if(d==='forward'||d==='backward')leg.hinge.rotation.x=d==='forward'?a:-a;else{const inward=leg.x<0?1:-1;leg.hinge.rotation.z=a*inward*(d==='inward'?1:-1);}}root.userData.gearDeployment=deployment;}
export function animateLandingGear(root,part,flight,dt){
 const wanted=flight.gearCommand==='down'?1:flight.gearCommand==='up'?0:flight.position.y>(flight.groundLevel||0)+20&&flight.airSpeed>35?0:1,old=part.gearDeployment??1;
 if(!flight.gearSimulated)part.gearDeployment=old+THREE.MathUtils.clamp(wanted-old,-dt*.5,dt*.5);poseLandingGear(root,part,part.gearDeployment);
 const forward=new THREE.Vector3(0,0,-1);if(flight.rotation)forward.applyQuaternion(flight.rotation);const speed=flight.grounded?flight.velocity.dot(forward):0;root.userData.wheelSpeed=(root.userData.wheelSpeed||0)+(speed-(root.userData.wheelSpeed||0))*Math.min(1,dt*(flight.grounded?15:1.8));for(const leg of root.userData.gearLegs||[])leg.spin.rotation.x-=root.userData.wheelSpeed/(leg.radius*(part.scale||1))*dt;
}
let flashTexture;
export function setupWeaponModel(root,part){
 if(!flashTexture){const size=16,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,r=Math.hypot((x+0.5-size/2)/(size/2),(y+0.5-size/2)/(size/2));data[i]=255;data[i+1]=210;data[i+2]=95;data[i+3]=Math.round(Math.max(0,1-r)**2*255);}flashTexture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);flashTexture.needsUpdate=true;}
 const barrels=[];root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.parameters;if(o.geometry.type==='CylinderGeometry'&&g.radiusTop<.085&&g.height>.6||part.type==='gun'&&o.geometry.type==='BoxGeometry'&&g.depth>1)barrels.push(o);});root.userData.recoilParts=[];root.userData.muzzles=[];root.userData.muzzleLocations=[];
 for(const barrel of barrels){const base=barrel.position.clone(),g=barrel.geometry.parameters,sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:flashTexture,color:'#ffc578',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));sprite.visible=false;sprite.userData.runtimeEffect=true;sprite.scale.setScalar((part.def?.caliber||13)>=37?.65:.3);if(g.height) sprite.position.y=-g.height/2;else sprite.position.z=-g.depth/2;barrel.add(sprite);root.userData.recoilParts.push({barrel,base});root.userData.muzzles.push(sprite);root.updateMatrixWorld(true);root.userData.muzzleLocations.push(root.worldToLocal(sprite.getWorldPosition(new THREE.Vector3())));}
}
export function animateWeapon(root,part,time){const age=time-(part.lastShotTime??-100),recoil=Math.exp(-age*22)*(part.def?.caliber>=75?.2:part.def?.caliber>=37?.12:.025);for(const p of root.userData.recoilParts||[]){p.barrel.position.copy(p.base);p.barrel.position.z+=recoil;}for(const m of root.userData.muzzles||[]){m.visible=age>=0&&age<.065;m.material.opacity=Math.exp(-age*35);}}

import * as THREE from 'three';
// Bounded, reusable blocky smoke puffs, bright flash and expanding shock ring.
export function createShellExplosions(scene){
 const capacity=768,geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshBasicMaterial({toneMapped:false}),mesh=new THREE.InstancedMesh(geometry,material,capacity);
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;scene.add(mesh);
 const particles=[],rings=[],dummy=new THREE.Object3D(),color=new THREE.Color(),ringGeometry=new THREE.RingGeometry(.82,1,48);
 return {splash(point,caliber=127){
  const radius=Math.max(1,Math.min(5,caliber/100));
  for(let i=0;i<48;i++)particles.push({water:true,position:point.clone(),velocity:new THREE.Vector3((Math.random()-.5)*radius*3,6+Math.random()*radius*5,(Math.random()-.5)*radius*3),life:1.5,maxLife:1.5,size:.3+radius*.15,spin:Math.random()*6,shade:1});
  if(particles.length>capacity)particles.splice(0,particles.length-capacity);
  const ring=new THREE.Mesh(ringGeometry,new THREE.MeshBasicMaterial({color:0xc9faff,transparent:true,opacity:.8,side:THREE.DoubleSide,toneMapped:false,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(point);ring.position.y=point.y+.15;scene.add(ring);rings.push({mesh:ring,life:.6,radius:radius*3});
  if(rings.length>16){const r=rings.shift();r.mesh.removeFromParent();r.mesh.material.dispose();}
 },emit(point,radius,underwater=false){
  for(let i=0;i<Math.min(96,32+Math.ceil(radius*4));i++){const dir=new THREE.Vector3(Math.random()-.5,Math.random()*.8-.2,Math.random()-.5).normalize();particles.push({water:underwater,position:point.clone(),velocity:dir.multiplyScalar(radius*(1+Math.random()*2)),life:.7+Math.random()*.7,maxLife:1.4,size:radius*(.09+Math.random()*.12),spin:Math.random()*6,shade:.35+Math.random()*.6});}
  if(particles.length>capacity)particles.splice(0,particles.length-capacity);
  const ring=new THREE.Mesh(ringGeometry,new THREE.MeshBasicMaterial({color:'#fff1d4',transparent:true,opacity:.8,side:THREE.DoubleSide,toneMapped:false,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(point);scene.add(ring);rings.push({mesh:ring,life:.6,radius});
  if(rings.length>16){const r=rings.shift();r.mesh.removeFromParent();r.mesh.material.dispose();}
 },update(dt){
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}p.velocity.multiplyScalar(Math.exp(-dt*(p.water?.5:3)));p.velocity.y+=dt*(p.water?-9.81:2);p.position.addScaledVector(p.velocity,dt);}
  for(let i=0;i<particles.length;i++){const p=particles[i],age=1-p.life/p.maxLife;dummy.position.copy(p.position);dummy.rotation.set(p.spin+age,p.spin*.7,age);dummy.scale.setScalar(p.size*(.6+age*2.5)*Math.min(1,p.life*4));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);color.setRGB(p.shade,p.shade,p.shade);if(p.water)color.setRGB(.65,.9,1);else if(age<.2)color.lerp(new THREE.Color('#fff2b0'),1-age*5);mesh.setColorAt(i,color);}
  mesh.count=particles.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.life-=dt;if(r.life<=0){r.mesh.removeFromParent();r.mesh.material.dispose();rings.splice(i,1);}else{r.mesh.scale.setScalar(r.radius*(1-r.life/.6)*1.5+.01);r.mesh.material.opacity=r.life;}}
 },dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();for(const r of rings){r.mesh.removeFromParent();r.mesh.material.dispose();}ringGeometry.dispose();},get count(){return particles.length;}};
}

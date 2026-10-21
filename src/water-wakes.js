import * as T from 'three';
// Surface foam only: no extra physics bodies or persistent per-frame meshes.
export function createWaterWakes(scene,water){
 const pixels=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const nx=(x-31.5)/32,ny=(y-31.5)/32,r=nx*nx+ny*ny,noise=.6+.4*Math.sin(x*1.7+y*.9)*Math.sin(y*2.3-x*.4),a=Math.max(0,1-r);pixels.set([255,255,255,Math.round(a*a*noise*255)],(y*64+x)*4);}const texture=new T.DataTexture(pixels,64,64);texture.needsUpdate=true;texture.magFilter=T.LinearFilter;
 const capacity=2048,geometry=new T.PlaneGeometry(1,1),material=new T.MeshBasicMaterial({map:texture,color:0xffffff,transparent:true,opacity:.8,depthWrite:false,side:T.DoubleSide,toneMapped:false}),mesh=new T.InstancedMesh(geometry,material,capacity);
 const alpha=new T.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(T.DynamicDrawUsage);geometry.setAttribute('wakeAlpha',alpha);material.onBeforeCompile=shader=>{shader.vertexShader='attribute float wakeAlpha;varying float vWakeAlpha;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWakeAlpha=wakeAlpha;');shader.fragmentShader='varying float vWakeAlpha;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\ndiffuseColor.a*=vWakeAlpha;');};
 mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;mesh.renderOrder=1;scene.add(mesh);
 const foam=[],clocks=new WeakMap(),sizes=new WeakMap(),dummy=new T.Object3D(),color=new T.Color(),normal=new T.Vector3(),up=new T.Vector3(0,0,1);let shipEmissions=0,torpedoEmissions=0;
 function emit(position,forward,width,ship){
  const side=new T.Vector3(-forward.z,0,forward.x);
  for(const sign of [-1,1])foam.push({position:position.clone().addScaledVector(side,sign*width*.35),velocity:side.clone().multiplyScalar(sign*width*.12).addScaledVector(forward,-width*.12),heading:Math.atan2(forward.x,forward.z)+sign*.35,width:ship?Math.max(.8,width*.12):.35,length:ship?width*.55:1.5,life:ship?12:7,maxLife:ship?12:7});
  foam.push({position:position.clone(),velocity:forward.clone().multiplyScalar(-width*.06),heading:Math.atan2(forward.x,forward.z),width:ship?Math.max(1.2,width*.25):.28,length:ship?width*.8:2.5,life:ship?15:9,maxLife:ship?15:9});
  if(ship)shipEmissions++;else torpedoEmissions++;
  if(foam.length>capacity)foam.splice(0,foam.length-capacity);
 }
 function ready(object,dt,interval){const time=(clocks.get(object)||0)+dt;clocks.set(object,time%interval);return time>=interval;}
 return {mesh,update(units,bullets,dt){
  if(dt<=0)return;
  for(let i=foam.length-1;i>=0;i--){const p=foam[i];p.life-=dt;if(p.life<=0){foam.splice(i,1);continue;}p.position.addScaledVector(p.velocity,dt);}
  for(const u of units){const f=u.flight;if(!f?.ship||!f.alive||f.sinking||Math.hypot(f.velocity.x,f.velocity.z)<.5)continue;
   if(!ready(f,dt,.12))continue;
   let size=sizes.get(f);if(!size){let stern=0,beam=2;for(const p of f.spec.parts){if(!p.blockCells)continue;stern=Math.max(stern,p.position.z+(p.def.size?.[2]||2)/2);beam=Math.max(beam,Math.abs(p.position.x)+(p.def.size?.[0]||2)/2);}size={stern,beam};sizes.set(f,size);}
   const forward=new T.Vector3(0,0,-1).applyQuaternion(f.rotation);forward.y=0;forward.normalize();const point=new T.Vector3(0,0,size.stern).sub(f.spec.com).applyQuaternion(f.rotation).add(f.position);point.y=.18;emit(point,forward,size.beam*2,true);
  }
  for(const b of bullets){if(!b.torpedo||!b.waterborne||b.velocity.lengthSq()<.25||!ready(b,dt,.07))continue;const point=b.position.clone();point.y=.19;emit(point,b.velocity.clone().setY(0).normalize(),1,false);}
  for(let i=0;i<foam.length;i++){const p=foam[i],age=1-p.life/p.maxLife;dummy.position.copy(p.position);dummy.position.y=(water?.height(p.position.x,p.position.z)??0)+.12;if(water)water.normal(p.position.x,p.position.z,normal);else normal.set(0,1,0);dummy.quaternion.setFromUnitVectors(up,normal);dummy.rotateZ(-p.heading);const fade=Math.min(1,p.life/2);dummy.scale.set(p.width*(1+age*3)*fade,p.length*(1+age*.5)*fade,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);alpha.setX(i,Math.min(1,(1-age)*3)*Math.min(1,age*14));color.setRGB(.87,.96,1);mesh.setColorAt(i,color);}
  mesh.count=foam.length;alpha.needsUpdate=true;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 },dispose(){foam.length=0;mesh.removeFromParent();geometry.dispose();material.dispose();texture.dispose();},get count(){return foam.length;},get stats(){return {shipEmissions,torpedoEmissions};}};
}

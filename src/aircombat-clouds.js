import * as THREE from 'three';
export function createDialogueClouds(scene,camera){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const context=canvas.getContext('2d'),g=context.createRadialGradient(64,64,5,64,64,64);
 g.addColorStop(0,'#eff7ffff');g.addColorStop(.35,'#e5f1ffd0');g.addColorStop(.7,'#e5f1ff60');g.addColorStop(1,'#e5f1ff00');context.fillStyle=g;context.fillRect(0,0,128,128);
 const texture=new THREE.CanvasTexture(canvas),geometry=new THREE.PlaneGeometry(1,1),group=new THREE.Group();camera.add(group);if(!camera.parent)scene.add(camera);
 for(let i=0;i<18;i++){const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false,opacity:0}));const angle=i*2.4;m.position.set(Math.cos(angle)*(14+i%3*7),Math.sin(angle)*(8+i%4*3),-20-i*7);m.scale.set(45+i%4*12,26+i%3*10,1);m.renderOrder=100+i;group.add(m);}
 let alpha=0,travel=0;
 return{update(dt,visible){alpha=THREE.MathUtils.clamp(alpha+(visible?dt*4:-dt/0.7),0,1);group.visible=alpha>0;travel+=dt;for(const m of group.children){if(alpha>0){m.position.z+=dt*38;if(m.position.z>8)m.position.z=-140;}m.material.opacity=alpha*.42;}},get travel(){return travel;},get alpha(){return alpha;},dispose(){group.removeFromParent();group.children.forEach(m=>m.material.dispose());geometry.dispose();texture.dispose();}};
}

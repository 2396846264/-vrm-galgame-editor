import * as THREE from 'three';

// One real scene light casts onto actual scene geometry. Fit once to the static
// environment, then extend the volume to include characters as they move.
export function environmentShadowBounds(root){const box=new THREE.Box3();if(!root)return box;root.updateWorldMatrix(true,true);root.traverse(o=>{if(o.isMesh&&(o.castShadow||o.receiveShadow)){let visible=true;for(let p=o;p;p=p.parent)if(!p.visible)visible=false;if(visible)box.union(new THREE.Box3().setFromObject(o));}});return box;}

export function fitEnvironmentShadow(light, bounds) {
  const box=bounds.clone();
  if(box.isEmpty())box.set(new THREE.Vector3(-3,0,-3),new THREE.Vector3(3,3,3));
  const center=box.getCenter(new THREE.Vector3());
  const radius=Math.max(4,box.getSize(new THREE.Vector3()).length()/2+1);
  light.position.copy(center).addScaledVector(new THREE.Vector3(-2,4,5).normalize(),radius*2+10);
  light.target.position.copy(center);light.target.updateMatrixWorld();
  light.castShadow=true;
  light.shadow.mapSize.set(2048,2048);
  Object.assign(light.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:.1,far:radius*4+30});
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.bias=-.0001;light.shadow.normalBias=.015;light.shadow.radius=2;
}

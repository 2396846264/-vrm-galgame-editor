import * as THREE from 'three';
import {maxProjectiles} from './aircombat-rules.js';
export function createProjectileTracers(scene){
 const positions=new Float32Array(maxProjectiles*16*6),geometry=new THREE.BufferGeometry();
 const attribute=new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('position',attribute);geometry.setDrawRange(0,0);
 const material=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.95,toneMapped:false});
 const lines=new THREE.LineSegments(geometry,material);lines.frustumCulled=false;scene.add(lines);
 return {lines,update(bullets){let n=0;for(const b of bullets){if(b.bomb)continue;const points=b.trail;for(let i=0;i<points.length;i++){const a=points[i],z=points[i+1]||b.position;if(n+6>positions.length)break;if(a.distanceToSquared(z)<1e-8)continue;positions[n++]=a.x;positions[n++]=a.y;positions[n++]=a.z;positions[n++]=z.x;positions[n++]=z.y;positions[n++]=z.z;}}geometry.setDrawRange(0,n/3);if(n>0)attribute.needsUpdate=true;},dispose(){lines.removeFromParent();geometry.dispose();material.dispose();}};
}

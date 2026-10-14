import * as THREE from 'three';
export const shapeKit={cube:{name:'正方体',volume:1,drag:1},wedge:{name:'三角斜面体',volume:.5,drag:.7},pyramid:{name:'四角尖锥',volume:1/3,drag:.65},cone:{name:'圆锥',volume:Math.PI/12,drag:.5}};
export function shapeGeometry(shape,size){
 const [x,y,z]=size;if(shape==='wedge'){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-x/2,-y/2,-z/2,x/2,-y/2,-z/2,-x/2,-y/2,z/2,x/2,-y/2,z/2,-x/2,y/2,z/2,x/2,y/2,z/2],3));g.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,0,4,1,1,4,5,0,2,4,1,5,3]);g.computeVertexNormals();return g;}
 if(shape==='pyramid'||shape==='cone'){const g=new THREE.ConeGeometry(shape==='pyramid'?Math.SQRT1_2:.5,1,shape==='pyramid'?4:8,1,false,shape==='pyramid'?Math.PI/4:0);g.scale(x,y,z);return g;}return new THREE.BoxGeometry(x,y,z);
}
const geometries=new Map();
export function intersectShape(shape,size,start,end){
 const key=shape+':'+size.join(','),g=geometries.get(key)||shapeGeometry(shape,size);geometries.set(key,g);const delta=end.clone().sub(start),length=delta.length();if(!length)return null;const ray=new THREE.Ray(start,delta.normalize()),position=g.attributes.position,index=g.index,array=index?.array,vertices=array?.length||position.count;let best=Infinity,inside=true;
 for(let i=0;i<vertices;i+=3){const a=new THREE.Vector3().fromBufferAttribute(position,array?array[i]:i),b=new THREE.Vector3().fromBufferAttribute(position,array?array[i+1]:i+1),c=new THREE.Vector3().fromBufferAttribute(position,array?array[i+2]:i+2),normal=b.clone().sub(a).cross(c.clone().sub(a));if(normal.dot(start.clone().sub(a))>1e-7)inside=false;const point=ray.intersectTriangle(a,b,c,false,new THREE.Vector3());if(point)best=Math.min(best,point.distanceTo(start));}return inside?0:best<=length?best/length:null;
}

export function shapeSymmetricX(shape,rotation){if(shape==='cube')return true;const g=shapeGeometry(shape,[1,1,1]),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation.map(v=>v*Math.PI/180))),positions=g.attributes.position,points=[];for(let i=0;i<positions.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(positions,i).applyQuaternion(q));g.dispose();const key=v=>[v.x,v.y,v.z].map(n=>Math.round(n*100000)||0).join(','),set=new Set(points.map(key));return points.every(v=>{v.x=-v.x;return set.has(key(v));});}

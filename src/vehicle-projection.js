import * as THREE from 'three';
// Rasterize the actual silhouettes along -Z, retaining the nearest surface per pixel.
// Overlapping hull cells and attachments are counted once, rather than adding their areas.
export function frontalProjection(root,parts,step=.025){
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),width=bounds.max.x-bounds.min.x,height=bounds.max.y-bounds.min.y;if(!Number.isFinite(width)||!width||!height)return {area:0,partAreas:parts.map(()=>0)};
 step=Math.max(step,Math.sqrt(width*height/750000));const cols=Math.ceil(width/step),rows=Math.ceil(height/step),depth=new Float32Array(cols*rows);depth.fill(Infinity);const owners=new Int32Array(cols*rows);owners.fill(-1);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 parts.forEach((p,owner)=>{root.userData.models.get(p.id)?.traverse(o=>{if(!o.isMesh||!o.visible||o.userData.runtimeEffect)return;const g=o.geometry,position=g.attributes.position,indices=g.index?.array,count=indices?.length??position.count;
 for(let i=0;i<count;i+=3){a.fromBufferAttribute(position,indices?indices[i]:i).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(position,indices?indices[i+1]:i+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(position,indices?indices[i+2]:i+2).applyMatrix4(o.matrixWorld);const denominator=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(denominator)<1e-10)continue;
 const x0=Math.max(0,Math.floor((Math.min(a.x,b.x,c.x)-bounds.min.x)/step)),x1=Math.min(cols-1,Math.floor((Math.max(a.x,b.x,c.x)-bounds.min.x)/step)),y0=Math.max(0,Math.floor((Math.min(a.y,b.y,c.y)-bounds.min.y)/step)),y1=Math.min(rows-1,Math.floor((Math.max(a.y,b.y,c.y)-bounds.min.y)/step));
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=bounds.min.x+(x+.5)*step,py=bounds.min.y+(y+.5)*step,u=((b.y-c.y)*(px-c.x)+(c.x-b.x)*(py-c.y))/denominator,v=((c.y-a.y)*(px-c.x)+(a.x-c.x)*(py-c.y))/denominator,w=1-u-v;if(u<-.00001||v<-.00001||w<-.00001)continue;const z=u*a.z+v*b.z+w*c.z,index=y*cols+x;if(z<depth[index]){depth[index]=z;owners[index]=owner;}}}
 });});const partAreas=parts.map(()=>0);let pixels=0;for(const owner of owners)if(owner>=0){pixels++;partAreas[owner]+=step*step;}return {area:pixels*step*step,partAreas};
}

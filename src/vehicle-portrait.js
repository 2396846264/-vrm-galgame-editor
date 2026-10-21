import * as T from 'three';
let renderer;
export const validPortrait=value=>typeof value==='string'&&value.length<100000&&/^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/.test(value)?value:'';
// Private document metadata, never an imported asset. View always lies on X=0 centreline.
export function vehiclePortrait(model){
 renderer||=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(256,160,false);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;
 const scene=new T.Scene();scene.background=new T.Color('#263740');scene.add(new T.HemisphereLight('#eef8ff','#56646a',3));const sun=new T.DirectionalLight('#fff1d4',2.5);sun.position.set(-4,8,-6);scene.add(sun);
 const copy=model.clone(true);copy.position.set(0,0,0);copy.quaternion.identity();scene.add(copy);copy.traverse(o=>{if(o.userData.runtimeEffect||o.isAxesHelper||o.material?.wireframe)o.visible=false;});
 const box=new T.Box3().setFromObject(copy),center=box.getCenter(new T.Vector3()),radius=Math.max(.1,box.getSize(new T.Vector3()).length());
 const camera=new T.OrthographicCamera(-1,1,1,-1,.01,radius*8+100);camera.position.copy(center).add(new T.Vector3(0,radius*.8,-radius));camera.lookAt(center);camera.updateMatrixWorld();
 let w=0,h=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);w=Math.max(w,Math.abs(p.x));h=Math.max(h,Math.abs(p.y));}
 const half=Math.max(h,w/1.6,.1)*1.1;camera.top=half;camera.bottom=-half;camera.left=-half*1.6;camera.right=half*1.6;camera.updateProjectionMatrix();renderer.render(scene,camera);copy.removeFromParent();return renderer.domElement.toDataURL('image/webp',.65);
}

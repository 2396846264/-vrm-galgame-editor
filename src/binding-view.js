import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export class BindingView {
  constructor(camera,canvas){this.camera=camera;this.canvas=canvas;this.enabled=false;this.actorKey='';}
  enable(record,key){
    if(!this.controls){
      this.controls=new OrbitControls(this.camera,this.canvas);this.controls.enabled=false;
      this.controls.enableDamping=false;this.controls.screenSpacePanning=true;
      this.controls.minDistance=.025;this.controls.maxDistance=20;
      this.controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
      this.stopWheel=event=>event.stopPropagation();this.canvas.addEventListener('wheel',this.stopWheel,{passive:true});
    }
    const reset=!this.enabled||this.actorKey!==key;
    if(!this.enabled)this.originalNear=this.camera.near;
    this.enabled=true;this.actorKey=key;this.controls.enabled=true;this.camera.near=.005;this.camera.updateProjectionMatrix();
    if(reset)this.focusModel(record);
  }
  focusModel(record){
    if(!record)return;
    const bounds=new THREE.Box3().setFromObject(record.vrm.scene),target=bounds.getCenter(new THREE.Vector3());
    const size=bounds.getSize(new THREE.Vector3()),aspect=Math.max(.2,this.camera.aspect),fov=THREE.MathUtils.degToRad(this.camera.fov);
    const distance=Math.max(size.y,size.x/aspect)/(2*Math.tan(fov/2))*1.15;
    this.look(target,Math.max(.6,distance),new THREE.Vector3(0,.05,1));
  }
  focusBone(bone){if(!bone)return;bone.updateWorldMatrix(true,false);this.look(bone.getWorldPosition(new THREE.Vector3()),.45);}
  focusItem(root){if(!root)return;const bounds=new THREE.Box3().setFromObject(root);this.look(bounds.getCenter(new THREE.Vector3()),Math.max(.18,bounds.getSize(new THREE.Vector3()).length()*1.5));}
  look(target,distance,direction){
    const offset=direction||this.camera.position.clone().sub(this.controls.target);if(offset.lengthSq()<1e-10)offset.set(0,0,1);
    this.controls.target.copy(target);this.camera.position.copy(target).add(offset.normalize().multiplyScalar(distance));this.controls.update();
  }
  disable(){if(!this.enabled)return;this.enabled=false;this.actorKey='';this.controls.enabled=false;this.camera.near=this.originalNear;this.camera.updateProjectionMatrix();}
  dispose(){this.disable();this.controls?.dispose();if(this.stopWheel)this.canvas.removeEventListener('wheel',this.stopWheel);}
}

import * as THREE from 'three';

export function normalizeSpatialCamera(value={}){
 const strength=Number(value?.strength);
 return{enabled:value?.enabled===true,strength:Number.isFinite(strength)?THREE.MathUtils.clamp(strength,0,1):.5};
}
export class SpatialCamera{
 constructor(camera,viewport,{paused=()=>false,reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false}={}){
  this.camera=camera;this.viewport=viewport;this.paused=paused;this.reducedMotion=reducedMotion;
  this.settings=normalizeSpatialCamera();this.target=new THREE.Vector2();this.current=new THREE.Vector2();
  this.offset=new THREE.Vector3();this.rotation=new THREE.Quaternion();this.savedPosition=new THREE.Vector3();this.savedRotation=new THREE.Quaternion();
  this.move=e=>{if(e.pointerType&&e.pointerType!=='mouse'||!this.settings.enabled||this.paused()||this.reducedMotion())return;const r=viewport.getBoundingClientRect();if(r.width&&r.height)this.target.set(THREE.MathUtils.clamp((e.clientX-r.left)/r.width*2-1,-1,1),THREE.MathUtils.clamp(1-(e.clientY-r.top)/r.height*2,-1,1));};
  this.leave=()=>this.target.set(0,0);this.clear=()=>this.reset();
  viewport.addEventListener('pointermove',this.move);viewport.addEventListener('pointerleave',this.leave);globalThis.window?.addEventListener('blur',this.clear);globalThis.document?.addEventListener('visibilitychange',this.clear);
 }
 setSettings(value){const next=normalizeSpatialCamera(value);if(next.enabled!==this.settings.enabled)this.reset();this.settings=next;}
 reset(){this.target.set(0,0);this.current.set(0,0);}
 update(delta){if(!this.settings.enabled||this.paused()||this.reducedMotion()){this.reset();return;}this.current.lerp(this.target,1-Math.exp(-Math.min(Math.max(0,delta),.1)*8));}
 render(callback){
  if(!this.settings.enabled||!this.settings.strength||this.paused()||this.reducedMotion()||this.current.lengthSq()<1e-10)return callback();
  const c=this.camera,s=this.settings.strength;this.savedPosition.copy(c.position);this.savedRotation.copy(c.quaternion);
  try{
   this.offset.set(this.current.x*.04*s,this.current.y*.025*s,0).applyQuaternion(this.savedRotation);c.position.add(this.offset);
   this.rotation.setFromEuler(new THREE.Euler(this.current.y*.014*s,-this.current.x*.021*s,0,'YXZ'));c.quaternion.multiply(this.rotation);c.updateMatrixWorld(true);
   return callback();
  }finally{c.position.copy(this.savedPosition);c.quaternion.copy(this.savedRotation);c.updateMatrixWorld(true);}
 }
 dispose(){this.viewport.removeEventListener('pointermove',this.move);this.viewport.removeEventListener('pointerleave',this.leave);globalThis.window?.removeEventListener('blur',this.clear);globalThis.document?.removeEventListener('visibilitychange',this.clear);this.reset();}
}

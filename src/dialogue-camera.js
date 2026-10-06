import * as THREE from 'three';
export function normalizeDialogueCamera(value){
 if(!value||!Array.isArray(value.position)||value.position.length!==3||value.position.some(n=>!Number.isFinite(n)||Math.abs(n)>1e6))return null;
 const camera=new THREE.PerspectiveCamera();camera.position.fromArray(value.position);
 if(Array.isArray(value.rotation)&&value.rotation.length===4&&value.rotation.every(Number.isFinite)&&Math.hypot(...value.rotation)>.001)camera.quaternion.fromArray(value.rotation).normalize();
 else if(Array.isArray(value.target)&&value.target.length===3&&value.target.every(Number.isFinite))camera.lookAt(new THREE.Vector3().fromArray(value.target));else return null;
 return {position:camera.position.toArray(),rotation:camera.quaternion.toArray(),fov:THREE.MathUtils.clamp(Number(value.fov)||50,20,100)};
}
export function snapshotCamera(camera){return {position:camera.position.toArray(),rotation:camera.quaternion.toArray(),fov:camera.fov};}
export function applyDialogueCamera(camera,value){const pose=normalizeDialogueCamera(value);if(!pose)return false;camera.position.fromArray(pose.position);camera.quaternion.fromArray(pose.rotation);camera.fov=pose.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return true;}
export function resolveDialogueCamera(act,index,environment,fallback){
 for(let i=index;i>=0;i--){const pose=normalizeDialogueCamera(act?.steps?.[i]?.camera);if(pose)return pose;}
 return normalizeDialogueCamera(environment?.camera)||normalizeDialogueCamera(fallback);
}
export function cameraTravelSeconds(from,to,speed=1){
 const a=normalizeDialogueCamera(from),b=normalizeDialogueCamera(to);if(!a||!b)return 0;
 const distance=new THREE.Vector3().fromArray(a.position).distanceTo(new THREE.Vector3().fromArray(b.position)),angle=new THREE.Quaternion().fromArray(a.rotation).angleTo(new THREE.Quaternion().fromArray(b.rotation)),fov=Math.abs(a.fov-b.fov);
 if(distance<.001&&angle<.001&&fov<.01)return 0;
 return THREE.MathUtils.clamp(distance/4+angle/Math.PI*.7+fov/100,.35,4)/THREE.MathUtils.clamp(Number(speed)||1,.85,1.15);
}
export class DialogueCameraController{
 constructor(camera,viewport,{confirmed=()=>{},cancelled=()=>{},paused=()=>false}={}){
  this.camera=camera;this.viewport=viewport;this.confirmed=confirmed;this.cancelled=cancelled;this.paused=paused;this.editing=false;this.travel=null;this.keys=new Set();this.frame=0;
  this.keyDown=e=>{if(!this.editing)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.cancelEdit();return;}if(e.ctrlKey||e.metaKey||!viewport.contains(document.activeElement)&&document.pointerLockElement!==viewport)return;if(!['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','AltLeft','AltRight'].includes(e.code))return;e.preventDefault();e.stopImmediatePropagation();this.keys.add(e.code);};
  this.keyUp=e=>this.keys.delete(e.code);
  this.mouseMove=e=>{if(!this.editing||!viewport.contains(e.target)&&document.pointerLockElement!==viewport)return;const dx=document.pointerLockElement===viewport?e.movementX:this.lastMouse?e.clientX-this.lastMouse.x:0,dy=document.pointerLockElement===viewport?e.movementY:this.lastMouse?e.clientY-this.lastMouse.y:0;this.lastMouse={x:e.clientX,y:e.clientY};const rotation=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');rotation.y-=dx*.0025;rotation.x=THREE.MathUtils.clamp(rotation.x-dy*.0025,-Math.PI*.49,Math.PI*.49);camera.quaternion.setFromEuler(rotation);};
  this.mouseDown=e=>{if(!this.editing||e.button!==0||!viewport.contains(e.target)&&document.pointerLockElement!==viewport)return;e.preventDefault();e.stopImmediatePropagation();const pose=snapshotCamera(camera);this.endEdit();this.confirmed(pose);};
  this.lostPointer=()=>{if(this.editing&&this.locked&&document.pointerLockElement!==viewport)this.cancelEdit();};
  this.blur=()=>this.keys.clear();this.visibility=()=>{this.last=performance.now();this.keys.clear();};
  document.addEventListener('keydown',this.keyDown,true);document.addEventListener('keyup',this.keyUp,true);document.addEventListener('mousemove',this.mouseMove,true);document.addEventListener('mousedown',this.mouseDown,true);document.addEventListener('pointerlockchange',this.lostPointer);document.addEventListener('visibilitychange',this.visibility);window.addEventListener('blur',this.blur);
 }
 get moving(){return Boolean(this.travel);}
 startEdit(){this.finish();this.original=snapshotCamera(this.camera);this.editing=true;this.locked=false;this.lastMouse=null;this.keys.clear();this.viewport.tabIndex=0;this.viewport.focus({preventScroll:true});this.viewport.classList.add('camera-editing');this.startTick();}
 requestMouseLock(){try{const result=this.viewport.requestPointerLock?.();result?.then?.(()=>{this.locked=true;}).catch(()=>{});}catch{}}
 endEdit(){this.editing=false;this.keys.clear();this.viewport.classList.remove('camera-editing');if(document.pointerLockElement===this.viewport)document.exitPointerLock();this.locked=false;}
 cancelEdit(){if(!this.editing)return;const original=this.original;this.endEdit();applyDialogueCamera(this.camera,original);this.cancelled();}
 moveKeys(delta){
  let speed=3;if(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'))speed*=3;if(this.keys.has('AltLeft')||this.keys.has('AltRight'))speed*=.25;
  const direction=new THREE.Vector3((this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0),(this.keys.has('KeyE')?1:0)-(this.keys.has('KeyQ')?1:0),(this.keys.has('KeyS')?1:0)-(this.keys.has('KeyW')?1:0));
  if(direction.lengthSq()){direction.normalize().applyQuaternion(this.camera.quaternion);this.camera.position.addScaledVector(direction,speed*delta);}
 }
 to(value,{animate=false,speed=1}={}){this.finish();const target=normalizeDialogueCamera(value);if(!target)return Promise.resolve();const from=snapshotCamera(this.camera),seconds=animate?cameraTravelSeconds(from,target,speed):0;if(!seconds){applyDialogueCamera(this.camera,target);return Promise.resolve();}return new Promise(resolve=>{this.travel={from,target,seconds,elapsed:0,resolve};this.startTick();});}
 finish(){if(!this.travel)return;const travel=this.travel;this.travel=null;applyDialogueCamera(this.camera,travel.target);travel.resolve();}
 cancelTravel(){if(!this.travel)return;const travel=this.travel;this.travel=null;travel.resolve();}
 startTick(){if(this.frame)return;this.last=performance.now();this.frame=requestAnimationFrame(time=>this.tick(time));}
 tick(time){this.frame=0;const delta=Math.max(0,(time-this.last)/1000);this.last=time;if(this.editing)this.moveKeys(Math.min(delta,.1));
  if(this.travel&&!this.paused()){const t=this.travel;t.elapsed+=delta;const progress=THREE.MathUtils.smoothstep(Math.min(1,t.elapsed/t.seconds),0,1);this.camera.position.fromArray(t.from.position).lerp(new THREE.Vector3().fromArray(t.target.position),progress);this.camera.quaternion.fromArray(t.from.rotation).slerp(new THREE.Quaternion().fromArray(t.target.rotation),progress);this.camera.fov=THREE.MathUtils.lerp(t.from.fov,t.target.fov,progress);this.camera.updateProjectionMatrix();if(t.elapsed>=t.seconds)this.finish();}
  if(this.editing||this.travel)this.frame=requestAnimationFrame(next=>this.tick(next));
 }
 dispose(){this.cancelEdit();this.cancelTravel();cancelAnimationFrame(this.frame);document.removeEventListener('keydown',this.keyDown,true);document.removeEventListener('keyup',this.keyUp,true);document.removeEventListener('mousemove',this.mouseMove,true);document.removeEventListener('mousedown',this.mouseDown,true);document.removeEventListener('pointerlockchange',this.lostPointer);document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('blur',this.blur);}
}

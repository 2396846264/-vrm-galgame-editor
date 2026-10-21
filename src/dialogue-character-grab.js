import * as THREE from 'three';

// Uses the visible model meshes for picking, so empty slots and hidden actors
// cannot be selected. Transforms are committed only when the actor is released.
export class DialogueCharacterGrab {
 constructor(stage,{placed=()=>{}}={}){this.stage=stage;this.placed=placed;this.held=null;this.falling=[];this.ray=new THREE.Raycaster();this.direction=new THREE.Vector3();
  this.beam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xff2222,depthTest:false,transparent:true,opacity:.95}));this.beam.frustumCulled=false;this.beam.renderOrder=10000;this.beam.visible=false;stage.scene.add(this.beam);
 }
 toggle(){if(this.held){this.release();return true;}const {stage}=this;stage.scene.updateMatrixWorld(true);stage.camera.updateMatrixWorld(true);this.ray.setFromCamera(new THREE.Vector2(0,0),stage.camera);
  const records=[...stage.visibleRecords.entries()].filter(([,r])=>r.anchor.visible&&r.vrm.scene.visible),hits=this.ray.intersectObjects(records.map(([,r])=>r.vrm.scene),true);
  const hit=hits.find(h=>h.object.visible);if(!hit)return false;
  // A wall in front of a character blocks the grab.
  const blocker=this.ray.intersectObjects(this.surfaces(),false)[0];if(blocker&&blocker.distance<hit.distance-.02)return false;
  const entry=records.find(([,r])=>{for(let o=hit.object;o;o=o.parent)if(o===r.vrm.scene)return true;return false;});if(!entry)return false;
  const [id,record]=entry;this.finishFall(record);this.held={id,record,original:record.anchor.position.clone(),distance:Math.max(.6,hit.distance),offset:record.anchor.position.clone().sub(hit.point)};record.transformBlend=null;this.clearFeet(record);this.beam.visible=true;this.update(0);return true;
 }
 surfaces(){const result=[];this.stage.environmentRuntime?.root?.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible||p.userData.environmentSky||p.userData.water)return;result.push(o);});return result;}
 clearFeet(record){if(record.footLock)for(const side of ['left','right'])if(record.footLock[side])record.footLock[side].anchor=null;}
 groundPosition(record){record.anchor.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(record.vrm.scene,true),foot=Number.isFinite(bounds.min.y)?bounds.min.y:record.anchor.position.y;
  // Start above the model's current feet; choose the nearest upward surface
  // beneath them. A floor plane at y=0 remains the empty-stage fallback.
  const ray=new THREE.Raycaster(new THREE.Vector3(record.anchor.position.x,Math.max(foot+.3,.3),record.anchor.position.z),new THREE.Vector3(0,-1,0));
  const hit=ray.intersectObjects(this.surfaces(),false).find(h=>h.face&&h.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(h.object.matrixWorld)).y>.35);
  const floor=hit?hit.point.y:0;return record.anchor.position.clone().setY(record.anchor.position.y+floor-foot);
 }
 release(){const held=this.held;if(!held)return;this.held=null;this.beam.visible=false;const target=this.groundPosition(held.record);this.placed(held.id,target.clone());this.clearFeet(held.record);
  if(target.y<held.record.anchor.position.y-.005)this.falling.push({record:held.record,target,velocity:0});else held.record.anchor.position.copy(target);
 }
 finishFall(record){for(const fall of this.falling.filter(f=>!record||f.record===record)){fall.record.anchor.position.copy(fall.target);this.clearFeet(fall.record);}this.falling=this.falling.filter(f=>record&&f.record!==record);}
 update(delta){if(this.held){const {record,distance,offset}=this.held,camera=this.stage.camera;camera.getWorldDirection(this.direction);const point=camera.position.clone().addScaledVector(this.direction,distance);record.anchor.position.copy(point).add(offset);this.clearFeet(record);
   const start=camera.position.clone().addScaledVector(this.direction,.3).add(new THREE.Vector3(.12,-.12,0).applyQuaternion(camera.quaternion));const attr=this.beam.geometry.attributes.position;attr.setXYZ(0,start.x,start.y,start.z);attr.setXYZ(1,point.x,point.y,point.z);attr.needsUpdate=true;this.beam.geometry.computeBoundingSphere();}
  for(const fall of this.falling){fall.velocity+=9.8*delta;fall.record.anchor.position.y=Math.max(fall.target.y,fall.record.anchor.position.y-fall.velocity*delta);this.clearFeet(fall.record);}this.falling=this.falling.filter(f=>f.record.anchor.position.y>f.target.y);
 }
 end(cancel=false){if(this.held){if(cancel){this.held.record.anchor.position.copy(this.held.original);this.clearFeet(this.held.record);this.held=null;this.beam.visible=false;}else this.release();}this.finishFall();}
 dispose(){this.end(true);this.beam.removeFromParent();this.beam.geometry.dispose();this.beam.material.dispose();}
}

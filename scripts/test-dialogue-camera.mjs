import assert from 'node:assert/strict';
import * as THREE from 'three';
import {normalizeDialogueCamera,snapshotCamera,applyDialogueCamera,resolveDialogueCamera,cameraTravelSeconds} from '../src/dialogue-camera.js';
const initial={position:[0,1,5],target:[0,1,0],fov:50},next={position:[4,2,7],target:[0,1,0],fov:45},a=normalizeDialogueCamera(initial),b=normalizeDialogueCamera(next);
assert.equal(normalizeDialogueCamera({position:[NaN,0,0],rotation:[0,0,0,1]}),null);assert.equal(normalizeDialogueCamera({position:[0,0,0],rotation:[0,0,0,0]}),null);
assert.deepEqual(resolveDialogueCamera({steps:[{}, {camera:b},{}]},2,{camera:initial},null).position,b.position);assert.deepEqual(resolveDialogueCamera({steps:[{},{}]},1,{camera:initial},null).position,a.position);
assert.equal(cameraTravelSeconds(a,a),0);assert.ok(cameraTravelSeconds(a,b)>0);const farther={...a,position:[40,1,5]};assert.ok(cameraTravelSeconds(a,farther)>cameraTravelSeconds(a,b));assert.ok(cameraTravelSeconds(a,b,1.15)<cameraTravelSeconds(a,b,.85));
const camera=new THREE.PerspectiveCamera();assert.ok(applyDialogueCamera(camera,b));assert.deepEqual(snapshotCamera(camera).position,b.position);assert.ok(new THREE.Quaternion().fromArray(snapshotCamera(camera).rotation).angleTo(new THREE.Quaternion().fromArray(b.rotation))<1e-6);
console.log('Dialogue camera: valid pose, initial fallback, dialogue inheritance, exact round trip, distance/rotation timing and player speed passed.');

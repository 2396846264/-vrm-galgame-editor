import assert from 'node:assert/strict';
import * as THREE from 'three';
import {normalizePortraitFraming,framePortraitCamera} from '../src/portrait-framing.js';
assert.deepEqual(normalizePortraitFraming(),{offsetX:0,offsetY:0,scale:1});assert.deepEqual(normalizePortraitFraming({offsetX:Infinity,offsetY:-500,scale:99}),{offsetX:0,offsetY:-100,scale:3});
const a=new THREE.OrthographicCamera(-1,3,4,-2,.01,100);a.position.z=5;a.updateMatrixWorld(true);const before=a.clone(),point=new THREE.Vector3(.3,.4,0),p=point.clone().project(before);framePortraitCamera(a,{offsetX:20,offsetY:-10,scale:1});const shifted=point.clone().project(a);assert.ok(Math.abs(shifted.x-p.x-.4)<1e-8);assert.ok(Math.abs(shifted.y-p.y+.2)<1e-8);
const b=before.clone();framePortraitCamera(b,{scale:2});assert.equal(b.right-b.left,2);assert.equal(b.top-b.bottom,3);assert.equal(before.right-before.left,4);assert.ok(b.position.equals(before.position));assert.ok(b.quaternion.equals(before.quaternion));console.log('PASS portrait framing: defaults, finite validation, bounds, horizontal/vertical projection, uniform zoom, unchanged actor and camera pose.');

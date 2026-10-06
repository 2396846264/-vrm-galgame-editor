import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createImagePlaneMaterial} from '../src/environment-runtime.js';
const texture=new THREE.DataTexture(new Uint8Array([0,0,0,0,255,100,50,128,255,255,255,255]),3,1);
for(const unlit of [true,false]){
 const material=createImagePlaneMaterial(texture,{unlit,alphaCutoff:0});
 assert.equal(material.map,texture);assert.equal(material.transparent,true);assert.equal(material.depthWrite,false);assert.equal(material.forceSinglePass,true);assert.ok(material.alphaTest>0&&material.alphaTest<.01);
 assert.equal(material.isMeshStandardMaterial===true,!unlit);material.dispose();
}
assert.equal(createImagePlaneMaterial(texture,{alphaCutoff:.5}).alphaTest,.5);
console.log('Image planes: lit/unlit transparency, zero-alpha discard, soft-alpha blending and no invisible depth occlusion passed.');

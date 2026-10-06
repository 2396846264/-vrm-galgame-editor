import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CharacterSceneLighting,environmentAmbient} from '../src/character-scene-lighting.js';
const root=new THREE.Group(),m=new THREE.MeshStandardMaterial({emissive:0xffffff,emissiveIntensity:2});
m.parametricRimColorFactor=new THREE.Color(.2,.4,.6);m.matcapFactor=new THREE.Color(.3,.2,.1);m.outlineLightingMixFactor=.3;
root.add(new THREE.Mesh(new THREE.BoxGeometry(),m));const policy=new CharacterSceneLighting();policy.capture(root);policy.apply(root,true);
assert.equal(m.emissiveIntensity,0);assert.equal(m.matcapFactor.r,0);assert.equal(m.parametricRimColorFactor.r,0);assert.equal(m.outlineLightingMixFactor,1);
// Expression managers can rewrite rim colors. The policy reapplies after VRM.update.
m.matcapFactor.setRGB(1,1,1);policy.apply(root,true);assert.equal(m.matcapFactor.r,0);
policy.apply(root,false);assert.equal(m.emissiveIntensity,2);assert.equal(m.matcapFactor.r,.3);assert.equal(m.parametricRimColorFactor.b,.6);
assert.equal(environmentAmbient({lighting:{intensity:2.2}}),.35);assert.equal(environmentAmbient({lighting:{intensity:0}}),0);assert.equal(environmentAmbient({lighting:{intensity:2,ambientIntensity:0}}),0);
console.log(JSON.stringify({ok:true,emissionSuppressed:true,rimAndMatcapSuppressed:true,originalRestored:true,ambientZero:true}));

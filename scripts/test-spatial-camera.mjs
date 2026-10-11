import assert from 'node:assert/strict';import * as THREE from 'three';
import {SpatialCamera,normalizeSpatialCamera}from'../src/spatial-camera.js';
const events=new Map(),viewport={addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n),getBoundingClientRect:()=>({left:100,top:50,width:800,height:450})};
const camera=new THREE.PerspectiveCamera(40,16/9,.1,100);camera.position.set(2,1.5,5);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);const p=camera.position.clone(),q=camera.quaternion.clone();let paused=false,reduced=false;
const spatial=new SpatialCamera(camera,viewport,{paused:()=>paused,reducedMotion:()=>reduced});assert.equal(normalizeSpatialCamera().enabled,false);assert.equal(normalizeSpatialCamera({strength:4}).strength,1);
spatial.setSettings({enabled:true,strength:.5});events.get('pointermove')({pointerType:'mouse',clientX:900,clientY:50});for(let i=0;i<90;i++)spatial.update(1/60);
spatial.render(()=>{assert(camera.position.distanceTo(p)>.01&&camera.position.distanceTo(p)<.025);assert(camera.quaternion.angleTo(q)>.005&&camera.quaternion.angleTo(q)<.02);});assert(camera.position.equals(p)&&camera.quaternion.equals(q),'Saved camera must never drift');
for(let i=0;i<200;i++)spatial.render(()=>{});assert(camera.position.equals(p)&&camera.quaternion.equals(q));assert.throws(()=>spatial.render(()=>{throw Error('render failed');}),/render failed/);assert(camera.position.equals(p)&&camera.quaternion.equals(q));
events.get('pointerleave')();for(let i=0;i<120;i++)spatial.update(1/60);assert(spatial.current.length()<1e-6);
spatial.reset();events.get('pointermove')({pointerType:'touch',clientX:900,clientY:50});spatial.update(1);assert.equal(spatial.current.length(),0);
events.get('pointermove')({pointerType:'mouse',clientX:900,clientY:50});paused=true;spatial.update(1/60);assert.equal(spatial.current.length(),0);paused=false;reduced=true;spatial.render(()=>assert(camera.position.equals(p)));reduced=false;
// A new authored pose is the new base, rather than the previous pointer pose.
camera.position.x=10;const next=camera.position.clone();events.get('pointermove')({pointerType:'mouse',clientX:900,clientY:50});spatial.update(.1);spatial.render(()=>assert(camera.position.distanceTo(next)<.025));assert(camera.position.equals(next));spatial.setSettings({enabled:false});assert.equal(spatial.current.length(),0);spatial.dispose();assert.equal(events.size,0);
console.log('PASS: real 3D pointer offset is bounded, no pose accumulation, restore on errors, leave/disable/pause/reduced-motion/touch handling and edited camera continuity.');

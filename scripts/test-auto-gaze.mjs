import assert from 'node:assert/strict';
import * as THREE from 'three';
import {VRMLookAt,VRMLookAtBoneApplier,VRMLookAtExpressionApplier,VRMLookAtRangeMap,VRMExpressionManager,VRMExpression} from '@pixiv/three-vrm';
import {createGazeRig} from '../src/gaze-rig.js';
import {createAutoGaze} from '../src/auto-gaze.js';
import {createAutoBlink} from '../src/auto-blink.js';
import {createNaturalActivity} from '../src/natural-activity.js';
const q=new THREE.Quaternion();
function actor(mmd=false){
 const scene=new THREE.Group(),head=new THREE.Bone(),left=new THREE.Bone(),right=new THREE.Bone(),tip=new THREE.Bone();
 head.name='頭';left.name='左目';right.name='右目';tip.name='左目先';scene.add(head);head.position.y=1.6;head.add(left,right);left.add(tip);left.position.x=.1;right.position.x=-.1;tip.position.z=.1;
 const nodes={head,leftEye:left,rightEye:right},humanoid={getRawBoneNode:n=>nodes[n],getNormalizedBoneNode:n=>nodes[n]};
 const manager=new VRMExpressionManager();for(const name of ['lookLeft','lookRight','lookUp','lookDown','blink','happy'])manager.registerExpression(new VRMExpression(name));
 const vrm={scene,humanoid,expressionManager:manager,isMmd:mmd};
 if(mmd)vrm.mesh={skeleton:{bones:[head,left,right,tip]},geometry:{userData:{MMD:{bones:[{name:'頭'},{name:'左目'},{name:'右目'},{name:'左目先',grant:{parentIndex:1,affectRotation:true,ratio:-.7}}]}}}};
 return {vrm,head,left,right,tip,actorKey:scene.uuid};
}
const m=actor(true),rig=createGazeRig(m.vrm),before=m.left.quaternion.clone();m.vrm.expressionManager.setValue('blink',.6);
rig.apply(10,4);assert(m.left.quaternion.angleTo(before)>.1);assert(m.tip.quaternion.angleTo(q)>.07);assert(m.head.quaternion.angleTo(q)<1e-8);assert.equal(m.vrm.expressionManager.getValue('blink'),.6);rig.restore();assert(m.left.quaternion.angleTo(before)<1e-8);assert(m.tip.quaternion.angleTo(q)<1e-8);
// Head-space rotation still looks in the same local direction after body yaw.
m.vrm.scene.rotation.y=Math.PI/2;m.vrm.scene.updateMatrixWorld(true);rig.apply(8,0);const local=m.left.quaternion.clone();rig.restore();m.vrm.scene.rotation.y=0;m.vrm.scene.updateMatrixWorld(true);rig.apply(8,0);assert(local.angleTo(m.left.quaternion)<1e-6);rig.restore();
const v=actor(),map=new VRMLookAtRangeMap(90,15);v.vrm.lookAt=new VRMLookAt(v.vrm.humanoid,new VRMLookAtBoneApplier(v.vrm.humanoid,map,map,map,map));const vrig=createGazeRig(v.vrm);
vrig.apply(8,3);assert(v.left.quaternion.angleTo(q)>.1);assert.equal(v.vrm.lookAt.yaw,0);assert.equal(v.vrm.lookAt.pitch,0);vrig.restore();assert(v.left.quaternion.angleTo(q)<1e-8);
v.vrm.lookAt.target=new THREE.Object3D();assert(vrig.authored(v));v.vrm.lookAt.target=null;
v.currentAction=new THREE.AnimationMixer(v.vrm.scene).clipAction(new THREE.AnimationClip('eye motion',1,[new THREE.QuaternionKeyframeTrack(v.left.uuid+'.quaternion',[0,1],[0,0,0,1,0,.2,0,Math.sqrt(.96)])]));v.currentAction.play();assert(vrig.authored(v));v.currentAction=null;
const e=actor(),emap=new VRMLookAtRangeMap(90,1);e.vrm.lookAt=new VRMLookAt(e.vrm.humanoid,new VRMLookAtExpressionApplier(e.vrm.expressionManager,emap,emap,emap,emap));const erig=createGazeRig(e.vrm);e.vrm.expressionManager.setValue('happy',.7);erig.apply(6,3);assert(Math.abs(e.vrm.expressionManager.getValue('lookLeft')-.4)<1e-6);assert(e.vrm.expressionManager.getValue('lookUp')>.1);assert.equal(e.vrm.expressionManager.getValue('happy'),.7);erig.restore();assert.equal(e.vrm.expressionManager.getValue('lookLeft'),0);
const sample=actor(true),other=actor(true),behind=actor(true);other.vrm.scene.position.set(1,0,.5);behind.vrm.scene.position.set(0,0,-3);other.vrm.scene.updateMatrixWorld(true);behind.vrm.scene.updateMatrixWorld(true);const gaze=createAutoGaze(sample.vrm,()=>.17);let actorEvents=0,peak=0,prevCount=0,lastEvent=-99,minGap=999,lastActor=-99;
for(let i=0;i<10800;i++){gaze.restore();gaze.update(1/60,{record:sample,others:[sample,other,behind]});const d=gaze.diagnostics();peak=Math.max(peak,Math.abs(d.yaw));if(d.count>prevCount){minGap=Math.min(minGap,i/60-lastEvent);lastEvent=i/60;prevCount=d.count;if(d.kind==='actor'){assert.equal(d.target,other.actorKey);assert(i/60-lastActor>=45);lastActor=i/60;actorEvents++;}}assert(Math.abs(d.yaw)<=13&&Math.abs(d.pitch)<=6);}
assert(peak>=8&&actorEvents>0&&minGap>=8);gaze.restore();gaze.update(0,{record:sample,others:[]});
// Twenty actors all start with identical timers deliberately. Crowd admission
// must stagger them even in this worst case, without starving later actors.
let seed=9;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};const activity=createNaturalActivity(random),crowd=Array.from({length:20},()=>actor(true));
const blinks=crowd.map(()=>{const values={blink:0};return createAutoBlink({expressions:[{expressionName:'blink'}],getValue:n=>values[n],setValue:(n,v)=>values[n]=v},()=>.5);});
const gazes=crowd.map(a=>createAutoGaze(a.vrm,()=>.5));let maxClosed=0,maxGazing=0,blinkStarts=[],gazeStarts=[];
const oldB=crowd.map(()=>0),oldG=crowd.map(()=>0);
for(let n=0;n<7200;n++){
 activity.tick(1/60);let closed=0,active=0;
 for(let i=0;i<crowd.length;i++){
  blinks[i].restore();blinks[i].update(1/60,()=>activity.request('blink',crowd[i]));const b=blinks[i].diagnostics();if(b.weight>0)closed++;if(b.count!==oldB[i]){blinkStarts.push(n/60);oldB[i]=b.count;}
  gazes[i].restore();gazes[i].update(1/60,{record:crowd[i],others:crowd,activity});const g=gazes[i].diagnostics();if(g.phase!=='idle')active++;if(g.count!==oldG[i]){gazeStarts.push(n/60);oldG[i]=g.count;}
 }
 maxClosed=Math.max(maxClosed,closed);maxGazing=Math.max(maxGazing,active);
}
assert.equal(maxClosed,1);assert(maxGazing<=2);assert(oldB.every(v=>v>0));assert(oldG.every(v=>v>0));assert(blinkStarts.every((t,i)=>!i||t-blinkStarts[i-1]>=.28));assert(gazeStarts.every((t,i)=>!i||t-gazeStarts[i-1]>=1.2));
gazes.forEach((g,i)=>{g.restore();g.reset(activity);assert.equal(g.diagnostics().phase,'idle');assert.equal(g.diagnostics().yaw,0);});blinks.forEach(b=>{b.reset();assert.equal(b.diagnostics().weight,0);assert(b.diagnostics().remaining>=6);});assert.equal(activity.diagnostics().activeGazes,0);
assert.equal(createGazeRig({isFbx:true}),null);
console.log(JSON.stringify({ok:true,actorEvents,minGap,peak,maxClosed,maxGazing,all20ActorsParticipate:true,checks:['MMD eye-tip grant preserved','head-space turn','VRM calibrated bone lookAt','VRM expression lookAt','original lookAt target unchanged','authored eye motion priority','return baseline','other actors only, exclude behind','bounded angles','8-16 second intervals','45-75 second actor cooldown','twenty actor blink/gaze staggering','blink coexistence']}));

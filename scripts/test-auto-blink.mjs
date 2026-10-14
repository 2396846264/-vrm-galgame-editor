import assert from 'node:assert/strict';
import {createAutoBlink} from '../src/auto-blink.js';
import {createMmdExpressions} from '../src/mmd-expressions.js';
import {createTalkingMouth} from '../src/talking-mouth.js';
import * as THREE from 'three';
import {VRMExpression,VRMExpressionManager,VRMExpressionMorphTargetBind} from '@pixiv/three-vrm';
const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
mesh.morphTargetInfluences=[0,0,0];
const manager=new VRMExpressionManager();
for(const [i,name]of ['blink','happy','aa'].entries()){
 const e=new VRMExpression(name);e.addBind(new VRMExpressionMorphTargetBind({primitives:[mesh],index:i,weight:1}));manager.registerExpression(e);
}
manager.setValue('happy',.4);manager.setValue('aa',.3);
const blink=createAutoBlink(manager,()=>.5),events=[];
let was=false,peak=0;
for(let n=0;n<3600;n++){
 blink.restore();blink.update(1/60);manager.update();const v=mesh.morphTargetInfluences[0];
 if(v>0&&!was)events.push(n/60);was=v>0;peak=Math.max(peak,v);
 assert.equal(mesh.morphTargetInfluences[1],.4);assert.equal(mesh.morphTargetInfluences[2],.3);
}
assert(peak>.98&&events.length>=5&&events.length<=7);
assert(events.every((t,i)=>i===0||t-events[i-1]>=6));
blink.restore();manager.setValue('blink',.7);
for(let n=0;n<800;n++){blink.restore();blink.update(1/60);manager.update();assert.equal(mesh.morphTargetInfluences[0],.7);}
blink.restore();manager.setValue('blink',0);
while(blink.diagnostics().weight<.9)blink.update(1/60);
manager.setValue('blink',.45);blink.restore();assert.equal(manager.getValue('blink'),.45);
const happy=manager.getExpression('happy');happy.overrideBlink='block';manager.setValue('happy',1);manager.setValue('blink',1);manager.update();assert.equal(mesh.morphTargetInfluences[0],0);
const leftValues={blinkLeft:0,blinkRight:0},leftManager={expressions:Object.keys(leftValues).map(expressionName=>({expressionName})),getValue:n=>leftValues[n],setValue:(n,v)=>leftValues[n]=v};
const paired=createAutoBlink(leftManager,()=>0);for(let i=0;i<370;i++){paired.restore();paired.update(1/60);assert.equal(leftValues.blinkLeft,leftValues.blinkRight);}assert.equal(createAutoBlink({...leftManager,expressions:[{expressionName:'blinkLeft'}]}),null);
assert.equal(createAutoBlink(null),null);assert.equal(createAutoBlink({expressions:[{expressionName:'happy'}]}),null);
const pmx={userData:{mmdMouthMorphs:['あ']},morphTargetDictionary:{'まばたき':0,'ウィンク':1,'ウィンク右':2,'笑い':3,'あ':4,'口角上げ':5},morphTargetInfluences:Array(6).fill(0)};
const e=createMmdExpressions(pmx),auto=createAutoBlink(e,()=>0),mouth=createTalkingMouth(e,()=>.5);mouth.start();let mmdPeak=0;
for(let i=0;i<400;i++){auto.restore();mouth.restore();e.restore();auto.update(1/60);mouth.update(1/60);e.update();mmdPeak=Math.max(mmdPeak,pmx.morphTargetInfluences[0]);assert.equal(e.getValue('blink'),0);}
assert(mmdPeak>.98);mouth.stop();auto.restore();e.update();assert.equal(pmx.morphTargetInfluences[0],0);
// An actual AnimationMixer owns the native MMD blink. Temporary weights must
// neither stack nor survive into the next sampled frame.
const nativeMesh=new THREE.Mesh();nativeMesh.morphTargetDictionary=pmx.morphTargetDictionary;nativeMesh.morphTargetInfluences=pmx.morphTargetInfluences;const mixer=new THREE.AnimationMixer(nativeMesh);
mixer.clipAction(new THREE.AnimationClip('VMD blink',2,[new THREE.NumberKeyframeTrack('.morphTargetInfluences[0]',[0,1,2],[0,.8,0])])).play();
for(let i=0;i<600;i++){auto.restore();e.restore();mixer.update(1/60);const native=pmx.morphTargetInfluences[0];e.setAutoBlinkWeight(1);e.update(true);if(native>.02)assert.equal(pmx.morphTargetInfluences[0],native);e.restore();assert.equal(pmx.morphTargetInfluences[0],native);}
e.restore();pmx.morphTargetInfluences.fill(0);e.setValue('まばたき',.65);e.setAutoBlinkWeight(1);e.update();assert.equal(pmx.morphTargetInfluences[0],.65);
e.resetValues();e.setValue('happy',1);e.update();assert.equal(pmx.morphTargetInfluences[3],.6);assert.equal(pmx.morphTargetInfluences[0],0);
const english={morphTargetDictionary:{'BLINK':0},morphTargetInfluences:[0]};assert(createAutoBlink(createMmdExpressions(english)));
console.log(JSON.stringify({ok:true,events,peak,mmdPeak,checks:['6-12 second spacing','close/open easing','VRM actual morph binding','manual closed eyes preserved','mid-frame expression changes','VRM overrideBlink','both-eyes fallback','missing eyelids safe','MMD isolated layer','speech coexistence','native AnimationMixer blink preserved','raw Japanese expression priority','smiling closed eyes priority','English MMD names']}));

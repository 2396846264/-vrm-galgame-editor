import assert from 'node:assert/strict';
import {createMmdExpressions} from '../src/mmd-expressions.js';
import {createTalkingMouth} from '../src/talking-mouth.js';
const mesh={userData:{mmdMouthMorphs:['あ','い','口角上げ','口横広げ']},morphTargetDictionary:{'あ':0,'い':1,'口角上げ':2,'笑い':3,'口横広げ':4},morphTargetInfluences:[0,0,0,0,0]},e=createMmdExpressions(mesh);
e.setValue('あ',.95);e.setValue('aa',.7);e.setValue('口横広げ',.8);e.setValue('happy',.6);e.update();
const mouth=createTalkingMouth(e,()=>.5);mouth.start();for(let i=0;i<8;i++){mouth.restore();mouth.update(.05);e.update();assert(mesh.morphTargetInfluences[0]<.7);assert.equal(mesh.morphTargetInfluences[2],0);assert.equal(mesh.morphTargetInfluences[4],0);assert.equal(mesh.morphTargetInfluences[3],.36);}mouth.stop();e.update();assert.equal(mesh.morphTargetInfluences[0],.95);assert.equal(mesh.morphTargetInfluences[2],.6);assert.equal(mesh.morphTargetInfluences[4],.8);
e.resetValues();mesh.morphTargetInfluences=[.9,0,.8,.2,.5];mouth.start();mouth.update(.05);e.update(true);assert(mesh.morphTargetInfluences[0]<.7);assert.equal(mesh.morphTargetInfluences[2],0);assert.equal(mesh.morphTargetInfluences[3],.2);mouth.stop();e.restore();e.update(true);assert.equal(mesh.morphTargetInfluences[0],.9);assert.equal(mesh.morphTargetInfluences[2],.8);
console.log('PASS: raw MMD vowel plus preset vowel never stack; mouth-corner and wide-mouth shapes suspended; eye smile preserved; authored and VMD mouth restored immediately after speech.');

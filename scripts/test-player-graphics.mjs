import assert from 'node:assert/strict';
import {normalizeGraphics,graphicsPlan,shadowMapSize} from '../src/player-graphics.js';
assert.equal(normalizeGraphics().aa,'fxaa');assert.equal(normalizeGraphics({aa:'ssaa16',upscale:'quality',renderScale:50}).upscale,'off');assert.equal(normalizeGraphics({aa:'off',upscale:'balanced'}).aa,'fxaa');
for(const n of [2,4,8,16]){const plan=graphicsPlan({aa:'ssaa'+n},960,540);assert.ok(plan.supported);assert.ok(Math.abs(plan.inputWidth*plan.inputHeight/(960*540)-n)<.03);}
assert.equal(graphicsPlan({aa:'ssaa16'},2560,1440).supported,false);assert.equal(graphicsPlan({aa:'msaa8'},960,540,{maxDimension:8192,maxPixels:16777216,samples:[2,4]}).supported,false);
assert.equal(graphicsPlan({aa:'msaa8'},3840,2160).supported,false);
for(const mode of ['ultra','quality','balanced','performance']){const plan=graphicsPlan({upscale:mode},1920,1080);assert.ok(plan.inputWidth<plan.outputWidth&&plan.inputHeight<plan.outputHeight);assert.equal(plan.fsr,true);}
assert.equal(graphicsPlan({renderScale:50},1280,720).inputWidth,640);assert.equal(shadowMapSize('off'),0);assert.equal(shadowMapSize('low'),512);
console.log('Player graphics: real pixel-area SSAA, supported MSAA, FSR input sizes, conflict handling, safety limits and shadow quality passed.');

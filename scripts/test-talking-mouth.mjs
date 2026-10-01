import assert from 'node:assert/strict';
import { createTalkingMouth } from '../src/talking-mouth.js';
const original = { aa: .13, ih: .08, ou: 0, ee: 0, oh: 0, happy: .4, blink: .2 };
const current = { ...original };
const manager = { expressions: Object.keys(current).map(expressionName => ({ expressionName })),
  getValue: name => current[name], setValue: (name, value) => { current[name] = value; } };
let seed = 12;
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const mouth = createTalkingMouth(manager, random); mouth.start();
const active = new Set(); let previous = [0, 0, 0, 0, 0];
for (let n = 0; n < 240; n++) {
  mouth.restore();
  // Simulate an existing expression animation changing its base mouth value.
  current.aa = n / 240 * .2;
  mouth.update(1/60);
  const { names, values } = mouth.diagnostics();
  assert(values.reduce((a,b) => a+b,0) <= .66 + 1e-8);
  values.forEach((value,i) => { if(value > .1) active.add(names[i]); assert(Math.abs(value-previous[i]) < .23); });
  assert.equal(current.happy,.4); assert.equal(current.blink,.2); previous = values;
}
assert(active.size >= 4, 'mouth never changes vowel'); mouth.stop();
assert.equal(current.aa,239/240*.2); assert.equal(current.ih,.08); assert.equal(current.happy,.4);
const restored = structuredClone(current); mouth.update(1/60); assert.deepEqual(current,restored);
mouth.start(); mouth.letter('。');
for (let n=0;n<10;n++) mouth.update(1/60);
assert(mouth.diagnostics().pause > 0); assert(mouth.diagnostics().values.every(v=>v===0));
for (let n=0;n<60;n++) mouth.update(1/60);
assert(mouth.diagnostics().values.some(v=>v>0)); mouth.stop(); assert.deepEqual(current,restored);
const aliases = { expressions: ['A','I','U','E','O'].map(expressionName => ({ expressionName })), getValue:()=>0, setValue:()=>{} };
assert.equal(createTalkingMouth(aliases).diagnostics().names.length,5);
assert.equal(createTalkingMouth({expressions:[{expressionName:'happy'}]}),null);
assert.equal(createTalkingMouth(null),null);
console.log('PASS: smooth vowel changes, restrained amplitude, punctuation pause, animation baseline restoration, other expressions preserved, stopped state and missing-mouth compatibility');

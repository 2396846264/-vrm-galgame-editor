import assert from 'node:assert/strict';
import {createNextDialogue} from '../src/dialogue-new.js';
const previous={id:'old',text:'上一句台词',characterId:'role',speaker:'显示名字',cast:{left:{characterId:'role',motionId:'walk',offsetZ:1.25,expressionWeights:{happy:.4},props:['gun']}},voiceId:'voice',seId:'sound',choices:[{text:'分支',actId:'next'}],itemGrants:[{itemId:'usd',quantity:5}],render:{preset:'custom',brightness:110}};
const next=createNextDialogue(previous,'new');assert.equal(next.id,'new');assert.equal(next.text,'');
const expected=structuredClone(previous);expected.id='new';expected.text='';assert.deepEqual(next,expected);
next.cast.left.offsetZ=7;next.cast.left.props.push('other');next.choices[0].text='修改分支';assert.equal(previous.cast.left.offsetZ,1.25);assert.deepEqual(previous.cast.left.props,['gun']);assert.equal(previous.choices[0].text,'分支');assert.equal(previous.text,'上一句台词');
const first=createNextDialogue(null,'first');assert.equal(first.characterId,'');assert.equal(first.text,'');assert.deepEqual(first.choices,[]);assert.ok(first.cast.left);
console.log('New dialogue: fresh identity, empty text, complete previous settings and independent nested values passed.');

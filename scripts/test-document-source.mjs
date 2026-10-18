import assert from 'node:assert/strict';
import {readDocumentSource} from '../src/document-source.js';
const document = text => ({id:'source',name:'小说',text});
const boundary = document('测'.repeat(11999)+'🙂结束。');
const first = readDocumentSource(boundary);
assert.equal(first.text.length,11999);
assert.equal(first.nextOffset,11999);
assert.equal(first.complete,false);
assert.equal(first.text+readDocumentSource(boundary,{offset:first.nextOffset}).text,boundary.text);
for(const text of ['', '普通文本', '🙂', '🙂🙂🙂', '甲🙂乙𠮷丙🚀', 'a'.repeat(23999)+'🙂尾']) {
  for(const length of [1,2,3,12000,24000,99999]) {
    const source=document(text);let offset=0,reconstructed='',iterations=0;
    do {
      const chunk=readDocumentSource(source,{offset,length});
      assert.equal(chunk.offset,offset);
      assert(chunk.text.isWellFormed(),'chunk contains an unpaired surrogate');
      assert.equal(chunk.nextOffset,offset+chunk.text.length);
      assert.equal(chunk.complete,chunk.nextOffset===text.length);
      assert.equal(JSON.parse(JSON.stringify(chunk)).text,chunk.text);
      reconstructed+=chunk.text;
      if(chunk.complete)break;
      assert(chunk.nextOffset>offset,'pagination must advance');
      offset=chunk.nextOffset;
      assert(++iterations<=text.length);
    } while(true);
    assert.equal(reconstructed,text,'pagination lost or duplicated text');
  }
}
const middle=readDocumentSource(document('甲🙂乙'),{offset:2,length:1});
assert.equal(middle.offset,1);assert.equal(middle.text,'🙂');assert.equal(middle.nextOffset,3);
const end=readDocumentSource(boundary,{offset:999999});
assert.equal(end.text,'');assert.equal(end.nextOffset,boundary.text.length);assert(end.complete);
console.log('PASS: default/max/one-unit Unicode boundaries, complete reconstruction, explicit mid-pair offset, EOF and empty documents');

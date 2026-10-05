import assert from 'node:assert/strict';
import {canGeneratePortrait} from '../src/portrait-policy.js';
for(const type of ['vrm','fbxCharacter']){
 assert.equal(canGeneratePortrait({portraitSource:''},type,false),true);
 assert.equal(canGeneratePortrait({portraitSource:'auto'},type,true),false);
 assert.equal(canGeneratePortrait({portraitSource:'auto'},type,true,true),true);
 assert.equal(canGeneratePortrait({portraitSource:'manual'},type,true,true),false);
 assert.equal(canGeneratePortrait({portraitSource:'manual'},type,true,true,true),true);
}
assert.equal(canGeneratePortrait({},'sceneModel',false),false);
assert.equal(canGeneratePortrait({},undefined,false,true),false);
console.log('Portrait policy: VRM/FBX generation, manual PNG protection, explicit reshoot and photo-only roles passed');

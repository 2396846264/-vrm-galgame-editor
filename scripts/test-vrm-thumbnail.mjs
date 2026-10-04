import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { embeddedVrmThumbnail, internalPortrait } from '../src/vrm-thumbnail.js';
const image=Uint8Array.from([137,80,78,71,13,10,26,10]);
function glb(extension) {
 const text=JSON.stringify({extensions:extension,images:[{bufferView:0,mimeType:'image/png'}],textures:[{source:0}],bufferViews:[{buffer:0,byteOffset:0,byteLength:image.length}]});
 const json=new TextEncoder().encode(text.padEnd(Math.ceil(text.length/4)*4));
 const b=new ArrayBuffer(28+json.length+image.length),d=new DataView(b);d.setUint32(0,0x46546c67,true);d.setUint32(4,2,true);d.setUint32(8,b.byteLength,true);d.setUint32(12,json.length,true);d.setUint32(16,0x4e4f534a,true);new Uint8Array(b,20,json.length).set(json);d.setUint32(20+json.length,image.length,true);d.setUint32(24+json.length,0x004e4942,true);new Uint8Array(b,28+json.length).set(image);return b;
}
for(const ext of [{VRM:{meta:{texture:0}}},{VRMC_vrm:{meta:{thumbnailImage:0}}}]) {
 const blob=embeddedVrmThumbnail(glb(ext));assert.equal(blob.type,'image/png');assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),image);
}
assert.equal(embeddedVrmThumbnail(glb({})),null);
assert.equal(embeddedVrmThumbnail(new ArrayBuffer(0)),null);
assert.throws(()=>embeddedVrmThumbnail(glb({}).slice(0,22)),/不完整/);
assert(internalPortrait({assetFolders:[]},{generatedPortrait:true}));
assert(internalPortrait({assetFolders:[{id:'h',hidden:true}]},{folderId:'h'}));
assert(!internalPortrait({assetFolders:[]},{type:'image'}));
for(const path of process.argv.slice(2)) {
 const bytes=readFileSync(path);const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const thumbnail=embeddedVrmThumbnail(buffer);assert(thumbnail);assert((await thumbnail.arrayBuffer()).byteLength>100);
}
console.log('VRM 0.x / 1.0 thumbnails, hidden portraits, missing and truncated images passed.');

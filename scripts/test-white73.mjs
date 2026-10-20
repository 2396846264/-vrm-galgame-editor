import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CompatibleFBXLoader} from '../src/fbx-loader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';

globalThis.window=globalThis;
const folder=process.argv[2],results=[];
for(const name of fs.readdirSync(folder).filter(n=>n.endsWith('.mixamo.fbx'))){
 const bytes=fs.readFileSync(path.join(folder,name));
 assert.equal(bytes.readUInt32LE(23),7300,'Wrong binary FBX version');
 // Metadata and footer must agree with the header, not just a patched file tag.
 assert.ok(bytes.includes(Buffer.from('FBXVersion')));
 assert.equal(bytes.readUInt32LE(bytes.length-140),7300,'Wrong footer version');
 const fbx=new CompatibleFBXLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const objText=fs.readFileSync(path.join(folder,name.replace(/\.fbx$/,'.obj')),'utf8');
 const obj=new OBJLoader().parse(objText);
 const fb=new THREE.Box3().setFromObject(fbx,true),ob=new THREE.Box3().setFromObject(obj,true);
 assert.ok(fb.min.distanceTo(ob.min)<.01&&fb.max.distanceTo(ob.max)<.01,'OBJ changed body size or pose');
 assert.ok(!objText.includes('mtllib')&&!objText.includes('usemtl'),'OBJ requires external materials');
 const verts=objText.split('\n').filter(l=>l.startsWith('v ')),faces=objText.split('\n').filter(l=>l.startsWith('f '));
 assert.ok(verts.length>1000&&faces.length>1000);
 for(const line of verts)assert.ok(line.slice(2).split(' ').every(v=>Number.isFinite(Number(v))));
 for(const line of faces)assert.ok(line.slice(2).split(' ').every(v=>Number(v)>=1&&Number(v)<=verts.length));
 let mesh;fbx.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
 assert.ok(mesh?.skeleton.bones.length>=20);
 results.push({name,fbxVersion:7300,bones:mesh.skeleton.bones.length,vertices:verts.length,triangles:faces.length,objMatchesFbx:true});
}
assert.ok(results.length===3,'Expected real MMD, VRM and FBX character exports');
const report={ok:true,websiteUploadVerified:false,results};
console.log(JSON.stringify(report));
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2));

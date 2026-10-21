import assert from 'node:assert/strict';
import * as THREE from 'three';
import {formationSpawns,projectileRange,createProjectile,advanceProjectile,distanceLabel} from '../src/aircombat-rules.js';
import {createProjectileTracers} from '../src/aircombat-tracers.js';
import {normalizeCombat} from '../src/aircombat-schema.js';
import {actMediaAssets} from '../src/act-resources.js';
import {airDialogueList,airDialogueAction,airDialogueEditor} from '../src/aircombat-dialogue-editor.js';
for(let a=0;a<=4;a++)for(let e=1;e<=8;e++){
 const rows=formationSpawns(a,e,600);assert.equal(rows.length,a+e+1);
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const d=new THREE.Vector3(...rows[i].position).distanceTo(new THREE.Vector3(...rows[j].position));assert(d>=2000);if((rows[i].team==='enemy')!==(rows[j].team==='enemy'))assert(d>=20000);}
 assert.equal(rows.find(r=>r.team==='enemy').position[2],-20000);
}
for(const speed of [350,570,900,1100])for(const dt of [1/60,1/30,.1]){
 const b=createProjectile(new THREE.Vector3(0,2000,0),new THREE.Vector3(0,0,-speed));let t=0,expired=false;
 while(!expired&&t<40){expired=advanceProjectile(b,dt);t+=dt;}
 assert(expired);assert.equal(b.travelled,projectileRange);assert(-b.position.z>6900);assert(b.position.y<2000&&b.position.y>1700);assert(b.trail.length<=16);
 const scene=new THREE.Scene(),r=createProjectileTracers(scene);r.update([b]);assert(r.lines.geometry.drawRange.count>0);assert.equal(r.lines.material.color.getHex(),0xffffff);r.dispose();assert.equal(scene.children.length,0);
}
assert.equal(distanceLabel(10000),'10.0 km');assert.equal(distanceLabel(2432),'2.4 km');
const c=normalizeCombat({fireSounds:{mg131:'a',mg151:'b',fuselage:'bad'},dialogues:[{id:'one',text:'一'},{id:'two',text:'二'}]});
assert.deepEqual(c.fireSounds,{mg131:'a',mg151:'b'});assert.deepEqual(normalizeCombat(JSON.parse(JSON.stringify(c))).fireSounds,c.fireSounds);
const node={kind:'event',event:{type:'aircombat',combat:c}},p={characters:[],assets:[{id:'a',type:'audio',audioKind:'effect'},{id:'b',type:'audio',audioKind:'effect'}]},ctx={project:()=>p,escape:String};
assert.deepEqual(actMediaAssets(p,node).map(a=>a.id),['a','b']);
const html=airDialogueList(node,ctx,0);assert(html.indexOf('event-air-settings')>html.lastIndexOf('event-air-dialogue-select'));
assert.equal((airDialogueEditor(node,ctx,1).match(/data-air-dialogue="text"/g)||[]).length,1);
airDialogueAction(c,'event-air-dialogue-duplicate',{dataset:{index:'0'}});assert.equal(c.dialogues.length,3);assert.notEqual(c.dialogues[0].id,c.dialogues[1].id);
airDialogueAction(c,'event-air-dialogue-down',{dataset:{index:'0'}});assert.equal(c.dialogues[1].id,'one');
airDialogueAction(c,'event-air-dialogue-remove',{dataset:{index:'1'}});assert.equal(c.dialogues.length,2);assert.equal(c.fireSounds.mg151,'b');
console.log('PASS: all 40 formations, 20 km teams / 2 km spacing, 12 ballistic time steps to 7 km, slight drop, white batched trails, independent weapon sounds, preload/persistence and dialogue list ordering.');

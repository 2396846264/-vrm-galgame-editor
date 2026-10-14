import assert from 'node:assert/strict';
import * as THREE from 'three';
import {aircraftPreset,normalizeCombat,validateAircraft,partKit} from '../src/aircombat-schema.js';
import {compileAircraft,aircraftModel,aircraftTriangles,disposeAircraft} from '../src/aircombat-models.js';
import {createFlight,steerFlight,stepFlight,damagePart,segmentSphere} from '../src/aircombat-physics.js';
import {cloneEditorObject} from '../src/editor-copy.js';
import {editAgentProject} from '../src/project-agent-operations.js';
import {mergeEditorProject} from '../src/editor-project-merge.js';
const fighter=aircraftPreset(),bomber=aircraftPreset(true),fs=compileAircraft(fighter),bs=compileAircraft(bomber);
assert.deepEqual(validateAircraft(fighter),[]);assert.deepEqual(validateAircraft(bomber),[]);
assert.equal(bs.powerHp,fs.powerHp*2);assert.equal(bs.parts.filter(p=>p.type==='engine').length,2);assert(bs.parts.some(p=>p.type==='turret'));assert(bs.mass>fs.mass);
assert(Math.abs(fs.com.x)<1e-8);assert(Math.abs(bs.com.x)<1e-8);
for(const a of [fighter,bomber]){const s=compileAircraft(a),model=aircraftModel(s);assert(aircraftTriangles(model)<10000);const cockpit=model.userData.models.get(a.parts.find(p=>p.type==='cockpit').id);cockpit.traverse(o=>{if(o.material){assert.equal(o.material.transparent,false);assert.equal(o.material.opacity,1);}});disposeAircraft(model);}
const large=structuredClone(fighter);large.parts.filter(p=>p.type.startsWith('wing')).forEach(p=>p.scale=1.2);const ls=compileAircraft(large);assert(ls.wingArea>fs.wingArea);assert(ls.dragArea>fs.dragArea);assert(ls.mass>fs.mass);
const bad=structuredClone(bomber);bad.parts.find(p=>p.type==='engine').socketId='cockpit';assert(validateAircraft(bad).length);assert.throws(()=>compileAircraft(bad));
const missing=structuredClone(fighter);missing.parts=missing.parts.filter(p=>p.type!=='tail');assert(validateAircraft(missing).some(s=>s.includes('尾翼')));
for(const a of [fighter,bomber]){const f=createFlight(a);for(let i=0;i<3600;i++){steerFlight(f,new THREE.Vector3(0,0,-1));stepFlight(f,1/60);}assert(f.alive);assert(f.position.y>150);assert(f.airSpeed>40&&f.airSpeed<150);assert(f.lift>0&&f.drag>0);assert(Number.isFinite(f.rotation.length()));}
const damaged=createFlight(bomber);const engine=damaged.spec.parts.find(p=>p.type==='engine');damagePart(damaged,engine.id,999);stepFlight(damaged,1/60);assert.equal(damaged.horsepower,850);assert.equal(damaged.alive,true);
const hit=createFlight(fighter);damagePart(hit,hit.spec.parts.find(p=>p.type==='fuselage').id,999);assert.equal(hit.alive,false);
const right=createFlight(fighter);for(let i=0;i<240;i++){steerFlight(right,new THREE.Vector3(.6,0,-1));stepFlight(right,1/60);}assert(right.velocity.x>0,'Mouse aim to right must turn right');
assert(segmentSphere(new THREE.Vector3(-10,0,0),new THREE.Vector3(10,0,0),new THREE.Vector3(),1)!==null,'Fast bullets must not tunnel');assert.equal(segmentSphere(new THREE.Vector3(-10,3,0),new THREE.Vector3(10,3,0),new THREE.Vector3(),1),null);
let n=0;const original={id:'combat',kind:'event',name:'空战',event:{type:'aircombat',combat:normalizeCombat({aircraft:bomber})},steps:[{id:'line'}]},copy=cloneEditorObject('act',original,()=>`copy-${++n}`);assert.notEqual(copy.id,original.id);assert.deepEqual(validateAircraft(copy.event.combat.aircraft),[]);assert.notEqual(copy.event.combat.aircraft.parts[0].id,bomber.parts[0].id);
const project={id:'p',name:'p',assets:[],characters:[],acts:[{id:'story',name:'故事',steps:[]}],ui:{},title:{actors:[]},items:[],knowledgeBooks:[],renderPresets:[],environments:[],assetFolders:[],render:{}};
const created=editAgentProject(project,[{action:'create',kind:'act',data:{kind:'event',name:'空战',event:{type:'aircombat',combat:normalizeCombat({aircraft:bomber,winActId:'story'})}}}],()=>`agent-${++n}`);assert.equal(created.project.acts[1].event.type,'aircombat');assert.equal(created.project.acts[1].event.combat.aircraft.parts.filter(p=>p.type==='engine').length,2);
assert.throws(()=>editAgentProject(project,[{action:'create',kind:'act',data:{kind:'event',event:{type:'aircombat',combat:{enemies:99}}}}],()=>`agent-${++n}`));
const base=structuredClone(created.project),main=structuredClone(base),child=structuredClone(base);main.acts[1].event.combat.duration=240;child.acts[1].event.combat.aircraft.parts.find(p=>p.type==='cockpit').color='#555555';const merged=mergeEditorProject(base,main,child);assert.equal(merged.acts[1].event.combat.duration,240);assert.equal(merged.acts[1].event.combat.aircraft.parts.find(p=>p.type==='cockpit').color,'#555555');main.acts[1].event.combat.aircraft.parts.find(p=>p.type==='cockpit').color='#666666';assert.throws(()=>mergeEditorProject(base,main,child),'Conflicting aircraft edits must preserve both windows');
const reorder=structuredClone(base),replacement=structuredClone(base);reorder.acts[1].event.combat.aircraft.parts=reorder.acts[1].event.combat.aircraft.parts.map(p=>Object.fromEntries(Object.entries(p).reverse()));replacement.acts[1].event.combat.aircraft=aircraftPreset();assert.doesNotThrow(()=>mergeEditorProject(base,reorder,replacement),'Native JSON property order must not create an aircraft replacement conflict');
console.log(JSON.stringify({ok:true,components:Object.keys(partKit).length,fighter:{mass:fs.mass,hp:fs.powerHp,triangles:aircraftTriangles(aircraftModel(fs))},bomber:{mass:bs.mass,hp:bs.powerHp,triangles:aircraftTriangles(aircraftModel(bs))},checks:'physics, damage, opaque cockpit, mounts, low-poly budget, mouse direction, swept collision, copy, MCP validation'}));

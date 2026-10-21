import assert from 'node:assert/strict';
import * as THREE from 'three';
import {normalizeAircraft,validateAircraft,createPart,historicalPreset} from '../src/aircombat-schema.js';
import {setBlock,structureErrors,expandedBlocks} from '../src/vehicle-structure.js';
import {compileAircraft} from '../src/aircombat-models.js';
import {prepareStructure,stepCrash} from '../src/vehicle-damage.js';
import {damagePart} from '../src/aircombat-physics.js';
import {ensureVehicleLibrary,applyVehicle,vehicleFromAircraft,voxelPreset} from '../src/vehicle-documents.js';
import {actMediaAssets} from '../src/act-resources.js';
const blank=()=>({pilotBlockVersion:1,schemaVersion:2,vehicleType:'aircraft',name:'测试',gridSize:.125,blocks:[],parts:[]});
const flight=v=>{const spec=compileAircraft(normalizeAircraft(v),{validate:false});prepareStructure(spec);return {spec,alive:true,position:new THREE.Vector3(0,600,0),velocity:new THREE.Vector3(0,0,-75),rotation:new THREE.Quaternion(),angular:new THREE.Vector3(),throttle:1};};
const line=blank();for(let i=0;i<100;i++)setBlock(line,[0,i,0],i===0?'pilot':'hull');const f=flight(line);assert.equal(f.spec.originalBlockCount,100);
for(let i=99;i>=66;i--)damagePart(f,'cell:0,'+i+',0',1e9);
assert.equal(f.lostBlocks,34);assert(f.alive);damagePart(f,'cell:0,65,0',1e9);assert.equal(f.lostBlocks,35);assert(!f.alive&&f.crashing);const oldY=f.position.y;stepCrash(f,1);assert(f.position.y<oldY);
const pilot=flight(line);damagePart(pilot,'cell:0,0,0',1e9);assert.equal(pilot.lostBlocks,1);assert(!pilot.alive&&pilot.crashing);
const bridge=blank();setBlock(bridge,[0,0,0],'pilot');for(let z=1;z<=10;z++)setBlock(bridge,[0,0,z],'hull');for(let x=1;x<=5;x++)setBlock(bridge,[x,0,0],'wing');const turret=createPart('turret');turret.offset=[.625,0,0];bridge.parts.push(turret);const cut=flight(bridge);damagePart(cut,'cell:2,0,0',1e9);
assert(cut.spec.parts.find(p=>p.id==='cell:3,0,0').detached);assert(cut.spec.parts.find(p=>p.id==='cell:5,0,0').detached);assert(!cut.spec.parts.find(p=>p.id==='cell:-3,0,0').detached);assert(cut.spec.parts.find(p=>p.id===turret.id).detached);assert.equal(cut.lostBlocks,4);assert(cut.alive);
const empty=blank();assert(structureErrors(empty).some(t=>t.includes('建造')));setBlock(empty,[0,0,0],'hull');assert(structureErrors(empty).some(t=>t.includes('驾驶员')));assert.throws(()=>setBlock(empty,[1,0,0],'pilot'),/中线/);setBlock(empty,[0,0,0],'pilot');assert.throws(()=>setBlock(empty,[0,1,0],'pilot'),/最多/);assert.equal(expandedBlocks(empty).filter(b=>b.kind==='pilot').length,1);
for(const gridSize of [.5,.25]){const v=blank();v.gridSize=gridSize;setBlock(v,[0,0,0],'pilot');setBlock(v,[0,0,1],'hull');const upgraded=vehicleFromAircraft(v);assert.equal(upgraded.gridSize,.125);assert.equal(expandedBlocks(upgraded).filter(b=>b.kind==='pilot').length,1);}
for(const kit of ['bf109','b25','shinden']){const v=voxelPreset(kit);assert.equal(v.blocks.filter(b=>b.kind==='pilot').length,1);assert.deepEqual(validateAircraft(v),[]);}
const legacy=historicalPreset('bf109');legacy.fireSounds={mg131:'sound-a'};assert.deepEqual(vehicleFromAircraft(legacy).fireSounds,legacy.fireSounds);
const old=blank();delete old.pilotBlockVersion;setBlock(old,[0,0,0],'cockpit');assert.equal(normalizeAircraft(old).blocks[0].kind,'pilot');
const c={aircraft:historicalPreset('bf109'),enemyAircraft:historicalPreset('bf109'),allyAircraft:historicalPreset('b25'),fireSounds:{mg131:'old'}},project={vehicles:[],acts:[{kind:'event',event:{type:'aircombat',combat:c}}]};ensureVehicleLibrary(project);const a=project.vehicles[0],b=project.vehicles[2];a.blueprint.fireSounds.mg131='new';applyVehicle(project,a);assert.equal(c.aircraft.fireSounds.mg131,'new');assert.equal(c.enemyAircraft.fireSounds.mg131,'old');assert.equal(b.blueprint.fireSounds.mg131,'old');
project.assets=[{id:'new',type:'audio',audioKind:'effect'},{id:'old',type:'audio',audioKind:'effect'}];assert.deepEqual(actMediaAssets(project,project.acts[0]).map(a=>a.id),['new','old']);
console.log('PASS: 34/35 percent boundary, pilot fatal at 1 percent, independent mirrored wing disconnection and attached turret, falling wreck, pilot uniqueness/required/migration, all presets, per-aircraft sound migration/isolation/preload.');

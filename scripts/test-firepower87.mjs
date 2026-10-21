import assert from 'node:assert/strict';
import * as T from 'three';
import {normalizeFirepower,firepowerPreset,firepowerErrors,firepowerMount,weaponPartDefinition,refreshMountedFirepower} from '../src/firepower-schema.js';
import {firepowerModel} from '../src/firepower-model.js';
import {normalizeWarship,warshipPreset} from '../src/warship-schema.js';
import {normalizeAircraft} from '../src/aircombat-schema.js';
import {compileAircraft,aircraftModel,disposeAircraft} from '../src/aircombat-models.js';
import {voxelPreset,applyVehicle} from '../src/vehicle-documents.js';
import {aimTurret} from '../src/vehicle-combat.js';
import {tickWeaponCycle,weaponReady,consumeWeaponRound} from '../src/weapon-balance.js';
import {navalShellProfile} from '../src/naval-shell-rules.js';
const document={id:'gun87',blueprint:normalizeFirepower({...firepowerPreset(),caliber:127,calibers:50,minYaw:-60,maxYaw:60,minPitch:-5,maxPitch:60})};
assert.deepEqual(firepowerErrors(document.blueprint),[]);assert.equal(firepowerErrors({...document.blueprint,barrels:[]}).length,1);assert(firepowerErrors({...document.blueprint,blocks:[{cell:[20,0,0]}]}).length);
const w=normalizeFirepower({blocks:[{cell:[0,0,0],color:'#ffffff'},{cell:[0,0,0]}],caliber:Infinity,barrels:Array(100).fill({offset:[1000,NaN,0]})});assert.equal(w.blocks.length,1);assert.equal(w.blocks[0].color,'#d65858');assert.equal(w.barrels.length,8);assert.deepEqual(w.barrels[0].offset,[32,0,0]);
for(const naval of [false,true]){
 const mount=firepowerMount(document,naval),blueprint=naval?warshipPreset('destroyer'):voxelPreset('bf109');blueprint.parts.push(mount);const normalized=(naval?normalizeWarship:normalizeAircraft)(JSON.parse(JSON.stringify(blueprint))),part=compileAircraft(normalized,{validate:false}).parts.find(p=>p.id===mount.id);assert.equal(part.def.barrelLength,6.35);assert.equal(part.def.caliber,127);assert.equal(part.def.minYaw,-60);assert.equal(part.firepowerId,'gun87');assert.equal(Boolean(navalShellProfile(part.def)),naval);const root=aircraftModel(compileAircraft(normalized,{validate:false}));assert.equal(root.userData.models.get(part.id).userData.muzzles.length,1);disposeAircraft(root);
}
const model=firepowerModel(document.blueprint),zero=model.userData.muzzleForAim(0,0)[0],up=model.userData.muzzleForAim(0,Math.PI/2)[0],pivot=new T.Vector3(...document.blueprint.pivot);assert(Math.abs(zero.distanceTo(pivot)-6.35)<1e-9);assert(Math.abs(up.distanceTo(pivot)-6.35)<1e-9);assert(up.y>6);assert(Math.abs(model.userData.muzzleForAim(Math.PI/2,0)[0].z)<.01);
let aim={yaw:0,pitch:0};const behind=new T.Vector3(1,.1,1).normalize();for(let i=0;i<600;i++)aim=aimTurret(aim,behind,1/60,document.blueprint);assert(aim.yaw>=-Math.PI/3-.00001&&aim.yaw<=Math.PI/3+.00001);assert(!aim.canFire);let inside={yaw:0,pitch:0};for(let i=0;i<600;i++)inside=aimTurret(inside,new T.Vector3(.2,.2,-1).normalize(),1/60,document.blueprint);assert(inside.canFire);
const bp=normalizeFirepower({...firepowerPreset('machine'),capacity:4,reload:2,rpm:600}),p={def:weaponPartDefinition({type:'custom_turret',firepower:bp},{}),ammo:100},target={flight:{ship:false}};let shots=0;for(let i=0;i<60;i++){tickWeaponCycle(p,.01,target);if(weaponReady(p))for(let j=0;j<2;j++)if(consumeWeaponRound(p,true))shots++;}assert.equal(shots,4);assert(p.weaponCycle.reloading);assert(p.weaponCycle.remaining>1);for(let i=0;i<200;i++)tickWeaponCycle(p,.01,target);assert(weaponReady(p));assert.equal(p.weaponCycle.loaded,4);
const cannon={def:weaponPartDefinition({type:'ship_custom_turret',firepower:firepowerPreset('triple')},{}),ammo:100};tickWeaponCycle(cannon,.01,target);assert(weaponReady(cannon));for(let i=0;i<3;i++)assert(consumeWeaponRound(cannon,true));assert.equal(cannon.weaponCycle.loaded,0);
const mounted=firepowerMount(document,true);document.blueprint.caliber=203;assert.equal(mounted.firepower.caliber,127);refreshMountedFirepower(mounted,document);assert.equal(mounted.firepower.caliber,203);
console.log('PASS firepower87: connected core, bounded input, saved mount snapshots, both vehicle paths, calibre length, pivot-correct muzzles, yaw/pitch fire limits, shared magazine and reload, multi-barrel salvo, explicit library updates.');

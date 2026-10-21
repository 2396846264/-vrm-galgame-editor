import assert from 'node:assert/strict';
import * as T from 'three';
import {caliberDamage,caliberGravity,loadingProfile,ammunitionFor,tickWeaponCycle,weaponReady,consumeWeaponRound,turretRateLimits} from '../src/weapon-balance.js';
import {navalParts,navalBlocks,aircraftOrdnance} from '../src/naval-kit.js';
import {blockKit} from '../src/vehicle-structure.js';
import {warshipPreset,shipClasses} from '../src/warship-schema.js';
import {createShip,remainingCores,damageShipPart,blastShip,bombBurstPoint,shipHealthRatio} from '../src/warship-runtime.js';
import {cellWorld} from '../src/vehicle-cell-damage.js';
import {partWorld,intersectVehicle} from '../src/vehicle-hit.js';
import {createFlight,damagePart,stepFlight} from '../src/aircombat-physics.js';
import {voxelPreset} from '../src/vehicle-documents.js';
import {aimTurret} from '../src/vehicle-combat.js';
import {normalizeWeaponSettings} from '../src/vehicle-weapon-settings.js';
import {mouseAxis,racingFlight} from '../src/aircombat-controls.js';
import {createProjectile,advanceProjectile} from '../src/aircombat-rules.js';
import {createAirburstEffects} from '../src/naval-ordnance.js';
const air={flight:{ship:false}},surface={flight:{ship:true}};
assert.equal(caliberDamage(7.7),5);
let previousDamage=0,previousDrop=0;for(const c of [7.7,7.92,12.7,13,20,25,30,37,40,75,76,127,203,356,460]){assert(caliberDamage(c)>=previousDamage);assert(caliberGravity(c)>=previousDrop);previousDamage=caliberDamage(c);previousDrop=caliberGravity(c);}
const gun={def:navalParts.ship_aa20,ammo:1000},shots=[];let t=0;
while(t<70){tickWeaponCycle(gun,1/120,air);if(weaponReady(gun)){shots.push(t);gun.ammo--;consumeWeaponRound(gun);}t+=1/120;}
assert.equal(loadingProfile(gun.def).capacity,40);assert.equal(gun.def.rate*60,150);
assert(shots.length>=80);for(let i=1;i<40;i++)assert(Math.abs((shots[i]-shots[i-1])-(i%4? .4:1.2))<.02);
assert(shots[40]-shots[39]>=20&&shots[40]-shots[39]<20.04,'full 20-second reload');
assert(shots[80]===undefined||shots[80]-shots[79]>=20);
for(const type of ['ship_main203','ship_main356','ship_main460']){
 const p={def:navalParts[type],ammo:100,surfaceAmmo:'ap'};tickWeaponCycle(p,0,air);assert.equal(p.weaponCycle.round.ammoType,'type3');assert.equal(p.weaponCycle.round.fuze,'proximity');
 tickWeaponCycle(p,loadingProfile(p.def).reload/2,surface);assert.equal(p.weaponCycle.round.ammoType,'type3');tickWeaponCycle(p,100,surface);assert(weaponReady(p));assert.equal(p.weaponCycle.round.ammoType,'type3');consumeWeaponRound(p);p.ammo--;
 tickWeaponCycle(p,0,surface);assert.equal(p.weaponCycle.round.ammoType,'ap');tickWeaponCycle(p,100,air);assert.equal(p.weaponCycle.round.ammoType,'ap');consumeWeaponRound(p);p.surfaceAmmo='he';tickWeaponCycle(p,0,surface);assert.equal(p.weaponCycle.round.ammoType,'he');
 const cfg=normalizeWeaponSettings({yawRate:1000,pitchRate:1000},p.def);assert(cfg.yawRate<=45&&cfg.pitchRate<=45);let a={yaw:0,pitch:0,yawVelocity:900,pitchVelocity:900};const next=aimTurret(a,new T.Vector3(1,.3,0).normalize(),1/60,{...p.def,...cfg});assert(Math.abs(next.yaw-a.yaw)<=cfg.yawRate*Math.PI/180/60+1e-8);
}
assert(turretRateLimits(navalParts.ship_main203).yaw>turretRateLimits(navalParts.ship_main356).yaw);assert(turretRateLimits(navalParts.ship_main356).yaw>turretRateLimits(navalParts.ship_main460).yaw);
assert.equal(normalizeWeaponSettings({yawRate:1000,pitchRate:1000},{}).yawRate,60);assert.equal(normalizeWeaponSettings({yawRate:1000,pitchRate:1000},{}).pitchRate,60);
for(const [kind,d]of Object.entries(blockKit))assert(d.hp>=(kind.startsWith('ship_')?500:10)&&d.hp<=(kind.startsWith('ship_')?5000:100));
const ship=createShip(warshipPreset('destroyer')),row=ship.spec.structuralRows.find(p=>p.blockCells.length>20),cell=row.blockCells[Math.floor(row.blockCells.length/2)],at=cellWorld(ship,row,cell),count=row.blockCells.length;
damageShipPart(ship,row.id,5,{penetration:1000,point:at});assert.equal(row.maxHealth-row.health,5);assert.equal(ship.spec.collisionCells.get(cell.join(',')),row);
damageShipPart(ship,row.id,row.cellHP,{penetration:1000,point:at});assert(!ship.spec.collisionCells.has(cell.join(',')));assert(ship.spec.parts.some(p=>p.health>0&&p.blockCells?.some(c=>c.join(',')===row.blockCells[0].join(','))));assert(ship.spec.originalBlockCount-ship.spec.structuralRows.reduce((n,p)=>n+p.blockCells.length,0)===1,'one impact must not delete a merged row');

const threshold=createShip(warshipPreset('destroyer')),total=threshold.totalMaxHealth,coreHP=threshold.cores.reduce((n,p)=>n+p.health,0),other=threshold.spec.parts.filter(p=>p.blockKind!=='ship_core'),factor=(total*.3001-coreHP)/other.reduce((n,p)=>n+p.health,0);for(const p of other)p.health*=factor;
assert(Math.abs(shipHealthRatio(threshold)-.3001)<1e-8);const component=other.find(p=>!p.blockCells&&p.health>total*.0001);assert(component);damageShipPart(threshold,component.id,0,{penetration:1e9});assert(threshold.alive&&remainingCores(threshold)===5,'above 30 percent must remain afloat');
damageShipPart(threshold,component.id,total*.0001+.00001,{penetration:1e9});assert(threshold.sinking&&!threshold.alive&&remainingCores(threshold)===5,'30 percent hull must sink with intact cores');assert.equal(threshold.totalMaxHealth,total);

const sinking=[];
for(const kind of Object.keys(shipClasses)){
 const f=createShip(warshipPreset(kind));let torpedoes=0;
 while(f.alive&&torpedoes<12){const core=f.cores.find(p=>p.health>0),target=partWorld(f,core),a=target.clone().add(new T.Vector3(80,0,0)),b=target.clone().add(new T.Vector3(-80,0,0)),hit=intersectVehicle({flight:f},a,b);assert(hit,kind+' reachable hit');const point=a.clone().lerp(b,hit.t),o=aircraftOrdnance.aerial_torpedo;blastShip(f,point,o.damage,o.blastRadius,o.penetration);torpedoes++;}
 assert(!f.alive&&remainingCores(f)===0,kind+' must be sinkable by targeted torpedoes');sinking.push({kind,torpedoes});
}
for(const type of ['bomb_he250','bomb_ap500']){const f=createShip(warshipPreset('destroyer')),a=new T.Vector3(0,50,0),b=new T.Vector3(0,-10,0),hit=intersectVehicle({flight:f},a,b),o=aircraftOrdnance[type],point=a.clone().lerp(b,hit.t),center=bombBurstPoint(f,hit,point,new T.Vector3(0,-1,0),o.penetration);blastShip(f,center,o.damage,o.blastRadius,o.penetration);assert(remainingCores(f)<5,type+' must reach protected cores');}
const scene=new T.Scene(),effects=createAirburstEffects(scene);effects.emit(new T.Vector3(),new T.Vector3(0,0,-1),'type3',356);effects.update(.5);assert.equal(effects.cones.length,1);assert(effects.cones[0].mesh.scale.y>50);const apex=new T.Vector3(0,0,0).applyMatrix4(effects.cones[0].mesh.matrixWorld);assert.equal(apex.length(),0);effects.update(3);assert.equal(effects.cones.length,0);effects.dispose();assert.equal(scene.children.length,0);
assert.equal(mouseAxis(0),0);for(const n of [.0001,.001,.005,.01,.02,.039])assert(mouseAxis(n)>0&&mouseAxis(-n)<0);
const f=createFlight(voxelPreset('bf109')),neutral=createFlight(voxelPreset('bf109'));for(let i=0;i<120;i++){racingFlight(f,new T.Vector2(.005,0),new Set(),1/60);racingFlight(neutral,new T.Vector2(),new Set(),1/60);stepFlight(f,1/60);stepFlight(neutral,1/60);}assert(f.position.x>neutral.position.x+.01,'tiny input must turn the plane');racingFlight(f,new T.Vector2(),new Set(),1/60);assert(Math.abs(f.control.yaw)<.01,'returning to center stops yaw command');
const drops=[];for(const c of [7.7,20,203,460]){const b={...createProjectile(new T.Vector3(0,1000,0),new T.Vector3(0,0,-600)),gravity:caliberGravity(c)};for(let i=0;i<120;i++)advanceProjectile(b,1/60);drops.push(1000-b.position.y);}assert(drops.every((n,i)=>i===0||n>drops[i-1]));
console.log(JSON.stringify({ok:true,magazine40:true,burst4x10:true,reload20:true,retainedChamber:true,calibreDamage:true,perCellHealth:true,remaining30PercentSinks:true,localizedDamage:true,threeType3Batteries:true,coneVisible:true,turretCaps:true,noMouseDeadzone:true,sinking}));


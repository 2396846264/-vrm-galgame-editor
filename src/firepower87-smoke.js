import * as T from 'three';
import {firepowerPreset,firepowerMount} from './firepower-schema.js';
import {warshipPreset} from './warship-schema.js';
import {normalizeCombat} from './aircombat-schema.js';
import {createAirCombat} from './aircombat-runtime.js';
import {navalBallisticAim,navalShellProfile} from './naval-shell-rules.js';
import {partWorld} from './vehicle-hit.js';
import {targetPoint} from './turret-targeting.js';
import {voxelPreset} from './vehicle-documents.js';
const frame=()=>new Promise(r=>requestAnimationFrame(r));
export async function firepower87Smoke(review,c,assert){
 const original=review.node;review.air?.cancel();const ship=warshipPreset('destroyer');ship.cruiseSpeed=0;ship.parts=ship.parts.filter(p=>!p.type.includes('main')&&!p.type.includes('aa')&&!p.type.includes('dp'));const document={id:'runtime-custom87',blueprint:firepowerPreset('triple')};document.blueprint.ammoType='ap';const mount=firepowerMount(document,true);mount.offset=[0,6,20];ship.parts.push(mount);
 const node={id:'custom87',name:'自制火力实战检查',kind:'event',steps:[],event:{type:'aircombat',bgmId:'test-bgm',combat:normalizeCombat({enemies:0,allies:0,duration:900,mission:'survive',ships:[{team:'ally',count:1,blueprint:ship},{team:'enemy',count:1,blueprint:ship}],fleets:{ally:{x:-1200,z:-2000,speed:0,heading:90},enemy:{x:1200,z:-2000,speed:0,heading:-90}}})}};
 c.node(node);let air=createAirCombat(review.context),s=air.show(node,false,true);s.paused=true;
 for(const u of s.units.filter(u=>u.flight.ship)){const target=s.units.find(t=>t.flight.ship&&t.team!==u.team),p=u.flight.spec.parts.find(p=>p.def.customWeapon),origin=partWorld(u.flight,p),profile=navalShellProfile(p.def),sol=navalBallisticAim(origin,targetPoint(target,origin),new T.Vector3(),profile.speed,profile.gravity),q=u.flight.rotation.clone().multiply(p.rotation),dir=sol.direction.clone().applyQuaternion(q.invert());p.turretAim={yaw:Math.atan2(-dir.x,-dir.z),pitch:Math.asin(dir.y),yawVelocity:0,pitchVelocity:0};}
 s.paused=false;for(let i=0;i<600;i++){s.step(1/60);if(i%60===0)await frame();}s.paused=true;const ships=s.units.filter(u=>u.flight.ship),salvos=ships.map(u=>u.flight.spec.parts.find(p=>p.def.customWeapon).shots||0);assert(salvos.every(n=>n>=3),'Custom triple mount did not fire: '+salvos);assert(s.bullets.every(b=>Number.isFinite(b.position.x)&&Number.isFinite(b.position.y)),'Custom projectile invalid');const shipShots=s.shots;air.cancel();
 const plane=voxelPreset('bf109');plane.parts=plane.parts.filter(p=>!['mg131','mg151','gun','browning'].includes(p.type));const mg=firepowerPreset('machine');mg.capacity=4;mg.reload=2;const p=firepowerMount({id:'runtime-mg87',blueprint:mg});p.offset=[0,.5,0];plane.parts.push(p);
 node.event.combat=normalizeCombat({aircraft:plane,enemies:1,allies:0,duration:900,mission:'survive'});air=createAirCombat(review.context);s=air.show(node,false,true);s.paused=true;s.units[1].flight.position.copy(s.units[0].flight.position).add(new T.Vector3(0,0,-600));s.units[1].flight.rotation.copy(s.units[0].flight.rotation);
 s.paused=false;for(let i=0;i<180;i++){s.step(1/60);if(i%30===0)await frame();}s.paused=true;const gun=s.units[0].flight.spec.parts.find(p=>p.def.customWeapon);assert(gun.shots>=4,'Aircraft custom gun did not fire');assert(gun.weaponCycle?.reloads>=1,'Aircraft custom magazine never reloaded');assert(!s.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'Custom shader failed');review.air=air;review.s=s;review.node=original;c.node(original);return{ok:true,customShipShots:shipShots,barrels:3,aircraftShots:gun.shots,reloads:gun.weaponCycle.reloads,finiteProjectiles:true};
}

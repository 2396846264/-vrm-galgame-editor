import * as T from 'three';
import {partWorld} from './vehicle-hit.js';
export function carrierSurface(unit,units){
 const f=unit.flight;for(const ship of units){const s=ship.flight;if(!s.ship||!s.alive||s.sinking||((ship.team==='enemy')!==(unit.team==='enemy')))continue;
  const deck=s.spec.parts.find(p=>p.type==='ship_flight_deck'&&p.health>0&&!p.fragment);if(!deck)continue;
  const local=f.position.clone().sub(s.position).applyQuaternion(s.rotation.clone().invert()).add(s.spec.com).sub(deck.position),center=partWorld(s,deck),normal=new T.Vector3(0,1,0).applyQuaternion(s.rotation),top=center.y+(1-normal.x*(f.position.x-center.x)-normal.z*(f.position.z-center.z))/Math.max(.1,normal.y);
  if(Math.abs(local.x)<deck.def.size[0]/2-1&&Math.abs(local.z)<deck.def.size[2]/2-2&&f.position.y>=top+f.spec.contactHeight-2)return{ship,deck,top,full:units.filter(u=>u!==unit&&!u.flight.ship&&u.flight.alive&&u.flight.grounded&&(u.flight.carrierSupport===s||u.flight.carrierLaunch?.carrier===ship)).length>=6};
 }return null;
}
export function serviceOnCarrier(f,support,dt){
 if(!support||!f.alive||!f.grounded){f.carrierService=0;f.carrierSupport=null;f.carrierResupplied=false;return false;}
 const s=support.ship.flight;f.carrierSupport=s;f.carrierLocalPosition=f.position.clone().sub(s.position).applyQuaternion(s.rotation.clone().invert()).add(s.spec.com);f.carrierShipRotation=s.rotation.clone();
 const relative=f.velocity.clone().sub(s.velocity);
 if(f.throttle<.55){relative.multiplyScalar(Math.exp(-dt*2));f.velocity.copy(s.velocity).add(relative);}
 if(f.throttle>.3||relative.length()>3){f.carrierService=0;return false;}
 f.carrierService=(f.carrierService||0)+dt;if(f.carrierService<5||f.carrierResupplied)return false;
 for(const p of f.spec.parts){if(p.health<=0||p.detached||p.fragment)continue;p.health=p.maxHealth;if(p.cellHealth)p.cellHealth=new Map(p.blockCells.map(c=>[c.join(','),p.cellHP]));if(['gun','turret'].includes(p.def.family)||p.def.caliber)p.ammo=p.def.ammo||600;p.weaponCycle=null;if(p.def.family==='bomb'||p.type==='bomb'||p.def.torpedo)p.released=false;}
 f.ammo=f.spec.parts.reduce((n,p)=>n+(p.ammo||0),0);f.bombs=f.spec.parts.filter(p=>(p.def.family==='bomb'||p.type==='bomb'||p.def.torpedo)&&p.health>0&&!p.released).length;f.carrierResupplied=true;return true;
}

export function carrierWaveOff(unit,support){const f=unit.flight,s=support.ship.flight;if(!support.full||f.grounded||f.position.y>support.top+f.spec.contactHeight+18)return false;f.position.y=Math.max(f.position.y,support.top+f.spec.contactHeight+12);f.rotation.copy(s.rotation).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.12));f.velocity.set(0,0,-Math.max(75,f.spec.stallSpeed*1.35)).applyQuaternion(s.rotation).add(s.velocity);f.velocity.y=Math.max(8,f.velocity.y);f.throttle=1;f.grounded=false;f.carrierSupport=null;f.carrierService=0;f.carrierGoAround=3;return true;}

// Keep settled, idle aircraft on the moving deck plane instead of integrating wave heave twice.
export function stabilizeCarrierContact(f,support){
 if(!support||f.carrierSupport!==support.ship.flight||!f.alive||f.throttle>.3)return false;
 const ship=support.ship.flight,relative=f.velocity.clone().sub(ship.velocity);
 if(relative.length()>3||!f.spec.parts.some(p=>p.health>0&&p.def.family==='gear'&&p.gearDeployment>.9))return false;
 const center=partWorld(ship,support.deck),normal=new T.Vector3(0,1,0).applyQuaternion(ship.rotation);
 f.position.y=center.y+(1-normal.x*(f.position.x-center.x)-normal.z*(f.position.z-center.z))/Math.max(.1,normal.y)+f.spec.contactHeight;
 f.velocity.y=ship.velocity.y;f.grounded=true;return true;
}

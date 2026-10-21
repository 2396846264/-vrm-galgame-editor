import * as T from 'three';
const up=new T.Vector3(0,1,0);
function dimensions(f){const box=new T.Box3();for(const p of f.spec.parts){const half=new T.Vector3(...p.def.size).multiplyScalar(p.scale*.5);box.expandByPoint(p.position.clone().sub(half));box.expandByPoint(p.position.clone().add(half));}return box.getSize(new T.Vector3());}
const usable=d=>d&&d.health>0&&!d.fragment;
export function initializeCarrierLaunch(s){
 s.launchTickets=[];s.launchEvents=[];s.activeLaunch=null;if(!s.config.startOnGround)return;
 const player=s.units.find(u=>u.team==='player'),friends=s.units.filter(u=>u.team==='ally'&&!u.flight.ship),aircraft=[player,...friends].filter(Boolean),sizes=new Map(aircraft.map(u=>[u,dimensions(u.flight)]));
 const carriers=s.units.filter(u=>u.team==='ally'&&u.flight.ship&&u.flight.alive).map(u=>({unit:u,deck:u.flight.spec.parts.find(p=>p.type==='ship_flight_deck'&&usable(p))})).filter(c=>c.deck);
 const maxLength=Math.max(8,...[...sizes.values()].map(d=>d.z)),spacing=maxLength+4;
 const groups=carriers.map(c=>({...c,members:[],capacity:Math.max(0,Math.min(6,Math.floor((c.deck.def.size[2]-12)/spacing)))}));
 // Reserve one place for the player so an excess AI cannot displace the last launch.
 for(const u of aircraft){const group=groups.find(g=>g.members.length<g.capacity&&sizes.get(u).x+2<=g.deck.def.size[0]);if(group)group.members.push(u);}
 if(!carriers.length)groups.push({unit:null,deck:null,members:aircraft,capacity:aircraft.length});
 for(const group of groups){const members=[...group.members.filter(u=>u!==player),...group.members.filter(u=>u===player)],length=group.deck?.def.size[2]||3200,aft=group.deck?length/2-maxLength/2-6:100,front=aft-(members.length-1)*spacing;
  for(let i=0;i<members.length;i++){const u=members[i],ticket={unit:u,carrier:group.unit,deck:group.deck,z:front+i*spacing,endZ:group.deck?-length/2-8:-3000,speed:0,status:'queued',releaseTime:0};u.flight.carrierLaunch=ticket;s.launchTickets.push(ticket);hold(ticket);}
 }
 s.launchTickets.sort((a,b)=>(a.unit===player)-(b.unit===player)||s.units.indexOf(a.unit)-s.units.indexOf(b.unit));
 s.launchAirborneFallback=aircraft.filter(u=>!u.flight.carrierLaunch).map(u=>u.team);
}
function hold(t){const f=t.unit.flight,ship=t.carrier?.flight,offset=t.deck?.position.clone()||new T.Vector3(0,4,0);offset.y+=(t.deck?1:0)+f.spec.contactHeight;offset.z+=t.z;
 if(ship){f.position.copy(offset.sub(ship.spec.com).applyQuaternion(ship.rotation).add(ship.position));f.rotation.copy(ship.rotation);f.velocity.copy(ship.velocity);}else{f.position.copy(offset);f.rotation.identity();f.velocity.set(0,0,0);}
 f.groundLevel=f.position.y-f.spec.contactHeight;f.surface='land';f.grounded=true;f.airSpeed=0;f.throttle=t.status==='rolling'?1:0;f.angular.set(0,0,0);f.gearCommand='auto';for(const p of f.spec.parts)if(p.def.family==='gear'||p.type==='gear')p.gearDeployment=1;
}
export function stepCarrierLaunch(s,dt){
 for(const t of s.launchTickets||[]){if(['queued','ready'].includes(t.status))hold(t);}
 let t=s.activeLaunch;
 if(t?.status==='airborne'){t.releaseTime+=dt;if(t.releaseTime<2)return;t.status='departed';s.activeLaunch=null;t=null;}
 if(!t){t=(s.launchTickets||[]).find(t=>['queued','ready'].includes(t.status));if(!t)return;s.activeLaunch=t;}
 const f=t.unit.flight,ship=t.carrier?.flight;
 if(!f.alive||(ship&&(!ship.alive||!usable(t.deck)))){
  if(f.alive){f.position.y=Math.max(f.position.y+300,s.config.altitude);f.velocity.set(0,0,-75).applyQuaternion(f.rotation);f.grounded=false;}
  f.carrierLaunch=null;t.status='departed';s.activeLaunch=null;s.launchEvents.push({team:t.unit.team,kind:'unavailable'});return;
 }
 if(t.status==='queued')t.status='ready';
 if(t.status==='ready'){if(t.unit.team==='player'&&!s.keys.has('KeyW'))return;t.status='rolling';}
 const remaining=Math.max(1,t.z-t.endZ),targetSpeed=Math.max(45,f.spec.stallSpeed*1.35),acceleration=Math.max(12,targetSpeed**2/(2*remaining));
 t.speed=Math.min(targetSpeed,t.speed+acceleration*dt);t.z-=t.speed*dt;hold(t);const forward=new T.Vector3(0,0,-1).applyQuaternion(f.rotation);f.velocity.addScaledVector(forward,t.speed);f.airSpeed=t.speed;
 if(t.z<=t.endZ||t.speed>=targetSpeed-.01){t.status='airborne';f.carrierLaunch=null;f.grounded=false;f.throttle=1;f.position.y+=1.5;f.velocity.addScaledVector(up,5);f.rotation.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.08));s.launchEvents.push({team:t.unit.team,carrier:s.units.indexOf(t.carrier),kind:'takeoff',speed:t.speed});}
}

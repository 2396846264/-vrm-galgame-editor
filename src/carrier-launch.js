import * as T from 'three';
const up=new T.Vector3(0,1,0),usable=d=>d&&d.health>0&&!d.fragment;
export const carrierCapacity=6;
export function aircraftDeckSize(f){const box=new T.Box3();for(const p of f.spec.parts){if(p.health<=0||p.detached||p.fragment)continue;const local=new T.Box3().setFromCenterAndSize(new T.Vector3(),new T.Vector3(...p.def.size).multiplyScalar(p.scale));local.applyMatrix4(new T.Matrix4().compose(p.position,p.rotation,new T.Vector3(1,1,1)));box.union(local);}return box.getSize(new T.Vector3());}
const fits=(u,g)=>{const size=aircraftDeckSize(u.flight);if(size.x+2>g.deck.def.size[0])return false;const length=Math.max(8,size.z,...g.members.map(m=>aircraftDeckSize(m.flight).z));return(g.members.length+1)*(length+4)<=g.deck.def.size[2]-12&&g.members.length<carrierCapacity;};
function ticketFor(unit,carrier,deck,z){const size=aircraftDeckSize(unit.flight),length=deck?.def.size[2]||3200;return{unit,carrier,deck,z,x:0,endZ:deck?-length/2+size.z/2+4:-3000,speed:0,status:'queued',releaseTime:0,kind:'initial'};}
export function initializeCarrierLaunch(s){
 s.launchTickets=[];s.launchEvents=[];s.activeLaunch=null;
 const player=s.units.find(u=>u.team==='player'),friends=s.units.filter(u=>u.team==='ally'&&!u.flight.ship),aircraft=[player,...friends].filter(u=>u&&(u.spawnOnCarrier===true||(u.spawnOnCarrier===undefined&&s.config.startOnGround)));
 const groups=s.units.filter(u=>u.team==='ally'&&u.flight.ship&&u.flight.alive).map(unit=>({unit,deck:unit.flight.spec.parts.find(p=>p.type==='ship_flight_deck'&&usable(p)),members:[]})).filter(g=>g.deck);
 if(groups.length){const cohorts=new Map();for(const u of aircraft){const key=u.wingId||'legacy';if(!cohorts.has(key))cohorts.set(key,[]);cohorts.get(key).push(u);}for(const members of cohorts.values()){const eligible=groups.filter(g=>!members[0].carrierId||(g.unit.deploymentId===members[0].carrierId&&g.unit.deploymentIndex===(members[0].carrierIndex||0)));const whole=members[0].wingId&&eligible.find(g=>{const copy={...g,members:[...g.members]};return members.every(u=>{if(!fits(u,copy))return false;copy.members.push(u);return true;});});if(whole)whole.members.push(...members);else for(const u of members){const g=eligible.find(g=>fits(u,g));if(g)g.members.push(u);}}}else groups.push({unit:null,deck:null,members:aircraft.filter(u=>u.spawnOnCarrier===undefined)});
 for(const group of groups){const members=[...group.members.filter(u=>u!==player),...group.members.filter(u=>u===player)],maxLength=Math.max(8,...members.map(u=>aircraftDeckSize(u.flight).z)),spacing=maxLength+4,length=group.deck?.def.size[2]||3200,aft=group.deck?length/2-maxLength/2-6:100,front=aft-(members.length-1)*spacing;for(let i=0;i<members.length;i++){const t=ticketFor(members[i],group.unit,group.deck,front+i*spacing);t.unit.flight.carrierLaunch=t;s.launchTickets.push(t);hold(t);}}
 s.launchTickets.sort((a,b)=>(a.unit===player)-(b.unit===player)||s.units.indexOf(a.unit)-s.units.indexOf(b.unit));s.launchAirborneFallback=aircraft.filter(u=>!u.flight.carrierLaunch).map(u=>u.team);
}
function hold(t){const f=t.unit.flight,ship=t.carrier?.flight,offset=t.deck?.position.clone()||new T.Vector3(0,4,0);offset.y+=(t.deck?1:0)+f.spec.contactHeight;offset.x+=t.x||0;offset.z+=t.z;
 if(ship){f.position.copy(offset.sub(ship.spec.com).applyQuaternion(ship.rotation).add(ship.position));f.rotation.copy(ship.rotation);if(t.localRotation)f.rotation.multiply(t.localRotation);f.velocity.copy(ship.velocity);}else{f.position.copy(offset);f.rotation.identity();f.velocity.set(0,0,0);}
 f.groundLevel=f.position.y-f.spec.contactHeight;f.surface='land';f.grounded=true;f.airSpeed=0;f.throttle=t.status==='rolling'?1:0;f.angular.set(0,0,0);f.control={pitch:0,yaw:0,roll:0};f.brake=0;f.gearCommand='auto';for(const p of f.spec.parts)if(p.def.family==='gear'||p.type==='gear')p.gearDeployment=1;
 f.carrierSupport=ship||null;if(ship){f.carrierLocalPosition=f.position.clone().sub(ship.position).applyQuaternion(ship.rotation.clone().invert()).add(ship.spec.com);f.carrierShipRotation=ship.rotation.clone();}
}
export function queueCarrierDeparture(s,unit,support){
 const f=unit.flight;if(!support||!f.alive||!f.grounded||f.carrierLaunch)return false;
 const size=aircraftDeckSize(f),deck=support.deck;if(size.x+2>deck.def.size[0]||size.z+16>deck.def.size[2]){f.carrierDepartureError='飞机尺寸超出甲板安全起飞范围';return false;}
 if(!f.spec.parts.some(p=>p.def.family==='engine'&&usable(p))){f.carrierDepartureError='动力损毁，无法再次起飞';return false;}
 const ship=support.ship.flight,local=f.position.clone().sub(ship.position).applyQuaternion(ship.rotation.clone().invert()).add(ship.spec.com).sub(deck.position),t=ticketFor(unit,support.ship,deck,local.z);
 t.kind='return';t.status='waiting';t.x=local.x;t.localRotation=ship.rotation.clone().invert().multiply(f.rotation);t.parkZ=deck.def.size[2]/2-size.z/2-6;t.parkStart=null;s.launchTickets||=[];s.launchEvents||=[];s.launchTickets.push(t);f.carrierLaunch=t;hold(t);return true;
}
export function stepCarrierLaunch(s,dt){
 for(const t of s.launchTickets||[])if(['queued','ready','waiting'].includes(t.status))hold(t);
 let t=s.activeLaunch;if(t?.status==='airborne'){t.releaseTime+=dt;if(t.releaseTime<2)return;t.status='departed';s.activeLaunch=null;t=null;}
 if(!t){t=(s.launchTickets||[]).find(t=>['queued','ready','waiting'].includes(t.status));if(!t)return;s.activeLaunch=t;}
 const f=t.unit.flight,ship=t.carrier?.flight;
 if(!f.alive||(ship&&(!ship.alive||ship.sinking||!usable(t.deck)))){if(f.alive){f.position.y=Math.max(f.position.y+300,s.config.altitude);f.velocity.set(0,0,-75).applyQuaternion(f.rotation);f.grounded=false;f.carrierSupport=null;}f.carrierLaunch=null;t.status='departed';s.activeLaunch=null;s.launchEvents.push({team:t.unit.team,kind:'unavailable'});return;}
 if(t.status==='waiting'){t.status='parking';t.parkStart={x:t.x,z:t.z,rotation:t.localRotation.clone()};t.parkElapsed=0;t.parkDuration=Math.max(2,Math.hypot(t.x,t.z-t.parkZ)/12);}
 if(t.status==='parking'){t.parkElapsed+=dt;const a=Math.min(1,t.parkElapsed/t.parkDuration),ease=a*a*(3-2*a);t.x=T.MathUtils.lerp(t.parkStart.x,0,ease);t.z=T.MathUtils.lerp(t.parkStart.z,t.parkZ,ease);t.localRotation.copy(t.parkStart.rotation).slerp(new T.Quaternion(),ease);hold(t);if(a<1)return;t.x=0;t.localRotation=null;t.status='ready';s.launchEvents.push({team:t.unit.team,kind:'repositioned',z:t.z});}
 if(t.status==='queued')t.status='ready';
 if(t.status==='ready'){if(t.unit.team==='player'&&!s.keys.has('KeyW'))return;t.status='rolling';t.targetSpeed=Math.max(45,f.spec.stallSpeed*1.35);t.acceleration=Math.max(12,t.targetSpeed**2/(2*Math.max(1,t.z-t.endZ-6)));}
 t.speed=Math.min(t.targetSpeed,t.speed+t.acceleration*dt);t.z=Math.max(t.endZ,t.z-t.speed*dt);hold(t);const forward=new T.Vector3(0,0,-1).applyQuaternion(f.rotation);f.velocity.addScaledVector(forward,t.speed);f.airSpeed=t.speed;
 // Reaching a deck edge at low speed must never count as successful takeoff.
 if(t.speed>=t.targetSpeed-.01){t.status='airborne';f.carrierLaunch=null;f.carrierSupport=null;f.carrierLocalPosition=null;f.grounded=false;f.throttle=1;f.position.y+=1.5;f.velocity.addScaledVector(up,5);f.rotation.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.08));s.launchEvents.push({team:t.unit.team,carrier:s.units.indexOf(t.carrier),kind:'takeoff',returning:t.kind==='return',speed:t.speed});}
}

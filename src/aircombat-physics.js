import {damageCell} from './vehicle-cell-damage.js';
import {damageShipPart} from './warship-runtime.js';
import {buildCollisionIndex} from './vehicle-hit.js';
import {prepareStructure,reconcileStructure} from './vehicle-damage.js';
import * as THREE from 'three';
import {compileAircraft,setGearProjection} from './aircombat-models.js';
import {partFamily} from './aircombat-schema.js';
const clamp=THREE.MathUtils.clamp;
export function createFlight(blueprint,position=[0,600,0],heading=0){const spec=compileAircraft(blueprint),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,heading,0));prepareStructure(spec);buildCollisionIndex(spec);return {spec,position:new THREE.Vector3().fromArray(position),rotation,velocity:new THREE.Vector3(0,0,-75).applyQuaternion(rotation),angular:new THREE.Vector3(),throttle:.85,alive:true,lift:0,drag:0,horsepower:spec.powerHp,airSpeed:75,stall:false,control:{pitch:0,yaw:0,roll:0},kills:0,gearCommand:'auto',grounded:false,groundLevel:0,surface:'land',brake:0,ammo:spec.parts.reduce((n,p)=>{p.ammo=['gun','turret'].includes(partFamily(p.type))?(p.def.ammo||600):0;return n+p.ammo;},0),bombs:spec.parts.filter(p=>partFamily(p.type)==='bomb').length};}
export function steerFlight(flight,direction,manual={}){
 const aim=direction.clone().normalize(),forward=new THREE.Vector3(0,0,-1).applyQuaternion(flight.rotation),currentYaw=Math.atan2(-forward.x,-forward.z),targetYaw=Math.atan2(-aim.x,-aim.z),yawError=Math.atan2(Math.sin(targetYaw-currentYaw),Math.cos(targetYaw-currentYaw));
 const rho=1.225*Math.exp(-Math.max(0,flight.position.y)/8500),q=.5*rho*Math.max(35,flight.airSpeed)**2;
 const bankLimit=clamp((flight.airSpeed/flight.spec.stallSpeed-1)*1.5,.25,.96);
 let bank=clamp(yawError*1.4,-bankLimit,bankLimit),yaw=targetYaw;if(manual.roll){bank=manual.roll*bankLimit;yaw=currentYaw+9.81*Math.tan(bank)/Math.max(45,flight.airSpeed)/1.8;}
 if(!manual.roll){const coordinatedRate=(9.81*Math.abs(Math.tan(bank))/Math.max(45,flight.airSpeed)+.02)/1.8;yaw=currentYaw+clamp(yawError,-coordinatedRate,coordinatedRate);}
 const trim=clamp((flight.spec.mass*9.81/(q*flight.spec.wingArea*Math.max(.5,Math.cos(bank)))-.3)/4.5,-.02,.22),verticalCorrection=clamp((aim.y*flight.airSpeed-flight.velocity.y)*.009,-.12,.22);
 let pitch=clamp(Math.asin(clamp(aim.y,-1,1)),-.65,.65)+trim+verticalCorrection;
 if(manual.pitch)pitch=manual.pitch*.65+trim;if(manual.yaw)yaw=currentYaw+manual.yaw*.08;
 const velocityPitch=Math.atan2(flight.velocity.y,Math.hypot(flight.velocity.x,flight.velocity.z));pitch=clamp(pitch,velocityPitch-.2,velocityPitch+.23);
 const targetDirection=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
 const target=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(),targetDirection,new THREE.Vector3(0,1,0))).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),bank));
 const error=flight.rotation.clone().invert().multiply(target).normalize();if(error.w<0)error.set(-error.x,-error.y,-error.z,-error.w);const magnitude=Math.hypot(error.x,error.y,error.z),angle=2*Math.atan2(magnitude,Math.max(0,error.w)),gain=magnitude>1e-6?angle/magnitude:0;
 flight.control.pitch=clamp(error.x*gain*2.8,-.8,.8);flight.control.yaw=clamp(error.y*gain*1.8,-.5,.5);flight.control.roll=clamp(error.z*gain*3.5,-1.05,1.05);
}
export function stepFlight(f,dt,wind=0){
  if(!f.alive)return;
  if(f.gearCommand==='auto'){if(f.grounded||f.position.y<(f.groundLevel||0)+5)f.autoGearRetracted=false;else if(f.position.y>(f.groundLevel||0)+20&&f.airSpeed>f.spec.stallSpeed*.95)f.autoGearRetracted=true;}
  const gears=f.spec.parts.filter(p=>partFamily(p.type)==='gear'),wanted=f.gearCommand==='down'?1:f.gearCommand==='up'?0:f.autoGearRetracted?0:1;for(const p of gears){const previous=p.gearDeployment??1;p.gearDeployment=previous+clamp(wanted-previous,-dt*.5,dt*.5);}if(gears.length)setGearProjection(f.spec,gears.reduce((n,p)=>n+p.gearDeployment,0)/gears.length);f.gearSimulated=true;
  const inv=f.rotation.clone().invert(),relative=f.velocity.clone().sub(new THREE.Vector3(wind,0,0)),speed=relative.length(),rho=1.225*Math.exp(-Math.max(0,f.position.y)/8500),q=.5*rho*speed*speed;
  const force=new THREE.Vector3(0,-f.spec.mass*9.81,0),torque=new THREE.Vector3(),forward=new THREE.Vector3(0,0,-1).applyQuaternion(f.rotation);f.lift=0;f.drag=0;f.horsepower=0;
  const side=new THREE.Vector3(1,0,0).applyQuaternion(f.rotation),slip=relative.dot(side);
  // Assisted rudder / fuselage side force prevents yaw commands from leaving the velocity sideways.
  force.addScaledVector(side,-slip*f.spec.mass*1.2);
  const add=(v,point)=>{force.add(v);torque.add(point.clone().sub(f.spec.com).cross(v.clone().applyQuaternion(inv)));};
  for(const p of f.spec.parts){const health=clamp(p.health/p.maxHealth,0,1);if(health<=0)continue;if(partFamily(p.type)==='bomb'&&p.released)continue;const point=p.center,lever=point.clone().sub(f.spec.com),localVelocity=relative.clone().applyQuaternion(inv).add(f.angular.clone().cross(lever)).applyQuaternion(p.rotation.clone().invert());const angle=Math.atan2(-localVelocity.y,Math.max(1,-localVelocity.z))+(p.type==='flap'?(f.flaps||0)*.2:0);let drag=p.def.drag*p.frontalArea;
    if(partFamily(p.type).startsWith('wing')||p.def.aero){const stallFactor=Math.abs(angle)>.32?Math.max(.12,1-(Math.abs(angle)-.32)*2):1,cl=clamp(.3+4.5*angle,-1.45,1.45)*stallFactor,area=p.def.area*p.scale**2,lift=q*area*cl*health;const up=new THREE.Vector3(0,1,0).applyQuaternion(p.rotation).applyQuaternion(f.rotation),liftDirection=up.addScaledVector(relative,-up.dot(relative)/Math.max(speed*speed,1)).normalize();add(liftDirection.multiplyScalar(lift),point);f.lift+=lift;drag+=area*.055*cl*cl*health;}
    if(partFamily(p.type)==='engine'){const hp=p.powerHp*health;f.horsepower+=hp;const thrust=Math.min(hp*735.5*.78/Math.max(speed,28),hp*5.5)*f.throttle;add(new THREE.Vector3(0,0,-1).applyQuaternion(p.rotation).applyQuaternion(f.rotation).multiplyScalar(thrust),point);}
    const dragForce=q*drag*(partFamily(p.type).startsWith('wing')?.35+.65*health:1);add(relative.clone().normalize().multiplyScalar(-dragForce),point);f.drag+=dragForce;
  }
  // S deploys an air brake in flight and a wheel brake on the platform.
  if(f.brake){const braking=q*Math.max(.8,f.spec.frontalArea)*.65*f.brake;force.addScaledVector(relative.clone().normalize(),-braking);f.drag+=braking;}
  // Simplified flight-assistance torque. Surface forces above remain responsible for lift/drag.
  const tails=f.spec.parts.filter(p=>partFamily(p.type)==='tail'),authority=(tails.length?tails.reduce((n,p)=>n+p.health/p.maxHealth,0)/tails.length:0)*clamp(speed/45,.1,1),c=f.control;
  const target=new THREE.Vector3(c.pitch*authority,c.yaw*authority,c.roll*authority);
  const aero=torque.clone();for(const axis of ['x','y','z']){const i=Math.max(100,f.spec.inertia[axis]);f.angular[axis]+=clamp(aero[axis]/i,-2,2)*dt;f.angular[axis]+=(target[axis]-f.angular[axis])*Math.min(1,dt*18);f.angular[axis]=clamp(f.angular[axis],-1.3,1.3);}
  const omega=f.angular.length();if(omega>1e-6)f.rotation.multiply(new THREE.Quaternion().setFromAxisAngle(f.angular.clone().normalize(),omega*dt)).normalize();
  f.velocity.addScaledVector(force,dt/f.spec.mass);if(f.velocity.length()>210)f.velocity.setLength(210);f.position.addScaledVector(f.velocity,dt);f.airSpeed=speed;f.stall=speed<f.spec.stallSpeed||Math.abs(Math.atan2(-relative.clone().applyQuaternion(inv).y,Math.max(1,-relative.clone().applyQuaternion(inv).z)))>.32;
  const clearance=f.spec.contactHeight+(f.groundLevel||0),upright=new THREE.Vector3(0,1,0).applyQuaternion(f.rotation).y,gearDown=gears.some(p=>p.health>0&&p.gearDeployment>.9);f.grounded=false;
  if(f.surface!=='water'&&f.position.y<=clearance&&gearDown&&upright>.85&&f.velocity.y>-6){f.position.y=clearance;f.velocity.y=Math.max(0,f.velocity.y);f.velocity.x*=Math.max(0,1-dt*.012);f.velocity.z*=Math.max(0,1-dt*.012);f.grounded=true;if(f.brake){const horizontal=Math.hypot(f.velocity.x,f.velocity.z),ratio=horizontal?Math.max(0,horizontal-dt*5*f.brake)/horizontal:0;f.velocity.x*=ratio;f.velocity.z*=ratio;}}
  if(f.position.y<(f.groundLevel||0)+.1||f.position.y<clearance*.8&&!f.grounded||!Number.isFinite(f.position.lengthSq()))f.alive=false;
}
export function damagePart(f,partId,damage,options){if(f.ship){damageShipPart(f,partId,damage,options);return;}const p=f.spec.parts.find(p=>p.id===partId);if(!p||!f.alive)return;if(p.blockCells){if(damageCell(f,p,damage,options?.point))reconcileStructure(f);return;}const before=p.health;p.health=Math.max(0,p.health-damage);if(before>0&&p.health===0){p.destroyed=true;reconcileStructure(f);}}
export function segmentSphere(a,b,center,radius){const delta=b.clone().sub(a),length=delta.lengthSq(),t=length?clamp(center.clone().sub(a).dot(delta)/length,0,1):0;return a.clone().addScaledVector(delta,t).distanceToSquared(center)<=radius*radius?t:null;}

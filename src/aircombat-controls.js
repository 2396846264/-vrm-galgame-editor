import * as THREE from 'three';
const clamp=THREE.MathUtils.clamp;
export const mouseAxis=v=>clamp(v/.8,-1,1);
// Mouse axes are direct rate inputs, never a stored world-space destination.
// Level trim and attitude limits depend only on the aircraft state.
export function racingFlight(f,mouse,keys,dt){
 f.assisted=true;f.brake=keys.has('KeyS')?1:0;
 if(f.brake)f.throttle=clamp(f.throttle-dt*.8,0,1);
 else if(keys.has('KeyW'))f.throttle=clamp(f.throttle+dt*.5,0,1);
 const forward=new THREE.Vector3(0,0,-1).applyQuaternion(f.rotation),up=new THREE.Vector3(0,1,0).applyQuaternion(f.rotation),right=new THREE.Vector3(1,0,0).applyQuaternion(f.rotation);
 const bank=Math.atan2(right.y,up.y),pitch=Math.asin(clamp(forward.y,-1,1));
 const bankInput=Number(keys.has('KeyA'))-Number(keys.has('KeyD'));
 const requestedBank=bankInput*.68;
 f.control.roll=clamp((requestedBank-bank)*3.4,-.85,.85);
 // Positive Y rotation turns toward -X; mouse right therefore uses negative yaw.
 f.control.yaw=clamp(-mouseAxis(mouse.x)*.32-9.81*Math.tan(bank)/Math.max(45,f.airSpeed)+.2*(Number(keys.has('KeyQ'))-Number(keys.has('KeyE'))),-.5,.5);
 const rho=1.225*Math.exp(-Math.max(0,f.position.y)/8500),q=.5*rho*Math.max(35,f.airSpeed)**2;
 const velocityPitch=Math.atan2(f.velocity.y,Math.hypot(f.velocity.x,f.velocity.z));
 const trim=clamp((f.spec.mass*9.81/(q*f.spec.wingArea*Math.max(.5,Math.cos(bank)))-.3)/4.5,-.02,.22);
 const manual=mouseAxis(mouse.y)*.34+.35*(Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp')));
 const level=clamp((velocityPitch+trim-pitch)*2.8-f.velocity.y*.012,-.32,.32);
 let command=manual+level;
 if(pitch>.52)command=Math.min(command,(.52-pitch)*4);
 if(pitch<-.48)command=Math.max(command,(-.48-pitch)*4);
 const aoa=pitch-velocityPitch;if(aoa>.24)command=Math.min(command,(.24-aoa)*5);
 f.control.pitch=clamp(command,-.65,.65);f.flaps=keys.has('KeyF')?1:0;
}

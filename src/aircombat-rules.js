import * as THREE from 'three';
export const secondaryFireRange=2000;
export const teamSeparation=20000,aircraftSpacing=2000,projectileRange=7000,projectileGravity=1.2,maxProjectiles=4096;
const lane=i=>i===0?0:(i%2?1:-1)*Math.ceil(i/2)*aircraftSpacing;
export function formationSpawns(allies,enemies,altitude){return [
 {team:'player',position:[0,altitude,0],heading:0},
 ...Array.from({length:allies},(_,i)=>({team:'ally',position:[lane(i+1),altitude,0],heading:0})),
 ...Array.from({length:enemies},(_,i)=>({team:'enemy',position:[lane(i),altitude,-teamSeparation],heading:Math.PI}))
];}
export const distanceLabel=distance=>(Math.max(0,distance)/1000).toFixed(1)+' km';
export function createProjectile(origin,velocity){return {position:origin.clone(),velocity:velocity.clone(),travelled:0,trail:[origin.clone()]};}
export function advanceProjectile(b,dt){
 if(b.horizontalRange){
  const end=b.position.clone().addScaledVector(b.velocity,dt);end.y-=.5*b.gravity*dt*dt;
  const origin=b.launchOrigin,dx=end.x-origin.x,dz=end.z-origin.z,r=b.maxRange;
  let expired=dx*dx+dz*dz>=r*r;
  if(expired){const start=b.position.clone().sub(origin),step=end.clone().sub(b.position),aa=step.x**2+step.z**2,bb=2*(start.x*step.x+start.z*step.z),cc=start.x**2+start.z**2-r*r,t=aa>1e-12?THREE.MathUtils.clamp((-bb+Math.sqrt(Math.max(0,bb*bb-4*aa*cc)))/(2*aa),0,1):0;end.lerpVectors(b.position,end,t);}
  b.travelled+=end.distanceTo(b.position);b.position.copy(end);b.velocity.y-=b.gravity*dt;
  if(b.position.distanceToSquared(b.trail.at(-1))>=64){b.trail.push(b.position.clone());if(b.trail.length>16)b.trail.shift();}return expired;
 }
 b.velocity.y-=(b.gravity??projectileGravity)*dt;
 const delta=b.velocity.clone().multiplyScalar(dt),remaining=projectileRange-b.travelled,length=Math.min(delta.length(),remaining);
 if(delta.lengthSq()>0)b.position.addScaledVector(delta,length/delta.length());
 b.travelled=Math.min(projectileRange,b.travelled+length);
 if(b.position.distanceToSquared(b.trail.at(-1))>=64){b.trail.push(b.position.clone());if(b.trail.length>16)b.trail.shift();}
 return b.travelled>=projectileRange-1e-6;
}

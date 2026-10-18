import * as THREE from 'three';
export const secondaryFireRange=2000;
export const teamSeparation=10000,aircraftSpacing=2000,projectileRange=7000,projectileGravity=1.2,maxProjectiles=4096;
const lane=i=>i===0?0:(i%2?1:-1)*Math.ceil(i/2)*aircraftSpacing;
export function formationSpawns(allies,enemies,altitude){return [
 {team:'player',position:[0,altitude,0],heading:0},
 ...Array.from({length:allies},(_,i)=>({team:'ally',position:[lane(i+1),altitude,0],heading:0})),
 ...Array.from({length:enemies},(_,i)=>({team:'enemy',position:[lane(i),altitude,-teamSeparation],heading:Math.PI}))
];}
export const distanceLabel=distance=>(Math.max(0,distance)/1000).toFixed(1)+' km';
export function createProjectile(origin,velocity){return {position:origin.clone(),velocity:velocity.clone(),travelled:0,trail:[origin.clone()]};}
export function advanceProjectile(b,dt){
 b.velocity.y-=projectileGravity*dt;
 const delta=b.velocity.clone().multiplyScalar(dt),remaining=projectileRange-b.travelled,length=Math.min(delta.length(),remaining);
 if(delta.lengthSq()>0)b.position.addScaledVector(delta,length/delta.length());
 b.travelled=Math.min(projectileRange,b.travelled+length);
 if(b.position.distanceToSquared(b.trail.at(-1))>=64){b.trail.push(b.position.clone());if(b.trail.length>16)b.trail.shift();}
 return b.travelled>=projectileRange-1e-6;
}

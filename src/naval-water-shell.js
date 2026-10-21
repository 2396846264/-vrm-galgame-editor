import {advanceProjectile} from './aircombat-rules.js';
// Game-scale water resistance, enabled for heavy naval shells only.
// Air and water segments stop at the surface so a frame never hits a submerged
// block with the shell's pre-entry velocity and full damage budget.
export function advanceWaterShell(b,dt,water){
 const height=(p)=>water?.height(p.x,p.z)??0;
 const crossing=b.enteredWater;b.enteredWater=false;
 if(!b.heavyRules)return advanceProjectile(b,dt);
 if(!b.submerged&&(crossing||b.position.y<=height(b.position)+.0001&&b.velocity.y<0)){
  b.waterSurface=height(b.position);b.submerged=true;b.waterAge=0;b.waterTravel=0;
  b.velocity.multiplyScalar(.45);
  b.damage*=.7;if(Number.isFinite(b.remainingDamage))b.remainingDamage*=.7;
 }
 const start=b.position.clone();
 if(!b.submerged){
  const expired=advanceProjectile(b,dt);
  const startDepth=start.y-height(start),endDepth=b.position.y-height(b.position);
  if(startDepth>0&&endDepth<=0){
   const end=b.position.clone();let low=0,high=1;
   for(let i=0;i<12;i++){const mid=(low+high)/2;b.position.lerpVectors(start,end,mid);if(b.position.y>height(b.position))low=mid;else high=mid;}
   b.position.lerpVectors(start,end,high);b.position.y=height(b.position);
   b.enteredWater=true;
  }
  return expired;
 }
 b.waterAge+=dt;
 // Exponential integration remains stable at different frame rates.
 const drag=3,decay=Math.exp(-drag*dt),distance=b.velocity.clone().multiplyScalar((1-decay)/drag);
 b.position.add(distance);b.velocity.multiplyScalar(decay);b.velocity.y-=2*dt;
 const length=start.distanceTo(b.position);b.waterTravel+=length;b.travelled+=length;
 b.trail.push(b.position.clone());if(b.trail.length>16)b.trail.shift();
 return b.waterAge>=1.2||b.waterTravel>=Math.max(30,Math.min(140,(b.part?.def.caliber||127)*.3))||b.position.y<=(b.waterSurface??0)-18||Math.hypot(b.position.x-b.launchOrigin.x,b.position.z-b.launchOrigin.z)>=b.maxRange;
}

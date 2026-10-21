import * as THREE from 'three';
export const usesHeavyShellRules=d=>d?.naval===true&&d.caliber>=100;
export const navalBlastRadius=c=>Math.max(1,3+(c-127)*7/(406-127));
export function navalShellProfile(d,ammoType='he'){
 if(!usesHeavyShellRules(d))return null;
 return {range:d.caliber*100,damage:d.caliber*(ammoType==='ap'?50:10),blastRadius:ammoType==='ap'?0:navalBlastRadius(d.caliber),proximityRadius:navalBlastRadius(d.caliber)+10,gravity:9.81,speed:Math.max(d.muzzleSpeed||620,Math.sqrt(d.caliber*100*9.81*1.1))};
}
// Low-arc firing solution; all quantities are metres / seconds. Relative
// target motion includes the launcher's velocity, inherited by the shell.
export function navalBallisticAim(origin,target,relativeVelocity,speed,gravity=9.81){
 let time=origin.distanceTo(target)/speed,direction=new THREE.Vector3(),reachable=true;
 for(let i=0;i<12;i++){
  const delta=target.clone().addScaledVector(relativeVelocity,time).sub(origin),x=Math.hypot(delta.x,delta.z),v2=speed*speed,disc=v2*v2-gravity*(gravity*x*x+2*delta.y*v2);
  if(disc<0){reachable=false;break;}
  if(x<1e-7){direction.copy(delta).normalize();time=Math.abs(delta.y)/speed;break;}
  const slope=(v2-Math.sqrt(disc))/(gravity*x),angle=Math.atan(slope),next=x/(speed*Math.cos(angle));
  direction.set(delta.x/x*Math.cos(angle),Math.sin(angle),delta.z/x*Math.cos(angle));
  if(Math.abs(next-time)<1e-5){time=next;break;}time=next;
 }
 return {direction,time,reachable};
}

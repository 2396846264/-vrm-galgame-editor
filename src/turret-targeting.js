import * as THREE from 'three';
import {partWorld} from './vehicle-hit.js';
// Main batteries prioritize surface combat; light AA never wastes a magazine on armor.
export function turretTarget(units,owner,part,origin,range){
 const candidates=units.filter(u=>u!==owner&&u.flight?.alive&&((u.team==='enemy')!==(owner.team==='enemy'))&&u.flight.position.distanceTo(origin)<=range&&(!owner.flight.ship||part.def.caliber>=100||!u.flight.ship));
 candidates.sort((a,b)=>{const priority=u=>owner.flight.ship&&part.def.caliber>=203?(u.flight.ship?0:1):(u.flight.ship?1:0);return priority(a)-priority(b)||a.flight.position.distanceToSquared(origin)-b.flight.position.distanceToSquared(origin);});return candidates[0]||null;
}
export function targetPoint(target,origin){const f=target.flight;if(!f.ship)return f.position.clone();const cores=f.cores.filter(p=>p.health>0).map(p=>partWorld(f,p)).sort((a,b)=>a.distanceToSquared(origin)-b.distanceToSquared(origin));const at=cores[0]?.clone()||f.position.clone();at.y=Math.max(1.5,at.y);return at;}
export function ballisticAim(origin,at,relativeVelocity,speed,gravity){let time=origin.distanceTo(at)/speed,aim=new THREE.Vector3();for(let i=0;i<5;i++){aim.copy(at).addScaledVector(relativeVelocity,time).sub(origin);aim.y+=.5*gravity*time*time;time=Math.min(15,aim.length()/speed);}return {direction:aim.normalize(),time};}

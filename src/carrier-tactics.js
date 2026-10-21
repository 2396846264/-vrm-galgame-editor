import * as T from 'three';
export function carrierCourse(fleet,fleets,dt){
 fleet.patrolTime=(fleet.patrolTime||0)+dt;
 const front=fleets.find(f=>f.team===fleet.team&&f.role!=='carrier'&&f.members.some(u=>u.flight.alive)),enemy=fleets.filter(f=>f.team!==fleet.team&&f.members.some(u=>u.flight.alive)).sort((a,b)=>a.anchor.distanceToSquared(fleet.anchor)-b.anchor.distanceToSquared(fleet.anchor))[0];
 const reference=front?.anchor||fleet.frontReference,heading=front?.heading??fleet.cfg.heading*Math.PI/180,forward=new T.Vector3(0,0,-1).applyAxisAngle(new T.Vector3(0,1,0),heading),side=new T.Vector3(-forward.z,0,forward.x);
 // Rear station follows the gun fleet but carriers keep their own patrol slots.
 const rear=reference.clone().addScaledVector(forward,-45000),angle=fleet.patrolTime*.0015;
 fleet.patrolCenter=rear;fleet.tactical=null;
 if(enemy&&enemy.anchor.distanceTo(fleet.anchor)<30000){fleet.carrierMode='withdraw';const away=fleet.anchor.clone().sub(enemy.anchor);return Math.atan2(-away.x,-away.z);}
 fleet.carrierMode='rearPatrol';const target=rear.addScaledVector(side,Math.sin(angle)*3000).addScaledVector(forward,Math.cos(angle)*1500),delta=target.sub(fleet.anchor);return Math.atan2(-delta.x,-delta.z);
}

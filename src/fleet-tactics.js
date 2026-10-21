import * as T from 'three';
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export const fleetForward=heading=>new T.Vector3(-Math.sin(heading),0,-Math.cos(heading));
export function tacticalFleetCourse(fleet,opponents,dt){
 const enemy=opponents.filter(e=>e.team!==fleet.team&&e.active).sort((a,b)=>a.anchor.distanceToSquared(fleet.anchor)-b.anchor.distanceToSquared(fleet.anchor))[0];
 const distance=enemy?enemy.anchor.distanceTo(fleet.anchor):Infinity;
 if(!enemy||distance>22000||(!fleet.tactical&&distance>=20000)){fleet.tactical=null;return null;}
 const t=fleet.tactical||={mode:'crossingT',clock:0};t.clock-=dt;t.distance=distance;t.targetTeam=enemy.team;
 const forward=fleetForward(enemy.heading),toward=enemy.anchor.clone().sub(fleet.anchor).setY(0).normalize(),bearing=Math.atan2(-toward.x,-toward.z);
 const candidates=[bearing+Math.PI/2,bearing-Math.PI/2];const broadside=candidates.sort((a,b)=>Math.abs(wrap(a-(t.broadside??fleet.heading)))-Math.abs(wrap(b-(t.broadside??fleet.heading))))[0];
 if(t.clock<=0){const lead=T.MathUtils.clamp(distance*.3,1200,5000),side=new T.Vector3(-forward.z,0,forward.x);t.flank??=(fleet.anchor.clone().sub(enemy.anchor).dot(side)>=0?1:-1);t.point=enemy.anchor.clone().addScaledVector(forward,lead).addScaledVector(side,t.flank*lead*.65);t.broadside=broadside;t.clock=6;}
 const ahead=fleet.anchor.clone().sub(enemy.anchor).dot(forward)>0,exposure=Math.abs(fleetForward(fleet.heading).dot(toward));
 if(fleet.anchor.distanceTo(t.point)<1800||(ahead&&exposure<.4))t.mode='broadside';else if(!ahead||exposure>.75)t.mode='crossingT';
 // Close formations avoid charging through one another once within 2 km.
 if(distance<2000||t.mode==='broadside')return broadside;
 const delta=t.point.clone().sub(fleet.anchor);return Math.atan2(-delta.x,-delta.z);
}

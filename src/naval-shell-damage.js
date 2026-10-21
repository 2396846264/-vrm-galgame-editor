import * as THREE from 'three';
import {cellWorld,beginCellDamageBatch,endCellDamageBatch} from './vehicle-cell-damage.js';
import {partWorld,partFrame,segmentBox,structuralCandidates} from './vehicle-hit.js';
import {damagePart} from './aircombat-physics.js';
import {finishShipDamage} from './warship-runtime.js';
import {reconcileStructure} from './vehicle-damage.js';

const health=(p,cell)=>cell?(p.cellHealth?.get(cell.join(','))??p.cellHP??p.maxHealth/p.blockCells.length):p.health;
function finish(f){if(f.ship)finishShipDamage(f);else if(endCellDamageBatch(f))reconcileStructure(f);}
function candidates(f,a,b){const inv=f.rotation.clone().invert(),x=a.clone().sub(f.position).applyQuaternion(inv).add(f.spec.com),y=b.clone().sub(f.position).applyQuaternion(inv).add(f.spec.com);return [...new Set([...structuralCandidates(f.spec,x,y),...f.spec.parts.filter(p=>!p.blockCells||p.fragment)])];}
function cellHit(f,p,cell,a,b){
 const frame=p.fragment||f,center=cell?cellWorld(f,p,cell):partWorld(f,p),q=frame.rotation.clone();if(!cell)q.multiply(p.rotation);q.invert();
 const start=a.clone().sub(center).applyQuaternion(q),end=b.clone().sub(center).applyQuaternion(q),half=cell?new THREE.Vector3().setScalar(f.spec.gridSize*.5):new THREE.Vector3(...p.def.size).multiplyScalar((p.scale||1)*.5);
 return segmentBox(start,end,new THREE.Box3(half.clone().negate(),half))?.[0]??null;
}
export function heavyShellBlast(units,point,damage,radius){
 let count=0;
 for(const {flight:f}of units){if(!f?.alive)continue;const hits=[];
  for(const p of f.spec.parts){if(p.health<=0||p.released)continue;for(const cell of p.blockCells||[null]){
   const at=cell?cellWorld(f,p,cell):partWorld(f,p);if(at.distanceToSquared(point)<=radius*radius&&health(p,cell)>0)hits.push({p,at});
  }}
  if(!hits.length)continue;beginCellDamageBatch(f);
  try{for(const {p,at}of hits){damagePart(f,p.id,damage,{point:at,penetration:Infinity});count++;}}finally{finish(f);}
 }
 return count;
}
// Snapshot contacts in near-to-far order before row splitting or sinking.
// Spend current cell HP only; intact armour does not introduce a second rule.
export function penetrateHeavyShell(units,owner,a,b,budget){
 const hits=[];for(const u of units){const f=u.flight;if(u===owner||!f?.alive)continue;
  for(const p of candidates(f,a,b)){if(p.health<=0||p.released)continue;for(const cell of p.blockCells||[null]){if(health(p,cell)<=0)continue;const t=cellHit(f,p,cell,a,b);if(t!==null)hits.push({u,p,cell,t,at:cell?cellWorld(f,p,cell):partWorld(f,p)});}}
 }
 hits.sort((x,y)=>x.t-y.t);const touched=new Set(),impacts=[];let remaining=Math.max(0,budget);
 try{for(const h of hits){if(remaining<=1e-8)break;const f=h.u.flight,hp=health(h.p,h.cell);if(hp<=0)continue;
   if(!touched.has(f)){beginCellDamageBatch(f);touched.add(f);}const spent=Math.min(hp,remaining);
   damagePart(f,h.p.id,spent,{point:h.at,penetration:Infinity});remaining-=spent;impacts.push({...h,point:a.clone().lerp(b,h.t),spent});
  }}finally{for(const f of touched)finish(f);}
 return {remaining,impacts};
}

import * as THREE from 'three';
import {partFamily} from './aircombat-schema.js';
const key=c=>c.join(','),directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
export const destructionThreshold=.35;
// Build the original structural graph once. Damage never creates a new support for hardware.
export function prepareStructure(spec){
 const rows=spec.parts.filter(p=>p.blockCells?.length&&p.health>0),cells=new Map(),points=[];
 for(const p of rows){p.neighbours=new Set();for(const c of p.blockCells){cells.set(key(c),p);points.push({cell:c,row:p});}}
 for(const p of rows)for(const c of p.blockCells)for(const d of directions){const n=cells.get(key(c.map((v,i)=>v+d[i])));if(n&&n!==p)p.neighbours.add(n);}
 spec.structuralRows=rows;spec.originalBlockCount??=rows.reduce((n,p)=>n+p.blockCells.length,0);
 spec.structureAnchors=[...rows].sort((a,b)=>{
  const rank=p=>p.blockKind==='pilot'?0:p.blockKind==='cockpit'?1:['hull','armor'].includes(p.blockKind)?2:3;
  return rank(a)-rank(b)||a.position.lengthSq()-b.position.lengthSq();
 });
 for(const p of spec.parts.filter(p=>!p.blockCells)){
  if(p.supportCells){p.supports=new Set(p.supportCells.map(c=>cells.get(c)).filter(Boolean));continue;}
  let nearest=Infinity;p.supportCells=[];p.supports=new Set();
  for(const {cell:c,row}of points){const d=c.reduce((n,v,i)=>n+(v*spec.gridSize-p.position.getComponent(i))**2,0);
   if(d<nearest-1e-8){nearest=d;p.supports.clear();p.supportCells=[];p.supports.add(row);p.supportCells.push(key(c));}else if(Math.abs(d-nearest)<1e-8){p.supports.add(row);p.supportCells.push(key(c));}
  }
 }
}
export function beginCrash(f){if(f.crashing||f.wrecked)return;f.alive=false;f.crashing=true;f.throttle=0;f.angular.set(.18,.06,.32);f.crashTime=0;}
export function stepCrash(f,dt){if(!f.crashing)return;f.crashTime+=dt;f.velocity.y-=9.81*dt;f.velocity.multiplyScalar(Math.exp(-dt*.025));f.position.addScaledVector(f.velocity,dt);const speed=f.angular.length();if(speed)f.rotation.multiply(new THREE.Quaternion().setFromAxisAngle(f.angular.clone().normalize(),speed*dt)).normalize();if(f.position.y<=Math.max(0,f.groundLevel||0)||f.crashTime>90){f.position.y=Math.max(0,f.groundLevel||0);f.crashing=false;f.wrecked=true;}}
export function reconcileStructure(f){
 const spec=f.spec,rows=spec.structuralRows||[],detach=p=>{if(p.detached||p.health<=0||p.released)return;p.health=0;p.detached=true;};
 if(rows.length){
  const root=spec.structureAnchors.find(p=>p.health>0&&!p.detached),seen=new Set(),pending=root?[root]:[];
  while(pending.length){const p=pending.pop();if(seen.has(p)||p.health<=0||p.detached)continue;seen.add(p);for(const n of p.neighbours)pending.push(n);}
  for(const p of rows)if(!seen.has(p))detach(p);
  for(const p of spec.parts)if(!p.blockCells&&(p.supportCells?.length||p.supports.size)&&![...p.supports].some(n=>n.health>0&&!n.detached))detach(p);
  f.lostBlocks=spec.originalBlockCount-rows.reduce((n,p)=>n+(p.health>0&&!p.detached?p.blockCells.length:0),0);f.blockLoss=f.lostBlocks/spec.originalBlockCount;
  if(spec.pilotDestroyed||spec.parts.some(p=>p.blockKind==='pilot'&&p.health<=0)||f.lostBlocks*100>=spec.originalBlockCount*35)beginCrash(f);
 }else{
  const byId=new Map(spec.parts.map(p=>[p.id,p]));let changed=true;
  while(changed){changed=false;for(const p of spec.parts)if(p.parentId&&p.health>0&&byId.get(p.parentId)?.health<=0){detach(p);changed=true;}}
  if(spec.parts.some(p=>['fuselage','cockpit'].includes(partFamily(p.type))&&p.health<=0))beginCrash(f);
 }
 f.damageRevision=(f.damageRevision||0)+1;
}

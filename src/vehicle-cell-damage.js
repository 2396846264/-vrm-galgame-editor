import * as THREE from 'three';
import {prepareStructure} from './vehicle-damage.js';
import {buildCollisionIndex} from './vehicle-hit.js';
// Rendering may merge consecutive blocks; damage and hit points always address a cell.
export function cellWorld(f,p,cell){const frame=p.fragment||f,local=new THREE.Vector3(...cell).multiplyScalar(f.spec.gridSize).sub(p.fragment?p.fragment.localCenter:f.spec.com);return local.applyQuaternion(frame.rotation).add(frame.position);}
export function cellAtPoint(f,p,point){if(!point||p.blockCells.length===1)return p.blockCells[0];let best=p.blockCells[0],distance=Infinity;for(const cell of p.blockCells){const n=cellWorld(f,p,cell).distanceToSquared(point);if(n<distance){distance=n;best=cell;}}return best;}
export function damageCell(f,p,amount,point){
 if(!p.blockCells||amount<=0)return false;
 const hp=p.cellHP||p.maxHealth/p.blockCells.length;
 p.cellHealth||=new Map(p.blockCells.map(c=>[c.join(','),hp]));
 const cell=cellAtPoint(f,p,point),key=cell.join(','),before=p.cellHealth.get(key)||0,after=Math.max(0,before-amount);
 p.cellHealth.set(key,after);p.health-=before-after;
 if(after>0)return false;
 if(p.blockKind==='pilot')f.spec.pilotDestroyed=true;
 if(f.cellDamageBatch){f.cellDirtyRows.add(p);return false;}
 splitDamagedRow(f,p,hp);refreshTopology(f);return true;
}
function splitDamagedRow(f,p,hp){
 const alive=p.blockCells.filter(c=>p.cellHealth.get(c.join(','))>0),groups=[];
 for(const c of alive){const last=groups.at(-1);if(last&&last.at(-1)[2]+1===c[2])last.push(c);else groups.push([c]);}
 if(!groups.length){p.health=0;p.destroyed=true;}
 else{
  const original={...p,def:{...p.def},cellHealth:new Map(p.cellHealth)},fragment=p.fragment;
  for(let i=0;i<groups.length;i++){
   const cells=groups[i],part=i?{...original,id:'cell:'+cells[0].join(',')}:p;
   part.blockCells=cells;part.cellHP=hp;part.cellHealth=new Map(cells.map(c=>[c.join(','),original.cellHealth.get(c.join(','))]));part.health=[...part.cellHealth.values()].reduce((a,b)=>a+b,0);part.maxHealth=hp*cells.length;
   part.position=new THREE.Vector3(cells[0][0],cells[0][1],(cells[0][2]+cells.at(-1)[2])/2).multiplyScalar(f.spec.gridSize);part.center=part.position.clone();
   part.def={...original.def,size:[f.spec.gridSize,f.spec.gridSize,cells.length*f.spec.gridSize],faces:null,area:original.def.area*cells.length/original.blockCells.length,hp:part.maxHealth};part.mass=original.mass*cells.length/original.blockCells.length;part.frontalArea=(original.frontalArea||0)*cells.length/original.blockCells.length;part.renderRevision=(part.renderRevision||0)+1;
   if(i){f.spec.parts.push(part);if(fragment)fragment.parts.push(part);}
  }
 }
}
function refreshTopology(f){prepareStructure(f.spec);buildCollisionIndex(f.spec);f.damageRevision=(f.damageRevision||0)+1;}
export function beginCellDamageBatch(f){f.cellDamageBatch=true;f.cellDirtyRows=new Set();}
export function endCellDamageBatch(f){f.cellDamageBatch=false;const rows=[...f.cellDirtyRows];for(const p of rows)splitDamagedRow(f,p,p.cellHP||p.maxHealth/p.blockCells.length);f.cellDirtyRows.clear();if(rows.length)refreshTopology(f);return rows.length>0;}

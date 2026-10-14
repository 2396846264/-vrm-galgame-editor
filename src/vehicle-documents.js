import * as THREE from 'three';
import {historicalPreset,normalizeAircraft,partFamily} from './aircombat-schema.js';
import {historicalSpecs} from './aircombat-historical-kit.js';
import {compileAircraft} from './aircombat-models.js';
import {setBlock,mirrorAttachment} from './vehicle-structure.js';
const uid=()=>crypto.randomUUID().replaceAll('-','');
export const vehicleRoles=['aircraft','allyAircraft','enemyAircraft'];
export function voxelPreset(kit='bf109'){
 const spec=historicalSpecs[kit]||historicalSpecs.bf109,old=historicalPreset(kit),compiled=compileAircraft(old);
 const v={schemaVersion:2,vehicleType:'aircraft',name:spec.name,gridSize:.125,blocks:[],parts:[]};
 // Connected ellipsoid hull, tapered planar wings, and connected stabilizer/fin.
 for(let z=-Math.floor(spec.length*4);z<=Math.floor(spec.length*4);z++){
  const taper=Math.sqrt(Math.max(.12,1-(z/(spec.length*4+1))**2)),w=Math.max(0,Math.round(spec.bodyWidth*taper*4)),h=Math.max(0,Math.round(spec.bodyHeight*taper*2.8));
  for(let x=0;x<=w;x++)for(let y=-h;y<=h;y++)setBlock(v,[x,y,z],y===h&&z>=-12&&z<=0?'cockpit':'hull',y===h&&z>=-12&&z<=0?'#293d48':spec.color);
 }
 const wingZ=kit==='shinden'?16:-4,span=Math.round(spec.span*4);for(let x=1;x<=span;x++){const chord=Math.max(1,Math.round(spec.chord*4*(1-.45*x/span))),sweep=Math.round(spec.sweep*x/span*8);for(let z=-chord;z<=chord;z++)setBlock(v,[x,0,wingZ+sweep+z],'wing',spec.color);}
 const tailZ=kit==='shinden'?-Math.round(spec.length*4)+8:Math.round(spec.length*4)-8;for(let x=0;x<=Math.round(spec.tailSpan*8);x++)for(let z=-4;z<=4;z++)setBlock(v,[x,0,tailZ+z],'tail',spec.color);
 const finX=spec.doubleTail?Math.round(spec.tailSpan*.83*8):spec.pusher?Math.round(spec.span*.35*8):0,finZ=spec.pusher?wingZ+Math.round(spec.sweep*(finX/span)*8):tailZ;for(let y=1;y<=12;y++)for(let z=-4;z<=4;z++)setBlock(v,[finX,y,finZ+z],'tail',spec.color);
 for(const p of compiled.parts){if(['fuselage','wingLeft','wingRight','tail','cockpit'].includes(partFamily(p.type)))continue;const source=old.parts.find(a=>a.id===p.id);v.parts.push({...structuredClone(source),parentId:'',socketId:'',offset:p.position.toArray().map(n=>Math.round(n*2)/2),rotation:[0,0,0]});}
 v.parts.push({id:uid(),type:'flap',parentId:'',socketId:'',offset:[Math.round(spec.span*.3*2)/2,0,wingZ*.125+spec.chord*.5],rotation:[0,0,0],color:spec.color,scale:1,powerHp:0});v.parts.push(mirrorAttachment(v.parts.at(-1)));
 return normalizeAircraft(v);
}
export function vehicleFromAircraft(a){
 if(a.schemaVersion===2){if(a.gridSize===.125)return structuredClone(a);const v={...structuredClone(a),gridSize:.125,blocks:[]},factor=Math.round((a.gridSize||.25)/.125);for(const b of a.blocks)for(let x=0;x<factor;x++)for(let y=0;y<factor;y++)for(let z=0;z<factor;z++)setBlock(v,[b.cell[0]*factor+x,b.cell[1]*factor+y,b.cell[2]*factor+z],b.kind,b.color,b.shape||'cube',b.shapeRotation||[0,0,0]);return normalizeAircraft(v);}
 const root=a.parts.find(p=>partFamily(p.type)==='fuselage'),kit=root?.type.split('_')[0],v=voxelPreset(historicalSpecs[kit]?kit:a.parts.filter(p=>partFamily(p.type)==='engine').length>1?'b25':'bf109');
 v.name=a.name;const c=compileAircraft(a);v.parts=c.parts.filter(p=>!['fuselage','wingLeft','wingRight','tail','cockpit'].includes(partFamily(p.type))).map(p=>({...structuredClone(a.parts.find(b=>b.id===p.id)),parentId:'',socketId:'',offset:p.position.toArray().map(n=>Math.round(n*2)/2),rotation:new THREE.Euler().setFromQuaternion(p.rotation).toArray().slice(0,3).map(THREE.MathUtils.radToDeg)}));return normalizeAircraft(v);
}
export function createVehicle(project,name,blueprint){const id=uid(),doc={id,name:name||blueprint.name,vehicleType:'aircraft',blueprint:{...structuredClone(blueprint),vehicleId:id}};project.vehicles||=[];project.vehicles.push(doc);return doc;}
export function ensureVehicleLibrary(project){
 project.vehicles||=[];
 for(const act of project.acts||[]){const c=act.event?.type==='aircombat'?act.event.combat:null;if(!c)continue;for(const role of vehicleRoles){const a=c[role];if(!a)continue;let d=project.vehicles.find(v=>v.id===a.vehicleId);if(!d){d=createVehicle(project,a.name,a);a.vehicleId=d.id;}}}
 if(!project.vehicles.length)for(const kit of Object.keys(historicalSpecs))createVehicle(project,historicalSpecs[kit].name,voxelPreset(kit));
 return project.vehicles;
}
export function applyVehicle(project,doc){doc.name=doc.blueprint.name;doc.blueprint.vehicleId=doc.id;for(const act of project.acts||[]){const c=act.event?.type==='aircombat'?act.event.combat:null;if(c)for(const role of vehicleRoles)if(c[role]?.vehicleId===doc.id)c[role]=structuredClone(doc.blueprint);}}

import {normalizeSeaMap} from './sea-maps.js';
import {weaponPartDefinition,weaponAttachmentFields} from './firepower-schema.js';
import {normalizeFleets} from './naval-formations.js';
import {navalParts,aircraftOrdnance} from './naval-kit.js';
import {normalizeWeaponSettings} from './vehicle-weapon-settings.js';
import {normalizeShipDeployments} from './warship-schema.js';
import {normalizeStructure,structureErrors,blockKit} from './vehicle-structure.js';
import {historicalParts,historicalMounts,historicalSpecs} from './aircombat-historical-kit.js';
// Built-in propeller aircraft kit. SI units; forward -Z, up +Y.
export const partKit = {
  fuselage:{name:'机身',mass:650,hp:240,drag:.36,area:2.1,color:'#71896a',size:[1.05,1.05,6]},
  cockpit:{name:'不透明驾驶舱',mass:65,hp:65,drag:.08,area:.55,color:'#283b42',size:[.9,.65,1.65]},
  wingLeft:{name:'左机翼',mass:160,hp:110,drag:.026,area:8,color:'#889a74',size:[4,.16,2]},
  wingRight:{name:'右机翼',mass:160,hp:110,drag:.026,area:8,color:'#889a74',size:[4,.16,2]},
  tail:{name:'尾翼组件',mass:90,hp:90,drag:.025,area:2.6,color:'#889a74',size:[3,.14,1.05]},
  engine:{name:'螺旋桨发动机',mass:190,hp:90,drag:.3,area:.65,powerHp:850,color:'#526365',size:[.8,.8,1.35]},
  gun:{name:'前射机枪',mass:30,hp:35,drag:.12,area:.06,caliber:7.7,damage:5,rate:9,color:'#303b43',size:[.12,.12,1.5]},
  turret:{name:'自卫机枪塔',mass:95,hp:55,drag:.35,area:.3,caliber:7.7,damage:5,rate:7,color:'#46545c',size:[.7,.55,1.1]},
  bomb:{name:'炸弹挂载',mass:120,hp:25,drag:.2,area:.18,damage:10000,penetration:100,blastRadius:12,color:'#665d43',size:[.32,.32,1.15]},
  gear:{name:'固定起落架',mass:65,hp:60,drag:.8,area:.26,color:'#34393b',size:[2.6,.9,.4]}
};
const s=(id,name,position,accept)=>({id,name,position,accept:Object.keys(partKit).filter(type=>accept.includes(partFamily(type)))});
partKit.custom_turret={family:'turret',name:'自制机枪 / 炮塔',mass:100,hp:200,drag:.3,area:.3,caliber:12.7,rate:10,ammo:600,color:'#687a83',size:[1,1,2]};
Object.assign(partKit,historicalParts,navalParts,aircraftOrdnance);
partKit.flap={family:'tail',name:'活动襟翼 / 副翼',mass:18,hp:55,drag:.024,area:.6,aero:true,color:'#869778',size:[1.5,.12,.4]};
for(const [kind,d] of Object.entries(blockKit))partKit['voxel_'+kind]={...d,family:kind==='hull'?'structure':kind==='wing'?'wingRight':kind==='tail'?'tail':kind==='cockpit'?'cockpit':'structure',mass:d.density*.001953125,area:.015625,size:[.125,.125,.125]};
partKit.voxel_core={...partKit.voxel_hull,family:'fuselage'};

export const partFamily=type=>partKit[type]?.family||type;
export function sockets(type){
  const historical=historicalMounts(type);if(historical)return historical.map(m=>({...m,accept:Object.keys(partKit).filter(t=>m.families?.includes(partFamily(t))||m.accept.includes(t))}));
  if(type==='fuselage')return [s('cockpit','驾驶舱',[0,.5,-.8],['cockpit']),s('left','左机翼',[-.55,0,-.35],['wingLeft']),s('right','右机翼',[.55,0,-.35],['wingRight']),s('tail','尾翼',[0,.1,2.65],['tail']),s('nose','机头发动机',[0,0,-3.05],['engine']),s('turret','背部自卫机枪',[0,.58,1],['turret']),s('belly','腹部挂架',[0,-.65,.45],['bomb']),s('gear','起落架',[0,-.4,-.8],['gear'])];
  if(type==='wingLeft'||type==='wingRight'){const side=type==='wingLeft'?-1:1;return [s('engine','翼下发动机',[side*1.5,-.38,-.75],['engine']),s('gun','机枪挂点',[side*2.4,.02,-.65],['gun']),s('payload','炸弹挂架',[side*2.7,-.3,.25],['bomb'])];}
  return [];
}
const uid=()=>crypto.randomUUID().replaceAll('-','');
export function createPart(type,parentId='',socketId=''){return {id:uid(),type,parentId,socketId,color:partKit[type]?.color||'#71896a',scale:1,powerHp:partKit[type]?.powerHp||0,offset:[0,0,0],rotation:[0,0,0]};}
export function aircraftPreset(bomber=false){
  if(typeof bomber==='string'&&historicalSpecs[bomber])return historicalPreset(bomber);
  const root=createPart('fuselage'),parts=[root];
  const add=(type,parent,slot)=>{const p=createPart(type,parent.id,slot);parts.push(p);return p;};
  add('cockpit',root,'cockpit');const left=add('wingLeft',root,'left'),right=add('wingRight',root,'right');add('tail',root,'tail');add('gear',root,'gear');
  if(bomber){add('engine',left,'engine');add('engine',right,'engine');add('turret',root,'turret');add('bomb',root,'belly');add('bomb',left,'payload');add('bomb',right,'payload');}
  else{add('engine',root,'nose');add('gun',left,'gun');add('gun',right,'gun');}
  return {name:bomber?'双发轰炸机':'单发战斗机',parts};
}
export function historicalPreset(kit){
 const root=createPart(kit+'_body'),parts=[root],add=(type,parent,slot)=>{const p=createPart(type,parent.id,slot);parts.push(p);return p;};
 add(kit+'_cockpit',root,'cockpit');const left=add(kit+'_left',root,'left'),right=add(kit+'_right',root,'right');add(kit+'_tail',root,'tail');add(kit+'_gear',root,'gear');
 if(kit==='b25'){add('b25_engine',left,'engine');add('b25_engine',right,'engine');add('b25_cannonnose',root,'nosecover');add('t13',root,'chin');add('browning',root,'mg0');add('browning',root,'mg1');add('browning',root,'cannon0');add('browning',root,'cannon1');add('b25_dorsal',root,'dorsal');add('b25_tailgun',root,'tailgun');add('bomb500',root,'belly');}
 else{add(kit+'_engine',root,'nose');if(kit==='stuka'){add('bk37',left,'gun');add('bk37',right,'gun');add('stuka_rear',root,'dorsal');add('radiator',root,'radiator');}else if(kit==='bf109'){add('mg131',root,'mg0');add('mg131',root,'mg1');add('mg151',root,'chin');add('radiator',left,'cooler');add('radiator',right,'cooler');}else{add('shinden_fin_left',left,'fin');add('shinden_fin_right',right,'fin');for(const slot of ['mg0','mg1','cannon0','cannon1'])add('type5',root,slot);}}
 return {name:historicalSpecs[kit].name,parts};
}
const bounded=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
export const normalizeFireSounds=value=>Object.fromEntries(Object.entries(value||{}).filter(([type,id])=>['gun','turret'].includes(partFamily(type))&&typeof id==='string'));
export function normalizeAircraft(value){
  if(value?.schemaVersion===2&&Array.isArray(value.blocks)){
    const v=normalizeStructure(value),ids=new Set();v.parts=(value.parts||[]).slice(0,64).filter(p=>p&&p.type!=='ship_flag'&&partKit[p.type]&&!p.type.startsWith('voxel_')).map(p=>{let id=String(p.id||uid());if(ids.has(id))id=uid();ids.add(id);return {id,type:p.type,...weaponAttachmentFields(p),...(['gun','turret'].includes(partFamily(p.type))?normalizeWeaponSettings(p,weaponPartDefinition(p,partKit[p.type])):{}),parentId:'',socketId:'',color:/^#[\da-f]{6}$/i.test(p.color)?p.color:partKit[p.type].color,scale:bounded(p.scale,.25,2,1),powerHp:partFamily(p.type)==='engine'?bounded(p.powerHp,50,3000,partKit[p.type].powerHp):0,offset:[0,1,2].map(i=>Math.round(bounded(p.offset?.[i],-32,32,0)/v.gridSize)*v.gridSize),rotation:[0,1,2].map(i=>bounded(p.rotation?.[i],-180,180,0)),mirrorOf:String(p.mirrorOf||''),gearFoldDirection:['forward','backward','inward','outward'].includes(p.gearFoldDirection)?p.gearFoldDirection:'backward'};});v.vehicleId=String(value.vehicleId||'');if(value.fireSounds!==undefined)v.fireSounds=normalizeFireSounds(value.fireSounds);return v;
  }
  if(!value||!Array.isArray(value.parts))return historicalPreset('bf109');
  const ids=new Set();const parts=value.parts.slice(0,48).filter(p=>p&&p.type!=='ship_flag'&&partKit[p.type]).map(p=>{let id=String(p.id||uid());if(ids.has(id))id=uid();ids.add(id);return {id,type:p.type,...weaponAttachmentFields(p),...(['gun','turret'].includes(partFamily(p.type))?normalizeWeaponSettings(p,weaponPartDefinition(p,partKit[p.type])):{}),parentId:String(p.parentId||''),socketId:String(p.socketId||''),color:/^#[\da-f]{6}$/i.test(p.color)?p.color:partKit[p.type].color,scale:bounded(p.scale,.6,1.5,1),powerHp:partFamily(p.type)==='engine'?bounded(p.powerHp,50,3000,partKit[p.type].powerHp):0,offset:[0,1,2].map(i=>bounded(p.offset?.[i],-.3,.3,0)),rotation:[0,1,2].map(i=>bounded(p.rotation?.[i],-15,15,0))};});
  return {name:String(value.name||'自定义飞机').slice(0,80),parts,...(value.fireSounds!==undefined?{fireSounds:normalizeFireSounds(value.fireSounds)}:{}),...(value.vehicleId?{vehicleId:String(value.vehicleId)}:{})};
}
export function validateAircraft(aircraft){
  if(aircraft.schemaVersion===2){const errors=structureErrors(aircraft);if(!aircraft.parts.some(p=>partFamily(p.type)==='engine'))errors.push('缺少发动机螺旋桨装置');return errors;}
  const errors=[],parts=aircraft.parts||[],roots=parts.filter(p=>!p.parentId),byId=new Map(parts.map(p=>[p.id,p])),occupied=new Set();
  if(roots.length!==1||partFamily(roots[0].type)!=='fuselage')errors.push('必须保留一个根机身');
  for(const p of parts){if(!partKit[p.type]){errors.push('未知部件');continue;}if(!p.parentId)continue;const parent=byId.get(p.parentId),socket=sockets(parent?.type).find(s=>s.id===p.socketId);if(!socket?.accept.includes(p.type))errors.push(partKit[p.type].name+'的挂点不兼容');const key=p.parentId+':'+p.socketId;if(occupied.has(key))errors.push('同一挂点不能安装两个组件');occupied.add(key);let cursor=p,seen=new Set();while(cursor?.parentId){if(seen.has(cursor.id)){errors.push('组件连接形成循环');break;}seen.add(cursor.id);cursor=byId.get(cursor.parentId);if(!cursor){errors.push('组件连接断开');break;}}}
  for(const type of ['cockpit','wingLeft','wingRight','tail','engine'])if(!parts.some(p=>partFamily(p.type)===type))errors.push('缺少'+partKit[type].name);
  return [...new Set(errors)];
}
export function normalizeCombat(value={}){return {schemaVersion:1,seaMapId:normalizeSeaMap(value.seaMapId),allyWings:(Array.isArray(value.allyWings)?value.allyWings:[]).slice(0,4).map((w,i)=>({id:String(w.id||'wing-'+i),formation:['v','lineAbreast','singleColumn'].includes(w.formation)?w.formation:'v',altitude:bounded(w.altitude,150,6000,700),aircrafts:(Array.isArray(w.aircrafts)?w.aircrafts:[]).slice(0,7).map(a=>a?normalizeAircraft(a):null)})),fleets:normalizeFleets(value.fleets),ships:normalizeShipDeployments(value.ships),fireSounds:Object.fromEntries(Object.entries(value.fireSounds||{}).filter(([type,id])=>['gun','turret'].includes(partFamily(type))&&typeof id==='string')),dialogues:(Array.isArray(value.dialogues)?value.dialogues:[]).slice(0,200).map((line,i)=>({id:String(line.id||'air-dialogue-'+i),characterId:String(line.characterId||''),speaker:String(line.speaker||''),text:String(line.text||''),voiceId:String(line.voiceId||''),offstage:{motionId:String(line.offstage?.motionId||''),motionOptions:{loop:true,placement:'inPlace',...line.offstage?.motionOptions},expressionWeights:{...line.offstage?.expressionWeights}}})),aircraft:normalizeAircraft(value.aircraft),enemyAircraft:normalizeAircraft(value.enemyAircraft||historicalPreset('bf109')),allyAircraft:normalizeAircraft(value.allyAircraft||historicalPreset('b25')),enemies:Math.round(bounded(value.enemies,0,8,3)),allies:Array.isArray(value.allyWings)&&value.allyWings.length?Math.min(15,value.allyWings.reduce((n,w)=>n+(w.aircrafts||[]).filter(Boolean).length,0)):Math.round(bounded(value.allies,0,15,1)),altitude:bounded(value.altitude,150,1800,600),duration:bounded(value.duration,30,900,180),difficulty:bounded(value.difficulty,.4,1.5,.7),mission:['eliminate','survive','sinkShips','protectShips'].includes(value.mission)?value.mission:'eliminate',wind:bounded(value.wind,-15,15,0),winActId:String(value.winActId||''),loseActId:String(value.loseActId||''),allowSkip:value.allowSkip===true,startOnGround:value.startOnGround===true};}

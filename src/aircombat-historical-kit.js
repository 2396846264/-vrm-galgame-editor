import {caliberDamage} from './weapon-balance.js';
// Editable external silhouettes; historical dimensions are reference data, flight tuning is game data.
export const historicalSpecs={
 stuka:{name:'Ju 87G-2 · 双37mm炮',length:11.5,span:15,bodyWidth:1.1,bodyHeight:1.45,wingSpan:6.95,chord:2.8,sweep:.35,gull:true,cockpitLength:2.7,engineHp:1400,bodyMass:2500,wingMass:450,engineMass:620,color:'#596d50',tailSpan:2.1,tailChord:1.2},
 b25:{name:'B-25H · 75mm炮',length:16.1,span:20.57,bodyWidth:1.75,bodyHeight:2.05,wingSpan:9.48,chord:3.6,sweep:.5,cockpitLength:2.8,engineHp:1700,bodyMass:5200,wingMass:950,engineMass:890,color:'#697452',tailSpan:3.1,tailChord:1.55,doubleTail:true},
 bf109:{name:'Bf 109G-6',length:8.84,span:9.92,bodyWidth:.88,bodyHeight:1.2,wingSpan:4.52,chord:1.95,sweep:.35,cockpitLength:1.55,engineHp:1475,bodyMass:1400,wingMass:240,engineMass:620,color:'#778574',tailSpan:1.25,tailChord:.9},
 shinden:{name:'J7W1 · 震电',length:9.7,span:11.1,bodyWidth:1.25,bodyHeight:1.55,wingSpan:4.97,chord:2.8,sweep:1.45,cockpitLength:1.9,engineHp:2100,bodyMass:2100,wingMass:370,engineMass:880,color:'#385e4e',pusher:true,tailSpan:1.6,tailChord:1.0}
};
const parts={};
const add=(type,family,name,mass,size,extras={})=>{parts[type]={family,name,mass,hp:family==='fuselage'?480:family==='engine'?160:family.startsWith('wing')?190:90,drag:family==='fuselage'?.23:family.startsWith('wing')?.021:.12,area:family.startsWith('wing')?size[0]*size[2]*.75:family==='fuselage'?size[0]*size[1]:.2,color:'#66775b',size,...extras};};
for(const [kit,spec]of Object.entries(historicalSpecs)){
 add(kit+'_body','fuselage',spec.name.split(' · ')[0]+' 机身',spec.bodyMass,[spec.bodyWidth,spec.bodyHeight,spec.length],{kit,shape:'body',color:spec.color,drag:.16});
 add(kit+'_cockpit','cockpit',spec.name.split(' · ')[0]+' 不透明座舱',kit==='b25'?180:80,[spec.bodyWidth,.85,spec.cockpitLength],{kit,shape:'cockpit',color:'#394b55',drag:.12});
 for(const side of [-1,1])add(kit+(side<0?'_left':'_right'),side<0?'wingLeft':'wingRight',(side<0?'左':'右')+(spec.gull?'倒海鸥翼':spec.pusher?'后掠主翼':kit==='b25'?'轰炸机翼':'战斗机翼'),spec.wingMass,[spec.wingSpan,.4,spec.chord+spec.sweep],{kit,shape:'wing',side,area:spec.wingSpan*spec.chord*.72,color:spec.color,center:[side*spec.wingSpan*.44,spec.gull?-.2:0,spec.sweep*.42],aero:true});
 add(kit+'_tail','tail',spec.pusher?'震电前鸭翼组件':spec.doubleTail?'B-25 双垂尾组件':spec.name.split(' · ')[0]+' 尾翼组件',kit==='b25'?370:130,[spec.tailSpan*2,1.6,spec.tailChord],{kit,shape:'tail',color:spec.color,aero:spec.pusher,area:spec.tailSpan*spec.tailChord*1.4,control:true});
 add(kit+'_engine','engine',kit==='stuka'?'Jumo 211 液冷动力':kit==='bf109'?'DB 605 液冷动力':kit==='b25'?'R-2600 星形动力':'震电后置星形动力',spec.engineMass,[kit==='b25'?1.6:spec.bodyWidth,kit==='b25'?1.6:spec.bodyHeight*.8,kit==='b25'?2.45:1.8],{kit,shape:'engine',color:spec.color,powerHp:spec.engineHp,propRadius:kit==='b25'?1.85:kit==='stuka'?1.65:kit==='shinden'?1.65:1.5,blades:kit==='shinden'?6:3,pusher:Boolean(spec.pusher),drag:.15,area:kit==='b25'?1.4:.7});
 add(kit+'_gear','gear',kit==='stuka'?'斯图卡固定轮罩起落架':kit==='shinden'?'震电长腿前三点起落架':kit==='b25'?'B-25 前三点起落架':'Bf109 窄轮距起落架',kit==='b25'?330:130,[kit==='b25'?8:kit==='shinden'?4.8:kit==='stuka'?4:2.3,kit==='shinden'?2.5:1.6,kit==='b25'?6:3],{kit,shape:'gear',drag:kit==='stuka'?.6:.22,area:kit==='stuka'?.8:.35});
}
for(const [type,name,caliber,rate,damage,mass,length]of [
 ['mg17','7.92mm MG17 机枪',7.92,13,9,15,1.15],['mg131','13mm MG131 机枪',13,12,15,25,1.2],['browning','12.7mm Browning 重机枪',12.7,10,14,29,1.45],['mg151','20mm MG151 中轴炮',20,8,24,42,1.75],['mk108','30mm MK108 机炮',30,6,42,58,1.1],['type5','30mm 五式机炮',30,6,42,70,2],['bk37','37mm BK3.7 炮舱',37,2.67,80,340,3.1],['t13','75mm B-25H 机鼻炮',75,.25,180,520,3.2]
])add(type,'gun',name,mass,[type==='bk37'?.55:.18,type==='bk37'?.5:.18,length],{shape:'gun',caliber,rate,damage:caliberDamage(caliber),color:'#404c4d',ammo:caliber>=75?21:caliber>=37?12:caliber>=30?80:caliber>=20?200:500,muzzleSpeed:type==='mk108'?540:type==='type5'?750:type==='mg131'?750:type==='mg151'?805:type==='bk37'?820:type==='t13'?619:850,drag:type==='bk37'?.24:.08});
add('stuka_rear','turret','MG81Z 后座双联枪',50,[.5,.45,1.4],{shape:'turret',kit:'stuka',barrels:2,caliber:7.7,rate:12,damage:5,color:'#414a45',ammo:1000});
add('b25_dorsal','turret','B-25 背部双联枪塔',180,[1.05,.95,1.6],{shape:'turret',kit:'b25',barrels:2,caliber:12.7,rate:10,damage:caliberDamage(12.7),color:'#465650',ammo:1000});
add('b25_tailgun','turret','B-25 尾部双联枪位',95,[.7,.55,1.5],{shape:'turret',kit:'tailgun',barrels:2,caliber:12.7,rate:10,damage:caliberDamage(12.7),color:'#465650',ammo:800});
add('b25_gunnose','cockpit','B-25J 八枪实心机鼻',260,[1.5,1.4,2.2],{shape:'gunnose',kit:'b25',color:'#697452'});
add('b25_cannonnose','cockpit','B-25H 炮机鼻外壳',200,[1.5,1.4,2.2],{shape:'gunnose',kit:'b25',color:'#697452'});
add('shinden_fin_left','tail','震电左翼垂尾',60,[.16,1.45,1.3],{shape:'fin',kit:'shinden',color:'#385e4e'});
add('shinden_fin_right','tail','震电右翼垂尾',60,[.16,1.45,1.3],{shape:'fin',kit:'shinden',color:'#385e4e'});
for(const [type,name,mass,shape,size]of [['radiator','液冷散热器',45,'radiator',[.7,.45,1.1]],['dropTank','副油箱',120,'tank',[.5,.5,1.75]],['bomb250','250kg 炸弹',250,'bomb',[.36,.36,1.55]],['bomb500','500kg 炸弹',500,'bomb',[.48,.48,1.85]]])add(type,type.startsWith('bomb')?'bomb':'accessory',name,mass,size,{shape,color:'#626654',damage:type==='bomb500'?16000:10000,penetration:type==='bomb500'?180:100,blastRadius:type==='bomb500'?15:12});
export const historicalParts=parts;
export function historicalMounts(type){
 const def=parts[type];if(!def)return null;const kit=def.kit,spec=historicalSpecs[kit];
 const mount=(id,name,position,families,types)=>({id,name,position,families,accept:types||[]});
 if(def.family==='fuselage')return [
  mount('cockpit','座舱',[0,spec.bodyHeight*.45,kit==='stuka'?-.25:kit==='b25'?-3.7:kit==='shinden'?-1.4:-.1],['cockpit']),
  mount('left','左主翼',[-spec.bodyWidth*.5,-.2,kit==='shinden'?1.25:kit==='b25'?-.7:-.35],['wingLeft']),mount('right','右主翼',[spec.bodyWidth*.5,-.2,kit==='shinden'?1.25:kit==='b25'?-.7:-.35],['wingRight']),
  mount('tail','尾翼 / 鸭翼',[0,kit==='shinden'?-.04:.25,kit==='shinden'?-3.6:spec.length*.43],['tail']),
  mount('nose','动力',[0,0,kit==='shinden'?spec.length*.35:-spec.length*.38],['engine']),mount('gear','起落架',[0,-spec.bodyHeight*.4,0],['gear']),
  mount('dorsal','背部 / 后座自卫枪',[0,spec.bodyHeight*.55,kit==='stuka'?1.1:kit==='b25'?-1.8:1.5],['turret']),mount('tailgun','尾部自卫枪',[0,0,spec.length*.46],['turret']),
  mount('chin','机鼻炮',[0,-spec.bodyHeight*.2,-spec.length*.35],['gun']),mount('nosecover','可换机鼻',[0,0,-spec.length*.4],['cockpit']),
  ...[-1,1].map((side,i)=>mount('mg'+i,'机鼻机枪',[side*.25,spec.bodyHeight*.32,-spec.length*.32],['gun'])),
  ...[-1,1].map((side,i)=>mount('cannon'+i,'机鼻机炮',[side*.36,-.03,-spec.length*.36],['gun'])),
  mount('belly','炸弹 / 副油箱',[0,-spec.bodyHeight*.65,.4],['bomb','accessory']),mount('radiator','腹部散热器',[0,-spec.bodyHeight*.5,-spec.length*.2],['accessory'])
 ];
 if(def.family.startsWith('wing')){const side=def.side;return [mount('engine','发动机短舱',[side*(kit==='b25'?2.8:1.8),-.1,-.8],['engine']),mount('gun','机枪 / 炮舱',[side*def.size[0]*.4,-.4,-.3],['gun']),mount('payload','炸弹 / 副油箱',[side*def.size[0]*.55,-.45,.35],['bomb','accessory']),mount('cooler','散热器',[side*1.1,-.3,.45],['accessory']),mount('fin','翼上垂尾',[side*def.size[0]*.61,.05,spec.sweep*.6],['tail'])];}
 return [];
}

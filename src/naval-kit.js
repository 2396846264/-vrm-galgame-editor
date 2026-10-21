import {caliberDamage,turretRateLimits} from './weapon-balance.js';
// Values tune the game simulation, rather than reproduce real weapon performance.
export const shipClasses={destroyer:{name:'驱逐舰',cores:5,length:96,beam:12,draft:4,speed:15},lightCruiser:{name:'轻巡洋舰',cores:10,length:140,beam:16,draft:6,speed:14},heavyCruiser:{name:'重巡洋舰',cores:15,length:170,beam:20,draft:6,speed:13},battlecruiser:{name:'战列巡洋舰',cores:20,length:200,beam:26,draft:8,speed:12},battleship:{name:'战列舰',cores:40,length:240,beam:32,draft:8,speed:11},carrier:{name:'航空母舰',cores:40,length:240,beam:32,draft:8,speed:13}};
export const navalBlocks={ship_hull:{name:'船体钢块',category:'hull',color:'#687a83',density:90,hp:800,armor:12,drag:.1},ship_core:{name:'核心区方块（独立计数）',category:'core',color:'#f4c36c',density:110,hp:1000,armor:4,drag:.1},ship_armor50:{name:'50毫米装甲',category:'armor',color:'#707d83',density:140,hp:1500,armor:40,drag:.1},ship_armor100:{name:'100毫米装甲',category:'armor',color:'#67737a',density:190,hp:2400,armor:70,drag:.1},ship_armor200:{name:'200毫米装甲',category:'armor',color:'#56636c',density:260,hp:3600,armor:110,drag:.1},ship_armor400:{name:'400毫米装甲',category:'armor',color:'#46535c',density:380,hp:5000,armor:170,drag:.1},ship_deck:{name:'甲板',category:'hull',color:'#b6a278',density:65,hp:500,armor:10,drag:.1},ship_bridge:{name:'舰桥',category:'decor',color:'#82929a',density:60,hp:600,armor:8,drag:.1}};
const hardware=(name,family,category,size,mass,hp,extras={})=>({name,family,category,size,mass,hp,area:1,drag:.1,color:'#586a75',naval:true,...extras});
const cannon=(name,caliber,rate,damage,range,size,extra={})=>hardware(name,'turret','weapons',size,caliber*65,1000+caliber*3,{caliber,rate:caliber<=25?2.5:rate,damage:caliberDamage(caliber),muzzleSpeed:caliber<=40?800:620,ammo:1200,range:caliber>=100?caliber*100:range,yawRate:caliber>=200?6:caliber>=100?14:55,pitchRate:caliber>=100?12:40,traverseAcceleration:caliber>=100?12:100,ammoType:'auto',surfaceAmmo:caliber>=203?'ap':'he',fuze:caliber>=100?'timed':'impact',burstTime:3,proximityRadius:20,...extra});
export const navalParts={
 ship_flight_deck:hardware('航母飞行甲板（必需）','flightDeck','hull',[32,2,240],120000,20000),
 ship_engine:hardware('舰船动力机组','shipEngine','engine',[4,3,6],30000,500,{powerHp:12000}),
 ship_propeller:hardware('螺旋桨与传动轴','shipPropeller','engine',[3,3,4],8000,200),
 ship_funnel:hardware('烟囱','shipDecor','decor',[4,10,4],3000,100),
 ship_mast:hardware('桅杆','shipDecor','decor',[1,18,1],1000,80),
 ship_radar:hardware('测空雷达','shipDecor','decor',[5,4,2],1600,90),
 ship_flag:hardware('舰旗旗杆','shipDecor','decor',[3,9,1],100,40),
 ship_bridge_module:hardware('舰桥组合件','shipDecor','decor',[8,6,10],8000,200),
 ship_aa20:cannon('20毫米高射炮',20,2.5,24,2200,[2,2,3]),
 ship_aa25:cannon('25毫米双联防空炮',25,5,18,2400,[2,2,3]),
 ship_aa40:cannon('40毫米双联防空炮',40,2.5,35,3500,[3,3,4]),
 ship_aa76:cannon('76毫米高射炮',76,.8,60,5200,[4,4,5],{ammoType:'he',fuze:'timed'}),
 ship_dp127:cannon('127毫米高平两用炮',127,.25,100,6500,[5,5,7],{antiAir:true,dualPurpose:true,fuze:'proximity',yawRate:18,pitchRate:15}),
 ship_main203:cannon('203毫米双联主炮',203,.08,200,7000,[7,5,11],{antiAir:true}),
 ship_main356:cannon('356毫米双联主炮',356,.04,320,7000,[10,7,16],{antiAir:true}),
 ship_main406:cannon('406毫米三联主炮',406,.025,400,40600,[12,8,18],{antiAir:true,yawRate:4,pitchRate:7}),
 ship_main460:cannon('460毫米三联主炮 · 可用三式弹',460,.025,400,7000,[13,8,20],{antiAir:true,ammoType:'auto',fuze:'proximity',yawRate:4,pitchRate:7})
};
navalParts.ship_custom_turret=hardware('自制舰炮（火力编辑器）','turret','weapons',[3,2,6],2000,2000,{caliber:127,rate:.13,ammo:600,range:12700});
export const aircraftOrdnance={aerial_torpedo:{name:'航空鱼雷挂载',family:'bomb',torpedo:true,mass:750,hp:30,drag:.22,area:.35,damage:30000,penetration:450,blastRadius:20,waterSpeed:24,waterRange:5000,color:'#65776f',size:[.45,.45,4.5]},bomb_he250:{name:'250公斤高爆航空炸弹',family:'bomb',mass:250,hp:25,drag:.2,area:.2,damage:10000,penetration:100,blastRadius:12,color:'#6d705b',size:[.4,.4,1.6]},bomb_ap500:{name:'500公斤穿甲航空炸弹',family:'bomb',mass:500,hp:30,drag:.2,area:.25,damage:18000,penetration:600,blastRadius:8,color:'#59656b',size:[.45,.45,2.2]}};

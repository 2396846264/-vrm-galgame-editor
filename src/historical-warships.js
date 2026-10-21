import {createNavalPart,normalizeWarship,navalBlocks} from './warship-schema.js';
import {normalizeFirepower} from './firepower-schema.js';
export const historicalShips={yamato:{name:'大和 · 历史外形样板',length:263,beam:38.9,caliber:460,calibers:45,speed:14.1},southDakota:{name:'南达科他 BB-57 · 历史外形样板',length:207.3,beam:33,caliber:406,calibers:45,speed:13.9}};
const cache=new Map();
export function historicalWarship(key){
 if(!historicalShips[key])throw Error('未知历史舰艇');if(cache.has(key))return structuredClone(cache.get(key));
 const d=historicalShips[key],japanese=key==='yamato',cells=new Map(),gray=japanese?'#65727c':'#70838b',dark='#354651',deck='#b6a080';
 const put=(x,y,z,kind='ship_hull',color=gray,shape='cube',shapeRotation=[0,0,0])=>cells.set([x,y,z].join(),{cell:[x,y,z],kind,color,shape,shapeRotation});
 const volume=(x0,x1,y0,y1,z0,z1,kind,color)=>{for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)put(x,y,z,kind,color);};
 const half=Math.round(d.length/4),beam=Math.round(d.beam/4);
 // Closed hull shell, bulging midsection, fine bow and rounded stern. All pieces stay editable.
 for(let z=-half;z<=half;z++){
  const q=z/half,width=Math.max(0,Math.round(beam*Math.sqrt(Math.max(0,1-Math.abs(q)**(q<0?2.2:3)))));
  for(let y=-4;y<=2;y++){const w=Math.max(0,width-(y<-2?1:0));for(let x=0;x<=w;x++)if(y===2||y===-4||x===w||Math.abs(z)===half||z===0){
   const atEdge=x===w&&x>0&&y===2;put(x,y,z,y===2?'ship_deck':'ship_hull',y<-1?'#793b3d':y===-1?dark:y===2?deck:gray,atEdge?'wedge':'cube',atEdge?[0,-90,0]:[0,0,0]);
  }}
 }
 // Forty protected cores, connected bulkheads and armoured belt.
 volume(0,2,-2,0,-21,20,'ship_armor200',gray);for(let z=-20;z<20;z++)put(0,-1,z,'ship_core',navalBlocks.ship_core.color);
 const parts=[],add=(type,offset,rotation=0,scale=1)=>{const p=createNavalPart(type,offset);p.rotation[1]=rotation;p.scale=scale;p.color=gray;parts.push(p);return p;};
 for(const x of [-6,6]){add('ship_engine',[x,-4,48]);add('ship_propeller',[x,-6,(half-2)*2]);}
 // Stepped citadel and walkways, followed by a high pagoda or compact American tower.
 volume(0,Math.floor(beam*.52),3,3,-16,19,'ship_deck',gray);
 volume(0,Math.floor(beam*.38),4,5,-11,12,'ship_bridge',gray);
 const bridgeZ=japanese?-18:-14;
 for(let level=0;level<(japanese?6:4);level++){
  const y=6+level*2,w=Math.max(1,4-Math.floor(level/2)),depth=Math.max(1,3-Math.floor(level/3)),z=bridgeZ/2;
  volume(0,w,y,y,z-depth,z+depth,'ship_bridge',level%2?dark:gray);
  volume(0,w+1,y+1,y+1,z-depth,z+depth,'ship_deck',gray);
  for(let dz=-depth;dz<=depth;dz++)put(w+1,y+1,z+dz,'ship_deck',gray,'wedge',[0,-90,0]);
 }
 add('ship_mast',[0,japanese?38:30,bridgeZ+2],0,.85);add('ship_radar',[0,japanese?44:38,bridgeZ+2],0,japanese?.7:.9);
 add('ship_funnel',[0,18,10],0,japanese?1.35:1.1);
 if(!japanese)add('ship_funnel',[0,16,24],0,.8);
 add('ship_mast',[0,26,36],0,.75);add('ship_radar',[0,34,36],0,.6);
 // Horizontal optical rangefinders, platforms and rear director tower.
 volume(0,3,4,9,15,19,'ship_bridge',gray);for(const z of [bridgeZ/2,17])volume(0,5,z===17?10:(japanese?18:14),z===17?10:(japanese?18:14),z,z,'ship_bridge',dark);
 const turretBlocks=[];for(let x=-3;x<=3;x++)for(let y=0;y<=2;y++)for(let z=-2;z<=3;z++){
  if(Math.abs(x)===3&&z===-2)continue;
  turretBlocks.push({cell:[x,y,z],color:y===2?'#87939a':gray,shape:(Math.abs(x)===3||y===2&&(z===-2||z===3))?'wedge':'cube',shapeRotation:Math.abs(x)===3?[0,x>0?-90:90,0]:z===3?[0,180,0]:[0,0,0]});
 }
 const gun=normalizeFirepower({name:d.caliber+'毫米三联主炮',gridSize:japanese?2:1.75,blocks:turretBlocks,caliber:d.caliber,calibers:d.calibers,pivot:[0,3,-4],barrels:[-1,0,1].map(i=>({offset:[i*3.2,0,0]})),rpm:japanese?1.8:2,ammoType:'ap',maxPitch:45,ammo:900});
 for(const [z,y,angle] of [[-d.length*.32,6,0],[-d.length*.20,10,0],[d.length*.28,6,180]]){
  const zz=Math.round(z/2)*2;
  // Barbette is part of the editable structure, integrated with deck.
  for(let x=0;x<=3;x++)for(let dz=-3;dz<=3;dz++)if(x*x+dz*dz<=12)for(let yy=3;yy<y/2;yy++)put(x,yy,zz/2+dz,'ship_armor200',gray);
  const p=add('ship_custom_turret',[0,y,zz],angle);p.firepower=structuredClone(gun);p.firepowerId='';
 }
 for(const z of [-8,8,24,40])for(const x of [-1,1])add('ship_dp127',[x*(beam-2)*2,8,z],x<0?-90:90,japanese?.9:1);
 for(const z of [-68,-40,48,68])for(const x of [-1,1])add(japanese?'ship_aa25':'ship_aa40',[x*Math.max(6,(beam-3)*2),6,z],x<0?-90:90,.85);
 add('ship_flag',[0,12,(half-4)*2]);
 // Painted deck paths and hull waterline. BB-57's digits are deliberately author-editable pixels.
 for(let z=25;z<half-7;z++){put(0,2,z,'ship_deck',dark);if(z%4<2)put(1,2,z,'ship_deck','#d9d4bc');}
 if(!japanese){const digits=['111101111001111','111001001001001'];for(let n=0;n<2;n++)for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(digits[n][row*3+col]==='1')put(5,7-row,-10+n*4+col,'ship_bridge','#ece8da');}
 const v=normalizeWarship({schemaVersion:2,vehicleType:'warship',shipClass:'battleship',name:d.name,gridSize:2,blocks:[...cells.values()],parts,cruiseSpeed:d.speed});cache.set(key,v);return structuredClone(v);
}

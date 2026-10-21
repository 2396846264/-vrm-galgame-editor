import * as T from 'three';
import {expandedBlocks} from './vehicle-structure.js';
import {navalParts} from './naval-kit.js';
export const flightDeckSize=p=>[p.deckWidth??32,2,p.deckLength??240];
export function deckClearance(p){const [w,h,l]=flightDeckSize(p),[x,y,z]=p.offset;return new T.Box3(new T.Vector3(x-w/2,y+h/2+.01,z-l/2-120),new T.Vector3(x+w/2,y+h/2+30,z+l/2+120));}
export function carrierDeckErrors(v){
 const decks=v.parts.filter(p=>p.type==='ship_flight_deck');
 if(v.shipClass!=='carrier')return decks.length?['飞行甲板仅可安装于航空母舰']:[];
 if(decks.length!==1)return ['航空母舰必须安装且只能安装一块飞行甲板，未安装不能保存'];
 const p=decks[0],errors=[];if(!Number.isFinite(p.deckLength)||p.deckLength<170||p.deckLength>350||!Number.isFinite(p.deckWidth)||p.deckWidth<27||p.deckWidth>45)errors.push('飞行甲板长度须为 170–350 米，宽度须为 27–45 米');
 const zone=deckClearance(p),g=v.gridSize||2,overlap=b=>b.min.x<zone.max.x-.01&&b.max.x>zone.min.x+.01&&b.min.y<zone.max.y&&b.max.y>zone.min.y&&b.min.z<zone.max.z-.01&&b.max.z>zone.min.z+.01;
 if(expandedBlocks(v).some(b=>{const c=new T.Vector3(...b.cell).multiplyScalar(g);return overlap(new T.Box3(c.clone().addScalar(-g/2),c.clone().addScalar(g/2)));}))errors.push('起降净空区内不得放置方块（甲板上方 30 米、跑道前后各延伸 120 米）');
 if(v.parts.some(a=>{if(a===p)return false;const size=navalParts[a.type]?.size;if(!size)return false;const box=new T.Box3(new T.Vector3(...size).multiplyScalar(-a.scale/2),new T.Vector3(...size).multiplyScalar(a.scale/2)),m=new T.Matrix4().compose(new T.Vector3(...a.offset),new T.Quaternion().setFromEuler(new T.Euler(...a.rotation.map(T.MathUtils.degToRad))),new T.Vector3(1,1,1));return overlap(box.applyMatrix4(m));}))errors.push('起降净空区内不得安装舰岛、火炮或其他附件');
 return errors;
}

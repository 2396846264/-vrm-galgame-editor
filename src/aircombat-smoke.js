import {partFamily} from './aircombat-schema.js';
import * as THREE from 'three';
import {aircraftPreset,validateAircraft} from './aircombat-schema.js';
import {damagePart} from './aircombat-physics.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function airCombatSmoke(phase,ctx){
 const assert=(value,message)=>{if(!value)throw Error(message);};
 const p=ctx.project();
 if(phase==='setup'){
  await ctx.setup();assert(document.querySelector('[data-action="event-add-aircombat"]'),'幕列表没有空战入口');await ctx.add();await wait(500);assert(document.querySelector('.air-task-editor'),'空战任务面板没有显示');assert(!document.querySelector('[data-air-part]'),'主窗口仍包含组件编辑');assert(document.querySelector('.air-canvas'),'飞机预览没有显示');return{ok:true,realEditor:true,separateAssemblyEntry:true,diagnostics:ctx.diagnostics()};
 }
 const node=p.acts.find(a=>a.event?.type==='aircombat');assert(node,'空战幕不存在');
 if(phase==='verify-separate'){assert(node.event.combat.aircraft.schemaVersion===2,'方块载具没有同步');assert(node.event.combat.aircraft.name==='方块载具验证','单文件保存没有同步');assert(!document.querySelector('[data-air-part]'),'组装属性留在主界面');return{ok:true,independentAssemblyApplied:true,mainOnlyTaskSettings:true};}
 if(phase==='player-start'){await ctx.play(node.id);await wait(600);assert(document.querySelector('.player .aircombat'),'导出游戏不能进入空战');assert(ctx.diagnostics().units[0].power===1400,'导出飞机参数丢失');return{ok:true,exportedPlayerWorks:true,diagnostics:ctx.diagnostics()};}
 if(phase==='player-menu'){ctx.openSave();await wait(200);const modal=document.querySelector('#player-modal'),air=document.querySelector('.aircombat');assert(modal,'存档菜单未打开');assert(Number(getComputedStyle(modal).zIndex)>Number(getComputedStyle(air).zIndex),'存档菜单被空战遮住');const elapsed=ctx.diagnostics().elapsed;await wait(250);assert(Math.abs(ctx.diagnostics().elapsed-elapsed)<.04,'存档时战斗未暂停');return{ok:true,saveMenuAboveCombat:true,menuPausesPhysics:true};}
 if(phase==='player-save'){const snapshot=ctx.snapshot();await ctx.store(snapshot);assert(ctx.saved()?.thumbnail?.startsWith('data:image/jpeg;base64,'),'空战存档截图缺失');await ctx.load(ctx.saved());await wait(500);assert(ctx.diagnostics().elapsed<2,'导出游戏读档没有重开任务');return{ok:true,realSaveThumbnail:true,exportedCheckpointWorks:true};}
 if(phase==='bomber'){await ctx.action('event-air-preset',{dataset:{preset:'bomber'}});await wait(400);assert(node.event.combat.aircraft.parts.filter(x=>x.type==='engine').length===2,'双发模板错误');assert(node.event.combat.aircraft.parts.some(x=>x.type==='turret'),'没有自卫机枪');assert(validateAircraft(node.event.combat.aircraft).length===0,'组件连接错误');document.querySelector('[data-air-run="expand"]').click();await wait(300);assert(document.querySelector('.air-expanded'),'拼装视图不能放大');return{ok:true,diagnostics:ctx.diagnostics()};}
 if(phase==='edit'){
  const cockpit=node.event.combat.aircraft.parts.find(x=>x.type==='cockpit');const select=document.querySelector('[data-air-select]');select.value=cockpit.id;select.dispatchEvent(new Event('input',{bubbles:true}));await wait(250);const color=document.querySelector('[data-air-part="color"]');color.value='#352f46';color.dispatchEvent(new Event('input',{bubbles:true}));await wait(250);assert(node.event.combat.aircraft.parts.find(x=>x.id===cockpit.id).color==='#352f46','颜色没有保存');const snapshot=JSON.stringify(node.event.combat);await ctx.undo(-1);assert(JSON.stringify(ctx.project().acts.find(a=>a.id===node.id).event.combat)!==snapshot,'组件颜色不能撤销');await ctx.undo(1);await wait(350);assert(JSON.stringify(ctx.project().acts.find(a=>a.id===node.id).event.combat)===snapshot,'组件颜色不能重做');return{ok:true,colorUndoRedo:true};
 }
 if(phase==='flight'){
  const active=ctx.project().acts.find(a=>a.id===node.id);active.event.combat.enemies=2;active.event.combat.allies=1;const s=ctx.test(active);window.__airSmokeRuntime=s;
  const player=s.units[0];const enemy=s.units.find(u=>u.team==='enemy');enemy.flight.position.copy(player.flight.position).add(new THREE.Vector3(0,8,220));enemy.flight.rotation.copy(player.flight.rotation);enemy.flight.velocity.copy(player.flight.velocity);await wait(3500);const d=ctx.diagnostics();assert(d.units.length===4,'友军敌军数量错误');assert(d.elapsed>1,'物理循环没有运行');assert(d.shots>0,'自卫机枪或 AI 没有开火');assert(d.units[0].alive,'玩家过早坠毁');assert(d.units.every(u=>u.position.every(Number.isFinite)),'飞机位置异常');return{ok:true,aiAndTurret:true,diagnostics:d};
 }
 if(phase==='pause'){const button=document.querySelector('[data-air-run="pause"]');button.click();const before=ctx.diagnostics().elapsed;await wait(450);assert(Math.abs(ctx.diagnostics().elapsed-before)<.03,'暂停后战斗继续');button.click();await wait(200);assert(ctx.diagnostics().elapsed>before,'继续后没有恢复');return{ok:true,pauseFreezesPhysics:true};}
 if(phase==='checkpoint'){
  await ctx.play(node.id);await wait(600);const snapshot=ctx.snapshot();assert(snapshot?.actId===node.id,'空战检查点未保存幕 ID');await ctx.load(snapshot);await wait(600);assert(ctx.diagnostics()?.type==='aircombat','读档后空战没有重建');assert(ctx.diagnostics().elapsed<2,'读档没有重置任务');return{ok:true,checkpointRestartsMission:true};
 }
 if(phase==='endings'){
  const active=ctx.project().acts.find(a=>a.id===node.id);active.event.combat.winActId='air-win';active.event.combat.loseActId='air-lose';await ctx.play(node.id);await wait(400);const s=window.__airSmokeRuntime;for(const u of s.units.filter(u=>u.team==='enemy'))damagePart(u.flight,u.flight.spec.parts.find(p=>partFamily(p.type)==='fuselage').id,999999);await wait(250);assert(ctx.diagnostics().result==='win','胜利未结算');document.querySelector('[data-air-run="continue"]').click();await wait(400);assert(ctx.currentId()==='air-win','胜利没有跳到指定幕');assert(!document.querySelector('.aircombat'),'空战资源或覆盖层未退出');await ctx.play(node.id);await wait(400);const failed=window.__airSmokeRuntime.units[0].flight;damagePart(failed,failed.spec.parts.find(p=>partFamily(p.type)==='fuselage').id,999999);await wait(250);assert(ctx.diagnostics().result==='lose','失败未结算');document.querySelector('[data-air-run="continue"]').click();await wait(400);assert(ctx.currentId()==='air-lose','失败没有跳到指定幕');return{ok:true,winAndLoseBranches:true,cleanExit:true};
 }
 if(phase==='export'){await ctx.saveExport();return{ok:true,savedAndExported:true};}
 throw Error('Unknown aircombat phase '+phase);
}

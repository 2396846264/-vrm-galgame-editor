import * as THREE from 'three';
import {newRenderPreset} from '../render-presets.js';

// Legacy regression scenarios. Mutable test access is supplied explicitly by the host.
export function install(host) {
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeWalkAudit=async()=>{
 host.activePanel='story';host.selectedAct=0;host.selectedStep=1;host.renderSidebar();host.renderInspector();await host.updatePreview();await new Promise(r=>setTimeout(r,1500));
 host.stage.running=false;cancelAnimationFrame(host.stage.frame);const records=[];
 for(const record of host.stage.visibleRecords.values()){
  const hips=record.vrm.humanoid.getNormalizedBoneNode('hips'),clip=record.currentAction.getClip(),positions=[];
  for(let frame=0;frame<240;frame++){host.stage.restoreFootPose(record);record.mixer.update(1/60);host.stage.applyMotionPlacement(record);host.stage.applyFootLock(record);record.vrm.update(1/60);host.stage.applyRawFootLock(record);record.anchor.updateMatrixWorld(true);positions.push({time:record.currentAction.time,hips:hips.position.toArray(),world:hips.getWorldPosition(new THREE.Vector3()).toArray(),foot:record.vrm.humanoid.getRawBoneNode?.('leftFoot')?.getWorldPosition(new THREE.Vector3()).toArray()||null});}
  records.push({fbx:Boolean(record.vrm.isFbx),clip:clip.name,duration:clip.duration,options:record.currentMotionOptions,locked:Boolean(record.footLock),tracks:clip.tracks.filter(t=>t.name.endsWith('.position')).map(t=>({name:t.name,times:Array.from(t.times),values:Array.from(t.values)})),positions});
 }
 return {ok:true,records};
};

if(new URLSearchParams(location.search).has('smoke')){
 window.__vrmSmokeWalkVideoSetup=async()=>{
  host.activePanel='story';host.selectedAct=0;host.selectedStep=1;
  for(const slot of ['left','center']){const actor=host.step().cast[slot];if(actor?.characterId){actor.motionId='walk-test';actor.motionOptions={loop:true,placement:'inPlace'};}}
  host.renderSidebar();host.renderInspector();await host.updatePreview();await new Promise(r=>setTimeout(r,800));host.stage.running=false;cancelAnimationFrame(host.stage.frame);
  for(const record of host.stage.visibleRecords.values()){record.mixer.setTime(0);record.motionLoops=0;}
 };
 window.__vrmSmokeWalkVideoFrame=()=>{
  for(const record of host.stage.visibleRecords.values()){record.mixer.update(1/30);host.stage.updateTransitions(record,1/30);host.stage.applyMotionPlacement(record);record.vrm.update(1/30);record.anchor.updateMatrixWorld(true);host.stage.characterProps.update(record);}
  host.stage.updateShadowGround();host.stage.renderScene(1/30);
  return host.stage.renderer.domElement.toDataURL('image/png');
 };
}

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeCloseEdit=async(text)=>{
  if(text===null){await host.save();return;}
  host.project.acts[0].steps[0].text=text;host.markDirty({label:'关闭提醒验证'});
};

if(new URLSearchParams(location.search).has('smoke')){
 window.__vrmSmokeOpenModule=module=>host.openEditorModule(module);
 window.__vrmSmokeModuleLateEdit=()=>{host.project.characters[0].name='关闭时保存角色';host.markDirty();host.renderInspector();return {ok:true};};
 window.__vrmSmokeModuleUndoRedo=async()=>{await host.restoreEditorHistory(-1);if(host.project.characters[0].name!=='独立角色窗口验证'||host.project.acts[host.selectedAct].steps[0].text!=='主窗口在独立窗口打开之后修改的对白')throw Error('独立窗口撤销影响了主窗口对白');await host.restoreEditorHistory(1);if(host.project.characters[0].name!=='独立角色窗口连续保存')throw Error('独立窗口重做失败');return {ok:true};};
 window.__vrmSmokeModuleChange=async(second=false)=>{
  if(host.modulePanel==='characters')host.project.characters[0].name=second?'独立角色窗口连续保存':'独立角色窗口验证';
  if(host.modulePanel==='items')host.project.items.push({id:'module-item-test',name:'独立物品窗口验证',description:'这是一件用来检查独立窗口保存的示例物品。',imageId:''});
  if(host.modulePanel==='title')host.project.title.actors[0].yaw=23;
  if(host.modulePanel==='render'){if(!host.editedRenderPreset()){const entry=newRenderPreset(host.uid(),'窗口测试预设');host.project.renderPresets.push(entry);host.selectedRenderPresetId=entry.id;}host.editedRenderPreset().settings.brightness=123;}
  if(host.modulePanel!=='knowledge'){host.markDirty();host.renderSidebar();host.renderInspector();await host.updatePreview();}
  return {ok:true,module:host.modulePanel,dirty: host.dirty,activePanel: host.activePanel};
 };
 window.__vrmSmokeWorkspace=async phase=>{
  const assert=(test,message)=>{if(!test)throw Error(message);};
  if(phase==='layout'){
   host.selectedAct=0;host.selectedStep=0;const first=structuredClone(host.act().steps[0]);host.act().steps=Array.from({length:140},(_,i)=>({...structuredClone(first),id:'layout-line-'+i,text:'这是第一幕第 '+(i+1)+' 句对白，用来检查大量对白时的幕切换。'}));
   host.markDirty();host.renderSidebar();host.renderInspector();await host.updatePreview();
   assert(document.querySelectorAll('.act-list [data-action=select-act]').length===host.project.acts.length,'幕列表数量错误');
   assert(document.querySelectorAll('.dialogue-column [data-action=select-step]').length===140,'对白没放右边');
   assert(!document.querySelector('.story-left .sidebar [data-action=select-step]'),'幕列表仍夹着对白');
   document.querySelector('[data-action=select-act][data-index="1"]').click();await new Promise(r=>setTimeout(r,250));
   assert(document.querySelectorAll('.dialogue-column [data-action=select-step]').length===host.act().steps.length,'混入其他幕对白');
   assert(document.querySelector('.dialogue-column').textContent.includes(host.act().name),'当前幕标识不正确');
   const fields=document.querySelector('.story-left .inspector [data-field="step.text"]');assert(fields&&fields.value===host.step().text,'左上不是当前对白编辑区');
   assert(getComputedStyle(document.querySelector('.act-list .selected')).animationName==='story-selection-glow','没有当前幕光圈');
   return {ok:true,actsSeparate:true,currentActOnly:true,leftInspector:true,selectionGlow:true,manyDialogues:140};
  }
  if(phase==='concurrent'){host.step().text='主窗口在独立窗口打开之后修改的对白';host.markDirty();host.renderSidebar();host.renderInspector();return {ok:true};}
  if(phase==='verify'){assert(host.project.characters[0].name==='独立角色窗口连续保存','角色修改没合并');assert(host.step().text==='主窗口在独立窗口打开之后修改的对白','主窗口对白被覆盖');assert(host.project.items.some(i=>i.id==='module-item-test'),'物品修改没有保存');assert(host.project.title.actors[0].yaw===23,'标题修改没有保存');assert(host.editedRenderPreset()?.settings.brightness===123,'渲染修改没有保存');return {ok:true,mainDialoguePreserved:true,moduleChangesSaved:true};}
 };
}
}

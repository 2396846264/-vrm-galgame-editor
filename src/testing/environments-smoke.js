import {createEnvironment} from '../environment-schema.js';

// Legacy regression scenarios. Mutable test access is supplied explicitly by the host.
export function install(host) {
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeSceneAnimations=async phase=>{
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const click=selector=>{const el=document.querySelector(selector);assert(el,`missing ${selector}`);el.click();};
  const field=(row,key,value)=>{const el=document.querySelector(`[data-scene-row="${row}"] [data-scene-field="${key}"]`);assert(el,'missing modal field');if(el.type==='checkbox')el.checked=value;else el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));};
  const barrel=id=>host.stage.environmentRuntime.objects.get(id)?.getObjectByName('Barrel');
  if(phase==='editor'){
    host.activePanel='story';host.selectedAct=1;host.selectedStep=0;host.renderSidebar();host.renderInspector();await host.updatePreview();
    assert(!document.querySelector('[data-action="edit-scene-animations"]'),'static scene must hide button');
    host.selectedAct=0;host.renderSidebar();host.renderInspector();await host.updatePreview();
    assert(host.sceneAnimationCatalog().length===2,'detect both animated instances');assert(host.sceneAnimationCatalog()[0].clips.length===2,'detect two clips');
    host.editorHistory.reset();const before=JSON.stringify(host.step().sceneAnimations);
    click('[data-action="edit-scene-animations"]');field(0,'delaySeconds',2);click('[data-scene-preview]');
    for(let i=0;i<100&&!host.stage.environmentRuntime.animations.pending.length;i++)await wait(50);
    assert(host.stage.environmentRuntime.animations.pending[0].delaySeconds===2,'trial uses draft delay');
    click('[data-scene-close]');assert(JSON.stringify(host.step().sceneAnimations)===before,'cancel changed project');assert(host.stage.environmentRuntime.animations.sounds.length===0,'cancel trial sound');
    click('[data-action="edit-scene-animations"]');field(0,'enabled',true);field(0,'delaySeconds',1);field(0,'soundId','boom');field(1,'enabled',false);click('[data-scene-save]');
    assert(host.step().sceneAnimations[0].delaySeconds===1&&host.step().sceneAnimations[0].soundId==='boom','save selected settings');
    assert(host.step().sceneAnimations.length===2&&!host.step().sceneAnimations[1].enabled,'retain disabled object');
    await host.restoreEditorHistory(-1);assert(JSON.stringify(host.step().sceneAnimations)===before,'undo settings');await host.restoreEditorHistory(1);assert(host.step().sceneAnimations.length===2,'redo settings');
    click('[data-action="duplicate-step"]');assert(JSON.stringify(host.step().sceneAnimations)===JSON.stringify(host.act().steps[0].sceneAnimations),'duplicate settings');await host.restoreEditorHistory(-1);
    host.selectedAct=0;host.selectedStep=0;host.renderSidebar();host.renderInspector();await host.updatePreview();click('[data-action="edit-scene-animations"]');
    return {ok:true,phase,staticButtonHidden:true,animatedInstances:2,clips:host.sceneAnimationCatalog()[0].clips,modalCancel:true,saveUndoRedo:true,duplicate:true,cues:host.step().sceneAnimations};
  }
  if(phase==='archive-export'){
    host.sceneAnimationDialog.close(false);host.stage.environmentRuntime.animations.stop();await host.save();
    const archive=await host.bridge('saveProjectAs',{project:structuredClone(host.project),name:'GLB动画开火示例'});
    const game=await host.bridge('exportGame',{folderName:'直接试玩'});return {ok:true,phase,archive,game};
  }
  if(phase==='reopen'){
    host.activePanel='story';host.selectedAct=0;host.selectedStep=0;host.renderSidebar();host.renderInspector();await host.updatePreview();
    assert(host.sceneAnimationCatalog().length===2,'archive clips');assert(host.step().sceneAnimations[0].soundId==='boom'&&host.step().sceneAnimations[0].delaySeconds===1,'archive settings');
    click('[data-action="edit-scene-animations"]');return {ok:true,phase,cues:host.step().sceneAnimations,catalog:host.sceneAnimationCatalog()};
  }
  host.sceneAnimationDialog.close(false);host.playing=true;host.playAct=0;host.playStep=0;host.preparedAct=-1;await host.showPlayStep();
  const player=host.stage.environmentRuntime.animations;
  assert(player.pending.length===1,'start pending cue');await wait(350);assert(player.active.length===0&&player.sounds.length===0,'no early motion or sound');
  const elapsed=player.pending[0].elapsed;host.saveModalMode='settings';await wait(400);assert(Math.abs(player.pending[0].elapsed-elapsed)<.15,'player menu must pause delay');host.saveModalMode='';
  let reached=false;for(let i=0;i<80;i++){await wait(25);if(player.active.length){reached=true;break;}}assert(reached,'delayed animation never starts');assert(player.sounds.length===1,'sound did not start with animation');
  await wait(120);assert(barrel('cannon-left').position.z>.1,'actual barrel recoil missing');assert(barrel('cannon-right').position.z===0,'second instance moved incorrectly');
  const effect=[...host.activeEffects].find(sound=>sound.src.includes('boom.wav'));assert(effect&&!effect.paused&&effect.currentTime>0,'actual audio did not play: '+JSON.stringify({error:window.__lastEffectError,effects:[...host.activeEffects].map(s=>({src:s.src,time:s.currentTime,paused:s.paused,ended:s.ended,state:s.readyState,error:s.error?.code}))}));
  const audioTime=effect.currentTime,recoil=barrel('cannon-left').position.z;host.saveModalMode='settings';await wait(250);
  assert(effect.paused&&Math.abs(effect.currentTime-audioTime)<.1,'menu must pause actual audio');assert(Math.abs(barrel('cannon-left').position.z-recoil)<.04,'menu must pause animated model');host.saveModalMode='';await wait(60);
  const initialSounds=player.sounds.length;host.playStep=1;await host.showPlayStep();assert(player.sounds.length===0&&player.active.length===0,'next line cancellation');assert(barrel('cannon-left').position.z===0,'next line restores pose');
  host.playStep=0;await host.showPlayStep();await wait(150);host.playStep=1;await host.showPlayStep();await wait(1200);assert(player.sounds.length===0&&player.active.length===0,'late fire leaked into next line');
  host.playStep=2;await host.showPlayStep();await wait(250);const turret=host.stage.environmentRuntime.objects.get('cannon-right').getObjectByName('Turret');assert(Math.abs(turret.quaternion.y)>.02,'second clip not playing');assert(player.sounds.length===0,'silent clip played sound');
  host.playAct=1;host.playStep=0;await host.showPlayStep();assert(host.stage.environmentRuntime.animations.catalog().length===0,'switch static scene clips');
  host.playAct=0;host.playStep=0;await host.showPlayStep();for(let i=0;i<80;i++){await wait(25);if(host.stage.environmentRuntime.animations.active.length)break;}await wait(100);
  return {ok:true,phase,delayedStart:true,menuPause:true,actualAudioPlayed:true,actualAudioPaused:true,synchronizedSound:initialSounds===1,barrelRecoil:barrel('cannon-left').position.z,independentInstances:true,nextLineCancellation:true,lateSoundCancelled:true,secondClip:true,staticSceneSwitch:true,exported:host.mode==='player'};
};

if(new URLSearchParams(location.search).has('smoke')) {
 window.__vrmSmokeEnvironmentOpen=async()=>{
   const owner=host.act();owner.environmentId=host.project.environments[0]?.id;
   owner.steps[0].text='环境保存期间保留的对白';
   await host.editEnvironment(owner);return {opened:true,id:owner.environmentId};
 };
 window.__vrmSmokeEnvironmentCheck=async()=>{
   await host.updatePreview();const env=host.project.environments.find(e=>e.id===host.act().environmentId);
   if(env.name!=='窗口保存验证'||env.nodes.length<2||env.revision!==1||host.act().steps[0].text!=='环境保存期间保留的对白'||host.stage.element.style.visibility!=='visible')throw Error('环境保存或风景显示验证失败');
   host.activePanel='characters';host.selectedCharacter=0;host.renderInspector();
   if(host.isFbxModel(host.project.characters[0]?.modelId)&&document.querySelector('[data-field="character.autoMouth"]'))throw Error('FBX 嘴型选项仍显示');
   const actor=host.project.characters[0];const record=await host.stage.loadModel(host.asset(actor?.modelId),actor?.id);
   const motion=host.project.assets.find(a=>a.type==='motion'&&a.id==='fbx-motion');if(motion){const clip=await host.stage.prepareClip(host.asset(actor.modelId),motion,actor.id);if(!clip?.tracks.length)throw Error('FBX 动作没有成功对应');await host.stage.show(host.asset(actor.modelId),motion,{},'center',{},actor.id);}
   await new Promise(resolve=>setTimeout(resolve,1500));
   if(host.stageError)throw Error(host.stageError);let meshes=0,loadedMaps=0;record.vrm.scene.traverse(o=>{if(o.isSkinnedMesh)meshes++;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.map?.image?.width>0)loadedMaps++;});if(!meshes||!loadedMaps)throw Error('FBX 人物或贴图未显示');
   return {ok:true,revision:env.revision,nodeCount:env.nodes.length,canvasVisible:host.stage.element.style.visibility,dialoguePreserved:true,fbxMouthHidden:true,fbxSkinnedMeshes:meshes,loadedTextureMaps:loadedMaps,mixamoMotionTracks:host.stage.activeRecord.currentAction.getClip().tracks.length};
 };
}

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeGeometry52=async phase=>{
 const {geometry52Plan,geometry52GardenPlan,verifyStoryButtons}=await import('../geometry52-smoke.js');
 if(phase==='ui'){host.selectedAct=0;host.selectedStep=0;host.activePanel='story';host.renderSidebar();host.renderInspector();return verifyStoryButtons();}
 if(phase==='plan')return{ok:true,...geometry52Plan()};if(phase==='plan-garden')return{ok:true,...geometry52GardenPlan()};
 if(phase==='vehicle'){await host.openEditorModule('aircraft');return{ok:true};}
 if(phase==='stage'||phase==='reopen'){
  const assert=(v,m)=>{if(!v)throw Error(m);};host.selectedAct=0;host.selectedStep=0;host.activePanel='story';host.renderSidebar();host.renderInspector();await host.updatePreview();await new Promise(r=>setTimeout(r,600));const e=host.project.environments.find(e=>e.id===host.project.acts[0].environmentId),batch=e?.nodes.find(n=>n.kind==='geometryBatch');assert(batch&&batch.primitives.length>15000,'几何体工程丢失');const garden=host.project.environments.find(e=>e.name==='Agent花园住宅');assert(garden?.nodes.some(n=>n.kind==='geometryBatch'&&n.primitives.length>6000),'庭院工程丢失');const meshes=[];host.stage.environmentRuntime.root.traverse(o=>{if(o.isInstancedMesh)meshes.push(o);});assert(meshes.length===9&&meshes.reduce((n,m)=>n+m.count,0)===batch.primitives.length,'批量渲染几何体丢失');assert(!host.stage.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'场景shader错误');return{ok:true,geometryCount:batch.primitives.length,instancedGroups:meshes.length,assetsNeeded:false,archiveReopened:phase==='reopen'};
 }
 throw Error(phase);
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmWater86Open=async(reopen=false)=>{
 const env=reopen?host.project.environments.find(e=>e.nodes.some(n=>n.waterType==='fountain')):createEnvironment('OceanThreejs 与局部水体检查');if(!reopen)host.project.environments.push(env);
 await host.openAgentEnvironment(env);return{ok:true};
};
}

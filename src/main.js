import {assetsOfType,syncAssetOrganization,motionsForCharacter,motionFolderId,commonMotionFolderId,setAudioKind,copyCharacterMotions} from './asset-organization.js';
import {DialogueCameraController,snapshotCamera,applyDialogueCamera,resolveDialogueCamera} from './dialogue-camera.js';
import './dialogue-camera.css';
import './story-workspace.css';
import {createNextDialogue} from './dialogue-new.js';
import {mergeEditorProject,rebaseEditorHistoryProject} from './editor-project-merge.js';
import * as THREE from 'three';
import {createSceneAnimationDialog} from './scene-animation-dialog.js';
import {normalizeSceneAnimations} from './scene-animations.js';
import {migrateTitleActors,newTitleActor} from './title-actors.js';
import {dialogueSlots,dialogueSlotLabel,dialogueSlotPosition,migrateDialogueCast, emptyDialogueCast, copyDialogueCast, setDialogueActor} from './dialogue-cast.js';
import {availablePropBones,propBoneLabels,propBone,setPropRotation} from './character-props.js';
import './style.css';
import {preciseTransform,routePreciseInput} from './precise-transform.js';
import './precise-transform.css';
import {showExportChooser} from './export-game.js';
import {createContextMenu} from './context-menu.js';
import {GalleryCache} from './gallery-cache.js';
import './gallery-cache.css';
import {copyLabels,insertEditorCopy,projectClipboard} from './editor-copy.js';
import './android-export.css';
import {createEditorSaveNotice} from './editor-save-notice.js';
import './editor-save-notice.css';
import './skin.css';
import './layout.css';
import {createPreviewResizer} from './preview-resize.js';
import {normalizeInventory,itemDefinitionReady,choiceItemStatus,grantDialogueItems,useChoiceItems,validateInventoryProject} from './inventory.js';
import './inventory.css';
import './vn-theme.css';
import './ios7-theme.css';
import './chapters.css';
import './menu-motion.css';
import './game-glass.css';
import {gameUiPresets,normalizeGameUi,gameUiPicker} from './game-ui.js';
import './game-ui.css';
import {captureSaveThumbnail,validSaveThumbnail} from './save-thumbnail.js';
import './save-thumbnail.css';
import {createRoleDetails} from './role-details.js';
import {createDetailIdle} from './detail-idle.js';
import './role-details.css';
import {portraitBodyFrame} from './portrait-body-frame.js';
import './weather.css';
import './events.css';
import { createEvents, eventNames, eventSeconds, isEvent, normalizeEvent, newEvent } from './events.js';
import { normalizeWeather, weatherDefaults, weatherNames, weatherMood } from './weather.js';
import { colorDefaults, chapterRender, colorFilter, chapterUnlocked, dialogueRender } from './chapters.js';
import { VRMStage, assetUrl, motionFrameInfo, captureCharacterPortrait } from './renderer.js';
import {canGeneratePortrait} from './portrait-policy.js';
import {normalizeRender,renderPresets,customFilterSpecs,filterGroups,colorAdjustments} from './render-style.js';
import './render-style.css';
import {actResourceEntries,actMediaAssets} from './act-resources.js';
import './frame-rate.css';
import { embeddedVrmThumbnail, internalPortrait } from './vrm-thumbnail.js';
import {createModelThumbnailQueue} from './model-thumbnails.js';
import {validateEnvironmentLibrary} from './environment-operations.js';
import {createEnvironment,migrateEnvironments,validateEnvironment} from './environment-schema.js';
import {verifyImageAlpha} from './editor-fix-smoke.js';
import {normalizeGraphics,aaOptions,fsrOptions} from './player-graphics.js';
import {verifyFsrGPU} from './graphics-smoke.js';
import { createLibrary } from './library.js';
import { createEditorHistory } from './editor-history.js';
import './editor-history.css';
import { syncDialogueVoices, voicesForCharacter, voiceFolderId, dialogueLines, clearVoiceReferences } from './dialogue-voices.js';
import './dialogue-voices.css';
import './feedback.css';
import { createStoryAssistant } from './story-assistant.js';

const app = document.querySelector('#app');
const pending = new Map();
let counter = 0;
let project = null;
let mode = 'editor';
let directory = '';
let recentProjects = [];
let stage = null;
const roleDetails=createRoleDetails({project:()=>project,asset:id=>asset(id),url:assetUrl,unlocked:id=>hasDiscovered('character',id),lineCount:id=>Math.max(0,Number(loadLifetimeProgress().characterLineCounts[id])||0),idleMotion:role=>motionsForCharacter(project,role.id).find(motion=>motion.id===role.detailsIdleId)||null,createStage:(node,error)=>{const viewer=new VRMStage(node,error);viewer.setGraphicsSettings(graphicsPreferences);return viewer;},closed:()=>closePlayerModal()});
let previewResizer=null;
let selectedAct = 0;
let selectedStep = 0;
let selectedCharacter = 0;
let activePanel = 'story';
let selectedItem=0,playerInventory=normalizeInventory(),inventorySession=false;
let propPreviewMode=false,selectedBindingPropId='';
const openAssetFolders = new Set(['unfiled:vrm', 'unfiled:motion', 'unfiled:image', 'unfiled:audio', 'unfiled:video']);
let dockInitializedProjectId = '';
let activeAssetType = 'image';
const currentAssetFolder = { image: '', vrm: '', fbxCharacter: '', mmdCharacter:'', sceneModel: '', motion: '', audio: '', music:'',effect:'', voice: '', video: '' };
let draggingStory = null;
let playing = false;
let playAct = 0;
let playStep = 0;
let preparedAct = -1;
let transitioning = false;
let dialogueCamera=null,cameraActId="",cameraStepId="",skipCameraTravel=false,cameraSpeed=1;
let playRequest = 0;
let previewRequest = 0;
let titleRequest = 0;
let modulePanel=null,moduleBaseline=null,moduleBaselineRevision=0,moduleRefreshPending=null,moduleNotifyTimer=null;
const moduleLabels={characters:"角色",items:"物品",title:"标题",render:"渲染",knowledge:"知识库"};
let dirty = false;
let changeRevision = 0;
let saveInFlight = null;
let saveScreenshotBusy=false;
const editorSaveNotice=createEditorSaveNotice({status:()=>dirty?(modulePanel?'● 未应用':'● 未保存'):(modulePanel?'✓ 已应用到工程':'✓ 已保存')});
let editorSettings = { autoSaveMinutes: 5, theme: 'light' };
let feedbackGroup = '';
let editorAutoSaveTimer = null;
let music = new Audio();
let musicFadeFactor = 1, musicFadeToken = 0, restoredEventRemaining, eventMusicActive = false;
let displayedBackgroundId = '';
let voice = new Audio();
const editorVoicePreview = new Audio();
let previewVoiceId = '';
editorVoicePreview.addEventListener('ended', () => { previewVoiceId = ''; renderAssetDock(); });
let audioSettings = { master: 1, music: 0.8, voice: 1, effects: 0.8 };
let textSpeed = 35;
let graphicsPreferences=normalizeGraphics(),graphicsDraft=normalizeGraphics();
let typingTimer = null;
let typingCharacters = [];
let typingIndex = 0;
const activeEffects = new Set();
const eventEffects = new Set();
let clickAudioContext = null;
let autoPlay = false;
let autoTimer = null;
let playViewedStepIds = new Set();
let playCharacterLineCounts = {};
let lifetimeProgress = null;
let playerAutoSaveTimer = null;
let galleryTab = 'images';
let galleryPage = 0;
let galleryCharacterId = '';
let galleryStoryIndex = 0;
let editorGalleryStoryIndex = 0;
let galleryStage = null;
const editorGalleryKeys=[];
let galleryCache=null,gallerySelection=Promise.resolve(false);
let galleryTrackIndex = 0;
let galleryRepeatOne = false;
const galleryMusic = new Audio();
let galleryMusicInterruptedBgm = false;
let stageError = '';
const portraitJobs = new Map();
const temporaryPortraits = new Map();
const pendingPortraitDeletes = new Set();
let saveModalMode = '';
let playerResolution = '1280x720';
let availableResolutions = [];
let playerFullscreen = false;
let historyBusy = false, historyInput = null, historyPointer = null, historyAction = null;
const editorHistory = createEditorHistory({ project: () => project, selection: editorSelection, changed: updateHistoryButtons });
music.loop = true;
galleryMusic.addEventListener('ended', () => {
  const tracks = galleryTracks();
  if (!tracks.length || saveModalMode !== 'gallery' || galleryTab !== 'music') return;
  if (galleryRepeatOne) {
    galleryMusic.currentTime = 0;
    galleryMusic.play().catch(() => {});
  } else playGalleryTrack(nextUnlockedTrack(1));
});
galleryMusic.addEventListener('timeupdate', updateGalleryMusicTime);
galleryMusic.addEventListener('loadedmetadata', updateGalleryMusicTime);

function bridge(action, payload = {}) {
  return new Promise((resolve, reject) => {
    if (!window.chrome?.webview) return reject(new Error('请打开 Windows 程序使用编辑器'));
    const id = String(++counter);
    pending.set(id, { resolve, reject });
    window.chrome.webview.postMessage({ id, action, payload });
  });
}
window.chrome?.webview?.addEventListener('message', event => {
  const message = event.data;

  if(typeof message.projectSaving==='boolean'){editorSaveNotice.set('native',message.projectSaving);return;}
  if(typeof message.modulePreviewActive==='boolean'){window.__editorModulePreviewActive=message.modulePreviewActive;return;}
  if (message.agentRequest) {
    const {id,name,arguments:args} = message.agentRequest;
    Promise.resolve().then(() => storyAssistant.call(name,args)).then(
      data => bridge('agentReply',{id,ok:true,data}),
      error => bridge('agentReply',{id,ok:false,error:error.message})
    ).catch(error=>toast(error.message,true));
    return;
  }
  if(message.editorModuleCommit){applyEditorModuleCommit(message.editorModuleCommit);return;}
  if(message.editorModuleRefresh){refreshEditorModule(message.editorModuleRefresh);return;}
  if(message.environmentCommit){applyEnvironmentCommit(message.environmentCommit);return;}
  const promise = pending.get(message.id);
  if (!promise) return;
  pending.delete(message.id);
  message.ok ? promise.resolve(message.data) : promise.reject(new Error(message.error));
});

const uid = () => crypto.randomUUID().replaceAll('-', '');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const asset = id => project?.assets.find(item => item.id === id);
const library = createLibrary({ project: () => project, escape, assetUrl, bridge, markDirty, toast,
  history: () => editorHistory.status(), undo: () => restoreEditorHistory(-1), redo: () => restoreEditorHistory(1),
  progress: () => lifetimeProgress, refresh: () => { renderSidebar(); renderInspector(); updatePreview(); },
  openModal: view => { closePlayerModal(); document.querySelector('#player-modal')?.remove(); saveModalMode = view; } });
const events = createEvents({ project: () => project, escape, asset, assetUrl,
  volume:()=>audioSettings.master,
  paused: () => Boolean(saveModalMode || document.querySelector('#player-modal.closing')),
  player: () => mode === 'player', prepare: prepareEventScene,
  audio: e => {
    eventMusicActive = true; transitionMusic(e.bgmId);
    const previous = new Set(activeEffects);
    if (e.seId) playEffect(e.seId);
    for (const sound of activeEffects) if (!previous.has(sound)) eventEffects.add(sound);
    voice.pause(); const narration = asset(e.voiceId);
    if (narration) { voice.src = assetUrl(narration); voice.play().catch(() => {}); }
  },
  cleanAudio: () => {
    musicFadeToken++; musicFadeFactor = 1; voice.pause();
    for (const sound of eventEffects) { sound.pause(); activeEffects.delete(sound); }
    eventEffects.clear(); applyAudioSettings();
  },
  cue: () => { if (mode === 'player') playEventSignal(); },
  finish: id => {
    if (!playing || project.acts[playAct]?.id !== id) return;
    if (mode === 'player') { const progress = loadLifetimeProgress(); if (!progress.completedEventIds.includes(id)) progress.completedEventIds.push(id); localStorage.setItem(lifetimeKey(), JSON.stringify(progress)); }
    playAct++; playStep = 0; preparedAct = -1; showPlayStep();
  } });
const act = () => project.acts[selectedAct];
const storyAssistant = createStoryAssistant({project:()=>project,mode:()=>mode,escape,bridge,toast,assetUrl,
  revision:()=>changeRevision,dirty:()=>dirty,busy:()=>historyBusy||transitioning||playing,
  begin:()=>{editorHistory.seal();editorHistory.begin();},
  changed:label=>{normalize();markDirty({label});},
  refresh:async()=>{renderSidebar();renderInspector();await updatePreview();},
  selectAct:index=>{selectedAct=index;selectedStep=0;activePanel='story';},
  undo:restoreEditorHistory,history:()=>editorHistory.status(),save,
  openEnvironment:openAgentEnvironment,refreshEnvironmentWindow:refreshAgentEnvironmentWindow});
const step = () => act()?.steps[selectedStep];
const character = id => project.characters.find(item => item.id === id);
const options = (items, value, empty = '无') =>
  `<option value="">${escape(empty)}</option>${items.map(item =>
    `<option value="${escape(item.id)}" ${item.id === value ? 'selected' : ''}>${escape(item.name)}</option>`).join('')}`;
const byType = type => assetsOfType(project,type).filter(item => !internalPortrait(project, item));
const vrmThumbnails = new Map();
let thumbnailProject = null;
const modelThumbnails=createModelThumbnailQueue({project:()=>project,allowed:()=>mode==='editor'&&!playing,capture:captured=>captureCharacterPortrait(captured,null,1,null,true),save:(model,dataUrl)=>bridge('saveModelThumbnail',{modelId:model.id,dataUrl}),changed:()=>markDirty({derived:true}),repaint:()=>renderAssetDock(),error:(model,error)=>console.warn('人物素材缩略图暂时不可用',model.name,error.message)});
function refreshVrmThumbnails() {
  if (thumbnailProject !== project) {
    for (const result of vrmThumbnails.values()) if (result.url) URL.revokeObjectURL(result.url);
    vrmThumbnails.clear(); thumbnailProject = project;
  }
  const owner = project;
  for (const model of byType('vrm')) {
    const key = assetUrl(model);
    if (vrmThumbnails.has(key)) continue;
    const entry = {}; vrmThumbnails.set(key, entry);
    (async () => {
      try {
        const response = await fetch(key); if (!response.ok) return;
        const blob = embeddedVrmThumbnail(await response.arrayBuffer());
        if (!blob || project !== owner || !owner.assets.includes(model)) return;
        entry.url = URL.createObjectURL(blob);
        // Old projects sometimes registered the embedded image as an ordinary image.
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const portraitIds = new Set(owner.characters.map(c => c.portraitId));
        for (const portrait of owner.assets.filter(a => a.type === 'image' &&
          (portraitIds.has(a.id) || /头像|portrait|thumbnail/i.test(a.name || '')))) {
          if (!portrait || internalPortrait(owner, portrait)) continue;
          const image = await fetch(assetUrl(portrait)); if (!image.ok) continue;
          const other = new Uint8Array(await image.arrayBuffer());
          if (project !== owner) return;
          if (bytes.length === other.length && bytes.every((v, i) => v === other[i])) {
            portrait.internalPortrait = true; portrait.galleryImage = false;
            portrait.folderId = 'embedded-vrm-portraits';
            if (!owner.assetFolders.some(f => f.id === portrait.folderId))
              owner.assetFolders.push({ id: portrait.folderId, name: 'VRM内置头像', type: 'image', hidden: true });
            markDirty({ derived: true });
          }
        }
      } catch { /* Models without an embedded image keep the ordinary icon. */ }
      finally { if (project === owner) renderAssetDock(); }
    })();
  }
}
const field = (label, control) => `<label class="field"><span>${label}</span>${control}</label>`;
const input = (key, value, placeholder = '') => `<input data-field="${key}" value="${escape(value)}" placeholder="${escape(placeholder)}">`;
const textarea = (key, value, placeholder = '') => `<textarea data-field="${key}" placeholder="${escape(placeholder)}">${escape(value)}</textarea>`;
const select = (key, items, value, empty) => `<select data-field="${key}">${options(items, value, empty)}</select>`;
const button = (label, action, extra = '') => `<button type="button" data-action="${action}" ${extra}>${label}</button>`;
const loadingSpinner = '<span class="loading-spinner" role="status" aria-label="人物加载中"><i></i><i></i><i></i><i></i><i></i><i></i></span>';
function setStagePlaceholder(node, message, loading = false) {
  if (!node) return;
  if (loading) node.innerHTML = loadingSpinner;
  else node.textContent = message;
}
const defaultSize = 1.15;
const expressionLabels = {
  happy:'开心', angry:'生气', sad:'难过', relaxed:'放松', surprised:'惊讶',
  aa:'口型 A', ih:'口型 I', ou:'口型 U', ee:'口型 E', oh:'口型 O',
  blink:'眨眼', blinkLeft:'左眼眨眼', blinkRight:'右眼眨眼', neutral:'自然'
};
const expressionWeightsOf = entry => entry?.expressionWeights && typeof entry.expressionWeights === 'object'
  ? entry.expressionWeights : entry?.expression ? { [entry.expression]: 1 } : {};
const transformOf = entry => ({
  size: Number(entry?.size) || defaultSize,
  offsetX: Number(entry?.offsetX) || 0,
  offsetY: Number(entry?.offsetY) || 0,
  offsetZ: Number(entry?.offsetZ) || 0,
  yaw: Number(entry?.yaw) || 0,
  pitch: Number(entry?.pitch) || 0
});
const modelForStep = entry => asset(character(entry?.characterId)?.modelId);
const castSlots = dialogueSlots;
const castSlotLabels = Object.fromEntries(castSlots.map(slot=>[slot,dialogueSlotLabel(slot)]));
const castSettingsOf = (currentAct, slot) => step()?.cast?.[slot] || {};
const motionOptionsOf = holder => holder?.motionOptions || {};
function motionAdvanced(holder, scope) {
  const settings = motionOptionsOf(holder);
  const loop = settings.loop !== false;
  const start = Math.max(1, Math.floor(Number(settings.startFrame) || 1));
  const end = Number(settings.endFrame) > 0 ? Math.floor(Number(settings.endFrame)) : '';
  return `<details class="motion-advanced"><summary>高级动作选项</summary><div class="motion-advanced-body">
    <label class="motion-option-row"><span>循环播放</span><select data-motion-options="${escape(scope)}" data-motion-setting="loop">
      <option value="true" ${loop ? 'selected' : ''}>是（默认）</option><option value="false" ${loop ? '' : 'selected'}>否，只播一次</option></select></label>
    <label class="motion-option-row"><span>动作走位</span><select data-motion-options="${escape(scope)}" data-motion-setting="placement">
      <option value="free" ${['bounded','inPlace'].includes(settings.placement) ? '' : 'selected'}>跟随动作移动（连续）</option>
      <option value="inPlace" ${['bounded','inPlace'].includes(settings.placement) ? 'selected' : ''}>原地播放</option></select></label>
    <p class="tip">连续移动不会在每轮动作结束时跳回起点。原地播放保留抬腿、跳跃和坐下等身体动作。</p>
    <label class="motion-option-row"><span>脚掌固定</span><select data-motion-options="${escape(scope)}" data-motion-setting="feet">
      <option value="free" ${!['auto','lock'].includes(settings.feet)?'selected':''}>跟随动作（走路、跳跃）</option>
      <option value="lock" ${settings.feet==='lock'?'selected':''}>固定双脚（待机、站立）</option>
      <option value="auto" ${settings.feet==='auto'?'selected':''}>自动（待机、说话时固定）</option></select></label>
    <p class="tip">脚掌有轻微漂移时可选“固定双脚”。行走、跳跃等动作请选“跟随动作”，保留正常抬脚。</p>
    <div class="motion-frame-row"><label><span>起始帧</span><input type="number" min="1" step="1" value="${start}"
      data-motion-options="${escape(scope)}" data-motion-setting="startFrame"></label>
      <label><span>结束帧</span><input type="number" min="1" step="1" value="${end}" placeholder="最后一帧"
      data-motion-options="${escape(scope)}" data-motion-setting="endFrame"></label></div>
    <p class="tip" data-motion-hint="${escape(scope)}">第 1 帧是动作开头，结束帧留空会播到最后。</p>
    <label class="motion-option-row"><span>播完后</span><select data-motion-options="${escape(scope)}" data-motion-setting="after" ${loop ? 'disabled' : ''}>
      <option value="hold" ${settings.after === 'idle' ? '' : 'selected'}>停在最后一帧</option>
      <option value="idle" ${settings.after === 'idle' ? 'selected' : ''}>${scope === 'step' ? '平滑回到本幕动作' : '平滑回到默认动作'}</option></select></label>
  </div></details>`;
}
async function refreshMotionHints() {
  for (const hint of document.querySelectorAll('[data-motion-hint]')) {
    const scope = hint.dataset.motionHint;
    let motion, model, actorKey;
    if (scope === 'step') {
      motion = asset(step()?.motionId);
      model = modelForStep(step());
      actorKey = step()?.characterId || model?.id;
    } else if (scope.startsWith('titleActor:')) {
      const actor=project.title.actors.find(item=>item.id===scope.slice(11));
      motion=asset(actor?.motionId); model=asset(actor?.modelId); actorKey=`title:${actor?.id}`;
    } else if (scope.startsWith('cast:')) {
      const slot = scope.slice(5);
      motion = asset(castSettingsOf(act(), slot).motionId);
      actorKey = step()?.cast?.[slot]?.characterId;
      model = asset(character(actorKey)?.modelId);
    }
    if (!motion) { hint.textContent = '第 1 帧是动作开头，结束帧留空会播到最后。'; continue; }
    if (!model) { hint.textContent = '选择角色和模型后，会显示这个动作的总帧数。'; continue; }
    hint.textContent = '正在读取动作帧数…';
    try {
      const clip = await stage.prepareClip(model, motion, actorKey);
      if (!hint.isConnected) continue;
      const info = motionFrameInfo(clip);
      hint.textContent = `动作共约 ${info.frames} 帧（每秒 ${info.fps} 帧）。第 1 帧是开头；结束帧留空会播到最后。`;
      const endInput = hint.closest('.motion-advanced')?.querySelector('[data-motion-setting="endFrame"]');
      if (endInput) endInput.max = info.frames;
    } catch {
      if (hint.isConnected) hint.textContent = '动作帧数暂时无法读取，仍可填写起始帧和结束帧。';
    }
  }
}
function castAssignments(currentAct, speakingStep) {
  return castSlots.flatMap(slot => {const settings=speakingStep?.cast?.[slot];return settings?.characterId?[{actorKey:settings.characterId,baseSlot:slot,position:slot}]:[];});
}
function castForAct(currentAct, speakingStep = currentAct?.steps?.[0]) {
  return castAssignments(currentAct, speakingStep).flatMap(({actorKey,position}) => {
    const actor=character(actorKey),modelAsset=asset(actor?.modelId),settings=speakingStep.cast[position];
    return modelAsset?[{actorKey,modelAsset,position,transform:transformOf(settings),expressionWeights:settings.expressionWeights||{},motionAsset:asset(settings.motionId),motionOptions:motionOptionsOf(settings),playbackKey:`step:${speakingStep.id}:${actorKey}`,props:actor.props||[],visiblePropIds:settings.props||[],assets:project.assets,returnToIdle:true}]:[];
  });
}

window.__vrmSmokeInventory=async function(phase){
 if(!new URLSearchParams(location.search).has('smoke'))throw Error('Smoke only');
 const assert=(test,message)=>{if(!test)throw Error(message);},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),click=action=>document.querySelector('[data-action="'+action+'"]')?.click();
 async function display(index,line=0){playing=true;playAct=index;playStep=line;preparedAct=-1;saveModalMode='';document.querySelector('#player-modal')?.remove();document.querySelector('#inventory-reward')?.remove();await showPlayStep();finishTyping();await wait(300);}
 async function rewards(){for(let i=0;i<6&&playerInventory.pending.length;i++){click('confirm-item-reward');await wait(120);}}
 if(phase==='prepare'){
   project.items=[];
   for(const [id,name,consumable,label,color,description]of[
    ['usd','美元',true,'$','#3c8970','一枚美元代表一美元的余额。这是旅途中可以使用的零钱，能支付车费、购买日用品，也能换取其他补给。选择需要美元的分支时，系统会检查余额并扣除所需数量。零钱用完后，背包不再显示它，但鉴赏仍可阅读这段介绍。'],
    ['key','旧钥匙',false,'⚿','#b68a37','一把旧钥匙，表面留着长年使用的磨痕。它可以打开某些地点的门，也是故事中的重要线索。选择需要钥匙的分支时，只检查玩家是否持有，不会消耗钥匙。妥善保管后，它能在后面的剧情中反复使用，直到故事结束。'],
    ['ticket','纪念车票',false,'票','#516fa5','一张尚未获得的纪念车票，用来检查物品鉴赏的锁定效果。未获得时，立绘会变灰并盖上红色封条，不能点击阅读。真正获得后，系统才会解锁详情；即使物品后来不在背包里，曾经获得的记录也仍然保留。']]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(64,100,384,312,24);ctx.fill();ctx.strokeStyle='#e4e9dc';ctx.lineWidth=10;ctx.strokeRect(84,120,344,272);ctx.fillStyle='#fff';ctx.font='bold 160px sans-serif';ctx.textAlign='center';ctx.fillText(label,256,310);const image=await bridge('saveInventoryImage',{dataUrl:canvas.toDataURL('image/png'),itemId:id,name});project.assets.push(image);project.items.push({id,name,imageId:image.id,description});
   }
   const template=structuredClone(project.acts[0]),base=structuredClone(template.steps[0]);
   const line=(id,text)=>({...structuredClone(base),id,text,choices:[],itemGrants:[],voiceId:'',seId:''});
   const first={...structuredClone(template),id:'item-start',name:'获得物品与打车',steps:[line('no-money','现在还没有美元，打车选项会变灰。'),line('receive-money','出发前，你找到了五美元和一把旧钥匙。'),line('travel-choice','要走路前往目的地，还是花五美元打车？')]};
   first.steps[0].choices=[{text:'走路去',actId:'walk'},{text:'打车（5 美元）',actId:'taxi',consumeRequired:true,requirements:[{itemId:'usd',quantity:5}]}];first.steps[1].itemGrants=[{itemId:'usd',quantity:5},{itemId:'key',quantity:1}];first.steps[2].choices=structuredClone(first.steps[0].choices);
   const taxi={...structuredClone(template),id:'taxi',name:'打车后',steps:[line('taxi-result','你花了五美元抵达目的地，旧钥匙仍在背包里。')]};taxi.steps[0].choices=[{text:'用旧钥匙开门',actId:'door',requirements:[{itemId:'key',quantity:1}]}];
   const walk={...structuredClone(template),id:'walk',name:'步行',steps:[line('walk-result','步行不花钱。')]},door={...structuredClone(template),id:'door',name:'开门',steps:[line('door-result','门打开了，旧钥匙还在。')]};project.acts=[first,taxi,walk,door];project.name='玩家物品与分支验证';playerInventory=normalizeInventory({},project.items);inventorySession=true;activePanel='items';selectedItem=0;renderSidebar();renderInspector();markDirty();await save();return {ok:true,definitions:project.items.length,squareImages:true};
 }
 if(phase==='locked'){
   playerInventory=normalizeInventory({},project.items);inventorySession=true;await display(0);assert(document.querySelector('[data-action="choose"][data-index="1"]').disabled,'没有钱也能打车');assert(document.querySelector('.choice-missing').textContent.includes('美元'),'没有缺少物品提示');const before=playerInventory.counts.usd||0;document.querySelector('[data-action="choose"][data-index="1"]').click();await wait(100);assert(playAct===0&&(playerInventory.counts.usd||0)===before,'锁定选项仍被执行');return {ok:true,disabledChoice:true,missingItemText:true};
 }
 if(phase==='reward'){
   playerInventory=normalizeInventory({},project.items);inventorySession=true;await display(0,1);assert(playerInventory.counts.usd===5&&playerInventory.counts.key===1,'获得数量错误');assert(document.querySelector('#inventory-reward')&&document.querySelector('.inventory-reward-dialogue').textContent.includes('美元 × 5'),'没有额外获得对话');const snapshot=snapshotSlot();localStorage.setItem('inventory-pending-test-'+project.id,JSON.stringify(snapshot));const image=document.querySelector('.inventory-reward-image');assert(image.naturalWidth===image.naturalHeight,'立绘不是正方形');return {ok:true,extraDialogue:true,centerArtwork:true,pendingSaved:snapshot.inventory.pending.length===2};
 }
 if(phase==='reload-pending'){
   const slot=JSON.parse(localStorage.getItem('inventory-pending-test-'+project.id));const slots=Array(20).fill(null);slots[1]=slot;localStorage.setItem(saveKey(),JSON.stringify(slots));playing=false;loadSlot(1);await wait(650);finishTyping();assert(playerInventory.counts.usd===5&&playerInventory.pending.length===2,'读档重复发放或丢失提示');await rewards();await display(0,1);assert(playerInventory.counts.usd===5&&!playerInventory.pending.length,'同句重复发放');return {ok:true,noDuplicateReward:true,pendingRestored:true};
 }
 if(phase==='spend'){
   await rewards();await display(0,2);assert(!document.querySelector('[data-action="choose"][data-index="1"]').disabled,'有5美元仍不能打车');const before=snapshotSlot();document.querySelector('[data-action="choose"][data-index="1"]').click();await wait(650);finishTyping();assert(project.acts[playAct].id==='taxi'&&(playerInventory.counts.usd||0)===0,'打车没有扣5美元');assert(playerInventory.counts.key===1,'钱被扣时工具也丢失');document.querySelector('[data-action="choose"][data-index="0"]').click();await wait(650);finishTyping();assert(playerInventory.counts.key===1,'工具被消耗');const after=snapshotSlot(),slots=Array(20).fill(null);slots[1]=before;slots[2]=after;localStorage.setItem(saveKey(),JSON.stringify(slots));playing=false;loadSlot(1);await wait(650);finishTyping();assert(playerInventory.counts.usd===5,'读回花钱前存档没有恢复余额');playing=false;loadSlot(2);await wait(650);finishTyping();assert((playerInventory.counts.usd||0)===0&&playerInventory.counts.key===1,'花钱后存档恢复错误');return {ok:true,currencyConsumed:true,toolPreserved:true,independentSaveBalances:true};
 }
 if(phase==='gallery'){
   if(mode==='editor'){mode='player';renderPlayer();playing=true;playAct=1;playStep=0;await showPlayStep();finishTyping();}galleryTab='items';renderGalleryModal();assert(document.querySelector('[data-item-id="ticket"]').disabled,'未知物品能点');assert(document.querySelector('.inventory-seal').textContent==='未获得','没有红色封条');assert(getComputedStyle(document.querySelector('[data-item-id="ticket"] img')).filter.includes('grayscale'),'未知立绘不是灰色');assert(!document.querySelector('[data-item-id="usd"]').disabled,'用完的钱不能鉴赏');return {ok:true,unknownLocked:true,grayArtwork:true,redSeal:true,consumedStillKnown:true};
 }
 if(phase==='detail'){document.querySelector('[data-item-id="usd"]').click();assert(document.querySelector('.inventory-detail p').textContent.includes('当前持有：0'),'用完物品的详情数量错误');assert(document.querySelector('.inventory-detail').textContent.includes('这段介绍'),'介绍没有显示');return {ok:true,descriptionShown:true,zeroBalanceShown:true};}
 if(phase==='export'){
   mode='editor';playing=false;closePlayerModal();document.querySelector('#player-modal')?.remove();renderEditor();validateInventoryProject(project);markDirty();await save();await bridge('saveProjectAs',{project:structuredClone(project),name:'玩家物品与分支示例'});await bridge('exportGame',{folderName:'物品栏试玩'});return {ok:true,exported:true};
 }
 if(phase==='player'||phase==='reopen'){
   assert(project.items.length===3,'物品定义没有保存');playerInventory=normalizeInventory({},project.items);inventorySession=true;await display(0);assert(document.querySelector('[data-action="choose"][data-index="1"]').disabled,'独立游戏条件失效');await display(0,1);assert(playerInventory.counts.usd===5,'独立游戏没有发放');await rewards();await display(0,2);document.querySelector('[data-action="choose"][data-index="1"]').click();await wait(650);finishTyping();assert((playerInventory.counts.usd||0)===0&&playerInventory.counts.key===1,'独立游戏扣除错误');renderBackpack();assert(document.querySelector('[data-item-id="key"]'),'背包缺少工具');return {ok:true,projectItems:true,grantWorks:true,consumeWorks:true,toolInBackpack:true};
 }
 throw Error('Unknown phase');
};

window.__vrmSmokePreviewResize=async(mode)=>{
 const frame=document.querySelector('.center .stage-frame'),assert=(test,message)=>{if(!test)throw Error(message);};
 const wait=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 if(mode==='reset'){previewResizer.reset();window.__previewResizeEvents=[];await wait();}
 if(mode==='persist'){const width=frame.getBoundingClientRect().width,revision=changeRevision;renderEditor();await wait();assert(Math.abs(document.querySelector('.center .stage-frame').getBoundingClientRect().width-width)<2,'重开编辑界面丢失大小');assert(changeRevision===revision,'调整预览修改了工程');}
 const current=document.querySelector('.center .stage-frame'),rect=current.getBoundingClientRect(),corner=current.querySelector('[data-preview-resize="corner"]').getBoundingClientRect(),body=document.querySelector('.asset-dock-body');assert(Math.abs(rect.width/rect.height-16/9)<.01,'拖动改变比例');assert(body.clientHeight>=140,'拖动挤压素材卡片');return {ok:true,width:rect.width,height:rect.height,ratio:rect.width/rect.height,assetBodyHeight:body.clientHeight,preferredWidth:previewResizer.preferredWidth,hit:document.elementFromPoint(corner.left+corner.width/2,corner.top+corner.height/2)?.outerHTML.slice(0,250),pointer:window.__resizePointer,events:window.__previewResizeEvents,corner:{x:corner.left+corner.width/2,y:corner.top+corner.height/2}};
};

window.__vrmSmokeEditorLayout=async()=>{
 if(!new URLSearchParams(location.search).has('smoke'))throw Error('Smoke only');
 if(!window.__newDialogueVerified){
  const previous=structuredClone(act().steps.at(-1));document.querySelector('[data-action=add-step]').click();
  const created=step();if(!previous||created.id===previous.id||created.text!=='')throw Error('新增对白没有独立编号或台词没留空');
  const expected={...previous,id:created.id,text:''};if(JSON.stringify(created)!==JSON.stringify(expected))throw Error('新增对白没有完整继承上一句');
  act().steps.pop();selectedStep=0;window.__newDialogueVerified=true;
 }
 const assert=(test,message)=>{if(!test)throw Error(message);};playing=false;activePanel='story';selectedAct=Math.max(0,project.acts.findIndex(a=>a.id==='act-school'));selectedStep=0;activeAssetType='vrm';renderSidebar();renderInspector();await updatePreview();renderAssetDock();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 previewResizer.reset();await document.fonts.ready;await Promise.allSettled([...document.querySelectorAll('.asset-dock img')].map(img=>img.decode()));await new Promise(resolve=>setTimeout(resolve,120));
 const center=document.querySelector('.center'),preview=center.querySelector('.stage-frame'),dock=document.querySelector('.asset-dock'),body=document.querySelector('.asset-dock-body'),p=preview.getBoundingClientRect(),d=dock.getBoundingClientRect(),c=center.getBoundingClientRect(),tile=document.querySelector('.asset-file-tile')?.getBoundingClientRect();
 assert(Math.abs(p.width/p.height-16/9)<.03,'预览比例改变');assert(p.width<=961,'预览没有限制最大宽度');assert(d.bottom<=c.bottom+1,'素材库超出可见范围');assert(body.clientHeight>=140,'素材区仍不能显示完整卡片：'+body.clientHeight);if(tile)assert(tile.bottom<=body.getBoundingClientRect().bottom+4,'素材卡片被挤出窗口：'+JSON.stringify({tile:tile.bottom,body:body.getBoundingClientRect().bottom,height:body.clientHeight,scroll:body.scrollTop}));assert(!document.querySelector('.player'),'编辑状态错误');
 const nav=document.querySelector('.topbar nav'),rows=new Set([...nav.querySelectorAll('button')].map(button=>Math.round(button.getBoundingClientRect().top))),feedback=document.querySelector('.editor-feedback');
 assert(rows.size===1,'顶部按钮换行了');const current=document.querySelector('#story-current'),currentRect=current.getBoundingClientRect(),firstButton=nav.querySelector('button').getBoundingClientRect();assert(Boolean(current.closest('.editor-tools-row')),'正在编辑提示不在顶部');assert(Math.abs((currentRect.top+currentRect.height/2)-(firstButton.top+firstButton.height/2))<6,'绿色提示和按钮不在同一排');assert(!center.querySelector('.stage-toolbar,.stage-hint,#story-current,#stage-caption'),'预览旁仍有文字栏');assert(document.querySelector('[data-action=restart-character-preview]').closest('.topbar'),'重播按钮没有搬到顶部');assert(document.querySelector('#stage-caption').closest('.dialogue-column'),'幕名没有搬到对白栏');assert(Boolean(feedback?.closest('footer.status')),'QQ 群号没有在底部');assert(!nav.querySelector('.editor-feedback'),'顶部仍占用群号空间');
 return {ok:true,viewport:[innerWidth,innerHeight],preview:[p.width,p.height],assetDockHeight:d.height,assetBodyHeight:body.clientHeight,previewRatio:p.width/p.height,centerScroll:Math.max(0,center.scrollHeight-center.clientHeight),toolbarRows:rows.size,headerHeight:document.querySelector('.topbar').getBoundingClientRect().height,feedbackInFooter:true,newDialogueInherited:true,statusInToolbar:true,previewTextRowsRemoved:true,captionInDialogueColumn:true};
};

window.__vrmSmokeNpr=async function(phase){
 if(!new URLSearchParams(location.search).has('smoke'))throw Error('Smoke only');
 const assert=(test,message)=>{if(!test)throw Error(message);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const index=project.acts.findIndex(a=>a.id==='act-school');assert(index>=0,'没有校园测试场景');
 async function show(settings,lineSettings){playing=false;selectedAct=index;selectedStep=0;activePanel='render';project.acts[index].render=normalizeRender(settings);project.acts[index].steps[0].render=lineSettings;renderSidebar();renderInspector();await updatePreview();await wait(650);stage.stylePipeline.render(.016);}
 function pixels(){stage.stylePipeline.render(.016);const gl=stage.renderer.getContext(),w=stage.renderer.domElement.width,h=stage.renderer.domElement.height;const sample=new Uint8Array(4),values=[];for(let y=1;y<8;y++)for(let x=1;x<12;x++){gl.readPixels(Math.floor(w*x/12),Math.floor(h*y/8),1,1,gl.RGBA,gl.UNSIGNED_BYTE,sample);values.push(...sample.slice(0,3));}const brightness=values.reduce((a,b)=>a+b,0)/values.length;assert(brightness>8,'渲染画面黑屏');const bad=stage.renderer.info.programs.filter(p=>p.diagnostics&&!p.diagnostics.runnable);assert(!bad.length,'着色器编译失败：'+JSON.stringify(bad.map(p=>p.diagnostics)));return {values,brightness};}
 function difference(a,b){return a.reduce((total,v,i)=>total+Math.abs(v-b[i]),0)/a.length;}
 if(phase==='neutral'){await show({preset:'custom'});window.__nprNeutral=pixels();return {ok:true,brightness:window.__nprNeutral.brightness};}
 if(phase==='zzz-low'||phase==='zzz-high'){
   await show({preset:'zzz',strength:phase==='zzz-high'?1:.25});const result=pixels();assert(document.querySelector('[data-render="strength"]'),'没有风格浓度');assert(!document.querySelector('[data-npr-filter]'),'预设出现自定义滤镜');assert(!document.querySelector('[data-render="style"]')&&!document.querySelector('[data-render="paintEffect"]'),'旧风格仍显示');for(const key of ['brightness','contrast','saturation'])assert(document.querySelector('[data-render="'+key+'"]'),'缺少微调');const diff=difference(window.__nprNeutral.values,result.values);assert(diff>1,'预设没有改变画面');if(phase==='zzz-low')window.__nprLow=result;else assert(difference(window.__nprLow.values,result.values)>1,'浓度滑块没有效果');return {ok:true,brightness:result.brightness,difference:diff,sceneAndCharacters:true};
 }
 if(phase==='custom'){
   await show({preset:'custom',filters:{ao:.65,aoRadius:.5,outline:1.4,outlineColor:'#351415',posterize:8,sharpen:.4,pixelSize:3,hatch:.15,grain:.08}});for(const[key]of customFilterSpecs)assert(document.querySelector('[data-npr-filter="'+key+'"]'),'缺少滤镜 '+key);return {ok:true,filters:customFilterSpecs.length,difference:difference(window.__nprNeutral.values,pixels().values),aoGeometry:stage.stylePipeline.needsGeometry};
 }
 if(phase==='tno'){
   await show({preset:'tno'});assert(!document.querySelector('[data-render="strength"]'),'TNO 出现风格浓度');const first=pixels();await wait(500);const second=pixels();assert(difference(first.values,second.values)>.02,'CRT没有动态颗粒');assert(stage.stylePipeline.style.outlineColor==='#64f5ed','描边不是青色');return {ok:true,fixedPreset:true,cyanOutline:true,temporalDifference:difference(first.values,second.values),brightness:first.brightness};
 }
 if(phase==='dialogue'){
   await show({preset:'zzz'},{preset:'tno',brightness:125,contrast:115,saturation:120});activePanel='story';renderInspector();await updatePreview();assert(document.querySelector('[data-render="preset"][data-render-scope="step"]'),'对白不能选择风格');assert(!document.querySelector('[data-render="strength"]'),'对白TNO出现浓度');for(const key of ['brightness','contrast','saturation'])assert(document.querySelector('[data-render="'+key+'"][data-render-scope="step"]'),'对白缺少微调');assert(stage.renderSettings.preset==='tno'&&stage.renderSettings.brightness===125,'对白覆盖未应用');return {ok:true,dialoguePreset:true,calibrationAlwaysAvailable:true};
 }
 if(phase==='fbx'){
   playing=false;selectedAct=project.acts.findIndex(a=>a.id==='act-shadow-test');selectedStep=0;activePanel='render';project.acts[selectedAct].render=normalizeRender({preset:'zzz',strength:.85});delete project.acts[selectedAct].steps[0].render;renderSidebar();renderInspector();await updatePreview();await wait(650);pixels();assert([...stage.visibleRecords.values()].some(record=>record.vrm.isFbx),'FBX 不在场');return {ok:true,fbxPreset:true,vrmTogether:true,noShaderErrors:true};
 }
 if(phase==='export'){
   await show({preset:'zzz',strength:.85});for(const line of project.acts[index].steps)delete line.render;project.acts[index].steps[1].render={preset:'tno',brightness:110,contrast:105,saturation:115};project.acts[index].steps[2].render={preset:'custom',filters:{outline:1,posterize:10,pixelSize:2,ao:.35}};markDirty();await save();await bridge('saveProjectAs',{project:structuredClone(project),name:'新渲染三种风格验证'});await bridge('exportGame',{folderName:'新渲染试玩'});return {ok:true,exported:true};
 }
 if(phase==='player'||phase==='reopen'){
   playing=true;playAct=index;playStep=0;preparedAct=-1;await showPlayStep();await wait(700);assert(stage.renderSettings.preset==='zzz','保存后缺少预设');pixels();playStep=1;await showPlayStep();await wait(300);assert(stage.renderSettings.preset==='tno'&&stage.renderSettings.brightness===110,'对白TNO未保存');pixels();playStep=2;await showPlayStep();await wait(300);assert(stage.renderSettings.preset==='custom'&&stage.renderSettings.filters.ao===.35,'自定义未保存');pixels();playStep=0;await showPlayStep();await wait(500);return {ok:true,threePresets:true,dialogueOverrides:true,noShaderErrors:true};
 }
 throw Error('Unknown phase');
};

const runtimeFps=()=>stage?.frameRateMeter?.fps||0;
let activePreparedMedia=new Map(),activePreparedImages=[];
function releasePreparedMedia(){for(const item of activePreparedMedia.values()){item.pause?.();item.removeAttribute?.('src');item.load?.();}activePreparedMedia.clear();activePreparedImages=[];}
function takePreparedAudio(id){const item=activePreparedMedia.get(id);if(!item||item.tagName!=='AUDIO')return null;activePreparedMedia.delete(id);return item;}
function preparationEntries(target,lines){return actResourceEntries(project,{...target,steps:lines});}
async function prepareMedia(item,bundle){
 if(!item)return;
 const node=item.type==='image'?new Image():document.createElement(item.type==='video'?'video':'audio');
 node.preload='auto';node.muted=true;bundle.media.push(node);bundle.mediaMap.set(item.id,node);
 await new Promise(resolve=>{let timer;const finish=()=>{clearTimeout(timer);node.removeEventListener('load',finish);node.removeEventListener('loadeddata',finish);node.removeEventListener('error',finish);resolve();};node.addEventListener(item.type==='image'?'load':'loadeddata',finish,{once:true});node.addEventListener('error',finish,{once:true});timer=setTimeout(finish,5000);node.src=assetUrl(item);node.load?.();});
}
async function prepareCurrentActMedia(target,valid=()=>true){
 releasePreparedMedia();const bundle={media:[],mediaMap:new Map()};await Promise.all(actMediaAssets(project,target).map(item=>prepareMedia(item,bundle)));if(!valid()){for(const item of bundle.media){item.pause?.();item.removeAttribute('src');item.load?.();}return;}activePreparedMedia=bundle.mediaMap;activePreparedImages=bundle.media.filter(item=>item.tagName==='IMG');
}
function updateRuntimePreparation(){
 const counter=document.querySelector('#game-fps');counter?.classList.toggle('hidden',!(mode==='player'||playing));if(counter)counter.textContent=runtimeFps()>0?Math.round(runtimeFps())+' FPS':'— FPS';
}
setInterval(updateRuntimePreparation,200);

async function displayActStep(currentAct, current) {
  const cast=castForAct(currentAct,current),speaker=cast.find(entry=>entry.actorKey===current?.characterId);
  await stage.showCast(cast,speaker||null,playing);
}
const adjustmentSlider = (key, label, value, min, max, stepSize, display) =>
  `<label class="adjustment ${key === 'offsetZ' ? 'depth-adjustment' : ''}"><span>${label}</span><input type="range" data-adjust="${key}" min="${min}" max="${max}" step="${key === 'offsetZ' ? 'any' : stepSize}" value="${value}">${key === 'offsetZ' ? `<input class="depth-number" type="number" data-adjust="${key}" aria-label="${label}精确数值" min="${min}" max="${max}" step="0.01" value="${value}">` : ''}<output ${key === 'offsetZ' ? 'hidden' : ''} data-adjust-output="${key}">${display}</output></label>`;
const titleSlider = (key, label, value, min, max, stepSize, display) =>
  `<label class="adjustment ${key === 'offsetZ' ? 'depth-adjustment' : ''}"><span>${label}</span><input type="range" data-title-adjust="${key}" min="${min}" max="${max}" step="${key === 'offsetZ' ? 'any' : stepSize}" value="${value}">${key === 'offsetZ' ? `<input class="depth-number" type="number" data-title-adjust="${key}" aria-label="${label}精确数值" min="${min}" max="${max}" step="0.01" value="${value}">` : ''}<output ${key === 'offsetZ' ? 'hidden' : ''} data-title-output="${key}">${display}</output></label>`;
function titleActorEditor(actor,index){
  const role=character(actor.characterId);
  const transforms=[['size','大小',50,500,5],['offsetX','左右位置',-100,100,.01],['offsetY','上下位置',-100,100,.01],['offsetZ','前后位置',-100,100,.01],['yaw','左右转身',-360,360,.1],['pitch','上下转角',-360,360,.1]];
  return `<details class="title-actor-editor" data-copy-id="${actor.id}" open><summary>人物 ${index+1} · ${escape(asset(actor.modelId)?.name||'未选择模型')}</summary>
    ${field('人物模型',`<select data-title-actor-id="${actor.id}" data-title-actor-field="modelId">${options(actorModels(),actor.modelId,'不显示人物')}</select>`)}
    ${field('使用角色及其物品',`<select data-title-actor-id="${actor.id}" data-title-actor-field="characterId">${options(project.characters.filter(c=>c.modelId),actor.characterId,'直接使用模型')}</select>`)}
    ${field('人物动作',`<select data-title-actor-id="${actor.id}" data-title-actor-field="motionId">${options(motionsForCharacter(project,actor.characterId),actor.motionId,'保持站立')}</select>`)}
    ${motionAdvanced(actor,`titleActor:${actor.id}`)}
    ${transforms.map(([key,label,min,max,step])=>preciseTransform(label,key==='size'?Math.round(actor.size*100):actor[key],min,max,`data-title-actor-id="${actor.id}" data-title-actor-adjust="${key}"`,'',key==='size'?' (%)':'',step)).join('')}
    ${role?.modelId===actor.modelId?(role.props||[]).map(prop=>`<label class="motion-option-row"><span>显示 ${escape(prop.name)}</span><input type="checkbox" data-title-actor-id="${actor.id}" data-title-actor-prop="${prop.id}" ${actor.props.includes(prop.id)?'checked':''}></label>`).join(''):''}
    ${actor.modelId&&!isFbxModel(actor.modelId)?`<h3>人物表情</h3><div data-title-actor-expressions="${actor.id}" class="expression-controls"></div>`:''}
    ${button('删除这个标题人物','delete-title-actor',`data-id="${actor.id}"`)}
  </details>`;
}

function titleMarkup(interactive) {
  const logo = asset(project.title.logoImageId);
  const logoMarkup = logo
    ? `<img class="title-logo-image" src="${escape(assetUrl(logo))}" alt="${escape(project.name)}">`
    : `<div class="title-logo-fallback"><small>VRM GALGAME</small><strong>${escape(project.name)}</strong></div>`;
  const items = [
    ['继续游戏', 'continue-game'], ['开始游戏', 'play'], ['载入游戏', 'load-game'],
    ['系统设置', 'settings'], ['附加鉴赏', 'gallery'], ['角色详情', 'role-details'], ['游玩进度', 'play-progress'], ['退出游戏', 'exit-game']
  ];
  const hasSave = interactive && readSaveSlots().some(Boolean);
  const menu = items.map(([label, action]) => interactive
    ? `<button type="button" data-action="${action}" ${action === 'continue-game' && !hasSave ? 'disabled' : ''}>${label}</button>`
    : `<span>${label}</span>`).join('');
  return `${interactive ? '<button class="knowledge-title-button" data-action="knowledge-open" title="知识库" aria-label="打开知识库"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 5C8 2 3 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-2-7-1-10 1Z"/><path d="M12 5v15"/></svg></button>' : ''}${project.title.logoImageId === '__none__' ? '' : `<div class="title-logo-region">${logoMarkup}</div>`}<nav class="title-bottom-menu">${menu}</nav>`;
}
async function showTitleScene(interactive = false) {
  cancelSceneAnimations();
  stage?.stopTalking();
  events.cancel();
  eventMusicActive = false;
  setSceneWeather();
  applySceneColor(project.title.render||project.render);
  const request = ++titleRequest;
  const frame = document.querySelector('.stage-frame');
  frame?.classList.add('title-mode');
  showBackground(null);
  if (interactive && asset(project.title.logoImageId)) rememberDiscovery('image', project.title.logoImageId);
  stage.sceneAnimationsPaused=()=>Boolean(saveModalMode||document.hidden);
  stage.setRenderSettings(project.title.render||project.render);
  stage.setBackgroundLighting(asset(project.title.backgroundId));
  stage.setCameraAngle(0);
  await showEnvironment(project.title);
  const overlay = document.querySelector(interactive ? '#player-start' : '#title-preview');
  if (overlay) {
    overlay.innerHTML = titleMarkup(interactive);
    overlay.classList.remove('hidden');
  }
  if (interactive) setMusic(project.title.bgmId);
  const placeholder = document.querySelector('#stage-placeholder');
  if (placeholder) placeholder.style.display = 'none';
  const loading = document.querySelector('#act-loading');
  const entries = (project.title.actors || []).filter(item=>asset(item.modelId)).map(item=>{
    const role=character(item.characterId);
    return {actorKey:`title:${item.id}`,modelAsset:asset(item.modelId),motionAsset:asset(item.motionId),
      motionOptions:motionOptionsOf(item),expressionWeights:item.expressionWeights,position:'center',transform:transformOf(item),
      props:role?.modelId===item.modelId?role.props||[]:[],visiblePropIds:item.props,assets:project.assets,
      returnToIdle:true,playbackKey:`title:${item.id}:${item.motionId}`};
  });
  if (entries.length) loading?.classList.remove('hidden');
  await stage.showCast(entries, null, false);
  if (request === titleRequest && !playing) {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (request === titleRequest && !playing) loading?.classList.add('hidden');
  }
  // Title decorations alone do not unlock character details. Gameplay still
  // records both onstage actors and offstage speakers when they are encountered.
  if (!interactive && activePanel === 'title') refreshMotionHints();
  if (!interactive && activePanel === 'title') renderTitleExpressionControls();
}

async function applyEnvironmentCommit(message){
  try{const p=message.payload;if(mode!=='editor'||p.projectId!==project.id)throw Error('工程已切换，请重新打开环境窗口');
    let index=project.environments.findIndex(e=>e.id===p.environment.id);const isNew=index<0;
    if(isNew ? p.baseRevision!==-1 : JSON.stringify(project.environments[index])!==environmentBaselines.get(p.environment.id))throw Error('场景已在主窗口改变，请关闭并重新打开');
    if(!isNew&&(project.environments[index].revision||0)!==p.baseRevision)throw Error('场景版本已改变，请重新打开');
    const added=p.assets.filter(a=>!project.assets.some(x=>x.id===a.id));
    for(const a of added)if(!['image','sceneModel'].includes(a.type)||!/^assets\/(image|sceneModel)\//.test(a.path)||a.path.includes('..'))throw Error('素材路径无效');
    const assets=[...project.assets,...added];validateEnvironment(p.environment,assets);if(p.environmentLibrary){p.environmentLibrary=structuredClone(p.environmentLibrary);const currentIds=new Set(assets.map(a=>a.id));for(const id of Object.keys(p.environmentLibrary.assignments||{}))if(!currentIds.has(id))delete p.environmentLibrary.assignments[id];validateEnvironmentLibrary(p.environmentLibrary,assets);}
    const replacement=structuredClone(p.environment);replacement.revision=p.baseRevision+1;
    project.assets.push(...added);if(p.environmentLibrary)project.environmentLibrary=structuredClone(p.environmentLibrary);if(isNew){index=project.environments.length;project.environments.push(replacement);}else project.environments[index]=replacement;markDirty({label:'编辑 3D 环境'});
    try {await save();} catch(error) {project.environments[index].revision=p.baseRevision;environmentBaselines.set(p.environment.id,JSON.stringify(project.environments[index]));throw error;}
    environmentBaselines.set(p.environment.id,JSON.stringify(replacement));
    await bridge('environmentCommitReply',{session:message.session,ok:true,data:{revision:replacement.revision}});
    renderInspector();renderAssetDock();updatePreview().catch(error=>toast(error.message,true));
  }catch(error){await bridge('environmentCommitReply',{session:message.session,ok:false,error:error.message});}
}
let environmentBaselines=new Map();
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeFbxPortrait=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const fbx=project.characters.find(c=>asset(c.modelId)?.type==='fbxCharacter'),png=asset('portrait-mu');assert(fbx&&png,'缺少 FBX 或测试 PNG');
 const line=project.acts[0].steps[0];
 async function show(){if(mode==='player'){playing=true;playAct=0;playStep=0;preparedAct=-1;await showPlayStep();}else{playing=false;activePanel='story';selectedAct=0;selectedStep=0;line.characterId=fbx.id;line.text='FBX 自动生成的是一张静态头像，角度和大小与 VRM 一样。';renderSidebar();renderInspector();await updatePreview();}await updateSpeakerPortrait(fbx.id,true);}
 async function staticCheck(){await show();const node=document.querySelector('#speaker-portrait'),image=node.querySelector('img'),url=image.src;assert(url===assetUrl(asset(fbx.portraitId))&&!node.classList.contains('live-portrait')&&!stage.livePortrait.record,'FBX 不是静态 PNG');const bytes=await fetch(url).then(r=>r.arrayBuffer()),bitmap=await createImageBitmap(new Blob([bytes]));assert(bitmap.width===512&&bitmap.height===512,'PNG 尺寸不正确');bitmap.close();await wait(750);assert(image.src===url&&!stage.livePortrait.record,'FBX 头像跟着动了');return {ok:true,staticPng:true,pixels:[512,512],source:fbx.portraitSource,bytes:bytes.byteLength};}
 if(phase==='auto'){
  await Promise.all([...portraitJobs.values()]);assert(asset(fbx.portraitId)?.generatedPortrait&&fbx.portraitSource==='auto','打开缺头像的 FBX 未自动生成');
  const result=await staticCheck();activePanel='characters';selectedCharacter=project.characters.indexOf(fbx);renderInspector();assert(document.querySelector('[data-action="capture-character-portrait"]'),'缺少重新生成按钮');assert(!document.querySelector('[data-field="character.autoMouth"]'),'FBX 出现嘴型选项');
  const capture=await captureCharacterPortrait(asset(fbx.modelId));assert(Math.abs(capture.framing.halfHeight-.2)<1e-9&&capture.framing.cameraOffset.every((x,i)=>Math.abs(x-[-.85,.05,1.7][i])<1e-8),'没有使用 VRM 相同镜头');
  return {...result,sameVrmFraming:true,automaticOnOpen:true,manualButton:true};
 }
 if(phase==='manual'){
  fbx.portraitId=png.id;fbx.portraitSource='manual';const count=project.assets.length;await ensureCharacterPortrait(fbx,true);assert(fbx.portraitId===png.id&&project.assets.length===count,'自动生成覆盖了手动 PNG');await show();return {ok:true,manualPngPreserved:true};
 }
 if(phase==='reshoot'){
  editorHistory.seal();editorHistory.begin();await ensureCharacterPortrait(fbx,true,true);assert(fbx.portraitSource==='auto'&&fbx.portraitId!==png.id,'明确重新生成没有生效');const id=fbx.portraitId;await ensureCharacterPortrait(fbx,true,true);assert(fbx.portraitId===id,'重拍新增了重复头像');return {...await staticCheck(),reusesAsset:true,explicitReshoot:true};
 }
 if(phase==='export'){await show();markDirty();await save();await bridge('saveProjectAs',{project:structuredClone(project),name:'FBX静态头像验证'});await bridge('exportGame',{folderName:'FBX静态头像试玩'});return {ok:true,exported:true};}
 if(phase==='player'||phase==='reopen')return staticCheck();
 throw Error('未知 FBX 头像检查');
};
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeShoulderPortrait=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const vrm=project.characters.find(c=>c.id==='mu'&&asset(c.modelId)?.type==='vrm')||project.characters.find(c=>asset(c.modelId)?.type==='vrm'),fbx=project.characters.find(c=>asset(c.modelId)?.type==='fbxCharacter'),png=asset('portrait-mu');
 assert(vrm&&fbx&&png,'缺少 VRM、FBX 或 PNG 测试素材');
 const currentAct=project.acts[0],line=currentAct.steps[0];
 if(phase==='vrm'||phase==='player'){
  if(mode==='editor'){activePanel='story';selectedAct=0;selectedStep=0;line.characterId=vrm.id;line.cast.center={...line.cast.center,characterId:vrm.id,expressionWeights:{},props:[]};line.text='实时头像现在和原来的肩部照片一样：稍微侧一点，显示头部和肩膀。';renderSidebar();renderInspector();await updatePreview();}
  else {playing=true;playAct=0;playStep=0;preparedAct=-1;textSpeed=5;await showPlayStep();}
  await updateSpeakerPortrait(vrm.id,true);await wait(250);
  const record=stage.livePortrait.record,camera=stage.livePortrait.camera,head=record.vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(new THREE.Vector3());
  const scale=record.anchor.getWorldScale(new THREE.Vector3()).y,orientation=record.anchor.getWorldQuaternion(new THREE.Quaternion()),offset=camera.position.clone().sub(head).applyQuaternion(orientation.clone().invert()).divideScalar(scale);
  assert(camera.isOrthographicCamera,'没有使用原照片镜头');assert(offset.distanceTo(new THREE.Vector3(-.85,.05,1.7))<.01,'头像拍摄方向没有对齐');const portraitRect=stage.livePortrait.node.getBoundingClientRect();assert(Math.abs(camera.top/scale-(-.2+.4*Math.max(1,portraitRect.height/portraitRect.width)))<1e-8,'头像上方空间没有扩展');
  assert(stage.livePortrait.record===stage.visibleRecords.get(vrm.id),'没有复用场上 VRM');
  stage.startTalking(vrm.id,true);stage.talkingLetter('你');let mouth=false;
  for(let i=0;i<15;i++){await wait(50);if(['aa','ih','ou','ee','oh'].some(k=>record.vrm.expressionManager.getValue(k)>.05))mouth=true;}
  assert(mouth,'实时头像嘴型没有变化');stage.stopTalking();clearTyping();
  return {ok:true,samePhotoAngle:true,samePhotoScale:true,orthographic:true,cameraOffset:offset.toArray(),halfHeight:camera.top/scale,liveMouth:true,vrmOnly:true};
 }
 if(phase==='fbx'){
  playing=false;fbx.portraitId=png.id;fbx.portraitSource='manual';line.characterId=fbx.id;line.text='FBX 人物继续使用我上传的 PNG 头像。';await updatePreview();await wait(150);
  assert(!stage.livePortrait.record,'FBX 使用了实时头像');assert(document.querySelector('#speaker-portrait img').src===assetUrl(png),'FBX PNG 被替换');
  activePanel='characters';selectedCharacter=project.characters.indexOf(fbx);renderInspector();assert(document.querySelector('[data-action="capture-character-portrait"]'),'FBX 缺少重新生成头像按钮');activePanel='story';renderInspector();
  const count=project.assets.length;await ensureCharacterPortrait(fbx,true);assert(project.assets.length===count,'FBX 被自动生成头像');
  return {ok:true,fbxManualPng:true,manualPngPreserved:true,staticPng:true};
 }
 if(phase==='png'){
  const role={id:'photo-only-test',name:'图片角色',modelId:'',portraitId:png.id,portraitSource:'manual',autoMouth:true};project.characters.push(role);line.characterId=role.id;line.text='没有模型的角色，也继续显示上传的 PNG。';await updatePreview();await wait(150);
  assert(!stage.livePortrait.record&&document.querySelector('#speaker-portrait img').src===assetUrl(png),'图片角色头像被替换');
  return {ok:true,pngOnlyRole:true,noModelRequired:true};
 }
 if(phase==='export'){
  line.characterId=vrm.id;line.text='实时头像使用原来的肩部照片角度，嘴型和表情仍然同步。';await updatePreview();markDirty();await save();await bridge('exportGame',{folderName:'肩部头像试玩'});return {ok:true,exported:true};
 }
 throw Error('未知检查 '+phase);
};
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeRenderRegression=async phase=>{
  const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
  const hua=project.characters.find(c=>asset(c.modelId)?.type==='vrm'),fbx=project.characters.find(c=>asset(c.modelId)?.type==='fbxCharacter');
  assert(hua&&fbx,'需要 VRM 与 FBX 测试人物');
  const currentAct=project.acts[0],current=currentAct.steps[0];
  const setting=id=>({characterId:id,motionId:'',motionOptions:{},expressionWeights:{happy:.75},props:[],size:1,offsetX:0,offsetY:0,offsetZ:0,yaw:0,pitch:0});
  if(phase==='reopen'){
    const environment=project.environments.find(e=>e.id===currentAct.environmentId);assert(environment?.name==='自动保存验证环境'&&environment.revision>0,'工程包没有保留自动保存的场景');
    await updatePreview();assert(stage.livePortrait.record===stage.visibleRecords.get(hua.id),'重新打开后头像未同步');
    return {ok:true,autosaveArchiveReopened:true,revision:environment.revision,ambient:environment.lighting.ambientIntensity};
  }
  if(phase==='texture-sky'){
    const sky=stage.environmentRuntime.objects.get('regression-sky').children[0],canvas=document.createElement('canvas');canvas.width=64;canvas.height=32;
    const c=canvas.getContext('2d'),gradient=c.createLinearGradient(0,0,0,32);gradient.addColorStop(0,'#527faa');gradient.addColorStop(1,'#b8d8ed');c.fillStyle=gradient;c.fillRect(0,0,64,32);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;const oldMap=sky.material.map;sky.material.map=map;sky.material.needsUpdate=true;const pixels=[];
    try{for(const width of [0,1,2,3]){
      stage.setRenderSettings({outline:width});await wait(100);if(width)stage.outlineEffect.render(stage.scene,stage.camera);else stage.renderer.render(stage.scene,stage.camera);
      const surface=stage.renderer.domElement,check=document.createElement('canvas');check.width=surface.width;check.height=surface.height;const context=check.getContext('2d');context.drawImage(surface,0,0);
      const pixel=[...context.getImageData(Math.floor(surface.width*.94),Math.floor(surface.height*.12),1,1).data];pixels.push(pixel);
      assert(pixel.every((v,i)=>Math.abs(v-pixels[0][i])<=1),'带贴图天空在描边时改变颜色');
    }}finally{sky.material.map=oldMap;sky.material.needsUpdate=true;map.dispose();}
    return {ok:true,texturedSkyWidths:[0,1,2,3],pixels};
  }
  if(phase==='prepare'){
    const environment=project.environments.find(e=>e.id===currentAct.environmentId);
    assert(environment,'缺少环境');environment.name='天空与实时头像验证';environment.background='#86b8df';
    environment.camera={position:[0,1.3,4.3],target:[0,1.05,0],fov:32};environment.lighting={color:'#ffffff',intensity:2.2,ambientIntensity:.35};
    environment.nodes=[{id:'regression-ground',kind:'ground',name:'地面',position:[0,0,0],rotation:[-Math.PI/2,0,0],scale:[1,1,1],width:30,height:30,color:'#888888'},
      {id:'regression-sky',kind:'sky',name:'蓝色天空球',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],color:'#86b8df',assetId:''}];
    current.characterId=hua.id;current.text='天空球不会再被描边涂黑。这个实时头像和场上的我，使用同一个人物模型。';
    current.cast={left:setting(fbx.id),center:setting(hua.id),right:setting('')};
    project.render.outline=0;project.render.style='original';activePanel='story';selectedAct=0;selectedStep=0;renderSidebar();renderInspector();await updatePreview();
    markDirty();await save();await bridge('saveProjectAs',{project,name:'天空头像与自动保存验证'});return {ok:true,fixturePrepared:true};
  }
  if(phase.startsWith('outline-')){
    const width=Number(phase.split('-')[1]);project.render.outline=width;currentAct.render=null;
    stage.setRenderSettings(chapterRender(currentAct,project.render));await wait(400);
    const sky=stage.environmentRuntime.objects.get('regression-sky').children[0];
    assert(sky.material.userData.outlineParameters.visible===false,'天空仍参与描边');
    if(stage.outlineEffect.enabled)stage.outlineEffect.render(stage.scene,stage.camera);else stage.renderer.render(stage.scene,stage.camera);
    const canvas=stage.renderer.domElement,ctx=document.createElement('canvas');ctx.width=canvas.width;ctx.height=canvas.height;
    const c=ctx.getContext('2d');c.drawImage(canvas,0,0);const pixel=[...c.getImageData(Math.floor(canvas.width*.94),Math.floor(canvas.height*.12),1,1).data];
    assert(pixel[0]>75&&pixel[1]>100&&pixel[2]>120,'天空像素变黑 '+pixel);
    return {ok:true,width,skyPixel:pixel,skyOutlineExcluded:true};
  }
  if(phase==='dark'){
    const environment=project.environments.find(e=>e.id===currentAct.environmentId);environment.lighting.intensity=.08;environment.lighting.ambientIntensity=.015;
    await stage.setEnvironment(environment,project.assets);await wait(400);
    const materials=[...stage.visibleRecords.values()].flatMap(r=>[...r.materials.keys()]);assert(stage.ambientLight.intensity===.015,'补光没有随环境变化');
    assert(materials.every(m=>m.emissiveIntensity===undefined||m.emissiveIntensity===0),'人物仍有自发光');
    const mtoon=materials.filter(m=>m.isMToonMaterial);assert(mtoon.length>0&&mtoon.every(m=>m.matcapFactor.r===0&&m.parametricRimColorFactor.r===0),'VRM 固定高光仍亮');
    return {ok:true,ambient:stage.ambientLight.intensity,key:stage.keyLight.intensity,emissionOff:true,rimOff:true,matcapOff:true};
  }
  if(phase==='mouth'){
    const environment=project.environments.find(e=>e.id===currentAct.environmentId);environment.lighting={color:'#ffffff',intensity:2.2,ambientIntensity:.35};
    playing=true;playAct=0;playStep=0;preparedAct=-1;textSpeed=4;await showPlayStep();if(mode==='editor')startTyping(current.text,hua.id);await wait(450);
    const record=stage.visibleRecords.get(hua.id);assert(stage.livePortrait.record===record,'头像用了另一份模型');
    assert(stage.livePortrait.frames>0&&record.talkingMouth?.diagnostics().running,'头像没有实时渲染或嘴型没有启动');
    assert(record.vrm.expressionManager.getValue('happy')>.5,'表情未应用');
    let mouth=false;for(let n=0;n<15;n++){await wait(70);if(['aa','ih','ou','ee','oh'].some(k=>record.vrm.expressionManager.getValue(k)>.05))mouth=true;}
    assert(mouth,'没有实际嘴型变化');clearTyping();
    return {ok:true,sameModel:true,frames:stage.livePortrait.frames,actualMouthChanges:true,happy:record.vrm.expressionManager.getValue('happy'),castCount:stage.visibleRecords.size};
  }
  if(phase==='offstage'){
    current.cast={left:setting(fbx.id),center:setting(''),right:setting('')};await displayActStep(currentAct,current);await updateSpeakerPortrait(hua.id,true);await wait(250);
    const record=stage.livePortrait.record;assert(record&&!stage.visibleRecords.has(hua.id),'头像占用了场上位置');assert(record.vrm.scene.visible===false,'头像人物漏到主场景');
    stage.startTalking(hua.id,true);stage.talkingLetter('你');await wait(200);assert(record.talkingMouth?.diagnostics().running,'场外人物嘴型未启用');stage.stopTalking();
    return {ok:true,offstagePortrait:true,castCount:stage.visibleRecords.size,modelCount:stage.modelCache.size,noDuplicateModel:true};
  }
  if(phase==='fbx'){
    await updateSpeakerPortrait(fbx.id,true);await wait(200);assert(stage.livePortrait.record===null,'FBX 被替换成实时头像');
    const node=document.querySelector('#speaker-portrait');assert(!node.classList.contains('live-portrait'),'FBX 实时头像标记未清理');
    return {ok:true,fbxStaticPortrait:true,faceControlsUnchanged:true};
  }
  if(phase==='export'){
    playing=false;current.cast={left:setting(fbx.id),center:setting(hua.id),right:setting('')};await updatePreview();markDirty();await save();await bridge('exportGame',{folderName:'实时头像试玩'});
    return {ok:true,saved:true,exported:true};
  }
  if(phase==='player'){
    playing=true;playAct=0;playStep=0;preparedAct=-1;textSpeed=5;await showPlayStep();await wait(300);
    assert(stage.livePortrait.record===stage.visibleRecords.get(hua.id),'独立游戏头像没有同步');
    assert(stage.livePortrait.frames>0,'独立游戏头像未渲染');clearTyping();return {ok:true,standaloneLivePortrait:true,skyOutlineExcluded:true};
  }
  if(phase==='environment'){playing=false;activePanel='story';await updatePreview();await editEnvironment(currentAct);return {ok:true,opened:true};}
  throw Error('未知检查 '+phase);
};
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeSceneAnimations=async phase=>{
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const click=selector=>{const el=document.querySelector(selector);assert(el,`missing ${selector}`);el.click();};
  const field=(row,key,value)=>{const el=document.querySelector(`[data-scene-row="${row}"] [data-scene-field="${key}"]`);assert(el,'missing modal field');if(el.type==='checkbox')el.checked=value;else el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));};
  const barrel=id=>stage.environmentRuntime.objects.get(id)?.getObjectByName('Barrel');
  if(phase==='editor'){
    activePanel='story';selectedAct=1;selectedStep=0;renderSidebar();renderInspector();await updatePreview();
    assert(!document.querySelector('[data-action="edit-scene-animations"]'),'static scene must hide button');
    selectedAct=0;renderSidebar();renderInspector();await updatePreview();
    assert(sceneAnimationCatalog().length===2,'detect both animated instances');assert(sceneAnimationCatalog()[0].clips.length===2,'detect two clips');
    editorHistory.reset();const before=JSON.stringify(step().sceneAnimations);
    click('[data-action="edit-scene-animations"]');field(0,'delaySeconds',2);click('[data-scene-preview]');
    for(let i=0;i<100&&!stage.environmentRuntime.animations.pending.length;i++)await wait(50);
    assert(stage.environmentRuntime.animations.pending[0].delaySeconds===2,'trial uses draft delay');
    click('[data-scene-close]');assert(JSON.stringify(step().sceneAnimations)===before,'cancel changed project');assert(stage.environmentRuntime.animations.sounds.length===0,'cancel trial sound');
    click('[data-action="edit-scene-animations"]');field(0,'enabled',true);field(0,'delaySeconds',1);field(0,'soundId','boom');field(1,'enabled',false);click('[data-scene-save]');
    assert(step().sceneAnimations[0].delaySeconds===1&&step().sceneAnimations[0].soundId==='boom','save selected settings');
    assert(step().sceneAnimations.length===2&&!step().sceneAnimations[1].enabled,'retain disabled object');
    await restoreEditorHistory(-1);assert(JSON.stringify(step().sceneAnimations)===before,'undo settings');await restoreEditorHistory(1);assert(step().sceneAnimations.length===2,'redo settings');
    click('[data-action="duplicate-step"]');assert(JSON.stringify(step().sceneAnimations)===JSON.stringify(act().steps[0].sceneAnimations),'duplicate settings');await restoreEditorHistory(-1);
    selectedAct=0;selectedStep=0;renderSidebar();renderInspector();await updatePreview();click('[data-action="edit-scene-animations"]');
    return {ok:true,phase,staticButtonHidden:true,animatedInstances:2,clips:sceneAnimationCatalog()[0].clips,modalCancel:true,saveUndoRedo:true,duplicate:true,cues:step().sceneAnimations};
  }
  if(phase==='archive-export'){
    sceneAnimationDialog.close(false);stage.environmentRuntime.animations.stop();await save();
    const archive=await bridge('saveProjectAs',{project:structuredClone(project),name:'GLB动画开火示例'});
    const game=await bridge('exportGame',{folderName:'直接试玩'});return {ok:true,phase,archive,game};
  }
  if(phase==='reopen'){
    activePanel='story';selectedAct=0;selectedStep=0;renderSidebar();renderInspector();await updatePreview();
    assert(sceneAnimationCatalog().length===2,'archive clips');assert(step().sceneAnimations[0].soundId==='boom'&&step().sceneAnimations[0].delaySeconds===1,'archive settings');
    click('[data-action="edit-scene-animations"]');return {ok:true,phase,cues:step().sceneAnimations,catalog:sceneAnimationCatalog()};
  }
  sceneAnimationDialog.close(false);playing=true;playAct=0;playStep=0;preparedAct=-1;await showPlayStep();
  const player=stage.environmentRuntime.animations;
  assert(player.pending.length===1,'start pending cue');await wait(350);assert(player.active.length===0&&player.sounds.length===0,'no early motion or sound');
  const elapsed=player.pending[0].elapsed;saveModalMode='settings';await wait(400);assert(Math.abs(player.pending[0].elapsed-elapsed)<.15,'player menu must pause delay');saveModalMode='';
  let reached=false;for(let i=0;i<80;i++){await wait(25);if(player.active.length){reached=true;break;}}assert(reached,'delayed animation never starts');assert(player.sounds.length===1,'sound did not start with animation');
  await wait(120);assert(barrel('cannon-left').position.z>.1,'actual barrel recoil missing');assert(barrel('cannon-right').position.z===0,'second instance moved incorrectly');
  const effect=[...activeEffects].find(sound=>sound.src.includes('boom.wav'));assert(effect&&!effect.paused&&effect.currentTime>0,'actual audio did not play: '+JSON.stringify({error:window.__lastEffectError,effects:[...activeEffects].map(s=>({src:s.src,time:s.currentTime,paused:s.paused,ended:s.ended,state:s.readyState,error:s.error?.code}))}));
  const audioTime=effect.currentTime,recoil=barrel('cannon-left').position.z;saveModalMode='settings';await wait(250);
  assert(effect.paused&&Math.abs(effect.currentTime-audioTime)<.1,'menu must pause actual audio');assert(Math.abs(barrel('cannon-left').position.z-recoil)<.04,'menu must pause animated model');saveModalMode='';await wait(60);
  const initialSounds=player.sounds.length;playStep=1;await showPlayStep();assert(player.sounds.length===0&&player.active.length===0,'next line cancellation');assert(barrel('cannon-left').position.z===0,'next line restores pose');
  playStep=0;await showPlayStep();await wait(150);playStep=1;await showPlayStep();await wait(1200);assert(player.sounds.length===0&&player.active.length===0,'late fire leaked into next line');
  playStep=2;await showPlayStep();await wait(250);const turret=stage.environmentRuntime.objects.get('cannon-right').getObjectByName('Turret');assert(Math.abs(turret.quaternion.y)>.02,'second clip not playing');assert(player.sounds.length===0,'silent clip played sound');
  playAct=1;playStep=0;await showPlayStep();assert(stage.environmentRuntime.animations.catalog().length===0,'switch static scene clips');
  playAct=0;playStep=0;await showPlayStep();for(let i=0;i<80;i++){await wait(25);if(stage.environmentRuntime.animations.active.length)break;}await wait(100);
  return {ok:true,phase,delayedStart:true,menuPause:true,actualAudioPlayed:true,actualAudioPaused:true,synchronizedSound:initialSounds===1,barrelRecoil:barrel('cannon-left').position.z,independentInstances:true,nextLineCancellation:true,lateSoundCancelled:true,secondClip:true,staticSceneSwitch:true,exported:mode==='player'};
};
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeMixamo=async phase=>{
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 const actor=project.characters.find(c=>phase==='vrm'?asset(c.modelId)?.type==='vrm':isFbxModel(c.modelId));
 const motion=asset('mixamo-aim-test');assert(actor&&motion,'Missing Mixamo test fixture');
 actor.galleryMotionId=motion.id;actor.galleryPoseFrame=1;
 selectedCharacter=project.characters.indexOf(actor);activePanel='characters';
 renderSidebar();renderInspector();await updatePreview();
 const record=stage.visibleRecords.get(`gallery:${actor.id}`);assert(record?.currentAction,'Animation did not load');
 stage.setMotionPoseFrame(1);stage.restoreFootPose(record);record.footLock=null;
 for(const prop of record.attachedProps.values())prop.root.visible=phase==='binding';
 document.querySelector('[data-action=binding-view-open]').click();
 for(let i=0;i<100&&!stage.bindingView.enabled;i++)await new Promise(resolve=>setTimeout(resolve,50));
 stage.setMotionPoseFrame(1);stage.bindingView.focusModel(record);
 const center=stage.bindingView.controls.target.clone(),distance=stage.camera.position.distanceTo(center);
 center.y+=.12;
 stage.bindingView.look(center,distance*1.4,new THREE.Vector3(-.6,.12,1));
 document.querySelector('.inspector').scrollTop=0;
 const source=await stage.fbxLoader.loadAsync(assetUrl(motion));
 const hips=record.vrm.humanoid.getNormalizedBoneNode('hips'),sourceHips=source.getObjectByName('mixamorigHips')||source.getObjectByName('mixamorig:Hips');
 const hipTrack=source.animations[0].tracks.find(t=>t.name===sourceHips.name+'.position');
 const sourceFirstY=hipTrack.values[1],targetRestY=record.vrm.isFbx?record.vrm.rest.get(hips).position.y:record.vrm.humanoid.normalizedRestPose.hips.position[1];
 const expectedHipY=sourceFirstY*targetRestY/sourceHips.position.y,hipError=Math.abs(hips.position.y-expectedHipY);
 let maximumErrorDegrees=0;
 if(record.vrm.isFbx){
   for(const name of ['LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand']){
     const src=source.getObjectByName('mixamorig'+name)||source.getObjectByName('mixamorig:'+name);
     const track=source.animations[0].tracks.find(t=>t.name===src.name+'.quaternion');
     const error=record.vrm.bones.get(name).quaternion.clone().normalize().angleTo(new THREE.Quaternion().fromArray(track.values).normalize())*180/Math.PI;
     maximumErrorDegrees=Math.max(maximumErrorDegrees,error);
   }
 }
 const props=[...record.attachedProps.values()];
 const result={ok:phase==='before'||(hipError<.0001&&maximumErrorDegrees<.01),phase,modelType:asset(actor.modelId).type,motion:motion.name,hipY:hips.position.y,expectedHipY,hipError,maximumErrorDegrees,props:props.length,attachedToHand:props.every(p=>p.root.parent===p.bone),frame:1};
 if(phase!=='before'){assert(result.ok,'Mixamo body pose differs from source: '+JSON.stringify(result));assert(result.attachedToHand,'Attachment no longer follows its joint');}
 const size=stage.renderer.getSize(new THREE.Vector2()),oldAspect=stage.camera.aspect;
 stage.renderer.setSize(1280,720,false);stage.camera.aspect=16/9;stage.camera.updateProjectionMatrix();
 stage.renderer.render(stage.scene,stage.camera);
 window.__mixamoPng=stage.renderer.domElement.toDataURL('image/png').split(',')[1];
 stage.renderer.setSize(size.x,size.y,false);stage.camera.aspect=oldAspect;stage.camera.updateProjectionMatrix();
 return result;
};
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeProps=async phase=>{
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 const fbx=project.characters.find(c=>isFbxModel(c.modelId)),vrm=project.characters.find(c=>asset(c.modelId)?.type==='vrm');
 const gun=asset('test-gun');assert(fbx&&vrm&&gun,'Missing prop fixture');
 const make=(character)=>({id:'held-'+character.id,name:'测试冲锋枪',assetId:gun.id,bone:'rightHand',position:[0,0,0],rotation:[0,90,0],scale:[1,1,1]});
 const display=async()=>{renderSidebar();renderInspector();await updatePreview();};
 if(phase==='fbx-binding'||phase==='vrm-binding'){
   const actor=phase==='fbx-binding'?fbx:vrm;actor.props=[make(actor)];selectedCharacter=project.characters.indexOf(actor);activePanel='characters';await display();
   const base=`[data-prop-transform="${actor.props[0].id}"][data-vector=position][data-axis="0"]`;
   const coarse=document.querySelector(base+'[data-mode=coarse]'),fine=document.querySelector(base+'[data-mode=fine]');
   assert(coarse&&fine,'Missing coarse/fine controls');coarse.value='.2';coarse.dispatchEvent(new Event('input',{bubbles:true}));
   fine.value='1';fine.dispatchEvent(new Event('input',{bubbles:true}));fine.dispatchEvent(new Event('change',{bubbles:true}));
   assert(Math.abs(actor.props[0].position[0]-.201)<1e-8 && fine.value==='0','Fine position increment failed');
   for(const [kind,axis,base,expected]of [['rotation',0,0,.1],['scale',2,1,1.001]]){
     const selector=`[data-prop-transform="${actor.props[0].id}"][data-vector="${kind}"][data-axis="${axis}"]`;
     const c=document.querySelector(selector+'[data-mode=coarse]'),f=document.querySelector(selector+'[data-mode=fine]');
     c.value=String(base);c.dispatchEvent(new Event('input',{bubbles:true}));f.value='1';f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}));
     assert(Math.abs(actor.props[0][kind][axis]-expected)<1e-8,kind+' fine adjustment failed');
   }

   await updatePreview();document.querySelector('.prop-editor').scrollIntoView({block:'start'});const record=stage.visibleRecords.get(`gallery:${actor.id}`),prop=record.attachedProps.get(actor.props[0].id);
   assert(prop.root.parent===prop.bone && prop.bone.isBone,'Prop not attached to a bone');
   for(const select of document.querySelectorAll('[data-prop-field=bone]')){
     const value=select.value;select.innerHTML=availablePropBones(record).map(b=>`<option value="${escape(b.value)}">${escape(b.label)}</option>`).join('');select.value=value;
   }
   return {ok:true,actor:asset(actor.modelId).type,position:actor.props[0].position,coarseFineControls:true,bone:prop.bone.name,attachmentParent:true,worldPosition:prop.root.getWorldPosition(new THREE.Vector3()).toArray()};
 }
 if(phase==='model-switch'){
   const original=fbx.modelId;selectedCharacter=project.characters.indexOf(fbx);activePanel='characters';fbx.modelId=vrm.modelId;await display();
   assert(!stage.visibleRecords.get(`gallery:${fbx.id}`).vrm.isFbx,'Switch to VRM kept the FBX rig');
   fbx.modelId=original;await display();assert(stage.visibleRecords.get(`gallery:${fbx.id}`).vrm.isFbx,'Switch back to FBX kept the VRM rig');
   assert(stage.visibleRecords.get(`gallery:${fbx.id}`).attachedProps.size===1,'Binding lost after model replacement');return {ok:true,modelReplacement:true};
 }
 if(phase==='dialogue-visible'){
   activePanel='story';selectedAct=0;selectedStep=0;
   const cast=emptyDialogueCast();cast.left={characterId:fbx.id,size:1.15,motionId:'walk-test',props:[fbx.props[0].id]};cast.center={characterId:vrm.id,size:1.15,motionId:'',props:[vrm.props[0].id]};
   act().steps=[{id:'prop-one',characterId:fbx.id,text:'我现在拿着冲锋枪。物品会跟着手上的动作移动。',speaker:'',cast,choices:[],voiceId:''}];
   await display();assert(!document.querySelector('[data-field="step.position"]')&&!document.querySelector('[data-field="step.motionId"]')&&!document.querySelector('[data-adjust]'),'Duplicate dialogue controls remain');
   const record=stage.visibleRecords.get(fbx.id),prop=record.attachedProps.get(fbx.props[0].id),before=prop.root.getWorldPosition(new THREE.Vector3());
   await new Promise(resolve=>setTimeout(resolve,750));const after=prop.root.getWorldPosition(new THREE.Vector3());
   assert(prop.root.parent===prop.bone,'Animated prop parent changed');assert(before.distanceTo(after)>.001,'Prop did not move with body animation');
   const first=JSON.stringify(step().cast),second=structuredClone(step());second.id='prop-two';second.characterId=vrm.id;second.text='这一句可以收起枪，也可以更换同一幕中的人物。';act().steps.push(second);
   return {ok:true,actors:stage.visibleRecords.size,animatedMovement:before.distanceTo(after),gunVisibleOnFbx:record.attachedProps.size,gunVisibleOnVrm:stage.visibleRecords.get(vrm.id).attachedProps.size,first};
 }
 if(phase==='one-shot'){
   selectedStep=0;activePanel='story';step().cast.left.motionOptions={loop:false,startFrame:1,endFrame:2,after:'idle'};await display();
   await new Promise(resolve=>setTimeout(resolve,450));assert(stage.visibleRecords.get(fbx.id).currentMotionId===null,'Single action did not return to idle');
   step().cast.left.motionOptions={};await updatePreview();return {ok:true,afterActionIdle:true};
 }
 if(phase==='dialogue-hidden'){
   selectedStep=1;activePanel='story';await display();const first=JSON.stringify(act().steps[0].cast);
   const toggle=document.querySelector(`[data-cast-prop=left][data-prop-id="${fbx.props[0].id}"]`);toggle.checked=false;toggle.dispatchEvent(new Event('input',{bubbles:true}));
   const offset=document.querySelector('[data-cast-adjust="left.offsetZ"][type=number]');offset.value='.03';offset.dispatchEvent(new Event('input',{bubbles:true}));
   await updatePreview();assert(JSON.stringify(act().steps[0].cast)===first,'Second dialogue changed first dialogue');
   assert(stage.visibleRecords.get(fbx.id).attachedProps.size===0,'Hidden gun is still visible');assert(stage.visibleRecords.get(vrm.id).attachedProps.size===1,'Other character gun was hidden');
   return {ok:true,dialoguesIndependent:true,hiddenOnFbx:true,visibleOnVrm:true,secondDepth:step().cast.left.offsetZ};
 }
 if(phase==='dialogue-roster'){
   const extra=project.characters.find(c=>c.modelId && c!==fbx && c!==vrm);assert(extra,'Missing third actor');
   const line={id:'prop-three',characterId:fbx.id,text:'同一幕的下一句换了在场人物。',cast:emptyDialogueCast(),choices:[],voiceId:''};line.cast.left.characterId=extra.id;line.cast.center.characterId=fbx.id;
   act().steps.push(line);selectedStep=2;await display();assert(stage.visibleRecords.has(extra.id)&&stage.visibleRecords.has(fbx.id)&&!stage.visibleRecords.has(vrm.id),'Previous roster leaked into new dialogue');
   assert(stage.visibleRecords.get(fbx.id).attachedProps.size===0,'Previous gun visibility leaked');
   const empty={id:'prop-four',characterId:fbx.id,text:'人物可以在场外说话，这一句的舞台没有人物。',cast:emptyDialogueCast(),choices:[],voiceId:''};act().steps.push(empty);selectedStep=3;await display();assert(stage.visibleRecords.size===0,'Empty stage has a ghost actor');
   await save();return {ok:true,rosterReplacement:true,noGhostActor:true,saved:true,stepCount:act().steps.length};
 }
 if(phase==='title-multi'){
   const extra=project.characters.find(c=>c.modelId&&c!==fbx&&c!==vrm);assert(extra,'Missing third title model');
   project.title.actors=[fbx,vrm,extra,fbx].map((role,index)=>({...newTitleActor('title-test-'+index,role.modelId,index),characterId:role.id,offsetX:[-1.1,-.4,.4,1.1][index],offsetY:0,offsetZ:index===3?-.4:0,size:1.05,motionId:'idle',props:role===fbx||role===vrm?[role.props[0].id]:[]}));
   project.title.cameraAngle=0;activePanel='title';await display();
   const dropdown=document.querySelector('[data-title-field=logoImageId]');assert(dropdown.querySelector('[value="__none__"]'),'Missing blank logo choice');
   dropdown.value='__none__';dropdown.dispatchEvent(new Event('input',{bubbles:true}));await updatePreview();
   assert(!document.querySelector('.title-logo-region')&&!document.querySelector('#project-name'),'Blank title panel remains');
   assert(stage.visibleRecords.size===4,'Title did not load four actors');
   const a=stage.visibleRecords.get('title:title-test-0'),b=stage.visibleRecords.get('title:title-test-3');assert(a.vrm.scene!==b.vrm.scene&&a.anchor!==b.anchor,'Repeated FBX model shares its transform');
   const before=JSON.stringify(project.title.actors[0]);const z=document.querySelector('[data-title-actor-id="title-test-1"][data-title-actor-adjust=offsetZ][type=number]');z.value='.03';z.dispatchEvent(new Event('input',{bubbles:true}));await updatePreview();
   assert(JSON.stringify(project.title.actors[0])===before&&project.title.actors[1].offsetZ===.03,'Title transforms are not independent');
   const toggle=document.querySelector('[data-title-actor-id="title-test-0"][data-title-actor-prop]');toggle.checked=false;toggle.dispatchEvent(new Event('input',{bubbles:true}));await updatePreview();
   assert(stage.visibleRecords.get('title:title-test-0').attachedProps.size===0&&stage.visibleRecords.get('title:title-test-3').attachedProps.size===1,'Repeated actors share prop visibility');
   toggle.checked=true;toggle.dispatchEvent(new Event('input',{bubbles:true}));await updatePreview();
   document.querySelector('[data-action=add-title-actor]').click();await updatePreview();assert(project.title.actors.length===5&&stage.visibleRecords.size===5,'Adding title actor failed');
   const last=project.title.actors.at(-1);document.querySelector(`[data-action=delete-title-actor][data-id="${last.id}"]`).click();await updatePreview();assert(project.title.actors.length===4&&stage.visibleRecords.size===4,'Removing title actor failed');
   assert(document.querySelectorAll('#title-preview .title-bottom-menu span').length===7,'Title buttons disappeared');
   await save();document.querySelector('.inspector').scrollTop=0;
   return {ok:true,actors:4,blankLogo:true,independentTransforms:true,repeatedModelIndependent:true,independentProps:true,addRemove:true,menuButtons:7};
 }
 if(phase==='finger-bindings'){
   const results=[];
   for(const actor of [fbx,vrm]){
     selectedCharacter=project.characters.indexOf(actor);activePanel='characters';await display();
     const record=stage.visibleRecords.get(`gallery:${actor.id}`),original=actor.props[0].bone;
     const fingers=availablePropBones(record).filter(b=>/^(left|right)(Thumb|Index|Middle|Ring|Little)/.test(b.value));
     assert(fingers.some(b=>b.value==='rightIndexDistal')&&fingers.some(b=>b.value==='leftThumbProximal'),'Test model finger bones missing');
     for(const name of ['rightHand','leftHand','rightIndexDistal','leftThumbProximal']){
       const select=document.querySelector(`[data-prop-field=bone][data-prop-id="${actor.props[0].id}"]`);
       assert(select.querySelector(`[value="${name}"]`),'Missing bone in picker');select.value=name;select.dispatchEvent(new Event('input',{bubbles:true}));await updatePreview();
       const prop=record.attachedProps.get(actor.props[0].id),bone=propBone(record,name);assert(prop.root.parent===bone,'Prop attached to wrong hand/finger');
       const moving=record.vrm.humanoid.getNormalizedBoneNode(name),saved=moving.quaternion.clone(),before=prop.root.getWorldQuaternion(new THREE.Quaternion());
       moving.rotateZ(.2);record.vrm.update(0);stage.characterProps.update(record);const after=prop.root.getWorldQuaternion(new THREE.Quaternion());
       assert(before.angleTo(after)>.05,'Prop did not follow finger rotation');moving.quaternion.copy(saved);record.vrm.update(0);stage.characterProps.update(record);
     }
     actor.props[0].bone=original;await updatePreview();results.push({modelType:asset(actor.modelId).type,fingerChoices:fingers.length,handAndFingerAttachment:true,followJointRotation:true});
   }
   return {ok:true,models:results};
 }
 if(phase==='binding-view'){
   selectedCharacter=project.characters.indexOf(fbx);activePanel='characters';await display();
   const before=JSON.stringify(project);document.querySelector('[data-action=binding-view-open]').click();
   for(let i=0;i<100&&!stage.bindingView.enabled;i++)await new Promise(resolve=>setTimeout(resolve,50));
   assert(stage.bindingView.enabled&&document.querySelector('.binding-view-mode'),'Binding camera not enabled');
   const canvas=stage.renderer.domElement,camera=stage.camera,rect=canvas.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
   assert(document.elementFromPoint(x,y)===canvas,'Binding overlay intercepts the canvas');
   const set=canvas.setPointerCapture,release=canvas.releasePointerCapture;canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};
   const drag=(shift=false)=>{canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:100,pointerType:'mouse',button:0,clientX:x,clientY:y,shiftKey:shift,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:100,pointerType:'mouse',button:0,buttons:1,clientX:x+40,clientY:y+20,shiftKey:shift,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointerup',{pointerId:100,pointerType:'mouse',button:0,clientX:x+40,clientY:y+20,shiftKey:shift,bubbles:true}));};
   const start=camera.position.clone();drag();assert(camera.position.distanceTo(start)>.01,'Dragging did not rotate view');
   const target=stage.bindingView.controls.target.clone();drag(true);assert(stage.bindingView.controls.target.distanceTo(target)>.01,'Shift drag did not pan');
   const distance=camera.position.distanceTo(stage.bindingView.controls.target);canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:x,clientY:y,bubbles:true,cancelable:true}));assert(camera.position.distanceTo(stage.bindingView.controls.target)<distance,'Wheel did not zoom');
   canvas.setPointerCapture=set;canvas.releasePointerCapture=release;
   document.querySelector('[data-action=binding-view-bone]').click();await updatePreview();await new Promise(resolve=>setTimeout(resolve,200));
   const record=stage.visibleRecords.get(`gallery:${fbx.id}`),bone=propBone(record,fbx.props[0].bone);assert(stage.bindingView.controls.target.distanceTo(bone.getWorldPosition(new THREE.Vector3()))<.001,'Focus missed binding joint');
   const position=camera.position.clone(),aim=stage.bindingView.controls.target.clone();
   const fine=document.querySelector(`[data-prop-transform="${fbx.props[0].id}"][data-vector=position][data-axis="0"][data-mode=fine]`);fine.value='1';fine.dispatchEvent(new Event('input',{bubbles:true}));fine.dispatchEvent(new Event('change',{bubbles:true}));await updatePreview();
   assert(camera.position.distanceTo(position)<1e-8&&stage.bindingView.controls.target.distanceTo(aim)<1e-8,'Fine adjustment reset the camera');
   fbx.props[0].position[0]-=.001;await updatePreview();assert(JSON.stringify(project)===before,'Camera inspection changed saved actor transforms');
   stage.setRenderSettings({...project.render,antialias:'off'});await updatePreview();
   assert(stage.bindingView.enabled&&stage.bindingView.canvas===stage.renderer.domElement,'Changing render quality detached view controls');
   stage.bindingView.focusBone(propBone(record,fbx.props[0].bone));
   assert(document.querySelector('#title-preview').classList.contains('hidden'),'Title menu covers binding view');
   renderInspector();document.querySelector('.prop-editor').scrollIntoView({block:'start'});await save();
   return {ok:true,fullViewport:true,rotate:true,pan:true,zoom:true,focusBone:true,adjustmentPreservesView:true,actorUnchanged:true,renderQualityCompatible:true};
 }
 if(phase==='binding-view-exit'){
   activePanel='story';selectedStep=0;await display();assert(!stage.bindingView.enabled&&!document.querySelector('.binding-view-mode'),'Inspection camera leaked into game scene');
   const env=project.environments.find(e=>e.id===act().environmentId);assert(stage.camera.position.distanceTo(new THREE.Vector3(...env.camera.position))<1e-8,'Game camera was changed by inspection');
   return {ok:true,gameCameraRestored:true};
 }
 if(phase==='player-props'){
   assert(mode==='player','Not a standalone player');await showTitleScene(true);
   assert(stage.visibleRecords.size===4&&!document.querySelector('#player-start .title-logo-region'),'Exported title actors or blank logo lost');
   assert(document.querySelectorAll('#player-start .title-bottom-menu button').length===7,'Exported title menu lost');
   document.querySelector('#player-start [data-action=play]').click();
   for(let i=0;i<200&&(stage.visibleRecords.get(fbx.id)?.attachedProps?.size!==1||stage.visibleRecords.get(vrm.id)?.attachedProps?.size!==1||transitioning);i++)await new Promise(resolve=>setTimeout(resolve,100));
   assert(stage.visibleRecords.get(fbx.id)?.attachedProps?.size===1&&stage.visibleRecords.get(vrm.id)?.attachedProps?.size===1,'Exported dialogue prop not visible');
   return {ok:true,standaloneTitleActors:4,blankLogo:true,menuButtons:7,standaloneDialogueProps:true};
 }
 if(phase==='archive-export'){
   project.name='物品绑定与逐句登场示例';await save();
   const archive=await bridge('saveProjectAs',{project:structuredClone(project),name:'物品绑定与逐句登场示例'});
   const game=await bridge('exportGame',{folderName:'直接试玩'});return {ok:true,archive,game};
 }
 if(phase==='reopen'){
   assert(project.dialogueCastVersion===1 && act().steps.length===4 && !act().cast,'Dialogue structure was not saved');
   assert(Math.abs(act().steps[1].cast.left.offsetZ-.03)<1e-8 && act().steps[0].cast.left.offsetZ!==.03,'Dialogue transforms were not preserved');
   assert(project.title.actors.length===4&&project.title.logoImageId==='__none__'&&project.title.actors[1].offsetZ===.03,'Title settings were not saved');
   selectedStep=0;activePanel='story';await display();assert(stage.visibleRecords.get(fbx.id).attachedProps.size===1 && stage.visibleRecords.get(vrm.id).attachedProps.size===1,'Saved attachments were not restored');
   return {ok:true,reopened:true,propsSaved:true,dialogueCastSaved:true,titleActorsSaved:true};
 }
 throw Error('Unknown prop smoke phase');
};
if(new URLSearchParams(location.search).has('smoke')) {
 window.__vrmSmokeEnvironmentOpen=async()=>{
   const owner=act();owner.environmentId=project.environments[0]?.id;
   owner.steps[0].text='环境保存期间保留的对白';
   await editEnvironment(owner);return {opened:true,id:owner.environmentId};
 };
 window.__vrmSmokeEnvironmentCheck=async()=>{
   await updatePreview();const env=project.environments.find(e=>e.id===act().environmentId);
   if(env.name!=='窗口保存验证'||env.nodes.length<2||env.revision!==1||act().steps[0].text!=='环境保存期间保留的对白'||stage.element.style.visibility!=='visible')throw Error('环境保存或风景显示验证失败');
   activePanel='characters';selectedCharacter=0;renderInspector();
   if(isFbxModel(project.characters[0]?.modelId)&&document.querySelector('[data-field="character.autoMouth"]'))throw Error('FBX 嘴型选项仍显示');
   const actor=project.characters[0];const record=await stage.loadModel(asset(actor?.modelId),actor?.id);
   const motion=project.assets.find(a=>a.type==='motion'&&a.id==='fbx-motion');if(motion){const clip=await stage.prepareClip(asset(actor.modelId),motion,actor.id);if(!clip?.tracks.length)throw Error('FBX 动作没有成功对应');await stage.show(asset(actor.modelId),motion,{},'center',{},actor.id);}
   await new Promise(resolve=>setTimeout(resolve,1500));
   if(stageError)throw Error(stageError);let meshes=0,loadedMaps=0;record.vrm.scene.traverse(o=>{if(o.isSkinnedMesh)meshes++;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.map?.image?.width>0)loadedMaps++;});if(!meshes||!loadedMaps)throw Error('FBX 人物或贴图未显示');
   return {ok:true,revision:env.revision,nodeCount:env.nodes.length,canvasVisible:stage.element.style.visibility,dialoguePreserved:true,fbxMouthHidden:true,fbxSkinnedMeshes:meshes,loadedTextureMaps:loadedMaps,mixamoMotionTracks:stage.activeRecord.currentAction.getClip().tracks.length};
 };
}

async function editEnvironment(owner){
  project.environments ||= [];let env=project.environments.find(e=>e.id===owner.environmentId);
  if(!env){env=createEnvironment((owner.name||'标题')+'场景');project.environments.push(env);owner.environmentId=env.id;markDirty({label:'新建 3D 环境'});renderInspector();}
  for(const e of project.environments)if(!environmentBaselines.has(e.id))environmentBaselines.set(e.id,JSON.stringify(e));
  const result=await bridge('openEnvironment',{projectId:project.id,environment:structuredClone(env),environments:structuredClone(project.environments),environmentLibrary:structuredClone(project.environmentLibrary||{folders:[],assignments:{}}),referenceSettings:structuredClone(owner===project.title?{}:(step()?.cast||owner.steps?.[0]?.cast||{})),referenceMultiple:Object.values(step()?.cast||owner.steps?.[0]?.cast||{}).filter(s=>s.characterId).length>1,assets:structuredClone(project.assets)});if(result.created)environmentBaselines=new Map(project.environments.map(e=>[e.id,JSON.stringify(e)]));
}
async function openAgentEnvironment(env){
  const result=await bridge('openEnvironment',{projectId:project.id,environment:structuredClone(env),environments:structuredClone(project.environments),environmentLibrary:structuredClone(project.environmentLibrary||{folders:[],assignments:{}}),assets:structuredClone(project.assets)});
  if(result.created)environmentBaselines=new Map(project.environments.map(e=>[e.id,JSON.stringify(e)]));
  return result;
}
async function refreshAgentEnvironmentWindow(options={}){
  const result=await bridge('agentEnvironmentControl',{command:'refresh',keepLocked:options.keepLocked===true,projectId:project.id,environments:structuredClone(project.environments),environmentLibrary:structuredClone(project.environmentLibrary||{folders:[],assignments:{}}),assets:structuredClone(project.assets)});
  if(result.opened)environmentBaselines=new Map(project.environments.map(e=>[e.id,JSON.stringify(e)]));
  return result;
}
function sceneAnimationCatalog() {
  const runtime=stage?.environmentRuntime;
  return activePanel==='story' && step() && runtime && runtime.environmentId===act()?.environmentId ? runtime.animations.catalog() : [];
}
function sceneAnimationKey(owner,current) { return JSON.stringify([project.id,owner?.id,owner?.environmentId,current?.id,current?.sceneAnimations||[]]); }
function refreshSceneAnimationButton() {
  const host=document.querySelector('#scene-animation-controls');if(!host)return;
  const catalog=sceneAnimationCatalog();
  host.innerHTML=catalog.length?`<button class="scene-animation-trigger" data-action="edit-scene-animations">场景动画 · ${catalog.length} 个物体</button><p class="tip">设置这一句是否播放动画、延迟和声音。</p>`:'';
}
let sceneSoundRequest=0;
function cancelSceneAnimations(){sceneSoundRequest++;stage?.environmentRuntime.animations.stop();}
function prepareSceneAnimationSound(id){
  const item=asset(id);if(item?.type!=='audio')return Promise.resolve(null);
  const sound=new Audio(assetUrl(item));sound.preload='auto';
  return new Promise(resolve=>{
    let timer;const ready=()=>{clearTimeout(timer);sound.removeEventListener('canplay',ready);sound.removeEventListener('error',ready);resolve(sound);};
    sound.addEventListener('canplay',ready,{once:true});sound.addEventListener('error',ready,{once:true});timer=setTimeout(ready,5000);sound.load();
  });
}
function sceneAnimationSound(id,preparedSound) {
  const sound=playEffect(id,preparedSound);if(!sound)return null;
  let stopped=false,resume=false;
  return {stop(){stopped=true;sound.pause();sound.currentTime=0;activeEffects.delete(sound);},
    pause(){resume=!sound.paused&&!sound.ended;sound.pause();},resume(){if(!stopped&&resume)sound.play().catch(()=>{});resume=false;}};
}
async function playSceneAnimations(owner,current,{sound=false,force=false,cues=current?.sceneAnimations}={}) {
  const runtime=stage?.environmentRuntime;if(!runtime||runtime.environmentId!==owner?.environmentId)return;
  const key=sceneAnimationKey(owner,current);if(!force&&runtime.animations.key===key)return;
  cues=normalizeSceneAnimations(cues,runtime.animations.catalog(),project.assets);
  const token=++sceneSoundRequest;runtime.animations.stop();const prepared=new Map();
  if(sound){
    await Promise.all((Array.isArray(cues)?cues:[]).filter(c=>c?.enabled&&c.soundId).map(async cue=>{prepared.set(cue.nodeId,await prepareSceneAnimationSound(cue.soundId));}));
    if(token!==sceneSoundRequest||runtime!==stage?.environmentRuntime||runtime.environmentId!==owner?.environmentId){for(const effect of prepared.values())if(effect){effect.pause();effect.removeAttribute('src');effect.load();}return;}
  }
  runtime.animations.play(cues,project.assets,{key,sound:sound?(id,nodeId)=>sceneAnimationSound(id,prepared.get(nodeId)):null,force:true});
}
const sceneAnimationDialog=createSceneAnimationDialog({
  save(cues,owner){
    if(act()?.id!==owner.actId||step()?.id!==owner.stepId){toast('对白已切换，请重新打开动画设置。',true);return;}
    editorHistory.seal();editorHistory.begin();step().sceneAnimations=cues;
    markDirty({label:'设置本句场景动画'});refreshSceneAnimationButton();playSceneAnimations(act(),step(),{force:true});toast('已保存本句的场景动画');
  },
  preview(cues,owner){if(act()?.id===owner.actId&&step()?.id===owner.stepId)playSceneAnimations(act(),step(),{cues,sound:true,force:true});},
  stop(restore){cancelSceneAnimations();if(restore&&!playing&&activePanel==='story')playSceneAnimations(act(),step(),{force:true});}
});
async function showEnvironment(owner){const env=project.environments?.find(e=>e.id===owner?.environmentId);await stage.setEnvironment(env,project.assets);return Boolean(env);}
const isFbxModel=id=>asset(id)?.type==='fbxCharacter';
const isLiveModel=id=>['vrm','mmdCharacter'].includes(asset(id)?.type);
const actorModels=()=>project.assets.filter(a=>['vrm','fbxCharacter','mmdCharacter'].includes(a.type));
function defaultProject(name) {
  return {
    version: 1, id: uid(), name: name || '我的 VRM 故事', ui: { dialogueImageId: '', clickSoundId: '' },
    title: { logoImageId: '', backgroundId: '', modelId: '', motionId: '', expressionWeights: {}, bgmId: '', authorNote: '',
      size: 1.7, offsetX: 0.65, offsetY: -1.15, offsetZ: 0, yaw: 0, pitch: 0, cameraAngle: 12 },
    render: normalizeRender(),
    assets: [], assetFolders: [], characters: [], items: [],
    acts: [{ id: uid(), name: '第一幕', backgroundId: '', bgmId: '', weather: normalizeWeather(), steps: [
      { id: uid(), characterId: '', speaker: '', text: '在这里写第一句对白。', expressionWeights: {}, motionId: '', position: 'center', size: defaultSize, offsetX: 0, offsetY: 0, voiceId: '', choices: [] }
    ] }]
  };
}
function normalize() {
  playerInventory=normalizeInventory({},project.items||[]);inventorySession=false;
  migrateEnvironments(project);
  library.reset();
  project.knowledgeBooks ||= [];
  project.items ||= [];
  for(const item of project.items)delete item.consumable;
  project.assets ||= [];
  project.assetFolders ||= [];
  for (const folder of project.assetFolders) if (folder.id === 'auto-character-portraits') folder.hidden = true;
  project.characters ||= [];
  for (const item of project.characters) {
    item.autoMouth = item.autoMouth !== false;
    item.portraitId ||= '';
    item.portraitSource ||= item.portraitId
      ? asset(item.portraitId)?.name === '自动头像.png' ? 'auto' : 'manual' : '';
    item.title ||= '';
    item.description ||= '';
    item.galleryMotionId ||= '';
    item.detailsIdleId ||= '';
    item.galleryYaw = Number.isFinite(Number(item.galleryYaw)) ? Number(item.galleryYaw) : 0;
    item.galleryPoseFrame = Number.isFinite(Number(item.galleryPoseFrame)) && Number(item.galleryPoseFrame) >= 1
      ? Math.floor(Number(item.galleryPoseFrame))
      : Math.max(1, Math.round((Number(item.galleryPoseTime) || 0) * 30) + 1);
    item.stories = Array.from({ length: 3 }, (_, index) => ({
      text: '', unlockLines: 0, ...(item.stories?.[index] || {})
    }));
  }
  project.acts ||= [];
  project.ui ||= { dialogueImageId: '', clickSoundId: '' };
  project.ui.clickSoundId ||= '';
  project.ui.gameTheme = normalizeGameUi(project.ui.gameTheme);
  project.title = { logoImageId: '', backgroundId: '', modelId: '', motionId: '', expressionWeights: {}, bgmId: '', authorNote: '',
    size: 1.7, offsetX: 0.65, offsetY: -1.15, offsetZ: 0, yaw: 0, pitch: 0, cameraAngle: 12, ...project.title };
  migrateTitleActors(project.title, uid);
  project.render=normalizeRender(project.render);
  for (const item of project.acts) {
    if (isEvent(item)) {
      item.event = normalizeEvent(item.event); item.cast = {}; item.castSettings = {};
      item.steps = [{ id: item.steps?.[0]?.id || uid(), text: '', speaker: '', characterId: '', choices: [] }];
    }
    item.coverImageId ||= '';
    item.weather = normalizeWeather(item.weather);
    item.render = chapterRender(item, project.render);
    item.steps ||= [];
    for(const line of item.steps)if(line.render?.preset)line.render=normalizeRender(line.render);
    item.castSettings ||= {};
    if (!item.cast && item.steps.some(entry=>!entry.cast)) {
      const distinct = [...new Set(item.steps.map(entry => entry.characterId).filter(Boolean))];
      item.cast = { left: '', center: '', right: '' };
      for (const id of distinct.slice(0, castSlots.length)) {
        const preferred = item.steps.find(entry => entry.characterId === id)?.position || 'center';
        const slot = castSlots.includes(preferred) && !item.cast[preferred] ? preferred : castSlots.find(key => !item.cast[key]);
        if (slot) item.cast[slot] = id;
      }
    }
    for (const entry of item.steps) entry.choices ||= [];
  }
  migrateDialogueCast(project);syncAssetOrganization(project,uid);
}
async function init() {
  try {
    let voiceUpgrade = false, voiceWarnings = [];
    const info = await bridge('init');
    mode = info.mode;
    modulePanel=info.editorModule||null;activePanel=modulePanel||"story";
    moduleBaseline=modulePanel?structuredClone(info.project):null;
    moduleBaselineRevision=Number(info.moduleRevision)||0;
    if(info.moduleView){selectedAct=info.moduleView.selectedAct||0;selectedCharacter=info.moduleView.selectedCharacter||0;selectedItem=info.moduleView.selectedItem||0;}
    storyAssistant.setConnection(info.agent);
    feedbackGroup = info.feedbackGroup || '';
    directory = info.directory || '';
    recentProjects = info.recentProjects || [];
    playerResolution = info.windowResolution || playerResolution;
    availableResolutions = info.availableResolutions || [];
    playerFullscreen = Boolean(info.fullscreen);
    project = info.project;
    if (project) {
      normalize(); const beforeVoices = JSON.stringify(project); syncDialogueVoices(project, { migrateLegacy: true });
      if (mode === 'editor') {
        const result = await bridge('organizeDialogueVoices', { project: structuredClone(project) });
        for (const update of result.assets) Object.assign(asset(update.id), update);
        voiceWarnings = result.warnings;
      }
      voiceUpgrade = beforeVoices !== JSON.stringify(project);
    }
    if (project) loadAudioSettings();
    if (project && mode === 'player') loadLifetimeProgress();
    if (mode === 'editor') { loadEditorSettings(); editorHistory.reset(); }
    window.__vrmProjectId = project?.id || project?.name || '';
    if (mode === 'player') renderPlayer();
    else if (project) renderEditor();
    else renderWelcome();
    if (project && mode === 'editor') {
      if (voiceUpgrade) markDirty({ derived: true });
      if (voiceWarnings.length) toast(`有 ${voiceWarnings.length} 个旧配音文件找不到，请在对应对白重新上传。`, true);
      queueMissingPortraits();
    }
  } catch (error) {
    app.innerHTML = `<div class="fatal">${escape(error.message)}</div>`;
  }
}
function toast(message, isError = false) {
  let node = document.querySelector('#toast');
  if (!node) {
    node = document.createElement('div');
    node.id = 'toast';
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.className = isError ? 'show error' : 'show';
  clearTimeout(node.timer);
  node.timer = setTimeout(() => node.className = '', 4500);
}
function editorSelection() {
  const focused = document.activeElement;
  const focus = focused?.matches('input,textarea,select') && historyInputContextSupported(focused)
    ? { tag: focused.tagName, id: focused.id, dataset: { ...focused.dataset }, start: focused.selectionStart, end: focused.selectionEnd } : null;
  return { selectedAct, selectedStep, selectedCharacter, activePanel, activeAssetType,
    folders: { ...currentAssetFolder }, storyIndex: editorGalleryStoryIndex, library: library.editorState(),
    focus,
    scroll: ['.sidebar', '.inspector', '#asset-dock-body'].map(selector => document.querySelector(selector)?.scrollTop || 0) };
}
function updateHistoryButtons() {
  const state = editorHistory.status();
  for (const [action, enabled, label, shortcut] of [
    ['editor-undo', state.canUndo, state.undoLabel, 'Ctrl+Z'], ['editor-redo', state.canRedo, state.redoLabel, 'Ctrl+Y / Ctrl+Shift+Z'],
    ['search-undo', state.canUndo, state.undoLabel, 'Ctrl+Z'], ['search-redo', state.canRedo, state.redoLabel, 'Ctrl+Y']
  ]) for (const button of document.querySelectorAll(`[data-action="${action}"]`)) {
    button.disabled = historyBusy || !enabled;
    button.title = `${action.endsWith('undo') ? '撤销' : '重做'}${label ? '：' + label : ''}（${shortcut}）`;
  }
}
function historyInputContextSupported(node) {
  const bindings = Object.entries(node.dataset || {}).filter(([key]) => !key.endsWith('Output'));
  const supported = bindings.some(([key]) => ['field','bookField','eventField','motionOptions','galleryMusic','galleryImage','nprFilter','itemField','inventoryRow',
    'audioTitle','storyIndex','assetFolder','titleField','uiField','titleAdjust','titleExpression','titleActorField','titleActorAdjust','titleActorExpression','titleActorProp','stepCast','castSlot','castMotion','castAdjust','castExpression','castProp','propField','propTransform',
    'render','weather','galleryAdjust','adjust','expression','choiceField'].includes(key)) || node.id === 'project-name' || node.hasAttribute('data-gallery-frame-number');
  return supported;
}
function historyInputContext(node) {
  if (!historyInputContextSupported(node)) return null;
  const bindings = Object.entries(node.dataset || {}).filter(([key]) => !key.endsWith('Output'));
  const key = JSON.stringify([act()?.id, step()?.id, project.characters[selectedCharacter]?.id, library.editorState().selected,
    node.id, bindings]);
  const label = node.closest('label')?.querySelector('span')?.textContent?.trim() || node.getAttribute('aria-label') || '文字或设置';
  return { key, label: `修改${label.slice(0, 24)}`, continuous: historyPointer === node };
}
document.addEventListener('input', event => {
  if(event.target.hasAttribute('data-precise-fine'))return;
  if (mode !== 'editor' || !project || historyBusy) return;
  historyInput = historyInputContext(event.target);
  if (historyInput) editorHistory.begin();
  queueMicrotask(() => { historyInput = null; });
}, true);
document.addEventListener('click', event => {
  if (mode !== 'editor' || !project || historyBusy) return;
  const button = event.target.closest?.('[data-action], [data-panel]');
  if (button) {
    historyInput = null;
    editorHistory.seal(); editorHistory.begin();
    historyAction = { label: button.textContent.trim().replace(/^＋\s*/, '').slice(0, 24) || '编辑工程' };
  }
}, true);
document.addEventListener('pointerdown', event => {
  if (mode === 'editor' && event.target.type === 'range') { editorHistory.seal(); editorHistory.begin(); historyPointer = event.target; }
}, true);
document.addEventListener('pointerup', () => { if (historyPointer) { historyPointer = null; editorHistory.seal(); } }, true);
document.addEventListener('pointercancel', () => { historyPointer = null; editorHistory.seal(); }, true);
document.addEventListener('focusout', event => {
  if (mode === 'editor' && !historyPointer && event.target.matches?.('input, textarea, select')) editorHistory.seal();
}, true);
document.addEventListener('drop', () => { if (mode === 'editor') { editorHistory.seal(); editorHistory.begin(); } }, true);

async function restoreEditorHistory(direction) {
  if (mode !== 'editor' || !project || historyBusy || playing || document.querySelector('#book-reader')) return false;
  historyBusy = true; document.querySelector('.editor')?.classList.add('history-busy'); updateHistoryButtons();
  try {
    await Promise.all([...portraitJobs.values()]);
    const entry = editorHistory.peek(direction);
    if (!entry) return false;
    await bridge('restoreHistoryAssets', { project: entry.project });
    sceneAnimationDialog.close(false);
    stopEditorVoicePreview(); events.cancel(); previewRequest++; titleRequest++;
    project = entry.project;
    const view = entry.view;
    selectedAct = Math.max(0, Math.min(view.selectedAct, project.acts.length - 1));
    selectedStep = Math.max(0, Math.min(view.selectedStep, (act()?.steps.length || 1) - 1));
    selectedCharacter = Math.max(0, Math.min(view.selectedCharacter, project.characters.length - 1));
    activePanel = view.activePanel; activeAssetType = view.activeAssetType;
    Object.assign(currentAssetFolder, view.folders); editorGalleryStoryIndex = view.storyIndex;
    library.restoreEditorState(view.library);
    temporaryPortraits.clear(); editorHistory.accept(entry.target);
    changeRevision++; dirty = true;
    renderSidebar(); renderInspector(); await updatePreview(); library.refreshSearch();
    ['.sidebar', '.inspector', '#asset-dock-body'].forEach((selector, index) => {
      const node = document.querySelector(selector); if (node) node.scrollTop = view.scroll?.[index] || 0;
    });
    if (view.focus) {
      const focused = [...document.querySelectorAll(view.focus.tag)].find(node => node.id === view.focus.id &&
        Object.entries(view.focus.dataset).every(([key, value]) => node.dataset[key] === value));
      focused?.focus({ preventScroll: true });
      if (focused && view.focus.start != null && ['INPUT', 'TEXTAREA'].includes(focused.tagName)) {
        try { focused.setSelectionRange(Math.min(view.focus.start, focused.value.length), Math.min(view.focus.end, focused.value.length)); } catch { /* Non-text input. */ }
      }
    }
    const marker = document.querySelector('#save-state'); if (marker) marker.textContent = '● 未保存';
    toast(`已${direction < 0 ? '撤销' : '重做'}：${entry.label}`);
    return true;
  } catch (error) { toast(`恢复失败：${error.message}`, true); return false; }
  finally { historyBusy = false; document.querySelector('.editor')?.classList.remove('history-busy'); updateHistoryButtons();if(!modulePanel)scheduleModuleRefresh(); }
}
function markDirty(options) {
  if(project)migrateEnvironments(project);
  if (project){syncDialogueVoices(project);syncAssetOrganization(project,uid);}
  changeRevision++;
  dirty = true;
  if(!modulePanel)scheduleModuleRefresh();
  const marker = document.querySelector('#save-state');
  if (marker) marker.textContent = modulePanel?'● 未应用':'● 未保存';
  editorSaveNotice.refresh();
  if (mode === 'editor' && !options?.skipHistory && (!historyBusy || options?.derived)) editorHistory.commit(options || historyInput || historyAction || {});
}
async function save() {
  if (!project || mode !== 'editor') return;
  if (saveInFlight) await saveInFlight;
  editorHistory.seal();
  const revision = changeRevision;
  const retainedPaths = new Set(editorHistory.retainedAssetPaths());
  const obsoletePortraitPaths = [...pendingPortraitDeletes].filter(path => !retainedPaths.has(path));
  const submitted=structuredClone(project);
  const task = modulePanel?bridge('saveModule',{base:moduleBaseline,project:submitted}):bridge('saveProject', { project:submitted,obsoletePortraitPaths });
  saveInFlight = task;
  editorSaveNotice.set('local',true);
  try {
    const saved=await task;
    if(modulePanel&&saved.project){
      rebaseModuleHistory(submitted,saved.project);
      project=mergeEditorProject(submitted,saved.project,project);moduleBaseline=structuredClone(saved.project);moduleBaselineRevision=Number(saved.revision)||moduleBaselineRevision;normalize();
      if(revision===changeRevision){renderSidebar();renderInspector();updatePreview();}
    }
    obsoletePortraitPaths.forEach(path => pendingPortraitDeletes.delete(path));
    if (revision === changeRevision) {
      dirty = false;
      const marker = document.querySelector('#save-state');
      if (marker) marker.textContent = modulePanel?'✓ 已应用到工程':'✓ 已保存';
    }
  } finally {
    if (saveInFlight === task) saveInFlight = null;
    editorSaveNotice.set('local',Boolean(saveInFlight));
    if(modulePanel&&moduleRefreshPending){const latest=moduleRefreshPending;moduleRefreshPending=null;refreshEditorModule(latest);}
  }
}
window.editorCloseState=()=>({dirty:mode==='editor'&&Boolean(project)&&dirty,busy:Boolean(historyBusy||saveInFlight||editorSaveNotice.active||dialogueCamera?.editing),hasProject:Boolean(project)});
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeWalkAudit=async()=>{
 activePanel='story';selectedAct=0;selectedStep=1;renderSidebar();renderInspector();await updatePreview();await new Promise(r=>setTimeout(r,1500));
 stage.running=false;cancelAnimationFrame(stage.frame);const records=[];
 for(const record of stage.visibleRecords.values()){
  const hips=record.vrm.humanoid.getNormalizedBoneNode('hips'),clip=record.currentAction.getClip(),positions=[];
  for(let frame=0;frame<240;frame++){stage.restoreFootPose(record);record.mixer.update(1/60);stage.applyMotionPlacement(record);stage.applyFootLock(record);record.vrm.update(1/60);stage.applyRawFootLock(record);record.anchor.updateMatrixWorld(true);positions.push({time:record.currentAction.time,hips:hips.position.toArray(),world:hips.getWorldPosition(new THREE.Vector3()).toArray(),foot:record.vrm.humanoid.getRawBoneNode?.('leftFoot')?.getWorldPosition(new THREE.Vector3()).toArray()||null});}
  records.push({fbx:Boolean(record.vrm.isFbx),clip:clip.name,duration:clip.duration,options:record.currentMotionOptions,locked:Boolean(record.footLock),tracks:clip.tracks.filter(t=>t.name.endsWith('.position')).map(t=>({name:t.name,times:Array.from(t.times),values:Array.from(t.values)})),positions});
 }
 return {ok:true,records};
};
if(new URLSearchParams(location.search).has('smoke')){
 window.__vrmSmokeWalkVideoSetup=async()=>{
  activePanel='story';selectedAct=0;selectedStep=1;
  for(const slot of ['left','center']){const actor=step().cast[slot];if(actor?.characterId){actor.motionId='walk-test';actor.motionOptions={loop:true,placement:'inPlace'};}}
  renderSidebar();renderInspector();await updatePreview();await new Promise(r=>setTimeout(r,800));stage.running=false;cancelAnimationFrame(stage.frame);
  for(const record of stage.visibleRecords.values()){record.mixer.setTime(0);record.motionLoops=0;}
 };
 window.__vrmSmokeWalkVideoFrame=()=>{
  for(const record of stage.visibleRecords.values()){record.mixer.update(1/30);stage.updateTransitions(record,1/30);stage.applyMotionPlacement(record);record.vrm.update(1/30);record.anchor.updateMatrixWorld(true);stage.characterProps.update(record);}
  stage.updateShadowGround();stage.stylePipeline?stage.stylePipeline.render(1/30):stage.renderer.render(stage.scene,stage.camera);
  return stage.renderer.domElement.toDataURL('image/png');
 };
}
window.editorSaveBeforeClose=async()=>{await save();return {saved:!dirty};};
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeCloseEdit=async(text)=>{
  if(text===null){await save();return;}
  project.acts[0].steps[0].text=text;markDirty({label:'关闭提醒验证'});
};
function loadEditorSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('vrm-editor-settings') || 'null');
    if ([5, 10, 30, 60].includes(Number(saved?.autoSaveMinutes)))
      editorSettings.autoSaveMinutes = Number(saved.autoSaveMinutes);
    editorSettings.theme = saved?.theme === 'dark' ? 'dark' : 'light';
  } catch { /* Keep the default interval. */ }
  applyEditorTheme();
  restartEditorAutoSave();
}
function applyEditorTheme() {
  document.body.dataset.editorTheme = editorSettings.theme;
  const toggle = document.querySelector('[data-action="toggle-editor-theme"]');
  if (toggle) {
    toggle.textContent = editorSettings.theme === 'dark' ? '☀' : '☾';
    toggle.title = editorSettings.theme === 'dark' ? '切换到日间模式' : '切换到夜间模式';
    toggle.setAttribute('aria-label', toggle.title);
    toggle.setAttribute('aria-pressed', String(editorSettings.theme === 'dark'));
  }
}
function saveEditorSettings() {
  localStorage.setItem('vrm-editor-settings', JSON.stringify(editorSettings));
}
function restartEditorAutoSave() {
  clearInterval(editorAutoSaveTimer);
  editorAutoSaveTimer = setInterval(() => {
    if (mode === 'editor' && project && dirty && !window.editorClosePending)
      save().catch(error => toast(`自动保存失败：${error.message}`, true));
  }, editorSettings.autoSaveMinutes * 60_000);
}
function renderEditorSettings() {
  document.querySelector('#editor-settings-modal')?.remove();
  document.querySelector('.editor')?.insertAdjacentHTML('beforeend', `<div id="editor-settings-modal" class="editor-settings-backdrop" role="dialog" aria-modal="true" aria-label="编辑器设置">
    <div class="editor-settings-card"><header><h2>编辑器设置</h2>${button('关闭 ×', 'close-editor-settings')}</header>
      <label class="field"><span>自动保存间隔</span><select id="editor-auto-save-minutes">
        ${[[5, '每 5 分钟'], [10, '每 10 分钟'], [30, '每 30 分钟'], [60, '每 1 小时']].map(([value, label]) =>
          `<option value="${value}" ${editorSettings.autoSaveMinutes === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select></label><label class="field"><span>界面外观</span><select id="editor-theme">
        <option value="light" ${editorSettings.theme === 'light' ? 'selected' : ''}>日间 · 白色</option>
        <option value="dark" ${editorSettings.theme === 'dark' ? 'selected' : ''}>夜间 · 深灰色</option>
      </select></label><p>外观设置只影响编辑器；游戏外观在“游戏 UI”中选择。</p>
      <p class="font-credit">界面使用 HarmonyOS Sans 字体。© 2021 Huawei Device Co., Ltd.</p>
    </div></div>`);
}
function renderWelcome() {
  app.innerHTML = `<main class="welcome"><div class="welcome-card">
    <div class="eyebrow">VRM GALGAME STUDIO</div>
    <h1>让 VRM 角色走进你的故事</h1>
    <p>导入模型和动作，写对白，选表情。工程和全部素材会装进一个工程包。</p>
    <label class="field"><span>新工程名称</span><input id="new-name" value="我的 VRM 故事"></label>
    <div class="welcome-actions">${button('新建工程', 'new-project', 'class="primary"')}${button('打开工程包', 'open-project')}</div>
    <small>新建时选择保存位置，程序会建立一个 .vrmg 单文件工程包。</small>
    ${recentProjects.length ? `<div class="recent-projects"><h2>最近打开</h2>${recentProjectButtons()}</div>` : ''}
  </div></main>`;
}
function recentProjectButtons() {
  return recentProjects.map((path, index) => `<button type="button" class="recent-project" data-action="open-recent" data-index="${index}" title="${escape(path)}">
    <strong>${escape(path.replace(/\\/g, '/').split('/').pop())}</strong><small>${escape(path)}</small></button>`).join('');
}
function renderRecentProjectsModal() {
  document.querySelector('#recent-projects-modal')?.remove();
  document.querySelector('.editor')?.insertAdjacentHTML('beforeend', `<div id="recent-projects-modal" class="editor-settings-backdrop" role="dialog" aria-modal="true" aria-label="最近打开的工程">
    <div class="editor-settings-card recent-projects-card"><header><h2>最近打开的工程</h2>${button('关闭 ×', 'close-recent-projects')}</header>
      ${recentProjects.length ? recentProjectButtons() : '<p>还没有打开过工程包。</p>'}</div></div>`);
}
function renderEditor() {
  roleDetails.close(false);
  dialogueCamera?.dispose();dialogueCamera=null;
  previewResizer?.dispose();previewResizer=null;
  sceneAnimationDialog.close(false);cancelSceneAnimations();
  events.cancel();
  stage?.destroy();
  if (activePanel === 'assets') activePanel = 'story';
  app.innerHTML = `<div class="editor ${modulePanel?"module-editor":"story-editor"}">
    <header class="topbar"><div class="brand">✦ <b>VRM Galgame</b><span>编辑器</span></div>
      <div class="project-title"><input id="text-search" placeholder="查找与替换剧情、角色名称…" aria-label="查找剧情文本，按回车打开替换工具"><button class="search-open-button" data-action="search-open" title="查找与替换">⌕</button><span id="save-state">✓ 已保存</span></div>
      <div class="editor-history-controls" role="group" aria-label="撤销和重做">${button('↶ 撤销', 'editor-undo', 'disabled')}${button('↷ 重做', 'editor-redo', 'disabled')}</div>
      <div class="editor-tools-row">${modulePanel?'<nav>'+button('保存并应用到工程','save')+button('☾','toggle-editor-theme')+button('重播动作','restart-character-preview','title="重新播放预览人物动作"')+'</nav>':`<nav>${button('新建', 'new-project')}${button('打开', 'open-project')}${button('最近', 'recent-projects')}${button('保存', 'save')}${button('另存为', 'save-as')}${button('☾', 'toggle-editor-theme', 'class="theme-toggle" aria-label="切换夜间模式" aria-pressed="false" title="切换到夜间模式"')}${button('设置', 'editor-settings')}${button('游戏 UI', 'game-ui')}${button('剧情助手', 'assistant-open')}${button('试玩', 'play', 'class="primary"')}${button('导出游戏', 'export')}${button('环境编辑器', 'edit-environment')}${Object.entries(moduleLabels).map(([key,label])=>button(label+'编辑器','open-module','data-module="'+key+'"')).join('')}${button('重播动作','restart-character-preview','title="重新播放预览人物动作"')}</nav><div class="story-current" id="story-current" role="status"></div>`}</div>
    </header>
    <div class="workspace ${modulePanel?'':'story-workspace'}">
      ${modulePanel?'<aside class="sidebar"><div class="module-sidebar-title">'+moduleLabels[modulePanel]+'编辑器<span id="stage-caption" class="module-context-caption"></span></div><div id="sidebar-body"></div></aside>':'<div class="story-left"><aside class="inspector"><div class="inspector-heading">当前对白编辑</div><div id="inspector-body"></div></aside><aside class="sidebar"><div id="sidebar-body"></div></aside></div>'}
      <main class="center">
        <div class="stage-frame"><div id="scene-bg"></div><div id="stage-canvas"></div><div id="title-preview" class="title-composition hidden"></div>
          <div id="character-preview" class="character-editor-preview hidden"></div>
          <div id="stage-placeholder">导入 VRM 角色后，这里会显示 3D 人物</div>
          <div id="speaker-portrait" class="speaker-portrait hidden"><img alt="说话角色头像"></div>
          <div id="dialogue" class="dialogue"><div class="speaker" id="dialogue-speaker"></div><div id="dialogue-text"></div></div>
          <button type="button" id="auto-play-button" class="auto-play-button hidden" data-action="auto-toggle" aria-pressed="false">▶ 自动播放</button>
          <div id="choice-list"></div>
          <div id="play-controls">${button('退出试玩', 'stop-play')}</div>
          <div id="act-loading" class="act-loading hidden">${loadingSpinner}</div>
          <div id="game-fps" class="game-fps hidden" aria-label="当前帧数">— FPS</div>
        </div>
        <section class="asset-dock" aria-label="常驻素材库"><div class="asset-dock-heading"><strong>素材库</strong><small>图片直接显示缩略图；在这里导入、分类、删除素材</small></div><div id="asset-dock-tabs" class="asset-dock-tabs" role="tablist" aria-label="素材类型"></div><div id="asset-dock-body" class="asset-dock-body"></div></section>
      </main>
      ${modulePanel?'<aside class="inspector"><div class="inspector-heading">属性</div><div id="inspector-body"></div></aside>':'<aside class="dialogue-column"><div id="dialogue-list-body"></div></aside>'}
    </div>
    <footer class="status"><span id="project-path">${escape(directory)}</span>${feedbackGroup?`<div class="editor-feedback" aria-label="Bug反馈交流群" title="Bug反馈交流群 · QQ ${escape(feedbackGroup)}"><span>反馈群 · QQ</span><strong>${escape(feedbackGroup)}</strong></div>`:''}<span class="status-note">素材和剧情保存在工程包中</span></footer>
  </div>`;
  previewResizer=createPreviewResizer(document.querySelector('.center'));
  stageError = '';
  stage = new VRMStage(document.querySelector('#stage-canvas'), message => {
    stageError = message;
    const placeholder = document.querySelector('#stage-placeholder');
    if (placeholder && !stage?.vrm) {
      placeholder.textContent = message;
      placeholder.style.display = 'grid';
    }
    toast(message, true);
  });
  stage.sceneAnimationsPaused=()=>Boolean(saveModalMode||document.hidden);
  stage.setRenderSettings(project.render);
  setupDialogueCamera();
  applyEditorTheme();
  updateHistoryButtons();
  editorSaveNotice.refresh();
  renderSidebar();
  renderInspector();
  updatePreview();
}
function renderSidebar() {
  if(!modulePanel){if(activePanel!=="story"){openEditorModule(activePanel).catch(error=>toast(error.message,true));activePanel="story";}renderStoryLists();renderAssetDock();return;}
  document.querySelectorAll('[data-panel]').forEach(node => node.classList.toggle('active', node.dataset.panel === activePanel));
  const body = document.querySelector('#sidebar-body');
  if (activePanel === 'knowledge') { library.editor(); renderAssetDock(); return; }
  if(activePanel==='items'){body.innerHTML=`<div class="section-heading">玩家物品 ${button('＋ 新增','add-inventory-item')}</div><div class="list inventory-editor-list">${project.items.map((item,index)=>`<button class="list-row ${index===selectedItem?'selected':''}" data-action="select-inventory-item" data-index="${index}">${escape(item.name||'未命名物品')}</button>`).join('')}</div><p class="sidebar-note">这是玩家背包里的物品。先补全名字、立绘和介绍，再到对白里设置获得与分支条件。</p>`;}else if (activePanel === 'story') {
    body.innerHTML = `<div class="section-heading">剧情 <span class="heading-actions">${button('＋ 幕', 'add-act')}${button('＋ 事件', 'event-add')}${button('＋ 过场','event-add-cutscene')}</span></div>
      <div class="list act-accordion" data-order-list="act">${project.acts.map((item, index) =>
        `<section class="act-group ${isEvent(item) ? 'event-group' : ''} ${index === selectedAct ? 'expanded' : ''}"><button class="list-row sortable-row ${index === selectedAct ? 'selected' : ''}" draggable="true" data-order-kind="act" data-order-index="${index}" data-action="select-act" data-index="${index}" aria-expanded="${index === selectedAct}">
          <span class="number">${index === selectedAct ? '▾' : '▸'} ${String(index + 1).padStart(2, '0')}</span><span>${isEvent(item) ? '▤ ' : ''}${escape(item.name)}</span><small>${isEvent(item) ? eventNames[item.event.type] : `${item.steps.length} 句`}</small><span class="drag-grip" aria-hidden="true">⋮⋮</span></button>
          ${index === selectedAct ? isEvent(item) ? `<div class="act-dialogues event-sidebar-info"><p>${escape(item.event.title || '在右侧填写事件内容')}</p><small>${eventSeconds[item.event.type] ? `观看 ${eventSeconds[item.event.type]} 秒后继续` : '可以立即关闭'}</small><div class="inline-actions">${button('预览', 'event-preview')}</div></div>` : `<div class="act-dialogues"><div class="section-heading">本幕对白 <span class="heading-actions">${button('＋ 新增', 'add-step')}</span></div>
          <div class="list step-list" data-order-list="step">${item.steps.map((line, stepIndex) => `<button class="list-row sortable-row ${stepIndex === selectedStep ? 'selected' : ''}" draggable="true" data-order-kind="step" data-order-index="${stepIndex}" data-action="select-step" data-index="${stepIndex}"><span class="number">${stepIndex + 1}</span><span><b>${escape(line.speaker || character(line.characterId)?.name || '旁白')}</b><small>${escape(line.text || '空对白')}</small></span><span class="drag-grip" aria-hidden="true">⋮⋮</span></button>`).join('') || '<p class="tip">点击“新增”写第一句对白。</p>'}</div></div>` : ''}</section>`).join('')}</div>
      <div class="sidebar-note">拖动幕或事件可以调整播放顺序。点击“＋ 事件”，会插入到当前选中项后面。</div>`;
  } else if (activePanel === 'characters') {
    body.innerHTML = `<div class="section-heading">角色 ${button('＋ 新增', 'add-character')}</div>
      <div class="list">${project.characters.map((item, index) =>
        `<button class="list-row ${index === selectedCharacter ? 'selected' : ''}" data-action="select-character" data-index="${index}">
          <span class="number">✦</span><span>${escape(item.name)}</span><small>${item.modelId ? (isFbxModel(item.modelId)?'FBX':'VRM') : '未设模型'}</small></button>`).join('')}</div>
      <div class="sidebar-note">角色只需设置一次。对白选中角色后就能调用它的模型。</div>`;
  } else if (activePanel === 'render') {
    body.innerHTML = `<div class="section-heading">选择要调节的幕</div><div class="list">${project.acts.flatMap((item, index) => isEvent(item) ? [] : [`<button class="list-row ${index === selectedAct ? 'selected' : ''}" data-action="select-act" data-index="${index}"><span class="number">${index + 1}</span><span>${escape(item.name)}</span></button>`]).join('')}</div><div class="sidebar-note">右侧的预设风格与微调只改变选中的这一幕；对白可以单独覆盖。</div>`;
  } else if (activePanel === 'title') {
    body.innerHTML = `<div class="section-heading">标题画面</div>
      <div class="title-sidebar-actions">
        ${button('导入 Logo', 'import', 'data-type="image" data-title-import="logoImageId"')}
        ${button('导入标题 VRM 人物', 'import', 'data-type="vrm" data-title-import="modelId"')}
        ${button('导入标题 FBX 人物', 'import', 'data-type="fbxCharacter" data-title-import="modelId"')}
        ${button('导入标题 MMD 人物', 'import', 'data-type="mmdCharacter" data-title-import="modelId"')}
        ${button('导入标题动作', 'import', 'data-type="motion" data-title-import="motionId"')}
        ${button('编辑环境', 'edit-environment')}
      </div><div class="sidebar-note">在右侧逐个添加标题人物。每个人可以单独选择模型、动作和位置。Logo 可以留空，菜单排在底部。</div>`;
  }
  renderAssetDock();
}
const objectMenu=createContextMenu(error=>toast(error.message,true));
function objectContext(target){
 const row=target.closest('[data-action="select-act"],[data-action="select-step"],[data-action="select-character"],[data-action="select-inventory-item"],[data-action="book-select"]');
 if(row){const index=Number(row.dataset.index),kind={'select-act':'act','select-step':'step','select-character':'character','select-inventory-item':'item','book-select':'book'}[row.dataset.action],list={act:project.acts,step:act()?.steps,character:project.characters,item:project.items,book:project.knowledgeBooks}[kind];return{kind,source:list?.[index],ownerId:kind==='step'?act()?.id:undefined};}
 const prop=target.closest('.prop-binding');if(prop)return{kind:'prop',source:project.characters[selectedCharacter]?.props?.find(p=>p.id===prop.dataset.copyId),ownerId:project.characters[selectedCharacter]?.id};
 if(target.closest('.prop-editor'))return{kind:'prop',source:null,ownerId:project.characters[selectedCharacter]?.id};
 const actor=target.closest('.title-actor-editor');if(actor)return{kind:'titleActor',source:project.title.actors.find(a=>a.id===actor.dataset.copyId)};
 const choice=target.closest('.choice-editor');if(choice)return{kind:'choice',source:step()?.choices[Number(choice.dataset.copyIndex)],ownerId:step()?.id};
 const file=target.closest('[data-copy-asset-id]');if(file)return{kind:'asset',source:asset(file.dataset.copyAssetId),folderId:currentAssetFolder[activeAssetType]||'',assetType:activeAssetType};
 const folder=target.closest('[data-action="asset-open-folder"]');if(folder){const source=project.assetFolders.find(f=>f.id===folder.dataset.folderId);return{kind:'folder',source:source&&{...source,contents:project.assets.filter(a=>a.folderId===source.id)}};}
 const scene=target.closest('[data-copy-environment]');if(scene){const owner=activePanel==='title'?project.title:act();return{kind:'environment',source:project.environments.find(e=>e.id===owner?.environmentId),sceneOwner:owner};}
 if(target.closest('.asset-dock'))return{kind:projectClipboard(project.id,localStorage).read()?.kind==='folder'?'folder':'asset',source:null,folderId:currentAssetFolder[activeAssetType]||'',assetType:activeAssetType};
 if(target.closest('#dialogue-list-body'))return isEvent(act())?{kind:'act',source:act()}:{kind:'step',source:step(),ownerId:act()?.id};
 if(target.closest('#sidebar-body')){const kind={story:'act',render:'act',characters:'character',items:'item',knowledge:'book',title:'titleActor'}[activePanel];return{kind,source:null};}
 if(target.closest('#inspector-body')){if(isEvent(act())&&activePanel==='story')return{kind:'act',source:act()};const kind={story:'step',characters:'character',items:'item',knowledge:'book',title:'titleActor'}[activePanel];return{kind,source:{step:step(),character:project.characters[selectedCharacter],item:project.items[selectedItem],book:project.knowledgeBooks?.[library.editorState().selected]}[kind],ownerId:kind==='step'?act()?.id:undefined};}
 return null;
}
function renderGameUiPicker() {
  document.querySelector('#game-ui-picker')?.remove();
  document.querySelector('.editor')?.insertAdjacentHTML('beforeend', gameUiPicker(project.ui.gameTheme));
  document.querySelector('#game-ui-picker input:checked')?.focus();
}
function captureObject(context){
 if(!context.source)throw Error('先选择要复制的内容');
 if(context.kind==='folder'&&context.source.locked)throw Error('固定文件夹由系统创建，不能复制成其他文件夹');
 projectClipboard(project.id,localStorage).write(context.kind,context.source);toast('已复制'+copyLabels[context.kind]+'，右键选择粘贴');
}
async function pasteObject(context,duplicate=false){
 if(historyBusy||playing)throw Error('请先结束当前操作');
 const clipboard=duplicate?{kind:context.kind,data:context.source}:projectClipboard(project.id,localStorage).read();
 if(!clipboard||clipboard.kind!==context.kind)throw Error('请在同类内容的列表中粘贴');
 if(clipboard.kind==='folder'&&(clipboard.data.locked||context.source?.locked))throw Error('固定文件夹由系统创建');
 if(context.assetType&&clipboard.kind==='asset'&&clipboard.data.type!==(['music','effect'].includes(context.assetType)?'audio':context.assetType))throw Error('请在对应的素材类型中粘贴');
 editorHistory.seal();editorHistory.begin();
 const copy=insertEditorCopy(project,context.kind,clipboard.data,{ownerId:context.ownerId,afterId:context.source?.id,folderId:context.folderId},uid);
 if(context.kind==='asset'&&copy.type==='audio'&&['music','effect'].includes(context.assetType))copy.audioKind=context.assetType;
 if(context.kind==='folder'){project.assets.push(...(copy.contents||[]));delete copy.contents;}
 if(context.kind==='asset'&&copy.type==='voice')delete copy.dialogueId;
 if(context.kind==='act'){selectedAct=project.acts.indexOf(copy);selectedStep=0;}
 if(context.kind==='step'){selectedAct=project.acts.findIndex(a=>a.id===context.ownerId);selectedStep=act().steps.indexOf(copy);}
 if(context.kind==='character'){copyCharacterMotions(project,clipboard.data,copy,uid);selectedCharacter=project.characters.indexOf(copy);editorGalleryStoryIndex=0;}
 if(context.kind==='item')selectedItem=project.items.indexOf(copy);
 if(context.kind==='book')library.restoreEditorState({selected:project.knowledgeBooks.indexOf(copy)});
 if(context.kind==='environment'&&context.sceneOwner)context.sceneOwner.environmentId=copy.id;
 markDirty({label:'粘贴'+copyLabels[context.kind]});editorHistory.seal();renderSidebar();renderInspector();await updatePreview();toast('已添加副本，可继续修改');return copy;
}
async function deleteContextObject(context){
 const currentId=act()?.id;if(!context.source)return;
 if(context.kind==='act'){
  if(project.acts.length<=1){toast('至少保留一幕或一个事件。',true);return;}
  const index=project.acts.findIndex(a=>a.id===context.source.id);if(index<0)return;
  if(!confirm('删除“'+context.source.name+'”及里面的全部对白？'))return;editorHistory.seal();editorHistory.begin();project.acts.splice(index,1);
  for(const chapter of project.acts)for(const line of chapter.steps||[])for(const choice of line.choices||[])if(choice.actId===context.source.id)choice.actId='';
  for(const book of project.knowledgeBooks||[])if(book.unlockActId===context.source.id)book.unlockActId='';
  selectedAct=context.source.id===currentId?Math.min(index,project.acts.length-1):Math.max(0,project.acts.findIndex(a=>a.id===currentId));selectedStep=0;
 }else if(context.kind==='step'){
  const chapter=project.acts.find(a=>a.id===context.ownerId),index=chapter?.steps.findIndex(s=>s.id===context.source.id);if(index==null||index<0)return;
  if(!confirm('删除这句对白？'))return;editorHistory.seal();editorHistory.begin();chapter.steps.splice(index,1);selectedAct=project.acts.indexOf(chapter);selectedStep=Math.max(0,Math.min(index,chapter.steps.length-1));
 }else return;
 markDirty({label:'删除'+copyLabels[context.kind]});editorHistory.seal();renderSidebar();renderInspector();await updatePreview();
}
document.addEventListener('contextmenu',event=>{
 if(mode!=='editor'||!project||playing||historyBusy||event.target.closest('input[type=text],input:not([type]),textarea,[contenteditable=true],#player-modal,#book-reader'))return;
 const context=objectContext(event.target);if(!context?.kind)return;event.preventDefault();
 const clipboard=projectClipboard(project.id,localStorage).read(),pasteDisabled=clipboard?.kind!==context.kind||context.kind==='step'&&act()?.kind==='event';
 const locked=context.kind==='folder'&&context.source?.locked;
 const audioActions=context.kind==='asset'&&context.source?.type==='audio'?['music','effect'].map(kind=>({key:'classify-'+kind,label:kind==='music'?'归类为音乐':'归类为音效',disabled:context.source.audioKind===kind,run:()=>{editorHistory.seal();editorHistory.begin();setAudioKind(project,context.source,kind);markDirty({label:'更改声音分类'});editorHistory.seal();renderAssetDock();renderInspector();}})):[];
 objectMenu.open(event,context.source?.name||copyLabels[context.kind],[{key:'copy',label:'复制',disabled:!context.source||locked,run:()=>captureObject(context)},{key:'paste',label:'粘贴',disabled:pasteDisabled||locked,run:()=>pasteObject(context)},{key:'duplicate',label:'创建副本',disabled:!context.source||locked,run:()=>pasteObject(context,true)},...(['act','step'].includes(context.kind)?[{key:'delete',label:'删除',disabled:!context.source||context.kind==='act'&&project.acts.length<=1,run:()=>deleteContextObject(context)}]:[]),...audioActions]);
});
document.addEventListener('keydown',event=>{
 if(mode!=='editor'||!project||playing||historyBusy||!event.ctrlKey&&!event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable=true],.editor-context-menu'))return;
 const key=event.key.toLowerCase();if(!['c','v'].includes(key))return;const context=objectContext(event.target);if(!context?.kind)return;event.preventDefault();try{if(key==='c')captureObject(context);else pasteObject(context).catch(error=>toast(error.message,true));}catch(error){toast(error.message,true);}
});
let storyListAct='',storyListStep='';
function renderStoryLists(){
 const body=document.querySelector('#sidebar-body'),right=document.querySelector('#dialogue-list-body');if(!body||!right||!project)return;
 const current=act(),changed=storyListAct!==current?.id;storyListAct=current?.id||'';
 body.innerHTML=`<div class="section-heading">幕列表 <span class="heading-actions">${button('＋ 幕','add-act')}${button('＋ 事件','event-add')}${button('＋ 过场','event-add-cutscene')}</span></div><div class="list act-list" data-order-list="act">${project.acts.map((item,index)=>`<button class="list-row sortable-row ${index===selectedAct?'selected':''}" draggable="true" data-order-kind="act" data-order-index="${index}" data-action="select-act" data-index="${index}" ${index===selectedAct?'aria-current="true"':''}><span class="number">${String(index+1).padStart(2,'0')}</span><span>${isEvent(item)?'▤ ':''}${escape(item.name)}</span><small>${isEvent(item)?(item.event?.type==='cutscene'?'过场':'事件'):item.steps.length+'句'}</small><span class="drag-grip">⋮⋮</span></button>`).join('')}</div>`;
 right.innerHTML=`<div class="section-heading"><strong id="stage-caption">${escape(current?.name||'本幕对白')}</strong><small> · 只显示当前幕</small><span class="heading-actions">${button('＋ 新增对白','add-step',current&&!isEvent(current)?'':'disabled')}</span></div>${current&&!isEvent(current)?`<div class="list step-list" data-order-list="step">${current.steps.map((line,index)=>`<button class="list-row sortable-row ${index===selectedStep?'selected':''}" draggable="true" data-order-kind="step" data-order-index="${index}" data-action="select-step" data-index="${index}" ${index===selectedStep?'aria-current="true"':''}><span class="number">${index+1}</span><span><b>${escape(line.speaker||character(line.characterId)?.name||'旁白')}</b><small>${escape(line.text||'空对白')}</small></span><span class="drag-grip">⋮⋮</span></button>`).join('')||'<p class="tip">点击“新增对白”写第一句。</p>'}</div>`:'<p class="sidebar-note">当前是事件或过场，内容在左上方编辑。</p>'}`;
 if(changed)right.parentElement.scrollTop=0;
 if(storyListStep!==step()?.id){storyListStep=step()?.id||'';right.querySelector('.selected')?.scrollIntoView({block:'nearest'});}
 updateStoryCurrent();
}
function updateStoryCurrent(){
 const node=document.querySelector('#story-current');if(!node)return;
 node.textContent=isEvent(act())?`正在编辑：第 ${selectedAct+1} 个事件 · ${act()?.name||''}`:`正在编辑：第 ${selectedAct+1} 幕「${act()?.name||''}」 · ${step()?'第 '+(selectedStep+1)+' 句对白':'还没有对白'}`;
 node.title=node.textContent;
}
let cameraEditOwner=null;
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeV024=async phase=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(ok,message)=>{if(!ok)throw Error(message);};
 if(phase==='alpha')return verifyImageAlpha();
 if(phase==='names'){await bridge('openEditorModule',{module:'render',project:structuredClone(project),revision:changeRevision,view:{selectedAct,selectedStep}});return {ok:true};}
 if(phase==='feet'){
  stage.running=false;cancelAnimationFrame(stage.frame);const results=[];
  try{
   for(const type of ['vrm','fbxCharacter']){
    const role=project.characters.find(c=>asset(c.modelId)?.type===type);assert(role,'没有 '+type+' 测试角色');
    const record=await stage.loadModel(asset(role.modelId),'foot-check-'+type);record.vrm.scene.visible=true;
    const hips=record.vrm.humanoid.getNormalizedBoneNode('hips'),rest=hips.position.clone(),scale=hips.parent.getWorldScale(new THREE.Vector3()).y,amplitude=.025/scale;
    const clip=new THREE.AnimationClip('待机脚漂移检查',1,[new THREE.VectorKeyframeTrack(hips.uuid+'.position',[0,.25,.5,.75,1],[...rest.toArray(),rest.x+amplitude,rest.y+amplitude,rest.z,...rest.toArray(),rest.x-amplitude,rest.y-amplitude,rest.z,...rest.toArray()])]);
    const motion={id:'foot-check-'+type,name:'待机脚漂移检查'},measure=()=>{let first,maxDrift=0,rawDrift=0;const raw=record.vrm.humanoid.getRawBoneNode?.('leftFoot')||record.vrm.humanoid.getNormalizedBoneNode('leftFoot');let firstRaw;
     for(let i=0;i<180;i++){stage.restoreFootPose(record);record.mixer.update(1/60);stage.applyMotionPlacement(record);stage.applyFootLock(record);record.vrm.update(1/60);stage.applyRawFootLock(record);record.anchor.updateMatrixWorld(true);const points=['leftFoot','rightFoot'].map(name=>record.vrm.humanoid.getNormalizedBoneNode(name).getWorldPosition(new THREE.Vector3()));first||=points.map(p=>p.clone());points.forEach((p,j)=>maxDrift=Math.max(maxDrift,p.distanceTo(first[j])));const point=raw.getWorldPosition(new THREE.Vector3());firstRaw||=point.clone();rawDrift=Math.max(rawDrift,point.distanceTo(firstRaw));}return {maxDrift,rawDrift};};
    stage.poseRecord(record,clip,motion,false,{feet:'lock',placement:'inPlace'});assert(record.footLock,'固定开关没有生效');const locked=measure();assert(locked.maxDrift<.001&&locked.rawDrift<.003,type+' 固定后脚仍在漂：'+JSON.stringify(locked));
    stage.poseRecord(record,clip,motion,false,{feet:'free',placement:'inPlace'});assert(!record.footLock,'关闭固定后仍锁定');const free=measure();assert(free.maxDrift>.005,'跟随动作被固定了');results.push({type,locked,free});record.vrm.scene.visible=false;
   }
   const first=act().steps[0];first.cast||=emptyDialogueCast();const slot=Object.keys(first.cast).find(slot=>first.cast[slot]?.characterId)||'center';first.cast[slot].motionOptions={...(first.cast[slot].motionOptions||{}),feet:'lock'};selectedStep=0;renderInspector();const feetControl=document.querySelector('[data-motion-setting=feet]');assert(feetControl,'脚掌选项没显示');for(let parent=feetControl.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;feetControl.scrollIntoView({block:'center'});markDirty();return {ok:true,realVRMAndFBX:true,optional:true,results};
  }finally{stage.running=true;stage.animate();}
 }
 if(phase==='save-start'){
  markDirty();window.__v024SaveDone=null;window.__v024SaveFrames=0;const tick=()=>{if(window.__v024SaveDone!==null)return;window.__v024SaveFrames++;requestAnimationFrame(tick);};requestAnimationFrame(tick);
  save().then(()=>window.__v024SaveDone={ok:true}).catch(error=>window.__v024SaveDone={error:error.message});await wait(80);
  assert(editorSaveNotice.active&&!document.querySelector('#editor-save-notice').hidden,'没有保存动画');assert(document.querySelector('[data-action=play]').disabled,'保存时试玩按钮仍可点击');return {ok:true,animationVisible:true,playDisabled:true};
 }
 if(phase==='save-finish'){
  for(let i=0;i<3600&&window.__v024SaveDone===null;i++)await wait(50);assert(window.__v024SaveDone?.ok,'保存失败');await wait(80);assert(!editorSaveNotice.active&&document.querySelector('#editor-save-notice').hidden,'保存结束动画没有消失');assert(!document.querySelector('[data-action=play]').disabled,'保存后试玩按钮没有恢复');assert(window.__v024SaveFrames>2,'保存时界面卡死');return {ok:true,completed:true,frames:window.__v024SaveFrames,playRestored:true,feetPersisted:project.acts[0].steps[0].cast};
 }
 if(phase==='save-failure'){
  let failed=false;try{await bridge('saveProject',{project:null});}catch{failed=true;}await wait(80);assert(failed&&!editorSaveNotice.active&&document.querySelector('#editor-save-notice').hidden,'保存失败后提示没有解除');return {ok:true,failureClearsBusy:true};
 }
 if(phase==='environment'){
  const portrait=project.assets.find(a=>a.generatedPortrait&&a.characterId===project.characters.find(c=>isFbxModel(c.modelId))?.id)||project.assets.find(a=>a.generatedPortrait);assert(portrait,'没有透明人物头像');
  const env=createEnvironment('透明图片修复检查');env.nodes=env.nodes.slice(0,1);env.nodes.push({id:uid(),kind:'imagePlane',name:portrait.name,assetId:portrait.id,parentId:null,position:[0,1.5,0],rotation:[0,0,0],scale:[1,1,1],width:2.5,height:2.5,unlit:true,alphaCutoff:0});env.camera={position:[0,1.6,5.5],target:[0,1.5,0],fov:32};
  await bridge('openEnvironment',{projectId:project.id,environment:env,environments:[env],assets:project.assets,referenceSettings:{},environmentLibrary:{folders:[],assignments:{}}});return {ok:true};
 }
};
function setupDialogueCamera(){
 dialogueCamera?.dispose();dialogueCamera=new DialogueCameraController(stage.camera,document.querySelector('.stage-frame'),{
  paused:()=>Boolean(saveModalMode||document.hidden),
  confirmed:pose=>{const owner=cameraEditOwner;cameraEditOwner=null;if(!owner||act()?.id!==owner.actId||step()?.id!==owner.stepId)return;step().camera=pose;markDirty({label:'设置对白镜头'});renderInspector();toast('视角已应用当前对白。');},
  cancelled:()=>{cameraEditOwner=null;toast('镜头调整已取消。');}
 });
}
async function beginDialogueCameraEdit(){
 if(playing||modulePanel||!step())return;
 try{await updatePreview();cameraEditOwner={actId:act().id,stepId:step().id};dialogueCamera.startEdit();dialogueCamera.requestMouseLock();}catch(error){toast(error.message,true);}
}
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeDialogueCamera=async phase=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(ok,message)=>{if(!ok)throw Error(message);};
 if(phase==='editor'){
  activePanel='story';selectedAct=0;selectedStep=0;renderSidebar();renderInspector();await updatePreview();const before=snapshotCamera(stage.camera);
  document.querySelector('[data-action=edit-dialogue-camera]').click();for(let i=0;i<200&&!dialogueCamera.editing;i++)await wait(20);assert(dialogueCamera.editing,'没有进入镜头编辑');
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'w',code:'KeyW',bubbles:true}));dialogueCamera.moveKeys(.5);document.dispatchEvent(new KeyboardEvent('keyup',{key:'w',code:'KeyW',bubbles:true}));
  const viewport=document.querySelector('.stage-frame');viewport.dispatchEvent(new MouseEvent('mousemove',{clientX:200,clientY:250,bubbles:true}));viewport.dispatchEvent(new MouseEvent('mousemove',{clientX:230,clientY:265,bubbles:true}));viewport.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true}));
  assert(!dialogueCamera.editing&&step().camera,'左键没有确认镜头');assert(new THREE.Vector3().fromArray(before.position).distanceTo(new THREE.Vector3().fromArray(step().camera.position))>1,'WASD 没有移动');assert(document.querySelector('#toast').textContent.includes('视角已应用当前对白'),'没有应用提示');
  const first=structuredClone(step().camera);act().steps[1].camera={...structuredClone(first),position:[first.position[0]+6,first.position[1],first.position[2]]};markDirty();await save();return {ok:true,wasd:true,leftConfirm:true,perDialogue:true};
 }
 if(phase==='export'){await bridge('exportGame',{folderName:'对白镜头试玩'});return {ok:true,exported:true};}
 if(phase==='player'){
  playing=true;playAct=0;playStep=0;preparedAct=-1;cameraActId='';await showPlayStep();finishTyping();assert(stage.camera.position.distanceTo(new THREE.Vector3().fromArray(project.acts[0].steps[0].camera.position))<.001,'初始对白镜头丢失');
  playStep=1;const pending=showPlayStep();for(let i=0;i<200&&!dialogueCamera.moving;i++)await wait(20);assert(dialogueCamera.moving,'没有平滑移动');document.querySelector('.stage-frame').click();await pending;assert(stage.camera.position.distanceTo(new THREE.Vector3().fromArray(project.acts[0].steps[1].camera.position))<.001,'点击没有瞬移');
  playStep=0;const begin=performance.now();await showPlayStep();assert(performance.now()-begin>500,'自然过渡过快');finishTyping();renderSettingsModal();const slider=document.querySelector('[data-camera-speed]');assert(slider,'没有玩家镜头速度设置');slider.value='115';slider.dispatchEvent(new Event('input',{bubbles:true}));assert(cameraSpeed===1.15,'速度滑动条无效');closePlayerModal();return {ok:true,savedCamera:true,smoothTravel:true,clickSkip:true,playerSpeed:true};
 }
};
async function openEditorModule(module){
 if(!moduleLabels[module])return;
 await bridge('openEditorModule',{module,project:structuredClone(project),revision:changeRevision,view:{selectedAct,selectedStep,selectedCharacter,selectedItem}});
}
function scheduleModuleRefresh(){
 clearTimeout(moduleNotifyTimer);moduleNotifyTimer=setTimeout(()=>{
  if(saveInFlight){scheduleModuleRefresh();return;}
  bridge('notifyEditorModules',{project:structuredClone(project),revision:changeRevision}).catch(()=>{});
 },300);
}
function refreshEditorModule(payload){
 const latest=payload.project||payload,revision=Number(payload.revision)||0;
 if(revision<moduleBaselineRevision)return;
 if(!modulePanel||!moduleBaseline||!project||latest?.id!==project.id)return;
 if(saveInFlight){moduleRefreshPending=payload;return;}
 if(JSON.stringify(latest)===JSON.stringify(moduleBaseline))return;
 try{
  const actId=act()?.id,roleId=project.characters[selectedCharacter]?.id,itemId=project.items[selectedItem]?.id;
  const merged=mergeEditorProject(moduleBaseline,latest,project);rebaseModuleHistory(moduleBaseline,latest);
  project=merged;moduleBaseline=structuredClone(latest);moduleBaselineRevision=revision;normalize();
  selectedAct=Math.max(0,project.acts.findIndex(item=>item.id===actId));selectedCharacter=Math.max(0,project.characters.findIndex(item=>item.id===roleId));selectedItem=Math.max(0,project.items.findIndex(item=>item.id===itemId));
  const activeInput=document.activeElement?.matches('input,textarea,select,[contenteditable=true]');
  const removedSelection=actId&&!project.acts.some(item=>item.id===actId)||roleId&&!project.characters.some(item=>item.id===roleId)||itemId&&!project.items.some(item=>item.id===itemId);
  renderSidebar();if(!activeInput||removedSelection)renderInspector();else document.activeElement.addEventListener('blur',()=>renderInspector(),{once:true});updatePreview();
 }catch(error){toast(error.message,true);}
}
function rebaseModuleHistory(before,current){
 editorHistory.amend(snapshot=>{const value=rebaseEditorHistoryProject(before,current,snapshot);for(const key of Object.keys(snapshot))delete snapshot[key];Object.assign(snapshot,value);return true;});
}
window.editorProjectSnapshot=()=>structuredClone(project);
if(new URLSearchParams(location.search).has('smoke')){
 window.__vrmSmokeOpenModule=module=>openEditorModule(module);
 window.__vrmSmokeModuleLateEdit=()=>{project.characters[0].name='关闭时保存角色';markDirty();renderInspector();return {ok:true};};
 window.__vrmSmokeModuleUndoRedo=async()=>{await restoreEditorHistory(-1);if(project.characters[0].name!=='独立角色窗口验证'||project.acts[selectedAct].steps[0].text!=='主窗口在独立窗口打开之后修改的对白')throw Error('独立窗口撤销影响了主窗口对白');await restoreEditorHistory(1);if(project.characters[0].name!=='独立角色窗口连续保存')throw Error('独立窗口重做失败');return {ok:true};};
 window.__vrmSmokeModuleChange=async(second=false)=>{
  if(modulePanel==='characters')project.characters[0].name=second?'独立角色窗口连续保存':'独立角色窗口验证';
  if(modulePanel==='items')project.items.push({id:'module-item-test',name:'独立物品窗口验证',description:'这是一件用来检查独立窗口保存的示例物品。',imageId:''});
  if(modulePanel==='title')project.title.actors[0].yaw=23;
  if(modulePanel==='render')project.acts[selectedAct].render.brightness=123;
  if(modulePanel!=='knowledge'){markDirty();renderSidebar();renderInspector();await updatePreview();}
  return {ok:true,module:modulePanel,dirty,activePanel};
 };
 window.__vrmSmokeWorkspace=async phase=>{
  const assert=(test,message)=>{if(!test)throw Error(message);};
  if(phase==='layout'){
   selectedAct=0;selectedStep=0;const first=structuredClone(act().steps[0]);act().steps=Array.from({length:140},(_,i)=>({...structuredClone(first),id:'layout-line-'+i,text:'这是第一幕第 '+(i+1)+' 句对白，用来检查大量对白时的幕切换。'}));
   markDirty();renderSidebar();renderInspector();await updatePreview();
   assert(document.querySelectorAll('.act-list [data-action=select-act]').length===project.acts.length,'幕列表数量错误');
   assert(document.querySelectorAll('.dialogue-column [data-action=select-step]').length===140,'对白没放右边');
   assert(!document.querySelector('.story-left .sidebar [data-action=select-step]'),'幕列表仍夹着对白');
   document.querySelector('[data-action=select-act][data-index="1"]').click();await new Promise(r=>setTimeout(r,250));
   assert(document.querySelectorAll('.dialogue-column [data-action=select-step]').length===act().steps.length,'混入其他幕对白');
   assert(document.querySelector('.dialogue-column').textContent.includes(act().name),'当前幕标识不正确');
   const fields=document.querySelector('.story-left .inspector [data-field="step.text"]');assert(fields&&fields.value===step().text,'左上不是当前对白编辑区');
   assert(getComputedStyle(document.querySelector('.act-list .selected')).animationName==='story-selection-glow','没有当前幕光圈');
   return {ok:true,actsSeparate:true,currentActOnly:true,leftInspector:true,selectionGlow:true,manyDialogues:140};
  }
  if(phase==='concurrent'){step().text='主窗口在独立窗口打开之后修改的对白';markDirty();renderSidebar();renderInspector();return {ok:true};}
  if(phase==='verify'){assert(project.characters[0].name==='独立角色窗口连续保存','角色修改没合并');assert(step().text==='主窗口在独立窗口打开之后修改的对白','主窗口对白被覆盖');assert(project.items.some(i=>i.id==='module-item-test'),'物品修改没有保存');assert(project.title.actors[0].yaw===23,'标题修改没有保存');assert(project.acts[selectedAct].render.brightness===123,'渲染修改没有保存');return {ok:true,mainDialoguePreserved:true,moduleChangesSaved:true};}
 };
}
window.editorEnvironmentFromModule=payload=>{
 const current=project.environments.find(env=>env.id===payload.environment?.id)||payload.environment;
 environmentBaselines.set(current.id,JSON.stringify(current));
 return {...payload,environment:structuredClone(current),environments:structuredClone(project.environments),environmentLibrary:structuredClone(project.environmentLibrary),assets:structuredClone(project.assets),projectId:project.id};
};
async function applyEditorModuleCommit(message){
 try{
  const selectedId=act()?.id,lineId=step()?.id;
  const merged=mergeEditorProject(message.payload.base,project,message.payload.project);
  project=merged;normalize();selectedAct=Math.max(0,project.acts.findIndex(item=>item.id===selectedId));selectedStep=Math.max(0,act()?.steps.findIndex(line=>line.id===lineId)||0);
  markDirty({label:'编辑'+(moduleLabels[message.module]||'工程')});renderSidebar();renderInspector();await save();await updatePreview();
  await bridge('editorModuleCommitReply',{id:message.id,ok:true,data:{project:structuredClone(project),revision:changeRevision,applied:true}});
 }catch(error){await bridge('editorModuleCommitReply',{id:message.id,ok:false,error:error.message});}
}
function dialogueVoiceField(current) {
  const role = character(current.characterId);
  const voices = voicesForCharacter(project, current.characterId);
  return `<div class="field dialogue-voice-field"><span>角色配音${role ? ` · ${escape(role.name)}` : ''}</span>
    ${select('step.voiceId', voices, current.voiceId, role ? '无配音（仅显示这个角色的配音）' : '请先选择这句对白的角色')}
    <div class="dialogue-voice-tools">${button(current.voiceId ? '上传新配音' : '上传配音', 'upload-dialogue-voice')}
    ${button('▶ 试听', 'preview-dialogue-voice', current.voiceId ? '' : 'disabled')}
    ${button('移除绑定', 'remove-dialogue-voice', current.voiceId ? '' : 'disabled')}</div>
    <p class="tip">只在这句对白上传。文件自动放入角色专属文件夹，并用对白全文命名。</p></div>`;
}
function stopEditorVoicePreview() {
  editorVoicePreview.pause(); editorVoicePreview.removeAttribute('src'); editorVoicePreview.load(); previewVoiceId = '';
}
async function previewDialogueVoice(id) {
  const item = asset(id);
  if (item?.type !== 'voice') return;
  if (previewVoiceId === id && !editorVoicePreview.paused) { stopEditorVoicePreview(); renderAssetDock(); return; }
  stopEditorVoicePreview(); previewVoiceId = id; editorVoicePreview.src = assetUrl(item);
  try { await editorVoicePreview.play(); } catch (error) { previewVoiceId = ''; toast(`无法试听：${error.message}`, true); }
  renderAssetDock();
}
function redirectVoiceUpload() {
  const folder = project.assetFolders.find(item => item.id === currentAssetFolder.voice);
  const roleId = folder?.characterId || step()?.characterId;
  const candidates = dialogueLines(project).filter(({ line }) => !roleId || line.characterId === roleId);
  const selected = !isEvent(act()) && step() && (!roleId || step().characterId === roleId) ? { act: act(), line: step() } : null;
  const target = selected || candidates.find(({ line }) => !line.voiceId) || candidates[0] || dialogueLines(project)[0];
  activePanel = 'story';
  if (target) { selectedAct = project.acts.indexOf(target.act); selectedStep = target.act.steps.indexOf(target.line); }
  renderSidebar(); renderInspector(); updatePreview();
  const field = document.querySelector('.dialogue-voice-field');
  field?.classList.add('voice-upload-target'); field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  field?.querySelector('[data-action="upload-dialogue-voice"]')?.focus({ preventScroll: true });
  setTimeout(() => field?.classList.remove('voice-upload-target'), 4000);
  toast(roleId && target?.line.characterId !== roleId ? '这个角色还没有对白。请先新增对白并选择该角色，再在对白里上传配音。'
    : '配音不能在素材库上传。请在对应对白的“上传配音”按钮上传。', true);
}
async function uploadDialogueVoice() {
  const targetProject = project, targetAct = act(), target = step(), role = character(target?.characterId);
  if (isEvent(targetAct) || !target) { toast('请先选中要配音的对白。', true); return; }
  if (!role) { toast('请先为这句对白选择一个角色；旁白也可以创建一个“旁白”角色。', true); return; }
  if (!target.text?.trim()) { toast('请先填写对白内容，再上传配音。', true); return; }
  const item = await bridge('importDialogueVoice', { project: structuredClone(project), actId: targetAct.id, dialogueId: target.id });
  if (!item || project !== targetProject || !project.acts.includes(targetAct) || !targetAct.steps.includes(target) || target.characterId !== role.id) return;
  project.assets.push(item); target.voiceId = item.id;
  const referenced = new Set(dialogueLines(project).map(({ line }) => line.voiceId));
  project.assets = project.assets.filter(previous => previous.type !== 'voice' || previous.dialogueId !== target.id ||
    previous.id === item.id || referenced.has(previous.id));
  syncDialogueVoices(project); markDirty({ label: '上传对白配音' });
  renderSidebar(); renderInspector(); toast('配音已上传，已按对白全文命名并放入角色文件夹。');
}
function renderVoiceLibrary(body, folderId, folders, selectedFolder, scroll) {
  const visible = folderId ? byType('voice').filter(item => item.folderId === folderId) : [];
  body.innerHTML = `<div class="asset-browser-toolbar"><div class="asset-browser-location">
    ${folderId ? button('← 返回', 'asset-folder-back') : '<strong>角色专属配音文件夹</strong>'}<span>${escape(selectedFolder?.name || '')}</span></div>
    <div class="asset-browser-actions">${button('去对白上传配音', 'import', 'data-type="voice"')}</div></div>
    <p class="voice-library-note">配音请到对应对白上传；这里只能试听、删除。角色文件夹固定保留。</p>
    <div class="asset-file-area" data-asset-dropzone="voice" aria-label="角色配音文件区"><div class="asset-tile-grid">
    ${!folderId ? folders.map(folder => renderAssetFolderTile(folder)).join('') : ''}
    ${visible.map(item => `<div class="asset-tile asset-file-tile asset-voice-tile" data-copy-asset-id="${escape(item.id)}" title="${escape(item.name)}"><div class="asset-tile-picture"><span class="asset-tile-icon" aria-hidden="true">🎙</span></div>
      <span class="asset-tile-name">${escape(item.name)}</span><div class="asset-tile-tools">
      ${button(previewVoiceId === item.id && !editorVoicePreview.paused ? 'Ⅱ 停止' : '▶ 试听', 'preview-voice-asset', `data-asset-id="${escape(item.id)}"`)}
      ${button('删除', 'delete-asset', `data-asset-id="${escape(item.id)}" class="asset-delete"`)}</div></div>`).join('')}</div>
      <div class="asset-drop-hint">${folderId ? (visible.length ? '新增配音请到对应对白上传' : '这个角色还没有配音，请到对应对白上传') : (folders.length ? '选择一个角色文件夹试听配音' : '创建角色后，会自动建立不可删除的专属配音文件夹')}</div>
    </div>`;
  body.scrollTop = scroll;
}

function renderAssetDock() {
  const body = document.querySelector('#asset-dock-body');
  if (!body || !project) return;
  if (dockInitializedProjectId !== project.id) {
    for (const folder of project.assetFolders) openAssetFolders.add(folder.id);
    for (const type of Object.keys(currentAssetFolder)) currentAssetFolder[type] = '';
    dockInitializedProjectId = project.id;
  }
  const type = activeAssetType;
  const folders = project.assetFolders.filter(folder => (folder.type===type||['music','effect'].includes(type)&&folder.type==='audio'&&folder.audioKind===type)&&!folder.hidden&&folder.id!==autoPortraitFolderId&&(type!=='motion'||folder.motionScope));
  if (currentAssetFolder[type] && !folders.some(folder => folder.id === currentAssetFolder[type])) currentAssetFolder[type] = '';
  const folderId = currentAssetFolder[type];
  const selectedFolder = folders.find(folder => folder.id === folderId);
  const scroll = body.scrollTop;
  const settingsOpen = body.querySelector('.asset-dock-settings')?.open || false;
  const tabs = [['image', '图像'], ['vrm', 'VRM'], ['fbxCharacter','FBX 人物'], ['mmdCharacter','MMD 人物'], ['sceneModel','物品与模型'], ['motion', '动作'], ['music', '音乐'], ['effect', '音效'], ['voice', '配音'], ['video', '视频']];
  document.querySelector('#asset-dock-tabs').innerHTML = tabs.map(([key, label]) =>
    `<button type="button" role="tab" aria-selected="${type === key}" class="${type === key ? 'active' : ''}" data-action="asset-tab" data-type="${key}">${label}<small>${byType(key).length}</small></button>`).join('');
  if (type === 'voice') { renderVoiceLibrary(body, folderId, folders, selectedFolder, scroll); return; }
  refreshVrmThumbnails();
  const visible = byType(type).filter(item => folderId ? item.folderId === folderId : !folders.some(folder => folder.id === item.folderId));
  modelThumbnails.refresh(visible);
  body.innerHTML = `<div class="asset-browser-toolbar">
      <div class="asset-browser-location">${folderId ? button('← 返回', 'asset-folder-back') : '<strong>全部文件夹</strong>'}<span>${escape(selectedFolder?.name || (folderId ? '文件夹' : '未分类素材'))}</span></div>
      <div class="asset-browser-actions">${selectedFolder?.locked||type==='motion'&&!folderId?'':folderId?button('改名','rename-asset-folder',`data-folder-id="${escape(folderId)}"`):button('＋ 文件夹','add-asset-folder',`data-type="${type}"`)}${button('＋ 导入', 'import', `data-type="${type}" data-folder-id="${escape(folderId)}"`)}</div>
    </div><div class="asset-file-area" data-asset-dropzone="${type}" aria-label="${escape(type)} 素材文件区">
      <div class="asset-tile-grid">${!folderId ? folders.map(folder => renderAssetFolderTile(folder)).join('') : ''}${visible.map(item => renderAssetTile(item, folders)).join('')}</div>
      <div class="asset-drop-hint">双击空白处上传素材，或将文件、文件夹拖到这里</div>
    </div><details class="asset-dock-settings" ${settingsOpen ? 'open' : ''}><summary>游戏界面与鉴赏设置</summary><div class="asset-dock-settings-body">
    ${button('选择游戏 UI · '+gameUiPresets.find(preset=>preset.id===normalizeGameUi(project.ui.gameTheme)).name,'game-ui')}
    ${field('对话框图片', select('project.ui.dialogueImageId', byType('image'), project.ui.dialogueImageId, '使用内置样式'))}
    <p class="tip">可换成自己的 PNG 或 WebP 图片。建议使用横向、带透明通道的图片。</p>
    <h3>图片鉴赏</h3><p class="tip">勾选后，玩家在游戏里见过的图片可进入图像鉴赏。</p>
    ${byType('image').length ? byType('image').map(item => `<label class="gallery-audio-check gallery-image-check"><input type="checkbox" data-gallery-image="${escape(item.id)}" ${item.galleryImage === false ? '' : 'checked'}><span>${escape(item.name)}</span></label>`).join('') : '<p class="tip">还没有导入图片。</p>'}
    <h3>音乐鉴赏</h3><p class="tip">勾选要收录的音乐；音效可以取消勾选。角色配音在单独的配音栏管理。</p>
    ${byType('music').length ? byType('music').map(item => `<div class="gallery-audio-editor"><label class="gallery-audio-check"><input type="checkbox" data-gallery-music="${escape(item.id)}" ${item.galleryMusic === false ? '' : 'checked'}><span>${escape(item.name)}</span></label>
      <input data-audio-title="${escape(item.id)}" value="${escape(item.galleryTitle || '')}" placeholder="歌名：${escape(item.name.replace(/\.[^.]+$/, ''))}"></div>`).join('') : '<p class="tip">还没有导入音频。</p>'}
    <p class="tip">支持 VRM 人物、VRMA / Mixamo FBX 动作、PNG / JPG / WebP 图片、MP3 / WAV / OGG 声音和 MP4 / WebM 视频。</p>
  </div></details>`;
  body.scrollTop = scroll;
}
function renderAssetFolderTile(folder) {
  const count = byType(folder.type).filter(item => item.folderId === folder.id).length;
  return `<button type="button" class="asset-tile asset-folder-tile" data-action="asset-open-folder" data-folder-id="${escape(folder.id)}" title="打开 ${escape(folder.name)}">
    <span class="asset-folder-picture" aria-hidden="true">📁</span><span class="asset-tile-name">${escape(folder.name)}</span><small>${count} 个素材${folder.locked?(folder.characterDeleted?' · 角色已删除，文件夹保留':' · 固定文件夹'):''}</small></button>`;
}
function renderAssetTile(item, folders) {
  const icons = { vrm: '♟', motion: '▶', audio: '♫', video: '▣' };
  const preview = item.type === 'image'
    ? `<img class="asset-tile-preview" loading="lazy" src="${escape(assetUrl(item))}" alt="${escape(item.name)}的缩略图">`
    : ['mmdCharacter','fbxCharacter'].includes(item.type)&&item.thumbnailPath
      ? `<img class="asset-tile-preview model-thumbnail" loading="lazy" src="${escape(assetUrl({path:item.thumbnailPath}))}" alt="${escape(item.name)}的人物缩略图">`
    : modelThumbnails.isBusy(item.id)?'<span class="asset-thumbnail-pending">正在拍摄头像…</span>'
    : item.type === 'vrm' && vrmThumbnails.get(assetUrl(item))?.url
      ? `<img class="asset-tile-preview vrm-embedded-thumbnail" src="${escape(vrmThumbnails.get(assetUrl(item)).url)}" alt="${escape(item.name)}自带的头像">`
    : `<span class="asset-tile-icon asset-tile-icon-${item.type}" aria-hidden="true">${icons[item.type] || '▣'}</span>`;
  return `<div class="asset-tile asset-file-tile" data-copy-asset-id="${escape(item.id)}" title="${escape(item.name)}"><div class="asset-tile-picture">${preview}</div><span class="asset-tile-name">${escape(item.name)}</span>
    <div class="asset-tile-tools"><select data-asset-folder="${escape(item.id)}" aria-label="把 ${escape(item.name)} 移动到文件夹" title="移动到文件夹">
      ${item.type==='motion'?'':`<option value="" ${!item.folderId?'selected':''}>未分类</option>`}${folders.map(folder => `<option value="${escape(folder.id)}" ${item.folderId === folder.id ? 'selected' : ''}>${escape(folder.name)}</option>`).join('')}
    </select>${item.type==='audio'?`<select data-audio-kind="${escape(item.id)}" aria-label="声音分类"><option value="music" ${item.audioKind==='music'?'selected':''}>音乐</option><option value="effect" ${item.audioKind==='effect'?'selected':''}>音效</option></select>`:''}${button('删除', 'delete-asset', `data-asset-id="${escape(item.id)}" class="asset-delete"`)}</div></div>`;
}
function reorderStory(kind, source, target, after) {
  const items = kind === 'act' ? project.acts : act()?.steps;
  if (!items || source < 0 || target < 0 || source >= items.length || target >= items.length) return;
  const selectedActId = act()?.id;
  const selectedStepId = step()?.id;
  let insertion = target + (after ? 1 : 0);
  if (source < insertion) insertion--;
  if (source === insertion) return;
  const [moved] = items.splice(source, 1);
  items.splice(insertion, 0, moved);
  selectedAct = Math.max(0, project.acts.findIndex(item => item.id === selectedActId));
  selectedStep = Math.max(0, act()?.steps.findIndex(item => item.id === selectedStepId) ?? 0);
  markDirty(); renderSidebar(); renderInspector(); updatePreview();
}
function clearStoryDrag() {
  document.querySelectorAll('.sortable-row').forEach(node => node.classList.remove('dragging', 'drop-before', 'drop-after'));
}
document.addEventListener('dragstart', event => {
  const row = event.target.closest?.('[data-order-kind]');
  if (!row || !project || activePanel !== 'story') return;
  draggingStory = { kind: row.dataset.orderKind, index: Number(row.dataset.orderIndex), actId: act()?.id };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', `${draggingStory.kind}:${draggingStory.index}`);
  row.classList.add('dragging');
});
document.addEventListener('dragover', event => {
  const row = event.target.closest?.('[data-order-kind]');
  if (!row || !draggingStory || row.dataset.orderKind !== draggingStory.kind ||
      (draggingStory.kind === 'step' && draggingStory.actId !== act()?.id)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  clearStoryDrag();
  row.classList.add(event.clientY > row.getBoundingClientRect().top + row.clientHeight / 2 ? 'drop-after' : 'drop-before');
});
document.addEventListener('drop', event => {
  const row = event.target.closest?.('[data-order-kind]');
  if (!row || !draggingStory || row.dataset.orderKind !== draggingStory.kind) return;
  event.preventDefault();
  const after = event.clientY > row.getBoundingClientRect().top + row.clientHeight / 2;
  reorderStory(draggingStory.kind, draggingStory.index, Number(row.dataset.orderIndex), after);
  draggingStory = null;
  clearStoryDrag();
});
document.addEventListener('dragend', () => { draggingStory = null; clearStoryDrag(); });
document.addEventListener('dblclick', event => {
  const area = event.target.closest?.('.asset-file-area');
  if (!area || event.target.closest('.asset-tile, button, select, input')) return;
  if (activeAssetType === 'image') renderImageImportModal(currentAssetFolder.image);
  else importAssets(activeAssetType, currentAssetFolder[activeAssetType]).catch(error => toast(error.message, true));
});
document.addEventListener('dragover', event => {
  const area = event.target.closest?.('.asset-file-area');
  if (!area || !event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  area.classList.add('drag-over');
});
document.addEventListener('dragleave', event => {
  const area = event.target.closest?.('.asset-file-area');
  if (area && !area.contains(event.relatedTarget)) area.classList.remove('drag-over');
});
document.addEventListener('drop', async event => {
  const area = event.target.closest?.('.asset-file-area');
  if (!area || !event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  area.classList.remove('drag-over');
  try { await importDroppedEntries(event.dataTransfer); }
  catch (error) { toast(error.message, true); }
});
const droppedAssetTypes = {
  vrm: ['.vrm'], sceneModel:['.glb'], motion: ['.vrma', '.fbx', '.vmd'], image: ['.png', '.jpg', '.jpeg', '.webp'],
  audio: ['.mp3', '.wav', '.ogg'], video: ['.mp4', '.webm']
};
function droppedAssetType(name) {
  const extension = name.slice(name.lastIndexOf('.')).toLowerCase();
  return Object.keys(droppedAssetTypes).find(type => droppedAssetTypes[type].includes(extension));
}
async function readDroppedEntry(entry, folderName, result) {
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    result.push({ file, folderName });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      for (const child of batch) await readDroppedEntry(child, folderName || entry.name, result);
    }
  }
}
async function importDroppedEntries(transfer) {
  if(['fbxCharacter','mmdCharacter'].includes(activeAssetType)){toast('人物模型请点击“导入”，这样可以一起收集旁边的贴图。');return;}
  if (activeAssetType === 'voice') { redirectVoiceUpload(); return; }
  const entries = [];
  const items = [...transfer.items].filter(item => item.kind === 'file')
    .map(item => ({ entry: item.webkitGetAsEntry?.(), file: item.getAsFile() }));
  const fallbackFiles = [...transfer.files];
  for (const item of items) {
    if (item.entry) await readDroppedEntry(item.entry, item.entry.isDirectory ? item.entry.name : '', entries);
    else if (item.file) entries.push({ file: item.file, folderName: '' });
  }
  if (!items.length) for (const file of fallbackFiles) entries.push({ file, folderName: '' });
  let imported = 0;
  let skipped = 0;
  const folderCache = new Map();
  for (const { file, folderName } of entries) {
    if(/\.(pmx|pmd)$/i.test(file.name)){toast('MMD 模型请点击“导入”，程序会一起收集它的贴图。');skipped++;continue;}
    const type = droppedAssetType(file.name);
    if (!type) { skipped++; continue; }
    const audioKind=type==='audio'&&['music','effect'].includes(activeAssetType)?activeAssetType:null;
    let folderId = audioKind?currentAssetFolder[audioKind]||'':type === activeAssetType ? currentAssetFolder[type] : '';
    if(type==='motion')folderId=folderId||commonMotionFolderId;
    if (folderName&&type!=='motion') {
      const key = `${type}:${folderName.toLowerCase()}`;
      if (!folderCache.has(key)) {
        let folder = project.assetFolders.find(item => item.type === type && item.name.toLowerCase() === folderName.toLowerCase()&&(!audioKind||item.audioKind===audioKind));
        if (!folder) {
          folder = { id: uid(), type, name: folderName.slice(0, 64),...(audioKind?{audioKind}:{}) };
          project.assetFolders.push(folder);
        }
        folderCache.set(key, folder.id);
      }
      folderId = folderCache.get(key);
    }
    const transferId = uid();
    try {
      await bridge('importAssetChunk', { command: 'start', transferId, type, name: file.name });
      for (let offset = 0; offset < file.size; offset += 256 * 1024) {
        const bytes = new Uint8Array(await file.slice(offset, offset + 256 * 1024).arrayBuffer());
        let binary = '';
        for (let pos = 0; pos < bytes.length; pos += 16384) binary += String.fromCharCode(...bytes.subarray(pos, pos + 16384));
        await bridge('importAssetChunk', { command: 'append', transferId, base64: btoa(binary) });
      }
      const assetItem = await bridge('importAssetChunk', { command: 'finish', transferId });
      assetItem.folderId = folderId;
      if(audioKind)assetItem.audioKind=audioKind;
      if (type === 'image') assetItem.galleryImage = false;
      project.assets.push(assetItem);
      imported++;
    } catch (error) {
      await bridge('importAssetChunk', { command: 'abort', transferId }).catch(() => {});
      throw error;
    }
  }
  if (imported || folderCache.size) { markDirty(); renderAssetDock(); renderInspector(); }
  toast(`已导入 ${imported} 个素材${skipped ? `，跳过 ${skipped} 个不支持的文件` : ''}`);
}
document.addEventListener('toggle', event => {
  const details = event.target;
  if (!details.matches?.('.asset-folder')) return;
  if (details.open) openAssetFolders.add(details.dataset.folderKey);
  else openAssetFolders.delete(details.dataset.folderKey);
}, true);
function propEditor(item) {
  const record=stage?.visibleRecords.get(`gallery:${item.id}`);
  const bones=availablePropBones(record),choices=bones.length?bones:Object.entries(propBoneLabels).map(([value,label])=>({value,label}));
  return `<section class="prop-editor"><h2>绑定物品</h2><p class="tip">先导入 GLB，添加物品，再选手或其他骨骼。角色页会显示所有已绑定物品，方便调整；对白里勾选后才会显示。</p><div class="inline-actions">${button('导入物品 GLB','import-prop-model')}${button('＋ 添加物品','add-character-prop')}${item.props?.length?button('调整视角与物品','binding-view-open'):''}</div>${(item.props||[]).map((prop,index)=>`<details class="prop-binding" data-copy-id="${escape(prop.id)}" ${index===0?'open':''}><summary>${escape(prop.name||'物品')}</summary>
    ${field('物品名称',`<input data-prop-field="name" data-prop-id="${escape(prop.id)}" value="${escape(prop.name)}">`)}
    ${field('物品模型',`<select data-prop-field="assetId" data-prop-id="${escape(prop.id)}">${options(byType('sceneModel'),prop.assetId,'请选择 GLB')}</select>`)}
    ${field('绑定骨骼',`<select data-prop-field="bone" data-prop-id="${escape(prop.id)}">${choices.map(b=>`<option value="${escape(b.value)}" ${b.value===prop.bone?'selected':''}>${escape(b.label)}</option>`).join('')}${!choices.some(b=>b.value===prop.bone)?`<option selected value="${escape(prop.bone)}">${escape(prop.bone)}（等待模型读取）</option>`:''}</select>`)}
    <div class="inline-actions">${button('放大绑定部位','binding-view-bone',`data-prop-id="${escape(prop.id)}"`)}${button('看物品','binding-view-item',`data-prop-id="${escape(prop.id)}"`)}</div>
    ${['position','rotation','scale'].map((kind,i)=>`<details class="prop-vector" ${i===0?'open':''}><summary>${['位置（米）','旋转（度）','缩放'][i]}</summary>${prop[kind].map((value,axis)=>{
      const lower=kind==='scale'?.001:kind==='rotation'?-180:-2,upper=kind==='scale'?5:kind==='rotation'?180:2;
      const data=`data-prop-transform="${escape(prop.id)}" data-vector="${kind}" data-axis="${axis}"`;
      return `<div class="prop-axis" data-prop-axis="${escape(prop.id)}.${kind}.${axis}"><label class="prop-number"><span>${['X · 左右','Y · 上下','Z · 前后'][axis]}</span><input type="number" ${data} data-mode="number" min="${kind==='scale'?.001:-10000}" max="10000" step="${kind==='rotation'?.1:.001}" value="${Number(value.toFixed(5))}"></label><label><span>细调</span><input type="range" ${data} data-mode="fine" min="-100" max="100" step="1" value="0"></label></div>`;
    }).join('')}</details>`).join('')}<p class="tip">细调一次：位置 0.001 米、旋转 0.1 度、缩放 0.001。松开细调滑块后会回到中间，保留修改结果。模型先按最长边约 0.8 米摆放。</p>${button('移除这个绑定','remove-character-prop',`data-prop-id="${escape(prop.id)}" class="danger"`)}</details>`).join('')}</section>`;
}
function castEditor(currentAct, slot) {
  const settings = castSettingsOf(currentAct, slot);
  const actorId = settings.characterId;
  const slider=(key,label,value,min,max,stepSize,unit='')=>preciseTransform(label,value,key.startsWith('offset')?-100:key==='yaw'||key==='pitch'?-360:min,key.startsWith('offset')?100:key==='yaw'||key==='pitch'?360:max,`data-cast-adjust="${slot}.${key}"`,`data-cast-output="${slot}.${key}"`,unit,key==='yaw'||key==='pitch'?.1:key==='size'?.1:.01);
  return `<details class="cast-editor" ${actorId && actorId===step()?.characterId?'open':''}><summary>${castSlotLabels[slot]} · ${escape(character(actorId)?.name || '未选择')}</summary>
    <div class="cast-editor-body">
      ${field('角色', `<select data-cast-slot="${slot}">${options(project.characters.filter(item => item.modelId || item.id === actorId), actorId, '此位置无人')}</select>`)}
      ${actorId ? `${field('这一句的动作', `<select data-cast-motion="${slot}">${options(motionsForCharacter(project,actorId), settings.motionId, '保持站立')}</select>`)}
        ${motionAdvanced(settings, `cast:${slot}`)}
        ${slider('size', '大小', Math.round((settings.size ?? defaultSize) * 100), 50, 250, 5, '%')}
        ${slider('offsetX', '左右', Number(settings.offsetX) || 0, -1.5, 1.5, 0.05)}
        ${slider('offsetY', '上下', Number(settings.offsetY) || 0, -3, 2, 0.05)}
        ${slider('offsetZ', '前后', Number(settings.offsetZ) || 0, -100, 100, 0.1)}
        ${slider('yaw', '转身角度', Number(settings.yaw) || 0, -360, 360, .1, '°')}
        ${slider('pitch','俯仰角度',Number(settings.pitch)||0,-360,360,.1,'°')}
${!isFbxModel(character(actorId)?.modelId) ? `<div class="field"><span>这一句的表情</span><div id="cast-expression-${slot}" class="expression-controls"></div></div>` : ''}<div class="dialogue-props"><b>这一句显示的物品</b>${(character(actorId)?.props||[]).map(prop=>`<label><input type="checkbox" data-cast-prop="${slot}" data-prop-id="${escape(prop.id)}" ${(settings.props||[]).includes(prop.id)?'checked':''}>${escape(prop.name||asset(prop.assetId)?.name||'物品')}</label>`).join('')||'<small>先到角色页绑定物品。</small>'}</div>` : ''}
    </div></details>`;
}

const inventoryItem=id=>project.items.find(item=>item.id===id);
const readyItems=()=>project.items.filter(item=>itemDefinitionReady(item,project.assets));
function inventoryRows(rows,kind,index=''){
 return `<div class="inventory-rows">${(rows||[]).map((row,i)=>`<div class="inventory-rule-row"><select data-inventory-row="${kind}" data-choice="${index}" data-row="${i}" data-key="itemId">${options(readyItems(),row.itemId,'选择物品')}${row.itemId&&!readyItems().some(item=>item.id===row.itemId)?`<option selected value="${escape(row.itemId)}">物品已删除或未填写完整</option>`:''}</select><input type="number" min="1" max="1000000" step="1" aria-label="物品数量" value="${row.quantity}" data-inventory-row="${kind}" data-choice="${index}" data-row="${i}" data-key="quantity">${button('删除','remove-inventory-row',`data-kind="${kind}" data-choice="${index}" data-row="${i}"`)}</div>`).join('')}</div>`;
}
function itemAcquisitionEditor(line){return `<details class="inventory-dialogue-editor"><summary>这一句获得的物品</summary>${inventoryRows(line.itemGrants,'grant')}${button('＋ 获得物品','add-inventory-grant')}<p class="tip">对白显示完后，额外显示“玩家获得了物品 × 数量”和正方形立绘。同一存档中这句不会重复发放。</p></details>`;}
async function uploadInventoryImage(){
 const owner=project,item=project.items[selectedItem];if(!item)return;const imported=await bridge('importAsset',{type:'image',single:true});if(project!==owner||!owner.items.includes(item)||!imported?.length)return;
 for(const source of imported)source.galleryImage=false;owner.assets.push(...imported);const picture=new Image();await new Promise((resolve,reject)=>{picture.onload=resolve;picture.onerror=()=>reject(Error('图片无法读取'));picture.src=assetUrl(imported[0]);});
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const context=canvas.getContext('2d'),scale=Math.min(512/picture.naturalWidth,512/picture.naturalHeight),w=picture.naturalWidth*scale,h=picture.naturalHeight*scale;context.drawImage(picture,(512-w)/2,(512-h)/2,w,h);
 const saved=await bridge('saveInventoryImage',{dataUrl:canvas.toDataURL('image/png'),itemId:item.id,name:item.name});if(project!==owner||!owner.items.includes(item))return;saved.galleryImage=false;saved.folderId='inventory-images';owner.assetFolders||=[];if(!owner.assetFolders.some(folder=>folder.id==='inventory-images'))owner.assetFolders.push({id:'inventory-images',name:'玩家物品立绘',type:'image'});owner.assets.push(saved);item.imageId=saved.id;markDirty();renderInspector();renderAssetDock();updatePreview();toast('已生成 1:1 物品立绘，原图保持完整。');
}
function refreshChoiceItems(){
 const line=project.acts[playAct]?.steps[playStep],node=document.querySelector('#choice-list');if(!line||!node)return;
 node.innerHTML=(line.choices||[]).map((choice,index)=>{const status=choiceItemStatus(choice,playerInventory,project.items),missing=status.missing.map(row=>`${row.name} × ${row.quantity}（现有 ${row.have}）`).join('、');return `<button data-action="choose" data-index="${index}" ${!status.allowed||playerInventory.pending.length?'disabled':''} class="${status.allowed?'':'choice-locked'}" title="${escape(status.allowed?'':`缺少：${missing}`)}">${escape(choice.text||'继续')}${!status.allowed?`<small class="choice-missing">缺少：${escape(missing)}</small>`:''}</button>`;}).join('');
}
function showItemReward(){
 if(!playing||!playerInventory.pending.length)return false;const row=playerInventory.pending[0],item=inventoryItem(row.itemId);if(!item){playerInventory.pending.shift();return showItemReward();}
 clearAutoAdvance();saveModalMode='item-reward';document.querySelector('#inventory-reward')?.remove();document.querySelector('.stage-frame').insertAdjacentHTML('beforeend',`<section id="inventory-reward" class="inventory-reward" role="dialog" aria-modal="true" aria-label="获得物品"><img class="inventory-reward-image" src="${escape(assetUrl(asset(item.imageId)))}" alt="${escape(item.name)}"><div class="inventory-reward-dialogue"><p>玩家获得了：<strong>${escape(item.name)} × ${row.quantity}</strong></p>${button('继续','confirm-item-reward')}</div></section>`);document.querySelector('[data-action="confirm-item-reward"]')?.focus();refreshChoiceItems();return true;
}
document.addEventListener('keydown',event=>{if(saveModalMode==='item-reward'&&['Enter',' ','Escape'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();document.querySelector('[data-action="confirm-item-reward"]')?.click();}},true);
function maybeGrantCurrentItems(){
 if(!playing||transitioning||typingTimer||saveModalMode)return false;const line=project.acts[playAct]?.steps[playStep];if(!line)return false;
 try{const gained=grantDialogueItems(line,playerInventory,project.items,project.assets);if(gained.length&&mode==='player'){const progress=loadLifetimeProgress();progress.seenItemIds||=[];for(const row of gained)if(!progress.seenItemIds.includes(row.itemId))progress.seenItemIds.push(row.itemId);localStorage.setItem(lifetimeKey(),JSON.stringify(progress));}refreshChoiceItems();return showItemReward();}catch(error){toast(error.message,true);return false;}
}
function itemViewState(){if(playing||inventorySession)return playerInventory;const last=readSaveSlots().filter(Boolean).sort((a,b)=>(Date.parse(b.savedAt)||0)-(Date.parse(a.savedAt)||0))[0];return normalizeInventory(last?.inventory,project.items);}
function itemGalleryMarkup(backpack=false){
 const state=itemViewState(),known=new Set([...(loadLifetimeProgress().seenItemIds||[]),...state.known]),items=readyItems().filter(item=>!backpack||state.counts[item.id]>0);
 return `<div class="inventory-grid">${items.map(item=>{const unlocked=backpack||mode==='editor'||known.has(item.id),count=state.counts[item.id]||0;return `<button class="inventory-card ${unlocked?'':'locked'}" data-action="inventory-detail" data-item-id="${escape(item.id)}" ${unlocked?'':'disabled'}><img src="${escape(assetUrl(asset(item.imageId)))}" alt="${escape(item.name)}"><b>${escape(item.name)}</b>${unlocked?`<small>当前持有：${count}</small>`:'<span class="inventory-seal">未获得</span>'}</button>`;}).join('')||'<p class="inventory-empty">背包里还没有物品。</p>'}</div>`;
}
function renderBackpack(){clearAutoAdvance();saveModalMode='inventory';document.querySelector('#player-modal')?.remove();document.querySelector('.stage-frame').insertAdjacentHTML('beforeend',`<section id="player-modal" class="player-modal"><div class="modal-box"><header><h2>物品栏</h2>${button('关闭 ×','close-modal')}</header>${itemGalleryMarkup(true)}</div></section>`);}
function renderItemDetail(id){const item=inventoryItem(id),state=itemViewState(),known=new Set([...(loadLifetimeProgress().seenItemIds||[]),...state.known]);if(!item||mode!=='editor'&&!known.has(id)&&!state.counts[id])return;const gallery=saveModalMode==='gallery';document.querySelector('#player-modal .gallery-content, #player-modal .inventory-grid')?.replaceWith(Object.assign(document.createElement('div'),{className:'inventory-detail',innerHTML:`<img src="${escape(assetUrl(asset(item.imageId)))}" alt="${escape(item.name)}"><h3>${escape(item.name)}</h3><p class="inventory-count">当前持有：${state.counts[id]||0}</p><p>${escape(item.description)}</p>${button('返回物品列表',gallery?'inventory-gallery-back':'open-inventory')}`}));}

function renderCastRows(currentAct){
 return castSlots.slice(0,3).map(slot=>castEditor(currentAct,slot)).join('')+Array.from({length:9},(_,i)=>{
  const slots=castSlots.slice((i+1)*3,(i+2)*3),count=slots.filter(s=>step()?.cast?.[s]?.characterId).length,open=slots.some(s=>step()?.cast?.[s]?.characterId&&step().cast[s].characterId===step().characterId);
  return `<details class="cast-queue-row" ${open?'open':''}><summary>第 ${i+2} 排 · ${count} / 3 人</summary>${slots.map(s=>castEditor(currentAct,s)).join('')}</details>`;
 }).join('');
}
function renderStyleEditor(settings,scope,override=null){
 const attr=`data-render-scope="${scope}"`,slider=(key,label,value,min,max,step=1)=>field(label,`<div class="npr-slider"><input type="range" data-render="${key}" ${attr} min="${min}" max="${max}" step="${step}" value="${value}"><input type="number" data-render="${key}" ${attr} min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}精确数值"></div>`);
 const preset=scope==='step'?(override?.preset||''):settings.preset;
 return `${field('渲染风格',`<select data-render="preset" ${attr}>${scope==='step'?`<option value="" ${!preset?'selected':''}>使用本幕风格</option>`:''}${Object.entries(renderPresets).map(([id,name])=>`<option value="${id}" ${preset===id?'selected':''}>${name}</option>`).join('')}</select>`)}
 ${settings.preset==='zzz'?slider('strength','风格浓度',Math.round(settings.strength*100),0,100):settings.preset==='tno'?'<p class="tip">固定的低饱和旧照片、青色描边、CRT 颗粒与随机撕裂。下方三个微调始终可用。</p>':''}
 <h3>画面微调</h3>${Object.entries(colorAdjustments).map(([key])=>slider(key,{brightness:'亮度',contrast:'对比度',saturation:'饱和度'}[key],settings[key],0,200)).join('')}
 ${settings.preset==='custom'?Object.entries(filterGroups).map(([group,name])=>`<details class="npr-filter-group"><summary>${name}</summary>${customFilterSpecs.filter(spec=>spec[6]===group).map(([key,label,min,max,step,fallback])=>field(label,min==='color'?`<input type="color" data-npr-filter="${key}" ${attr} value="${settings.filters[key]}">`:`<div class="npr-slider"><input type="range" data-npr-filter="${key}" ${attr} min="${min}" max="${max}" step="${step}" value="${settings.filters[key]}"><input type="number" data-npr-filter="${key}" ${attr} min="${min}" max="${max}" step="${step}" value="${settings.filters[key]}" aria-label="${label}精确数值"></div>`)).join('')}</details>`).join(''):''}`;
}

function renderInspector() {
  updateStoryCurrent();
  sceneAnimationDialog.close(false);
  if(activePanel==='items'){const item=project.items[selectedItem],body=document.querySelector('#inspector-body');body.innerHTML=item?`<div class="inspector-content"><h2>玩家物品设置</h2>${field('名字',`<input data-item-field="name" maxlength="100" value="${escape(item.name)}">`)}${asset(item.imageId)?`<img class="inventory-editor-image" src="${escape(assetUrl(asset(item.imageId)))}" alt="${escape(item.name)}">`:'<p class="tip">还没有立绘。</p>'}${button('上传物品立绘（自动整理为 1:1）','upload-inventory-image')}${field('物品介绍（建议约 100 字）',`<textarea data-item-field="description" maxlength="3000" placeholder="写清用途、来历和特点">${escape(item.description||'')}</textarea>`)}<p class="tip">所有物品统一管理。名字、立绘、介绍都填写后才可用于对白；是否扣除由分支选项决定。</p>${button('删除物品','delete-inventory-item','class="danger"')}</div>`:'<p class="tip">先新增物品。</p>';updatePreview();return;}
  if (activePanel === 'knowledge') { library.editor(); return; }
  const body = document.querySelector('#inspector-body');
  if (isEvent(act()) && ['story', 'render'].includes(activePanel)) { body.innerHTML = events.editor(act()); return; }
  if (activePanel === 'characters') {
    const item = project.characters[selectedCharacter];
    body.innerHTML = item ? `<div class="inspector-content"><h2>角色设置</h2>
      ${field('角色名字', input('character.name', item.name))}
      ${field('人物模型', select('character.modelId', actorModels(), item.modelId, '请选择模型'))}
      ${!isFbxModel(item.modelId) ? `<label class="field"><span>自动说话嘴型</span><select data-field="character.autoMouth"><option value="on" ${item.autoMouth !== false ? 'selected' : ''}>开启（默认）</option><option value="off" ${item.autoMouth === false ? 'selected' : ''}>关闭</option></select></label>
      <p class="tip">跟随对白文字显示动嘴，标点处稍作停顿；文字显示完就停止。有 A、I、U、E、O 嘴型的模型可使用。</p>` : '<p class="tip">FBX 人物只播放身体动作。</p>'}
      ${isLiveModel(item.modelId)?'<div class="portrait-editor"><span>说话头像 · 实时模型</span><p class="tip">固定使用此角色的可动模型头像，表情和嘴型与场上人物同步。无需上传或拍摄图片。</p></div>':`<div class="portrait-editor"><span>说话头像</span>${asset(item.portraitId) ? `<img src="${assetUrl(asset(item.portraitId))}" alt="${escape(item.name)}的头像">` : '<div class="portrait-empty">还没有头像</div>'}<div class="inline-actions">${button('上传 PNG 头像', 'upload-character-portrait')}${isFbxModel(item.modelId)?button('重新生成 FBX 头像','capture-character-portrait'):''}</div><p class="tip">FBX 使用静态图片头像，可自动生成或手动上传。没有模型的角色仍可上传 PNG。</p></div>`}
      ${field('角色详情待机动作', select('character.detailsIdleId', motionsForCharacter(project,item.id), item.detailsIdleId||'', '自然待机（自动）'))}
      <p class="tip">角色详情使用全身、正面的循环待机，不再设置定格帧。无需额外导入动作，也可以选择自己的待机动作。</p>
      ${propEditor(item)}
      ${field('身份 / 称号', input('character.title', item.title, '例如：旅行者、学生'))}
      ${field('角色简介', textarea('character.description', item.description, '玩家在角色详情里看到的介绍'))}
      <hr><h2>角色故事（最多三段）</h2>
      <p class="tip">留空的故事不会出现在游戏里。解锁数字填 0 时，玩家一开始就能阅读。</p>
      ${item.stories.map((story, index) => `<div class="character-story-editor">
        <h3>故事 ${index + 1}</h3>
        ${field('故事内容', `<textarea data-story-index="${index}" data-story-field="text" placeholder="不写就不显示">${escape(story.text)}</textarea>`)}
        ${field('读过这个角色多少句对白后解锁', `<input type="number" min="0" step="1" data-story-index="${index}" data-story-field="unlockLines" value="${Math.max(0, Number(story.unlockLines) || 0)}">`)}
      </div>`).join('')}
      <div class="inline-actions">${button('导入 VRM', 'import', 'data-type="vrm"')}${button('导入 FBX 人物', 'import', 'data-type="fbxCharacter"')}${button('导入 MMD 人物', 'import', 'data-type="mmdCharacter"')}${button('删除角色', 'delete-character', 'class="danger"')}</div>
      <p class="tip">选中角色后，预览里会显示它。表情名称取决于模型本身。</p></div>` : '<div class="inspector-content empty">先新增角色</div>';
    if (item) updatePreview();
    return;
  }
  if (activePanel === 'title') {
    const title = project.title;
    body.innerHTML = `<div class="inspector-content"><h2>标题画面</h2>
      ${title.logoImageId==='__none__'?'':field('游戏名称', `<input id="project-name" value="${escape(project.name)}" aria-label="游戏名称">`)}
      ${field('Logo 图片', `<select data-title-field="logoImageId"><option value="__none__" ${title.logoImageId==='__none__'?'selected':''}>不显示（留空）</option>${options(byType('image'), title.logoImageId, '使用游戏名称')}</select>`)}
      <div data-copy-environment>${field('标题场景', `<select data-title-field="environmentId">${options(project.environments || [], title.environmentId, '默认天空')}</select>`)}${button('编辑标题环境（独立窗口）','edit-environment')}</div>
      ${field('标题音乐', `<select data-title-field="bgmId">${options(byType('music'), title.bgmId, '无音乐')}</select>`)}
      ${field('按钮点击音效', `<select data-ui-field="clickSoundId">${options(byType('effect'), project.ui.clickSoundId, '使用内置轻提示音')}</select>`)}
      <p class="tip">选“不显示（留空）”后，左边的标题板会全部隐藏。底部菜单照常显示。</p>
      <details><summary>标题渲染与调色</summary>${renderStyleEditor(title.render||normalizeRender(project.render),'title')}</details>
      <hr><h2>标题人物 (${title.actors.length})</h2>${button('＋ 添加标题人物','add-title-actor')}
      <p class="tip">可以添加多个 VRM 或 FBX 人物，每个人分别调整。选择角色后，也能显示他绑定的物品。</p>
      ${title.actors.map(titleActorEditor).join('')}
    </div>`;
    renderTitleExpressionControls();
    return;
  }
  if (activePanel === 'render') {
    if (!act()) { body.innerHTML = '<div class="inspector-content">先新增一幕</div>'; return; }
    const settings = act().render;
    body.innerHTML=`<div class="inspector-content"><h2>本幕渲染 · ${escape(act().name)}</h2><p class="tip">人物与三维场景一起处理。对白可以继承本幕风格，也可以单独选择。</p>${renderStyleEditor(settings,'act')}${button('恢复亮度 / 对比度 / 饱和度','reset-act-color')}</div>`;
    return;
  }
  const currentAct = act();
  const current = step();
  if (!currentAct) { body.innerHTML = '<div class="inspector-content empty">先新增一幕</div>'; return; }
  body.innerHTML = `<div class="inspector-content"><details class="act-settings" ${current?'':'open'}><summary>本幕设置 · ${escape(currentAct.name)}</summary>
    ${field('幕名称', input('act.name', currentAct.name))}
    ${field('章节封面', select('act.coverImageId', byType('image'), currentAct.coverImageId, '默认使用背景图'))}
    ${asset(currentAct.coverImageId || currentAct.backgroundId)?.type === 'image' ? `<img class="act-cover-preview" src="${escape(assetUrl(asset(currentAct.coverImageId || currentAct.backgroundId)))}" alt="本幕封面">` : '<p class="tip">还没有封面。建议上传竖图，人物放在图片中央。</p>'}
    <div class="inline-actions">${button('上传本幕封面', 'upload-act-cover')}${button('本幕渲染与调色', 'edit-act-render')}</div>
    <div data-copy-environment>${field('3D 场景', select('act.environmentId', project.environments || [], currentAct.environmentId, '默认天空'))}<div class="inline-actions">${button('编辑环境（独立窗口）','edit-environment')}${button('新建场景','new-environment')}</div></div>
    ${field('背景音乐', select('act.bgmId', byType('music'), currentAct.bgmId, '无音乐'))}
    ${weatherEditor(currentAct)}
    <div class="inline-actions">${button('删除本幕', 'delete-act', 'class="danger"')}</div>
    </details><hr><h2>第 ${selectedStep + 1} 句对白</h2>
    ${current ? `
      ${field('说话角色', select('step.characterId', project.characters, current.characterId, '旁白 / 场外说话'))}
      ${field('显示名字', input('step.speaker', current.speaker, '留空时用角色名字'))}
    <section class="dialogue-camera-options"><b>本句镜头</b><p class="tip">${current.camera?'已设置独立镜头':'沿用之前对白的镜头；本幕开始时使用初始镜头'}</p><div class="inline-actions">${button('镜头 · WASD 调整','edit-dialogue-camera')}${current.camera?button('清除本句镜头','clear-dialogue-camera'):''}</div></section>
      ${field('对白内容', textarea('step.text', current.text, '在这里写台词'))}
      <hr><h3>这一句在场的人物</h3><p class="tip">最多 30 人，默认每排 3 人、共 10 排。前排左、中、右保持原来的位置，后面各排依次向后。人物的位置仍可单独调整；说话角色可以不在队列中。</p>
      ${renderCastRows(currentAct)}
      ${dialogueVoiceField(current)}
      ${field('本句音效', select('step.seId', byType('effect'), current.seId, '无音效'))}
      <div id="scene-animation-controls"></div>
      ${itemAcquisitionEditor(current)}
      <details class="dialogue-render-editor"><summary>这一句的渲染风格与微调</summary>${renderStyleEditor(dialogueRender(currentAct,current,project.render),'step',current.render)}</details>
      <div class="inline-actions">${button('上移', 'move-up')}${button('下移', 'move-down')}${button('删除', 'delete-step', 'class="danger"')}</div>
      <hr><div class="section-heading">选择分支 ${button('＋ 选项', 'add-choice')}</div>
      ${current.choices.map((choice,index) => `<div class="choice-editor" data-copy-index="${index}">
        <input data-choice-index="${index}" data-choice-field="text" value="${escape(choice.text)}" placeholder="玩家看到的选项">
        <select data-choice-index="${index}" data-choice-field="actId">${options(project.acts,choice.actId,'选择跳转到哪一幕')}</select>
        <details><summary>所需物品条件</summary>${inventoryRows(choice.requirements,'requirement',index)}${button('＋ 物品条件','add-inventory-condition',`data-choice="${index}"`)}<label class="inventory-consume-toggle"><input type="checkbox" data-choice-consume="${index}" ${choice.consumeRequired?'checked':''}>选择后扣除所需物品</label><p class="tip">全部条件满足才能选。勾选后扣除上面列出的数量；不勾选只检查持有数量。</p></details>${button('删除选项', 'delete-choice', `data-index="${index}"`)}</div>`).join('')}
    ` : '<p class="tip">这幕还没有对白。</p>'}
    </div>`;
  renderExpressionControls();
  renderCastExpressionControls();
  refreshMotionHints();
  refreshSceneAnimationButton();
}
function renderCastExpressionControls() {
  if (!stage || !act()) return;
  for (const slot of castSlots) {
    const node = document.querySelector(`#cast-expression-${slot}`);
    if (!node) continue;
    const actorId = step()?.cast?.[slot]?.characterId;
    const record = stage.visibleRecords.get(actorId);
    if (!record) { node.innerHTML = '<p class="tip">正在读取人物表情…</p>'; continue; }
    const weights = castSettingsOf(act(), slot).expressionWeights || {};
    const names = record.vrm.expressionManager?.expressions?.map(item => item.expressionName) || [];
    node.innerHTML = names.length ? names.map(name => {
      const value = Math.round(Math.max(0, Math.min(1, Number(weights[name]) || 0)) * 100);
      return `<label class="expression-slider"><span title="${escape(name)}">${escape(expressionLabels[name] || name)}</span>
        <input type="range" data-cast-expression="${slot}.${escape(name)}" min="0" max="100" step="1" value="${value}">
        <output data-cast-expression-output="${slot}.${escape(name)}">${value}%</output></label>`;
    }).join('') : '<p class="tip">这个模型没有可调表情。</p>';
  }
}
function renderTitleExpressionControls() {
  for(const node of document.querySelectorAll('[data-title-actor-expressions]')){
    const actor=project.title.actors.find(a=>a.id===node.dataset.titleActorExpressions);
    const record=stage?.visibleRecords.get(`title:${actor?.id}`);
    const names=record?.vrm?.expressionManager?.expressions?.map(expression=>expression.expressionName)||[];
    if(!names.length){node.innerHTML='<p class="tip">读取人物后会显示可调的表情。</p>';continue;}
    node.innerHTML=names.map(name=>{const value=Math.round((Number(actor.expressionWeights[name])||0)*100);
      return `<label class="expression-slider"><span>${escape(expressionLabels[name]||name)}</span><input type="range" data-title-actor-id="${actor.id}" data-title-actor-expression="${escape(name)}" min="0" max="100" step="1" value="${value}"><output>${value}%</output></label>`;
    }).join('')+button('表情全部归零','reset-title-expressions',`data-id="${actor.id}"`);
  }
}
function renderExpressionControls() {
  const node = document.querySelector('#expression-controls');
  if (!node) return;
  const current = step();
  const modelAsset = modelForStep(current);
  if (!modelAsset) { node.innerHTML = '<p class="tip">先给这句对白选择一个 VRM 角色。</p>'; return; }
  if (stage?.currentModelId !== modelAsset.id || !stage?.vrm) {
    node.innerHTML = '<p class="tip">正在读取模型的表情参数…</p>';
    return;
  }
  const names = stage.expressions();
  if (!names.length) { node.innerHTML = '<p class="tip">这个模型没有可调的表情参数。</p>'; return; }
  const weights = expressionWeightsOf(current);
  node.innerHTML = names.map(name => {
    const value = Math.round(Math.max(0, Math.min(1, Number(weights[name]) || 0)) * 100);
    return `<label class="expression-slider"><span title="${escape(name)}">${escape(expressionLabels[name] || name)}</span>
      <input type="range" data-expression="${escape(name)}" min="0" max="100" step="1" value="${value}">
      <output data-expression-output="${escape(name)}">${value}%</output></label>`;
  }).join('') + `<div class="inline-actions">${button('表情全部归零', 'reset-expressions')}</div>`;
}
async function updatePreview() {
  if (!stage || !project || playing) return;
  if(dialogueCamera?.editing){if(cameraEditOwner?.actId===act()?.id&&cameraEditOwner?.stepId===step()?.id)return;dialogueCamera.cancelEdit();}
  const request = ++previewRequest;
  if(activePanel!=='story'||stage.environmentRuntime.animations.key!==sceneAnimationKey(act(),step()))cancelSceneAnimations();
  if(activePanel==='items'){events.cancel();stage.clear();showDialogue('','',false);document.querySelector('#title-preview')?.classList.add('hidden');document.querySelector('#speaker-portrait')?.classList.add('hidden');const item=project.items[selectedItem],overlay=document.querySelector('#character-preview');overlay.classList.remove('hidden');overlay.innerHTML=item?`<div class="editor-inventory-preview">${asset(item.imageId)?`<img src="${escape(assetUrl(asset(item.imageId)))}">`:''}<h2>${escape(item.name)}</h2><p>${escape(item.description||'填写约100字介绍')}</p></div>`:'';return;}
  if (activePanel === 'characters') {
    events.cancel();
    await showCharacterEditorPreview();
    return;
  }
  hideCharacterEditorPreview();
  if (activePanel === 'title') {
    showDialogue('', '', false);
    document.querySelector('#dialogue')?.classList.remove('visible');
    document.querySelector('#stage-caption').textContent = '标题界面';
    await showTitleScene(false);
    return;
  }
  document.querySelector('#title-preview')?.classList.add('hidden');
  document.querySelector('.stage-frame')?.classList.remove('title-mode');
  stage.setCameraAngle(0);
  const currentAct = act();
  if (isEvent(currentAct)) { document.querySelector('#stage-caption').textContent = currentAct.name; await events.show(currentAct, true); return; }
  events.cancel();
  const current = step();
  const modelAsset = modelForStep(current);
  const motionAsset = asset(current?.motionId);
  const bgAsset = asset(currentAct?.backgroundId);
  showBackground(null);
  setSceneWeather(currentAct);
  const previewRender=activePanel==='render'?chapterRender(currentAct,project.render):dialogueRender(currentAct,current,project.render);
  stage.setRenderSettings(previewRender);
  applySceneColor(previewRender);
  stage.setBackgroundLighting(null);
  await showEnvironment(currentAct);
  if(request!==previewRequest||playing)return;
  const pose=resolveDialogueCamera(currentAct,selectedStep,project.environments.find(env=>env.id===currentAct.environmentId),snapshotCamera(stage.camera));if(pose)applyDialogueCamera(stage.camera,pose);
  refreshSceneAnimationButton();
  document.querySelector('#stage-caption').textContent = currentAct?.name || '没有幕';
  const placeholder = document.querySelector('#stage-placeholder');
  setStagePlaceholder(placeholder, current ? '此句没有 VRM 角色' : '这一幕还没有人物', Boolean(modelAsset));
  placeholder.style.display = 'grid';
  showDialogue(current?.speaker || character(current?.characterId)?.name || '旁白', current?.text || '', false, current?.characterId);
  if (!current) document.querySelector('#dialogue')?.classList.remove('visible');
  await displayActStep(currentAct, current);
  if (request !== previewRequest || playing) return;
  await updateSpeakerPortrait(current?.characterId,Boolean(current));
  if (request !== previewRequest || playing) return;
  if (stage.visibleRecords.size || (current && !stageError))
    placeholder.style.display = 'none';
  else if (modelAsset && !stageError)
    setStagePlaceholder(placeholder, '', true);
  renderExpressionControls();
  renderCastExpressionControls();
  if(activePanel==='story')playSceneAnimations(currentAct,current);
}
function eventBackdrop(node) {
  const index = project.acts.indexOf(node);
  const previous = project.acts.slice(0, index).findLast(item => !isEvent(item));
  return { chapter: previous, backgroundId: node.event.backgroundId || previous?.backgroundId || project.title.backgroundId || '' };
}
async function prepareEventScene(node) {
  cancelSceneAnimations();
  updateSpeakerPortrait('',false);
  clearTyping(); clearAutoAdvance(); titleRequest++; previewRequest++;
  document.querySelector('.stage-frame')?.classList.remove('title-mode');
  document.querySelector('#player-start')?.classList.add('hidden');
  document.querySelector('#title-preview')?.classList.add('hidden');
  document.querySelector('#character-preview')?.classList.add('hidden');
  document.querySelector('#auto-play-button')?.classList.add('hidden');
  document.querySelector('#act-loading')?.classList.add('hidden');
  if(node.event.type==='cutscene'){document.querySelector('#scene-bg video')?.pause();setSceneWeather();await stage.showCast([], '', false);return;}
  const backdrop = eventBackdrop(node), bg = asset(backdrop.backgroundId);
  const sameBackground = displayedBackgroundId === backdrop.backgroundId;
  setSceneWeather();
  stage.setRenderSettings(chapterRender(backdrop.chapter, project.render));
  applySceneColor(chapterRender(backdrop.chapter, project.render));
  showBackground(null);
  await showEnvironment(backdrop.chapter||project.title);
  const container = document.querySelector('#scene-bg');
  document.querySelector('.stage-frame').style.setProperty('--event-base-filter', container.style.filter || 'brightness(100%)');
  const video = container.querySelector('video');
  if (video) { video.autoplay = false; video.pause(); }
  const imageReady = bg?.type === 'image' ? new Promise(resolve => { const img = new Image(); img.onload = img.onerror = resolve; img.src = assetUrl(bg); }) : Promise.resolve();
  await Promise.all([stage.showCast([], '', false), Promise.race([imageReady, new Promise(resolve => setTimeout(resolve, 6000))])]);
}
function transitionMusic(id) {
  const token = ++musicFadeToken;
  const fade = (from, to, duration, done) => {
    const start = performance.now();
    const frame = now => {
      if (token !== musicFadeToken) return;
      // A frame scheduled inside another frame can carry a timestamp just before start.
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      musicFadeFactor = from + (to - from) * t; applyAudioSettings();
      if (t < 1) requestAnimationFrame(frame); else done?.();
    }; requestAnimationFrame(frame);
  };
  const url = asset(id) ? assetUrl(asset(id)) : '';
  if (music.src === url && url) { music.play().catch(() => {}); fade(musicFadeFactor, 1, 300); return; }
  fade(musicFadeFactor, 0, music.paused ? 1 : 180, () => {
    music.pause(); music.src = url;
    if (url) music.play().then(() => rememberDiscovery('music', id)).catch(() => {});
    fade(0, 1, 500);
  });
}
function playEventSignal() {
  if (!audioSettings.master || !audioSettings.effects) return;
  try {
    clickAudioContext ||= new AudioContext(); const context = clickAudioContext;
    if (context.state === 'suspended') context.resume().catch(() => {});
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(660, context.currentTime);
    gain.gain.setValueAtTime(.012 * audioSettings.master * audioSettings.effects, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .06);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .07);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { /* Sound remains optional when the device has no audio output. */ }
}
async function handleEventAction(action, node) {
  if (action === 'event-confirm') { events.confirm(); return; }
  if (playing) return;
  if(action==='event-add-cutscene'){
    const item=newEvent(uid(),uid());item.name='新过场动画';item.event.type='cutscene';project.acts.splice(selectedAct+1,0,item);selectedAct++;selectedStep=0;activePanel='story';
  }
  else if (action === 'event-add') {
    const item = newEvent(uid(), uid()); project.acts.splice(selectedAct + 1, 0, item); selectedAct++; selectedStep = 0; activePanel = 'story';
  } else if (!isEvent(act())) return;
  else if (action === 'event-preview') { await events.show(act(), true); return; }
  else if (action === 'event-duplicate') { const item = structuredClone(act()); item.id = uid(); item.steps[0].id = uid(); item.name += '（副本）'; project.acts.splice(++selectedAct, 0, item); }
  else if (action === 'event-delete') {
    if (project.acts.length <= 1) { toast('至少保留一个剧情节点', true); return; }
    if (!confirm('删除这个事件？')) return;
    project.acts.splice(selectedAct, 1); selectedAct = Math.max(0, selectedAct - 1); selectedStep = 0;
  } else if (action === 'event-add-row') {
    if (act().event.declarations.length >= 59) return;
    act().event.declarations.push({ countryA: '', countryB: '', flagAId: '', flagBId: '', body: '' });
  } else if (action === 'event-remove-row') act().event.declarations.splice(Number(node.dataset.index), 1);
  else if(action==='event-upload-cutscene'){
    const imported=await bridge('importCutsceneVideo');if(!imported?.length)return;project.assets.push(imported[0]);act().event.videoId=imported[0].id;
  }
  else if (action === 'event-upload') {
    const kind=node.dataset.type,imported = await bridge('importAsset', {type:['music','effect'].includes(kind)?'audio':kind});
    if (!imported?.length) return;
    for (const item of imported) { item.galleryImage = false;if(['music','effect'].includes(kind))item.audioKind=kind;project.assets.push(item); }
    act().event[node.dataset.eventKey] = imported[0].id;
  } else return;
  markDirty(); renderSidebar(); renderInspector(); updatePreview();
}
function applySceneColor(settings) {
  let svg = document.querySelector('#scene-color-defs');
  if (!svg) {
    document.body.insertAdjacentHTML('beforeend', '<svg id="scene-color-defs" width="0" height="0" aria-hidden="true" style="position:absolute;pointer-events:none"><defs><filter id="scene-temperature" color-interpolation-filters="sRGB"><feColorMatrix type="matrix"/></filter></defs></svg>');
    svg = document.querySelector('#scene-color-defs');
  }
  const mood = weatherMood(stage?.weatherSettings);
  const result = colorFilter({ ...settings,
    brightness: (settings.brightness ?? 100) * mood.brightness,
    saturation: (settings.saturation ?? 100) * mood.saturation,
    temperature: (settings.temperature ?? 0) + mood.temperature });
  svg.querySelector('feColorMatrix').setAttribute('values', result.matrix);
  for (const node of document.querySelectorAll('#scene-bg, #stage-canvas, .weather-atmosphere')) node.style.filter = result.filter;
}
function setSceneWeather(chapter) {
  const settings = normalizeWeather(chapter?.weather);
  const sound = asset(settings.soundId);
  stage?.setWeather(settings, { playing, url: sound?.type === 'audio' ? assetUrl(sound) : '',
    master: audioSettings.master, effects: audioSettings.effects });
}
function weatherEditor(chapter) {
  const w = normalizeWeather(chapter.weather);
  const slider = (key,label,min=0,max=100) => field(label, `<input type="range" data-weather="${key}" min="${min}" max="${max}" step="1" value="${Math.round(w[key]*100)}"><output data-weather-output="${key}">${Math.round(w[key]*100)}%</output>`);
  const toggle = (key,label) => `<label class="weather-toggle"><input type="checkbox" data-weather="${key}" ${w[key] ? 'checked' : ''}><span>${label}</span></label>`;
  return `<section class="weather-editor"><h3>本幕天气</h3>
    ${field('天气', `<select data-weather="type">${Object.entries(weatherNames).map(([key,name]) => `<option value="${key}" ${w.type===key?'selected':''}>${name}</option>`).join('')}</select>`)}
    ${w.type !== 'none' ? `${slider('intensity','天气强度')}
    ${slider('wind','风速')}
    ${field('风向', `<select data-weather="direction"><option value="1" ${w.direction===1?'selected':''}>向右吹 →</option><option value="-1" ${w.direction===-1?'selected':''}>向左吹 ←</option></select>`)}
    ${w.type==='rain' ? `${toggle('splashes','显示地面水花与细小涟漪')}${w.splashes ? slider('ground','地面起点（上 → 下）',20) : ''}` : ''}
    ${w.type==='sunny' ? slider('sunX','阳光位置（左 → 右）') : ''}
    ${toggle('windMotion','风吹动模型的头发与衣物（模型需要支持）')}
    ${toggle('atmosphere','柔和光束 / 空气薄雾')}${toggle('autoMood','天气自动配色与人物配光')}
    ${field('天气声音', `<select data-weather="soundId"><option value="">静音</option><option value="auto" ${w.soundId==='auto'?'selected':''}>内置雨声 / 风声</option>${byType('effect').map(a => `<option value="${escape(a.id)}" ${w.soundId===a.id?'selected':''}>${escape(a.name)}</option>`).join('')}</select>`)}
    ${slider('volume','天气音量')}
    <p class="tip">只改变这一幕。雨雪有远近层次；水花请对准背景的地面，室内可以关闭水花。预览不播放天气声，试玩会播放；声音跟随游戏设置中的音效音量。</p>` : '<p class="tip">当前没有天气。选择天气后，可以马上在中间预览。</p>'}
    </section>`;
}
async function uploadActCover() {
  const target = act();
  const imported = await bridge('importAsset', { type: 'image', single: true });
  if (!target || !imported?.length) return;
  imported.forEach(item => { item.galleryImage = false; });
  project.assets.push(...imported); target.coverImageId = imported[0].id;
  markDirty(); renderSidebar(); renderInspector();
}
function showBackground(bgAsset) {
  displayedBackgroundId = bgAsset?.id || '';
  const node = document.querySelector('#scene-bg');
  node.replaceChildren();
  node.style.backgroundImage = '';
  if(!stage?.environmentRuntime.root) stage?.setPaintBackground(bgAsset);
  if (!bgAsset) return;
  if (bgAsset.type === 'image') rememberDiscovery('image', bgAsset.id);
  if (bgAsset.type === 'video') {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = assetUrl(bgAsset);
    video.autoplay = true; video.muted = true; video.loop = true; video.playsInline = true;
    node.appendChild(video);
    stage?.setPaintBackground(bgAsset, video);
  } else {
    node.style.backgroundImage = `url("${assetUrl(bgAsset)}")`;
    return;
  }
  node.style.backgroundImage = '';
}
async function ensureCharacterPortrait(item, force = false, userCapture = false) {
  const modelAsset = asset(item?.modelId);
  if (!canGeneratePortrait(item,modelAsset?.type,Boolean(asset(item?.portraitId)),force,userCapture)) return;
  const motionId = item.galleryMotionId || '';
  const motionAsset = asset(motionId);
  const poseFrame = Math.max(1, Math.floor(Number(item.galleryPoseFrame) || 1));
  const legacySeconds = Number.isFinite(Number(item.galleryPoseTime)) ? Number(item.galleryPoseTime) : null;
  const jobKey = `${project.id}:${item.id}:${item.modelId}:${motionId}:${poseFrame}`;
  if (portraitJobs.has(jobKey)) return portraitJobs.get(jobKey);
  const modelId = item.modelId;
  const portraitAtStart=item.portraitId,sourceAtStart=item.portraitSource;
  const task = (async () => {
    const { dataUrl, frame } = await captureCharacterPortrait(modelAsset, motionAsset, poseFrame, legacySeconds);
    if (project.characters.find(entry => entry.id === item.id) !== item || item.modelId !== modelId ||
      item.galleryMotionId !== motionId ||
      !(Number(item.galleryPoseFrame) === poseFrame || (legacySeconds !== null && Number(item.galleryPoseFrame) === frame)) ||
      item.portraitId!==portraitAtStart||item.portraitSource!==sourceAtStart||(!force && asset(item.portraitId))) return;
    item.galleryPoseFrame = frame;
    delete item.galleryPoseTime;
    if (mode === 'player') temporaryPortraits.set(item.id, dataUrl);
    else {
      const saved = await bridge('saveGeneratedPortrait', { dataUrl, characterId: item.id, name: item.name, previousRevision: asset(item.portraitId)?.revision || '' });
      if (project.characters.find(entry => entry.id === item.id) !== item || item.modelId !== modelId ||
        item.galleryMotionId !== motionId || Number(item.galleryPoseFrame) !== frame ||item.portraitId!==portraitAtStart||item.portraitSource!==sourceAtStart|| (!force && asset(item.portraitId))) return;
      await replaceAutoPortrait(item, saved, true);
      item.portraitSource = 'auto';
      item.portraitPoseKey = `portrait-v3:${item.modelId}:${motionId}:${frame}`;
      if (!userCapture) editorHistory.amend(value => {
        const target = value.characters.find(character => character.id === item.id);
        if (!target || target.portraitSource === 'manual' || target.modelId !== item.modelId ||
            (target.galleryMotionId || '') !== motionId || Number(target.galleryPoseFrame) !== frame || target.portraitPoseKey === item.portraitPoseKey) return false;
        Object.assign(target, { portraitId: saved.id, portraitSource: 'auto', portraitPoseKey: item.portraitPoseKey });
        const existing = value.assets.find(asset => asset.id === saved.id);
        if (existing) Object.assign(existing, saved); else value.assets.push(structuredClone(saved));
        if (!value.assetFolders.some(folder => folder.id === autoPortraitFolderId))
          value.assetFolders.push({ id: autoPortraitFolderId, name: '自动角色头像', type: 'image' });
        return true;
      });
      markDirty(userCapture ? { label: '重新拍摄头像' } : { derived: true });
      if (activePanel === 'characters' && project.characters[selectedCharacter] === item) {
        const inspector = document.querySelector('.inspector');
        const scroll = inspector?.scrollTop || 0;
        renderInspector();
        if (inspector) inspector.scrollTop = scroll;
        refreshGalleryFrameControl(item);
      }
    }
    if (step()?.characterId === item.id || (playing && project.acts[playAct]?.steps[playStep]?.characterId === item.id))
      updateSpeakerPortrait(item.id, true);
  })().catch(error => toast(`头像生成失败：${error.message}`, true)).finally(() => portraitJobs.delete(jobKey));
  portraitJobs.set(jobKey, task);
  return task;
}
function portraitIsAutomatic(item) {
  return !isLiveModel(item?.modelId) && (!asset(item?.portraitId) || item.portraitSource === 'auto');
}
const autoPortraitFolderId = 'auto-character-portraits';
function assetIsReferenced(id) {
  const scan = value => typeof value === 'string' ? value === id : value && typeof value === 'object' ? Object.values(value).some(scan) : false;
  return scan({ ...project, assets: undefined, assetFolders: undefined });
}
async function removeUnusedAutoPortraits(deferHistory = false) {
  for (const old of [...project.assets]) {
    if (old.type !== 'image' || !(old.generatedPortrait || old.name === '自动头像.png') || assetIsReferenced(old.id)) continue;
    // Another asset can still use the same physical file.
    if (!project.assets.some(other => other.id !== old.id && other.path === old.path))
      pendingPortraitDeletes.add(old.path);
    project.assets = project.assets.filter(other => other !== old);
    markDirty(deferHistory ? { skipHistory: true } : { derived: true });
  }
}
async function replaceAutoPortrait(item, saved, deferHistory = false) {
  if (!project.assetFolders.some(folder => folder.id === autoPortraitFolderId))
    project.assetFolders.push({ id: autoPortraitFolderId, name: '自动角色头像', type: 'image' });
  saved.galleryImage = false; saved.folderId = autoPortraitFolderId;
  saved.internalPortrait = true;
  const existing = asset(saved.id);
  if (existing) Object.assign(existing, saved);
  else project.assets.push(saved);
  item.portraitId = saved.id;
  item.portraitSource = 'auto';
  markDirty(deferHistory ? { skipHistory: true } : { derived: true });
  await removeUnusedAutoPortraits(deferHistory);
  renderAssetDock();
}
async function queueMissingPortraits() {
  const currentProject = project;
  try {
    for (const item of project.characters) {
      const old = asset(item.portraitId);
      if (item.portraitSource !== 'auto' || !old || old.generatedPortrait) continue;
      const saved = await bridge('organizeGeneratedPortrait', { path: old.path, characterId: item.id, name: item.name });
      if (project !== currentProject) return;
      await replaceAutoPortrait(item, saved);
      if (activePanel === 'characters') renderInspector();
      updateSpeakerPortrait(step()?.characterId, true);
    }
    await removeUnusedAutoPortraits();
    renderAssetDock();
  } catch (error) { toast(`自动头像整理失败：${error.message}`, true); }
  const items = project.characters.filter(item => item.modelId && portraitIsAutomatic(item) &&
    (!asset(item.portraitId) || item.portraitPoseKey !==
      `portrait-v3:${item.modelId}:${item.galleryMotionId || ''}:${Math.max(1, Math.floor(Number(item.galleryPoseFrame) || 1))}`));
  (async () => { for (const item of items) await ensureCharacterPortrait(item, Boolean(asset(item.portraitId))); })();
}
let portraitRequest=0;
async function updateSpeakerPortrait(characterId, visible) {
  const token=++portraitRequest,node=document.querySelector('#speaker-portrait'),image=node?.querySelector('img');
  if(!node||!image)return;
  const item=characterId?character(characterId):null,model=asset(item?.modelId);
  if(visible&&isLiveModel(item?.modelId)){
    image.removeAttribute('src');node.classList.add('live-portrait');node.classList.remove('hidden');
    try{
      const current=playing?project.acts[playAct]?.steps[playStep]:step();
      const weights=Object.values(current?.cast||{}).find(c=>c.characterId===characterId)?.expressionWeights||{};
      const record=await stage.setLivePortrait(model,characterId,node,weights);
      if(token!==portraitRequest)return;
      if(record)return;
    }catch(error){console.warn('实时头像暂时不可用',error.message);}
    if(token!==portraitRequest)return;
    stage?.clearLivePortrait();node.classList.add('hidden');return;
  }
  if(token!==portraitRequest)return;
  stage?.clearLivePortrait();node.classList.remove('live-portrait');
  const portraitAsset=asset(item?.portraitId),url=portraitAsset?assetUrl(portraitAsset):temporaryPortraits.get(item?.id)||'';
  image.src=visible&&url?url:'';node.classList.toggle('hidden',!visible||!url);
}
function showDialogue(speaker, text, visible = true, characterId = '') {
  const node = document.querySelector('#dialogue');
  if (!node) return;
  node.classList.toggle('visible', visible || mode === 'editor');
  node.classList.toggle('custom-dialogue', Boolean(project.ui.dialogueImageId));
  document.querySelector('#dialogue-speaker').textContent = speaker;
  if (mode === 'player' && playing && visible) startTyping(text, characterId);
  else { clearTyping(); document.querySelector('#dialogue-text').textContent = text; }
  updateSpeakerPortrait(characterId, visible || mode === 'editor');
  node.style.backgroundImage = project.ui.dialogueImageId ? `url("${assetUrl(asset(project.ui.dialogueImageId))}")` : '';
  if (visible && project.ui.dialogueImageId) rememberDiscovery('image', project.ui.dialogueImageId);
}
function clearTyping() {
  stage?.stopTalking();
  clearInterval(typingTimer);
  typingTimer = null;
  typingCharacters = [];
  typingIndex = 0;
}
function finishTyping() {
  if (!typingTimer) return false;
  const full = typingCharacters.join('');
  clearTyping();
  const node = document.querySelector('#dialogue-text');
  if (node) node.textContent = full;
  if (playing) scheduleAutoAdvance(project.acts[playAct]?.steps[playStep]);
  return true;
}
function startTyping(value, characterId = project.acts[playAct]?.steps[playStep]?.characterId) {
  clearTyping();
  const node = document.querySelector('#dialogue-text');
  if (!node) return;
  typingCharacters = Array.from(String(value || ''));
  node.textContent = '';
  if (!typingCharacters.length) return;
  const role = character(characterId);
  stage?.startTalking(characterId, Boolean(role) && role.autoMouth !== false);
  typingTimer = setInterval(() => {
    if (!node.isConnected) { clearTyping(); return; }
    const end = Math.min(typingCharacters.length, typingIndex + 1);
    node.textContent += typingCharacters.slice(typingIndex, end).join('');
    stage?.talkingLetter(typingCharacters[end - 1]);
    typingIndex = end;
    if (typingIndex >= typingCharacters.length) {
      clearTyping();
      if (playing) scheduleAutoAdvance(project.acts[playAct]?.steps[playStep]);
    }
  }, 1000 / textSpeed);
}
function playEffect(id,preparedSound) {
  const item = asset(id);
  if (!item || item.type!=='audio') return false;
  const sound = preparedSound || takePreparedAudio(id) || new Audio(assetUrl(item));
  sound.muted=false;
  sound.volume = audioSettings.master * audioSettings.effects;
  activeEffects.add(sound);
  const remove = () => activeEffects.delete(sound);
  sound.addEventListener('ended', remove, { once: true });
  sound.addEventListener('error', remove, { once: true });
  sound.play().catch(error=>{if(new URLSearchParams(location.search).has('smoke'))window.__lastEffectError={id,message:error.message,name:error.name,code:sound.error?.code,src:sound.src};remove();});
  return sound;
}
function playButtonClick() {
  if (playEffect(project?.ui?.clickSoundId)) return;
  try {
    clickAudioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const tone = clickAudioContext.createOscillator();
    const gain = clickAudioContext.createGain();
    const now = clickAudioContext.currentTime;
    tone.type = 'sine';
    tone.frequency.setValueAtTime(680, now);
    tone.frequency.exponentialRampToValueAtTime(430, now + 0.06);
    gain.gain.setValueAtTime(Math.max(0.0001, audioSettings.master * audioSettings.effects * 0.07), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    tone.connect(gain).connect(clickAudioContext.destination);
    tone.start(now); tone.stop(now + 0.08);
  } catch { /* Audio may be unavailable before the first user gesture. */ }
}
function setMusic(id) {
  musicFadeToken++; musicFadeFactor = 1; applyAudioSettings();
  const next = asset(id);
  const url = next ? assetUrl(next) : '';
  if (music.src === url) {
    if (url && music.paused) music.play().then(() => rememberDiscovery('music', id)).catch(() => {});
    return;
  }
  music.pause();
  music=takePreparedAudio(id)||music;music.loop=true;music.muted=false;music.volume=audioSettings.master*audioSettings.music;
  if(music.src!==url)music.src = url;
  if (url) music.play().then(() => rememberDiscovery('music', id)).catch(() => {});
}
const audioKey = () => `vrm-audio-${project.id || project.name}`;
function applyAudioSettings() {
  music.volume = audioSettings.master * audioSettings.music * musicFadeFactor;
  voice.volume = audioSettings.master * audioSettings.voice;
  galleryMusic.volume = audioSettings.master * audioSettings.music;
  for (const sound of activeEffects) sound.volume = audioSettings.master * audioSettings.effects;
  stage?.weather?.setVolume(audioSettings.master, audioSettings.effects);
}
function loadAudioSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(audioKey()) || 'null');
    if (saved) for (const key of ['master', 'music', 'voice', 'effects'])
      if (Number.isFinite(Number(saved[key]))) audioSettings[key] = Math.max(0, Math.min(1, Number(saved[key])));
  } catch { /* Use the default volumes if old settings are invalid. */ }
  const savedSpeed = Number(localStorage.getItem(`vrm-text-speed-${project.id || project.name}`));
  textSpeed = Number.isFinite(savedSpeed) && savedSpeed >= 5 && savedSpeed <= 100 ? savedSpeed : 35;
  cameraSpeed=Math.max(.85,Math.min(1.15,Number(localStorage.getItem('vrm-camera-speed-'+project.id))||1));
  const initialGraphics=window.__vrmAndroid?{aa:'fxaa',renderScale:75,shadows:'medium'}:{};
  try{graphicsPreferences=normalizeGraphics(JSON.parse(localStorage.getItem('vrm-player-graphics-'+project.id)||JSON.stringify(initialGraphics)));}catch{graphicsPreferences=normalizeGraphics(initialGraphics);}
  applyAudioSettings();
}
function clearAutoAdvance() {
  clearTimeout(autoTimer);
  autoTimer = null;
  voice.onended = null;
  voice.onerror = null;
}
function scheduleAutoAdvance(current) {
  clearAutoAdvance();
  if(maybeGrantCurrentItems())return;
  if (events.active() || isEvent(project.acts[playAct]) || !autoPlay || !playing || !current || current.choices?.length || saveModalMode || typingTimer) return;
  const wait = Math.max(1800, Math.min(7000, 1100 + (current.text?.length || 0) * 95));
  const advance = () => { autoTimer = setTimeout(() => next(), wait); };
  if (current.voiceId && !voice.paused && !voice.ended) {
    voice.onended = advance;
    voice.onerror = advance;
  } else advance();
}
function updateAutoButton() {
  const button = document.querySelector('#auto-play-button');
  if (!button) return;
  button.textContent = autoPlay ? '自动播放中' : '自动播放';
  button.title = autoPlay ? '关闭自动播放' : '开启自动播放';
  button.classList.toggle('active', autoPlay);
  button.setAttribute('aria-pressed', String(autoPlay));
}
async function showPlayStep() {
  dialogueCamera?.cancelTravel();
  const previousCamera=stage?snapshotCamera(stage.camera):null;
  const sameCameraAct=cameraActId===project.acts[playAct]?.id&&preparedAct===playAct;skipCameraTravel=false;
  hideCharacterEditorPreview();
  sceneAnimationDialog.close(false);
  cancelSceneAnimations();
  const request = ++playRequest;
  clearAutoAdvance();
  clearTyping();
  const currentAct = project.acts[playAct];
  const current = currentAct?.steps[playStep];
  if (!current) { stopPlay(); toast('故事播放完毕'); return; }
  if (isEvent(currentAct)) {
    preparedAct=-1;transitioning=true;const loading=document.querySelector('#act-loading');loading?.classList.remove('hidden');
    try{await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,30)));await prepareCurrentActMedia(currentAct,()=>request===playRequest&&playing);if(request!==playRequest||!playing)return;const remaining=restoredEventRemaining;restoredEventRemaining=undefined;await events.show(currentAct,false,remaining);}
    finally{if(request===playRequest){transitioning=false;loading?.classList.add('hidden');}}return;
  }
  const leavingEvent = events.active() || eventMusicActive;
  events.cancel();
  transitioning = true;
  let displayed = false;
  const loading = document.querySelector('#act-loading');
  try {
    if (preparedAct !== playAct) {
      loading?.classList.remove('hidden');
      await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,30)));
      const entries=preparationEntries(currentAct,currentAct.steps);
      await stage.prepareAct(entries);
      if(request!==playRequest||!playing)return;
      await prepareCurrentActMedia(currentAct,()=>request===playRequest&&playing);
      if (request !== playRequest || !playing) return;
      preparedAct = playAct;
    }
    const modelAsset = modelForStep(current);
    const caption = document.querySelector('#stage-caption');
    if (caption) caption.textContent = currentAct.name;
    const placeholder = document.querySelector('#stage-placeholder');
    // Act loading has its own overlay. A camera move or empty cast needs no placeholder.
    setStagePlaceholder(placeholder, '');
    placeholder.style.display = 'none';
    stageError = '';
    document.querySelector('.stage-frame')?.classList.remove('title-mode');
    document.querySelector('#title-preview')?.classList.add('hidden');
    stage.setCameraAngle(0);
    setSceneWeather(currentAct);
    stage.setRenderSettings(dialogueRender(currentAct,current,project.render));
    applySceneColor(dialogueRender(currentAct,current,project.render));
    stage.setBackgroundLighting(null);
    await showEnvironment(currentAct);
    if(!stage.residentActId||stage.residentActId!==currentAct.id){await stage.warmPreparedGraphics({stage,environment:stage.environmentRuntime,camera:stage.camera},async()=>{await new Promise(r=>setTimeout(r,0));});stage.residentActId=currentAct.id;}
    if(request!==playRequest||!playing)return;
    await displayActStep(currentAct, current);
    if (request !== playRequest || !playing) return;
    const targetCamera=resolveDialogueCamera(currentAct,playStep,project.environments.find(env=>env.id===currentAct.environmentId),snapshotCamera(stage.camera));
    if(sameCameraAct&&previousCamera)applyDialogueCamera(stage.camera,previousCamera);
    document.querySelector('#dialogue')?.classList.remove('visible');document.querySelector('#choice-list').innerHTML='';
    await dialogueCamera?.to(targetCamera,{animate:sameCameraAct&&!skipCameraTravel,speed:cameraSpeed});
    if(request!==playRequest||!playing)return;cameraActId=currentAct.id;cameraStepId=current.id;
    if (mode === 'player') for (const id of stage.visibleRecords.keys())
      if (character(id)) rememberDiscovery('character', id);
    if (mode === 'player' && character(current.characterId)) rememberDiscovery('character', current.characterId);
    showBackground(null);
    await updateSpeakerPortrait(current.characterId,true);
    if (request !== playRequest || !playing) return;
    await playSceneAnimations(currentAct,current,{sound:true,force:true});
    if(request!==playRequest||!playing)return;
    showDialogue(current.speaker || character(current.characterId)?.name || '旁白', current.text, true, current.characterId);
    recordViewedDialogue(current);
    if (leavingEvent) transitionMusic(currentAct.bgmId); else setMusic(currentAct.bgmId);
    eventMusicActive = false;
    if (current.seId) playEffect(current.seId);
    voice.pause();
    const voiceAsset = asset(current.voiceId);
    if (voiceAsset) {
      const onended=voice.onended;voice=takePreparedAudio(current.voiceId)||voice;voice.onended=onended;voice.muted=false;voice.volume=audioSettings.master*audioSettings.voice;
      if(voice.src!==assetUrl(voiceAsset))voice.src = assetUrl(voiceAsset);
      voice.play().catch(() => {
        if (request === playRequest && autoPlay) scheduleAutoAdvance(current);
      });
    }
    const choiceList = document.querySelector('#choice-list');
    refreshChoiceItems();
    if (stage.visibleRecords.size || !stageError)
      placeholder.style.display = 'none';
    else if (modelAsset && stageError) {
      placeholder.textContent = stageError;
      placeholder.style.display = 'grid';
    }
    document.querySelector('#player-start')?.classList.add('hidden');
    document.querySelector('#play-controls')?.classList.remove('hidden');
    document.querySelector('#auto-play-button')?.classList.remove('hidden');
    updateAutoButton();
    displayed = true;
  } catch (error) {
    if (request === playRequest) toast(error.message, true);
  } finally {
    if (request === playRequest) {
      transitioning = false;
      loading?.classList.add('hidden');
      if (displayed) { if(playerInventory.pending.length){clearTyping();document.querySelector('#dialogue-text').textContent=current.text||'';showItemReward();}else scheduleAutoAdvance(current); updateRuntimePreparation(); }
    }
  }
}
function startPlay() {
  cameraActId="";cameraStepId="";
  playerInventory=normalizeInventory({},project.items);inventorySession=true;
  releasePreparedMedia();
  restoredEventRemaining = undefined;
  const firstAct = mode === 'player' || activePanel === 'title' ? 0 : selectedAct;
  if (!project.acts[firstAct]?.steps.length) { toast('先写一句对白再试玩', true); return; }
  playing = true; playAct = firstAct; playStep = 0; preparedAct = -1;
  titleRequest++;
  playViewedStepIds = new Set();
  playCharacterLineCounts = {};
  restartPlayerAutoSave();
  document.querySelector('.editor')?.classList.add('is-playing');
  showPlayStep();
}
function stopPlay() {
  dialogueCamera?.cancelTravel();cameraActId="";cameraStepId="";
  document.querySelector('#inventory-reward')?.remove();
  releasePreparedMedia();
  sceneAnimationDialog.close(false);
  cancelSceneAnimations();
  events.cancel(); restoredEventRemaining = undefined; musicFadeToken++;
  playing = false;
  clearInterval(playerAutoSaveTimer);
  playerAutoSaveTimer = null;
  autoPlay = false;
  clearAutoAdvance();
  clearTyping();
  playRequest++;
  transitioning = false;
  preparedAct = -1;
  closePlayerModal();
  music.pause(); voice.pause();
  stage?.clear();
  document.querySelector('.editor')?.classList.remove('is-playing');
  document.querySelector('#play-controls')?.classList.add('hidden');
  document.querySelector('#auto-play-button')?.classList.add('hidden');
  document.querySelector('#choice-list').innerHTML = '';
  document.querySelector('#act-loading')?.classList.add('hidden');
  if (mode === 'player') {
    showDialogue('', '', false);
    showTitleScene(true);
  }
  else updatePreview();
}
function next() {
  if(!playing||saveModalMode)return;
  if(transitioning){skipCameraTravel=true;dialogueCamera?.finish();return;}
  if (isEvent(project.acts[playAct])) { events.confirm(); return; }
  if (finishTyping()) return;
  clearAutoAdvance();
  if(maybeGrantCurrentItems())return;
  const currentAct = project.acts[playAct];
  if (currentAct.steps[playStep]?.choices.length) return;
  playStep++;
  if (playStep >= currentAct.steps.length) { playAct++; playStep = 0; }
  showPlayStep();
}
const saveKey = () => `vrm-save-slots-${project.id || project.name}`;
const legacySlotKey = () => `${saveKey()}-legacy-slot-1`;
function readLegacyFirstSlot() {
  try { return JSON.parse(localStorage.getItem(legacySlotKey()) || 'null'); }
  catch { return null; }
}
const lifetimeKey = () => `vrm-lifetime-progress-${project.id || project.name}`;
function loadLifetimeProgress() {
  if (lifetimeProgress) return lifetimeProgress;
  const fresh = { version: 2, viewedDialogueIds: [], viewedDialogueText: {}, characterLineCounts: {},
    seenCharacterIds: [], seenImageIds: [], heardMusicIds: [], seenItemIds: [], enteredActIds: [], completedEventIds: [], lastActId: '' };
  try {
    const stored = JSON.parse(localStorage.getItem(lifetimeKey()) || 'null');
    if (stored && typeof stored === 'object') {
      for (const key of ['viewedDialogueIds', 'seenCharacterIds', 'seenImageIds', 'heardMusicIds', 'seenItemIds', 'enteredActIds', 'completedEventIds'])
        if (Array.isArray(stored[key])) fresh[key] = [...new Set(stored[key].filter(id => typeof id === 'string'))];
      if (stored.characterLineCounts && typeof stored.characterLineCounts === 'object')
        for (const [id, count] of Object.entries(stored.characterLineCounts))
          fresh.characterLineCounts[id] = Math.max(0, Number(count) || 0);
      if (stored.viewedDialogueText && typeof stored.viewedDialogueText === 'object')
        for (const [id, value] of Object.entries(stored.viewedDialogueText))
          if (typeof value === 'string') fresh.viewedDialogueText[id] = value;
      if (typeof stored.lastActId === 'string') fresh.lastActId = stored.lastActId;
    } else {
      // 旧版没有独立的鉴赏记录：尽量从已有存档补回已读对白和场景。
      for (const slot of [...readSaveSlots().filter(Boolean), readLegacyFirstSlot()].filter(Boolean)) {
        const old = slotDialogueProgress(slot);
        for (const id of old.seen) if (!fresh.viewedDialogueIds.includes(id)) fresh.viewedDialogueIds.push(id);
        for (const [id, count] of Object.entries(old.counts))
          fresh.characterLineCounts[id] = Math.max(fresh.characterLineCounts[id] || 0, Number(count) || 0);
        if (slot.backgroundId && !fresh.seenImageIds.includes(slot.backgroundId)) fresh.seenImageIds.push(slot.backgroundId);
      }
      const seen = new Set(fresh.viewedDialogueIds);
      for (const act of project.acts) for (const line of act.steps)
        if (seen.has(line.id) && line.characterId && !fresh.seenCharacterIds.includes(line.characterId))
          fresh.seenCharacterIds.push(line.characterId);
    }
    // v0.7.2 只记对白编号；首次升级时按当前工程补记文本，后续修改文本则需要重新阅读。
    const seen = new Set(fresh.viewedDialogueIds);
    for (const act of project.acts) for (const line of act.steps)
      if (line.id && seen.has(line.id) && fresh.viewedDialogueText[line.id] === undefined) {
        fresh.viewedDialogueText[line.id] = String(line.text || '');
        fresh.lastActId = act.id;
      }
  } catch { /* 损坏的记录从空白重建，不影响普通存档。 */ }
  lifetimeProgress = fresh;
  localStorage.setItem(lifetimeKey(), JSON.stringify(fresh));
  return fresh;
}
function rememberDiscovery(type, id) {
  if (mode !== 'player' || !id) return;
  const progress = loadLifetimeProgress();
  const key = { character: 'seenCharacterIds', image: 'seenImageIds', music: 'heardMusicIds' }[type];
  if (!key || progress[key].includes(id)) return;
  progress[key].push(id);
  localStorage.setItem(lifetimeKey(), JSON.stringify(progress));
}
const hasDiscovered = (type, id) => mode !== 'player' || Boolean(id && loadLifetimeProgress()[
  { character: 'seenCharacterIds', image: 'seenImageIds', music: 'heardMusicIds' }[type]]?.includes(id));
const maskSecret = value => Array.from(String(value || '')).map(char => /\s/u.test(char) ? char : 'X').join('');
const hiddenName = value => { const chars = Array.from(String(value || '')); return chars.length ? `${chars[0]}${'X'.repeat(chars.length - 1)}` : 'X'; };
function storyRank(actIndex, stepIndex) {
  if (actIndex < 0 || stepIndex < 0) return -1;
  return project.acts.slice(0, actIndex).reduce((total, item) => total + item.steps.length, 0) + stepIndex + 1;
}
function slotLocation(slot) {
  const actIndex = slot.actId ? project.acts.findIndex(item => item.id === slot.actId) : Number(slot.act);
  const stepIndex = slot.stepId ? project.acts[actIndex]?.steps.findIndex(item => item.id === slot.stepId) : Number(slot.step);
  return { actIndex, stepIndex };
}
function legacyDialogueProgress(slot) {
  const { actIndex, stepIndex } = slotLocation(slot);
  const seen = [];
  const counts = {};
  if (!Number.isInteger(actIndex) || !Number.isInteger(stepIndex) || actIndex < 0 || stepIndex < 0) return { seen, counts };
  for (let a = 0; a <= actIndex; a++) {
    if (isEvent(project.acts[a])) continue;
    for (const entry of project.acts[a]?.steps.slice(0, a === actIndex ? stepIndex + 1 : undefined) || []) {
      if (entry.id) seen.push(entry.id);
      if (entry.characterId) counts[entry.characterId] = (counts[entry.characterId] || 0) + 1;
    }
  }
  return { seen, counts };
}
function slotDialogueProgress(slot) {
  if (Array.isArray(slot.viewedDialogueIds) && slot.characterLineCounts && typeof slot.characterLineCounts === 'object') {
    return { seen: slot.viewedDialogueIds, counts: slot.characterLineCounts };
  }
  return legacyDialogueProgress(slot);
}
function recordViewedDialogue(entry) {
  const id = entry.id || `${playAct}:${playStep}`;
  if (!playViewedStepIds.has(id)) {
    playViewedStepIds.add(id);
    if (entry.characterId) playCharacterLineCounts[entry.characterId] = (playCharacterLineCounts[entry.characterId] || 0) + 1;
  }
  if (mode !== 'player') return;
  const progress = loadLifetimeProgress();
  let changed = false;
  const actId = project.acts[playAct]?.id;
  if (actId && !progress.enteredActIds.includes(actId)) { progress.enteredActIds.push(actId); changed = true; }
  if (!progress.viewedDialogueIds.includes(id)) {
    progress.viewedDialogueIds.push(id);
    if (entry.characterId) progress.characterLineCounts[entry.characterId] =
      (progress.characterLineCounts[entry.characterId] || 0) + 1;
    changed = true;
  }
  if (progress.viewedDialogueText[id] !== String(entry.text || '')) {
    progress.viewedDialogueText[id] = String(entry.text || '');
    changed = true;
  }
  const currentActId = project.acts[playAct]?.id || '';
  if (currentActId && progress.lastActId !== currentActId) { progress.lastActId = currentActId; changed = true; }
  if (changed) localStorage.setItem(lifetimeKey(), JSON.stringify(progress));
  rememberDiscovery('character', entry.characterId);
}
function deepestSave() {
  return readSaveSlots().filter(Boolean).sort((a, b) => {
    const first = slotLocation(a), second = slotLocation(b);
    const rankA = storyRank(first.actIndex, first.stepIndex);
    const rankB = storyRank(second.actIndex, second.stepIndex);
    return rankB - rankA || (Date.parse(b.savedAt || '') || 0) - (Date.parse(a.savedAt || '') || 0);
  })[0] || null;
}
function readSaveSlots() {
  const slots = Array(20).fill(null);
  try {
    const stored = JSON.parse(localStorage.getItem(saveKey()) || 'null');
    if (Array.isArray(stored)) {
      stored.slice(0, 20).forEach((item, index) => { slots[index] = item || null; });
      if (slots[0] && !slots[0].auto) {
        const free = slots.findIndex((item, index) => index > 0 && !item);
        if (free > 0) slots[free] = slots[0];
        else localStorage.setItem(legacySlotKey(), JSON.stringify(slots[0]));
        slots[0] = null;
        localStorage.setItem(saveKey(), JSON.stringify(slots));
      }
      return slots;
    }
    // Preserve progress created by the earlier one-slot version.
    const old = JSON.parse(localStorage.getItem(`vrm-save-${project.id || project.name}`) || 'null');
    if (old && Number.isInteger(old.act) && Number.isInteger(old.step)) {
      const oldAct = project.acts[old.act];
      const oldStep = oldAct?.steps[old.step];
      if (oldStep) slots[1] = {
        act: old.act, step: old.step, actId: oldAct.id, stepId: oldStep.id,
        actName: oldAct.name, text: oldStep.text, speaker: oldStep.speaker || character(oldStep.characterId)?.name || '旁白',
        backgroundId: oldAct.backgroundId, savedAt: null
      };
      localStorage.setItem(saveKey(), JSON.stringify(slots));
    }
  } catch { /* Ignore broken old save data; the slots remain usable. */ }
  return slots;
}
function closePlayerModal() {
  const wasRoleDetails=saveModalMode==='role-details';
  roleDetails.close(false);
  if (saveModalMode === 'gallery'||galleryStage||galleryCache) {
    stopGalleryMusic();
    galleryCache?.dispose();galleryCache=null;galleryStage?.destroy();
    galleryStage = null;
  }
  saveModalMode = '';if(stage)stage.renderSuspended=false;
  const modal = document.querySelector('#player-modal');
  if (modal) {
    modal.classList.add('closing');
    modal.setAttribute('aria-hidden', 'true');
    modal.inert = true;
    setTimeout(() => modal.remove(), 180);
  }
  if (playing) scheduleAutoAdvance(project.acts[playAct]?.steps[playStep]);
  if(wasRoleDetails)document.querySelector('.title-bottom-menu [data-action="role-details"]')?.focus({preventScroll:true});
}
function openRoleDetails(){
  closePlayerModal();document.querySelector('#player-modal')?.remove();clearAutoAdvance();saveModalMode='role-details';if(stage)stage.renderSuspended=true;return roleDetails.open();
}
function restartPlayerAutoSave() {
  clearInterval(playerAutoSaveTimer);
  if (mode !== 'player') return;
  playerAutoSaveTimer = setInterval(() => {
    if (playing && !transitioning && project.acts[playAct]?.steps[playStep]) saveAutoSlot().catch(error=>toast('自动存档失败：'+error.message,true));
  }, 5 * 60_000);
}
function snapshotSlot(auto = false) {
  const currentAct = project.acts[playAct];
  const currentStep = currentAct?.steps[playStep];
  if (!currentStep) return null;
  return {
    auto, act: playAct, step: playStep, actId: currentAct.id, stepId: currentStep.id,
    actName: currentAct.name, text: isEvent(currentAct) ? currentAct.event.title : currentStep.text,
    eventRemaining: isEvent(currentAct) ? events.remaining() : undefined,
    speaker: currentStep.speaker || character(currentStep.characterId)?.name || '旁白',
    backgroundId: isEvent(currentAct) ? eventBackdrop(currentAct).backgroundId : currentAct.backgroundId, savedAt: new Date().toISOString(),
    progressRank: storyRank(playAct, playStep),
    characterLineCounts: { ...playCharacterLineCounts },
    viewedDialogueIds: [...playViewedStepIds], inventory:structuredClone(playerInventory)
  };
}
async function storeGameSnapshot(index,snapshot) {
  if(!snapshot||saveScreenshotBusy)return false;
  saveScreenshotBusy=true;
  const key=saveKey();
  try{
    try{snapshot.thumbnail=await captureSaveThumbnail(document.querySelector('.player .stage-frame'),payload=>bridge('captureGameThumbnail',payload));}
    catch(error){console.warn('存档截图暂时不可用',error.message);}
    const current=project.acts[playAct]?.steps[playStep];
    if(!playing||key!==saveKey()||current?.id!==snapshot.stepId)return false;
    const slots=readSaveSlots();slots[index]=snapshot;
    try{localStorage.setItem(key,JSON.stringify(slots));}
    catch(error){if(!snapshot.thumbnail)throw error;delete snapshot.thumbnail;localStorage.setItem(key,JSON.stringify(slots));if(!snapshot.auto)toast('进度已保存，但存储空间不足，截图未保存。',true);}
    return true;
  }finally{saveScreenshotBusy=false;}
}
async function saveAutoSlot() {
  if(await storeGameSnapshot(0,snapshotSlot(true)))if(saveModalMode==='load'||saveModalMode==='save')renderSaveModal(saveModalMode);
}
async function saveSlot(index) {
  if (!playing || saveScreenshotBusy || !Number.isInteger(index) || index < 1 || index >= 20) return;
  const slots = readSaveSlots();
  if (slots[index] && !confirm(`覆盖第 ${index + 1} 个存档吗？`)) return;
  const snapshot=snapshotSlot();if(!await storeGameSnapshot(index,snapshot))return;
  renderSaveModal('save');
  toast(snapshot.thumbnail?`已保存到第 ${index + 1} 个存档`:'进度已保存，截图暂时不可用。',!snapshot.thumbnail);
}
function loadSlot(index) {
  const slot = index === -1 ? readLegacyFirstSlot() : readSaveSlots()[index];
  if (!slot) return;
  const { actIndex: targetAct, stepIndex: targetStep } = slotLocation(slot);
  if (!project.acts[targetAct]?.steps[targetStep]) { toast('这个存档对应的剧情已不存在', true); return; }
  if (playing && !confirm(`读取${index === -1 ? '旧版备份' : `第 ${index + 1} 个存档`}？当前进度若未保存会丢失。`)) return;
  playerInventory=normalizeInventory(slot.inventory,project.items);inventorySession=true;document.querySelector('#inventory-reward')?.remove();
  const discoveries=loadLifetimeProgress();discoveries.seenItemIds||=[];for(const id of playerInventory.known)if(!discoveries.seenItemIds.includes(id))discoveries.seenItemIds.push(id);localStorage.setItem(lifetimeKey(),JSON.stringify(discoveries));
  const progress = slotDialogueProgress(slot);
  playViewedStepIds = new Set(progress.seen);
  playCharacterLineCounts = { ...progress.counts };
  restoredEventRemaining = isEvent(project.acts[targetAct]) && Number.isFinite(slot.eventRemaining) ? slot.eventRemaining : undefined;
  playAct = targetAct; playStep = targetStep; playing = true; preparedAct = -1;
  restartPlayerAutoSave();
  closePlayerModal();
  showPlayStep();
}
function renderSaveModal(view) {
  if (view === 'save' && !playing) { toast('请先开始游戏'); return; }
  clearAutoAdvance();
  saveModalMode = view;
  const slots = readSaveSlots();
  const cards = slots.map((slot, index) => {
    const background = slot && asset(slot.backgroundId);
    const preview = background && background.type === 'image'
      ? ` style="background-image:url('${escape(assetUrl(background))}')"` : '';
    const time = slot?.savedAt ? new Date(slot.savedAt).toLocaleString('zh-CN', { hour12: false }) : '旧版存档';
    return `<button type="button" class="save-slot ${slot ? 'filled' : 'vacant'} ${index === 0 ? 'auto-save-slot' : ''}" data-action="${view}-slot" data-index="${index}" ${(view === 'load' && !slot) || (view === 'save' && index === 0) ? 'disabled' : ''}>
      <span class="save-thumb"${preview}>${validSaveThumbnail(slot?.thumbnail)?`<img src="${slot.thumbnail}" alt="存档时的游戏画面">`:''}<b>${String(index + 1).padStart(2, '0')}</b></span>
      <span class="save-details"><strong>${index === 0 ? '自动存档' : `存档 ${String(index + 1).padStart(2, '0')}`} · ${slot ? escape(slot.actName || '剧情') : '空档位'}</strong>
        <small>${index === 0 && view === 'save' ? '每 5 分钟自动保存，不可手动覆盖' : slot ? escape(time) : view === 'save' ? '点击这里保存' : '尚未保存'}</small>
        <span>${slot ? escape(`${slot.speaker || '旁白'}：${slot.text || ''}`) : ''}</span>
      </span>
    </button>`;
  }).join('');
  document.querySelector('#player-modal')?.remove();
  document.querySelector('.player .stage-frame').insertAdjacentHTML('beforeend', `<section id="player-modal" class="player-modal" role="dialog" aria-modal="true" aria-label="${view === 'save' ? '存档' : '读档'}">
    <div class="modal-box"><header><div><small>GAME MENU</small><h2>${view === 'save' ? '保存游戏' : '读取存档'}</h2></div>${button('关闭 ×', 'close-modal')}</header>
      <div class="modal-tabs">${button('存档', 'save-game', `class="${view === 'save' ? 'active' : ''}" ${!playing ? 'disabled' : ''}`)}${button('读档', 'load-game', `class="${view === 'load' ? 'active' : ''}"`)}</div>
      <div class="save-grid">${cards}</div>${view === 'load' && readLegacyFirstSlot() ? button('读取旧版 1 号位备份', 'load-legacy-slot', 'class="legacy-save-button"') : ''}<footer>1 号位固定为自动存档，每 5 分钟保存一次；${view === 'save' ? '请在 2–20 号位手动存档。' : '点击已有存档继续游戏。'}</footer>
    </div></section>`);
}
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeGraphics=async phase=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(ok,message)=>{if(!ok)throw Error(message);};
 if(phase==='kernel')return verifyFsrGPU();
 if(phase==='export'){await save();await bridge('exportGame',{folderName:'画面设置试玩'});return {ok:true,exported:true};}
 if(phase==='settings'){
  playing=true;playAct=0;playStep=0;preparedAct=-1;await showPlayStep();finishTyping();for(const record of stage.visibleRecords.values())record.mixer.timeScale=0;renderSettingsModal();document.querySelector('#player-graphics-controls').scrollIntoView({block:'start'});window.__graphicsCases=[];return {ok:true,default:graphicsPreferences,capabilities:aaOptions.map(([aa])=>({aa,supported:stage.graphicsPlan({aa}).supported}))};
 }
 if(typeof phase==='object'){
  const quality=normalizeGraphics(phase);if(!stage.graphicsPlan(quality).supported)return {ok:true,skipped:true,reason:stage.graphicsPlan(quality).reason};
  const set=(key,value)=>{const input=document.querySelector('[data-graphics='+key+']');input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));};set('aa','fxaa');set('upscale','off');for(const [key,value]of Object.entries(quality))set(key,value);
  document.querySelector('[data-action=apply-graphics]').click();for(let i=0;i<300&&JSON.stringify(graphicsPreferences)!==JSON.stringify(quality);i++)await wait(20);assert(JSON.stringify(graphicsPreferences)===JSON.stringify(quality),'画面设置没有应用：'+document.querySelector('#toast').textContent);
  stage.stylePipeline.render(.016);const plan=stage.stylePipeline.plan;assert(stage.stylePipeline.composer.readBuffer.width===plan.inputWidth,'实际绘制尺寸没有改变');assert(stage.stylePipeline.composer.renderTarget1.samples===plan.samples,'MSAA 没有作用于真实缓冲');assert(stage.stylePipeline.fxaaPass.enabled===(quality.aa==='fxaa'||quality.aa.startsWith('msaa')),'FXAA 开关未生效');if(plan.fsr)assert(stage.stylePipeline.presenter.target.width===plan.outputWidth,'FSR 没有重建到显示尺寸');
  const gl=stage.renderer.getContext(),pixel=new Uint8Array(4),colors=[];for(let y=1;y<8;y++)for(let x=1;x<12;x++){gl.readPixels(Math.floor(plan.outputWidth*x/12),Math.floor(plan.outputHeight*y/8),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);colors.push(...pixel.slice(0,3));}const brightness=colors.reduce((a,b)=>a+b,0)/colors.length;assert(brightness>8,'画面黑屏');assert(gl.getError()===gl.NO_ERROR,'GPU 绘制错误');assert(!stage.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'着色器无法编译');
  const stored=JSON.parse(localStorage.getItem('vrm-player-graphics-'+project.id));assert(stored.aa===quality.aa&&stored.upscale===quality.upscale,'画面设置没有保存');const currentTarget=stage.renderer.getRenderTarget();stage.renderer.setRenderTarget(stage.stylePipeline.composer.renderTarget1);const actualSamples=gl.getParameter(gl.SAMPLES);stage.renderer.setRenderTarget(currentTarget);if(plan.samples)assert(actualSamples>=plan.samples,'实际 GPU 缓冲没有使用 MSAA');stage.stylePipeline.render(0);const image=stage.renderer.domElement.toDataURL('image/png');const result={ok:true,quality,input:[plan.inputWidth,plan.inputHeight],output:[plan.outputWidth,plan.outputHeight],samples:plan.samples,actualSamples,brightness,image};window.__graphicsCases.push(result);return result;
 }
 if(phase==='styles'){await applyPlayerGraphics({aa:'fxaa',upscale:'quality'});const results=[];for(const preset of ['zzz','custom','tno']){stage.setRenderSettings({...project.render,preset});await wait(100);stage.stylePipeline.render(.016);const gl=stage.renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(40,40,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);const code=gl.getError();assert(code===gl.NO_ERROR,'风格与FSR混合错误 '+preset+' code='+code+' programs='+JSON.stringify(stage.renderer.info.programs.filter(p=>p.diagnostics&&!p.diagnostics.runnable).map(p=>p.diagnostics)));assert(!stage.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'风格着色器错误');results.push(preset);}await applyPlayerGraphics(normalizeGraphics());return {ok:true,presets:results};}
 if(phase==='restart'){const saved=JSON.stringify(graphicsPreferences);graphicsPreferences=normalizeGraphics();loadAudioSettings();setupPlayerGraphics();assert(JSON.stringify(graphicsPreferences)===saved,'重开没有恢复画质');return {ok:true,reloaded:true};}
 if(phase==='inherit'){
  const before=JSON.stringify(graphicsPreferences);closePlayerModal();playStep=1;await showPlayStep();assert(JSON.stringify(stage.graphicsSettings)===before,'切对白覆盖玩家画质');renderSettingsModal();return {ok:true,dialoguePreserved:true,persisted:graphicsPreferences,cases:window.__graphicsCases.length};
 }
};
function setupPlayerGraphics(){
 if(mode!=='player'||!stage)return;
 stage.onGraphicsFallback=settings=>{graphicsPreferences=normalizeGraphics(settings);localStorage.setItem('vrm-player-graphics-'+project.id,JSON.stringify(graphicsPreferences));graphicsDraft=normalizeGraphics(graphicsPreferences);refreshGraphicsSettings();toast('画面尺寸变化，已使用安全的抗锯齿设置。');};
 try{stage.setGraphicsSettings(graphicsPreferences);}catch{graphicsPreferences=normalizeGraphics();stage.setGraphicsSettings(graphicsPreferences);localStorage.setItem('vrm-player-graphics-'+project.id,JSON.stringify(graphicsPreferences));}
 stage.renderer.domElement.addEventListener('webglcontextrestored',()=>{graphicsPreferences=normalizeGraphics();stage.setGraphicsSettings(graphicsPreferences);localStorage.setItem('vrm-player-graphics-'+project.id,JSON.stringify(graphicsPreferences));graphicsDraft=normalizeGraphics(graphicsPreferences);refreshGraphicsSettings();toast('画面已恢复，已使用安全画质。');});
}
function graphicsSettingsMarkup(){
 const settings=normalizeGraphics(graphicsDraft),plan=stage?.graphicsPlan(settings);
 return `<label class="field"><span>抗锯齿</span><select data-graphics="aa">${aaOptions.map(([key,label])=>{const supported=stage?.graphicsPlan({...settings,aa:key}).supported;return `<option value="${key}" ${settings.aa===key?'selected':''} ${supported===false?'disabled':''}>${label}${supported===false?' · 当前不可用':''}</option>`;}).join('')}</select></label>
 <label class="field"><span>画面重建</span><select data-graphics="upscale" ${settings.aa.startsWith('ssaa')?'disabled':''}>${fsrOptions.map(([key,label])=>`<option value="${key}" ${settings.upscale===key?'selected':''}>${label}</option>`).join('')}</select></label>
 <label class="volume-line"><span>绘制分辨率</span><input type="range" data-graphics="renderScale" min="50" max="100" step="5" value="${settings.renderScale}" ${settings.upscale!=='off'||settings.aa.startsWith('ssaa')?'disabled':''}><output data-graphics-output="renderScale">${settings.renderScale}%</output></label>
 <label class="volume-line"><span>FSR 锐度</span><input type="range" data-graphics="sharpness" min="0" max="100" value="${settings.sharpness}" ${settings.upscale==='off'?'disabled':''}><output data-graphics-output="sharpness">${settings.sharpness}%</output></label>
 <label class="field"><span>阴影精度</span><select data-graphics="shadows">${[['off','关闭'],['low','低'],['medium','中'],['high','高']].map(([key,label])=>`<option value="${key}" ${settings.shadows===key?'selected':''}>${label}</option>`).join('')}</select></label>
 <p class="graphics-summary" data-graphics-summary>${plan?`场景绘制：${plan.inputWidth} × ${plan.inputHeight} → 显示：${plan.outputWidth} × ${plan.outputHeight}`:''}</p>
 <label class="field"><span>MMD 头发与衣饰物理</span><select data-graphics="mmdPhysics">${[['balanced','开启 · 性能优先（默认）'],['full','开启 · 完整更新'],['off','关闭 · 降低人物计算负担']].map(([key,label])=>`<option value="${key}" ${settings.mmdPhysics===key?'selected':''}>${label}</option>`).join('')}</select></label>
 <p>超采样倍数指绘制像素总量；倍数越大，显卡负担越高。FSR 1.0 用较低分辨率重建画面，与超采样二选一。文字和菜单保持清晰。</p>
 <div class="inline-actions">${button('应用画面设置','apply-graphics')}${button('恢复默认画质','reset-graphics')}</div><hr>`;
}
function refreshGraphicsSettings(){const node=document.querySelector('#player-graphics-controls');if(node)node.innerHTML=graphicsSettingsMarkup();}
async function applyPlayerGraphics(settings){
 const previous=normalizeGraphics(graphicsPreferences);try{stage.setGraphicsSettings(settings);stage.stylePipeline.render(0);const gl=stage.renderer.getContext(),error=gl.getError();if(error!==gl.NO_ERROR)throw Error('当前画质无法正常绘制，请降低倍数或分辨率。');graphicsPreferences=normalizeGraphics(stage.graphicsSettings);localStorage.setItem('vrm-player-graphics-'+project.id,JSON.stringify(graphicsPreferences));graphicsDraft=normalizeGraphics(graphicsPreferences);refreshGraphicsSettings();toast('画面设置已应用。');}
 catch(error){stage.setGraphicsSettings(previous);graphicsDraft=previous;refreshGraphicsSettings();throw error;}
}
function renderSettingsModal() {
  graphicsDraft=normalizeGraphics(graphicsPreferences);
  clearAutoAdvance();
  saveModalMode = 'settings';
  document.querySelector('#player-modal')?.remove();
  const resolutions = availableResolutions.length ? availableResolutions : ['960x540', '1280x720'];
  const volume = (key, label) => `<label class="volume-line"><span>${label}</span><input type="range" data-volume="${key}" min="0" max="100" value="${Math.round(audioSettings[key] * 100)}"><output data-volume-output="${key}">${Math.round(audioSettings[key] * 100)}%</output></label>`;
  document.querySelector('.player .stage-frame').insertAdjacentHTML('beforeend', `<section id="player-modal" class="player-modal" role="dialog" aria-modal="true" aria-label="游戏设置">
    <div class="modal-box settings-box"><header><div><small>GAME MENU</small><h2>游戏设置</h2></div>${button('关闭 ×', 'close-modal')}</header>
      <div class="settings-body">
      <h3>音量</h3>${volume('master', '总音量')}${volume('music', '背景音乐')}${volume('voice', '角色语音')}${volume('effects', '按钮与场景音效')}
      <h3>对白</h3><label class="volume-line"><span>文字出现速度</span><input type="range" data-text-speed min="5" max="100" value="${textSpeed}"><output data-text-speed-output>${textSpeed} 字/秒</output></label>
      <h3>画面</h3>
      <div id="player-graphics-controls">${graphicsSettingsMarkup()}</div>
      <label class="volume-line"><span>镜头移动速度</span><input type="range" data-camera-speed min="85" max="115" step="1" value="${Math.round(cameraSpeed*100)}"><output data-camera-speed-output>${Math.round(cameraSpeed*100)}%</output></label><p>镜头移动时间由距离决定；连续点击画面可立即到达目标镜头。</p>
      ${window.__vrmAndroid?'':`<label class="field"><span>窗口大小（全部为 16:9）</span><select id="window-resolution" ${playerFullscreen ? 'disabled' : ''}>${resolutions.map(value => `<option value="${value}" ${value === playerResolution ? 'selected' : ''}>${value.replace('x', ' × ')}</option>`).join('')}</select></label>
      ${button('应用窗口大小', 'apply-resolution', playerFullscreen ? 'disabled' : '')}
      <div class="settings-line"><span>全屏显示</span>${button(playerFullscreen ? '退出全屏' : '进入全屏', 'toggle-fullscreen')}</div>`}
      <p>无论窗口大小或显示器比例如何，游戏画面始终保持 16:9。</p>
      <p class="font-credit">界面使用 HarmonyOS Sans 字体。© 2021 Huawei Device Co., Ltd.</p>
    </div></div></section>`);
}
window.__androidBack=()=>{if(mode==='player'){if(document.querySelector('#player-modal'))closePlayerModal();else renderSettingsModal();}};
window.__androidPause=()=>{if(mode==='player'){renderSettingsModal();music.pause();voice.pause();galleryMusic.pause();}};
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeUi33=async phase=>{
 const assert=(value,message)=>{if(!value)throw Error(message);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const controls=()=>[...document.querySelectorAll('#play-controls button')].map(b=>b.dataset.action).sort().join(',');
 if(phase==='picker'){
  await Promise.all([...portraitJobs.values()]);const theme=editorSettings.theme,revision=changeRevision;
  document.querySelector('[data-action="game-ui"]').click();assert(document.querySelectorAll('#game-ui-picker input[type="radio"]').length===gameUiPresets.length,'Game presets missing');assert(!document.querySelector('#game-ui-picker input[type="color"],#game-ui-picker input[type="range"]'),'Picker must not be an editor');
  document.querySelector('#game-ui-picker input[value="terminal"]').checked=true;document.querySelector('[data-action="close-game-ui"]').click();assert(changeRevision===revision,'Cancel changed project');
  renderGameUiPicker();document.querySelector('#game-ui-picker input[value="pop"]').checked=true;document.querySelector('[data-action="apply-game-ui"]').click();assert(project.ui.gameTheme==='pop'&&dirty,'Choice not applied');assert(editorSettings.theme===theme,'Changed editor skin');renderGameUiPicker();return{ok:true,threePresets:true,cancelPreservesProject:true,editorUnaffected:true};
 }
 if(phase==='reopen'){
  assert(project.ui.gameTheme==='terminal','Saved/exported game lost its skin');mode='player';playing=false;renderPlayer();await wait(900);assert(document.querySelector('.player')?.dataset.gameUi==='terminal','Player skin missing');return{ok:true,theme:project.ui.gameTheme,savedAndExported:true};
 }
 if(phase==='pop-title'){
  document.querySelector('#game-ui-picker')?.remove();project.id='ui33-'+uid();lifetimeProgress=null;project.ui.dialogueImageId='';mode='player';playing=false;renderPlayer();audioSettings.master=0;applyAudioSettings();await wait(1500);
  for(let i=0;i<200&&document.querySelector('#act-loading:not(.hidden)');i++)await wait(50);
  window.__ui33controls=controls();window.__ui33title=[...document.querySelectorAll('.title-bottom-menu button')].map(b=>b.dataset.action).sort().join(',');assert(document.querySelector('.player')?.dataset.gameUi==='pop','Missing pop skin');return{ok:true,titleButtons:window.__ui33title};
 }
 if(phase==='pop-dialogue'){
  playing=true;titleRequest++;playAct=project.acts.findIndex(a=>!isEvent(a)&&a.steps.length);playStep=0;preparedAct=-1;cameraActId='';await showPlayStep();showDialogue('角色 · 粉白舞台','这是你选择的粉白舞台界面。\n原来的按钮和功能全部保留。',true,project.acts[playAct].steps[0].characterId);finishTyping();playerInventory.pending=[];document.querySelector('#inventory-reward')?.remove();saveModalMode='';await wait(500);assert(!document.querySelector('#inventory-reward'),'Reward obscures UI screenshot');
  assert(getComputedStyle(document.querySelector('#dialogue')).backgroundColor!=='rgba(0, 0, 0, 0)','Dialogue box is transparent');assert(controls()===window.__ui33controls,'Game buttons changed');return{ok:true,gameButtonsUnchanged:true,dialogueBackground:getComputedStyle(document.querySelector('#dialogue')).backgroundColor};
 }
 if(phase.endsWith('-settings')){
  renderSettingsModal();assert(document.querySelector('[data-camera-speed]')&&document.querySelector('[data-graphics]')&&document.querySelector('[data-volume]'),'Lost existing game settings');await wait(450);return{ok:true,settingsPreserved:true,background:getComputedStyle(document.querySelector('.settings-box')).backgroundColor};
 }
 if(phase==='terminal-dialogue'){
  closePlayerModal();await wait(220);project.ui.gameTheme='terminal';document.querySelector('.player').dataset.gameUi='terminal';showDialogue('记录员 · 青绿终端','记录已更新。\n镜头正在移动时，画面保持干净。',true,project.acts[playAct].steps[0].characterId);finishTyping();assert(controls()===window.__ui33controls,'Game buttons changed');await wait(400);return{ok:true,gameButtonsUnchanged:true,ink:getComputedStyle(document.querySelector('#dialogue-text')).color};
 }
 if(phase==='classic'){
  closePlayerModal();await wait(220);project.ui.gameTheme='classic';document.querySelector('.player').dataset.gameUi='classic';showDialogue('角色 · 经典玻璃','原来的透明玻璃界面也可以继续使用。',true,project.acts[playAct].steps[0].characterId);finishTyping();assert(controls()===window.__ui33controls,'Classic buttons changed');assert(getComputedStyle(document.querySelector('#dialogue')).backgroundColor==='rgba(0, 0, 0, 0)','Classic appearance changed');return{ok:true,classicPreserved:true};
 }
 if(phase==='camera-empty'){
  project.ui.gameTheme='terminal';document.querySelector('.player').dataset.gameUi='terminal';const pose=snapshotCamera(stage.camera),target={...pose,position:[pose.position[0]+12,pose.position[1],pose.position[2]]};
  const blank={id:uid(),name:'空场景镜头测试',cast:emptyDialogueCast(),castSettings:{},steps:[{id:uid(),text:'没有人物也能正常显示旁白。',speaker:'旁白',characterId:'',cast:emptyDialogueCast(),choices:[],camera:pose},{id:uid(),text:'切镜头时没有转圈。',speaker:'旁白',characterId:'',cast:emptyDialogueCast(),choices:[],camera:target}]};project.acts.push(blank);playAct=project.acts.length-1;playStep=0;preparedAct=-1;
  const opening=showPlayStep();await wait(10);assert(!document.querySelector('#act-loading').classList.contains('hidden'),'Act loading was removed');await opening;finishTyping();assert(document.querySelector('#stage-placeholder').style.display==='none'&&!document.querySelector('.player').textContent.includes('此句没有 VRM'),'Empty scene prompt still shown');
  playStep=1;const flight=showPlayStep();for(let i=0;i<100&&!dialogueCamera.moving;i++)await wait(30);assert(dialogueCamera.moving,'Camera did not move');assert(document.querySelector('#act-loading').classList.contains('hidden'),'Camera travel shows act spinner');assert(!document.querySelector('#stage-placeholder .loading-spinner')&&document.querySelector('#stage-placeholder').style.display==='none','Camera placeholder spinner');dialogueCamera.finish();await flight;finishTyping();return{ok:true,cameraMovesWithoutSpinner:true,emptySceneWithoutWarning:true,realActLoadingRetained:true};
 }
 if(phase==='save-export'){
  playing=false;mode='editor';closePlayerModal();project.ui.gameTheme='terminal';project.assets=[];project.characters=[];project.assetFolders=[];project.environments=[];project.items=[];project.books=[];project.acts=[project.acts.at(-1)];project.title={actors:[],logoImageId:'__none__'};selectedAct=0;selectedStep=0;activePanel='story';normalize();renderEditor();markDirty();await save();const exported=await bridge('exportGame',{folderName:'UI33导出验证'});return{ok:true,theme:project.ui.gameTheme,exported};
 }
 throw Error('Unknown UI smoke phase');
};
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokePortrait35=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(phase==='setup'){
  await Promise.all([...portraitJobs.values()]);const pool=project.characters.filter(c=>asset(c.modelId)?.type==='vrm'),role=pool[2]||pool[0];assert(role,'Need VRM');
  const source=project.acts.find(a=>!isEvent(a)&&a.environmentId),cast=emptyDialogueCast();cast.center={characterId:role.id,motionId:'',motionOptions:{loop:true,placement:'inPlace',feet:'lock'},size:1,offsetX:0,offsetY:0,offsetZ:0,yaw:0,expressionWeights:{},props:[]};
  const line={id:uid(),speaker:role.name,characterId:role.id,text:'头像保留自然的点头和歪头，整个人转身时仍从正面拍摄。',cast,choices:[],camera:{position:[0,1.35,4.3],target:[0,1.05,0],fov:32}};
  project.acts=[{...structuredClone(source||{}),id:uid(),name:'头像自然动作测试',cast:emptyDialogueCast(),castSettings:{},steps:[line]}];project.title={actors:[],logoImageId:'__none__'};project.ui.gameTheme='pop';project.ui.dialogueImageId='';project.id='portrait35-'+uid();lifetimeProgress=null;mode='player';playing=false;renderPlayer();audioSettings.master=0;applyAudioSettings();await wait(300);playing=true;titleRequest++;playAct=playStep=0;preparedAct=-1;await showPlayStep();finishTyping();await wait(300);stage.renderSuspended=true;
  const record=stage.livePortrait.record,head=record?.vrm.humanoid.getNormalizedBoneNode('head'),neck=record?.vrm.humanoid.getNormalizedBoneNode('neck'),hips=record?.vrm.humanoid.getNormalizedBoneNode('hips');assert(record&&head&&hips,'Live portrait missing');
  window.__portrait35Data={record,head,neck,hips,headRest:head.quaternion.clone(),neckRest:neck?.quaternion.clone(),hipsRest:hips.quaternion.clone()};
  paintPortrait35();window.__portrait35Data.cameraPosition=stage.livePortrait.camera.position.clone();window.__portrait35Data.cameraRotation=stage.livePortrait.camera.quaternion.clone();window.__portrait35Data.tip=new THREE.Vector3(0,.12,.06).applyMatrix4(head.matrixWorld).project(stage.livePortrait.camera);
  assert(record===stage.visibleRecords.get(role.id),'Extra actor instance');return{ok:true,role:role.name,sameModel:true,bodyFraming:true};
 }
 const data=window.__portrait35Data,{record,head,neck,hips}=data;
 function stableCamera(){assert(stage.livePortrait.camera.position.distanceTo(data.cameraPosition)<1e-6,'Camera followed head position');assert(stage.livePortrait.camera.quaternion.angleTo(data.cameraRotation)<1e-6,'Camera cancelled head rotation');}
 if(phase==='nod'){
  head.quaternion.copy(data.headRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.42));const pose=head.quaternion.toArray();paintPortrait35();stableCamera();const tip=new THREE.Vector3(0,.12,.06).applyMatrix4(head.matrixWorld).project(stage.livePortrait.camera);assert(tip.distanceTo(data.tip)>.02,'Nod not visible');assert(head.quaternion.toArray().every((v,i)=>Math.abs(v-pose[i])<1e-10),'Portrait changed bones');return{ok:true,nodVisible:true,cameraDoesNotCancelNod:true,projectedMotion:tip.distanceTo(data.tip)};
 }
 if(phase==='tilt'){
  head.quaternion.copy(data.headRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-.3));if(neck)neck.quaternion.copy(data.neckRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-.18));paintPortrait35();stableCamera();const tip=new THREE.Vector3(0,.12,.06).applyMatrix4(head.matrixWorld).project(stage.livePortrait.camera);assert(tip.distanceTo(data.tip)>.05,'Tilt not visible');return{ok:true,tiltAndNeckMotionVisible:true,cameraDoesNotPinHead:true,projectedMotion:tip.distanceTo(data.tip)};
 }
 if(phase==='body-turn'){
  head.quaternion.copy(data.headRest);if(neck)neck.quaternion.copy(data.neckRest);
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){hips.quaternion.copy(data.hipsRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle));const before=hips.quaternion.toArray();paintPortrait35();const frame=portraitBodyFrame(record),direction=stage.livePortrait.camera.position.clone().sub(frame.target).normalize();assert(direction.dot(new THREE.Vector3(0,0,1).applyQuaternion(frame.orientation))>.85,'Back-facing portrait');assert(hips.quaternion.toArray().every((v,i)=>Math.abs(v-before[i])<1e-10),'Changed body motion');}
  hips.quaternion.copy(data.hipsRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI));paintPortrait35();return{ok:true,fourBodyDirections:true,bodyTurnsRemainFrontFacing:true,scenePoseUnchanged:true};
 }
 if(phase==='animation'){
  hips.quaternion.copy(data.hipsRest);head.quaternion.copy(data.headRest);if(neck)neck.quaternion.copy(data.neckRest);record.vrm.update(0);
  const rest=data.headRest.toArray(),nod=data.headRest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.42)).toArray(),tracks=record.idleClip.tracks.filter(t=>![head.name+'.quaternion',head.uuid+'.quaternion'].includes(t.name)).map(t=>t.clone());tracks.push(new THREE.QuaternionKeyframeTrack(head.name+'.quaternion',[0,.5,1],[...rest,...nod,...rest]));
  stage.poseRecord(record,new THREE.AnimationClip('点头动作验证',1,tracks),{id:'test-portrait35',name:'点头'},false,{loop:true,placement:'inPlace',feet:'free'});const samples=[];
  for(const time of [0,.2,.4,.6,.8]){stage.restoreFootPose(record);record.mixer.setTime(time);stage.applyMotionPlacement(record);paintPortrait35();samples.push({camera:stage.livePortrait.camera.quaternion.clone(),relative:stage.livePortrait.camera.quaternion.clone().invert().multiply(head.getWorldQuaternion(new THREE.Quaternion()))});}
  const range=Math.max(...samples.map(s=>s.relative.angleTo(samples[0].relative))),cameraRange=Math.max(...samples.map(s=>s.camera.angleTo(samples[0].camera)));assert(range>.2&&cameraRange<1e-5,'Mixer motion cancelled by camera');return{ok:true,realMixerMotionVisible:true,headAngleRange:range,cameraAngleRange:cameraRange};
 }
 throw Error('Unknown portrait phase');
};
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeMmd36=async phase=>{
 const {runMmdSmoke}=await import('./mmd-smoke.js');return runMmdSmoke(phase,{
  blank:()=>defaultProject('MMD 模型测试'),cast:emptyDialogueCast,asset,project:()=>project,stage:()=>stage,roleDetails:()=>roleDetails,
  setProject:p=>{project=p;normalize();lifetimeProgress=null;},
  start:async()=>{mode='player';playing=false;renderPlayer();await new Promise(r=>setTimeout(r,400));audioSettings.master=0;applyAudioSettings();playing=true;titleRequest++;playAct=playStep=0;preparedAct=-1;await showPlayStep();finishTyping();},
  details:async()=>{for(const role of project.characters)rememberDiscovery('character',role.id);return openRoleDetails();},
  editor:async()=>{playing=false;mode='editor';activePanel='characters';selectedCharacter=0;renderEditor();markDirty();},save
 });
};
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeThumbnail37=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(phase==='tiles'){
  playing=false;mode='editor';project.assets.push(...window.__thumbnail37Imported);const models=project.assets.filter(a=>a.type==='mmdCharacter');assert(models.length===3,'Need three MMD models');for(const model of models)project.characters.push({id:uid(),name:model.name,modelId:model.id,props:[],stories:[]});normalize();activePanel='characters';selectedCharacter=project.characters.findIndex(c=>c.modelId===models[0].id);activeAssetType='mmdCharacter';renderEditor();
  modelThumbnails.refresh(project.assets.filter(a=>['mmdCharacter','fbxCharacter'].includes(a.type)));await modelThumbnails.ready;renderAssetDock();await wait(300);const generated=project.assets.filter(a=>['mmdCharacter','fbxCharacter'].includes(a.type));assert(generated.every(a=>a.thumbnailPath),'MMD or FBX thumbnail missing');assert(document.querySelectorAll('.model-thumbnail').length===3,'MMD tile does not use image');for(const image of document.querySelectorAll('.model-thumbnail')){await image.decode();assert(image.naturalWidth===512,'Wrong thumbnail dimensions');}window.__thumbnail37Path=models[0].thumbnailPath;return {ok:true,models:generated.map(a=>({type:a.type,path:a.thumbnailPath})),mmdTileImages:3};
 }
 if(phase==='folder'){
  project.assets.push(...window.__thumbnail37Folder);const model=window.__thumbnail37Folder.find(a=>a.type==='mmdCharacter');assert(model.thumbnailSource==='folder'&&model.thumbnailPath,'Existing avatar ignored');const before=model.thumbnailPath;modelThumbnails.refresh([model]);await modelThumbnails.ready;assert(model.thumbnailPath===before&&model.thumbnailSource==='folder','Existing avatar replaced');renderAssetDock();await wait(200);return {ok:true,existingFolderAvatarCopied:true,notRephotographed:true};
 }
 if(phase==='mouth'){
  const role=project.characters.find(c=>asset(c.modelId)?.type==='mmdCharacter'),record=await stage.loadModel(asset(role.modelId),role.id),manager=record.vrm.expressionManager,mesh=record.vrm.mesh;stage.renderSuspended=true;
  manager.setValue('aa',.8);manager.setValue('あ',.95);manager.setValue('口横広げ',.8);manager.setValue('happy',.6);record.vrm.update(0);const aa=mesh.morphTargetDictionary['あ'],corner=mesh.morphTargetDictionary['口角上げ'];assert(mesh.morphTargetInfluences[aa]>.9,'Authored mouth absent');
  stage.visibleRecords.set(role.id,record);stage.startTalking(role.id,true);for(let i=0;i<12;i++){record.talkingMouth.restore();record.talkingMouth.update(.05);record.vrm.update(0);assert(mesh.morphTargetInfluences[aa]<.7,'Authored mouth stacked');if(corner!==undefined)assert(mesh.morphTargetInfluences[corner]===0,'Smile mouth stacked');}
  stage.stopTalking();assert(mesh.morphTargetInfluences[aa]>.9,'Authored mouth not restored');if(corner!==undefined)assert(Math.abs(mesh.morphTargetInfluences[corner]-.6)<1e-6,'Mouth corner not restored');manager.resetValues();record.vrm.update(0);return {ok:true,rawAndPresetMouthReplacedDuringSpeech:true,immediateRestoration:true};
 }
 if(phase==='save'){stage.renderSuspended=false;markDirty();await save();return {ok:true,thumbnailDependencies:project.assets.filter(a=>a.modelThumbnail).length};}
 if(phase==='reopen'){playing=false;mode='editor';activeAssetType='mmdCharacter';renderEditor();const models=project.assets.filter(a=>['mmdCharacter','fbxCharacter'].includes(a.type));assert(models.length>=5&&models.every(a=>a.thumbnailPath),'Reopened thumbnails missing');assert(project.assets.filter(a=>a.modelThumbnail).length>=5,'Thumbnail files not saved');renderAssetDock();for(const image of document.querySelectorAll('.model-thumbnail'))await image.decode();return {ok:true,persistedThumbnails:true,images:document.querySelectorAll('.model-thumbnail').length};}
 throw Error('Unknown thumbnail smoke');
};
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokePhysics38=async phase=>{const {physicsSmoke}=await import('./physics-smoke.js');return physicsSmoke(phase,{project:()=>project,asset,stage:()=>stage,clear:async()=>{stage.clearLivePortrait();stage.clear();},save:()=>bridge('saveProject',{project:structuredClone(project)}),start:async()=>{mode='player';playing=false;renderPlayer();await new Promise(r=>setTimeout(r,400));playing=true;titleRequest++;playAct=playStep=0;preparedAct=-1;await showPlayStep();finishTyping();await new Promise(r=>setTimeout(r,200));}});};
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeJitter39=async phase=>{const {jitterProbe}=await import('./jitter-smoke.js');return jitterProbe(phase,{project:()=>project,stage:()=>stage});};
function paintPortrait35(){
 const record=stage.livePortrait.record;record.vrm.update(0);record.anchor.updateWorldMatrix(true,true);record.vrm.springBoneManager?.reset?.();stage.stylePipeline.render(0);stage.livePortrait.render(stage.renderer,stage.scene,stage.element);stage.livePortrait.camera.updateMatrixWorld(true);
}
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeUi34=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(phase==='picker'){
  await Promise.all([...portraitJobs.values()]);renderGameUiPicker();assert(document.querySelectorAll('#game-ui-picker input').length===4,'Four presets missing');document.querySelector('#game-ui-picker input[value="astral"]').checked=true;document.querySelector('[data-action="apply-game-ui"]').click();assert(project.ui.gameTheme==='astral','Fourth preset not applied');renderGameUiPicker();return{ok:true,fourPresets:true,oneCombinedNewStyle:true};
 }
 if(phase==='reopen'){
  assert(project.ui.gameTheme==='astral','New style lost on save/export');mode='player';playing=false;renderPlayer();await wait(900);assert(document.querySelector('.player').dataset.gameUi==='astral','Player did not apply style');return{ok:true,persistedStyle:'astral'};
 }
 if(phase==='title'){
  document.querySelector('#game-ui-picker')?.remove();project.id='ui34-test-'+uid();lifetimeProgress=null;project.ui.dialogueImageId='';mode='player';playing=false;renderPlayer();audioSettings.master=0;applyAudioSettings();for(let i=0;i<400&&(document.querySelectorAll('.title-bottom-menu button').length!==8||document.querySelector('#act-loading:not(.hidden)'));i++)await wait(50);
  assert(document.querySelectorAll('.title-bottom-menu button').length===8&&document.querySelector('.title-bottom-menu [data-action="role-details"]'),'Role details title entry missing');await openRoleDetails();assert(roleDetails.roles.length===0&&roleDetails.viewer.modelCache.size===0&&document.querySelector('.role-details-empty').textContent.includes('还没有解锁'),'Title decorations unlocked roles');closePlayerModal();await wait(250);return{ok:true,originalButtonsPreserved:true,roleDetailsTitleEntry:true,lockedPageLoadsNoModels:true};
 }
 if(phase==='portrait-turn'){
  playAct=project.acts.findIndex(a=>!isEvent(a)&&a.steps.length);playStep=0;project.acts[playAct].steps[0].itemGrants=[];playing=true;titleRequest++;preparedAct=-1;await showPlayStep();finishTyping();await wait(400);stage.renderSuspended=true;
  const record=stage.livePortrait.record,head=record?.vrm.humanoid.getNormalizedBoneNode('head'),hips=record?.vrm.humanoid.getNormalizedBoneNode('hips');assert(head&&hips,'Live VRM missing');const initialHips=hips.quaternion.clone(),initialAnchor=record.anchor.quaternion.clone();
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   hips.quaternion.copy(initialHips).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle));record.vrm.update(0);record.anchor.updateMatrixWorld(true);
   const before=hips.quaternion.clone(),orientation=head.getWorldQuaternion(new THREE.Quaternion()).multiply(record.portraitRestHeadQuaternion.clone().invert());
   stage.stylePipeline.render(0);stage.livePortrait.render(stage.renderer,stage.scene,stage.element);
   const relative=stage.livePortrait.camera.position.clone().sub(head.getWorldPosition(new THREE.Vector3())).normalize();assert(relative.dot(new THREE.Vector3(0,0,1).applyQuaternion(orientation))>.85,'Avatar turned its back');assert(hips.quaternion.toArray().every((n,i)=>Math.abs(n-before.toArray()[i])<1e-10)&&record.anchor.quaternion.toArray().every((n,i)=>Math.abs(n-initialAnchor.toArray()[i])<1e-10),'Portrait moved the scene actor');
  }
  hips.quaternion.copy(initialHips).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI));record.vrm.update(0);record.anchor.updateMatrixWorld(true);stage.stylePipeline.render(0);stage.livePortrait.render(stage.renderer,stage.scene,stage.element);
  assert(stage.livePortrait.record===record&&stage.visibleRecords.has(record.vrm===stage.vrm?stage.portraitActorKey:stage.portraitActorKey),'Did not reuse actor');return{ok:true,animatedTurnsTested:4,portraitFacesPlayer:true,sceneActorUnchanged:true,sameModelAndExpressions:true};
 }
 if(phase==='dialogue'){
  showDialogue('角色 · 星曜剧场','这是一套融合后的游戏界面。\n金色姓名、白色对白，场景保持清晰。',true,project.acts[playAct].steps[playStep].characterId);finishTyping();await wait(500);assert(getComputedStyle(document.querySelector('#dialogue-speaker')).color==='rgb(244, 210, 116)','Name is not gold');assert(document.querySelectorAll('#play-controls button').length===8,'Game controls changed');return{ok:true,goldenName:true,framelessDialogue:true,existingControls:true};
 }
 if(phase==='settings'){
  renderSettingsModal();await wait(350);assert(document.querySelector('[data-graphics]')&&document.querySelector('[data-volume]')&&document.querySelector('[data-camera-speed]'),'Settings missing');return{ok:true,existingSettings:true};
 }
 if(phase==='save'){
  closePlayerModal();await wait(250);stage.renderSuspended=true;const baseline=await captureSaveThumbnail(document.querySelector('.player .stage-frame'),payload=>bridge('captureGameThumbnail',payload));assert(validSaveThumbnail(baseline),'Native screenshot failed');renderSaveModal('save');const probe=document.querySelector('.modal-box');probe.style.background='#00ff5a';probe.style.boxShadow='0 0 0 30px #00ff5a';await saveSlot(1);const slot=readSaveSlots()[1];assert(validSaveThumbnail(slot?.thumbnail),'Manual save image missing');await saveAutoSlot();assert(validSaveThumbnail(readSaveSlots()[0]?.thumbnail),'Auto save image missing');assert(document.querySelectorAll('.save-thumb img').length===2,'Thumbnails not shown');
  const bitmap=await createImageBitmap(await fetch(slot.thumbnail).then(r=>r.blob()));assert(bitmap.width===320&&bitmap.height===180,'Screenshot is not 16:9');const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const pixels=ctx.getImageData(0,0,320,180).data;assert(Math.max(...pixels.filter((_,i)=>i%4===0))-Math.min(...pixels.filter((_,i)=>i%4===0))>30,'Screenshot is blank');let green=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<40&&pixels[i+1]>200&&pixels[i+2]>45&&pixels[i+2]<140)green++;assert(green<288,'Save menu color probe leaked into screenshot');bitmap.close();window.__ui34Thumbnail=slot.thumbnail;
  renderSaveModal('load');assert(document.querySelector('[data-action="load-slot"][data-index="1"] img'),'Read screen lost thumbnail');await wait(350);return{ok:true,manualAndAutoImages:true,gameScreenshotWithoutMenus:true,jpegDimensions:[320,180],storedBytes:slot.thumbnail.length,readScreenThumbnail:true};
 }
 if(phase==='gallery'){
  closePlayerModal();await wait(220);const originals=project.characters.filter(c=>asset(c.modelId)),base=originals.find(c=>asset(c.modelId).type==='vrm');assert(originals.length>=3,'Need three roles');
  for(const role of originals){role.detailsIdleId='';rememberDiscovery('character',role.id);}
  while(project.characters.length<14){const copy={...structuredClone(base),id:uid(),name:'队列测试 '+project.characters.length,detailsIdleId:''};project.characters.push(copy);rememberDiscovery('character',copy.id);}
  const locked={...structuredClone(base),id:uid(),name:'绝不能显示的角色'};project.characters.push(locked);await openRoleDetails();const viewer=roleDetails.viewer,renderer=viewer.renderer;
  assert(!document.querySelector('#role-details').textContent.includes(locked.name)&&!viewer.modelCache.has('details:'+locked.id),'Locked role was exposed');assert(roleDetails.roles.length===14,'Locked role not filtered');assert(!document.querySelector('#role-details [data-action="gallery-character"]'),'Role-name buttons remain');
  await roleDetails.select(6);assert(viewer.modelCache.size===11&&viewer.visibleRecords.size<=5,'Neighbour cache is not bounded');assert(roleDetails.viewer.renderer===renderer,'Selection recreated renderer');const centre=viewer.visibleRecords.get('details:'+roleDetails.roles[6].id);assert(centre&&Math.abs(centre.anchor.rotation.y)<.001&&Math.abs(centre.anchor.position.x)<.001,'Current role not front-centred');
  const time=centre.currentAction.time;await wait(400);assert(Math.abs(centre.currentAction.time-time)>.01&&centre.mixer.timeScale===1,'Role froze on a frame');
  const canvas=document.querySelector('.role-details-canvas');canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:60,bubbles:true,cancelable:true}));await roleDetails.ready;assert(roleDetails.index===7,'Mouse wheel did not switch');canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,button:0,clientX:500,clientY:300,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,button:0,clientX:580,clientY:300,bubbles:true}));await roleDetails.ready;assert(roleDetails.index===6,'Swipe did not switch');assert(viewer.modelCache.size<=11&&!viewer.modelCache.has('details:'+locked.id),'Cache window leaked');
  closePlayerModal();assert(!viewer.running&&!roleDetails.isOpen,'Details close leaked renderer');project.characters=originals;
  originals[0].description='角色简介显示在左侧。切换角色时，介绍会一起更新。';originals[0].stories=[{text:'这是角色故事的展示位置。作者可以在角色编辑器里填写每个人的经历。',unlockLines:0},{text:'未解锁的故事内容不应显示',unlockLines:1000}];await openRoleDetails();await roleDetails.select(0);assert(document.querySelector('.role-story-locked')&&!document.querySelector('.role-details-stories').textContent.includes('未解锁的故事内容不应显示'),'Story unlock rule lost');const middle=Math.min(2,originals.length-1);originals[middle].description=originals[0].description;originals[middle].stories=structuredClone(originals[0].stories);await roleDetails.select(middle);await wait(500);
  return{ok:true,lockedRolesCompletelyHidden:true,upToElevenCached:true,onlyOnscreenRolesDrawn:true,singleRendererForSwitches:true,liveIdle:true,frontCentre:true,wheelAndSwipe:true,closeDisposes:true,storyUnlockPreserved:true};
 }
 if(phase==='progress'){
  closePlayerModal();await wait(220);renderProgressModal();await wait(350);assert(document.querySelectorAll('.chapter-card').length,'Chapter cards missing');return{ok:true,chapterCardsPreserved:true};
 }
 if(phase==='export'){
  playing=false;mode='editor';closePlayerModal();project.assets=[];project.characters=[];project.assetFolders=[];project.environments=[];project.items=[];project.books=[];project.acts=[{id:uid(),name:'截图验证',steps:[{id:uid(),speaker:'旁白',text:'星曜剧场导出检查。',cast:emptyDialogueCast(),characterId:'',choices:[]}]}];project.title={actors:[],logoImageId:'__none__'};selectedAct=0;selectedStep=0;activePanel='story';normalize();renderEditor();markDirty();await save();return{ok:true,theme:project.ui.gameTheme,exported:await bridge('exportGame',{folderName:'UI34导出验证'})};
 }
 throw Error('Unknown UI34 phase');
};
window.__vrmSmokeGallery32=async()=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));await Promise.all([...portraitJobs.values()]);
 const originals=project.characters.filter(c=>asset(c.modelId)),vrm=originals.find(c=>asset(c.modelId).type==='vrm'),fbx=originals.find(c=>asset(c.modelId).type==='fbxCharacter'),pool=[vrm,fbx,...originals.filter(c=>c!==vrm&&c!==fbx)].filter(Boolean);assert(pool.length>=4,'Need four gallery actors');
 project.id='gallery-smoke32-'+uid();lifetimeProgress=null;mode='player';playing=false;renderPlayer();audioSettings.master=0;applyAudioSettings();for(const c of pool)rememberDiscovery('character',c.id);galleryTab='characters';galleryCharacterId=pool[0].id;renderGalleryModal();await gallerySelection;
 const viewer=galleryStage,renderer=viewer.renderer,canvas=renderer.domElement,host=viewer.element;assert(viewer.vrm,'First gallery actor missing');let misses=0;const load=viewer.loadModel.bind(viewer);viewer.loadModel=(m,key)=>{if(m&&viewer.modelCache.get(key)?.modelAssetId!==m.id)misses++;return load(m,key);};
 async function choose(role){galleryCharacterId=role.id;galleryStoryIndex=0;const start=performance.now();await selectGalleryCharacter();assert(galleryStage===viewer&&viewer.renderer===renderer&&viewer.renderer.domElement===canvas&&viewer.element===host,'Renderer recreated');return performance.now()-start;}
 await choose(pool[1]);const count=misses,fast=await choose(pool[0]);assert(misses===count,'Seen actor loaded again');const times=[fast,await choose(pool[1]),await choose(pool[0])];assert(misses===count,'Repeated switches loaded resources');
 let release;viewer.loadModel=(m,key)=>key==='gallery:'+pool[2].id&&!viewer.modelCache.has(key)?new Promise(r=>release=()=>r(load(m,key))):load(m,key);
 galleryCharacterId=pool[2].id;const cold=selectGalleryCharacter();for(let i=0;i<100&&!release;i++)await wait(20);assert(release,'Cold actor did not start');assert(viewer.visibleRecords.has('gallery:'+pool[0].id),'Old actor disappeared during load');galleryCharacterId=pool[3].id;const skipped=selectGalleryCharacter();galleryCharacterId=pool[1].id;const final=selectGalleryCharacter();release();await Promise.all([cold,skipped,final]);assert(viewer.visibleRecords.has('gallery:'+pool[1].id)&&!viewer.modelCache.has('gallery:'+pool[3].id),'Last click did not win');viewer.loadModel=load;
 await choose(pool[3]);assert(viewer.modelCache.size<=3&&galleryCache.cache.size<=3,'Gallery cache exceeds three');assert(!viewer.modelCache.has('gallery:'+pool[0].id),'Oldest actor not evicted');
 galleryTab='music';renderGalleryModal();assert(galleryStage===viewer&&viewer.renderSuspended,'Tab switch did not pause viewer');galleryTab='characters';renderGalleryModal();await gallerySelection;assert(galleryStage===viewer,'Tab switch rebuilt viewer');
 const locked={...structuredClone(pool[0]),id:uid(),name:'未解锁测试'};project.characters.push(locked);galleryCharacterId=locked.id;await selectGalleryCharacter();assert(viewer.element.style.display==='none'&&document.querySelector('.gallery-character-seal'),'Locked actor exposed previous model');galleryCharacterId=pool[1].id;await selectGalleryCharacter();assert(viewer.element.style.display!=='none','Unlocked actor did not return');
 closePlayerModal();assert(!galleryStage&&!galleryCache&&!stage.renderSuspended&&!viewer.running,'Closing gallery leaked renderer');await wait(220);galleryTab='characters';galleryCharacterId=pool[1].id;renderGalleryModal();await gallerySelection;
 return{ok:true,vrmAndFbx:true,singleRendererAcrossSelections:true,cacheHitLoads:0,warmSwitchMilliseconds:times,recentThreeLimit:true,oldFrameWhileLoading:true,lastClickWins:true,tabPauseAndReuse:true,lockedActorProtected:true,closeDisposesViewer:true};
};
window.__vrmSmokeOrganize31=async()=>{
 const assert=(v,m)=>{if(!v)throw Error(m);};await Promise.all([...portraitJobs.values()]);
 const roles=project.characters.slice(0,2),motions=project.assets.filter(a=>a.type==='motion');assert(roles.length===2&&motions.length,'工程缺少角色或动作');syncAssetOrganization(project,uid);
 assert(project.assetFolders.find(f=>f.id===commonMotionFolderId)?.locked,'通用动作文件夹未锁定');for(const role of project.characters)assert(project.assetFolders.find(f=>f.id===motionFolderId(role.id))?.locked,'缺少角色动作文件夹');
 const privateMotion={...structuredClone(motions[0]),id:uid(),name:'专属动作检查',folderId:motionFolderId(roles[0].id)};project.assets.push(privateMotion);markDirty();
 activePanel='characters';selectedCharacter=0;renderInspector();let select=document.querySelector('[data-field="character.detailsIdleId"]');assert([...select.options].some(o=>o.value===privateMotion.id),'自己的动作未显示');selectedCharacter=1;renderInspector();select=document.querySelector('[data-field="character.detailsIdleId"]');assert(![...select.options].some(o=>o.value===privateMotion.id),'其他角色的动作泄露');
 activeAssetType='motion';currentAssetFolder.motion='';renderAssetDock();assert(!document.querySelector('#asset-dock-body [data-action=add-asset-folder]'),'允许创建普通动作文件夹');currentAssetFolder.motion=commonMotionFolderId;renderAssetDock();assert(!document.querySelector('#asset-dock-body [data-action=rename-asset-folder]'),'通用动作文件夹可以改名');
 activeAssetType='music';currentAssetFolder.music='';renderAssetDock();assert(document.querySelector('[data-type=music][role=tab]')&&document.querySelector('[data-type=effect][role=tab]')&&!document.querySelector('[data-type=audio][role=tab]'),'音乐与音效未分开');
 activePanel='story';const source=project.acts.find(a=>!isEvent(a)&&a.steps.length),copy=await pasteObject({kind:'act',source},true),before=copy.steps.length,line=copy.steps[0],confirmOriginal=window.confirm;window.confirm=()=>true;
 try{activePanel='story';selectedAct=project.acts.findIndex(a=>a.id===copy.id);selectedStep=0;renderSidebar();renderInspector();document.querySelector('[data-action=select-step][data-index="0"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:10,clientY:10}));assert(document.querySelector('[data-context-command=delete]'),'对白右键菜单缺少删除');objectMenu.close();await deleteContextObject({kind:'step',source:line,ownerId:copy.id});assert(act().steps.length===before-1,'对白未删除');await restoreEditorHistory(-1);assert(act().steps.length===before,'删除对白无法撤销');const count=project.acts.length;await deleteContextObject({kind:'act',source:act()});assert(project.acts.length===count-1,'幕未删除');await restoreEditorHistory(-1);assert(project.acts.length===count,'删除幕无法撤销');await restoreEditorHistory(1);}finally{window.confirm=confirmOriginal;}
 await handleEventAction('event-add',{});renderInspector();for(const [key,kind]of [['bgmId','music'],['seId','effect']]){const field=document.querySelector(`[data-event-field="${key}"]`);assert(field,'没有事件声音控件');assert([...field.options].filter(o=>o.value).every(o=>asset(o.value)?.audioKind===kind),'事件声音仍混在一起');}
 activeAssetType='music';currentAssetFolder.music='';renderAssetDock();return{ok:true,musicAssets:byType('music').length,effectAssets:byType('effect').length,commonMotions:project.assets.filter(a=>a.type==='motion'&&a.folderId===commonMotionFolderId).length,perRoleFolders:project.characters.length,motionIsolation:true,lockedFolders:true,separateEventSelectors:true,deleteActAndDialogue:true,deleteUndoRedo:true};
};
window.__vrmSmokeLoad31=async()=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},fbxAsset=project.assets.find(a=>a.type==='fbxCharacter'),base=project.characters.find(c=>asset(c.modelId)?.type==='fbxCharacter')||(fbxAsset?{id:'test-fbx-role',name:'FBX??',modelId:fbxAsset.id,portraitId:project.assets.find(a=>a.type==='image')?.id||'',portraitSource:'manual',props:[],stories:[]}:null),vrm=project.characters.find(c=>asset(c.modelId)?.type==='vrm');assert(base&&vrm,'Missing crowd fixture');
 const crowd=Array.from({length:30},(_,i)=>({...structuredClone(base),id:'queue31-'+i,name:'队列人物 '+(i+1),props:i===0?(base.props||[]).map(p=>({...structuredClone(p),id:uid()})):[]}));
 const portraitRole={...structuredClone(vrm),id:'portrait-only31',name:'场外说话者'},photoRole={...structuredClone(base),id:'photo-only31',name:'场外 FBX'},futureRole={...structuredClone(vrm),id:'future-only31',name:'下一幕人物'};
 project.characters.push(...crowd,portraitRole,photoRole,futureRole);const environment=createEnvironment('30 人队列验证');environment.nodes[0].width=30;environment.nodes[0].height=50;environment.camera={position:[10,10,20],target:[0,1,-9],fov:45};project.environments.push(environment);
 const makeLine=(speaker,text)=>({id:uid(),characterId:speaker,text,choices:[],cast:emptyDialogueCast()});
 const lines=[makeLine(crowd[0].id,'30 人已经排成三列、十排。'),makeLine(portraitRole.id,'我不在队伍里，但我的模型和物品已在切幕时准备好。'),makeLine(photoRole.id,'只用图片头像说话的 FBX 角色也在资源名单里。'),makeLine(crowd[0].id,'当前对白不会再提前加载下一幕。')];
 for(const line of lines)dialogueSlots.forEach((slot,i)=>line.cast[slot].characterId=crowd[i].id);
 const chapter={id:uid(),name:'队列与完整名单验证',environmentId:environment.id,render:normalizeRender({preset:'custom'}),weather:normalizeWeather(),steps:lines};
 const future={...structuredClone(chapter),id:uid(),name:'尚未加载的下一幕',steps:[makeLine(futureRole.id,'现在才开始加载下一幕。')]};future.steps[0].cast.center.characterId=futureRole.id;project.acts=[chapter,future];
 playing=true;syncAssetOrganization(project,uid);activePanel='story';selectedAct=0;selectedStep=0;renderSidebar();renderInspector();assert(document.querySelectorAll('[data-cast-slot]').length===30,'编辑界面不是 30 个位置');
 playAct=0;playStep=0;preparedAct=-1;await showPlayStep();finishTyping();assert(stage.visibleRecords.size===30,'未显示 30 人');
 const cacheCount=stage.modelCache.size;assert([...crowd,portraitRole,photoRole].every(c=>stage.modelCache.has(c.id)),'漏掉了场外说话者：'+JSON.stringify([...stage.modelCache.keys()]));const liveRecord=await stage.modelCache.get(portraitRole.id),photoRecord=await stage.modelCache.get(photoRole.id);assert(liveRecord&&photoRecord,'头像角色没有提前加载');assert(!liveRecord.vrm.scene.visible&&!photoRecord.vrm.scene.visible,'场外角色出现在队伍里');
 for(let i=0;i<30;i++){const record=await stage.modelCache.get(crowd[i].id),base=dialogueSlotPosition(dialogueSlots[i],true);assert(Math.abs(record.anchor.position.x-base.x)<.001&&Math.abs(record.anchor.position.z-base.z)<.001,'队列位置不正确');}
 playStep=1;await showPlayStep();finishTyping();assert(stage.livePortrait.record===liveRecord,'场外 VRM 头像重新加载');assert(stage.modelCache.size===cacheCount,'说话时临时加载人物');
 playStep=2;await showPlayStep();finishTyping();assert(await stage.modelCache.get(photoRole.id)===photoRecord,'场外 FBX 角色重新加载');await new Promise(r=>setTimeout(r,1000));assert(!stage.modelCache.has(futureRole.id),'当前幕里加载了下一幕人物');assert(!document.querySelector('#act-preload-indicator'),'预加载图标仍在');assert(document.querySelector('#act-loading').classList.contains('hidden'),'对白时仍在转圈');
 playStep=3;await showPlayStep();finishTyping();await new Promise(r=>setTimeout(r,400));assert(!stage.modelCache.has(futureRole.id),'最后一句开始预加载');
 const eventCase=newEvent(uid(),uid());eventCase.name='事件前台加载验证';eventCase.event.title='事件资源已经准备好';eventCase.event.bgmId=byType('music')[0]?.id||'';eventCase.event.seId=byType('effect')[0]?.id||'';eventCase.event.imageId=project.assets.find(a=>a.type==='image')?.id||'';project.acts.splice(1,0,eventCase);
 const master=audioSettings.master;audioSettings.master=0;applyAudioSettings();playAct=1;playStep=0;await showPlayStep();assert(document.querySelector('#world-event'),'事件没有显示');assert(!transitioning&&document.querySelector('#act-loading').classList.contains('hidden'),'事件加载没有结束');events.cancel();playAct=0;playStep=3;preparedAct=-1;await showPlayStep();finishTyping();audioSettings.master=master;applyAudioSettings();
 return{ok:true,onstageActors:30,residentActActors:cacheCount,formation:'3x10',originalFrontPositions:true,portraitOnlyVrmReady:true,portraitOnlyFbxReady:true,noNewActorLoadsDuringDialogue:true,noNextActPreload:true,thirtyEditorSlots:true,eventForegroundLoading:true};
};
window.__vrmSmokeSave31=async()=>{stopPlay();activePanel='story';selectedAct=0;selectedStep=0;renderSidebar();renderInspector();markDirty();await save();return{ok:true,slots:Object.keys(project.acts[0].steps[0].cast).length};};
window.__vrmSmokeCopy30=async()=>{
 const assert=(v,message)=>{if(!v)throw Error(message);},index=project.acts.findIndex(a=>!isEvent(a)&&a.steps.length);
 activePanel='story';selectedAct=index;selectedStep=0;renderSidebar();renderInspector();
 const original=act(),before=project.acts.length,row=document.querySelector(`[data-action=select-act][data-index="${index}"]`);
 row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:20,clientY:20}));assert(document.querySelector('.editor-context-menu [data-context-command=copy]'),'右键菜单未打开');
 document.querySelector('[data-context-command=copy]').click();const context={kind:'act',source:original};const copy=await pasteObject(context);assert(copy.id!==original.id&&copy.steps.every((s,i)=>s.id!==original.steps[i].id),'幕复制编号重复');assert(JSON.stringify(copy.steps[0].camera)===JSON.stringify(original.steps[0].camera),'镜头没有复制');
 await restoreEditorHistory(-1);assert(project.acts.length===before,'复制无法撤销');await restoreEditorHistory(1);assert(project.acts.length===before+1,'复制无法重做');
 const current=act(),first=current.steps[0];captureObject({kind:'step',source:first,ownerId:current.id});const line=await pasteObject({kind:'step',source:first,ownerId:current.id});assert(line.text===first.text&&line.id!==first.id,'对白粘贴错误');
 await handleEventAction('event-add',{});const event=act(),eventCopy=await pasteObject({kind:'act',source:event},true);assert(eventCopy.kind==='event'&&eventCopy.event.type===event.event.type,'事件幕未复制');
 activePanel='characters';selectedCharacter=0;renderSidebar();renderInspector();const role=project.characters[0],roleCopy=await pasteObject({kind:'character',source:role},true);assert(roleCopy.modelId===role.modelId&&roleCopy.id!==role.id,'角色未复制');assert((roleCopy.props||[]).every((p,i)=>p.id!==role.props[i].id),'角色物品编号重复');
 if(roleCopy.props?.length){const binding=roleCopy.props[0];await pasteObject({kind:'prop',source:binding,ownerId:roleCopy.id},true);assert(roleCopy.props.length===(role.props.length+1),'物品绑定未复制');}
 const image=project.assets.find(a=>a.type==='image');project.items||=[];const item={id:uid(),name:'右键测试物品',imageId:image.id,description:'用于检查物品复制与保存。'};project.items.push(item);activePanel='items';selectedItem=project.items.length-1;renderSidebar();renderInspector();const itemCopy=await pasteObject({kind:'item',source:item},true);assert(itemCopy.imageId===item.imageId&&itemCopy.id!==item.id,'玩家物品未复制');
 activePanel='title';renderSidebar();renderInspector();const sceneOwner=project.title,environment=project.environments[0];const sceneCopy=await pasteObject({kind:'environment',source:environment,sceneOwner},true);assert(sceneCopy.nodes.length===environment.nodes.length&&sceneCopy.nodes.every((n,i)=>n.id!==environment.nodes[i].id),'场景节点编号重复');
 const titleActor=project.title.actors[0];if(titleActor){const titleCopy=await pasteObject({kind:'titleActor',source:titleActor},true);assert(titleCopy.id!==titleActor.id&&titleCopy.modelId===titleActor.modelId,'标题人物未复制');}
 const model=project.assets.find(a=>a.type==='sceneModel'),assetCopy=await pasteObject({kind:'asset',source:model},true);assert(assetCopy.id!==model.id&&assetCopy.path===model.path,'素材复制错误');
 const folder={id:uid(),name:'复制检查素材',type:model.type};project.assetFolders.push(folder);const folderCopy=await pasteObject({kind:'folder',source:{...folder,contents:[{...assetCopy,folderId:folder.id}]}},true);assert(project.assets.some(a=>a.folderId===folderCopy.id),'文件夹素材未复制');
 showExportChooser();assert(document.querySelector('[data-action=export-windows]')&&!document.querySelector('[data-action=export-android]')&&!document.querySelector('#apk-app-name'),'仍可导出安卓');document.querySelector('#export-game-modal').remove();
 activePanel='story';selectedAct=project.acts.findIndex(a=>a.id===copy.id);selectedStep=0;const choice={text:'复制分支条件',actId:copy.id,requirements:[{itemId:itemCopy.id,quantity:5}],consumeRequired:true};step().choices.push(choice);const choiceCopy=await pasteObject({kind:'choice',source:choice,ownerId:step().id},true);assert(choiceCopy!==choice&&choiceCopy.requirements[0].quantity===5&&choiceCopy.consumeRequired,'分支条件未复制');renderSidebar();renderInspector();await updatePreview();assert(!document.querySelector('[data-action=duplicate-step]'),'复制按钮未移入右键菜单');await save();
 document.querySelector(`[data-action=select-act][data-index="${selectedAct}"]`).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:35,clientY:420}));
 return{ok:true,rightClick:true,act:true,event:true,dialogue:true,character:true,prop:true,item:true,environment:true,asset:true,folder:true,titleActor:true,choice:true,uniqueIds:true,undoRedo:true,androidEntryRemoved:true};
};
window.__vrmSmokeControls29=async()=>{
 const assert=(value,text)=>{if(!value)throw Error(text);},input=(selector,value)=>{const n=document.querySelector(selector);assert(n,'Missing control '+selector);n.value=String(value);n.dispatchEvent(new Event('input',{bubbles:true}));};
 activePanel='story';selectedAct=0;selectedStep=0;renderSidebar();renderInspector();const slot=castSlots.find(s=>step().cast?.[s]?.characterId);assert(slot,'Missing actor fixture');
 input(`[data-cast-adjust="${slot}.offsetX"]`,72);assert(step().cast[slot].offsetX===72,'100 metre position failed');const fine=document.querySelector(`[data-cast-adjust="${slot}.offsetX"]`).closest('[data-precise-control]').querySelector('[data-precise-fine]');fine.value='50';fine.dispatchEvent(new Event('input',{bubbles:true}));assert(step().cast[slot].offsetX===72.5,'Fine position failed');input(`[data-cast-adjust="${slot}.yaw"]`,330);assert(step().cast[slot].yaw===330,'360-degree actor rotation failed');
 const previous=JSON.stringify(act().render);activePanel='title';renderInspector();assert(!document.querySelector('[data-title-adjust=cameraAngle]'),'Obsolete camera angle retained');input('[data-render=preset][data-render-scope=title]','custom');input('[data-render=brightness][data-render-scope=title]',143);assert(project.title.render.brightness===143&&JSON.stringify(act().render)===previous,'Title style not independent');return{ok:true,position100m:true,finePosition:true,rotation360:true,titleRenderIndependent:true,cameraAngleRemoved:true};
};
window.__vrmSmokeResidency29=async()=>{
 const assert=(v,text)=>{if(!v)throw Error(text);},chapter=project.acts.find(a=>a.kind!=='event'&&a.steps.length>1),entries=preparationEntries(chapter,chapter.steps);assert(entries.length,'No fixture cast');
 playing=true;window.__preloadTestFps=25;await stage.prepareAct(entries);
 const keys=[...new Set(entries.filter(e=>e.modelAsset).map(e=>e.actorKey||e.modelAsset.id))],records=new Map(),props=new Map(),culling=new Map();
 for(const key of keys){const record=await stage.modelCache.get(key);assert(record&&record.anchor.parent===stage.scene,'Actor not resident in scene');assert(!record.vrm.scene.visible,'Dormant actor is visible');records.set(key,record);for(const [id,attached]of record.attachedProps||[])props.set(key+':'+id,attached.root);}
 stage.scene.traverse(o=>{if(o.isMesh)culling.set(o,o.frustumCulled);});
 await stage.warmPreparedGraphics({stage,environment:stage.environmentRuntime,camera:stage.camera},async()=>{});
 for(const record of records.values())assert(!record.vrm.scene.visible,'Warmup exposed hidden actor');for(const root of props.values())assert(!root.visible,'Warmup exposed hidden item');for(const [o,value]of culling)assert(o.frustumCulled===value,'Warmup changed visibility culling');
 await displayActStep(chapter,chapter.steps[0]);await displayActStep(chapter,chapter.steps[1]);
 for(const [key,record]of records){assert(await stage.modelCache.get(key)===record,'Actor reconstructed');for(const [id,attached]of record.attachedProps||[])assert(props.get(key+':'+id)===attached.root,'Item reconstructed');}
 return{ok:true,residentActors:keys.length,residentProps:props.size,hiddenUntilNeeded:true,sameInstancesAfterDialogueSwitch:true,gpuWarm:true,warmupStateRestored:true};
};
window.__vrmSmokeVrmPortrait28=async()=>{
 const assert=(value,label)=>{if(!value)throw Error(label);},role=project.characters.find(c=>asset(c.modelId)?.type==='vrm');assert(role,'Missing VRM fixture');
 role.portraitSource='manual';role.portraitId=byType('image')[0]?.id||'';activePanel='characters';selectedCharacter=project.characters.indexOf(role);renderInspector();assert(!document.querySelector('[data-action=upload-character-portrait]')&&!document.querySelector('[data-action=capture-character-portrait]'),'VRM has photo controls');
 activePanel='story';selectedAct=0;selectedStep=0;step().characterId=role.id;renderSidebar();renderInspector();await updatePreview();await updateSpeakerPortrait(role.id,true);await new Promise(r=>setTimeout(r,500));
 const node=document.querySelector('#speaker-portrait'),record=stage.livePortrait.record;assert(record&&node.classList.contains('live-portrait')&&!node.querySelector('img').getAttribute('src'),'Legacy PNG replaced VRM');const rect=node.getBoundingClientRect(),frame=node.closest('.stage-frame').getBoundingClientRect();assert(rect.height/frame.height>.67,'Portrait height too low');assert(stage.livePortrait.camera.top>0.4*record.anchor.getWorldScale(new THREE.Vector3()).y,'Headroom not extended');
 return {ok:true,vrmPhotoControlsRemoved:true,legacyPngIgnored:true,liveModel:true,heightRatio:rect.height/frame.height,headroom:true};
};
const galleryTracks = () => byType('music').filter(item => item.galleryMusic !== false);
function nextUnlockedTrack(direction) {
  const tracks = galleryTracks();
  for (let offset = 1; offset <= tracks.length; offset++) {
    const index = (galleryTrackIndex + direction * offset + tracks.length * 2) % tracks.length;
    if (hasDiscovered('music', tracks[index].id)) return index;
  }
  return -1;
}
const gallerySongName = item => item?.galleryTitle?.trim() || item?.name?.replace(/\.[^.]+$/, '') || '未命名乐曲';
const musicTime = seconds => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00';
function stopGalleryMusic() {
  const resumeBgm = galleryMusicInterruptedBgm;
  galleryMusic.pause();
  galleryMusic.removeAttribute('src');
  galleryMusic.load();
  galleryMusicInterruptedBgm = false;
  if (resumeBgm && music.src) music.play().catch(() => {});
}
function updateGalleryMusicTime() {
  const seek = document.querySelector('#gallery-music-seek');
  const elapsed = document.querySelector('#gallery-music-elapsed');
  const duration = document.querySelector('#gallery-music-duration');
  if (seek) { seek.max = Number.isFinite(galleryMusic.duration) ? galleryMusic.duration : 0; seek.value = galleryMusic.currentTime || 0; }
  if (elapsed) elapsed.textContent = musicTime(galleryMusic.currentTime);
  if (duration) duration.textContent = musicTime(galleryMusic.duration);
}
function renderGalleryMusicState() {
  const playButton = document.querySelector('[data-action="gallery-music-toggle"]');
  if (playButton) playButton.textContent = galleryMusic.paused ? '▶ 播放' : 'Ⅱ 暂停';
  document.querySelectorAll('[data-action="gallery-track"]').forEach(node =>
    node.classList.toggle('active', Number(node.dataset.index) === galleryTrackIndex));
  document.querySelector('[data-action="gallery-repeat"]')?.classList.toggle('active', galleryRepeatOne);
  updateGalleryMusicTime();
}
async function playGalleryTrack(index) {
  const tracks = galleryTracks();
  if (!tracks.length || index < 0 || !hasDiscovered('music', tracks[index]?.id)) return;
  galleryTrackIndex = (index + tracks.length) % tracks.length;
  if (!galleryMusicInterruptedBgm) galleryMusicInterruptedBgm = !music.paused;
  music.pause();
  galleryMusic.src = assetUrl(tracks[galleryTrackIndex]);
  galleryMusic.currentTime = 0;
  try { await galleryMusic.play(); }
  catch { toast('这首音乐无法播放，请检查音频文件', true); }
  if (saveModalMode === 'gallery' && galleryTab === 'music') renderGalleryModal();
}
function galleryCharacterData() {
  const item = character(galleryCharacterId) || project.characters[0];
  if (item) galleryCharacterId = item.id;
  const counts = loadLifetimeProgress().characterLineCounts;
  return { item, count: Math.max(0, Number(counts[item?.id]) || 0), hasSave: Boolean(readSaveSlots().some(Boolean)) };
}
function galleryStoryMarkup(item, count, storyIndex = galleryStoryIndex, editorPreview = false) {
  if (!item) return '<p class="gallery-empty">还没有创建角色。</p>';
  const story = item.stories?.[storyIndex - 1];
  if (!editorPreview && !hasDiscovered('character', item.id)) {
    const content = storyIndex && story?.text?.trim() ? story.text : `${item.title || ''}\n${item.description || ''}`;
    return `<h3>${storyIndex ? `角色故事 · ${storyIndex}` : '角色详情'}</h3>${storyIndex ? '' : `<strong class="gallery-detail-name">${escape(hiddenName(item.name))}</strong>`}<p class="gallery-character-text">${escape(maskSecret(content || '未解锁'))}</p>`;
  }
  if (!storyIndex || !story?.text?.trim()) {
    return `<h3>角色详情</h3><strong class="gallery-detail-name">${escape(item.name)}</strong>${item.title?.trim() ? `<p class="gallery-character-title">${escape(item.title)}</p>` : ''}
      ${item.description?.trim() ? `<p class="gallery-character-text">${escape(item.description)}</p>` : ''}`;
  }
  const required = Math.max(0, Number(story.unlockLines) || 0);
  return `<h3>角色故事 · ${storyIndex}</h3>${count >= required
    ? `<p class="gallery-character-text">${escape(story.text)}</p>`
    : `<div class="gallery-story-locked"><strong>故事尚未解锁</strong><span>阅读这个角色的 ${required} 句对白后解锁</span><small>累计阅读：${count} / ${required} 句</small></div>`}`;
}
function renderGalleryCharacterText() {
  const { item, count } = galleryCharacterData();
  const content = document.querySelector('#gallery-character-text');
  if (content) content.innerHTML = galleryStoryMarkup(item, count);
  document.querySelectorAll('[data-action="gallery-story"]').forEach(node =>
    node.classList.toggle('active', Number(node.dataset.index) === galleryStoryIndex));
}
function galleryImageMarkup() {
  const images = byType('image').filter(item => item.galleryImage !== false);
  const pages = Math.max(1, Math.ceil(images.length / 6));
  galleryPage = Math.max(0, Math.min(pages - 1, galleryPage));
  const visible = images.slice(galleryPage * 6, galleryPage * 6 + 6);
  return `<div class="gallery-image-grid">${visible.length ? visible.map((item, index) => {
    const unlocked = hasDiscovered('image', item.id);
    return `<button type="button" class="gallery-image-tile ${unlocked ? '' : 'locked'}" data-action="gallery-image" data-image-id="${escape(item.id)}" aria-label="${unlocked ? `查看第 ${galleryPage * 6 + index + 1} 张图片` : '图片未解锁'}" ${unlocked ? '' : 'disabled'}>
      <img src="${escape(assetUrl(item))}" alt="">${unlocked ? '' : '<span class="gallery-locked-label">未解锁</span>'}</button>`;
  }).join('') : '<p class="gallery-empty">还没有加入鉴赏的图片。</p>'}</div>
    <footer class="gallery-pagination">${Array.from({ length: pages }, (_, index) =>
      `<button type="button" data-action="gallery-page" data-index="${index}" class="${index === galleryPage ? 'active' : ''}">${index + 1}</button>`).join('')}</footer>`;
}
function galleryMusicMarkup() {
  const tracks = galleryTracks();
  if (tracks.length && !hasDiscovered('music', tracks[galleryTrackIndex]?.id)) {
    const first = tracks.findIndex(item => hasDiscovered('music', item.id));
    galleryTrackIndex = first >= 0 ? first : 0;
  }
  galleryTrackIndex = Math.max(0, Math.min(tracks.length - 1, galleryTrackIndex));
  const selected = tracks[galleryTrackIndex];
  const selectedUnlocked = selected && hasDiscovered('music', selected.id);
  return tracks.length ? `<div class="gallery-music-layout">
    <div class="gallery-track-list">${tracks.map((item, index) =>
      `<button type="button" data-action="gallery-track" data-index="${index}" class="${index === galleryTrackIndex ? 'active' : ''} ${hasDiscovered('music', item.id) ? '' : 'locked'}" ${hasDiscovered('music', item.id) ? '' : 'disabled'}><small>${String(index + 1).padStart(2, '0')}</small><span>${escape(gallerySongName(item))}</span>${hasDiscovered('music', item.id) ? '' : '<em>未解锁</em>'}</button>`).join('')}</div>
    <div class="gallery-music-player"><div class="gallery-record">♪</div><small>${selectedUnlocked ? '正在选择' : '未解锁'}</small>
      <h3>${selectedUnlocked ? escape(gallerySongName(selected)) : '尚未听过任何乐曲'}</h3>
      <div class="gallery-music-progress"><span id="gallery-music-elapsed">0:00</span><input id="gallery-music-seek" type="range" data-gallery-seek="true" min="0" max="0" step="0.1" value="0"><span id="gallery-music-duration">0:00</span></div>
      <div class="gallery-music-controls">${button('上一首', 'gallery-prev', selectedUnlocked ? '' : 'disabled')}${button(galleryMusic.paused ? '▶ 播放' : 'Ⅱ 暂停', 'gallery-music-toggle', selectedUnlocked ? '' : 'disabled')}${button('下一首', 'gallery-next', selectedUnlocked ? '' : 'disabled')}${button('单曲循环', 'gallery-repeat', `class="${galleryRepeatOne ? 'active' : ''}" ${selectedUnlocked ? '' : 'disabled'}`)}</div>
    </div></div>` : '<p class="gallery-empty">还没有可鉴赏的音乐。作者可以在“素材”中勾选歌曲。</p>';
}
function galleryCharacterMarkup(editorPreview = false) {
  if(editorPreview){
    const item=project.characters[selectedCharacter];if(!item)return '<p>还没有角色。</p>';
    return `<div class="editor-role-preview-layout"><aside id="gallery-character-text">${galleryStoryMarkup(item,Infinity,0,true)}</aside><div class="gallery-character-portrait"><div id="gallery-character-canvas"></div></div><aside class="editor-role-stories"><h3>角色故事</h3>${(item.stories||[]).filter(story=>story.text?.trim()).map((story,i)=>`<h4>故事 ${i+1}</h4><p class="gallery-character-text">${escape(story.text)}</p>`).join('')}</aside></div>`;
  }
  const { item, count, hasSave } = editorPreview
    ? { item: project.characters[selectedCharacter], count: Infinity, hasSave: false }
    : galleryCharacterData();
  const storyIndex = editorPreview ? editorGalleryStoryIndex : galleryStoryIndex;
  const characterAction = editorPreview ? 'preview-character' : 'gallery-character';
  const storyAction = editorPreview ? 'preview-story' : 'gallery-story';
  const stories = item?.stories || [];
  const unlocked = editorPreview || hasDiscovered('character', item?.id);
  return item ? `<div class="gallery-character-layout"><nav class="gallery-character-picker" aria-label="选择角色">${project.characters.map(entry =>
      `<button type="button" data-action="${characterAction}" data-character-id="${escape(entry.id)}" class="${entry.id === item.id ? 'active' : ''}">${escape(editorPreview || hasDiscovered('character', entry.id) ? entry.name : hiddenName(entry.name))}</button>`).join('')}</nav>
    <div class="gallery-character-portrait ${unlocked ? '' : 'locked'}"><div id="gallery-character-canvas"></div>
      ${unlocked ? '' : '<div class="gallery-character-seal">未解锁</div>'}</div>
      <div id="gallery-character-text" class="gallery-character-content">${galleryStoryMarkup(item, count, storyIndex, editorPreview)}</div>
      <nav class="gallery-story-tabs">${button('角色详情', storyAction, `data-index="0" class="${storyIndex === 0 ? 'active' : ''}"`)}
        ${stories.map((story, index) => story.text?.trim() ? button(`角色故事 · ${index + 1}${count >= Math.max(0, Number(story.unlockLines) || 0) ? '' : ' 🔒'}`,
          storyAction, `data-index="${index + 1}" class="${storyIndex === index + 1 ? 'active' : ''}"`) : '').join('')}
      </nav></div><div class="gallery-progress-note">${editorPreview ? '编辑预览 · 作者可查看全部角色故事' : unlocked ? `累计看过这位角色的 ${count} 句对白` : '尚未在故事中遇见这位角色'}</div>`
    : '<p class="gallery-empty">还没有创建角色。</p>';
}
function hideCharacterEditorPreview() {
  stage?.bindingView.disable();propPreviewMode=false;document.querySelector('.stage-frame')?.classList.remove('binding-view-mode');
  const overlay = document.querySelector('#character-preview');
  const frame = document.querySelector('.editor .stage-frame');
  if (!overlay || !frame) return;
  if (stage?.element?.parentElement !== frame) frame.insertBefore(stage.element, overlay);
  overlay.classList.add('hidden');
  overlay.replaceChildren();
  stage?.resize();
}
function refreshGalleryFrameControl(item) {
  const input = document.querySelector('[data-gallery-adjust="galleryPoseFrame"]');
  const number = document.querySelector('[data-gallery-frame-number]');
  const output = document.querySelector('[data-gallery-output="galleryPoseFrame"]');
  if (!input || !output) return;
  const clip = stage?.activeRecord?.currentAction?.getClip();
  if (!item?.galleryMotionId || stage?.currentMotionId !== item.galleryMotionId || !clip) {
    input.disabled = true;
    if (number) number.disabled = true;
    output.textContent = item?.galleryMotionId ? '读取中…' : '先选择动作';
    return;
  }
  const { fps, frames } = motionFrameInfo(clip);
  const legacySeconds = Number.isFinite(Number(item.galleryPoseTime)) ? Number(item.galleryPoseTime) : null;
  const requested = legacySeconds === null ? item.galleryPoseFrame : Math.round(legacySeconds * fps) + 1;
  const frame = Math.max(1, Math.min(frames, Math.floor(Number(requested) || 1)));
  if (frame !== item.galleryPoseFrame || legacySeconds !== null) {
    item.galleryPoseFrame = frame;
    delete item.galleryPoseTime;
    markDirty();
  }
  input.max = frames;
  input.value = frame;
  input.disabled = false;
  if (number) { number.max = frames; number.value = frame; number.disabled = false; }
  output.textContent = `第 ${frame} / ${frames} 帧`;
}
async function showCharacterEditorPreview() {
  updateSpeakerPortrait('',false);
  document.querySelector('#title-preview')?.classList.add('hidden');
  document.querySelector('.stage-frame')?.classList.remove('title-mode');
  if(stage.environmentSettings||stage.environmentRuntime.root)await stage.setEnvironment(null,project.assets);
  if(activePanel!=='characters')return;
  setSceneWeather();
  applySceneColor(colorDefaults);
  const overlay = document.querySelector('#character-preview');
  const frame = document.querySelector('.editor .stage-frame');
  if (!overlay || !frame || !stage) return;
  const item = project.characters[selectedCharacter];
  const bindingMode=propPreviewMode && Boolean(item?.props?.length);
  if(stage.element.parentElement!==frame&&(bindingMode||!overlay.querySelector('.character-preview-box')))frame.insertBefore(stage.element,overlay);
  stage.setPaintBackground(null);
  frame.classList.toggle('binding-view-mode',bindingMode);overlay.classList.toggle('binding-preview',bindingMode);
  if(bindingMode){overlay.innerHTML=`<div class="binding-preview-tools"><div>${button('看整个人物','binding-view-reset')}${button('放大绑定部位','binding-view-bone')}${button('返回人物鉴赏','binding-view-close')}</div><small>左键拖动旋转 · Shift＋左键拖动平移 · 滚轮缩放 · 右键拖动也能平移</small></div>`;}
  else if(overlay.querySelector('.character-preview-box')){stage.bindingView.disable();refreshCharacterGallery(overlay,true);}
  else {stage.bindingView.disable();overlay.innerHTML = `<div class="gallery-box gallery-box-character character-preview-box">
    <header><div><small>CHARACTER DETAILS</small><h2>角色详情预览</h2></div></header>
    <div class="gallery-content">${galleryCharacterMarkup(true)}</div></div>`;}
  overlay.querySelector('.gallery-character-picker .active')?.scrollIntoView({ block: 'nearest' });
  overlay.classList.remove('hidden');
  document.querySelector('#stage-caption').textContent = bindingMode?'物品绑定 · 可转动视角':'角色详情预览';
  document.querySelector('#stage-placeholder').style.display = 'none';
  document.querySelector('#dialogue')?.classList.remove('visible');
  updateSpeakerPortrait('', false);
  if (!item?.modelId) {
    const portraitAsset = asset(item?.portraitId);
    const target = overlay.querySelector('#gallery-character-canvas');
    if (target && portraitAsset) target.innerHTML = `<img class="gallery-flat-portrait" src="${assetUrl(portraitAsset)}" alt="${escape(item.name)}">`;
    await stage.show(null, null); return;
  }
  const portrait = bindingMode?frame:overlay.querySelector('#gallery-character-canvas');
  if (!portrait) return;
  if(bindingMode)frame.insertBefore(stage.element,overlay);else if(stage.element.parentElement!==portrait)portrait.appendChild(stage.element);
  stage.resize();
  stage.sceneAnimationsPaused=()=>Boolean(saveModalMode||document.hidden);
  if(JSON.stringify(stage.renderSettings)!==JSON.stringify(normalizeRender(project.render)))stage.setRenderSettings(project.render);
  if(!bindingMode)stage.setCameraAngle(0);
  const idle=motionsForCharacter(project,item.id).find(motion=>motion.id===item.detailsIdleId)||null;
  await stage.show(asset(item.modelId), idle, {}, 'center',
    { size: 1, yaw: 0 }, `gallery:${item.id}`,{loop:true,placement:'inPlace',feet:'lock'},'',{bindings:item.props||[],visibleIds:(item.props||[]).map(p=>p.id),assets:project.assets});
  if (activePanel === 'characters' && project.characters[selectedCharacter]?.id === item.id) {
    const record=stage.visibleRecords.get(`gallery:${item.id}`);
    const key=`gallery:${item.id}`,old=editorGalleryKeys.indexOf(key);if(old>=0)editorGalleryKeys.splice(old,1);editorGalleryKeys.push(key);while(editorGalleryKeys.length>3)await stage.releaseModel(editorGalleryKeys.shift());
    if(bindingMode)stage.bindingView.enable(record,`gallery:${item.id}`);
    for(const select of document.querySelectorAll('[data-prop-field=bone]')){const value=select.value;select.innerHTML=availablePropBones(record).map(b=>`<option value="${escape(b.value)}">${escape(b.label)}</option>`).join('');select.value=value;}
    if(!idle&&!record.detailIdleInstalled){record.idleClip=createDetailIdle(record);record.detailIdleInstalled=true;record.currentMotionToken='';stage.poseRecord(record,null,null,false,{loop:true,placement:'inPlace',feet:'lock'});}
  }
}
function refreshCharacterGallery(root,editor=false){
 const data=editor?{item:project.characters[selectedCharacter],count:Infinity}:galleryCharacterData(),item=data.item;if(!item)return;
 const index=editor?editorGalleryStoryIndex:galleryStoryIndex,unlocked=editor||hasDiscovered('character',item.id),action=editor?'preview-story':'gallery-story';
 if(editor&&root.querySelector('.editor-role-preview-layout')){root.querySelector('#gallery-character-text').innerHTML=galleryStoryMarkup(item,Infinity,0,true);root.querySelector('.editor-role-stories').innerHTML='<h3>角色故事</h3>'+(item.stories||[]).filter(story=>story.text?.trim()).map((story,i)=>`<h4>故事 ${i+1}</h4><p class="gallery-character-text">${escape(story.text)}</p>`).join('');return;}
 for(const button of root.querySelectorAll('.gallery-character-picker button'))button.classList.toggle('active',button.dataset.characterId===item.id);
 const text=root.querySelector('#gallery-character-text');if(text)text.innerHTML=galleryStoryMarkup(item,data.count,index,editor);
 const tabs=root.querySelector('.gallery-story-tabs');if(tabs)tabs.innerHTML=button('角色详情',action,`data-index="0" class="${index===0?'active':''}"`)+(item.stories||[]).map((story,i)=>story.text?.trim()?button(`角色故事 · ${i+1}${data.count>=Math.max(0,Number(story.unlockLines)||0)?'':' 🔒'}`,action,`data-index="${i+1}"`):'').join('');
 const note=root.querySelector('.gallery-progress-note');if(note)note.textContent=editor?'编辑预览 · 作者可查看全部角色故事':unlocked?`累计看过这位角色的 ${data.count} 句对白`:'尚未在故事中遇见这位角色';
 const portrait=root.querySelector('.gallery-character-portrait');if(portrait){portrait.classList.toggle('locked',!unlocked);portrait.querySelector('.gallery-character-seal')?.remove();if(!unlocked)portrait.insertAdjacentHTML('beforeend','<div class="gallery-character-seal">未解锁</div>');}
}
function galleryLoadStatus(busy,item,error){const portrait=document.querySelector('#player-modal .gallery-character-portrait');if(!portrait)return;let node=portrait.querySelector('.gallery-load-notice');if(!node){node=document.createElement('div');node.className='gallery-load-notice';node.setAttribute('role','status');node.innerHTML='<i aria-hidden="true"></i><span></span>';portrait.append(node);}node.hidden=!busy&&!error;node.classList.toggle('failed',Boolean(error));node.querySelector('span').textContent=error?'加载失败，请再点一次人物':busy?'正在切换到 '+(item?.name||'人物')+'…':'';}
function ensureGalleryViewer(target){
 if(galleryStage){if(galleryStage.element.parentElement!==target){target.appendChild(galleryStage.element);galleryStage.resize();}return;}
 const host=document.createElement('div');host.className='gallery-render-host';target.appendChild(host);const viewer=galleryStage=new VRMStage(host,error=>galleryLoadStatus(false,null,Error(error)));viewer.setRenderSettings(project.render);viewer.setPortraitCamera();
 galleryCache=new GalleryCache({limit:3,status:(busy,value,error)=>galleryLoadStatus(busy,value?.item,error),load:async value=>{await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,20)));if(galleryStage!==viewer)throw Error('?????');const record=await viewer.loadModel(value.model,value.key);if(!record)throw Error('人物模型不可用');if(value.motion)await viewer.prepareClip(value.model,value.motion,value.key);viewer.renderSuspended=true;try{await viewer.warmPreparedGraphics({stage:viewer,environment:viewer.environmentRuntime,camera:viewer.camera},async()=>{if(galleryStage!==viewer)throw Error('?????');});}finally{if(galleryStage===viewer)viewer.renderSuspended=saveModalMode!=='gallery'||galleryTab!=='characters'||!viewer.element.isConnected||viewer.element.style.display==='none';}return record;},show:async(value,record,valid)=>{if(!valid()||galleryStage!==viewer||galleryTab!=='characters'||saveModalMode!=='gallery')return;viewer.element.style.display='';viewer.renderSuspended=false;await viewer.show(value.model,value.motion,{},'center',{size:1.23,yaw:value.item.galleryYaw||0},value.key);if(valid()&&galleryStage===viewer&&value.motion)viewer.setMotionPoseFrame(value.item.galleryPoseFrame);},evict:async(key,value)=>{await viewer.releaseModel(key);const kept=new Set([...galleryCache?.cache.values()||[]].map(v=>v.value.motion?.id));for(const id of viewer.motionCache.keys())if(!kept.has(id))await viewer.releaseMotion(id);}});
}
function selectGalleryCharacter(){
 const target=document.querySelector('#player-modal #gallery-character-canvas'),item=galleryCharacterData().item;if(!target||!item)return Promise.resolve(false);refreshCharacterGallery(document.querySelector('#player-modal'));
 target.querySelector('.gallery-flat-portrait')?.remove();const unlocked=hasDiscovered('character',item.id);
 if(!unlocked||!item.modelId){galleryCache?.cancel();if(galleryStage){galleryStage.renderSuspended=true;galleryStage.element.style.display='none';}if(unlocked&&asset(item.portraitId))target.insertAdjacentHTML('beforeend',`<img class="gallery-flat-portrait" src="${escape(assetUrl(asset(item.portraitId)))}" alt="${escape(item.name)}">`);return Promise.resolve(true);}
 ensureGalleryViewer(target);galleryStage.requestNumber++;galleryStage.element.style.display='';galleryStage.renderSuspended=false;const model=asset(item.modelId),motion=asset(item.galleryMotionId),key='gallery:'+item.id;
 return gallerySelection=galleryCache.select(key,{key,item,model,motion,fingerprint:JSON.stringify([model?.id,motion?.id])});
}
function renderGalleryModal() {
  if(galleryTab==='characters'){openRoleDetails();return;}
  clearAutoAdvance();
  saveModalMode = 'gallery';if(stage)stage.renderSuspended=true;
  galleryCache?.cancel();if(galleryStage){galleryStage.renderSuspended=true;galleryStage.element.remove();}
  const content = galleryTab === 'images' ? galleryImageMarkup()
    : galleryTab === 'music' ? galleryMusicMarkup() : galleryTab==='items'?itemGalleryMarkup():galleryCharacterMarkup();
  document.querySelector('#player-modal')?.remove();
  document.querySelector('.player .stage-frame').insertAdjacentHTML('beforeend', `<section id="player-modal" class="player-modal gallery-modal" role="dialog" aria-modal="true" aria-label="附加鉴赏">
    <div class="modal-box gallery-box ${galleryTab === 'characters' ? 'gallery-box-character' : ''}"><header><div><small>EXTRAS</small><h2>附加鉴赏</h2></div>${button('关闭 ×', 'close-modal')}</header>
      <div class="gallery-main-tabs">${[['images','图像鉴赏'],['music','乐曲鉴赏'],['items','物品鉴赏']].map(([key,label]) =>
        button(label, 'gallery-tab', `data-tab="${key}" class="${galleryTab === key ? 'active' : ''}"`)).join('')}</div>
      <div class="gallery-content">${content}</div>
    </div></section>`);
  document.querySelector('#player-modal .gallery-character-picker .active')?.scrollIntoView({ block: 'nearest' });
  if (galleryTab === 'music') renderGalleryMusicState();
  if (galleryTab === 'characters') {
    const target = document.querySelector('#gallery-character-canvas');
    const item = galleryCharacterData().item;
    if (target && item && !item.modelId && hasDiscovered('character', item.id) && asset(item.portraitId))
      target.innerHTML = `<img class="gallery-flat-portrait" src="${assetUrl(asset(item.portraitId))}" alt="${escape(item.name)}">`;
    gallerySelection=selectGalleryCharacter();
  }
}
function progressStatistics() {
  const progress = loadLifetimeProgress();
  const exact = line => Boolean(line.id && progress.viewedDialogueText[line.id] === String(line.text || ''));
  const lines = project.acts.filter(item => !isEvent(item)).flatMap(item => item.steps.filter(line => String(line.text || '').trim()));
  const seen = lines.filter(exact).length;
  const characters = project.characters.map(character => {
    const own = lines.filter(line => line.characterId === character.id);
    return { id: character.id, name: hasDiscovered('character', character.id) ? character.name : hiddenName(character.name),
      total: own.length, seen: own.filter(exact).length };
  });
  let chapterNumber = 0;
  const acts = project.acts.flatMap((item, nodeIndex) => {
    if (isEvent(item)) return [];
    const index = chapterNumber++;
    const own = item.steps.filter(line => String(line.text || '').trim());
    const read = own.filter(exact).length;
    const status = own.length && read === own.length ? 'complete'
      : own.length && read > 0 && progress.lastActId === item.id ? 'current' : 'pending';
    return [{ index: index + 1, nodeIndex, name: item.name, total: own.length, seen: read, status,
      unlocked: chapterUnlocked(item, index, progress), cover: asset(item.coverImageId) || asset(item.backgroundId) }];
  });
  return { total: lines.length, seen, characters, acts };
}
function renderProgressModal() {
  clearAutoAdvance();
  saveModalMode = 'progress';
  const stats = progressStatistics();
  const percent = (seen, total) => total ? `${Math.round(seen / total * 100)}%` : '0%';
  document.querySelector('#player-modal')?.remove();
  document.querySelector('.player .stage-frame').insertAdjacentHTML('beforeend', `<section id="player-modal" class="player-modal progress-modal" role="dialog" aria-modal="true" aria-label="游玩进度">
    <div class="modal-box progress-box chapter-box"><header><div><small>STORY PROGRESS</small><h2>游玩进度 · 章节选择</h2></div><div class="chapter-header-actions"><div class="chapter-total"><small>总体进度</small><strong>${percent(stats.seen, stats.total)}</strong><span>已读 ${stats.seen} / ${stats.total} 句</span></div>${button('关闭 ×', 'close-modal')}</div></header>
      <div class="chapter-body"><div class="chapter-content"><div class="chapter-toolbar"><div><h3>选择章节</h3><p>左右滑动选择，点击已解锁的封面从头游玩。</p></div><div>${button('‹', 'chapter-scroll', 'data-direction="-1" aria-label="上一组章节"')}${button('›', 'chapter-scroll', 'data-direction="1" aria-label="下一组章节"')}</div></div>
      <div id="chapter-rail" class="chapter-rail" tabindex="0" aria-label="左右滑动选择章节">${stats.acts.map(item => `<button id="chapter-card-${item.nodeIndex}" class="chapter-card ${item.unlocked ? '' : 'locked'}" data-action="chapter-replay" data-index="${item.nodeIndex}" ${!item.unlocked || !project.acts[item.nodeIndex].steps.length ? 'disabled' : ''}>
        <div class="chapter-art">${item.cover?.type === 'image' ? `<img src="${escape(assetUrl(item.cover))}" alt="${escape(item.name)}封面" draggable="false">` : `<div class="chapter-cover-placeholder"><small>CHAPTER</small><strong>${String(item.index).padStart(2,'0')}</strong></div>`}
        </div><div class="chapter-card-caption"><div class="chapter-caption-heading"><small>第 ${item.index} 章</small><b>${percent(item.seen,item.total)}</b></div><h3>${escape(item.name)}</h3><div class="chapter-progress"><div><i style="width:${percent(item.seen,item.total)}"></i></div></div><span>${item.seen} / ${item.total} 句 · ${!item.unlocked ? '🔒 尚未解锁' : item.status === 'complete' ? '✓ 已完成' : '可以游玩'}</span><span>${!item.unlocked ? '先在故事中到达这一幕' : !project.acts[item.nodeIndex].steps.length ? '暂无对白' : '点击从头游玩'}</span></div></button>`).join('')}</div>
      <details class="chapter-character-stats"><summary>各角色台词进度</summary><div class="chapter-character-grid">${stats.characters.map(item => `<div class="progress-character-row"><span>${escape(item.name)}</span><b>${percent(item.seen,item.total)}</b><small>${item.seen} / ${item.total} 句</small></div>`).join('') || '<p>还没有角色台词。</p>'}</div></details></div></div>
    </div></section>`);
  const rail = document.querySelector('#chapter-rail');
  rail.addEventListener('wheel', event => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && rail.scrollWidth > rail.clientWidth) {
      const next = Math.max(0, Math.min(rail.scrollWidth - rail.clientWidth, rail.scrollLeft + event.deltaY));
      if (next !== rail.scrollLeft) { event.preventDefault(); rail.scrollLeft = next; }
    }
  }, { passive: false });
  let drag = null;
  rail.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { x: event.clientX, left: rail.scrollLeft, moved: false };
  });
  rail.addEventListener('pointermove', event => {
    if (!drag || !(event.buttons & 1)) return;
    if (Math.abs(event.clientX - drag.x) > 8) {
      drag.moved = true; rail.classList.add('dragging'); rail.setPointerCapture(event.pointerId);
      rail.scrollLeft = drag.left - (event.clientX - drag.x);
    }
  });
  rail.addEventListener('click', event => { if (drag?.moved) { event.preventDefault(); event.stopPropagation(); } }, true);
  rail.addEventListener('pointerup', () => { rail.classList.remove('dragging'); setTimeout(() => { drag = null; }, 0); });
  rail.addEventListener('pointercancel', () => { drag = null; rail.classList.remove('dragging'); });
  const active = Math.max(0, project.acts.findIndex(item => item.id === loadLifetimeProgress().lastActId));
  requestAnimationFrame(() => document.querySelector(`#chapter-card-${active}`)?.scrollIntoView({ block: 'nearest', inline: 'center' }));
}
function renderImageImportModal(folderId = '', titleImport = '') {
  document.querySelector('#image-import-modal')?.remove();
  document.querySelector('.editor')?.insertAdjacentHTML('beforeend', `<div id="image-import-modal" class="editor-settings-backdrop" role="dialog" aria-modal="true" aria-label="导入图片">
    <div class="editor-settings-card"><header><h2>导入图片</h2>${button('关闭 ×', 'cancel-image-import')}</header>
      <label class="gallery-audio-check image-import-option"><input id="image-import-gallery" type="checkbox"><span>加入图像鉴赏</span></label>
      <p>背景、界面等普通图片通常不用加入鉴赏。以后可以在“素材”里修改。</p>
      <div class="image-import-actions">${button('选择图片并导入', 'confirm-image-import', `class="primary" data-folder-id="${escape(folderId)}" data-title-import="${escape(titleImport)}"`)}</div>
    </div></div>`);
}
async function importAssets(type, folderId = '', titleImport = '', galleryImage = false) {
  if (type === 'voice') { redirectVoiceUpload(); return; }
  const imported = await bridge('importAsset', {type:['music','effect'].includes(type)?'audio':type});
  if (!imported?.length) return;
  for (const item of imported) {
    item.folderId = type==='motion'?(folderId||commonMotionFolderId):folderId;
    if(['music','effect'].includes(type))item.audioKind=type;
    if (type === 'image') item.galleryImage = galleryImage;
  }
  if (folderId) openAssetFolders.add(folderId);
  if (titleImport === 'modelId') project.title.actors.push(...imported.filter(model=>['vrm','fbxCharacter','mmdCharacter'].includes(model.type)).map((model,index)=>newTitleActor(uid(),model.id,project.title.actors.length+index)));
  else if(titleImport==='motionId'){const actor=project.title.actors.at(-1);if(actor)actor.motionId=imported[0].id;}
  else if (titleImport) project.title[titleImport] = imported[0].id;
  project.assets.push(...imported); markDirty(); renderSidebar(); renderInspector(); toast(`已导入 ${imported.length} 个素材`);
  if (activePanel === 'title') updatePreview();
  return imported;
}
function renderPlayer() {
  roleDetails.close(false);
  dialogueCamera?.dispose();dialogueCamera=null;
  previewResizer?.dispose();previewResizer=null;
  events.cancel();
  stage?.destroy();
  if (!project) { app.innerHTML = '<div class="fatal">游戏工程文件不完整</div>'; return; }
  app.innerHTML = `<div class="player" data-game-ui="${normalizeGameUi(project.ui.gameTheme)}"><div class="stage-frame">
    <div id="scene-bg"></div><div id="stage-canvas"></div><div id="stage-placeholder"></div>
    <div id="speaker-portrait" class="speaker-portrait hidden"><img alt="说话角色头像"></div>
    <div id="dialogue" class="dialogue"><div class="speaker" id="dialogue-speaker"></div><div id="dialogue-text"></div></div>
    <div id="choice-list"></div><div id="play-controls" class="hidden">
      <div class="scene-top-actions">
        <button type="button" data-action="stop-play" class="scene-icon-button" title="返回标题" aria-label="返回标题"><span class="scene-icon">↶</span><small>标题</small></button>
        <button type="button" data-action="save-game" class="scene-icon-button" title="存档" aria-label="存档"><span class="scene-icon">▣</span><small>存档</small></button>
        <button type="button" data-action="settings" class="scene-icon-button" title="设置" aria-label="设置"><span class="scene-icon">☰</span><small>菜单</small></button>
      </div>
      <div class="scene-quick-actions">
        <button type="button" id="auto-play-button" class="auto-play-button hidden" data-action="auto-toggle" aria-pressed="false" title="自动播放">自动播放</button>
        <button type="button" data-action="load-game" title="读档">读档</button>
        <button type="button" data-action="save-game" title="存档">存档</button>
        <button type="button" data-action="open-inventory" title="物品栏">物品栏</button>
        ${window.__vrmAndroid?'':`<button type="button" data-action="toggle-fullscreen" title="切换全屏">${playerFullscreen ? '窗口' : '全屏'}</button>`}
      </div>
    </div>
    <div id="player-start" class="title-composition"></div>
    <div id="act-loading" class="act-loading hidden">${loadingSpinner}</div>
          <div id="game-fps" class="game-fps hidden" aria-label="当前帧数">— FPS</div>
  </div></div>`;
  stageError = '';
  stage = new VRMStage(document.querySelector('#stage-canvas'), message => {
    stageError = message;
    const placeholder = document.querySelector('#stage-placeholder');
    if (placeholder && !stage?.vrm) {
      placeholder.textContent = message;
      placeholder.style.display = 'grid';
    }
    toast(message, true);
  });
  stage.sceneAnimationsPaused=()=>Boolean(saveModalMode||document.hidden);
  stage.setRenderSettings(project.render);
  setupDialogueCamera();
  setupPlayerGraphics();
  showTitleScene(true);
}

document.addEventListener('click', async event => {
  const clickedButton = event.target.closest?.('button');
  if (mode === 'player' && clickedButton && !clickedButton.disabled) playButtonClick();
  const panel = event.target.closest('[data-panel]');
  if (panel && project) {
    activePanel = panel.dataset.panel;
    renderSidebar(); renderInspector(); updatePreview(); return;
  }
  const node = event.target.closest('[data-action]');
  if (!node) {
    if (playing && !saveModalMode && event.target.closest('.stage-frame')
      && !event.target.closest('#choice-list, #play-controls, #player-start, #player-modal, #world-event')) next();
    return;
  }
  const action = node.dataset.action;
  if(action==='game-ui'&&mode==='editor'){renderGameUiPicker();return;}
  if(action==='close-game-ui'){document.querySelector('#game-ui-picker')?.remove();document.querySelector('[data-action="game-ui"]')?.focus();return;}
  if(action==='apply-game-ui'&&mode==='editor'){
    const value=normalizeGameUi(document.querySelector('#game-ui-picker input:checked')?.value);
    if(project.ui.gameTheme!==value){project.ui.gameTheme=value;markDirty();renderAssetDock();}
    document.querySelector('#game-ui-picker')?.remove();document.querySelector('[data-action="game-ui"]')?.focus();toast('游戏 UI 已应用；点击试玩查看完整效果。');return;
  }
  if(action==='edit-dialogue-camera'){await beginDialogueCameraEdit();return;}
  if(action==='clear-dialogue-camera'){delete step().camera;markDirty();renderInspector();updatePreview();return;}
  if(action==='restart-character-preview'){try{for(const record of stage?.visibleRecords.values()||[])record.currentMotionToken='';await updatePreview();stage?.restartCharacterPreview();}catch(error){toast(error.message,true);}return;}
  if(action==='open-module'){try{await openEditorModule(node.dataset.module);}catch(error){toast(error.message,true);}return;}
  if (new URLSearchParams(location.search).has('smoke')) window.__lastClickAction = action;
  try {
    if(action==='apply-graphics'){await applyPlayerGraphics(graphicsDraft);return;}
    if(action==='reset-graphics'){await applyPlayerGraphics(normalizeGraphics());return;}
    if(action==='edit-scene-animations'){const catalog=sceneAnimationCatalog();sceneAnimationDialog.open({catalog,assets:project.assets,cues:step()?.sceneAnimations,owner:{actId:act()?.id,stepId:step()?.id}});return;}
    if (action.startsWith('assistant-')) { await storyAssistant.click(action,node); return; }
    if (action === 'upload-dialogue-voice') { await uploadDialogueVoice(); return; }
    if (action === 'preview-dialogue-voice' || action === 'preview-voice-asset') { await previewDialogueVoice(action === 'preview-dialogue-voice' ? step()?.voiceId : node.dataset.assetId); return; }
    if(action==='add-inventory-item'){project.items.push({id:uid(),name:`物品${project.items.length+1}`,description:'',imageId:''});selectedItem=project.items.length-1;markDirty();renderSidebar();renderInspector();return;}
    if(action==='select-inventory-item'){selectedItem=Number(node.dataset.index);renderSidebar();renderInspector();return;}
    if(action==='upload-inventory-image'){await uploadInventoryImage();return;}
    if(action==='delete-inventory-item'){const item=project.items[selectedItem];if(!item||!confirm('删除这个物品？引用它的对白和分支需要重新设置。'))return;project.items.splice(selectedItem,1);selectedItem=Math.max(0,selectedItem-1);markDirty();renderSidebar();renderInspector();return;}
    if(action==='add-inventory-grant'||action==='add-inventory-condition'){const item=readyItems()[0];if(!item){toast('先在物品页补全名字、立绘和介绍。',true);return;}const holder=action==='add-inventory-grant'?step():step().choices[Number(node.dataset.choice)],key=action==='add-inventory-grant'?'itemGrants':'requirements';holder[key]||=[];holder[key].push({itemId:item.id,quantity:1});markDirty();renderInspector();return;}
    if(action==='remove-inventory-row'){const holder=node.dataset.kind==='grant'?step():step().choices[Number(node.dataset.choice)],key=node.dataset.kind==='grant'?'itemGrants':'requirements';holder[key].splice(Number(node.dataset.row),1);markDirty();renderInspector();return;}
    if(action==='confirm-item-reward'){playerInventory.pending.shift();document.querySelector('#inventory-reward')?.remove();saveModalMode='';if(!showItemReward()){refreshChoiceItems();scheduleAutoAdvance(project.acts[playAct]?.steps[playStep]);}return;}
    if(action==='open-inventory'){if(saveModalMode==='item-reward')return;renderBackpack();return;}
    if(action==='inventory-detail'){renderItemDetail(node.dataset.itemId);return;}
    if(action==='inventory-gallery-back'){galleryTab='items';renderGalleryModal();return;}
    if (action === 'remove-dialogue-voice') { if (step()) { stopEditorVoicePreview(); step().voiceId = ''; markDirty(); renderInspector(); renderAssetDock(); } return; }
    if (action === 'delete-asset-folder' && project.assetFolders.find(folder => folder.id === node.dataset.folderId)?.locked) { toast('角色和通用动作等固定文件夹不能删除。', true); return; }
    if (action === 'editor-undo' || action === 'editor-redo') { await restoreEditorHistory(action === 'editor-undo' ? -1 : 1); return; }
    if (action.startsWith('event-')) { await handleEventAction(action, node); return; }
    if (action.startsWith('book-') || action.startsWith('search-') || action === 'knowledge-open') {
      await library.click(action, node); return;
    }
    if (action === 'asset-tab') {
      activeAssetType = node.dataset.type;
      document.querySelector('#asset-dock-body').scrollTop = 0;
      renderAssetDock();
    } else if (action === 'asset-open-folder') {
      currentAssetFolder[activeAssetType] = node.dataset.folderId;
      document.querySelector('#asset-dock-body').scrollTop = 0;
      renderAssetDock();
    } else if (action === 'asset-folder-back') {
      currentAssetFolder[activeAssetType] = '';
      document.querySelector('#asset-dock-body').scrollTop = 0;
      renderAssetDock();
    } else if (action === 'new-project') {
      if (dirty) await save();
      const name = document.querySelector('#new-name')?.value || '新游戏';
      const info = await bridge('newProject', { name });
      if (!info) return;
      directory = info.directory;
      project = defaultProject(name);
      if (info.presetAssets?.length) {
        project.assetFolders.push({ id: 'preset-motion-folder', type: 'motion', name: 'Mixamo动作库' });
        project.assets.push(...info.presetAssets);
        openAssetFolders.add('preset-motion-folder');
      }
      editorHistory.reset();
      await save();
      window.location.reload();
    } else if (action === 'open-project') {
      if (dirty) await save();
      const info = await bridge('openProject');
      if (!info) return;
      window.location.reload();
    } else if (action === 'recent-projects') renderRecentProjectsModal();
    else if (action === 'close-recent-projects') document.querySelector('#recent-projects-modal')?.remove();
    else if (action === 'open-recent') {
      if (dirty) await save();
      const path = recentProjects[Number(node.dataset.index)];
      if (!path) return;
      await bridge('openRecentProject', { path });
      window.location.reload();
    } else if (action === 'save') { await save(); toast('工程已保存'); }
    else if (action === 'save-as') {
      await save();
      const entered = prompt('新工程包叫什么名字？旧工程会保留。', project.name);
      if (entered === null) return;
      const name = entered.trim();
      if (!name) { toast('工程名字不能为空', true); return; }
      const copy = structuredClone(project);
      copy.name = name;
      copy.id = uid();
      const result = await bridge('saveProjectAs', { project: copy, name });
      if (!result) return;
      directory = result.directory;
      window.location.reload();
    }
    else if(action==='new-environment'){const owner=activePanel==='title'?project.title:act();const old=owner.environmentId;owner.environmentId='';try{await editEnvironment(owner);}catch(error){owner.environmentId=old;renderInspector();throw error;}}
    else if (action === 'edit-environment') await editEnvironment(activePanel==='title'?project.title:act());
    else if (action === 'editor-settings') renderEditorSettings();
    else if (action === 'toggle-editor-theme') {
      editorSettings.theme = editorSettings.theme === 'dark' ? 'light' : 'dark';
      saveEditorSettings(); applyEditorTheme();
      const select = document.querySelector('#editor-theme');
      if (select) select.value = editorSettings.theme;
    }
    else if (action === 'close-editor-settings') document.querySelector('#editor-settings-modal')?.remove();
    else if(action==='export')showExportChooser();
    else if(action==='close-export'){document.querySelector('#export-game-modal')?.remove();document.querySelector('#android-export-settings')?.remove();}
    else if(['export-android','start-android-export'].includes(action))throw Error('此版本已移除安卓导出');
    else if (action === 'export-windows') {
      document.querySelector('#export-game-modal')?.remove();
      validateInventoryProject(project);
      await save();
      const entered = prompt('导出的游戏文件夹叫什么名字？\n模型、图片、声音和剧情将自动放入加密资源包。', `${project.name}_可游玩版`);
      if (entered === null) return;
      const folderName = entered.trim();
      if (!folderName) { toast('文件夹名字不能为空', true); return; }
      const result = await bridge('exportGame', { folderName });
      if (result) toast('已导出加密游戏到：' + result.directory);
    } else if (action === 'add-act') {
      project.acts.push({ id: uid(), name: `第${project.acts.length + 1}幕`, backgroundId: '', bgmId: '', weather: normalizeWeather(),
        coverImageId: '', render: chapterRender(null, project.render),
        steps: [] });
      selectedAct = project.acts.length - 1; selectedStep = 0; markDirty(); renderSidebar(); renderInspector(); updatePreview();
    } else if (action === 'upload-act-cover') {
      await uploadActCover();
    } else if (action === 'edit-act-render') {
      activePanel = 'render'; renderSidebar(); renderInspector(); updatePreview();
    } else if (action === 'reset-act-color') {
      Object.assign(act().render,colorDefaults);
      markDirty(); renderInspector(); updatePreview();
    } else if (action === 'select-act') {
      selectedAct = Number(node.dataset.index); selectedStep = 0; renderSidebar(); renderInspector(); updatePreview();
      const editor=document.querySelector('.story-left .inspector');if(editor)editor.scrollTop=0;
    } else if (action === 'delete-act') {
      if (project.acts.length <= 1) { toast('至少保留一幕', true); return; }
      if (!confirm('删除这一幕及其中的对白？')) return;
      project.acts.splice(selectedAct, 1); selectedAct = Math.max(0, selectedAct - 1); selectedStep = 0;
      markDirty(); renderSidebar(); renderInspector(); updatePreview();
    } else if (action === 'add-step') {
      act().steps.push(createNextDialogue(act().steps.at(-1),uid()));
      selectedStep = act().steps.length - 1; markDirty(); renderSidebar(); renderInspector(); updatePreview();
      document.querySelector('.story-left .inspector')?.scrollTo(0,0);document.querySelector('[data-field="step.text"]')?.focus({preventScroll:true});
    } else if (action === 'duplicate-step') {
      const original = step();
      if (!original) { toast('先选中一句对白', true); return; }
      const copy = structuredClone(original);
      copy.id = uid();
      act().steps.splice(selectedStep + 1, 0, copy);
      selectedStep++;
      markDirty(); renderSidebar(); renderInspector(); updatePreview();
      const dialogueInput = document.querySelector('[data-field="step.text"]');
      dialogueInput?.focus(); dialogueInput?.select();
      toast('已复制这一句，可直接修改选中的台词');
    } else if (action === 'select-step') {
      selectedStep = Number(node.dataset.index); renderSidebar(); renderInspector(); updatePreview();
      const editor=document.querySelector('.story-left .inspector');if(editor)editor.scrollTop=0;
    } else if (action === 'delete-step') {
      if (!confirm('删除这句对白？')) return;
      act().steps.splice(selectedStep, 1); selectedStep = Math.max(0, selectedStep - 1);
      markDirty(); renderSidebar(); renderInspector(); updatePreview();
    } else if (action === 'move-up' || action === 'move-down') {
      const target = selectedStep + (action === 'move-up' ? -1 : 1);
      if (target < 0 || target >= act().steps.length) return;
      [act().steps[selectedStep],act().steps[target]] = [act().steps[target],act().steps[selectedStep]];
      selectedStep = target; markDirty(); renderSidebar(); renderInspector();
    } else if (action === 'add-character') {
      project.characters.push({ id:uid(), name:`角色${project.characters.length + 1}`, autoMouth:true, modelId:'', portraitId:'', title:'', description:'',
        galleryMotionId: project.assets.some(item => item.id === 'preset-mixamo-029') ? 'preset-mixamo-029' : '',
        galleryYaw: 0, galleryPoseFrame: 1,
        stories: Array.from({ length: 3 }, () => ({ text:'', unlockLines:0 })) });
      selectedCharacter = project.characters.length - 1; editorGalleryStoryIndex = 0;
      markDirty(); renderSidebar(); renderInspector();
    } else if (action === 'select-character') {
      selectedCharacter = Number(node.dataset.index); editorGalleryStoryIndex = 0;
      renderSidebar(); renderInspector();
    } else if (action === 'preview-character') {
      selectedCharacter = project.characters.findIndex(item => item.id === node.dataset.characterId);
      if (selectedCharacter < 0) return;
      editorGalleryStoryIndex = 0;
      renderSidebar(); renderInspector();
    } else if (action === 'preview-story') {
      editorGalleryStoryIndex = Number(node.dataset.index) || 0;
      const item = project.characters[selectedCharacter];
      const content = document.querySelector('#character-preview #gallery-character-text');
      if (content) content.innerHTML = galleryStoryMarkup(item, Infinity, editorGalleryStoryIndex, true);
      document.querySelectorAll('#character-preview [data-action="preview-story"]').forEach(button =>
        button.classList.toggle('active', Number(button.dataset.index) === editorGalleryStoryIndex));
    } else if(action.startsWith('binding-view-')){
      const item=project.characters[selectedCharacter];if(!item?.modelId)return;
      if(action==='binding-view-close'){propPreviewMode=false;await updatePreview();return;}
      propPreviewMode=true;await updatePreview();
      const record=stage.visibleRecords.get(`gallery:${item.id}`);if(!record)return;
      if(node.dataset.propId)selectedBindingPropId=node.dataset.propId;
      const prop=item.props.find(p=>p.id===selectedBindingPropId)||item.props[0];
      if(action==='binding-view-reset')stage.bindingView.focusModel(record);
      else if(action==='binding-view-bone'&&prop)stage.bindingView.focusBone(propBone(record,prop.bone));
      else if(action==='binding-view-item'&&prop)stage.bindingView.focusItem(record.attachedProps?.get(prop.id)?.root);
    } else if (action === 'import-prop-model') {
      const imported=await importAssets('sceneModel');
      if(imported?.length)toast('物品已导入，点击“＋ 添加物品”即可绑定。');
    } else if (action === 'add-character-prop') {
      const item=project.characters[selectedCharacter],model=byType('sceneModel').at(-1);
      if(!item?.modelId){toast('先给角色选择 VRM 或 FBX 人物模型。',true);return;}
      if(!model){toast('先点击“导入物品 GLB”。',true);return;}
      item.props ||= [];item.props.push({id:uid(),name:model.name,assetId:model.id,bone:'rightHand',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]});
      markDirty();renderInspector();updatePreview();
    } else if (action === 'remove-character-prop') {
      const item=project.characters[selectedCharacter];item.props=(item.props||[]).filter(p=>p.id!==node.dataset.propId);
      for(const act of project.acts)for(const line of act.steps)for(const value of Object.values(line.cast||{}))value.props=(value.props||[]).filter(id=>id!==node.dataset.propId);
      markDirty();renderInspector();updatePreview();
    } else if (action === 'delete-character') {
      if (!confirm('删除这个角色？已有对白会变成旁白。')) return;
      const deletedId=project.characters[selectedCharacter].id;
      for(const act of project.acts)for(const line of act.steps){if(line.characterId===deletedId)line.characterId='';for(const value of Object.values(line.cast||{}))if(value.characterId===deletedId){value.characterId='';value.props=[];}}
      project.characters.splice(selectedCharacter, 1); selectedCharacter = Math.max(0, selectedCharacter - 1);
      markDirty(); renderSidebar(); renderInspector(); updatePreview();
    } else if (action === 'import') {
      if (node.dataset.type === 'image') renderImageImportModal(node.dataset.folderId || '', node.dataset.titleImport || '');
      else await importAssets(node.dataset.type, node.dataset.folderId || '', node.dataset.titleImport || '');
    } else if (action === 'upload-character-portrait') {
      const item = project.characters[selectedCharacter];
      if(isLiveModel(item?.modelId)){toast('VRM 和 MMD 固定使用可动模型头像，无需上传图片。');return;}
      const imported = await bridge('importAsset', { type:'image', single:true });
      if (item && imported?.length) {
        imported[0].galleryImage = false;
        project.assets.push(imported[0]); item.portraitId = imported[0].id; item.portraitSource = 'manual'; item.portraitPoseKey = '';
        markDirty(); renderSidebar(); renderInspector(); updatePreview();
      }
    } else if (action === 'capture-character-portrait') {
      const item = project.characters[selectedCharacter];
      if(isLiveModel(item?.modelId))return;
      if (item?.modelId) await ensureCharacterPortrait(item, true, true);
    } else if (action === 'cancel-image-import') {
      document.querySelector('#image-import-modal')?.remove();
    } else if (action === 'confirm-image-import') {
      const galleryImage = Boolean(document.querySelector('#image-import-gallery')?.checked);
      document.querySelector('#image-import-modal')?.remove();
      await importAssets('image', node.dataset.folderId || '', node.dataset.titleImport || '', galleryImage);
    } else if (action === 'add-asset-folder') {
      const type = node.dataset.type;
      if(type==='motion'){toast('动作使用自动创建的角色文件夹和通用文件夹。',true);return;}
      if (type === 'voice') { redirectVoiceUpload(); return; }
      const name = prompt('新文件夹叫什么名字？', '新文件夹')?.trim();
      if (!name) return;
      if (project.assetFolders.some(folder => folder.type === type && folder.name.toLowerCase() === name.toLowerCase())) {
        toast('这个分类里已有同名文件夹', true); return;
      }
      const folder = {id:uid(),type:['music','effect'].includes(type)?'audio':type,name:name.slice(0,64),...(['music','effect'].includes(type)?{audioKind:type}:{})};
      project.assetFolders.push(folder);
      currentAssetFolder[type] = folder.id;
      markDirty(); renderSidebar();
    } else if (action === 'rename-asset-folder') {
      const folder = project.assetFolders.find(item => item.id === node.dataset.folderId);
      if (!folder) return;
      if (folder.locked) { toast('固定文件夹跟随角色名字，不能单独改名。', true); return; }
      const name = prompt('修改文件夹名字', folder.name)?.trim();
      if (!name || name === folder.name) return;
      if (project.assetFolders.some(item => item !== folder && item.type === folder.type && item.name.toLowerCase() === name.toLowerCase())) {
        toast('这个分类里已有同名文件夹', true); return;
      }
      folder.name = name.slice(0, 64);
      markDirty(); renderSidebar();
    } else if (action === 'delete-asset') {
      const item = asset(node.dataset.assetId);
      if (!item) return;
      if(project.characters.some(c=>c.props?.some(p=>p.assetId===item.id))){toast('这个模型已绑定为角色物品，请先到角色页移除绑定。',true);return;}
      if(project.environments?.some(e=>e.nodes.some(n=>n.assetId===item.id))){toast('这个素材正在 3D 场景里使用，请先从场景中移除对应物体。',true);return;}
      const used = JSON.stringify({ ...project, assets: [] }).includes(JSON.stringify(item.id));
      if (!confirm(item.type === 'voice' ? `删除这段配音？引用它的对白会变成无配音，可用撤销找回。\n\n${item.name}` : used ? `“${item.name}”正在工程中使用。删除后，对应的模型、动作或画面会失效。确定删除吗？`
        : `从工程文件夹中删除“${item.name}”？`)) return;
      // Keep the working file while an undo/redo entry can still reference it.
      // Saved/exported packages contain only the current asset list.
      if (item.type === 'voice') { clearVoiceReferences(project, item.id); if (previewVoiceId === item.id) stopEditorVoicePreview(); }
      project.assets = project.assets.filter(entry => entry.id !== item.id);
      markDirty(); renderSidebar(); renderInspector(); updatePreview();
    } else if (action === 'reset-expressions') {
      if (!step()) return;
      step().expressionWeights = {};
      step().expression = '';
      markDirty(); renderExpressionControls(); stage?.setExpressions({});
    } else if (action === 'add-title-actor') {
      project.title.actors.push(newTitleActor(uid(),actorModels()[0]?.id||'',project.title.actors.length));markDirty();renderInspector();updatePreview();
    } else if (action === 'delete-title-actor') {
      project.title.actors=project.title.actors.filter(a=>a.id!==node.dataset.id);markDirty();renderInspector();updatePreview();
    } else if (action === 'reset-title-expressions') {
      const actor=project.title.actors.find(a=>a.id===node.dataset.id);if(!actor)return;actor.expressionWeights={};
      markDirty(); renderTitleExpressionControls(); updatePreview();
    } else if (action === 'add-choice') {
      if (!step()) return;
      step().choices.push({ text:'', actId:'' }); markDirty(); renderInspector();
    } else if (action === 'delete-choice') {
      step().choices.splice(Number(node.dataset.index),1); markDirty(); renderInspector();
    } else if (action === 'play') {
      if(saveInFlight||editorSaveNotice.active){editorSaveNotice.refresh();toast('工程正在保存，完成后即可试玩。');return;}
      stopEditorVoicePreview();
      if (mode === 'editor') {
        node.disabled = true;
        try {
          const result = await bridge('previewGame', { project: structuredClone(project) });
          window.__lastPreviewGame = result;
          toast('已在新窗口启动临时游戏；关闭游戏窗口即可返回编辑。');
        } finally { node.disabled = false; }
      } else startPlay();
    }
    else if (action === 'continue-game') {
      const filled = readSaveSlots().map((slot, index) => ({ slot, index })).filter(item => item.slot);
      filled.sort((a, b) => (Date.parse(b.slot.savedAt || '') || 0) - (Date.parse(a.slot.savedAt || '') || 0));
      if (filled.length) loadSlot(filled[0].index);
    }
    else if (action === 'stop-play') stopPlay();
    else if (action === 'auto-toggle') {
      autoPlay = !autoPlay;
      updateAutoButton();
      scheduleAutoAdvance(project.acts[playAct]?.steps[playStep]);
    }
    else if (action === 'save-game') renderSaveModal('save');
    else if (action === 'load-game') renderSaveModal('load');
    else if (action === 'save-slot') await saveSlot(Number(node.dataset.index));
    else if (action === 'load-slot') loadSlot(Number(node.dataset.index));
    else if (action === 'load-legacy-slot') loadSlot(-1);
    else if (action === 'close-modal') closePlayerModal();
    else if (action === 'settings') renderSettingsModal();
    else if (action === 'role-details') await openRoleDetails();
    else if (action === 'gallery') {
      galleryTab = 'images'; galleryPage = 0; galleryStoryIndex = 0;
      renderGalleryModal();
    }
    else if (action === 'gallery-tab') {
      if (galleryTab === 'music' && node.dataset.tab !== 'music') stopGalleryMusic();
      galleryTab = node.dataset.tab;
      galleryStoryIndex = 0;
      renderGalleryModal();
    }
    else if (action === 'gallery-page') { galleryPage = Number(node.dataset.index); renderGalleryModal(); }
    else if (action === 'gallery-image') {
      const item = asset(node.dataset.imageId);
      if (!item || !hasDiscovered('image', item.id)) return;
      document.querySelector('#gallery-lightbox')?.remove();
      document.querySelector('#player-modal')?.insertAdjacentHTML('beforeend',
        `<div id="gallery-lightbox" class="gallery-lightbox">${button('关闭大图 ×', 'gallery-image-close')}
          <img src="${escape(assetUrl(item))}" alt="鉴赏图片"></div>`);
    }
    else if (action === 'gallery-image-close') document.querySelector('#gallery-lightbox')?.remove();
    else if (action === 'gallery-track') playGalleryTrack(Number(node.dataset.index));
    else if (action === 'gallery-music-toggle') {
      if (galleryMusic.paused) {
        const selected = galleryTracks()[galleryTrackIndex];
        if (!selected || !hasDiscovered('music', selected.id)) return;
        if (galleryMusic.src !== assetUrl(selected)) playGalleryTrack(galleryTrackIndex);
        else {
          if (!galleryMusicInterruptedBgm) galleryMusicInterruptedBgm = !music.paused;
          music.pause();
          galleryMusic.play().catch(() => toast('这首音乐无法播放，请检查音频文件', true));
          renderGalleryMusicState();
        }
      } else { galleryMusic.pause(); renderGalleryMusicState(); }
    }
    else if (action === 'gallery-prev') playGalleryTrack(nextUnlockedTrack(-1));
    else if (action === 'gallery-next') playGalleryTrack(nextUnlockedTrack(1));
    else if (action === 'gallery-repeat') { galleryRepeatOne = !galleryRepeatOne; renderGalleryMusicState(); }
    else if (action === 'gallery-character') {
      galleryCharacterId = node.dataset.characterId;
      galleryStoryIndex = 0;
      gallerySelection=selectGalleryCharacter();
    }
    else if (action === 'gallery-story') {
      galleryStoryIndex = Number(node.dataset.index);
      renderGalleryCharacterText();
    }
    else if (action === 'play-progress') renderProgressModal();
    else if (action === 'chapter-scroll') {
      const rail = document.querySelector('#chapter-rail');
      rail?.scrollBy({ left: Number(node.dataset.direction) * rail.clientWidth * .8, behavior: 'smooth' });
    }
    else if (action === 'chapter-select') {
      const card = document.querySelector(`#chapter-card-${Number(node.dataset.index)}`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      document.querySelectorAll('[data-action="chapter-select"]').forEach(button => button.classList.toggle('selected', button === node));
    }
    else if (action === 'chapter-replay') {
      const index = Number(node.dataset.index);
      const chapter = project.acts[index];
      const chapterIndex = project.acts.slice(0, index).filter(item => !isEvent(item)).length;
      if (!chapter || isEvent(chapter) || !chapterUnlocked(chapter, chapterIndex, loadLifetimeProgress()) || !chapter.steps.length) return;
      closePlayerModal(); playing = true; playAct = index; playStep = 0; preparedAct = -1;
      titleRequest++; playViewedStepIds = new Set(); playCharacterLineCounts = {};
      restartPlayerAutoSave(); showPlayStep();
    }
    else if (action === 'exit-game') await bridge('exitGame');
    else if (action === 'apply-resolution') {
      const value = document.querySelector('#window-resolution')?.value;
      const result = await bridge('setWindowResolution', { value });
      playerResolution = result.windowResolution;
      renderSettingsModal();
    }
    else if (action === 'toggle-fullscreen') {
      const result = await bridge('setFullscreen', { value: !playerFullscreen });
      playerFullscreen = result.fullscreen;
      playerResolution = result.windowResolution;
      const quickButton = document.querySelector('.scene-quick-actions [data-action="toggle-fullscreen"]');
      if (quickButton) quickButton.textContent = playerFullscreen ? '窗口' : '全屏';
      if (saveModalMode === 'settings') renderSettingsModal();
    }
    else if (action === 'choose') {
      if(!playing||transitioning||saveModalMode||playerInventory.pending.length)return;
      if(finishTyping())return;if(maybeGrantCurrentItems())return;
      const choice = project.acts[playAct].steps[playStep].choices[Number(node.dataset.index)];
      const target = project.acts.findIndex(item => item.id === choice.actId);
      if (target < 0) { toast('这个选项还没有设置目标幕', true); return; }
      const used=useChoiceItems(choice,playerInventory,project.items);if(!used.ok){refreshChoiceItems();toast('缺少所需物品。',true);return;}
      playAct = target; playStep = 0; showPlayStep();
    }
  } catch (error) { toast(error.message, true); }
});

document.addEventListener('input', event => {
  if(routePreciseInput(event.target))return;
  if (library.input(event.target)) return;
  const node = event.target;
  if (node.dataset.eventField && isEvent(act())) {
    const key = node.dataset.eventField;
    const holder = key === 'name' ? act() : node.hasAttribute('data-event-row') ? act().event.declarations[Number(node.dataset.eventRow)] : act().event;
    if (!holder) return;
    holder[key] = node.type === 'checkbox' ? node.checked : key === 'burstInterval' ? Math.max(.12, Math.min(3, Number(node.value) || .22)) : node.value;
    markDirty(); renderSidebar();
    if (['type','burst'].includes(key)) renderInspector();
    updatePreview(); return;
  }
  if (node.dataset.propField && project) {
    const prop=project.characters[selectedCharacter]?.props?.find(p=>p.id===node.dataset.propId);if(!prop)return;selectedBindingPropId=prop.id;
    prop[node.dataset.propField]=node.value;markDirty();updatePreview();return;
  }
  if (node.dataset.propTransform && project) {
    selectedBindingPropId=node.dataset.propTransform;const prop=project.characters[selectedCharacter]?.props?.find(p=>p.id===node.dataset.propTransform);if(!prop||node.value===''||!Number.isFinite(node.valueAsNumber))return;
    const kind=node.dataset.vector,axis=Number(node.dataset.axis),row=node.closest('.prop-axis'),unit=kind==='rotation'?.1:.001;
    let value=node.valueAsNumber;
    if(node.dataset.mode==='fine'){
      node.__propFineBase ??= String(prop[kind][axis]);value=Number(node.__propFineBase)+value*unit;
    }else{const fine=row.querySelector('[data-mode=fine]');fine.value='0';delete fine.__propFineBase;}
    value=Number(Math.max(kind==='scale'?.001:-10000,Math.min(10000,value)).toFixed(5));if(kind==='rotation')setPropRotation(prop,axis,value);else prop[kind][axis]=value;
    const number=row.querySelector('[data-mode=number]');number.value=String(value);
    markDirty();updatePreview();return;
  }
  if (node.dataset.motionOptions && project) {
    const scope = node.dataset.motionOptions;
    const holder = scope === 'step' ? step() : scope === 'title' ? project.title : scope.startsWith('titleActor:') ? project.title.actors.find(a=>a.id===scope.slice(11))
      : scope.startsWith('cast:') ? step()?.cast?.[scope.slice(5)] : null;
    if (!holder) return;
    holder.motionOptions ||= {};
    const key = node.dataset.motionSetting;
    if (key === 'loop') {
      holder.motionOptions.loop = node.value === 'true';
      const after = node.closest('.motion-advanced')?.querySelector('[data-motion-setting="after"]');
      if (after) after.disabled = holder.motionOptions.loop;
    } else if (key === 'startFrame') {
      holder.motionOptions.startFrame = Math.max(1, Math.floor(Number(node.value) || 1));
    } else if (key === 'endFrame') {
      holder.motionOptions.endFrame = node.value === '' ? null : Math.max(1, Math.floor(Number(node.value) || 1));
    } else if (key === 'after') holder.motionOptions.after = node.value === 'idle' ? 'idle' : 'hold';
    else if (key === 'placement') holder.motionOptions.placement = node.value === 'free' ? 'free' : 'inPlace';
    else if (key === 'feet') holder.motionOptions.feet = ['lock', 'free'].includes(node.value) ? node.value : 'auto';
    markDirty();
    if (scope === 'title' || scope.startsWith('titleActor:')) showTitleScene(false);
    else updatePreview();
    return;
  }
  if (node.id === 'editor-auto-save-minutes') {
    const minutes = Number(node.value);
    if (![5, 10, 30, 60].includes(minutes)) return;
    editorSettings.autoSaveMinutes = minutes;
    saveEditorSettings();
    restartEditorAutoSave();
    toast(`已设置每 ${minutes} 分钟自动保存`);
    return;
  }
  if (node.id === 'editor-theme') {
    editorSettings.theme = node.value === 'dark' ? 'dark' : 'light';
    saveEditorSettings(); applyEditorTheme();
    return;
  }
  if (node.dataset.galleryMusic && project) {
    const item = asset(node.dataset.galleryMusic);
    if (item) { item.galleryMusic = node.checked; markDirty(); }
    return;
  }
  if (node.dataset.galleryImage && project) {
    const item = asset(node.dataset.galleryImage);
    if (item) { item.galleryImage = node.checked; markDirty(); }
    return;
  }
  if (node.dataset.audioTitle && project) {
    const item = asset(node.dataset.audioTitle);
    if (item) { item.galleryTitle = node.value; markDirty(); }
    return;
  }
  if (node.dataset.gallerySeek && Number.isFinite(galleryMusic.duration)) {
    galleryMusic.currentTime = Number(node.value);
    updateGalleryMusicTime(); return;
  }
  if (node.dataset.storyIndex !== undefined && project) {
    const story = project.characters[selectedCharacter]?.stories?.[Number(node.dataset.storyIndex)];
    if (!story) return;
    story[node.dataset.storyField] = node.dataset.storyField === 'unlockLines'
      ? Math.max(0, Math.floor(Number(node.value) || 0)) : node.value;
    markDirty(); if (activePanel === 'characters') updatePreview(); return;
  }
  if (node.id === 'project-name') { project.name = node.value; markDirty(); if (activePanel === 'title') updatePreview(); return; }
  if(node.dataset.titleActorId && project){
    const actor=project.title.actors.find(a=>a.id===node.dataset.titleActorId);if(!actor)return;
    if(node.dataset.titleActorField){
      const key=node.dataset.titleActorField;actor[key]=node.value;
      if(key==='characterId'){const role=character(node.value);if(role)actor.modelId=role.modelId;actor.props=[];}
      if(key==='modelId'&&character(actor.characterId)?.modelId!==actor.modelId){actor.characterId='';actor.props=[];}
      markDirty();renderInspector();updatePreview();return;
    }
    if(node.dataset.titleActorAdjust){
      if(node.value===''||!Number.isFinite(node.valueAsNumber))return;
      const key=node.dataset.titleActorAdjust,value=Math.max(Number(node.min),Math.min(Number(node.max),node.valueAsNumber));
      actor[key]=key==='size'?value/100:value;
      for(const control of node.closest('.adjustment').querySelectorAll('input:not([data-precise-fine])'))control.value=String(value);
    }else if(node.dataset.titleActorExpression){actor.expressionWeights[node.dataset.titleActorExpression]=Number(node.value)/100;node.closest('label').querySelector('output').textContent=node.value+'%';}
    else if(node.dataset.titleActorProp){actor.props=actor.props.filter(id=>id!==node.dataset.titleActorProp);if(node.checked)actor.props.push(node.dataset.titleActorProp);}
    markDirty();updatePreview();return;
  }
  if (node.dataset.titleField && project) {
    project.title[node.dataset.titleField] = node.value;
    markDirty();
    if(node.dataset.titleField==='logoImageId')renderInspector();
    if (node.dataset.titleField !== 'authorNote') updatePreview();
    return;
  }
  if (node.dataset.uiField && project) {
    project.ui[node.dataset.uiField] = node.value;
    markDirty();
    return;
  }
  if ([node.dataset.titleAdjust, node.dataset.castAdjust?.split('.')[1], node.dataset.adjust].includes('offsetZ')) {
    if (node.value === '' || !Number.isFinite(node.valueAsNumber)) return;
    const value = Math.max(-100, Math.min(100, node.valueAsNumber));
    for (const control of node.closest('.adjustment').querySelectorAll('input:not([data-precise-fine])'))
      if (control !== node || Number(node.value) !== value) control.value = String(value);
  }
  if (node.dataset.titleAdjust && project) {
    const key = node.dataset.titleAdjust;
    project.title[key] = key === 'size' ? Number(node.value) / 100 : Number(node.value);
    const output = document.querySelector(`[data-title-output="${key}"]`);
    if (output) output.textContent = key === 'size' ? `${node.value}%`
      : ['yaw', 'pitch', 'cameraAngle'].includes(key) ? `${node.value}°` : Number(node.value).toFixed(2);
    markDirty(); updatePreview(); return;
  }
  if (node.dataset.titleExpression && project) {
    const name = node.dataset.titleExpression;
    project.title.expressionWeights ||= {};
    project.title.expressionWeights[name] = Number(node.value) / 100;
    const output = document.querySelector(`[data-title-expression-output="${CSS.escape(name)}"]`);
    if (output) output.textContent = `${node.value}%`;
    markDirty(); stage?.setExpressions(project.title.expressionWeights); return;
  }
  if(node.dataset.graphics&&project){
    const key=node.dataset.graphics;graphicsDraft=normalizeGraphics({...graphicsDraft,[key]:['renderScale','sharpness'].includes(key)?Number(node.value):node.value});
    if(['renderScale','sharpness'].includes(key)){const output=document.querySelector('[data-graphics-output="'+key+'"]');if(output)output.textContent=graphicsDraft[key]+'%';const plan=stage.graphicsPlan(graphicsDraft),summary=document.querySelector('[data-graphics-summary]');if(summary)summary.textContent='场景绘制：'+plan.inputWidth+' × '+plan.inputHeight+' → 显示：'+plan.outputWidth+' × '+plan.outputHeight;}else refreshGraphicsSettings();return;
  }
  if(node.hasAttribute('data-camera-speed')&&project){cameraSpeed=Math.max(.85,Math.min(1.15,Number(node.value)/100));localStorage.setItem('vrm-camera-speed-'+project.id,String(cameraSpeed));document.querySelector('[data-camera-speed-output]').textContent=Math.round(cameraSpeed*100)+'%';return;}
  if (node.dataset.volume && project) {
    audioSettings[node.dataset.volume] = Number(node.value) / 100;
    applyAudioSettings();
    localStorage.setItem(audioKey(), JSON.stringify(audioSettings));
    document.querySelector(`[data-volume-output="${node.dataset.volume}"]`).textContent = `${node.value}%`;
    return;
  }
  if (node.hasAttribute('data-text-speed') && project) {
    textSpeed = Math.max(5, Math.min(100, Number(node.value) || 35));
    localStorage.setItem(`vrm-text-speed-${project.id || project.name}`, String(textSpeed));
    document.querySelector('[data-text-speed-output]').textContent = `${textSpeed} 字/秒`;
    if (typingTimer) {
      const remaining = typingCharacters.slice(typingIndex).join('');
      const shown = document.querySelector('#dialogue-text')?.textContent || '';
      startTyping(remaining);
      typingCharacters = Array.from(shown + remaining);
      typingIndex = Array.from(shown).length;
      const dialogue = document.querySelector('#dialogue-text');
      if (dialogue) dialogue.textContent = shown;
    }
    return;
  }
  if(node.dataset.audioKind&&project){const item=asset(node.dataset.audioKind);if(item){setAudioKind(project,item,node.value);markDirty();renderAssetDock();renderInspector();}return;}
  if (node.dataset.assetFolder && project) {
    const item = asset(node.dataset.assetFolder);
    if (!item) return;
    if (item.type === 'voice') { toast('配音必须留在所属角色的文件夹中。', true); renderAssetDock(); return; }
    item.folderId = node.value;
    if (node.value) openAssetFolders.add(node.value);
    markDirty(); renderSidebar(); return;
  }
  if (node.dataset.castSlot && step()) {
    setDialogueActor(step(),node.dataset.castSlot,node.value);
    markDirty();renderInspector();updatePreview();return;
  }
  if (node.dataset.castMotion && step()) {
    step().cast[node.dataset.castMotion].motionId=node.value;
    markDirty();updatePreview();refreshMotionHints();return;
  }
  if (node.dataset.castAdjust && step()) {
    const [slot,key]=node.dataset.castAdjust.split('.');if(node.value===''||!Number.isFinite(node.valueAsNumber))return;
    step().cast[slot][key]=key==='size'?Number(node.value)/100:Number(node.value);
    const output=document.querySelector(`[data-cast-output="${slot}.${key}"]`);
    if(output)output.textContent=key==='size'?`${node.value}%`:key==='yaw'?`${node.value}°`:node.value;
    markDirty();updatePreview();return;
  }
  if (node.dataset.castExpression && step()) {
    const divider=node.dataset.castExpression.indexOf('.'),slot=node.dataset.castExpression.slice(0,divider),name=node.dataset.castExpression.slice(divider+1);
    step().cast[slot].expressionWeights ||= {};step().cast[slot].expressionWeights[name]=Number(node.value)/100;
    const output=[...document.querySelectorAll('[data-cast-expression-output]')].find(item=>item.dataset.castExpressionOutput===node.dataset.castExpression);
    if(output)output.textContent=`${node.value}%`;markDirty();updatePreview();return;
  }
  if (node.dataset.castProp && step()) {
    const settings=step().cast[node.dataset.castProp];settings.props ||= [];
    settings.props=settings.props.filter(id=>id!==node.dataset.propId);
    if(node.checked)settings.props.push(node.dataset.propId);
    markDirty();updatePreview();return;
  }
  if((node.dataset.render||node.dataset.nprFilter)&&project){
    const scope=node.dataset.renderScope||'act',holder=scope==='step'?step():scope==='title'?project.title:act();if(!holder)return;
    holder.render ||= scope==='step'?{}:normalizeRender(scope==='title'?project.render:undefined);
    const key=node.dataset.render||node.dataset.nprFilter;
    if(node.dataset.nprFilter){const spec=customFilterSpecs.find(spec=>spec[0]===key);if(!spec)return;if(spec[2]!=='color'&&(node.value===''||!Number.isFinite(Number(node.value))))return;holder.render.filters||={};holder.render.filters[key]=spec[2]==='color'?node.value:Number(node.value);}
    else if(key==='preset'){if(node.value)holder.render.preset=node.value;else{delete holder.render.preset;delete holder.render.strength;delete holder.render.filters;}}
    else {if(node.value===''||!Number.isFinite(Number(node.value)))return;holder.render[key]=key==='strength'?Number(node.value)/100:Number(node.value);}
    const selector=node.dataset.nprFilter?'data-npr-filter':'data-render';for(const other of document.querySelectorAll(`[${selector}="${key}"][data-render-scope="${scope}"]`))if(other!==node)other.value=node.value;
    markDirty();const settings=scope==='title'?normalizeRender(project.title.render):scope==='act'&&activePanel==='render'?chapterRender(act(),project.render):dialogueRender(act(),step(),project.render);stage?.setRenderSettings(settings);applySceneColor(settings);if(key==='preset')renderInspector();return;
  }
  if (node.dataset.weather && act()) {
    const key = node.dataset.weather;
    act().weather = normalizeWeather(act().weather);
    act().weather[key] = ['splashes','atmosphere','autoMood','windMotion'].includes(key) ? node.checked
      : key === 'direction' ? Number(node.value)
      : ['type','soundId'].includes(key) ? node.value : Number(node.value)/100;
    act().weather = normalizeWeather(act().weather);
    const output = document.querySelector(`[data-weather-output="${key}"]`);
    if (output) output.textContent = `${node.value}%`;
    markDirty(); setSceneWeather(act()); applySceneColor(dialogueRender(act(),step(),project.render));
    if (['type','splashes'].includes(key)) renderInspector();
    return;
  }
  if (node.dataset.galleryAdjust && project) {
    const item = project.characters[selectedCharacter];
    if (!item) return;
    const key = node.dataset.galleryAdjust;
    item[key] = Number(node.value);
    if (key === 'galleryPoseFrame') delete item.galleryPoseTime;
    if (key === 'galleryPoseFrame') {
      const number = document.querySelector('[data-gallery-frame-number]');
      if (number) number.value = node.value;
    }
    document.querySelector(`[data-gallery-output="${key}"]`).textContent = key === 'galleryYaw'
      ? `${node.value}°` : `第 ${node.value} / ${node.max} 帧`;
    markDirty(); if (activePanel === 'characters') updatePreview(); return;
  }
  if (node.hasAttribute('data-gallery-frame-number') && project) {
    const item = project.characters[selectedCharacter];
    const slider = document.querySelector('[data-gallery-adjust="galleryPoseFrame"]');
    if (!item || !slider) return;
    const frame = Math.max(1, Math.min(Number(slider.max), Math.floor(Number(node.value) || 1)));
    node.value = frame;
    slider.value = frame;
    item.galleryPoseFrame = frame;
    delete item.galleryPoseTime;
    document.querySelector('[data-gallery-output="galleryPoseFrame"]').textContent = `第 ${frame} / ${slider.max} 帧`;
    markDirty(); updatePreview(); return;
  }
  if (node.dataset.adjust && step()) {
    const key = node.dataset.adjust;
    const value = key === 'size' ? Number(node.value) / 100 : Number(node.value);
    step()[key] = value;
    document.querySelector(`[data-adjust-output="${key}"]`).textContent = key === 'size' ? `${node.value}%` : key === 'yaw' ? `${node.value}°` : value.toFixed(2);
    markDirty(); updatePreview();
    return;
  }
  if (node.dataset.expression && step()) {
    const name = node.dataset.expression;
    step().expressionWeights = { ...expressionWeightsOf(step()), [name]: Number(node.value) / 100 };
    step().expression = '';
    document.querySelectorAll('[data-expression-output]').forEach(output => {
      if (output.dataset.expressionOutput === name) output.textContent = `${node.value}%`;
    });
    markDirty(); stage?.setExpressions(step().expressionWeights);
    return;
  }
  if(node.hasAttribute('data-choice-consume')){step().choices[Number(node.dataset.choiceConsume)].consumeRequired=node.checked;markDirty();return;}
  if(node.dataset.itemField){const item=project.items[selectedItem];if(!item)return;item[node.dataset.itemField]=node.value;markDirty();if(node.dataset.itemField==='name')renderSidebar();updatePreview();return;}
  if(node.dataset.inventoryRow){const holder=node.dataset.inventoryRow==='grant'?step():step().choices[Number(node.dataset.choice)],key=node.dataset.inventoryRow==='grant'?'itemGrants':'requirements',row=holder[key][Number(node.dataset.row)];if(node.dataset.key==='quantity'){if(node.value===''||!Number.isSafeInteger(Number(node.value))||Number(node.value)<1)return;row.quantity=Math.min(1000000,Number(node.value));}else row.itemId=node.value;markDirty();return;}
  if (node.dataset.choiceField) {
    step().choices[Number(node.dataset.choiceIndex)][node.dataset.choiceField] = node.value;
    markDirty(); return;
  }
  const path = node.dataset.field;
  if (!path || !project) return;
  const [scope, property, nested] = path.split('.');
  const target = scope === 'act' ? act() : scope === 'step' ? step()
    : scope === 'character' ? project.characters[selectedCharacter] : project;
  if (!target) return;
  if (path === 'step.voiceId' && node.value && !voicesForCharacter(project, target.characterId).some(item => item.id === node.value)) { toast('只能选择当前角色的专属配音。', true); renderInspector(); return; }
  if (nested) target[property][nested] = node.value;
  else target[property] = path === 'character.autoMouth' ? node.value !== 'off' : node.value;
  markDirty();
  if (node.tagName === 'SELECT') {
    if (path === 'act.coverImageId' || path === 'act.environmentId') renderInspector();
    if (path === 'step.characterId' && !step().speaker) {
      document.querySelector('[data-field="step.speaker"]')?.setAttribute('placeholder', character(node.value)?.name || '留空时用角色名字');
    }
    if (path === 'character.modelId') {
      if(target.portraitSource!=='manual'||!asset(target.portraitId)){
        target.portraitId = '';
        target.portraitSource = '';
        target.portraitPoseKey = '';
      }
      temporaryPortraits.delete(target.id);
      if (target.modelId) ensureCharacterPortrait(target);
      renderInspector();
    }
    if (path === 'step.characterId') renderInspector();
    renderSidebar(); renderExpressionControls(); updatePreview();
    if (mode === 'editor') editorHistory.commit({ derived: true });
  } else if (path === 'step.text' || path === 'step.speaker') {
    document.querySelector('#dialogue-text').textContent = step().text;
    document.querySelector('#dialogue-speaker').textContent = step().speaker || character(step().characterId)?.name || '旁白';
    updateSpeakerPortrait(step().characterId, true);
    renderSidebar();
  } else if (path.startsWith('character.')) {
    if (path === 'character.name') renderSidebar();
    updatePreview();
  } else if (path === 'act.name') {
    renderSidebar();
  }
});
document.addEventListener('change', event => {
  const node = event.target;
  if (node.dataset.galleryAdjust !== 'galleryPoseFrame' &&
      !node.hasAttribute('data-gallery-frame-number') && node.dataset.field !== 'character.galleryMotionId') return;
  const item = project?.characters[selectedCharacter];
  if (item?.modelId && portraitIsAutomatic(item)) ensureCharacterPortrait(item, true);
});
document.addEventListener('keydown', event => {
  const uiPicker=document.querySelector('#game-ui-picker');
  if(uiPicker){
    if(event.key==='Escape'){event.preventDefault();document.querySelector('[data-action="close-game-ui"]')?.click();}
    if(event.key==='Tab'){const targets=[...uiPicker.querySelectorAll('button,input:checked')];const first=targets[0],last=targets.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    return;
  }
  if (event.key === 'Escape' && document.querySelector('#gallery-lightbox')) {
    document.querySelector('#gallery-lightbox').remove(); return;
  }
  if (event.key === 'Escape' && saveModalMode) { closePlayerModal(); return; }
  if (saveModalMode) return;
  if (!playing || event.repeat || !['Enter',' '].includes(event.key) || event.target.closest('button,input,textarea,select')) return;
  event.preventDefault(); next();
});
document.addEventListener('keydown', event => {
  if (mode !== 'editor' || !project || event.isComposing || event.keyCode === 229 ||
      document.querySelector('#book-reader') || !(event.ctrlKey || event.metaKey) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (event.target.matches?.('input,textarea,select') && !historyInputContext(event.target)) return;
  const direction = key === 'z' ? (event.shiftKey ? 1 : -1) : key === 'y' ? 1 : 0;
  if (!direction) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (!event.repeat) restoreEditorHistory(direction);
}, true);
window.addEventListener('beforeunload', event => { if (dirty) event.preventDefault(); });
async function runMouthSmoke(phase) {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const checks = [];
  if (phase === 'mouth-editor') {
    activePanel = 'characters'; selectedCharacter = 0; renderSidebar(); renderInspector(); editorHistory.reset();
    const field = () => document.querySelector('[data-field="character.autoMouth"]');
    assert(field()?.value === 'on', 'default mouth setting');
    field().value = 'off'; field().dispatchEvent(new Event('input', { bubbles: true }));
    assert(project.characters[0].autoMouth === false, 'setting not boolean');
    await restoreEditorHistory(-1); assert(project.characters[0].autoMouth === true && field().value === 'on', 'mouth setting undo');
    await restoreEditorHistory(1); assert(project.characters[0].autoMouth === false, 'mouth setting redo');
    await restoreEditorHistory(-1);
    await save();
    return { ok: true, defaultEnabled: true, disableAndUndoRedo: true, settings: project.characters.map(c => ({ id: c.id, autoMouth: c.autoMouth })) };
  }
  assert(mode === 'player', 'mouth test requires exported game');
  const before = JSON.stringify(project);
  const role = project.characters[0], actorId = role.id;
  textSpeed = 12; playing = true; playAct = 0; playStep = 0; preparedAct = -1; await showPlayStep();
  const record = stage.visibleRecords.get(actorId);
  assert(record?.talkingMouth?.diagnostics().running && typingTimer, 'mouth not active while typing');
  const target = structuredClone(record.expressionTarget), initialOthers = [...stage.visibleRecords.entries()].filter(([id]) => id !== actorId).map(([id,r]) => [id, structuredClone(r.expressionTarget)]);
  const samples = [], shapes = new Set(); let visibleMorphChanged = false;
  const morphs = () => { const values = []; record.vrm.scene.traverse(node => { if (node.morphTargetInfluences) values.push(...node.morphTargetInfluences); }); return values; };
  await wait(400); const firstMorphs = morphs();
  for (let n = 0; n < 24; n++) {
    await wait(45);
    const state = record.talkingMouth.diagnostics(); samples.push(state.values);
    state.values.forEach((value, i) => { if (value > .08) shapes.add(state.names[i]); });
    assert(state.values.reduce((a,b) => a+b,0) < .67, 'mouth too wide');
    assert(Math.abs(record.vrm.expressionManager.getValue('happy') - target.happy) < .005, 'emotion overwritten');
    assert(initialOthers.every(([id]) => !stage.visibleRecords.get(id).talkingMouth?.diagnostics().running), 'other actor is talking');
    if (morphs().some((value, i) => Math.abs(value - firstMorphs[i]) > .015)) visibleMorphChanged = true;
  }
  assert(shapes.size >= 2 && visibleMorphChanged, 'mouth weights changed without mesh movement');
  assert(JSON.stringify(project) === before, 'animation changed authored project');
  checks.push('真实 VRM 模型嘴巴持续变化，只有说话角色动嘴，笑容及工程数据保持原样');
  stage.talkingLetter('。'); await wait(120); assert(record.talkingMouth.diagnostics().pause > 0, 'punctuation pause');
  checks.push('标点处短暂停顿');
  finishTyping(); assert(!stage.talkingRecord && !record.talkingMouth.diagnostics().running, 'instant text completion did not stop');
  for (const name of record.talkingMouth.diagnostics().names) assert(Math.abs(record.vrm.expressionManager.getValue(name) - (target[name] || 0)) < .005, 'authored mouth not restored');
  checks.push('点击显示全文立即停嘴，并恢复作者设定的嘴型');
  startTyping('自然结束。', actorId); await wait(700); assert(!typingTimer && !stage.talkingRecord, 'natural completion did not stop');
  checks.push('文字自然显示完成后停止');
  role.autoMouth = false; startTyping('关闭自动嘴型后的长句测试。', actorId); await wait(150); assert(typingTimer && !stage.talkingRecord, 'disabled role mouth still active');
  clearTyping(); role.autoMouth = true;
  checks.push('角色开关关闭后仍显示文字，但不自动动嘴');
  playStep = 1; await showPlayStep(); const secondId = project.acts[0].steps[1].characterId;
  assert(stage.talkingRecord === stage.visibleRecords.get(secondId) && !record.talkingMouth.diagnostics().running, 'speaker switching');
  clearTyping(); checks.push('换说话角色后，上一位停嘴，下一位开始动嘴');
  startTyping('背景叙述不应让场上人物说话。', ''); assert(!stage.talkingRecord, 'narrator moved actor mouth'); clearTyping();
  startTyping('继续说话并测试速度调整。', secondId);
  // This exercises the same restart path used by the text-speed slider.
  const shown = document.querySelector('#dialogue-text').textContent; const remaining = typingCharacters.slice(typingIndex).join('');
  textSpeed = 30; startTyping(remaining); typingCharacters = Array.from(shown + remaining); typingIndex = Array.from(shown).length;
  assert(stage.talkingRecord === stage.visibleRecords.get(secondId), 'speed adjustment lost actor');
  await wait(1100); assert(!stage.talkingRecord && !typingTimer, 'speed completion did not stop');
  checks.push('旁白不带动人物嘴巴，修改文字速度后嘴型继续跟随');
  playStep = 0; await showPlayStep(); stopPlay(); await wait(450); assert(!stage.talkingRecord && !typingTimer, 'title transition mouth leak');
  checks.push('返回标题停止嘴型');
  playing = true; playAct = 0; playStep = 0; preparedAct = -1; await showPlayStep();
  return { ok: true, checks, shapes: [...shapes], visibleMorphChanged, sampleCount: samples.length, mouth: record.talkingMouth.diagnostics() };
}

async function runDialogueVoiceSmoke() {
  const checks = [], assert = (v, m) => { if (!v) throw new Error(m); };
  const input = (selector, value) => { const node = document.querySelector(selector); assert(node, selector); node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); };
  const click = action => { const node = document.querySelector(`[data-action="${action}"]`); assert(node, action); node.click(); };
  const panel = name => document.querySelector(`[data-panel="${name}"]`).click();
  const settle = async () => { for (let i = 0; i < 100 && historyBusy; i++) await new Promise(r => setTimeout(r, 40)); assert(!historyBusy, 'history timeout'); };
  const undo = async () => { await restoreEditorHistory(-1); await settle(); };
  const redo = async () => { await restoreEditorHistory(1); await settle(); };
  const confirmBefore = window.confirm; window.confirm = () => true;
  try {
    selectedAct = 0; selectedStep = 0; activePanel = 'story'; renderSidebar(); renderInspector(); editorHistory.reset();
    assert(byType('voice').length === 2, 'legacy voice migration');
    assert(asset('shared')?.type === 'audio' && !asset('legacy'), 'music preservation');
    assert(byType('voice').every(v => v.path.startsWith('assets/voice/') && v.folderId === voiceFolderId(v.characterId)), 'physical folder migration');
    checks.push('旧对白配音转入角色文件夹，背景音乐保留');
    assert([...document.querySelectorAll('#asset-dock-tabs button')].map(n => n.dataset.type).join(',') === 'image,vrm,fbxCharacter,motion,audio,voice,video', 'tab order');
    assert(document.querySelector('[data-type="audio"][role="tab"]').textContent.startsWith('音乐与音效'), 'music tab label');
    checks.push('配音位于音乐与音效之后、视频之前');
    panel('characters'); click('add-character'); const newId = project.characters.at(-1).id;
    assert(project.assetFolders.some(f => f.id === voiceFolderId(newId) && f.locked), 'auto folder');
    input('[data-field="character.name"]', '新角色'); assert(project.assetFolders.find(f => f.characterId === newId).name === '新角色', 'folder rename');
    click('delete-character'); assert(project.assetFolders.find(f => f.characterId === newId)?.locked, 'folder deleted'); await undo();
    assert(project.characters.some(c => c.id === newId), 'character undo'); checks.push('新增角色自动建固定文件夹，角色改名同步，删除角色后文件夹仍保留');
    panel('story'); selectedAct = 0; selectedStep = 0; renderSidebar(); renderInspector();
    activeAssetType = 'voice'; currentAssetFolder.voice = ''; renderAssetDock();
    assert(!document.querySelector('#asset-dock-body .asset-file-tile') && !document.querySelector('#asset-dock-body [data-action="add-asset-folder"]'), 'voice root controls');
    
    const count = project.assets.length; await importAssets('voice'); await importDroppedEntries([]);
    assert(project.assets.length === count && document.querySelector('.dialogue-voice-field'), 'library import bypass');
    let rejected = false; try { await bridge('importAssets', { type: 'voice' }); } catch { rejected = true; } assert(rejected, 'native library import bypass');
    checks.push('素材库导入和拖入配音被拦截并定位对白');
    const original = step().voiceId; await uploadDialogueVoice(); const first = step().voiceId, firstAsset = asset(first);
    assert(first !== original && firstAsset?.name === step().text && firstAsset.characterId === step().characterId && firstAsset.path.startsWith('assets/voice/'), 'dialogue upload');
    const uploadedPath = firstAsset.path;
    await uploadDialogueVoice(); const second = step().voiceId;
    assert(second !== first && !asset(first), 'replacement pile'); await undo(); assert(step().voiceId === first && asset(first), 'upload undo'); await redo(); assert(step().voiceId === second, 'upload redo');
    checks.push('对白上传后全文命名，重复上传替换，撤销重做恢复旧配音');
    const fullText = '配音全文测试：标点、换行与很长的对白都要保留。\n第二行也完整显示。';
    input('[data-field="step.text"]', fullText); assert(asset(second).name === fullText, 'fulltext rename');
    editorHistory.seal();
    const opts = [...document.querySelector('[data-field="step.voiceId"]').options].map(o => o.value).filter(Boolean);
    assert(opts.every(id => asset(id)?.type === 'voice' && asset(id).characterId === step().characterId) && !opts.includes('shared'), 'voice filter');
    input('[data-field="step.characterId"]', 'role-b'); assert(!step().voiceId, 'cross role binding'); await undo(); assert(step().voiceId === second, 'role change undo');
    checks.push('全文随对白更新，只能选择当前角色的配音');
    currentAssetFolder.voice = voiceFolderId(step().characterId); renderAssetDock();
    assert(!document.querySelector('#asset-dock-body [data-action="rename-asset-folder"]') && !document.querySelector('#asset-dock-body [data-asset-folder]'), 'folder protection');
    assert(document.querySelector('.asset-voice-tile .asset-tile-name').textContent === fullText, 'display fulltext');
    await previewDialogueVoice(second); assert(!editorVoicePreview.paused && previewVoiceId === second, 'audio playback');
    checks.push('配音素材库全文显示，固定文件夹不可改名或移动，实际试听成功');
    const reused = act().steps[1]; reused.characterId = step().characterId; reused.voiceId = second; markDirty(); editorHistory.seal();
    document.querySelector(`[data-action="delete-asset"][data-asset-id="${second}"]`).click();
    assert(!asset(second) && !step().voiceId && !act().steps[1].voiceId && editorVoicePreview.paused, 'voice delete');
    await undo(); assert(asset(second) && step().voiceId === second && act().steps[1].voiceId === second, 'voice delete undo');
    await redo(); assert(!asset(second), 'voice delete redo'); await undo();
    checks.push('删除配音解除所有对白绑定，撤销重做正常');
    const snapshot = structuredClone(project); snapshot.acts[0].steps[0].characterId = '';
    rejected = false; try { await bridge('importDialogueVoice', { project: snapshot, actId: act().id, dialogueId: step().id }); } catch { rejected = true; } assert(rejected, 'no role upload');
    snapshot.acts[0].steps[0].characterId = step().characterId; snapshot.acts[0].steps[0].text = '   ';
    rejected = false; try { await bridge('importDialogueVoice', { project: snapshot, actId: act().id, dialogueId: step().id }); } catch { rejected = true; } assert(rejected, 'blank upload');
    checks.push('没有角色或没有对白文字时拒绝上传');
    await save(); renderAssetDock();
    return { ok: true, checks, voices: byType('voice'), uploadedPath, folders: project.assetFolders.filter(f => f.type === 'voice') };
  } finally { window.confirm = confirmBefore; stopEditorVoicePreview(); }
}

async function runEditorHistorySmoke() {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const results = [];
  const originalConfirm = window.confirm;
  window.confirm = () => true;
  const input = (selector, value) => {
    const node = document.querySelector(selector); assert(node, `missing input: ${selector}`);
    if (node.type === 'checkbox') node.checked = value; else node.value = value;
    node.dispatchEvent(new Event('input', { bubbles: true })); return node;
  };
  const click = action => { const node = document.querySelector(`[data-action="${action}"]`); assert(node, `missing button: ${action}`); node.click(); };
  const wait = async test => { for (let i = 0; i < 100; i++) { if (test()) return; await new Promise(r => setTimeout(r, 40)); } throw new Error('UI action timed out'); };
  const undo = async () => { click('editor-undo'); await wait(() => !historyBusy); };
  const redo = async () => { click('editor-redo'); await wait(() => !historyBusy); };
  const panel = name => { document.querySelector(`[data-panel="${name}"]`).click(); };
  try {
    // This runner is only available with --smoke and operates on a disposable fixture.
    selectedAct = 0; selectedStep = 0; activePanel = 'story'; renderSidebar(); renderInspector(); await updatePreview(); editorHistory.reset();
    const text = step().text;
    input('[data-field="step.text"]', '撤销测试'); input('[data-field="step.text"]', '撤销测试第二次');
    assert(editorHistory.status().undoCount === 1, 'typing did not merge');
    await undo(); assert(step().text === text, 'text undo failed'); await redo(); assert(step().text === '撤销测试第二次', 'text redo failed'); results.push('连续打字合并及文字恢复');
    const node = input('[data-field="step.speaker"]', '测试名字');
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })); await wait(() => !historyBusy);
    assert(step().speaker !== '测试名字', 'Ctrl+Z failed in input');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })); await wait(() => !historyBusy);
    assert(step().speaker === '测试名字', 'Ctrl+Shift+Z failed'); results.push('输入框快捷键');
    click('duplicate-step'); const copyId = step().id; const count = act().steps.length;
    click('delete-step'); assert(act().steps.length === count - 1, 'step delete failed');
    await undo(); assert(step().id === copyId && act().steps.length === count, 'deleted step or selection not restored'); await redo(); assert(act().steps.length === count - 1, 'step delete redo failed'); results.push('删除对白及选中位置恢复');
    const actId = act().id, actJson = JSON.stringify(act()); click('delete-act'); assert(!project.acts.some(a => a.id === actId), 'act delete failed');
    await undo(); assert(act().id === actId && JSON.stringify(act()) === actJson, 'whole act not restored'); results.push('整幕及全部对白恢复');
    const order = project.acts.map(a => a.id).join(','); editorHistory.seal(); editorHistory.begin(); reorderStory('act', 0, 1, true);
    assert(project.acts.map(a => a.id).join(',') !== order, 'reorder failed'); await undo(); assert(project.acts.map(a => a.id).join(',') === order, 'order undo failed'); await redo(); results.push('剧情拖动排序');
    panel('render'); const beforeBrightness = act().render.brightness; const beforeCount = editorHistory.status().undoCount;
    const slider = document.querySelector('[data-render="brightness"]'); slider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    input('[data-render="brightness"]', 120); input('[data-render="brightness"]', 140); input('[data-render="brightness"]', 160);
    slider.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); assert(editorHistory.status().undoCount === beforeCount + 1, 'slider did not merge');
    await undo(); assert(act().render.brightness === beforeBrightness, 'color undo failed'); await redo(); assert(act().render.brightness === 160, 'color redo failed'); results.push('滑块合并与每幕调色');
    panel('story'); const weather = act().weather.type; input('[data-weather="type"]', 'rain'); await undo(); assert(act().weather.type === weather, 'weather undo failed'); await redo(); assert(act().weather.type === 'rain', 'weather redo failed'); results.push('天气恢复');
    panel('characters'); selectedCharacter = 0; renderSidebar(); renderInspector(); const name = project.characters[0].name;
    input('[data-field="character.name"]', '新角色名字'); await undo(); assert(project.characters[0].name === name, 'character name undo failed'); await redo();
    click('delete-character'); await undo(); assert(project.characters[0].name === '新角色名字', 'character delete undo failed'); results.push('人物改名和删除');
    panel('title'); const oldName = project.name; input('#project-name', '新游戏名字'); await undo(); assert(project.name === oldName, 'game title undo failed'); await redo(); results.push('标题设置');
    panel('knowledge'); const book = project.knowledgeBooks[0]; assert(book, 'fixture needs a book'); const bookName = book.name;
    input('[data-book-field="name"]', '新书名'); await undo(); assert(project.knowledgeBooks[0].name === bookName, 'book undo failed'); await redo();
    click('book-delete'); await undo(); assert(project.knowledgeBooks[0].name === '新书名', 'book delete undo failed'); results.push('知识库编辑与删除');
    panel('story'); click('event-add'); const eventId = act().id; input('[data-event-field="title"]', '事件新标题'); await undo(); assert(act().event.title !== '事件新标题', 'event undo failed'); await redo();
    click('event-delete'); await undo(); assert(act().id === eventId && act().event.title === '事件新标题', 'event restore failed'); results.push('世界事件编辑与删除');
    const query = project.characters[0].name; await library.click('search-open', {}); input('#replace-find', query); await library.click('search-find', {}); input('#replace-with', '批量新名字');
    click('search-replace'); assert(project.characters[0].name === '批量新名字', 'replace failed'); click('search-undo'); await wait(() => !historyBusy); assert(project.characters[0].name === query, 'replace undo failed');
    click('search-redo'); await wait(() => !historyBusy); assert(project.characters[0].name === '批量新名字', 'replace redo failed'); await library.click('search-close', {}); results.push('批量替换统一撤销重做');
    // Check actual native PNG bytes, not just the portrait ID in the project.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16; const paint = canvas.getContext('2d');
    paint.fillStyle = '#ff0000'; paint.fillRect(0,0,16,16); const red = canvas.toDataURL();
    const portraitCharacter = project.characters[0];
    const first = await bridge('saveGeneratedPortrait', { dataUrl: red, characterId: portraitCharacter.id, name: portraitCharacter.name });
    const firstRevision = first.revision;
    await replaceAutoPortrait(portraitCharacter, first); portraitCharacter.portraitPoseKey = 'history-test-red'; markDirty({ derived: true });
    editorHistory.seal(); editorHistory.begin(); paint.fillStyle = '#0000ff'; paint.fillRect(0,0,16,16); const blue = canvas.toDataURL();
    const second = await bridge('saveGeneratedPortrait', { dataUrl: blue, characterId: portraitCharacter.id, name: portraitCharacter.name, previousRevision: first.revision });
    Object.assign(asset(first.id), second); portraitCharacter.portraitPoseKey = 'history-test-blue'; markDirty({ label: '重新拍摄头像' });
    const imageBytes = async () => [...new Uint8Array(await (await fetch(assetUrl(asset(first.id)), { cache: 'no-store' })).arrayBuffer())].join(',');
    const blueBytes = await imageBytes(); await undo(); const redBytes = await imageBytes(); assert(redBytes !== blueBytes && asset(first.id).revision === firstRevision, 'portrait file undo failed');
    await redo(); assert(await imageBytes() === blueBytes && asset(first.id).revision === second.revision, 'portrait file redo failed'); results.push('真实头像文件恢复');
    // Test a delete after save, then restore, then redo and save again.
    await save(); const removable = project.assets.find(a => a.id !== first.id && a.type === 'image'); assert(removable, 'fixture needs an image');
    activeAssetType = 'image'; currentAssetFolder.image = ''; renderAssetDock();
    document.querySelector(`[data-action="delete-asset"][data-asset-id="${removable.id}"]`).click(); assert(!asset(removable.id), 'asset delete failed'); await save();
    await undo(); assert(asset(removable.id), 'deleted asset metadata not restored'); assert((await fetch(assetUrl(asset(removable.id)), { cache: 'no-store' })).ok, 'deleted asset file missing after save and undo');
    await redo(); await save(); results.push('保存后撤销素材删除');
    await undo(); panel('title'); input('#project-name', '撤销重做验证工程'); assert(!editorHistory.status().canRedo, 'new edit did not discard redo branch'); results.push('新修改清空旧重做分支');
    // Final deletion lets the external ZIP/export check prove unused files/cache are excluded.
    activeAssetType = 'image'; currentAssetFolder.image = ''; renderAssetDock(); document.querySelector(`[data-action="delete-asset"][data-asset-id="${removable.id}"]`).click(); await save();
    panel('story'); selectedAct = 0; selectedStep = 0; renderSidebar(); renderInspector(); await updatePreview();
    assert(!document.querySelector('[data-action="editor-undo"]').disabled, 'undo button incorrectly disabled');
    const topbar = document.querySelector('.topbar'); assert(topbar.scrollWidth <= topbar.clientWidth + 2, 'topbar overflows'); results.push('小窗口按钮布局');
    return { ok: true, checks: results, removedPath: removable.path, retainedPortrait: asset(first.id).path, history: editorHistory.status() };
  } finally { window.confirm = originalConfirm; }
}

async function runPortraitHistorySmoke() {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const wait = async test => { for (let i = 0; i < 800; i++) { if (test()) return; await new Promise(r => setTimeout(r, 40)); } throw new Error('portrait test timed out'); };
  await wait(() => portraitJobs.size === 0 && project.characters[0].portraitId);
  activePanel = 'characters'; selectedCharacter = 0; renderSidebar(); renderInspector(); await updatePreview(); editorHistory.reset();
  const item = project.characters[0], oldRevision = asset(item.portraitId).revision;
  document.querySelector('[data-action="capture-character-portrait"]').click();
  await wait(() => portraitJobs.size === 0 && asset(project.characters[0].portraitId).revision !== oldRevision);
  const newRevision = asset(project.characters[0].portraitId).revision;
  assert(editorHistory.status().undoCount === 1, 'manual portrait capture not one undo step');
  await restoreEditorHistory(-1); assert(asset(project.characters[0].portraitId).revision === oldRevision, 'manual portrait undo failed');
  await restoreEditorHistory(1); assert(asset(project.characters[0].portraitId).revision === newRevision, 'manual portrait redo failed');
  const oldFrame = project.characters[0].galleryPoseFrame, oldDescription = project.characters[0].description;
  const slider = document.querySelector('[data-gallery-adjust="galleryPoseFrame"]'); assert(Number(slider.max) > oldFrame, 'fixture needs an animated motion');
  slider.value = Math.min(Number(slider.max), oldFrame + 20); slider.dispatchEvent(new Event('input', { bubbles: true })); slider.dispatchEvent(new Event('change', { bubbles: true }));
  const description = document.querySelector('[data-field="character.description"]'); description.value = '头像拍摄期间输入的介绍'; description.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(() => portraitJobs.size === 0);
  const frameRevision = asset(project.characters[0].portraitId).revision;
  await restoreEditorHistory(-1);
  assert(project.characters[0].description === oldDescription && asset(project.characters[0].portraitId).revision === frameRevision, 'late portrait result was attached to wrong edit');
  await restoreEditorHistory(-1);
  assert(project.characters[0].galleryPoseFrame === oldFrame && asset(project.characters[0].portraitId).revision === newRevision, 'frame and portrait not restored together');
  await restoreEditorHistory(1); await restoreEditorHistory(1); await save();
  return { ok: true, manualCaptureUndo: true, manualCaptureRedo: true, asyncFrameUndo: true, separateDescriptionUndo: true,
    portraitCount: project.assets.filter(a => a.generatedPortrait && a.characterId === project.characters[0].id).length };
}

if (new URLSearchParams(location.search).has('smoke'))
  Object.assign(window, { __vrmSmokeAutoSave: () => saveAutoSlot(), __vrmSmokeSaveSlot: index => saveSlot(index),
    __vrmSmokeMenuPolish: async phase => {
      if(phase==='agent-env-editor'){
        storyAssistant.render();await storyAssistant.click('assistant-toggle');if(!storyAssistant.isEnabled())throw Error('MCP 未开启');
        await storyAssistant.click('assistant-close');return {ok:true,agentEnabled:true};
      }
      if(phase==='agent-env-player'){
        const index=project.acts.findIndex(a=>a.environmentId&&project.environments.find(e=>e.id===a.environmentId)?.name.startsWith('MCP'));
        if(index<0)throw Error('MCP 场景未导出');playing=true;playAct=index;playStep=0;preparedAct=-1;await showPlayStep();await new Promise(resolve=>setTimeout(resolve,1500));
        const env=project.environments.find(e=>e.id===project.acts[index].environmentId);
        if(stageError||stage.environmentRuntime.objects.size!==env.nodes.length||stage.camera.position.distanceTo(new THREE.Vector3(...env.camera.position))>.001)throw Error('MCP 场景没有正确加载');
        return {ok:true,sceneNodes:env.nodes.length,loadedObjects:stage.environmentRuntime.objects.size,gameCamera:true,dialogue:project.acts[index].steps[0].text};
      }
      if (phase === 'agent-player') {
        const index=project.acts.findIndex(a=>a.draftBatchId&&a.kind!=='event');
        if(index<0)throw new Error('generated draft not found in export');
        playing=true;playAct=index;playStep=0;preparedAct=-1;await showPlayStep();
        await new Promise(r=>setTimeout(r,2500));
        if(stageError||!stage.weather.active||stage.weatherSettings.type!=='rain')throw new Error('generated scene or weather not playable');
        if(music.paused)throw new Error('generated BGM did not play');
        return {ok:true,act:project.acts[index].name,generatedDialogue:project.acts[index].steps[0].text,weather:stage.weatherSettings.type,musicPlaying:!music.paused,sceneError:stageError};
      }
      if (phase === 'agent-editor') {
        const assert=(value,label)=>{if(!value)throw new Error(label);};
        storyAssistant.render();
        document.querySelector('#assistant-source-name').value='港口故事';
        document.querySelector('#assistant-source-text').value='# 港口的急报\n绯音：我们必须马上离开！\n澄夏：等一下，我还没有看完信。\n雨越下越大，港口的电台传来消息。';
        await storyAssistant.click('assistant-source-paste');
        const before=JSON.stringify(project),count=project.acts.length;
        await storyAssistant.click('assistant-offline');
        assert(document.querySelector('#assistant-preview').textContent.includes('没有使用 AI'),'offline helper is not labelled');
        await storyAssistant.click('assistant-apply');
        assert(project.acts.length>count,'draft not appended');
        assert(project.assetFolders.filter(f=>f.type==='voice').every(f=>f.locked),'voice folders unprotected');
        await restoreEditorHistory(-1);assert(JSON.stringify(project)===before,'draft undo did not restore source project');
        await restoreEditorHistory(1);assert(project.acts.length>count,'draft redo failed');
        await restoreEditorHistory(-1);
        const context=await storyAssistant.call('get_project');
        const stale=await storyAssistant.call('propose_draft',{expectedRevision:context.revision,draft:{schemaVersion:1,acts:[{name:'冲突测试',steps:[{speaker:'旁白',text:'不可覆盖'}]}]}});
        project.name+=' · 未保存修改';markDirty({label:'测试作者同时修改'});
        let blocked=false;try{await storyAssistant.call('apply_draft',{proposalId:stale.proposalId,expectedRevision:stale.revision});}catch{blocked=true;}
        assert(blocked&&project.acts.length===count,'stale draft overwrote author edits');
        storyAssistant.render();await storyAssistant.click('assistant-toggle');
        assert(storyAssistant.isEnabled(),'native agent bridge not enabled');
        await storyAssistant.click('assistant-toggle');assert(!storyAssistant.isEnabled(),'agent disconnect failed');
        await storyAssistant.click('assistant-toggle');assert(storyAssistant.isEnabled(),'agent reconnect failed');
        const restoredConnection=await bridge('init');storyAssistant.setConnection(restoredConnection.agent);
        assert(storyAssistant.isEnabled(),'agent state lost on initialization');
        await save();
        return {ok:true,sourceImport:true,draftPreview:true,appendPreserved:true,undoRedo:true,staleWriteRejected:true,lockedVoiceFolders:true,agentEnabled:true};
      }
      if (phase === 'protected-editor') {
        const badge = document.querySelector('.editor-feedback');
        if (!badge || !feedbackGroup || badge.querySelector('strong').textContent !== feedbackGroup || !badge.textContent.includes('Bug反馈交流群')) throw new Error('feedback badge missing');
        const rect = badge.getBoundingClientRect(), topbar = document.querySelector('.topbar');
        if (rect.right > window.innerWidth || topbar.scrollWidth > topbar.clientWidth + 2) throw new Error('feedback badge toolbar overflow');
        await save();
        return { ok: true, feedbackGroup, badgeRight: rect.right, viewport: window.innerWidth, nativeBranding: true, saved: true };
      }
      if (phase.startsWith('mouth-')) return runMouthSmoke(phase);
      if (phase === 'voices-player') {
        playing = true; playAct = 0; playStep = 0; preparedAct = -1; await showPlayStep();
        for (let n = 0; n < 100 && (voice.paused || !voice.duration); n++) await new Promise(r => setTimeout(r, 50));
        if (asset(project.acts[0].steps[0].voiceId)?.type !== 'voice' || voice.paused || !voice.duration) throw new Error('exported character voice did not play');
        const result = { ok: true, duration: voice.duration, src: voice.src, voiceType: asset(project.acts[0].steps[0].voiceId).type };
        voice.pause(); return result;
      }
      if (phase === 'voices-editor') return runDialogueVoiceSmoke();
      if (phase === 'history-editor') return runEditorHistorySmoke();
      if (phase === 'history-portrait') return runPortraitHistorySmoke();
      const assert = (condition, message) => { if (!condition) throw new Error(message); };
      if (phase.startsWith('events-')) {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const waitFor = async predicate => { for (let n = 0; n < 100 && !predicate(); n++) await wait(100); assert(predicate(), 'scene did not finish loading'); };
        const find = (type, burst = false) => project.acts.findIndex(a => isEvent(a) && a.event.type === type && Boolean(a.event.burst) === burst);
        const open = async index => { closePlayerModal(); document.querySelector('#player-modal')?.remove();
          playing = true; playAct = index; playStep = 0; preparedAct = -1; restoredEventRemaining = undefined; await showPlayStep(); };
        const locked = () => {
          const index = playAct;
          next(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          document.querySelector('#scene-bg').click(); events.confirm();
          assert(playAct === index, 'forced reading bypassed');
          assert(document.querySelector('[data-action="event-confirm"]').disabled, 'continue button not disabled');
        };
        const scene = () => {
          assert(getComputedStyle(document.querySelector('#stage-canvas')).visibility === 'hidden', 'actor canvas still visible');
          assert(getComputedStyle(document.querySelector('#dialogue')).visibility === 'hidden', 'dialogue still visible');
          assert(getComputedStyle(document.querySelector('#scene-bg')).filter.includes('blur('), 'background not blurred');
          assert(!stage.weather?.active && !stage.weather?.audible, 'weather leaked into event');
        };
        if (phase === 'events-editor') {
          playing = false; mode = 'editor'; activePanel = 'story'; selectedAct = find('news'); renderEditor(); await wait(900);
          assert(document.querySelector('[data-event-field="type"]'), 'event inspector missing');
          const initial = project.acts.length;
          await handleEventAction('event-add', {}); const addedId = act().id;
          assert(isEvent(act()) && project.acts.length === initial + 1, 'event insertion failed');
          await handleEventAction('event-duplicate', {});
          assert(act().id !== addedId && project.acts.length === initial + 2, 'duplicate reused IDs');
          project.acts.splice(selectedAct - 1, 2); selectedAct = find('news'); renderSidebar(); renderInspector(); await updatePreview();
          assert(project.acts.length === initial, 'test cleanup failed');
          const newsId = act().id; reorderStory('act', selectedAct, 0, false);
          assert(project.acts[0].id === newsId && act().id === newsId, 'reorder lost selection');
          reorderStory('act', 0, 1, true); assert(project.acts[1].id === newsId, 'reorder back failed');
          const data = JSON.parse(JSON.stringify(project));
          assert(data.acts.filter(isEvent).length === 4 && data.acts.find(a => a.event?.burst).event.declarations.length === 29, 'event data lost');
          assert(!library.input(document.createElement('input')), 'unexpected library input');
          markDirty(); await save();
          return { ok: true, insertion: true, duplicateIds: true, serialization: true, events: 4 };
        }
        if (phase === 'events-news') {
          playing = false; mode = 'player'; renderPlayer(); await wait(500);
          const index = find('news'); await open(index); scene(); locked();
          const started = performance.now();
          await wait(300); assert(!music.paused && music.src.includes('atmosphere.wav'), 'event music did not play');
          const master = audioSettings.master; audioSettings.master = 0; applyAudioSettings(); assert(music.volume === 0, 'event music mute failed'); audioSettings.master = master; applyAudioSettings();
          renderSettingsModal(); const before = events.remaining(); await wait(1100);
          assert(Math.abs(events.remaining() - before) < .12, 'timer kept running in settings');
          assert(parseInt(getComputedStyle(document.querySelector('#player-modal')).zIndex) > parseInt(getComputedStyle(document.querySelector('#world-event')).zIndex), 'settings hidden behind event');
          closePlayerModal(); await wait(250); locked();
          autoPlay = true; scheduleAutoAdvance(project.acts[playAct].steps[0]); assert(!autoTimer, 'autoplay scheduled event skip'); autoPlay = false;
          await wait(3400); assert(events.remaining() === 0 && !document.querySelector('[data-action="event-confirm"]').disabled, 'news did not unlock');
          const result = { ok: true, requiredSeconds: 3, remaining: events.remaining(), pausedInSettings: true, resistedKeyboardAndAutoplay: true, elapsedMs: performance.now() - started };
          // Leave the newspaper onscreen for the native screenshot.
          return result;
        }
        if (phase === 'events-war') {
          const index = find('war');
          closePlayerModal(); playing = true; playAct = index; playStep = 0; preparedAct = -1;
          const pendingDisplay = showPlayStep();
          assert(events.remaining() === 0 && events.diagnostics().ready, 'war got a countdown');
          assert(events.confirm(), 'war could not close immediately during entrance');
          assert(playAct === index + 1, 'war did not advance'); await pendingDisplay; await wait(800);
          await open(index); scene();
          assert(!document.querySelector('.event-watch'), 'war has eye countdown');
          assert(document.querySelectorAll('.crt-flags img').length === 2, 'flags missing');
          return { ok: true, immediateClose: true, countdown: false, flags: 2 };
        }
        if (phase === 'events-burst') {
          const index = find('war', true); await open(index); await wait(7400);
          const d = events.diagnostics(); assert(d.received === 30, 'burst messages incomplete');
          assert(d.windows <= 8, 'burst windows unbounded');
          assert(document.querySelector('.war-message-count').textContent.includes('30 / 30'), 'message count wrong');
          return { ok: true, received: d.received, liveWindows: d.windows, closeAllEnabled: !document.querySelector('[data-action="event-confirm"]').disabled };
        }
        if (phase === 'events-major') {
          await open(find('major')); scene(); locked();
          const started = performance.now(); await wait(4300); locked();
          assert(events.remaining() > 4, 'major gate too short');
          await wait(6100); assert(events.remaining() === 0 && !document.querySelector('[data-action="event-confirm"]').disabled, 'major did not unlock after 10 seconds');
          assert(document.querySelector('.broadcast-copy blockquote'), 'major quote missing');
          return { ok: true, requiredSeconds: 10, elapsedMs: performance.now() - started, resistedEarlyClose: true };
        }
        if (phase === 'events-save') {
          await open(find('news')); await wait(950); renderSaveModal('save');
          const before = events.remaining(), slot = snapshotSlot();
          assert(before > 0 && slot.eventRemaining > 0 && slot.actId === project.acts[playAct].id, 'event snapshot missing');
          const slots = readSaveSlots(); slots[17] = slot; localStorage.setItem(saveKey(), JSON.stringify(slots));
          stopPlay(); loadSlot(17); await wait(850);
          assert(events.active() && events.remaining() <= before + .05 && events.remaining() > before - .7, 'saved countdown not restored');
          locked(); await wait(2600); const eventId = project.acts[playAct].id; events.confirm(); await waitFor(() => !transitioning && !events.active());
          assert(loadLifetimeProgress().completedEventIds.includes(eventId), 'event completion not stored');
          assert(!loadLifetimeProgress().viewedDialogueIds.includes(slot.stepId), 'event counted as dialogue');
          assert(!events.active() && !document.querySelector('.stage-frame').classList.contains('event-mode'), 'event overlay leaked into dialogue');
          return { ok: true, savedRemaining: before, loadedRemainingPreserved: true, completedEventId: eventId, normalDialogueRestored: true };
        }
        if (phase === 'events-flow') {
          const old = [...project.acts];
          try {
            const first = structuredClone(old[find('war')]), last = structuredClone(first); first.id = uid(); last.id = uid(); last.steps[0].id = uid();
            project.acts = [first, old[0], last]; playing = false; await showTitleScene(true);
            startPlay(); assert(isEvent(project.acts[playAct]) && events.active(), 'first event failed');
            events.confirm(); await waitFor(() => !transitioning && playAct === 1 && !events.active()); assert(stage.weather?.active && stage.visibleRecords.size > 0, 'actors/weather not restored after event');
            finishTyping(); next(); await wait(800); assert(playAct === 2 && events.active(), 'last event failed');
            events.confirm(); await wait(900); assert(!playing && !events.active() && document.querySelector('.stage-frame').classList.contains('title-mode'), 'last event did not finish story');
          } finally { project.acts = old; }
          const stats = progressStatistics(); assert(stats.acts.length === 4 && stats.total === 4, 'events polluted chapter dialogue counts');
          renderProgressModal(); assert(document.querySelectorAll('.chapter-card').length === 4, 'events shown as chapters');
          closePlayerModal(); await wait(250); await open(find('news'));
          return { ok: true, firstAndLastEvent: true, weatherRestored: true, chapterCards: stats.acts.length, dialogueTotal: stats.total };
        }
        if (phase === 'events-media') {
          const index = find('major'); const e = project.acts[index].event;
          const old = { ...e }, oldAssets = [...project.assets];
          project.assets.push({ id: 'event-video-test', name: 'test-video.webm', type: 'video', path: 'assets/events/test-video.webm' });
          try {
            const response = await fetch(assetUrl(asset('event-video-test'))), data = await response.arrayBuffer();
            assert(response.ok && data.byteLength > 100, `test video resource failed: ${response.status}, ${data.byteLength}`);
            const expected = await (await fetch(window.__eventVideo)).arrayBuffer();
            const prefix = Array.from(new Uint8Array(data).slice(0,12));
            assert(data.byteLength === expected.byteLength && prefix.join() === Array.from(new Uint8Array(expected).slice(0,12)).join(), `video bytes changed: ${data.byteLength}/${expected.byteLength}, ${prefix}`);
            e.videoId = 'event-video-test'; e.seId = e.bgmId; e.voiceId = e.bgmId;
            playing = false; mode = 'player'; renderPlayer(); await wait(400); await open(index); await wait(250);
            const video = document.querySelector('#world-event video');
            assert(video?.readyState >= 2 && !video.paused && video.muted, `event video did not play (${data.byteLength} bytes; ${prefix}): ${document.querySelector('#world-event')?.dataset.mediaError || JSON.stringify({ready:video?.readyState,paused:video?.paused,ended:video?.ended,time:video?.currentTime,duration:video?.duration})}`);
            assert(eventEffects.size === 1 && !voice.paused, 'event effect/narration did not play');
            renderSettingsModal(); await wait(250); assert(video.paused, 'video did not pause in settings');
            closePlayerModal(); await wait(250); assert(!video.paused, 'video did not resume');
            stopPlay(); assert(video.paused && voice.paused && eventEffects.size === 0, 'event media kept playing after exit');
            return { ok: true, videoPlayed: true, pausedAndResumed: true, narrationAndEffects: true, stoppedOnExit: true };
          } finally { project.acts[index].event = old; project.assets = oldAssets; }
        }
      }
      if (phase.startsWith('weather-')) {
        const type = phase.slice(8);
        const wait = () => new Promise(resolve => setTimeout(resolve, 1000));
        if (type === 'depth') {
          closePlayerModal(); playing=false; activePanel='story'; await stage.showCast([], '', false);
          stage.setRenderSettings({...act().render,outline:0,paintEffect:'none',shadowEnabled:false});
          stage.setWeather({...weatherDefaults,type:'rain',intensity:1}); await wait();
          stage.renderer.render(stage.scene,stage.camera);
          const gl=stage.renderer.getContext(), size={x:stage.renderer.domElement.width,y:stage.renderer.domElement.height};
          const pixels=new Uint8Array(size.x*size.y*4);
          gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
          let visible=0;for(let i=3;i<pixels.length;i+=4) if(pixels[i]>8)visible++;
          assert(visible>1000,'rain shader produced no visible particles');
          assert(gl.getError()===gl.NO_ERROR,'weather GPU error');
          await showTitleScene(true);
          return {ok:true,rainPixels:visible,gpuDepthTest:true};
        }
        if (type === 'editor') {
          stopPlay(); mode='editor'; selectedAct=0; selectedStep=0; activePanel='story'; renderEditor();
          assert(project.acts.every(a => normalizeWeather(a.weather).type==='none'), 'legacy weather not disabled');
          const picker=document.querySelector('[data-weather="type"]');
          picker.value='rain'; picker.dispatchEvent(new Event('input',{bubbles:true})); await wait();
          const strength=document.querySelector('[data-weather="intensity"]');
          strength.value=75; strength.dispatchEvent(new Event('input',{bubbles:true}));
          assert(act().weather.type==='rain' && act().weather.intensity===.75,'weather editor failed');
          assert(stage.weather.particles.geometry.instanceCount>0 && stage.element.style.visibility==='visible','weather preview missing');
          assert(!stage.weather.audible,'editor weather sound should be silent');
          const firstId=act().id;
          selectedAct=1; renderSidebar();renderInspector();await updatePreview();
          assert(stage.weatherSettings.type==='none' && !stage.weather.active,'weather leaked into next act');
          selectedAct=0;renderSidebar();renderInspector();await updatePreview();
          assert(act().id===firstId && stage.weatherSettings.type==='rain','weather lost after act switch');
          await save(); document.querySelector('.weather-editor')?.scrollIntoView({block:'start'}); await wait();
          return {ok:true,independentActs:true,savedWeather:act().weather};
        }
        if (type==='lifecycle') {
          const windOriginals=[...stage.weather.windJoints].map(([joint,original])=>({joint,power:original.power,dir:original.dir.clone()}));
          await showTitleScene(false);
          assert(!stage.weather.active && !stage.weather.audible,'weather leaked into title');
          assert(windOriginals.every(({joint,power,dir})=>joint.settings.gravityPower===power && joint.settings.gravityDir.equals(dir)),'weather wind changed original model settings');
          activePanel='characters'; await showCharacterEditorPreview();
          assert(!stage.weather.active,'weather leaked into gallery');
          activePanel='story'; hideCharacterEditorPreview();
          await updatePreview();
          setSceneWeather({...act(),weather:{...act().weather,type:'none'}});
          await stage.showCast([], '',false);
          setSceneWeather({...act(),weather:{...act().weather,type:'snow'}});
          assert(stage.weather.active && stage.element.style.visibility==='visible','empty cast hid snow');
          stage.setRenderSettings({...act().render,paintEffect:'oil',paintStrength:.65});
          showBackground(asset(act().backgroundId));await wait();
          assert(stage.paintEnabled && stage.weather.active,'oil mode lost weather');
          stage.setRenderSettings(act().render);
          await updatePreview();
          const scene=project.acts[0]; scene.weather=normalizeWeather({...scene.weather,type:'rain'});
          playing=true; playAct=0;playStep=0;preparedAct=-1;await showPlayStep();await wait();
          assert(stage.weather.audible,'player ambient sound missing');
          const master=audioSettings.master;
          audioSettings.master=0; applyAudioSettings();assert(stage.weather.audio.volume===0 && stage.weather.audioLevel===0,'mute failed');
          audioSettings.master=master;applyAudioSettings();stopPlay();
          assert(!stage.weather.audible,'weather sound leaked after stop');
          return {ok:true,titleAndGalleryClear:true,emptyCast:true,oilCompatible:true,playerAudioAndMute:true};
        }
        assert(Object.hasOwn(weatherNames,type),'unknown weather');
        mode='player';renderPlayer();await wait();
        project.acts[0].weather=normalizeWeather({...project.acts[0].weather,type,intensity:.7,wind:.6,ground:.82});
        playing=true;playAct=0;playStep=0;preparedAct=-1;await showPlayStep();await wait();
        assert(stage.weatherSettings.type===type && stage.weather.active,'player weather missing');
        const text=document.querySelector('#dialogue-text');
        assert(parseInt(getComputedStyle(document.querySelector('#dialogue')).zIndex)>0,'weather covers dialogue');
        return {ok:true,type,particles:stage.weather.particles.geometry.instanceCount,depthTest:stage.weather.particles.material.depthTest,
          audio:stage.weather.audible,canvasVisible:stage.element.style.visibility==='visible',subtitle:text.textContent};
      }
      if (phase === 'library-search') {
        closePlayerModal(); mode = 'editor'; renderEditor();
        const old = project.characters[0].name;
        document.querySelector('#text-search').value = old;
        await library.click('search-open', {});
        assert(document.querySelectorAll('.search-results article').length > 0, 'search found no role name');
        document.querySelector('#replace-with').value = '批量改名验证';
        await library.click('search-replace', {});
        assert(project.characters[0].name === '批量改名验证', 'replacement failed');
        await library.click('search-undo', {});
        assert(project.characters[0].name === old, 'undo failed');
        return { ok: true, replaceAndUndo: true };
      }
      if (phase === 'library-editor') {
        await library.click('search-close', {}); activePanel = 'knowledge'; renderSidebar(); renderInspector();
        assert(document.querySelector('[data-book-field="unlockActId"]'), 'book editor missing');
        return { ok: true, bookCount: project.knowledgeBooks.length };
      }
      if (phase === 'library-shelf') {
        mode = 'player'; renderPlayer(); await new Promise(resolve => setTimeout(resolve,1000));
        for (let i = 0; i < 70 && !document.querySelector('#act-loading').classList.contains('hidden'); i++) await new Promise(resolve => setTimeout(resolve,100));
        const bookButton = document.querySelector('.knowledge-title-button');
        const bounds = bookButton.getBoundingClientRect();
        const icon = bookButton.querySelector('svg').getBoundingClientRect();
        assert(icon.width >= 24 && icon.height >= 24, 'book icon collapsed');
        assert(getComputedStyle(bookButton).pointerEvents === 'auto', 'book button cannot receive clicks');
        assert(document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)?.closest('[data-action="knowledge-open"]') === bookButton, 'book button is covered');
        bookButton.click();
        await new Promise(resolve => setTimeout(resolve,300));
        assert(document.querySelector('.book-library'), 'title book button did not open library');
        assert(document.querySelector('.book-locked'), 'locked cover missing');
        await library.click('book-read', { dataset: { index: '0' } });
        assert(!document.querySelector('#book-reader'), 'locked PDF was opened');
        await new Promise(resolve => setTimeout(resolve,1200));
        return { ok: true, lockedBookBlocked: true, titleButtonHit: true, iconWidth: icon.width };
      }
      if (phase === 'library-reader') {
        lifetimeProgress.viewedDialogueIds = project.acts[0].steps.map(line => line.id);
        await library.openBook(0);
        assert(document.querySelectorAll('.book-paper canvas').length === 2, 'PDF spread missing');
        return { ok: true, pages: document.querySelector('#book-page-state').textContent };
      }
      if (phase === 'library-turn') {
        await library.click('book-next', {});
        assert(document.querySelector('#book-page-state').textContent.startsWith('3'), 'next spread failed');
        await library.click('book-next', {});
        assert(document.querySelector('#book-page-state').textContent.startsWith('5') && document.querySelectorAll('.book-paper canvas').length === 1, 'odd last page failed');
        assert(document.querySelector('[data-action="book-next"]').disabled, 'last page next button enabled');
        await library.click('book-prev', {});
        await library.click('book-prev', {});
        assert(document.querySelector('#book-page-state').textContent.startsWith('1'), 'previous spread failed');
        return { ok: true, forwardAndBackward: true, oddLastPage: true };
      }
      if (phase === 'audio') {
        assert(mode === 'player' && !playing, 'test must start on untouched title screen');
        const titleButton = getComputedStyle(document.querySelector('#player-start [data-action="play"]'));
        assert(titleButton.color === 'rgb(0, 0, 0)' && titleButton.backdropFilter.includes('blur(0px)'), 'title button must start clear with black text');
        for (let i = 0; i < 50 && (music.paused || music.currentTime <= 0); i++) await new Promise(resolve => setTimeout(resolve,100));
        assert(!music.paused && music.currentTime > 0 && music.src === assetUrl(asset(project.title.bgmId)), 'title music did not autoplay');
        return { ok: true, titleMusicPlaying: true, time: music.currentTime };
      }
      if (phase === 'settings') {
        document.querySelector('#player-start [data-action="settings"]').click();
        const body = document.querySelector('.settings-body');
        const box = document.querySelector('.settings-box');
        assert(body && getComputedStyle(body).overflowY === 'auto', 'settings is not scrollable');
        for (const node of body.querySelectorAll('.volume-line,.volume-line output,.field > span,p'))
          assert(getComputedStyle(node).color === 'rgb(0, 0, 0)', 'settings text must be pure black');
        assert(getComputedStyle(box).animationName === 'menu-panel-in', 'popup transition missing');
        await new Promise(resolve => setTimeout(resolve,300));
        body.scrollTop = body.scrollHeight;
        await new Promise(resolve => requestAnimationFrame(resolve));
        const bounds = body.getBoundingClientRect();
        const button = body.querySelector('[data-action="toggle-fullscreen"]').getBoundingClientRect();
        assert(button.top >= bounds.top && button.bottom <= bounds.bottom + 1, 'fullscreen button still clipped after scrolling');
        return { ok: true, scrolling: body.scrollHeight > body.clientHeight, fullscreenVisible: true, height: body.clientHeight };
      }
      if (['music','characters','chapters','saves','story'].includes(phase)) {
        closePlayerModal();
        await new Promise(resolve => setTimeout(resolve,200));
        if (phase === 'chapters') renderProgressModal();
        else if (phase === 'saves') renderSaveModal('load');
        else if (phase === 'music' || phase === 'characters') {
          galleryTab = phase; renderGalleryModal();
        } else {
          playing = true; playAct = 0; playStep = 0; preparedAct = -1;
          await showPlayStep(); finishTyping();
          const dialogue = getComputedStyle(document.querySelector('#dialogue'));
          assert(dialogue.borderTopWidth === '0px' && dialogue.backgroundImage === 'none', 'default dialogue gained a frame');
          assert(getComputedStyle(document.querySelector('.scene-quick-actions button')).backdropFilter.includes('blur('), 'bottom glass controls missing');
          const subtitle = getComputedStyle(document.querySelector('#dialogue-text'));
          assert(subtitle.color === 'rgb(255, 255, 255)' && subtitle.textShadow.includes('rgb(0, 0, 0)'), 'subtitle needs white text and black shadow');
          return { ok: true, borderlessDialogue: true, glassControls: true };
        }
        await new Promise(resolve => setTimeout(resolve,500));
        const panel = getComputedStyle(document.querySelector('#player-modal > .modal-box'));
        assert(panel.backdropFilter.includes('blur'), 'glass modal missing');
        return { ok: true, phase, glass: panel.backdropFilter };
      }
      closePlayerModal();
      assert(document.querySelector('#player-modal')?.classList.contains('closing'), 'close transition missing');
      await new Promise(resolve => setTimeout(resolve,200));
      assert(!document.querySelector('#player-modal'), 'closed popup did not disappear');
      document.querySelector('#player-start [data-action="gallery"]').click();
      await new Promise(resolve => setTimeout(resolve,300));
      assert(getComputedStyle(document.querySelector('.gallery-box')).animationName === 'menu-panel-in', 'gallery transition missing');
      return { ok: true, closeAnimation: true, galleryAnimation: true };
    },
    __vrmSmokeChapters: async (phase, testCover = false) => {
      const assert = (condition, message) => { if (!condition) throw new Error(message); };
      if (phase === 'editor') {
        assert(project.acts.length >= 2, 'fixture needs two chapters');
        assert(project.acts[0].render !== project.acts[1].render, 'chapter settings share an object');
        selectedAct = 0; activePanel = 'story'; renderSidebar(); renderInspector(); await updatePreview();
        assert(document.querySelectorAll('.act-dialogues').length === 1, 'accordion did not fold');
        if (testCover) {
          const otherCover = project.acts[1].coverImageId;
          await uploadActCover();
          assert(asset(act().coverImageId)?.type === 'image' && project.acts[1].coverImageId === otherCover, 'cover upload failed or affected another chapter');
        }
        const original = project.acts[1].render.brightness;
        activePanel = 'render'; renderSidebar(); renderInspector();
        const slider = document.querySelector('[data-render="brightness"]');
        slider.value = 135; slider.dispatchEvent(new Event('input', { bubbles: true }));
        assert(project.acts[0].render.brightness === 135 && project.acts[1].render.brightness === original, 'color leaked to another chapter');
        const warmth = document.querySelector('[data-render="temperature"]');
        warmth.value = 35; warmth.dispatchEvent(new Event('input', { bubbles: true }));
        assert(document.querySelector('#stage-canvas').style.filter.includes('scene-temperature'), 'model color filter not applied');
        assert(document.querySelector('#scene-bg').style.filter === document.querySelector('#stage-canvas').style.filter, 'model and background color differ');
        warmth.value = 0; warmth.dispatchEvent(new Event('input', { bubbles: true }));
        selectedAct = 1; renderSidebar(); renderInspector(); await updatePreview();
        assert(document.querySelector('#scene-bg').style.filter.includes(`brightness(${original}%)`), 'chapter switch kept previous color');
        selectedAct = 0; activePanel = 'story'; renderSidebar(); renderInspector(); await updatePreview();
        const restored = JSON.parse(JSON.stringify(project));
        assert(restored.acts[0].render.brightness === 135 && restored.acts[0].coverImageId === project.acts[0].coverImageId, 'chapter fields lost on serialization');
        await save();
        return { ok: true, accordion: document.querySelectorAll('.act-dialogues').length, independentColors: restored.acts.map(a => a.render.brightness) };
      }
      if (phase === 'render') {
        activePanel = 'render'; renderSidebar(); renderInspector(); await updatePreview();
        return { ok: true, autoLight: act().render.autoLight };
      }
      if (phase === 'portraits') {
        mode = 'editor'; selectedCharacter = 0; activePanel = 'characters'; renderEditor();
        await Promise.all([...portraitJobs.values()]);
        const item = project.characters.find(character => character.modelId);
        assert(item, 'fixture needs a model');
        await ensureCharacterPortrait(item, true);
        const id = item.portraitId, path = asset(id)?.path, revision = asset(id)?.revision;
        item.galleryPoseFrame = Math.max(1, (Number(item.galleryPoseFrame) || 1) + 1);
        await ensureCharacterPortrait(item, true);
        await ensureCharacterPortrait(item, true);
        assert(item.portraitId === id && asset(id)?.path === path, 'reshoot changed portrait identity');
        assert(asset(id)?.revision !== revision, 'reshoot kept cached image');
        assert(project.assets.filter(asset => asset.generatedPortrait && asset.characterId === item.id).length === 1, 'reshoot duplicated portrait');
        assert(!project.assets.some(asset => asset.name === '自动头像.png' && !assetIsReferenced(asset.id)), 'unused legacy portraits remain');
        await save(); renderSidebar(); renderInspector(); await updatePreview();
        return { ok: true, id, path, count: project.assets.filter(asset => asset.generatedPortrait && asset.characterId === item.id).length };
      }
      if (phase === 'player') {
        mode = 'player'; lifetimeProgress = null;
        localStorage.removeItem(lifetimeKey()); renderPlayer();
        playing = true; playAct = 0; playStep = 0; await showPlayStep();
        renderProgressModal();
        assert(document.querySelectorAll('.chapter-card').length === project.acts.length, 'chapter cards missing');
        assert(document.querySelector('#chapter-card-1').disabled, 'unvisited chapter unlocked');
        playAct = 1; playStep = 0; closePlayerModal(); await showPlayStep(); renderProgressModal();
        assert(!document.querySelector('#chapter-card-1').disabled, 'visited chapter stayed locked');
        return { ok: true, cards: project.acts.length, progress: progressStatistics() };
      }
      const before = progressStatistics().seen;
      document.querySelector('#chapter-card-0').click();
      for (let i = 0; i < 100 && transitioning; i++) await new Promise(resolve => setTimeout(resolve, 50));
      assert(playAct === 0 && playStep === 0 && playing && !saveModalMode, 'chapter replay failed');
      assert(progressStatistics().seen === before, 'replay erased lifetime progress');
      assert(document.querySelector('#scene-bg').style.filter.includes('brightness(135%)'), 'replay used wrong chapter color');
      clearTyping(); clearAutoAdvance();
      return { ok: true, replayAct: playAct, replayStep: playStep, lifetimeSeen: before };
    }
  });
window.__vrmDiagnostics = () => ({
  directory,
  editorAutoSaveMinutes: editorSettings.autoSaveMinutes,
  dirty,
  project: project?.name,
  mode,
  modelLoaded: Boolean(stage?.vrm),
  modelId: stage?.currentModelId || '',
  motionPlaying: Boolean(stage?.mixer?._actions?.some(action => action.isRunning())),
  stageError,
  expressions: stage?.expressions() || [],
  dialogue: document.querySelector('#dialogue-text')?.textContent || '',
  typing: Boolean(typingTimer),
  textSpeed,
  assetDockVisible: Boolean(document.querySelector('.asset-dock')?.getBoundingClientRect().height),
  assetDockScrollHeight: document.querySelector('#asset-dock-body')?.scrollHeight || 0,
  assetDockHeight: document.querySelector('#asset-dock-body')?.clientHeight || 0,
  assetThumbnails: document.querySelectorAll('.asset-dock .asset-thumbnail').length,
  vrmEmbeddedThumbnails: document.querySelectorAll('.vrm-embedded-thumbnail').length,
  visibleImageAssets: project ? byType('image').length : 0,
  hiddenPortraitAssets: project?.assets.filter(a => internalPortrait(project, a)).length || 0,
  speakerPortraitVisible: Boolean(document.querySelector('#speaker-portrait:not(.hidden)')),
  speakerPortraitSrc: document.querySelector('#speaker-portrait img')?.getAttribute('src') || '',
  characterPortraitIds: project?.characters.map(item => ({ id:item.id, modelId:item.modelId,
    portraitId:item.portraitId, portraitSource:item.portraitSource, portraitPoseKey:item.portraitPoseKey,
    galleryMotionId:item.galleryMotionId, galleryPoseFrame:item.galleryPoseFrame })) || [],
  galleryFrameControl: (() => { const slider = document.querySelector('[data-gallery-adjust="galleryPoseFrame"]');
    return slider ? { frame: Number(slider.value), max: Number(slider.max), disabled: slider.disabled,
      number: Number(document.querySelector('[data-gallery-frame-number]')?.value),
      label: document.querySelector('[data-gallery-output="galleryPoseFrame"]')?.textContent } : null; })(),
  visibleActorIds: [...(stage?.visibleRecords.keys() || [])],
  assets: project?.assets.length || 0
  ,playing
  ,playerStartClass: document.querySelector('#player-start')?.className || ''
  ,playControlsClass: document.querySelector('#play-controls')?.className || ''
  ,stageWidth: Math.round(document.querySelector('.stage-frame')?.getBoundingClientRect().width || 0)
  ,stageHeight: Math.round(document.querySelector('.stage-frame')?.getBoundingClientRect().height || 0)
  ,saveSlotCount: mode === 'player' ? readSaveSlots().length : 0
  ,filledSaveSlots: mode === 'player' ? readSaveSlots().filter(Boolean).length : 0
  ,visibleSaveSlots: document.querySelectorAll('.save-slot').length
  ,autoSaveFilled: mode === 'player' ? Boolean(readSaveSlots()[0]?.auto) : false
  ,autoSaveWriteDisabled: Boolean(document.querySelector('[data-action="save-slot"][data-index="0"]:disabled'))
  ,manualSlotTwoDisabled: Boolean(document.querySelector('[data-action="save-slot"][data-index="1"]:disabled'))
  ,toastText: document.querySelector('#toast')?.textContent || ''
  ,lastClickAction: window.__lastClickAction || ''
  ,playerAutoSaveActive: Boolean(playerAutoSaveTimer)
  ,recentProjectCount: recentProjects.length
  ,recentProjectButtons: document.querySelectorAll('[data-action="open-recent"]').length
  ,lifetimeProgress: mode === 'player' ? loadLifetimeProgress() : null
  ,event: events.diagnostics()
  ,progressStats: mode === 'player' ? progressStatistics() : null
  ,progressModalOpen: Boolean(document.querySelector('#player-modal.progress-modal'))
  ,galleryImageCount: project?.assets.filter(item => item.type === 'image' && item.galleryImage !== false).length || 0
  ,galleryCharacterPickerVertical: Boolean(document.querySelector('.gallery-character-picker') && getComputedStyle(document.querySelector('.gallery-character-picker')).flexDirection === 'column')
  ,saveModalMode
  ,transitioning
  ,preparedAct
  ,preloadedModels: stage?.modelCache?.size || 0
  ,visibleModels: [...(stage?.visibleRecords?.values() || [])].filter(record => record.vrm.scene.visible).length
  ,sceneModels: stage?.scene?.children.filter(node => !node.isLight).map(node => ({ name: node.name, visible: node.visible, type: node.type, uuid: node.uuid })) || []
  ,castSlots: Object.fromEntries(Object.entries(step()?.cast||{}).map(([slot,value])=>[slot,value.characterId]))
  ,castSettings: step()?.cast || {}
  ,visibleActors: [...(stage?.visibleRecords?.entries() || [])].map(([id, record]) => ({
    attachedProps:[...(record.attachedProps?.values()||[])].map(p=>({id:p.binding.id,assetId:p.binding.assetId,bone:p.bone.name,position:p.binding.position,worldPosition:p.root.getWorldPosition(new THREE.Vector3()).toArray()})),
    id, x: record.anchor.position.x, y: record.anchor.position.y, z: record.anchor.position.z,
    shadowGroundY: stage?.shadowGroundHeightAt(record.anchor.position.x, record.anchor.position.z) ?? null,
    scale: record.anchor.scale.x,
    yaw: record.anchor.rotation.y, motionPlaying: record.mixer._actions?.some(action => action.isRunning()) || false,
    anchorPosition: record.anchor.position.toArray(), motionRootPosition: record.motionRoot.position.toArray(),
    happy: record.vrm.expressionManager?.getValue('happy') ?? null,
    expressionBlending: Boolean(record.expressionBlend),
    positionBlending: Boolean(record.transformBlend),
    motionId: record.currentMotionId,
    motionOptions: record.currentMotionOptions,
    actionTime: record.currentAction?.time ?? null,
    actionDuration: record.currentAction?.getClip()?.duration ?? null,
    actionPaused: record.currentAction?.paused ?? null,
    currentMotionWeight: record.currentAction?.getEffectiveWeight() ?? null,
    fadingMotionCount: record.fadeOutActions.length,
    hipsLocalPosition: record.vrm.humanoid.getNormalizedBoneNode('hips')?.position.toArray() || null,
    leftFootWorldY: record.vrm.humanoid.getNormalizedBoneNode('leftFoot')?.matrixWorld.elements[13] ?? null,
    rightFootWorldY: record.vrm.humanoid.getNormalizedBoneNode('rightFoot')?.matrixWorld.elements[13] ?? null,
    leftFootWorld: (() => { const e = record.vrm.humanoid.getNormalizedBoneNode('leftFoot')?.matrixWorld.elements; return e ? [e[12], e[13], e[14]] : null; })(),
    rightFootWorld: (() => { const e = record.vrm.humanoid.getNormalizedBoneNode('rightFoot')?.matrixWorld.elements; return e ? [e[12], e[13], e[14]] : null; })(),
    footLockActive: Boolean(record.footLock),
    footIKResidual: [record.footLock?.left?.lastResidual ?? null, record.footLock?.right?.lastResidual ?? null]
  }))
  ,editorHistory: editorHistory.status()
  ,actOrder: project?.acts.map(item => item.id) || []
  ,stepOrder: act()?.steps.map(item => item.id) || []
  ,assetFolders: project?.assetFolders || []
  ,stepCastPositions: step()?.castPositions || {}
  ,editorCharacterPreviewVisible: Boolean(document.querySelector('#character-preview:not(.hidden)'))
  ,editorCharacterPreviewStoryTabs: document.querySelectorAll('#character-preview [data-action="preview-story"]').length
  ,editorCharacterPreviewModel: stage?.currentModelId || ''
  ,stepMotionOptions: step()?.motionOptions || {}
  ,motionAdvancedClosed: [...document.querySelectorAll('.motion-advanced')].every(node => !node.open)
  ,dialogueBottom: document.querySelector('#dialogue') ? getComputedStyle(document.querySelector('#dialogue')).bottom : ''
  ,renderSettings: project?.render || {}
  ,paintEffectActive: false
  ,weather: stage?.weatherSettings || normalizeWeather()
  ,weatherParticles: stage?.weather?.particles.geometry.instanceCount || 0
  ,weatherSound: Boolean(stage?.weather?.audible)
  ,paintBackgroundReady: Boolean(stage?.paintBackgroundTexture)
  ,paintPixelRatio: stage?.paintPixelRatio ?? null
  ,averageFrameMs: stage?.averageFrameMs ?? null
  ,shadowPlaneVisible: Boolean(stage?.shadowPlane?.visible)
  ,shadowMapEnabled: Boolean(stage?.renderer?.shadowMap?.enabled)
  ,shadowPlaneOpacity: stage?.shadowPlane?.material?.opacity ?? null
  ,shadowLightPosition: stage?.shadowLight?.position?.toArray() || null
  ,backgroundLightReady: Boolean(stage?.currentLightProfile)
  ,outlineEnabled: Boolean(stage?.outlineEffect?.enabled)
  ,renderPixelRatio: stage?.renderer?.getPixelRatio() || 0
  ,keyLightColor: stage?.keyLight?.color?.getHexString() || ''
  ,nextButtons: document.querySelectorAll('[data-action="next"]').length
  ,currentScale: stage?.activeRecord?.anchor.scale.x || 0
  ,currentX: stage?.activeRecord?.anchor.position.x || 0
  ,currentY: stage?.activeRecord?.anchor.position.y || 0
  ,currentZ: stage?.activeRecord?.anchor.position.z || 0
  ,currentYaw: stage?.activeRecord?.anchor.rotation.y || 0
  ,currentPitch: stage?.activeRecord?.anchor.rotation.x || 0
  ,cameraY: stage?.camera?.position.y || 0
  ,activePanel
  ,title: project?.title || {}
  ,titleMode: Boolean(document.querySelector('.stage-frame')?.classList.contains('title-mode'))
  ,titleMenuItems: document.querySelectorAll('.title-bottom-menu > *').length
  ,titleLogoImage: Boolean(document.querySelector('.title-logo-image'))
  ,titleExpressionSliders: document.querySelectorAll('[data-title-expression]').length
  ,titlePlayButtonHit: (() => {
    const button = document.querySelector('#player-start:not(.hidden) [data-action="play"]');
    if (!button) return false;
    const rect = button.getBoundingClientRect();
    return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('[data-action="play"]') === button;
  })()
  ,canvasVisible: document.querySelector('#stage-canvas')?.style.visibility !== 'hidden'
  ,audioSettings
  ,musicVolume: music.volume
  ,musicPlaying: !music.paused && music.currentTime > 0
  ,musicCurrentTime: music.currentTime
  ,voiceVolume: voice.volume
  ,autoPlay
  ,autoButtonText: document.querySelector('#auto-play-button')?.textContent || ''
  ,galleryTab
  ,galleryPage
  ,galleryTiles: document.querySelectorAll('.gallery-image-tile').length
  ,galleryLockedTiles: document.querySelectorAll('.gallery-image-tile.locked').length
  ,galleryLockedTracks: document.querySelectorAll('.gallery-track-list button.locked').length
  ,galleryCharacterSealed: Boolean(document.querySelector('.gallery-character-seal'))
  ,galleryLightbox: Boolean(document.querySelector('#gallery-lightbox'))
  ,galleryStoryTabs: document.querySelectorAll('.gallery-story-tabs button').length
  ,galleryStoryLocked: Boolean(document.querySelector('.gallery-story-locked'))
  ,galleryCharacterId
  ,galleryStoryIndex
  ,galleryCharacterLoaded: Boolean(galleryStage?.vrm)
  ,galleryTrackCount: galleryTracks().length
  ,galleryTrackIndex
  ,galleryMusicPlaying: !galleryMusic.paused
  ,galleryRepeatOne
  ,playCharacterLineCounts
  ,deepestSaveCounts: deepestSave() ? slotDialogueProgress(deepestSave()).counts : {}
  ,quickActionOrder: [...document.querySelectorAll('.scene-quick-actions [data-action]')].map(node => node.dataset.action)
  ,quickActionBottoms: [...document.querySelectorAll('.scene-quick-actions [data-action]')].map(node => Math.round(node.getBoundingClientRect().bottom))
  ,toonMaterials: [...(stage?.activeRecord?.materials?.keys() || [])].filter(material => material.isMToonMaterial).length
  ,toonFactor: [...(stage?.activeRecord?.materials?.keys() || [])].find(material => material.isMToonMaterial)?.shadingToonyFactor ?? null
  ,ambientIntensity: stage?.ambientLight?.intensity ?? null
  ,keyIntensity: stage?.keyLight?.intensity ?? null
  ,expressionSliders: document.querySelectorAll('[data-expression]').length
  ,happyWeight: stage?.vrm?.expressionManager?.getValue('happy') ?? null
  ,stepSize: step()?.size ?? null
  ,stepOffsetX: step()?.offsetX ?? null
  ,stepOffsetY: step()?.offsetY ?? null
  ,stepOffsetZ: step()?.offsetZ ?? null
  ,selectedStep
  ,stepCount: act()?.steps.length || 0
  ,selectedStepId: step()?.id || ''
  ,previousStepId: act()?.steps[selectedStep - 1]?.id || ''
  ,previousStepSize: act()?.steps[selectedStep - 1]?.size ?? null
  ,previousStepOffsetY: act()?.steps[selectedStep - 1]?.offsetY ?? null
  ,sameCharacterAsPrevious: selectedStep > 0 && step()?.characterId === act()?.steps[selectedStep - 1]?.characterId
  ,playAct
  ,playStep
});
init();

document.addEventListener('change',event=>{
  if(event.target.dataset.propTransform && event.target.dataset.mode==='fine'){event.target.value='0';delete event.target.__propFineBase;}
});

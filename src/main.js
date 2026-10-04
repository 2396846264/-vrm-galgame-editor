import * as THREE from 'three';
import {migrateTitleActors,newTitleActor} from './title-actors.js';
import {migrateDialogueCast, emptyDialogueCast, copyDialogueCast, setDialogueActor} from './dialogue-cast.js';
import {availablePropBones,propBoneLabels,propBone} from './character-props.js';
import './style.css';
import './skin.css';
import './layout.css';
import './vn-theme.css';
import './ios7-theme.css';
import './chapters.css';
import './menu-motion.css';
import './game-glass.css';
import './weather.css';
import './events.css';
import { createEvents, eventNames, eventSeconds, isEvent, normalizeEvent, newEvent } from './events.js';
import { normalizeWeather, weatherDefaults, weatherNames, weatherMood } from './weather.js';
import { colorDefaults, chapterRender, colorFilter, chapterUnlocked } from './chapters.js';
import { VRMStage, assetUrl, motionFrameInfo, captureVrmPortrait } from './renderer.js';
import { embeddedVrmThumbnail, internalPortrait } from './vrm-thumbnail.js';
import {validateEnvironmentLibrary} from './environment-operations.js';
import {createEnvironment,migrateEnvironments,validateEnvironment} from './environment-schema.js';
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
let selectedAct = 0;
let selectedStep = 0;
let selectedCharacter = 0;
let activePanel = 'story';
let propPreviewMode=false,selectedBindingPropId='';
const openAssetFolders = new Set(['unfiled:vrm', 'unfiled:motion', 'unfiled:image', 'unfiled:audio', 'unfiled:video']);
let dockInitializedProjectId = '';
let activeAssetType = 'image';
const currentAssetFolder = { image: '', vrm: '', fbxCharacter: '', sceneModel: '', motion: '', audio: '', voice: '', video: '' };
let draggingStory = null;
let playing = false;
let playAct = 0;
let playStep = 0;
let preparedAct = -1;
let transitioning = false;
let playRequest = 0;
let previewRequest = 0;
let titleRequest = 0;
let dirty = false;
let changeRevision = 0;
let saveInFlight = null;
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
  if (message.agentRequest) {
    const {id,name,arguments:args} = message.agentRequest;
    Promise.resolve().then(() => storyAssistant.call(name,args)).then(
      data => bridge('agentReply',{id,ok:true,data}),
      error => bridge('agentReply',{id,ok:false,error:error.message})
    ).catch(error=>toast(error.message,true));
    return;
  }
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
const storyAssistant = createStoryAssistant({project:()=>project,mode:()=>mode,escape,bridge,toast,
  revision:()=>changeRevision,dirty:()=>dirty,busy:()=>historyBusy||transitioning||playing,
  begin:()=>{editorHistory.seal();editorHistory.begin();},
  changed:label=>{normalize();markDirty({label});},
  refresh:async()=>{renderSidebar();renderInspector();await updatePreview();},
  selectAct:index=>{selectedAct=index;selectedStep=0;activePanel='story';},
  undo:restoreEditorHistory,history:()=>editorHistory.status(),save});
const step = () => act()?.steps[selectedStep];
const character = id => project.characters.find(item => item.id === id);
const options = (items, value, empty = '无') =>
  `<option value="">${escape(empty)}</option>${items.map(item =>
    `<option value="${escape(item.id)}" ${item.id === value ? 'selected' : ''}>${escape(item.name)}</option>`).join('')}`;
const byType = type => project.assets.filter(item => item.type === type && !internalPortrait(project, item));
const vrmThumbnails = new Map();
let thumbnailProject = null;
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
const castSlots = ['left', 'center', 'right'];
const castSlotLabels = { left: '左侧', center: '中间', right: '右侧' };
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
      <option value="bounded" ${settings.placement === 'free' ? '' : 'selected'}>限制大幅走位（默认）</option>
      <option value="free" ${settings.placement === 'free' ? 'selected' : ''}>完整保留动作走位</option></select></label>
    <p class="tip">限制走位只约束左右和前后，跳跃、坐下等上下动作照常播放。</p>
    <label class="motion-option-row"><span>脚掌固定</span><select data-motion-options="${escape(scope)}" data-motion-setting="feet">
      <option value="auto" ${settings.feet === 'lock' || settings.feet === 'free' ? '' : 'selected'}>自动（待机、说话等）</option>
      <option value="lock" ${settings.feet === 'lock' ? 'selected' : ''}>开启</option>
      <option value="free" ${settings.feet === 'free' ? 'selected' : ''}>关闭（允许迈步）</option></select></label>
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
  const transforms=[['size','大小',50,500,5],['offsetX','左右位置',-10,10,.01],['offsetY','上下位置',-10,10,.01],['offsetZ','前后位置',-100,100,.01],['yaw','左右转身',-120,120,1],['pitch','上下转角',-60,60,1]];
  return `<details class="title-actor-editor" open><summary>人物 ${index+1} · ${escape(asset(actor.modelId)?.name||'未选择模型')}</summary>
    ${field('人物模型',`<select data-title-actor-id="${actor.id}" data-title-actor-field="modelId">${options(actorModels(),actor.modelId,'不显示人物')}</select>`)}
    ${field('使用角色及其物品',`<select data-title-actor-id="${actor.id}" data-title-actor-field="characterId">${options(project.characters.filter(c=>c.modelId),actor.characterId,'直接使用模型')}</select>`)}
    ${field('人物动作',`<select data-title-actor-id="${actor.id}" data-title-actor-field="motionId">${options(byType('motion'),actor.motionId,'保持站立')}</select>`)}
    ${motionAdvanced(actor,`titleActor:${actor.id}`)}
    ${transforms.map(([key,label,min,max,step])=>{const value=key==='size'?Math.round(actor.size*100):actor[key];return `<label class="adjustment depth-adjustment"><span>${label}${key==='size'?' (%)':''}</span><input type="range" data-title-actor-id="${actor.id}" data-title-actor-adjust="${key}" min="${min}" max="${max}" step="any" value="${value}"><input class="depth-number" type="number" data-title-actor-id="${actor.id}" data-title-actor-adjust="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}精确数值"></label>`;}).join('')}
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
    ['系统设置', 'settings'], ['附加鉴赏', 'gallery'], ['游玩进度', 'play-progress'], ['退出游戏', 'exit-game']
  ];
  const hasSave = interactive && readSaveSlots().some(Boolean);
  const menu = items.map(([label, action]) => interactive
    ? `<button type="button" data-action="${action}" ${action === 'continue-game' && !hasSave ? 'disabled' : ''}>${label}</button>`
    : `<span>${label}</span>`).join('');
  return `${interactive ? '<button class="knowledge-title-button" data-action="knowledge-open" title="知识库" aria-label="打开知识库"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 5C8 2 3 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-2-7-1-10 1Z"/><path d="M12 5v15"/></svg></button>' : ''}${project.title.logoImageId === '__none__' ? '' : `<div class="title-logo-region">${logoMarkup}</div>`}<nav class="title-bottom-menu">${menu}</nav>`;
}
async function showTitleScene(interactive = false) {
  stage?.stopTalking();
  events.cancel();
  eventMusicActive = false;
  setSceneWeather();
  applySceneColor(colorDefaults);
  const request = ++titleRequest;
  const frame = document.querySelector('.stage-frame');
  frame?.classList.add('title-mode');
  showBackground(null);
  if (interactive && asset(project.title.logoImageId)) rememberDiscovery('image', project.title.logoImageId);
  stage.setRenderSettings(project.render);
  stage.setBackgroundLighting(asset(project.title.backgroundId));
  stage.setCameraAngle(project.title.cameraAngle);
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
  if (interactive)
    for (const item of project.characters.filter(item => entries.some(entry=>entry.modelAsset.id===item.modelId)))
      rememberDiscovery('character', item.id);
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
async function showEnvironment(owner){const env=project.environments?.find(e=>e.id===owner?.environmentId);await stage.setEnvironment(env,project.assets);return Boolean(env);}
const isFbxModel=id=>asset(id)?.type==='fbxCharacter';
const actorModels=()=>project.assets.filter(a=>['vrm','fbxCharacter'].includes(a.type));
function defaultProject(name) {
  return {
    version: 1, id: uid(), name: name || '我的 VRM 故事', ui: { dialogueImageId: '', clickSoundId: '' },
    title: { logoImageId: '', backgroundId: '', modelId: '', motionId: '', expressionWeights: {}, bgmId: '', authorNote: '',
      size: 1.7, offsetX: 0.65, offsetY: -1.15, offsetZ: 0, yaw: 0, pitch: 0, cameraAngle: 12 },
    render: { antialias: 'standard', style: 'anime', outline: 1, autoLight: true, lightStrength: 0.6,
      shadowEnabled: false, shadowAngle: 0, shadowOpacity: 0.45, shadowHeight: 0,
      paintEffect: 'none', paintStrength: 0.65 },
    assets: [], assetFolders: [], characters: [],
    acts: [{ id: uid(), name: '第一幕', backgroundId: '', bgmId: '', weather: normalizeWeather(), steps: [
      { id: uid(), characterId: '', speaker: '', text: '在这里写第一句对白。', expressionWeights: {}, motionId: '', position: 'center', size: defaultSize, offsetX: 0, offsetY: 0, voiceId: '', choices: [] }
    ] }]
  };
}
function normalize() {
  migrateEnvironments(project);
  library.reset();
  project.knowledgeBooks ||= [];
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
  project.title = { logoImageId: '', backgroundId: '', modelId: '', motionId: '', expressionWeights: {}, bgmId: '', authorNote: '',
    size: 1.7, offsetX: 0.65, offsetY: -1.15, offsetZ: 0, yaw: 0, pitch: 0, cameraAngle: 12, ...project.title };
  migrateTitleActors(project.title, uid);
  project.render = { antialias: 'standard', style: 'original', outline: 0, autoLight: true, lightStrength: 0.6,
    shadowEnabled: false, shadowAngle: 0, shadowOpacity: 0.45, shadowHeight: 0,
    paintEffect: 'none', paintStrength: 0.65, ...project.render };
  for (const item of project.acts) {
    if (isEvent(item)) {
      item.event = normalizeEvent(item.event); item.cast = {}; item.castSettings = {};
      item.steps = [{ id: item.steps?.[0]?.id || uid(), text: '', speaker: '', characterId: '', choices: [] }];
    }
    item.coverImageId ||= '';
    item.weather = normalizeWeather(item.weather);
    item.render = chapterRender(item, project.render);
    item.steps ||= [];
    item.castSettings ||= {};
    if (!item.cast && item.steps.some(entry=>!entry.cast)) {
      const distinct = [...new Set(item.steps.map(entry => entry.characterId).filter(Boolean))];
      item.cast = { left: '', center: '', right: '' };
      for (const id of distinct.slice(0, 3)) {
        const preferred = item.steps.find(entry => entry.characterId === id)?.position || 'center';
        const slot = castSlots.includes(preferred) && !item.cast[preferred] ? preferred : castSlots.find(key => !item.cast[key]);
        if (slot) item.cast[slot] = id;
      }
    }
    for (const entry of item.steps) entry.choices ||= [];
  }
  migrateDialogueCast(project);
}
async function init() {
  try {
    let voiceUpgrade = false, voiceWarnings = [];
    const info = await bridge('init');
    mode = info.mode;
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
  const supported = bindings.some(([key]) => ['field','bookField','eventField','motionOptions','galleryMusic','galleryImage',
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
  finally { historyBusy = false; document.querySelector('.editor')?.classList.remove('history-busy'); updateHistoryButtons(); }
}
function markDirty(options) {
  if(project)migrateEnvironments(project);
  if (project) syncDialogueVoices(project);
  changeRevision++;
  dirty = true;
  const marker = document.querySelector('#save-state');
  if (marker) marker.textContent = '● 未保存';
  if (mode === 'editor' && !options?.skipHistory && (!historyBusy || options?.derived)) editorHistory.commit(options || historyInput || historyAction || {});
}
async function save() {
  if (!project || mode !== 'editor') return;
  if (saveInFlight) await saveInFlight;
  editorHistory.seal();
  const revision = changeRevision;
  const retainedPaths = new Set(editorHistory.retainedAssetPaths());
  const obsoletePortraitPaths = [...pendingPortraitDeletes].filter(path => !retainedPaths.has(path));
  const task = bridge('saveProject', { project: structuredClone(project), obsoletePortraitPaths });
  saveInFlight = task;
  try {
    await task;
    obsoletePortraitPaths.forEach(path => pendingPortraitDeletes.delete(path));
    if (revision === changeRevision) {
      dirty = false;
      const marker = document.querySelector('#save-state');
      if (marker) marker.textContent = '✓ 已保存';
    }
  } finally {
    if (saveInFlight === task) saveInFlight = null;
  }
}
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
    if (mode === 'editor' && project && dirty)
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
      </select></label><p>外观设置只影响编辑器；导出的游戏保持白色界面。</p>
      <p class="font-credit">界面使用 HarmonyOS Sans 字体。© 2021 Huawei Device Co., Ltd.</p>
    </div></div>`);
}
function renderWelcome() {
  app.innerHTML = `<main class="welcome"><div class="welcome-card">
    <div class="eyebrow">VRM GALGAME STUDIO</div>
    <h1>让 VRM 角色走进你的故事</h1>
    <p>导入模型和动作，写对白，选表情。工程和全部素材会装进一个工程包。</p>
    <label class="field"><span>新工程名称</span><input id="new-name" value="我的 VRM 故事"></label>
    <div class="welcome-actions">${button('新建工程', 'new-project', 'class="primary"')}${button('打开工程包', 'open-project')}${button('导入旧工程', 'import-folder-project')}</div>
    <small>新建时选择保存位置，程序会建立一个 .vrmg 工程包。旧版工程文件夹可以导入。</small>
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
  events.cancel();
  stage?.destroy();
  if (activePanel === 'assets') activePanel = 'story';
  app.innerHTML = `<div class="editor">
    <header class="topbar"><div class="brand">✦ <b>VRM Galgame</b><span>编辑器</span></div>
      <div class="project-title"><input id="text-search" placeholder="查找与替换剧情、角色名称…" aria-label="查找剧情文本，按回车打开替换工具"><button class="search-open-button" data-action="search-open" title="查找与替换">⌕</button><span id="save-state">✓ 已保存</span></div>
      <div class="editor-history-controls" role="group" aria-label="撤销和重做">${button('↶ 撤销', 'editor-undo', 'disabled')}${button('↷ 重做', 'editor-redo', 'disabled')}</div>
      <nav>${button('新建', 'new-project')}${button('打开', 'open-project')}${button('最近', 'recent-projects')}${button('导入旧工程', 'import-folder-project')}${button('保存', 'save')}${button('另存为', 'save-as')}${button('☾', 'toggle-editor-theme', 'class="theme-toggle" aria-label="切换夜间模式" aria-pressed="false" title="切换到夜间模式"')}${button('设置', 'editor-settings')}${button('剧情助手', 'assistant-open')}${button('试玩', 'play', 'class="primary"')}${button('导出游戏', 'export')}${button('环境编辑器', 'edit-environment')}<div class="editor-feedback" aria-label="Bug反馈交流群"><span>Bug反馈交流群 · QQ</span><strong>${escape(feedbackGroup)}</strong></div></nav>
    </header>
    <div class="workspace">
      <aside class="sidebar"><div class="tabs">
        <button data-panel="story" class="active">剧情</button><button data-panel="characters">角色</button><button data-panel="title">标题</button><button data-panel="render">渲染</button><button data-panel="knowledge">知识库</button>
      </div><div id="sidebar-body"></div></aside>
      <main class="center"><div class="stage-toolbar"><span id="stage-caption"></span><span>预览画面</span></div>
        <div class="stage-frame"><div id="scene-bg"></div><div id="stage-canvas"></div><div id="title-preview" class="title-composition hidden"></div>
          <div id="character-preview" class="character-editor-preview hidden"></div>
          <div id="stage-placeholder">导入 VRM 角色后，这里会显示 3D 人物</div>
          <div id="speaker-portrait" class="speaker-portrait hidden"><img alt="说话角色头像"></div>
          <div id="dialogue" class="dialogue"><div class="speaker" id="dialogue-speaker"></div><div id="dialogue-text"></div></div>
          <button type="button" id="auto-play-button" class="auto-play-button hidden" data-action="auto-toggle" aria-pressed="false">▶ 自动播放</button>
          <div id="choice-list"></div>
          <div id="play-controls">${button('退出试玩', 'stop-play')}</div>
          <div id="act-loading" class="act-loading hidden">${loadingSpinner}</div>
        </div>
        <div class="stage-hint">选中左侧对白即可预览。试玩时点击画面空白处，或按空格 / Enter 继续。</div>
        <section class="asset-dock" aria-label="常驻素材库"><div class="asset-dock-heading"><strong>素材库</strong><small>图片直接显示缩略图；在这里导入、分类、删除素材</small></div><div id="asset-dock-tabs" class="asset-dock-tabs" role="tablist" aria-label="素材类型"></div><div id="asset-dock-body" class="asset-dock-body"></div></section>
      </main>
      <aside class="inspector"><div class="inspector-heading">属性</div><div id="inspector-body"></div></aside>
    </div>
    <footer class="status"><span id="project-path">${escape(directory)}</span><span>素材和剧情保存在工程包中</span></footer>
  </div>`;
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
  stage.setRenderSettings(project.render);
  applyEditorTheme();
  updateHistoryButtons();
  renderSidebar();
  renderInspector();
  updatePreview();
}
function renderSidebar() {
  document.querySelectorAll('[data-panel]').forEach(node => node.classList.toggle('active', node.dataset.panel === activePanel));
  const body = document.querySelector('#sidebar-body');
  if (activePanel === 'knowledge') { library.editor(); renderAssetDock(); return; }
  if (activePanel === 'story') {
    body.innerHTML = `<div class="section-heading">剧情 <span class="heading-actions">${button('＋ 幕', 'add-act')}${button('＋ 事件', 'event-add')}</span></div>
      <div class="list act-accordion" data-order-list="act">${project.acts.map((item, index) =>
        `<section class="act-group ${isEvent(item) ? 'event-group' : ''} ${index === selectedAct ? 'expanded' : ''}"><button class="list-row sortable-row ${index === selectedAct ? 'selected' : ''}" draggable="true" data-order-kind="act" data-order-index="${index}" data-action="select-act" data-index="${index}" aria-expanded="${index === selectedAct}">
          <span class="number">${index === selectedAct ? '▾' : '▸'} ${String(index + 1).padStart(2, '0')}</span><span>${isEvent(item) ? '▤ ' : ''}${escape(item.name)}</span><small>${isEvent(item) ? eventNames[item.event.type] : `${item.steps.length} 句`}</small><span class="drag-grip" aria-hidden="true">⋮⋮</span></button>
          ${index === selectedAct ? isEvent(item) ? `<div class="act-dialogues event-sidebar-info"><p>${escape(item.event.title || '在右侧填写事件内容')}</p><small>${eventSeconds[item.event.type] ? `观看 ${eventSeconds[item.event.type]} 秒后继续` : '可以立即关闭'}</small><div class="inline-actions">${button('预览', 'event-preview')}${button('复制', 'event-duplicate')}</div></div>` : `<div class="act-dialogues"><div class="section-heading">本幕对白 <span class="heading-actions">${button('复制', 'duplicate-step', item.steps.length ? '' : 'disabled')}${button('＋ 新增', 'add-step')}</span></div>
          <div class="list step-list" data-order-list="step">${item.steps.map((line, stepIndex) => `<button class="list-row sortable-row ${stepIndex === selectedStep ? 'selected' : ''}" draggable="true" data-order-kind="step" data-order-index="${stepIndex}" data-action="select-step" data-index="${stepIndex}"><span class="number">${stepIndex + 1}</span><span><b>${escape(line.speaker || character(line.characterId)?.name || '旁白')}</b><small>${escape(line.text || '空对白')}</small></span><span class="drag-grip" aria-hidden="true">⋮⋮</span></button>`).join('') || '<p class="tip">点击“新增”写第一句对白。</p>'}</div></div>` : ''}</section>`).join('')}</div>
      <div class="sidebar-note">拖动幕或事件可以调整播放顺序。点击“＋ 事件”，会插入到当前选中项后面。</div>`;
  } else if (activePanel === 'characters') {
    body.innerHTML = `<div class="section-heading">角色 ${button('＋ 新增', 'add-character')}</div>
      <div class="list">${project.characters.map((item, index) =>
        `<button class="list-row ${index === selectedCharacter ? 'selected' : ''}" data-action="select-character" data-index="${index}">
          <span class="number">✦</span><span>${escape(item.name)}</span><small>${item.modelId ? (isFbxModel(item.modelId)?'FBX':'VRM') : '未设模型'}</small></button>`).join('')}</div>
      <div class="sidebar-note">角色只需设置一次。对白选中角色后就能调用它的模型。</div>`;
  } else if (activePanel === 'render') {
    body.innerHTML = `<div class="section-heading">选择要调节的幕</div><div class="list">${project.acts.flatMap((item, index) => isEvent(item) ? [] : [`<button class="list-row ${index === selectedAct ? 'selected' : ''}" data-action="select-act" data-index="${index}"><span class="number">${index + 1}</span><span>${escape(item.name)}</span></button>`]).join('')}</div><div class="sidebar-note">右侧的画风、阴影和调色只影响选中的这一幕。标题画面保留原来的效果。</div>`;
  } else if (activePanel === 'title') {
    body.innerHTML = `<div class="section-heading">标题画面</div>
      <div class="title-sidebar-actions">
        ${button('导入 Logo', 'import', 'data-type="image" data-title-import="logoImageId"')}
        ${button('导入标题 VRM 人物', 'import', 'data-type="vrm" data-title-import="modelId"')}
        ${button('导入标题 FBX 人物', 'import', 'data-type="fbxCharacter" data-title-import="modelId"')}
        ${button('导入标题动作', 'import', 'data-type="motion" data-title-import="motionId"')}
        ${button('编辑环境', 'edit-environment')}
      </div><div class="sidebar-note">在右侧逐个添加标题人物。每个人可以单独选择模型、动作和位置。Logo 可以留空，菜单排在底部。</div>`;
  }
  renderAssetDock();
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
    ${visible.map(item => `<div class="asset-tile asset-file-tile asset-voice-tile" title="${escape(item.name)}"><div class="asset-tile-picture"><span class="asset-tile-icon" aria-hidden="true">🎙</span></div>
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
  const folders = project.assetFolders.filter(folder => folder.type === type && !folder.hidden && folder.id !== autoPortraitFolderId);
  if (currentAssetFolder[type] && !folders.some(folder => folder.id === currentAssetFolder[type])) currentAssetFolder[type] = '';
  const folderId = currentAssetFolder[type];
  const selectedFolder = folders.find(folder => folder.id === folderId);
  const scroll = body.scrollTop;
  const settingsOpen = body.querySelector('.asset-dock-settings')?.open || false;
  const tabs = [['image', '图像'], ['vrm', 'VRM'], ['fbxCharacter','FBX 人物'], ['sceneModel','物品与模型'], ['motion', '动作'], ['audio', '音乐与音效'], ['voice', '配音'], ['video', '视频']];
  document.querySelector('#asset-dock-tabs').innerHTML = tabs.map(([key, label]) =>
    `<button type="button" role="tab" aria-selected="${type === key}" class="${type === key ? 'active' : ''}" data-action="asset-tab" data-type="${key}">${label}<small>${byType(key).length}</small></button>`).join('');
  if (type === 'voice') { renderVoiceLibrary(body, folderId, folders, selectedFolder, scroll); return; }
  refreshVrmThumbnails();
  const visible = byType(type).filter(item => folderId ? item.folderId === folderId : !folders.some(folder => folder.id === item.folderId));
  body.innerHTML = `<div class="asset-browser-toolbar">
      <div class="asset-browser-location">${folderId ? button('← 返回', 'asset-folder-back') : '<strong>全部文件夹</strong>'}<span>${escape(selectedFolder?.name || (folderId ? '文件夹' : '未分类素材'))}</span></div>
      <div class="asset-browser-actions">${folderId ? button('改名', 'rename-asset-folder', `data-folder-id="${escape(folderId)}"`) : button('＋ 文件夹', 'add-asset-folder', `data-type="${type}"`)}${button('＋ 导入', 'import', `data-type="${type}" data-folder-id="${escape(folderId)}"`)}</div>
    </div><div class="asset-file-area" data-asset-dropzone="${type}" aria-label="${escape(type)} 素材文件区">
      <div class="asset-tile-grid">${!folderId ? folders.map(folder => renderAssetFolderTile(folder)).join('') : ''}${visible.map(item => renderAssetTile(item, folders)).join('')}</div>
      <div class="asset-drop-hint">双击空白处上传素材，或将文件、文件夹拖到这里</div>
    </div><details class="asset-dock-settings" ${settingsOpen ? 'open' : ''}><summary>游戏界面与鉴赏设置</summary><div class="asset-dock-settings-body">
    ${field('对话框图片', select('project.ui.dialogueImageId', byType('image'), project.ui.dialogueImageId, '使用内置样式'))}
    <p class="tip">可换成自己的 PNG 或 WebP 图片。建议使用横向、带透明通道的图片。</p>
    <h3>图片鉴赏</h3><p class="tip">勾选后，玩家在游戏里见过的图片可进入图像鉴赏。</p>
    ${byType('image').length ? byType('image').map(item => `<label class="gallery-audio-check gallery-image-check"><input type="checkbox" data-gallery-image="${escape(item.id)}" ${item.galleryImage === false ? '' : 'checked'}><span>${escape(item.name)}</span></label>`).join('') : '<p class="tip">还没有导入图片。</p>'}
    <h3>音乐鉴赏</h3><p class="tip">勾选要收录的音乐；音效可以取消勾选。角色配音在单独的配音栏管理。</p>
    ${byType('audio').length ? byType('audio').map(item => `<div class="gallery-audio-editor"><label class="gallery-audio-check"><input type="checkbox" data-gallery-music="${escape(item.id)}" ${item.galleryMusic === false ? '' : 'checked'}><span>${escape(item.name)}</span></label>
      <input data-audio-title="${escape(item.id)}" value="${escape(item.galleryTitle || '')}" placeholder="歌名：${escape(item.name.replace(/\.[^.]+$/, ''))}"></div>`).join('') : '<p class="tip">还没有导入音频。</p>'}
    <p class="tip">支持 VRM 人物、VRMA / Mixamo FBX 动作、PNG / JPG / WebP 图片、MP3 / WAV / OGG 声音和 MP4 / WebM 视频。</p>
  </div></details>`;
  body.scrollTop = scroll;
}
function renderAssetFolderTile(folder) {
  const count = byType(folder.type).filter(item => item.folderId === folder.id).length;
  return `<button type="button" class="asset-tile asset-folder-tile" data-action="asset-open-folder" data-folder-id="${escape(folder.id)}" title="打开 ${escape(folder.name)}">
    <span class="asset-folder-picture" aria-hidden="true">📁</span><span class="asset-tile-name">${escape(folder.name)}</span><small>${count} 个素材${folder.type === 'voice' ? (folder.characterDeleted ? ' · 角色已删除，文件夹保留' : ' · 固定文件夹') : ''}</small></button>`;
}
function renderAssetTile(item, folders) {
  const icons = { vrm: '♟', motion: '▶', audio: '♫', video: '▣' };
  const preview = item.type === 'image'
    ? `<img class="asset-tile-preview" loading="lazy" src="${escape(assetUrl(item))}" alt="${escape(item.name)}的缩略图">`
    : item.type === 'vrm' && vrmThumbnails.get(assetUrl(item))?.url
      ? `<img class="asset-tile-preview vrm-embedded-thumbnail" src="${escape(vrmThumbnails.get(assetUrl(item)).url)}" alt="${escape(item.name)}自带的头像">`
    : `<span class="asset-tile-icon asset-tile-icon-${item.type}" aria-hidden="true">${icons[item.type] || '▣'}</span>`;
  return `<div class="asset-tile asset-file-tile" title="${escape(item.name)}"><div class="asset-tile-picture">${preview}</div><span class="asset-tile-name">${escape(item.name)}</span>
    <div class="asset-tile-tools"><select data-asset-folder="${escape(item.id)}" aria-label="把 ${escape(item.name)} 移动到文件夹" title="移动到文件夹">
      <option value="" ${!item.folderId ? 'selected' : ''}>未分类</option>${folders.map(folder => `<option value="${escape(folder.id)}" ${item.folderId === folder.id ? 'selected' : ''}>${escape(folder.name)}</option>`).join('')}
    </select>${button('删除', 'delete-asset', `data-asset-id="${escape(item.id)}" class="asset-delete"`)}</div></div>`;
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
  vrm: ['.vrm'], sceneModel:['.glb'], motion: ['.vrma', '.fbx'], image: ['.png', '.jpg', '.jpeg', '.webp'],
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
  if(activeAssetType==='fbxCharacter'){toast('FBX 人物请点击“导入”，这样可以一起收集旁边的贴图。');return;}
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
    const type = droppedAssetType(file.name);
    if (!type) { skipped++; continue; }
    let folderId = type === activeAssetType ? currentAssetFolder[type] : '';
    if (folderName) {
      const key = `${type}:${folderName.toLowerCase()}`;
      if (!folderCache.has(key)) {
        let folder = project.assetFolders.find(item => item.type === type && item.name.toLowerCase() === folderName.toLowerCase());
        if (!folder) {
          folder = { id: uid(), type, name: folderName.slice(0, 64) };
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
  return `<section class="prop-editor"><h2>绑定物品</h2><p class="tip">先导入 GLB，添加物品，再选手或其他骨骼。角色页会显示所有已绑定物品，方便调整；对白里勾选后才会显示。</p><div class="inline-actions">${button('导入物品 GLB','import-prop-model')}${button('＋ 添加物品','add-character-prop')}${item.props?.length?button('调整视角与物品','binding-view-open'):''}</div>${(item.props||[]).map((prop,index)=>`<details class="prop-binding" ${index===0?'open':''}><summary>${escape(prop.name||'物品')}</summary>
    ${field('物品名称',`<input data-prop-field="name" data-prop-id="${escape(prop.id)}" value="${escape(prop.name)}">`)}
    ${field('物品模型',`<select data-prop-field="assetId" data-prop-id="${escape(prop.id)}">${options(byType('sceneModel'),prop.assetId,'请选择 GLB')}</select>`)}
    ${field('绑定骨骼',`<select data-prop-field="bone" data-prop-id="${escape(prop.id)}">${choices.map(b=>`<option value="${escape(b.value)}" ${b.value===prop.bone?'selected':''}>${escape(b.label)}</option>`).join('')}${!choices.some(b=>b.value===prop.bone)?`<option selected value="${escape(prop.bone)}">${escape(prop.bone)}（等待模型读取）</option>`:''}</select>`)}
    <div class="inline-actions">${button('放大绑定部位','binding-view-bone',`data-prop-id="${escape(prop.id)}"`)}${button('看物品','binding-view-item',`data-prop-id="${escape(prop.id)}"`)}</div>
    ${['position','rotation','scale'].map((kind,i)=>`<details class="prop-vector" ${i===0?'open':''}><summary>${['位置（米）','旋转（度）','缩放'][i]}</summary>${prop[kind].map((value,axis)=>{
      const lower=kind==='scale'?.001:kind==='rotation'?-180:-2,upper=kind==='scale'?5:kind==='rotation'?180:2;
      const data=`data-prop-transform="${escape(prop.id)}" data-vector="${kind}" data-axis="${axis}"`;
      return `<div class="prop-axis" data-prop-axis="${escape(prop.id)}.${kind}.${axis}"><label class="prop-number"><span>${['X · 左右','Y · 上下','Z · 前后'][axis]}</span><input type="number" ${data} data-mode="number" min="${kind==='scale'?.001:-10000}" max="10000" step="${kind==='rotation'?.1:.001}" value="${Number(value.toFixed(5))}"></label><label><span>粗调</span><input type="range" ${data} data-mode="coarse" min="${Math.min(lower,value)}" max="${Math.max(upper,value)}" step="any" value="${value}"></label><label><span>细调</span><input type="range" ${data} data-mode="fine" min="-100" max="100" step="1" value="0"></label></div>`;
    }).join('')}</details>`).join('')}<p class="tip">细调一次：位置 0.001 米、旋转 0.1 度、缩放 0.001。松开细调滑块后会回到中间，保留修改结果。模型先按最长边约 0.8 米摆放。</p>${button('移除这个绑定','remove-character-prop',`data-prop-id="${escape(prop.id)}" class="danger"`)}</details>`).join('')}</section>`;
}
function castEditor(currentAct, slot) {
  const settings = castSettingsOf(currentAct, slot);
  const actorId = settings.characterId;
  const slider = (key, label, value, min, max, stepSize, unit = '') =>
    `<label class="adjustment ${key === 'offsetZ' ? 'depth-adjustment' : ''}"><span>${label}</span><input type="range" data-cast-adjust="${slot}.${key}" min="${min}" max="${max}" step="${key === 'offsetZ' ? 'any' : stepSize}" value="${value}">${key === 'offsetZ' ? `<input class="depth-number" type="number" data-cast-adjust="${slot}.${key}" aria-label="${castSlotLabels[slot]}前后精确数值" min="${min}" max="${max}" step="0.01" value="${value}">` : ''}<output ${key === 'offsetZ' ? 'hidden' : ''} data-cast-output="${slot}.${key}">${value}${unit}</output></label>`;
  return `<details class="cast-editor" ${actorId && actorId===step()?.characterId?'open':''}><summary>${castSlotLabels[slot]} · ${escape(character(actorId)?.name || '未选择')}</summary>
    <div class="cast-editor-body">
      ${field('角色', `<select data-cast-slot="${slot}">${options(project.characters.filter(item => item.modelId || item.id === actorId), actorId, '此位置无人')}</select>`)}
      ${actorId ? `${field('这一句的动作', `<select data-cast-motion="${slot}">${options(byType('motion'), settings.motionId, '保持站立')}</select>`)}
        ${motionAdvanced(settings, `cast:${slot}`)}
        ${slider('size', '大小', Math.round((settings.size ?? defaultSize) * 100), 50, 250, 5, '%')}
        ${slider('offsetX', '左右', Number(settings.offsetX) || 0, -1.5, 1.5, 0.05)}
        ${slider('offsetY', '上下', Number(settings.offsetY) || 0, -3, 2, 0.05)}
        ${slider('offsetZ', '前后', Number(settings.offsetZ) || 0, -100, 100, 0.1)}
        ${slider('yaw', '转身角度', Number(settings.yaw) || 0, -90, 90, 5, '°')}
${!isFbxModel(character(actorId)?.modelId) ? `<div class="field"><span>这一句的表情</span><div id="cast-expression-${slot}" class="expression-controls"></div></div>` : ''}<div class="dialogue-props"><b>这一句显示的物品</b>${(character(actorId)?.props||[]).map(prop=>`<label><input type="checkbox" data-cast-prop="${slot}" data-prop-id="${escape(prop.id)}" ${(settings.props||[]).includes(prop.id)?'checked':''}>${escape(prop.name||asset(prop.assetId)?.name||'物品')}</label>`).join('')||'<small>先到角色页绑定物品。</small>'}</div>` : ''}
    </div></details>`;
}
function renderInspector() {
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
      <div class="portrait-editor"><span>说话头像</span>${asset(item.portraitId) ? `<img src="${assetUrl(asset(item.portraitId))}" alt="${escape(item.name)}的头像">` : '<div class="portrait-empty">还没有头像</div>'}
        <div class="inline-actions">${button('上传头像', 'upload-character-portrait')}${item.modelId && !isFbxModel(item.modelId) ? button('重新拍摄 VRM', 'capture-character-portrait') : ''}</div>
        <p class="tip">没有模型也能上传头像说话。VRM 自动头像会采用下方选中的动作和定格帧；选好帧后会重拍。手动上传的头像不会被覆盖。</p></div>
      ${field('鉴赏姿势 / 动作', select('character.galleryMotionId', byType('motion'), item.galleryMotionId, '保持站立'))}
      <label class="adjustment"><span>鉴赏转身角度</span><input type="range" data-gallery-adjust="galleryYaw" min="-90" max="90" step="5" value="${item.galleryYaw}"><output data-gallery-output="galleryYaw">${item.galleryYaw}°</output></label>
      <label class="adjustment gallery-frame-adjustment"><span>动作定格帧</span><input type="range" data-gallery-adjust="galleryPoseFrame" min="1" max="${Math.max(1, item.galleryPoseFrame)}" step="1" value="${item.galleryPoseFrame}" disabled><output data-gallery-output="galleryPoseFrame">${item.galleryMotionId ? '读取中…' : '先选择动作'}</output></label>
      <label class="gallery-frame-number"><span>输入帧号</span><input type="number" data-gallery-frame-number min="1" max="${Math.max(1, item.galleryPoseFrame)}" step="1" value="${item.galleryPoseFrame}" disabled></label>
      ${propEditor(item)}
      ${field('身份 / 称号', input('character.title', item.title, '例如：旅行者、学生'))}
      ${field('角色简介', textarea('character.description', item.description, '玩家在角色鉴赏里看到的介绍'))}
      <hr><h2>角色故事（最多三段）</h2>
      <p class="tip">留空的故事不会出现在游戏里。解锁数字填 0 时，玩家一开始就能阅读。</p>
      ${item.stories.map((story, index) => `<div class="character-story-editor">
        <h3>故事 ${index + 1}</h3>
        ${field('故事内容', `<textarea data-story-index="${index}" data-story-field="text" placeholder="不写就不显示">${escape(story.text)}</textarea>`)}
        ${field('读过这个角色多少句对白后解锁', `<input type="number" min="0" step="1" data-story-index="${index}" data-story-field="unlockLines" value="${Math.max(0, Number(story.unlockLines) || 0)}">`)}
      </div>`).join('')}
      <div class="inline-actions">${button('导入 VRM', 'import', 'data-type="vrm"')}${button('导入 FBX 人物', 'import', 'data-type="fbxCharacter"')}${button('删除角色', 'delete-character', 'class="danger"')}</div>
      <p class="tip">选中角色后，预览里会显示它。表情名称取决于模型本身。</p></div>` : '<div class="inspector-content empty">先新增角色</div>';
    if (item) updatePreview();
    return;
  }
  if (activePanel === 'title') {
    const title = project.title;
    body.innerHTML = `<div class="inspector-content"><h2>标题画面</h2>
      ${title.logoImageId==='__none__'?'':field('游戏名称', `<input id="project-name" value="${escape(project.name)}" aria-label="游戏名称">`)}
      ${field('Logo 图片', `<select data-title-field="logoImageId"><option value="__none__" ${title.logoImageId==='__none__'?'selected':''}>不显示（留空）</option>${options(byType('image'), title.logoImageId, '使用游戏名称')}</select>`)}
      ${field('标题场景', `<select data-title-field="environmentId">${options(project.environments || [], title.environmentId, '默认天空')}</select>`)}${button('编辑标题环境（独立窗口）','edit-environment')}
      ${field('标题音乐', `<select data-title-field="bgmId">${options(byType('audio'), title.bgmId, '无音乐')}</select>`)}
      ${field('按钮点击音效', `<select data-ui-field="clickSoundId">${options(byType('audio'), project.ui.clickSoundId, '使用内置轻提示音')}</select>`)}
      <p class="tip">选“不显示（留空）”后，左边的标题板会全部隐藏。底部菜单照常显示。</p>
      ${titleSlider('cameraAngle', '镜头俯视角', title.cameraAngle, 0, 65, 1, `${title.cameraAngle}°`)}
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
    body.innerHTML = `<div class="inspector-content"><h2>本幕渲染 · ${escape(act().name)}</h2><p class="tip">这里只改变这一幕。背景自动配光默认开启，下面的调色也会一起作用于人物和背景。</p>
      <h3>本幕调色</h3>
      ${[['brightness','亮度',0,200,'%'],['contrast','对比度',0,200,'%'],['saturation','饱和度',0,200,'%'],['temperature','色温（左冷右暖）',-100,100,''],['hue','色差（色相偏移）',-180,180,'°']].map(([key,label,min,max,unit]) => field(label, `<input type="range" data-render="${key}" min="${min}" max="${max}" step="1" value="${settings[key]}"><output data-render-output="${key}">${settings[key]}${unit}</output>`)).join('')}
      ${button('恢复默认调色与自动配光', 'reset-act-color')}<hr>
      ${field('抗锯齿', `<select data-render="antialias"><option value="off" ${settings.antialias === 'off' ? 'selected' : ''}>关闭</option><option value="standard" ${settings.antialias === 'standard' ? 'selected' : ''}>标准</option><option value="high" ${settings.antialias === 'high' ? 'selected' : ''}>高清</option></select>`)}
      ${field('人物画风', `<select data-render="style"><option value="original" ${settings.style === 'original' ? 'selected' : ''}>模型原版</option><option value="anime" ${settings.style === 'anime' ? 'selected' : ''}>三渲二（推荐）</option><option value="soft" ${settings.style === 'soft' ? 'selected' : ''}>柔和动漫</option><option value="cinematic" ${settings.style === 'cinematic' ? 'selected' : ''}>电影色调</option></select>`)}
      ${field('人物描边', `<select data-render="outline"><option value="0" ${Number(settings.outline) === 0 ? 'selected' : ''}>关闭</option><option value="1" ${Number(settings.outline) === 1 ? 'selected' : ''}>细</option><option value="2" ${Number(settings.outline) === 2 ? 'selected' : ''}>中</option><option value="3" ${Number(settings.outline) === 3 ? 'selected' : ''}>粗</option></select>`)}
      ${field('根据背景自动配光', `<select data-render="autoLight"><option value="true" ${settings.autoLight ? 'selected' : ''}>开启</option><option value="false" ${!settings.autoLight ? 'selected' : ''}>关闭</option></select>`)}
      ${field('背景配光强度', `<input type="range" data-render="lightStrength" min="0" max="100" step="5" value="${Math.round(settings.lightStrength * 100)}"><output id="light-strength-value">${Math.round(settings.lightStrength * 100)}%</output>`)}
      ${field('画面效果', `<select data-render="paintEffect"><option value="none" ${settings.paintEffect !== 'oil' ? 'selected' : ''}>关闭</option><option value="oil" ${settings.paintEffect === 'oil' ? 'selected' : ''}>油画笔触（人物与背景）</option></select>`)}
      ${field('油画笔触强度', `<input type="range" data-render="paintStrength" min="0" max="100" step="5" value="${Math.round((Number(settings.paintStrength) || 0) * 100)}"><output data-render-output="paintStrength">${Math.round((Number(settings.paintStrength) || 0) * 100)}%</output>`)}
      <p class="tip">油画笔触会一起处理背景和人物；对白、菜单保持清晰。开启后会多用一些显卡性能，旧工程默认关闭。</p>
      ${act().environmentId?'<p class="tip">三维场景自动使用真实阴影，人物和物体把阴影投到场景的地面、墙壁上。灯光在环境编辑器里调整。</p>':`<details class="render-advanced"><summary>高级渲染 · 角色阴影</summary><div class="render-advanced-body">
        <label class="render-shadow-toggle"><input type="checkbox" data-render="shadowEnabled" ${settings.shadowEnabled ? 'checked' : ''}><span>显示角色阴影</span></label>
        <label class="adjustment"><span>影子方向</span><input type="range" data-render="shadowAngle" min="-180" max="180" step="5" value="${Number(settings.shadowAngle) || 0}"><output data-render-output="shadowAngle">${Number(settings.shadowAngle) || 0}°</output></label>
        <label class="adjustment"><span>影子深浅</span><input type="range" data-render="shadowOpacity" min="0" max="100" step="5" value="${Math.round((Number(settings.shadowOpacity) || 0) * 100)}"><output data-render-output="shadowOpacity">${Math.round((Number(settings.shadowOpacity) || 0) * 100)}%</output></label>
        <label class="adjustment shadow-height-adjustment"><span>阴影水平高度</span><input type="range" data-render="shadowHeight" min="-40" max="40" step="1" value="${Math.round((Number(settings.shadowHeight) || 0) * 100)}"><output data-render-output="shadowHeight">${Math.round((Number(settings.shadowHeight) || 0) * 100) > 0 ? '+' : ''}${Math.round((Number(settings.shadowHeight) || 0) * 100)} 厘米</output></label>
        <p class="tip">一套设置控制画面中的全部角色。脚掌看着浮起时，把阴影高度往右调；影子盖住鞋子时往左调。0° 表示影子朝画面下方；默认关闭。</p>
      </div></details>`}
      <p class="tip">“三渲二”会增强动画式明暗、减少塑料般的高光。描边选“细”通常更自然。背景配光会从图片估计亮处和颜色；视频背景使用默认灯光。</p></div>`;
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
    ${field('3D 场景', select('act.environmentId', project.environments || [], currentAct.environmentId, '默认天空'))}<div class="inline-actions">${button('编辑环境（独立窗口）','edit-environment')}${button('新建场景','new-environment')}</div>
    ${field('背景音乐', select('act.bgmId', byType('audio'), currentAct.bgmId, '无音乐'))}
    ${weatherEditor(currentAct)}
    <div class="inline-actions">${button('删除本幕', 'delete-act', 'class="danger"')}</div>
    </details><hr><h2>第 ${selectedStep + 1} 句对白</h2>
    ${current ? `
      ${field('说话角色', select('step.characterId', project.characters, current.characterId, '旁白 / 场外说话'))}
      ${field('显示名字', input('step.speaker', current.speaker, '留空时用角色名字'))}
      ${field('对白内容', textarea('step.text', current.text, '在这里写台词'))}
      <hr><h3>这一句在场的人物</h3><p class="tip">左、中、右各选一人。动作、位置、表情和物品只在这里设置；上面的说话角色只决定谁说台词。新增对白会复制上一句的站位，可以单独修改。</p>
      ${castSlots.map(slot => castEditor(currentAct, slot)).join('')}
      ${dialogueVoiceField(current)}
      ${field('本句音效', select('step.seId', byType('audio'), current.seId, '无音效'))}
      <div class="inline-actions">${button('复制本句', 'duplicate-step')}${button('上移', 'move-up')}${button('下移', 'move-down')}${button('删除', 'delete-step', 'class="danger"')}</div>
      <hr><div class="section-heading">选择分支 ${button('＋ 选项', 'add-choice')}</div>
      ${current.choices.map((choice,index) => `<div class="choice-editor">
        <input data-choice-index="${index}" data-choice-field="text" value="${escape(choice.text)}" placeholder="玩家看到的选项">
        <select data-choice-index="${index}" data-choice-field="actId">${options(project.acts,choice.actId,'选择跳转到哪一幕')}</select>
        ${button('删除选项', 'delete-choice', `data-index="${index}"`)}</div>`).join('')}
    ` : '<p class="tip">这幕还没有对白。</p>'}
    </div>`;
  renderExpressionControls();
  renderCastExpressionControls();
  refreshMotionHints();
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
  const request = ++previewRequest;
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
  stage.setRenderSettings(chapterRender(currentAct, project.render));
  applySceneColor(chapterRender(currentAct, project.render));
  stage.setBackgroundLighting(null);
  await showEnvironment(currentAct);
  document.querySelector('#stage-caption').textContent = currentAct?.name || '没有幕';
  const placeholder = document.querySelector('#stage-placeholder');
  setStagePlaceholder(placeholder, current ? '此句没有 VRM 角色' : '这一幕还没有人物', Boolean(modelAsset));
  placeholder.style.display = 'grid';
  showDialogue(current?.speaker || character(current?.characterId)?.name || '旁白', current?.text || '', false, current?.characterId);
  if (!current) document.querySelector('#dialogue')?.classList.remove('visible');
  await displayActStep(currentAct, current);
  if (request !== previewRequest || playing) return;
  if (stage.visibleRecords.size || (current && !stageError))
    placeholder.style.display = 'none';
  else if (modelAsset && !stageError)
    setStagePlaceholder(placeholder, '', true);
  renderExpressionControls();
  renderCastExpressionControls();
}
function eventBackdrop(node) {
  const index = project.acts.indexOf(node);
  const previous = project.acts.slice(0, index).findLast(item => !isEvent(item));
  return { chapter: previous, backgroundId: node.event.backgroundId || previous?.backgroundId || project.title.backgroundId || '' };
}
async function prepareEventScene(node) {
  clearTyping(); clearAutoAdvance(); titleRequest++; previewRequest++;
  document.querySelector('.stage-frame')?.classList.remove('title-mode');
  document.querySelector('#player-start')?.classList.add('hidden');
  document.querySelector('#title-preview')?.classList.add('hidden');
  document.querySelector('#character-preview')?.classList.add('hidden');
  document.querySelector('#auto-play-button')?.classList.add('hidden');
  document.querySelector('#act-loading')?.classList.add('hidden');
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
  if (action === 'event-add') {
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
  else if (action === 'event-upload') {
    const imported = await bridge('importAsset', { type: node.dataset.type });
    if (!imported?.length) return;
    for (const item of imported) { item.galleryImage = false; project.assets.push(item); }
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
    ${field('天气声音', `<select data-weather="soundId"><option value="">静音</option><option value="auto" ${w.soundId==='auto'?'selected':''}>内置雨声 / 风声</option>${byType('audio').map(a => `<option value="${escape(a.id)}" ${w.soundId===a.id?'selected':''}>${escape(a.name)}</option>`).join('')}</select>`)}
    ${slider('volume','天气音量')}
    <p class="tip">只改变这一幕。雨雪有远近层次；水花请对准背景的地面，室内可以关闭水花。预览不播放天气声，试玩会播放；声音跟随游戏设置中的音效音量。</p>` : '<p class="tip">旧工程默认没有天气。选择天气后，可以马上在中间预览。</p>'}
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
  if (!item || !modelAsset || modelAsset.type==='fbxCharacter' || (!force && asset(item.portraitId))) return;
  const motionId = item.galleryMotionId || '';
  const motionAsset = asset(motionId);
  const poseFrame = Math.max(1, Math.floor(Number(item.galleryPoseFrame) || 1));
  const legacySeconds = Number.isFinite(Number(item.galleryPoseTime)) ? Number(item.galleryPoseTime) : null;
  const jobKey = `${project.id}:${item.id}:${item.modelId}:${motionId}:${poseFrame}`;
  if (portraitJobs.has(jobKey)) return portraitJobs.get(jobKey);
  const modelId = item.modelId;
  const task = (async () => {
    const { dataUrl, frame } = await captureVrmPortrait(modelAsset, motionAsset, poseFrame, legacySeconds);
    if (project.characters.find(entry => entry.id === item.id) !== item || item.modelId !== modelId ||
      item.galleryMotionId !== motionId ||
      !(Number(item.galleryPoseFrame) === poseFrame || (legacySeconds !== null && Number(item.galleryPoseFrame) === frame)) ||
      (!force && asset(item.portraitId))) return;
    item.galleryPoseFrame = frame;
    delete item.galleryPoseTime;
    if (mode === 'player') temporaryPortraits.set(item.id, dataUrl);
    else {
      const saved = await bridge('saveGeneratedPortrait', { dataUrl, characterId: item.id, name: item.name, previousRevision: asset(item.portraitId)?.revision || '' });
      if (project.characters.find(entry => entry.id === item.id) !== item || item.modelId !== modelId ||
        item.galleryMotionId !== motionId || Number(item.galleryPoseFrame) !== frame || (!force && asset(item.portraitId))) return;
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
  return !asset(item?.portraitId) || item.portraitSource === 'auto';
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
function updateSpeakerPortrait(characterId, visible) {
  const node = document.querySelector('#speaker-portrait');
  const image = node?.querySelector('img');
  if (!node || !image) return;
  const item = characterId ? character(characterId) : null;
  const portraitAsset = asset(item?.portraitId);
  const url = portraitAsset ? assetUrl(portraitAsset) : temporaryPortraits.get(item?.id) || '';
  image.src = visible && url ? url : '';
  node.classList.toggle('hidden', !visible || !url);
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
  if (playing && autoPlay) scheduleAutoAdvance(project.acts[playAct]?.steps[playStep]);
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
      if (playing && autoPlay) scheduleAutoAdvance(project.acts[playAct]?.steps[playStep]);
    }
  }, 1000 / textSpeed);
}
function playEffect(id) {
  const item = asset(id);
  if (!item) return false;
  const sound = new Audio(assetUrl(item));
  sound.volume = audioSettings.master * audioSettings.effects;
  activeEffects.add(sound);
  const remove = () => activeEffects.delete(sound);
  sound.addEventListener('ended', remove, { once: true });
  sound.addEventListener('error', remove, { once: true });
  sound.play().catch(remove);
  return true;
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
  music.src = url;
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
  const request = ++playRequest;
  clearAutoAdvance();
  clearTyping();
  const currentAct = project.acts[playAct];
  const current = currentAct?.steps[playStep];
  if (!current) { stopPlay(); toast('故事播放完毕'); return; }
  if (isEvent(currentAct)) { preparedAct = -1; transitioning = false; const remaining = restoredEventRemaining; restoredEventRemaining = undefined; await events.show(currentAct, false, remaining); return; }
  const leavingEvent = events.active() || eventMusicActive;
  events.cancel();
  transitioning = true;
  let displayed = false;
  const loading = document.querySelector('#act-loading');
  try {
    if (preparedAct !== playAct) {
      loading?.classList.remove('hidden');
      const entries=currentAct.steps.flatMap(line=>castForAct(currentAct,line));
      await stage.prepareAct(entries);
      if (request !== playRequest || !playing) return;
      preparedAct = playAct;
    }
    const modelAsset = modelForStep(current);
    const caption = document.querySelector('#stage-caption');
    if (caption) caption.textContent = currentAct.name;
    const placeholder = document.querySelector('#stage-placeholder');
    setStagePlaceholder(placeholder, '此句没有 VRM 角色', Boolean(modelAsset));
    placeholder.style.display = 'grid';
    stageError = '';
    document.querySelector('.stage-frame')?.classList.remove('title-mode');
    document.querySelector('#title-preview')?.classList.add('hidden');
    stage.setCameraAngle(0);
    setSceneWeather(currentAct);
    stage.setRenderSettings(chapterRender(currentAct, project.render));
    applySceneColor(chapterRender(currentAct, project.render));
    stage.setBackgroundLighting(null);
    await showEnvironment(currentAct);
    await displayActStep(currentAct, current);
    if (request !== playRequest || !playing) return;
    if (mode === 'player') for (const id of stage.visibleRecords.keys())
      if (character(id)) rememberDiscovery('character', id);
    if (mode === 'player' && character(current.characterId)) rememberDiscovery('character', current.characterId);
    showBackground(null);
    await ensureCharacterPortrait(character(current.characterId));
    if (request !== playRequest || !playing) return;
    showDialogue(current.speaker || character(current.characterId)?.name || '旁白', current.text, true, current.characterId);
    recordViewedDialogue(current);
    if (leavingEvent) transitionMusic(currentAct.bgmId); else setMusic(currentAct.bgmId);
    eventMusicActive = false;
    if (current.seId) playEffect(current.seId);
    voice.pause();
    const voiceAsset = asset(current.voiceId);
    if (voiceAsset) {
      voice.src = assetUrl(voiceAsset);
      voice.play().catch(() => {
        if (request === playRequest && autoPlay) scheduleAutoAdvance(current);
      });
    }
    const choiceList = document.querySelector('#choice-list');
    choiceList.innerHTML = current.choices.map((choice,index) =>
      `<button data-action="choose" data-index="${index}">${escape(choice.text || '继续')}</button>`).join('');
    if (stage.visibleRecords.size || !stageError)
      placeholder.style.display = 'none';
    else if (modelAsset && stageError)
      placeholder.textContent = stageError;
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
      if (displayed) scheduleAutoAdvance(current);
    }
  }
}
function startPlay() {
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
  if (!playing || transitioning || saveModalMode) return;
  if (isEvent(project.acts[playAct])) { events.confirm(); return; }
  if (finishTyping()) return;
  clearAutoAdvance();
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
    seenCharacterIds: [], seenImageIds: [], heardMusicIds: [], enteredActIds: [], completedEventIds: [], lastActId: '' };
  try {
    const stored = JSON.parse(localStorage.getItem(lifetimeKey()) || 'null');
    if (stored && typeof stored === 'object') {
      for (const key of ['viewedDialogueIds', 'seenCharacterIds', 'seenImageIds', 'heardMusicIds', 'enteredActIds', 'completedEventIds'])
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
  if (saveModalMode === 'gallery') {
    stopGalleryMusic();
    galleryStage?.destroy();
    galleryStage = null;
  }
  saveModalMode = '';
  const modal = document.querySelector('#player-modal');
  if (modal) {
    modal.classList.add('closing');
    modal.setAttribute('aria-hidden', 'true');
    modal.inert = true;
    setTimeout(() => modal.remove(), 180);
  }
  if (playing && autoPlay) scheduleAutoAdvance(project.acts[playAct]?.steps[playStep]);
}
function restartPlayerAutoSave() {
  clearInterval(playerAutoSaveTimer);
  if (mode !== 'player') return;
  playerAutoSaveTimer = setInterval(() => {
    if (playing && !transitioning && project.acts[playAct]?.steps[playStep]) saveAutoSlot();
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
    viewedDialogueIds: [...playViewedStepIds]
  };
}
function saveAutoSlot() {
  const snapshot = snapshotSlot(true);
  if (!snapshot) return;
  const slots = readSaveSlots();
  slots[0] = snapshot;
  localStorage.setItem(saveKey(), JSON.stringify(slots));
  if (saveModalMode === 'load') renderSaveModal('load');
}
function saveSlot(index) {
  if (!playing || !Number.isInteger(index) || index < 1 || index >= 20) return;
  const slots = readSaveSlots();
  if (slots[index] && !confirm(`覆盖第 ${index + 1} 个存档吗？`)) return;
  slots[index] = snapshotSlot();
  if (!slots[index]) { toast('这句对白无法保存', true); return; }
  localStorage.setItem(saveKey(), JSON.stringify(slots));
  renderSaveModal('save');
  toast(`已保存到第 ${index + 1} 个存档`);
}
function loadSlot(index) {
  const slot = index === -1 ? readLegacyFirstSlot() : readSaveSlots()[index];
  if (!slot) return;
  const { actIndex: targetAct, stepIndex: targetStep } = slotLocation(slot);
  if (!project.acts[targetAct]?.steps[targetStep]) { toast('这个存档对应的剧情已不存在', true); return; }
  if (playing && !confirm(`读取${index === -1 ? '旧版备份' : `第 ${index + 1} 个存档`}？当前进度若未保存会丢失。`)) return;
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
      <span class="save-thumb"${preview}><b>${String(index + 1).padStart(2, '0')}</b></span>
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
function renderSettingsModal() {
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
      <label class="field"><span>窗口大小（全部为 16:9）</span><select id="window-resolution" ${playerFullscreen ? 'disabled' : ''}>${resolutions.map(value => `<option value="${value}" ${value === playerResolution ? 'selected' : ''}>${value.replace('x', ' × ')}</option>`).join('')}</select></label>
      ${button('应用窗口大小', 'apply-resolution', playerFullscreen ? 'disabled' : '')}
      <div class="settings-line"><span>全屏显示</span>${button(playerFullscreen ? '退出全屏' : '进入全屏', 'toggle-fullscreen')}</div>
      <p>无论窗口大小或显示器比例如何，游戏画面始终保持 16:9。</p>
      <p class="font-credit">界面使用 HarmonyOS Sans 字体。© 2021 Huawei Device Co., Ltd.</p>
    </div></div></section>`);
}
const galleryTracks = () => byType('audio').filter(item => item.galleryMusic !== false);
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
  document.querySelector('#title-preview')?.classList.add('hidden');
  document.querySelector('.stage-frame')?.classList.remove('title-mode');
  await stage.setEnvironment(null,project.assets);
  setSceneWeather();
  applySceneColor(colorDefaults);
  const overlay = document.querySelector('#character-preview');
  const frame = document.querySelector('.editor .stage-frame');
  if (!overlay || !frame || !stage) return;
  const item = project.characters[selectedCharacter];
  if (stage.element.parentElement !== frame) frame.insertBefore(stage.element, overlay);
  stage.setPaintBackground(null);
  const bindingMode=propPreviewMode && Boolean(item?.props?.length);
  frame.classList.toggle('binding-view-mode',bindingMode);overlay.classList.toggle('binding-preview',bindingMode);
  if(bindingMode){overlay.innerHTML=`<div class="binding-preview-tools"><div>${button('看整个人物','binding-view-reset')}${button('放大绑定部位','binding-view-bone')}${button('返回人物鉴赏','binding-view-close')}</div><small>左键拖动旋转 · Shift＋左键拖动平移 · 滚轮缩放 · 右键拖动也能平移</small></div>`;}
  else {stage.bindingView.disable();overlay.innerHTML = `<div class="gallery-box gallery-box-character character-preview-box">
    <header><div><small>EXTRAS</small><h2>附加鉴赏</h2></div></header>
    <div class="gallery-main-tabs"><button type="button" disabled>图像鉴赏</button><button type="button" disabled>乐曲鉴赏</button><button type="button" class="active">人物鉴赏</button></div>
    <div class="gallery-content">${galleryCharacterMarkup(true)}</div></div>`;}
  overlay.querySelector('.gallery-character-picker .active')?.scrollIntoView({ block: 'nearest' });
  overlay.classList.remove('hidden');
  document.querySelector('#stage-caption').textContent = bindingMode?'物品绑定 · 可转动视角':'人物鉴赏预览';
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
  if(bindingMode)frame.insertBefore(stage.element,overlay);else portrait.appendChild(stage.element);
  stage.resize();
  stage.setRenderSettings(project.render);
  if(!bindingMode){if(item.props?.length)stage.setCameraAngle(0);else stage.setPortraitCamera();}
  await stage.show(asset(item.modelId), asset(item.galleryMotionId), {}, 'center',
    { size: 1.23, yaw: item.galleryYaw || 0 }, `gallery:${item.id}`,{},'',{bindings:item.props||[],visibleIds:(item.props||[]).map(p=>p.id),assets:project.assets});
  if (activePanel === 'characters' && project.characters[selectedCharacter]?.id === item.id) {
    const record=stage.visibleRecords.get(`gallery:${item.id}`);
    if(bindingMode)stage.bindingView.enable(record,`gallery:${item.id}`);
    for(const select of document.querySelectorAll('[data-prop-field=bone]')){const value=select.value;select.innerHTML=availablePropBones(record).map(b=>`<option value="${escape(b.value)}">${escape(b.label)}</option>`).join('');select.value=value;}
    refreshGalleryFrameControl(item);
    if (item.galleryMotionId) stage.setMotionPoseFrame(item.galleryPoseFrame);
  }
}
function renderGalleryModal() {
  clearAutoAdvance();
  saveModalMode = 'gallery';
  galleryStage?.destroy();
  galleryStage = null;
  const content = galleryTab === 'images' ? galleryImageMarkup()
    : galleryTab === 'music' ? galleryMusicMarkup() : galleryCharacterMarkup();
  document.querySelector('#player-modal')?.remove();
  document.querySelector('.player .stage-frame').insertAdjacentHTML('beforeend', `<section id="player-modal" class="player-modal gallery-modal" role="dialog" aria-modal="true" aria-label="附加鉴赏">
    <div class="modal-box gallery-box ${galleryTab === 'characters' ? 'gallery-box-character' : ''}"><header><div><small>EXTRAS</small><h2>附加鉴赏</h2></div>${button('关闭 ×', 'close-modal')}</header>
      <div class="gallery-main-tabs">${[['images','图像鉴赏'],['music','乐曲鉴赏'],['characters','人物鉴赏']].map(([key,label]) =>
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
    if (target && item?.modelId && hasDiscovered('character', item.id)) {
      galleryStage = new VRMStage(target, message => toast(message, true));
      galleryStage.setRenderSettings(project.render);
      galleryStage.setPortraitCamera();
      const portrait = galleryStage;
      portrait.show(asset(item.modelId), asset(item.galleryMotionId), {}, 'center', { size: 1.23, yaw: item.galleryYaw || 0 }, `gallery:${item.id}`)
        .then(() => { if (galleryStage === portrait && item.galleryMotionId) portrait.setMotionPoseFrame(item.galleryPoseFrame); });
    }
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
  const imported = await bridge('importAsset', { type });
  if (!imported?.length) return;
  for (const item of imported) {
    item.folderId = folderId;
    if (type === 'image') item.galleryImage = galleryImage;
  }
  if (folderId) openAssetFolders.add(folderId);
  if (titleImport === 'modelId') project.title.actors.push(...imported.map((model,index)=>newTitleActor(uid(),model.id,project.title.actors.length+index)));
  else if(titleImport==='motionId'){const actor=project.title.actors.at(-1);if(actor)actor.motionId=imported[0].id;}
  else if (titleImport) project.title[titleImport] = imported[0].id;
  project.assets.push(...imported); markDirty(); renderSidebar(); renderInspector(); toast(`已导入 ${imported.length} 个素材`);
  if (activePanel === 'title') updatePreview();
  return imported;
}
function renderPlayer() {
  events.cancel();
  stage?.destroy();
  if (!project) { app.innerHTML = '<div class="fatal">游戏工程文件不完整</div>'; return; }
  app.innerHTML = `<div class="player"><div class="stage-frame">
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
        <button type="button" data-action="toggle-fullscreen" title="切换全屏">${playerFullscreen ? '窗口' : '全屏'}</button>
      </div>
    </div>
    <div id="player-start" class="title-composition"></div>
    <div id="act-loading" class="act-loading hidden">${loadingSpinner}</div>
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
  stage.setRenderSettings(project.render);
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
    if (playing && !transitioning && !saveModalMode && event.target.closest('.stage-frame')
      && !event.target.closest('#choice-list, #play-controls, #player-start, #player-modal, #world-event')) next();
    return;
  }
  const action = node.dataset.action;
  if (new URLSearchParams(location.search).has('smoke')) window.__lastClickAction = action;
  try {
    if (action.startsWith('assistant-')) { await storyAssistant.click(action,node); return; }
    if (action === 'upload-dialogue-voice') { await uploadDialogueVoice(); return; }
    if (action === 'preview-dialogue-voice' || action === 'preview-voice-asset') { await previewDialogueVoice(action === 'preview-dialogue-voice' ? step()?.voiceId : node.dataset.assetId); return; }
    if (action === 'remove-dialogue-voice') { if (step()) { stopEditorVoicePreview(); step().voiceId = ''; markDirty(); renderInspector(); renderAssetDock(); } return; }
    if (action === 'delete-asset-folder' && project.assetFolders.find(folder => folder.id === node.dataset.folderId)?.type === 'voice') { toast('角色配音文件夹不能删除。', true); return; }
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
    } else if (action === 'import-folder-project') {
      if (dirty) await save();
      const info = await bridge('importFolderProject');
      if (!info) return;
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
    else if (action === 'export') {
      await save();
      const entered = prompt('导出的游戏文件夹叫什么名字？', `${project.name}_可游玩版`);
      if (entered === null) return;
      const folderName = entered.trim();
      if (!folderName) { toast('文件夹名字不能为空', true); return; }
      const result = await bridge('exportGame', { folderName });
      if (result) toast('游戏已导出到：' + result.directory);
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
      Object.assign(act().render, colorDefaults, { autoLight: true, lightStrength: .6 });
      markDirty(); renderInspector(); updatePreview();
    } else if (action === 'select-act') {
      selectedAct = Number(node.dataset.index); selectedStep = 0; renderSidebar(); renderInspector(); updatePreview();
    } else if (action === 'delete-act') {
      if (project.acts.length <= 1) { toast('至少保留一幕', true); return; }
      if (!confirm('删除这一幕及其中的对白？')) return;
      project.acts.splice(selectedAct, 1); selectedAct = Math.max(0, selectedAct - 1); selectedStep = 0;
      markDirty(); renderSidebar(); renderInspector(); updatePreview();
    } else if (action === 'add-step') {
      act().steps.push({id:uid(),characterId:'',speaker:'',text:'',cast:copyDialogueCast(step()||act().steps.at(-1)),voiceId:'',choices:[]});
      selectedStep = act().steps.length - 1; markDirty(); renderSidebar(); renderInspector(); updatePreview();
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
      const imported = await bridge('importAsset', { type:'image', single:true });
      if (item && imported?.length) {
        imported[0].galleryImage = false;
        project.assets.push(imported[0]); item.portraitId = imported[0].id; item.portraitSource = 'manual'; item.portraitPoseKey = '';
        markDirty(); renderSidebar(); renderInspector(); updatePreview();
      }
    } else if (action === 'capture-character-portrait') {
      const item = project.characters[selectedCharacter];
      if (item?.modelId) await ensureCharacterPortrait(item, true, true);
    } else if (action === 'cancel-image-import') {
      document.querySelector('#image-import-modal')?.remove();
    } else if (action === 'confirm-image-import') {
      const galleryImage = Boolean(document.querySelector('#image-import-gallery')?.checked);
      document.querySelector('#image-import-modal')?.remove();
      await importAssets('image', node.dataset.folderId || '', node.dataset.titleImport || '', galleryImage);
    } else if (action === 'add-asset-folder') {
      const type = node.dataset.type;
      if (type === 'voice') { redirectVoiceUpload(); return; }
      const name = prompt('新文件夹叫什么名字？', '新文件夹')?.trim();
      if (!name) return;
      if (project.assetFolders.some(folder => folder.type === type && folder.name.toLowerCase() === name.toLowerCase())) {
        toast('这个分类里已有同名文件夹', true); return;
      }
      const folder = { id: uid(), type, name: name.slice(0, 64) };
      project.assetFolders.push(folder);
      currentAssetFolder[type] = folder.id;
      markDirty(); renderSidebar();
    } else if (action === 'rename-asset-folder') {
      const folder = project.assetFolders.find(item => item.id === node.dataset.folderId);
      if (!folder) return;
      if (folder.type === 'voice') { toast('配音文件夹跟随角色名字，不能单独改名。', true); return; }
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
    else if (action === 'save-slot') saveSlot(Number(node.dataset.index));
    else if (action === 'load-slot') loadSlot(Number(node.dataset.index));
    else if (action === 'load-legacy-slot') loadSlot(-1);
    else if (action === 'close-modal') closePlayerModal();
    else if (action === 'settings') renderSettingsModal();
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
      renderGalleryModal();
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
      const choice = project.acts[playAct].steps[playStep].choices[Number(node.dataset.index)];
      const target = project.acts.findIndex(item => item.id === choice.actId);
      if (target < 0) { toast('这个选项还没有设置目标幕', true); return; }
      playAct = target; playStep = 0; showPlayStep();
    }
  } catch (error) { toast(error.message, true); }
});

document.addEventListener('input', event => {
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
    value=Number(Math.max(kind==='scale'?.001:-10000,Math.min(10000,value)).toFixed(5));prop[kind][axis]=value;
    const number=row.querySelector('[data-mode=number]'),coarse=row.querySelector('[data-mode=coarse]');number.value=String(value);
    coarse.min=String(Math.min(Number(coarse.min),value));coarse.max=String(Math.max(Number(coarse.max),value));coarse.value=String(value);
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
    else if (key === 'placement') holder.motionOptions.placement = node.value === 'free' ? 'free' : 'bounded';
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
      for(const control of node.closest('.adjustment').querySelectorAll('input'))control.value=String(value);
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
    for (const control of node.closest('.adjustment').querySelectorAll('input'))
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
  if (node.dataset.render && project) {
    const key = node.dataset.render;
    act().render[key] = key === 'autoLight' ? node.value === 'true'
      : key === 'shadowEnabled' ? node.checked
      : ['outline', 'shadowAngle', ...Object.keys(colorDefaults)].includes(key) ? Number(node.value)
      : ['lightStrength', 'shadowOpacity', 'paintStrength', 'shadowHeight'].includes(key) ? Number(node.value) / 100 : node.value;
    if (key === 'lightStrength') document.querySelector('#light-strength-value').textContent = `${node.value}%`;
    const output = document.querySelector(`[data-render-output="${key}"]`);
    if (output) output.textContent = key === 'shadowAngle' ? `${node.value}°`
      : key === 'hue' ? `${node.value}°` : key === 'temperature' ? node.value
      : key === 'shadowHeight' ? `${Number(node.value) > 0 ? '+' : ''}${node.value} 厘米` : `${node.value}%`;
    markDirty();
    stage?.setRenderSettings(act().render);
    applySceneColor(act().render);
    stage?.setBackgroundLighting(asset(act()?.backgroundId));
    return;
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
    markDirty(); setSceneWeather(act()); applySceneColor(chapterRender(act(),project.render));
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
      target.portraitId = '';
      target.portraitSource = '';
      target.portraitPoseKey = '';
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
  if (event.key === 'Escape' && document.querySelector('#gallery-lightbox')) {
    document.querySelector('#gallery-lightbox').remove(); return;
  }
  if (event.key === 'Escape' && saveModalMode) { closePlayerModal(); return; }
  if (saveModalMode) return;
  if (!playing || transitioning || event.repeat || !['Enter',' '].includes(event.key) || event.target.closest('button,input,textarea,select')) return;
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
  ,paintEffectActive: Boolean(stage?.paintEnabled && stage?.paintComposer)
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

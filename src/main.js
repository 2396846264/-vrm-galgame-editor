import './style.css';
import './skin.css';
import './layout.css';
import './vn-theme.css';
import './ios7-theme.css';
import { VRMStage, assetUrl, motionFrameInfo, captureVrmPortrait } from './renderer.js';

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
const openAssetFolders = new Set(['unfiled:vrm', 'unfiled:motion', 'unfiled:image', 'unfiled:audio', 'unfiled:video']);
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
let editorAutoSaveTimer = null;
let music = new Audio();
let voice = new Audio();
let audioSettings = { master: 1, music: 0.8, voice: 1 };
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
let saveModalMode = '';
let playerResolution = '1280x720';
let availableResolutions = [];
let playerFullscreen = false;
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
  const promise = pending.get(message.id);
  if (!promise) return;
  pending.delete(message.id);
  message.ok ? promise.resolve(message.data) : promise.reject(new Error(message.error));
});

const uid = () => crypto.randomUUID().replaceAll('-', '');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const asset = id => project?.assets.find(item => item.id === id);
const act = () => project.acts[selectedAct];
const step = () => act()?.steps[selectedStep];
const character = id => project.characters.find(item => item.id === id);
const options = (items, value, empty = '无') =>
  `<option value="">${escape(empty)}</option>${items.map(item =>
    `<option value="${escape(item.id)}" ${item.id === value ? 'selected' : ''}>${escape(item.name)}</option>`).join('')}`;
const byType = type => project.assets.filter(item => item.type === type);
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
const castSettingsOf = (currentAct, slot) => currentAct?.castSettings?.[slot] || {};
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
    } else if (scope === 'title') {
      motion = asset(project.title.motionId);
      model = asset(project.title.modelId);
      actorKey = `title:${project.title.modelId || 'empty'}`;
    } else if (scope.startsWith('cast:')) {
      const slot = scope.slice(5);
      motion = asset(castSettingsOf(act(), slot).motionId);
      actorKey = act()?.cast?.[slot];
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
  const slots = { ...currentAct?.cast };
  const seen = new Set();
  const actors = castSlots.flatMap(baseSlot => {
    const actorKey = slots[baseSlot];
    if (!actorKey || seen.has(actorKey)) return [];
    seen.add(actorKey);
    return [{ actorKey, baseSlot }];
  });
  const occupied = new Set();
  for (const actor of actors) {
    const wanted = speakingStep?.castPositions?.[actor.actorKey];
    actor.position = castSlots.includes(wanted) && !occupied.has(wanted) ? wanted : null;
    if (actor.position) occupied.add(actor.position);
  }
  for (const actor of actors) {
    if (actor.position) continue;
    actor.position = !occupied.has(actor.baseSlot) ? actor.baseSlot : castSlots.find(slot => !occupied.has(slot));
    occupied.add(actor.position);
  }
  return actors;
}
function castForAct(currentAct, speakingStep) {
  return castAssignments(currentAct, speakingStep).flatMap(({ actorKey, baseSlot, position }) => {
    const modelAsset = asset(character(actorKey)?.modelId);
    if (!modelAsset) return [];
    const settings = castSettingsOf(currentAct, baseSlot);
    return [{ actorKey, modelAsset, position, transform: transformOf(settings),
      expressionWeights: settings.expressionWeights || {}, motionAsset: asset(settings.motionId),
      motionOptions: motionOptionsOf(settings), playbackKey: `act:${currentAct.id}:${actorKey}` }];
  });
}
async function displayActStep(currentAct, current) {
  const cast = castForAct(currentAct, current);
  if (cast.length > 0) {
    const speakingEntry = cast.find(entry => entry.actorKey === current?.characterId);
    const base = speakingEntry?.transform || transformOf(null);
    const moment = transformOf(current);
    await stage.showCast(cast, speakingEntry ? {
      actorKey: current.characterId, modelAsset: modelForStep(current),
      motionAsset: asset(current.motionId) || speakingEntry?.motionAsset,
      motionOptions: current.motionId ? motionOptionsOf(current) : speakingEntry?.motionOptions,
      playbackKey: current.motionId ? `step:${current.id}` : speakingEntry?.playbackKey,
      expressionWeights: { ...(speakingEntry?.expressionWeights || {}), ...expressionWeightsOf(current) },
      transform: { size: base.size * moment.size / defaultSize,
        offsetX: base.offsetX + moment.offsetX, offsetY: base.offsetY + moment.offsetY,
        offsetZ: base.offsetZ + moment.offsetZ,
        yaw: base.yaw + moment.yaw }
    } : null, playing);
  } else {
    await stage.show(null, null, {}, 'center', transformOf(null), '', {}, '');
  }
}
const adjustmentSlider = (key, label, value, min, max, stepSize, display) =>
  `<label class="adjustment"><span>${label}</span><input type="range" data-adjust="${key}" min="${min}" max="${max}" step="${stepSize}" value="${value}"><output data-adjust-output="${key}">${display}</output></label>`;
const titleSlider = (key, label, value, min, max, stepSize, display) =>
  `<label class="adjustment"><span>${label}</span><input type="range" data-title-adjust="${key}" min="${min}" max="${max}" step="${stepSize}" value="${value}"><output data-title-output="${key}">${display}</output></label>`;
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
  return `<div class="title-logo-region">${logoMarkup}</div><nav class="title-bottom-menu">${menu}</nav>`;
}
async function showTitleScene(interactive = false) {
  const request = ++titleRequest;
  const frame = document.querySelector('.stage-frame');
  frame?.classList.add('title-mode');
  showBackground(asset(project.title.backgroundId));
  if (interactive && project.title.logoImageId) rememberDiscovery('image', project.title.logoImageId);
  stage.setRenderSettings(project.render);
  stage.setBackgroundLighting(asset(project.title.backgroundId));
  stage.setCameraAngle(project.title.cameraAngle);
  const overlay = document.querySelector(interactive ? '#player-start' : '#title-preview');
  if (overlay) {
    overlay.innerHTML = titleMarkup(interactive);
    overlay.classList.remove('hidden');
  }
  const placeholder = document.querySelector('#stage-placeholder');
  if (placeholder) placeholder.style.display = 'none';
  const loading = document.querySelector('#act-loading');
  if (project.title.modelId) loading?.classList.remove('hidden');
  await stage.show(asset(project.title.modelId), asset(project.title.motionId),
    project.title.expressionWeights || {}, 'center', transformOf(project.title), `title:${project.title.modelId || 'empty'}`,
    motionOptionsOf(project.title), 'title');
  if (request === titleRequest && !playing) {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (request === titleRequest && !playing) loading?.classList.add('hidden');
  }
  if (interactive && project.title.modelId)
    for (const item of project.characters.filter(item => item.modelId === project.title.modelId))
      rememberDiscovery('character', item.id);
  if (!interactive && activePanel === 'title') refreshMotionHints();
  if (!interactive && activePanel === 'title') renderTitleExpressionControls();
  if (interactive) setMusic(project.title.bgmId);
}

function defaultProject(name) {
  return {
    version: 1, id: uid(), name: name || '我的 VRM 故事', ui: { dialogueImageId: '' },
    title: { logoImageId: '', backgroundId: '', modelId: '', motionId: '', expressionWeights: {}, bgmId: '', authorNote: '',
      size: 1.7, offsetX: 0.65, offsetY: -1.15, offsetZ: 0, yaw: 0, pitch: 0, cameraAngle: 12 },
    render: { antialias: 'standard', style: 'anime', outline: 1, autoLight: true, lightStrength: 0.6,
      shadowEnabled: false, shadowAngle: 0, shadowOpacity: 0.45, paintEffect: 'none', paintStrength: 0.65 },
    assets: [], assetFolders: [], characters: [],
    acts: [{ id: uid(), name: '第一幕', backgroundId: '', bgmId: '', steps: [
      { id: uid(), characterId: '', speaker: '', text: '在这里写第一句对白。', expressionWeights: {}, motionId: '', position: 'center', size: defaultSize, offsetX: 0, offsetY: 0, voiceId: '', choices: [] }
    ] }]
  };
}
function normalize() {
  project.assets ||= [];
  project.assetFolders ||= [];
  project.characters ||= [];
  for (const item of project.characters) {
    item.portraitId ||= '';
    item.portraitSource ||= item.portraitId
      ? asset(item.portraitId)?.name === '自动头像.png' ? 'auto' : 'manual' : '';
    item.title ||= '';
    item.description ||= '';
    item.galleryMotionId ||= '';
    item.galleryYaw = Number.isFinite(Number(item.galleryYaw)) ? Number(item.galleryYaw) : 0;
    item.galleryPoseTime = Number.isFinite(Number(item.galleryPoseTime)) ? Number(item.galleryPoseTime) : 0;
    item.stories = Array.from({ length: 3 }, (_, index) => ({
      text: '', unlockLines: 0, ...(item.stories?.[index] || {})
    }));
  }
  project.acts ||= [];
  project.ui ||= { dialogueImageId: '' };
  project.title = { logoImageId: '', backgroundId: '', modelId: '', motionId: '', expressionWeights: {}, bgmId: '', authorNote: '',
    size: 1.7, offsetX: 0.65, offsetY: -1.15, offsetZ: 0, yaw: 0, pitch: 0, cameraAngle: 12, ...project.title };
  project.title.expressionWeights ||= {};
  project.render = { antialias: 'standard', style: 'original', outline: 0, autoLight: true, lightStrength: 0.6,
    shadowEnabled: false, shadowAngle: 0, shadowOpacity: 0.45,
    paintEffect: 'none', paintStrength: 0.65, ...project.render };
  for (const item of project.acts) {
    item.steps ||= [];
    item.castSettings ||= {};
    if (!item.cast) {
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
}
async function init() {
  try {
    const info = await bridge('init');
    mode = info.mode;
    directory = info.directory || '';
    recentProjects = info.recentProjects || [];
    playerResolution = info.windowResolution || playerResolution;
    availableResolutions = info.availableResolutions || [];
    playerFullscreen = Boolean(info.fullscreen);
    project = info.project;
    if (project) normalize();
    if (project) loadAudioSettings();
    if (project && mode === 'player') loadLifetimeProgress();
    if (mode === 'editor') loadEditorSettings();
    window.__vrmProjectId = project?.id || project?.name || '';
    if (mode === 'player') renderPlayer();
    else if (project) renderEditor();
    else renderWelcome();
    if (project && mode === 'editor') queueMissingPortraits();
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
function markDirty() {
  changeRevision++;
  dirty = true;
  const marker = document.querySelector('#save-state');
  if (marker) marker.textContent = '● 未保存';
}
async function save() {
  if (!project || mode !== 'editor') return;
  if (saveInFlight) await saveInFlight;
  const revision = changeRevision;
  const task = bridge('saveProject', { project: structuredClone(project) });
  saveInFlight = task;
  try {
    await task;
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
  stage?.destroy();
  app.innerHTML = `<div class="editor">
    <header class="topbar"><div class="brand">✦ <b>VRM Galgame</b><span>编辑器</span></div>
      <div class="project-title"><input id="project-name" value="${escape(project.name)}" aria-label="游戏名称"><span id="save-state">✓ 已保存</span></div>
      <nav>${button('新建', 'new-project')}${button('打开', 'open-project')}${button('最近', 'recent-projects')}${button('导入旧工程', 'import-folder-project')}${button('保存', 'save')}${button('另存为', 'save-as')}${button('☾', 'toggle-editor-theme', 'class="theme-toggle" aria-label="切换夜间模式" aria-pressed="false" title="切换到夜间模式"')}${button('设置', 'editor-settings')}${button('试玩', 'play', 'class="primary"')}${button('导出游戏', 'export')}</nav>
    </header>
    <div class="workspace">
      <aside class="sidebar"><div class="tabs">
        <button data-panel="story" class="active">剧情</button><button data-panel="characters">角色</button><button data-panel="assets">素材</button><button data-panel="title">标题</button><button data-panel="render">渲染</button>
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
  renderSidebar();
  renderInspector();
  updatePreview();
}
function renderSidebar() {
  document.querySelectorAll('[data-panel]').forEach(node => node.classList.toggle('active', node.dataset.panel === activePanel));
  const body = document.querySelector('#sidebar-body');
  if (activePanel === 'story') {
    body.innerHTML = `<div class="section-heading">幕 ${button('＋ 新增', 'add-act')}</div>
      <div class="list" data-order-list="act">${project.acts.map((item, index) =>
        `<button class="list-row sortable-row ${index === selectedAct ? 'selected' : ''}" draggable="true" data-order-kind="act" data-order-index="${index}" data-action="select-act" data-index="${index}">
          <span class="number">${String(index + 1).padStart(2, '0')}</span><span>${escape(item.name)}</span><small>${item.steps.length} 句</small><span class="drag-grip" aria-hidden="true">⋮⋮</span></button>`).join('')}</div>
      <div class="section-heading">对白 <span class="heading-actions">${button('复制选中', 'duplicate-step', act()?.steps.length ? '' : 'disabled')}${button('＋ 新增', 'add-step')}</span></div>
      <div class="list step-list" data-order-list="step">${(act()?.steps || []).map((item, index) =>
        `<button class="list-row sortable-row ${index === selectedStep ? 'selected' : ''}" draggable="true" data-order-kind="step" data-order-index="${index}" data-action="select-step" data-index="${index}">
          <span class="number">${index + 1}</span><span><b>${escape(item.speaker || character(item.characterId)?.name || '旁白')}</b><small>${escape(item.text || '空对白')}</small></span><span class="drag-grip" aria-hidden="true">⋮⋮</span></button>`).join('')}</div>
      <div class="sidebar-note">按住幕或对白，拖到想放的位置即可调整顺序。</div>`;
  } else if (activePanel === 'characters') {
    body.innerHTML = `<div class="section-heading">角色 ${button('＋ 新增', 'add-character')}</div>
      <div class="list">${project.characters.map((item, index) =>
        `<button class="list-row ${index === selectedCharacter ? 'selected' : ''}" data-action="select-character" data-index="${index}">
          <span class="number">✦</span><span>${escape(item.name)}</span><small>${item.modelId ? 'VRM' : '未设模型'}</small></button>`).join('')}</div>
      <div class="sidebar-note">角色只需设置一次。对白选中角色后就能调用它的模型。</div>`;
  } else if (activePanel === 'render') {
    body.innerHTML = '<div class="section-heading">画面效果</div><div class="sidebar-note">在右侧设置抗锯齿、画风、描边和背景配光。这里的设置会跟随工程一起导出。</div>';
  } else if (activePanel === 'title') {
    body.innerHTML = `<div class="section-heading">标题画面</div>
      <div class="title-sidebar-actions">
        ${button('导入 Logo', 'import', 'data-type="image" data-title-import="logoImageId"')}
        ${button('导入标题人物', 'import', 'data-type="vrm" data-title-import="modelId"')}
        ${button('导入标题动作', 'import', 'data-type="motion" data-title-import="motionId"')}
        ${button('导入背景', 'import', 'data-type="image" data-title-import="backgroundId"')}
      </div><div class="sidebar-note">标题布局固定：Logo 在左侧，人物在中间偏右，菜单排在底部。导入后到右侧调整位置和角度。</div>`;
  } else {
    const groups = [['vrm','VRM 角色'],['motion','动作 VRMA / Mixamo FBX'],['image','图片'],['audio','声音'],['video','视频']];
    body.innerHTML = groups.map(([type,label]) => {
      const folders = project.assetFolders.filter(folder => folder.type === type);
      const unfiled = byType(type).filter(item => !folders.some(folder => folder.id === item.folderId));
      return `<div class="section-heading">${label}<span class="heading-actions">
        ${button('＋ 文件夹', 'add-asset-folder', `data-type="${type}"`)}${button('＋ 导入', 'import', `data-type="${type}"`)}</span></div>
        <div class="asset-folder-list">${folders.map(folder => renderAssetFolder(type, folder, byType(type).filter(item => item.folderId === folder.id))).join('')}
        ${renderAssetFolder(type, null, unfiled)}</div>`;
    }).join('') + '<div class="sidebar-note">新素材可直接导入指定文件夹；已有素材可用右侧下拉框移动。</div>';
  }
}
function renderAssetFolder(type, folder, items) {
  const key = folder?.id || `unfiled:${type}`;
  const folders = project.assetFolders.filter(item => item.type === type);
  return `<details class="asset-folder" data-folder-key="${escape(key)}" ${openAssetFolders.has(key) ? 'open' : ''}>
    <summary><span class="folder-icon">▸</span><span class="folder-name">${escape(folder?.name || '未分类')}</span><small>${items.length}</small></summary>
    <div class="asset-folder-body">
      ${folder ? `<div class="asset-folder-actions">${button('改名', 'rename-asset-folder', `data-folder-id="${escape(folder.id)}"`)}${button('导入这里', 'import', `data-type="${type}" data-folder-id="${escape(folder.id)}"`)}</div>` : ''}
      ${items.map(item => `<div class="asset-row" title="${escape(item.path)}"><span>${escape(item.name)}</span>
        <select data-asset-folder="${escape(item.id)}" aria-label="把 ${escape(item.name)} 移动到文件夹" title="移动到文件夹">
          <option value="" ${!item.folderId ? 'selected' : ''}>未分类</option>
          ${folders.map(target => `<option value="${escape(target.id)}" ${item.folderId === target.id ? 'selected' : ''}>${escape(target.name)}</option>`).join('')}
        </select>${button('删除', 'delete-asset', `data-asset-id="${escape(item.id)}" class="asset-delete"`)}</div>`).join('') || '<div class="empty">这里还没有素材</div>'}
    </div></details>`;
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
document.addEventListener('toggle', event => {
  const details = event.target;
  if (!details.matches?.('.asset-folder')) return;
  if (details.open) openAssetFolders.add(details.dataset.folderKey);
  else openAssetFolders.delete(details.dataset.folderKey);
}, true);
function castEditor(currentAct, slot) {
  const settings = castSettingsOf(currentAct, slot);
  const actorId = currentAct.cast?.[slot];
  const slider = (key, label, value, min, max, stepSize, unit = '') =>
    `<label class="adjustment"><span>${label}</span><input type="range" data-cast-adjust="${slot}.${key}" min="${min}" max="${max}" step="${stepSize}" value="${value}"><output data-cast-output="${slot}.${key}">${value}${unit}</output></label>`;
  return `<details class="cast-editor"><summary>${castSlotLabels[slot]} · ${escape(character(actorId)?.name || '未选择')}</summary>
    <div class="cast-editor-body">
      ${field('角色', `<select data-cast-slot="${slot}">${options(project.characters.filter(item => item.modelId || item.id === actorId), actorId, '此位置无人')}</select>`)}
      ${actorId ? `${field('本幕动作', `<select data-cast-motion="${slot}">${options(byType('motion'), settings.motionId, '保持站立')}</select>`)}
        ${motionAdvanced(settings, `cast:${slot}`)}
        ${slider('size', '大小', Math.round((settings.size ?? defaultSize) * 100), 50, 250, 5, '%')}
        ${slider('offsetX', '左右', Number(settings.offsetX) || 0, -1.5, 1.5, 0.05)}
        ${slider('offsetY', '上下', Number(settings.offsetY) || 0, -3, 2, 0.05)}
        ${slider('offsetZ', '前后', Number(settings.offsetZ) || 0, -2, 1.5, 0.05)}
        ${slider('yaw', '转身角度', Number(settings.yaw) || 0, -90, 90, 5, '°')}
        <div class="field"><span>本幕表情</span><div id="cast-expression-${slot}" class="expression-controls"></div></div>` : ''}
    </div></details>`;
}
function renderInspector() {
  const body = document.querySelector('#inspector-body');
  if (activePanel === 'characters') {
    const item = project.characters[selectedCharacter];
    body.innerHTML = item ? `<div class="inspector-content"><h2>角色设置</h2>
      ${field('角色名字', input('character.name', item.name))}
      ${field('VRM 模型', select('character.modelId', byType('vrm'), item.modelId, '请选择模型'))}
      <div class="portrait-editor"><span>说话头像</span>${asset(item.portraitId) ? `<img src="${assetUrl(asset(item.portraitId))}" alt="${escape(item.name)}的头像">` : '<div class="portrait-empty">还没有头像</div>'}
        <div class="inline-actions">${button('上传头像', 'upload-character-portrait')}${item.modelId ? button('重新拍摄 VRM', 'capture-character-portrait') : ''}</div>
        <p class="tip">没有模型也能上传头像说话。VRM 自动头像会采用下方选中的动作和定格时间；松开时间滑块后会重拍。手动上传的头像不会被覆盖。</p></div>
      ${field('鉴赏姿势 / 动作', select('character.galleryMotionId', byType('motion'), item.galleryMotionId, '保持站立'))}
      <label class="adjustment"><span>鉴赏转身角度</span><input type="range" data-gallery-adjust="galleryYaw" min="-90" max="90" step="5" value="${item.galleryYaw}"><output data-gallery-output="galleryYaw">${item.galleryYaw}°</output></label>
      <label class="adjustment"><span>动作定格时间</span><input type="range" data-gallery-adjust="galleryPoseTime" min="0" max="5" step="0.1" value="${item.galleryPoseTime}"><output data-gallery-output="galleryPoseTime">${item.galleryPoseTime.toFixed(1)} 秒</output></label>
      ${field('身份 / 称号', input('character.title', item.title, '例如：旅行者、学生'))}
      ${field('角色简介', textarea('character.description', item.description, '玩家在角色鉴赏里看到的介绍'))}
      <hr><h2>角色故事（最多三段）</h2>
      <p class="tip">留空的故事不会出现在游戏里。解锁数字填 0 时，玩家一开始就能阅读。</p>
      ${item.stories.map((story, index) => `<div class="character-story-editor">
        <h3>故事 ${index + 1}</h3>
        ${field('故事内容', `<textarea data-story-index="${index}" data-story-field="text" placeholder="不写就不显示">${escape(story.text)}</textarea>`)}
        ${field('读过这个角色多少句对白后解锁', `<input type="number" min="0" step="1" data-story-index="${index}" data-story-field="unlockLines" value="${Math.max(0, Number(story.unlockLines) || 0)}">`)}
      </div>`).join('')}
      <div class="inline-actions">${button('导入 VRM', 'import', 'data-type="vrm"')}${button('删除角色', 'delete-character', 'class="danger"')}</div>
      <p class="tip">选中角色后，预览里会显示它。表情名称取决于模型本身。</p></div>` : '<div class="inspector-content empty">先新增角色</div>';
    if (item) updatePreview();
    return;
  }
  if (activePanel === 'assets') {
    body.innerHTML = `<div class="inspector-content"><h2>游戏界面</h2>
      ${field('对话框图片', select('project.ui.dialogueImageId', byType('image'), project.ui.dialogueImageId, '使用内置样式'))}
      <p class="tip">可换成自己的 PNG 或 WebP 图片。建议做成横向、带透明通道的对话框。</p>
      <hr><h2>图片鉴赏</h2><p class="tip">只有勾选的图片才会出现在游戏的图像鉴赏中。新导入的图片默认不加入，旧工程的图片保持原样。</p>
      ${byType('image').length ? byType('image').map(item => `<label class="gallery-audio-check gallery-image-check"><input type="checkbox" data-gallery-image="${escape(item.id)}" ${item.galleryImage === false ? '' : 'checked'}><span>${escape(item.name)}</span></label>`).join('') : '<p class="tip">还没有导入图片。</p>'}
      <hr><h2>音乐鉴赏</h2><p class="tip">勾选要放进音乐鉴赏的歌曲；语音和音效可以取消勾选。歌名可以单独修改。</p>
      ${byType('audio').length ? byType('audio').map(item => `<div class="gallery-audio-editor">
        <label class="gallery-audio-check"><input type="checkbox" data-gallery-music="${escape(item.id)}" ${item.galleryMusic === false ? '' : 'checked'}><span>${escape(item.name)}</span></label>
        <input data-audio-title="${escape(item.id)}" value="${escape(item.galleryTitle || '')}" placeholder="歌名：${escape(item.name.replace(/\.[^.]+$/, ''))}">
      </div>`).join('') : '<p class="tip">还没有导入音频。</p>'}
      <h2>支持格式</h2><p class="tip">模型 .vrm<br>动作 .vrma / Mixamo .fbx<br>图片 .png / .jpg / .webp<br>声音 .mp3 / .wav / .ogg<br>视频 .mp4 / .webm</p></div>`;
    return;
  }
  if (activePanel === 'title') {
    const title = project.title;
    body.innerHTML = `<div class="inspector-content"><h2>标题画面</h2>
      ${field('Logo 图片', `<select data-title-field="logoImageId">${options(byType('image'), title.logoImageId, '使用游戏名称')}</select>`)}
      ${field('标题背景', `<select data-title-field="backgroundId">${options(byType('image'), title.backgroundId, '使用默认深蓝背景')}</select>`)}
      ${field('标题 VRM 人物', `<select data-title-field="modelId">${options(byType('vrm'), title.modelId, '不显示人物')}</select>`)}
      ${field('标题人物动作', `<select data-title-field="motionId">${options(byType('motion'), title.motionId, '保持站立')}</select>`)}
      ${motionAdvanced(title, 'title')}
      ${field('标题音乐', `<select data-title-field="bgmId">${options(byType('audio'), title.bgmId, '无音乐')}</select>`)}
      <p class="tip">Logo 固定在左侧，按钮固定在底部。人物的位置和角度可以调整。</p>
      <hr><h2>标题人物</h2>
      ${titleSlider('size', '大小', Math.round(title.size * 100), 50, 500, 5, `${Math.round(title.size * 100)}%`)}
      ${titleSlider('offsetX', '左右位置', title.offsetX, -2, 2, .05, Number(title.offsetX).toFixed(2))}
      ${titleSlider('offsetY', '上下位置', title.offsetY, -10, 3, .05, Number(title.offsetY).toFixed(2))}
      ${titleSlider('offsetZ', '前后位置', title.offsetZ, -2, 1.5, .05, Number(title.offsetZ).toFixed(2))}
      ${titleSlider('yaw', '左右转身', title.yaw, -120, 120, 5, `${title.yaw}°`)}
      ${titleSlider('pitch', '人物上下转角', title.pitch, -60, 60, 5, `${title.pitch}°`)}
      ${titleSlider('cameraAngle', '镜头俯视角', title.cameraAngle, 0, 65, 5, `${title.cameraAngle}°`)}
      <h3>标题人物表情</h3><div id="title-expression-controls" class="expression-controls"></div>
      <p class="tip">想做俯视画面，可以先提高“镜头俯视角”，再微调人物的上下转角与位置。</p>
    </div>`;
    renderTitleExpressionControls();
    return;
  }
  if (activePanel === 'render') {
    const settings = project.render;
    body.innerHTML = `<div class="inspector-content"><h2>画面渲染</h2>
      ${field('抗锯齿', `<select data-render="antialias"><option value="off" ${settings.antialias === 'off' ? 'selected' : ''}>关闭</option><option value="standard" ${settings.antialias === 'standard' ? 'selected' : ''}>标准</option><option value="high" ${settings.antialias === 'high' ? 'selected' : ''}>高清</option></select>`)}
      ${field('人物画风', `<select data-render="style"><option value="original" ${settings.style === 'original' ? 'selected' : ''}>模型原版</option><option value="anime" ${settings.style === 'anime' ? 'selected' : ''}>三渲二（推荐）</option><option value="soft" ${settings.style === 'soft' ? 'selected' : ''}>柔和动漫</option><option value="cinematic" ${settings.style === 'cinematic' ? 'selected' : ''}>电影色调</option></select>`)}
      ${field('人物描边', `<select data-render="outline"><option value="0" ${Number(settings.outline) === 0 ? 'selected' : ''}>关闭</option><option value="1" ${Number(settings.outline) === 1 ? 'selected' : ''}>细</option><option value="2" ${Number(settings.outline) === 2 ? 'selected' : ''}>中</option><option value="3" ${Number(settings.outline) === 3 ? 'selected' : ''}>粗</option></select>`)}
      ${field('根据背景自动配光', `<select data-render="autoLight"><option value="true" ${settings.autoLight ? 'selected' : ''}>开启</option><option value="false" ${!settings.autoLight ? 'selected' : ''}>关闭</option></select>`)}
      ${field('背景配光强度', `<input type="range" data-render="lightStrength" min="0" max="100" step="5" value="${Math.round(settings.lightStrength * 100)}"><output id="light-strength-value">${Math.round(settings.lightStrength * 100)}%</output>`)}
      ${field('画面效果', `<select data-render="paintEffect"><option value="none" ${settings.paintEffect !== 'oil' ? 'selected' : ''}>关闭</option><option value="oil" ${settings.paintEffect === 'oil' ? 'selected' : ''}>油画笔触（人物与背景）</option></select>`)}
      ${field('油画笔触强度', `<input type="range" data-render="paintStrength" min="0" max="100" step="5" value="${Math.round((Number(settings.paintStrength) || 0) * 100)}"><output data-render-output="paintStrength">${Math.round((Number(settings.paintStrength) || 0) * 100)}%</output>`)}
      <p class="tip">油画笔触会一起处理背景和人物；对白、菜单保持清晰。开启后会多用一些显卡性能，旧工程默认关闭。</p>
      <details class="render-advanced"><summary>高级渲染 · 角色阴影</summary><div class="render-advanced-body">
        <label class="render-shadow-toggle"><input type="checkbox" data-render="shadowEnabled" ${settings.shadowEnabled ? 'checked' : ''}><span>显示角色阴影</span></label>
        <label class="adjustment"><span>影子方向</span><input type="range" data-render="shadowAngle" min="-180" max="180" step="5" value="${Number(settings.shadowAngle) || 0}"><output data-render-output="shadowAngle">${Number(settings.shadowAngle) || 0}°</output></label>
        <label class="adjustment"><span>影子深浅</span><input type="range" data-render="shadowOpacity" min="0" max="100" step="5" value="${Math.round((Number(settings.shadowOpacity) || 0) * 100)}"><output data-render-output="shadowOpacity">${Math.round((Number(settings.shadowOpacity) || 0) * 100)}%</output></label>
        <p class="tip">一套设置控制画面中的全部角色。0° 表示影子朝画面下方；默认关闭。</p>
      </div></details>
      <p class="tip">“三渲二”会增强动画式明暗、减少塑料般的高光。描边选“细”通常更自然。背景配光会从图片估计亮处和颜色；视频背景使用默认灯光。</p></div>`;
    return;
  }
  const currentAct = act();
  const current = step();
  if (!currentAct) { body.innerHTML = '<div class="inspector-content empty">先新增一幕</div>'; return; }
  body.innerHTML = `<div class="inspector-content"><h2>${escape(currentAct.name)}</h2>
    ${field('幕名称', input('act.name', currentAct.name))}
    ${field('背景图片 / 视频', select('act.backgroundId', [...byType('image'),...byType('video')], currentAct.backgroundId, '无背景'))}
    ${field('背景音乐', select('act.bgmId', byType('audio'), currentAct.bgmId, '无音乐'))}
    <hr><h2>本幕登场人物（初始位置）</h2>
    ${castSlots.map(slot => castEditor(currentAct, slot)).join('')}
    <p class="tip">这里选本幕舞台上的人物。没有站在舞台上的角色，也能用头像、名字和对白说话。</p>
    <div class="inline-actions">${button('删除本幕', 'delete-act', 'class="danger"')}</div>
    <hr><h2>第 ${selectedStep + 1} 句对白</h2>
    ${current ? `
      ${field('角色', select('step.characterId', project.characters, current.characterId, '旁白 / 无模型'))}
      ${castAssignments(currentAct, current).length > 1 ? `<div class="step-cast-positions"><span>这一句的人物站位</span>
        ${castAssignments(currentAct, current).map(entry => `<label><span>${escape(character(entry.actorKey)?.name || '角色')}</span>
          <select data-step-cast="${escape(entry.actorKey)}">${castSlots.map(slot => `<option value="${slot}" ${entry.position === slot ? 'selected' : ''}>${castSlotLabels[slot]}</option>`).join('')}</select>
        </label>`).join('')}<small>把一人换到其他位置时，原位置的人会与其交换。</small></div>` : ''}
      ${field('显示名字', input('step.speaker', current.speaker, '留空时用角色名字'))}
      ${field('对白内容', textarea('step.text', current.text, '在这里写台词'))}
      <div class="field"><span>表情参数（可以同时调多项）</span><div id="expression-controls" class="expression-controls"></div></div>
      ${field('动作', select('step.motionId', byType('motion'), current.motionId, '保持站立'))}
      ${motionAdvanced(current, 'step')}
      ${field('位置（单人幕使用）', `<select data-field="step.position"><option value="left" ${current.position === 'left' ? 'selected' : ''}>左侧</option><option value="center" ${current.position === 'center' ? 'selected' : ''}>中间</option><option value="right" ${current.position === 'right' ? 'selected' : ''}>右侧</option></select>`)}
      <div class="field"><span>人物大小和位置</span>
        ${adjustmentSlider('size', '大小', Math.round((current.size ?? defaultSize) * 100), 50, 250, 5, `${Math.round((current.size ?? defaultSize) * 100)}%`)}
        ${adjustmentSlider('offsetX', '左右微调', Number(current.offsetX) || 0, -1.5, 1.5, 0.05, (Number(current.offsetX) || 0).toFixed(2))}
        ${adjustmentSlider('offsetY', '上下微调', Number(current.offsetY) || 0, -3, 2, 0.05, (Number(current.offsetY) || 0).toFixed(2))}
        ${adjustmentSlider('offsetZ', '前后微调', Number(current.offsetZ) || 0, -2, 1.5, 0.05, (Number(current.offsetZ) || 0).toFixed(2))}
        ${adjustmentSlider('yaw', '转身微调', Number(current.yaw) || 0, -90, 90, 5, `${Number(current.yaw) || 0}°`)}
        <p class="tip">左右：负数向左，正数向右。上下：正数向上。前后：正数靠近镜头，负数远离镜头。转身角度可以让人物侧身。</p></div>
      ${field('语音', select('step.voiceId', byType('audio'), current.voiceId, '无语音'))}
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
    const actorId = act().cast?.[slot];
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
  const node = document.querySelector('#title-expression-controls');
  if (!node || !project) return;
  const modelAsset = asset(project.title.modelId);
  if (!modelAsset) { node.innerHTML = '<p class="tip">先选择一个标题 VRM 人物。</p>'; return; }
  if (stage?.currentModelId !== modelAsset.id || !stage?.vrm) {
    node.innerHTML = '<p class="tip">正在读取人物的表情参数…</p>';
    return;
  }
  const names = stage.expressions();
  if (!names.length) { node.innerHTML = '<p class="tip">这个模型没有可调的表情参数。</p>'; return; }
  const weights = project.title.expressionWeights || {};
  node.innerHTML = names.map(name => {
    const value = Math.round(Math.max(0, Math.min(1, Number(weights[name]) || 0)) * 100);
    return `<label class="expression-slider"><span title="${escape(name)}">${escape(expressionLabels[name] || name)}</span>
      <input type="range" data-title-expression="${escape(name)}" min="0" max="100" step="1" value="${value}">
      <output data-title-expression-output="${escape(name)}">${value}%</output></label>`;
  }).join('') + `<div class="inline-actions">${button('表情全部归零', 'reset-title-expressions')}</div>`;
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
  const current = step();
  const modelAsset = modelForStep(current);
  const motionAsset = asset(current?.motionId);
  const bgAsset = asset(currentAct?.backgroundId);
  showBackground(bgAsset);
  stage.setRenderSettings(project.render);
  stage.setBackgroundLighting(bgAsset);
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
function showBackground(bgAsset) {
  const node = document.querySelector('#scene-bg');
  node.replaceChildren();
  node.style.backgroundImage = '';
  stage?.setPaintBackground(bgAsset);
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
async function ensureCharacterPortrait(item, force = false) {
  const modelAsset = asset(item?.modelId);
  if (!item || !modelAsset || (!force && asset(item.portraitId))) return;
  const motionId = item.galleryMotionId || '';
  const motionAsset = asset(motionId);
  const poseTime = Math.max(0, Number(item.galleryPoseTime) || 0);
  const poseKey = `portrait-v2:${item.modelId}:${motionId}:${poseTime}`;
  const jobKey = `${project.id}:${item.id}:${item.modelId}:${motionId}:${poseTime}`;
  if (portraitJobs.has(jobKey)) return portraitJobs.get(jobKey);
  const modelId = item.modelId;
  const task = (async () => {
    const dataUrl = await captureVrmPortrait(modelAsset, motionAsset, poseTime);
    if (project.characters.find(entry => entry.id === item.id) !== item || item.modelId !== modelId ||
      item.galleryMotionId !== motionId || Number(item.galleryPoseTime) !== poseTime || (!force && asset(item.portraitId))) return;
    if (mode === 'player') temporaryPortraits.set(item.id, dataUrl);
    else {
      const saved = await bridge('saveGeneratedPortrait', { dataUrl });
      if (project.characters.find(entry => entry.id === item.id) !== item || item.modelId !== modelId ||
        item.galleryMotionId !== motionId || Number(item.galleryPoseTime) !== poseTime || (!force && asset(item.portraitId))) return;
      saved.galleryImage = false;
      project.assets.push(saved);
      item.portraitId = saved.id;
      item.portraitSource = 'auto';
      item.portraitPoseKey = poseKey;
      markDirty();
      if (activePanel === 'characters' && project.characters[selectedCharacter] === item) {
        const inspector = document.querySelector('.inspector');
        const scroll = inspector?.scrollTop || 0;
        renderInspector();
        if (inspector) inspector.scrollTop = scroll;
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
function queueMissingPortraits() {
  const items = project.characters.filter(item => item.modelId && portraitIsAutomatic(item) &&
    (!asset(item.portraitId) || item.portraitPoseKey !==
      `portrait-v2:${item.modelId}:${item.galleryMotionId || ''}:${Math.max(0, Number(item.galleryPoseTime) || 0)}`));
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
  document.querySelector('#dialogue-text').textContent = text;
  updateSpeakerPortrait(characterId, visible || mode === 'editor');
  node.style.backgroundImage = project.ui.dialogueImageId ? `url("${assetUrl(asset(project.ui.dialogueImageId))}")` : '';
  if (visible && project.ui.dialogueImageId) rememberDiscovery('image', project.ui.dialogueImageId);
}
function setMusic(id) {
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
  music.volume = audioSettings.master * audioSettings.music;
  voice.volume = audioSettings.master * audioSettings.voice;
  galleryMusic.volume = audioSettings.master * audioSettings.music;
}
function loadAudioSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(audioKey()) || 'null');
    if (saved) for (const key of ['master', 'music', 'voice'])
      if (Number.isFinite(Number(saved[key]))) audioSettings[key] = Math.max(0, Math.min(1, Number(saved[key])));
  } catch { /* Use the default volumes if old settings are invalid. */ }
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
  if (!autoPlay || !playing || !current || current.choices?.length || saveModalMode) return;
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
  const currentAct = project.acts[playAct];
  const current = currentAct?.steps[playStep];
  if (!current) { stopPlay(); toast('故事播放完毕'); return; }
  transitioning = true;
  let displayed = false;
  const loading = document.querySelector('#act-loading');
  try {
    if (preparedAct !== playAct) {
      loading?.classList.remove('hidden');
      const castIds = new Set(Object.values(currentAct.cast || {}));
      const entries = currentAct.steps.filter(entry => castIds.has(entry.characterId)).map(entry => ({ actorKey: entry.characterId,
        modelAsset: modelForStep(entry), motionAsset: asset(entry.motionId) }));
      for (const castEntry of castForAct(currentAct, current))
        entries.push({ actorKey: castEntry.actorKey, modelAsset: castEntry.modelAsset, motionAsset: castEntry.motionAsset });
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
    stage.setRenderSettings(project.render);
    stage.setBackgroundLighting(asset(currentAct.backgroundId));
    await displayActStep(currentAct, current);
    if (request !== playRequest || !playing) return;
    if (mode === 'player') for (const id of stage.visibleRecords.keys())
      if (character(id)) rememberDiscovery('character', id);
    if (mode === 'player' && character(current.characterId)) rememberDiscovery('character', current.characterId);
    showBackground(asset(currentAct.backgroundId));
    await ensureCharacterPortrait(character(current.characterId));
    if (request !== playRequest || !playing) return;
    showDialogue(current.speaker || character(current.characterId)?.name || '旁白', current.text, true, current.characterId);
    recordViewedDialogue(current);
    setMusic(currentAct.bgmId);
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
  playing = false;
  clearInterval(playerAutoSaveTimer);
  playerAutoSaveTimer = null;
  autoPlay = false;
  clearAutoAdvance();
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
    seenCharacterIds: [], seenImageIds: [], heardMusicIds: [], lastActId: '' };
  try {
    const stored = JSON.parse(localStorage.getItem(lifetimeKey()) || 'null');
    if (stored && typeof stored === 'object') {
      for (const key of ['viewedDialogueIds', 'seenCharacterIds', 'seenImageIds', 'heardMusicIds'])
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
  document.querySelector('#player-modal')?.remove();
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
    actName: currentAct.name, text: currentStep.text,
    speaker: currentStep.speaker || character(currentStep.characterId)?.name || '旁白',
    backgroundId: currentAct.backgroundId, savedAt: new Date().toISOString(),
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
      <h3>音量</h3>${volume('master', '总音量')}${volume('music', '背景音乐')}${volume('voice', '角色语音')}
      <h3>画面</h3>
      <label class="field"><span>窗口大小（全部为 16:9）</span><select id="window-resolution" ${playerFullscreen ? 'disabled' : ''}>${resolutions.map(value => `<option value="${value}" ${value === playerResolution ? 'selected' : ''}>${value.replace('x', ' × ')}</option>`).join('')}</select></label>
      ${button('应用窗口大小', 'apply-resolution', playerFullscreen ? 'disabled' : '')}
      <div class="settings-line"><span>全屏显示</span>${button(playerFullscreen ? '退出全屏' : '进入全屏', 'toggle-fullscreen')}</div>
      <p>无论窗口大小或显示器比例如何，游戏画面始终保持 16:9。</p>
      <p class="font-credit">界面使用 HarmonyOS Sans 字体。© 2021 Huawei Device Co., Ltd.</p>
    </div></section>`);
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
  const overlay = document.querySelector('#character-preview');
  const frame = document.querySelector('.editor .stage-frame');
  if (!overlay || !frame) return;
  if (stage?.element?.parentElement !== frame) frame.insertBefore(stage.element, overlay);
  overlay.classList.add('hidden');
  overlay.replaceChildren();
  stage?.resize();
}
async function showCharacterEditorPreview() {
  const overlay = document.querySelector('#character-preview');
  const frame = document.querySelector('.editor .stage-frame');
  if (!overlay || !frame || !stage) return;
  const item = project.characters[selectedCharacter];
  if (stage.element.parentElement !== frame) frame.insertBefore(stage.element, overlay);
  stage.setPaintBackground(null);
  overlay.innerHTML = `<div class="gallery-box gallery-box-character character-preview-box">
    <header><div><small>EXTRAS</small><h2>附加鉴赏</h2></div></header>
    <div class="gallery-main-tabs"><button type="button" disabled>图像鉴赏</button><button type="button" disabled>乐曲鉴赏</button><button type="button" class="active">人物鉴赏</button></div>
    <div class="gallery-content">${galleryCharacterMarkup(true)}</div></div>`;
  overlay.querySelector('.gallery-character-picker .active')?.scrollIntoView({ block: 'nearest' });
  overlay.classList.remove('hidden');
  document.querySelector('#stage-caption').textContent = '人物鉴赏预览';
  document.querySelector('#stage-placeholder').style.display = 'none';
  document.querySelector('#dialogue')?.classList.remove('visible');
  updateSpeakerPortrait('', false);
  if (!item?.modelId) {
    const portraitAsset = asset(item?.portraitId);
    const target = overlay.querySelector('#gallery-character-canvas');
    if (target && portraitAsset) target.innerHTML = `<img class="gallery-flat-portrait" src="${assetUrl(portraitAsset)}" alt="${escape(item.name)}">`;
    await stage.show(null, null); return;
  }
  const portrait = overlay.querySelector('#gallery-character-canvas');
  if (!portrait) return;
  portrait.appendChild(stage.element);
  stage.resize();
  stage.setRenderSettings(project.render);
  stage.setPortraitCamera();
  await stage.show(asset(item.modelId), asset(item.galleryMotionId), {}, 'center',
    { size: 1.23, yaw: item.galleryYaw || 0 }, `gallery:${item.id}`);
  if (activePanel === 'characters' && project.characters[selectedCharacter]?.id === item.id && item.galleryMotionId)
    stage.setMotionPoseAt(item.galleryPoseTime ?? 0);
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
        .then(() => { if (galleryStage === portrait && item.galleryMotionId) portrait.setMotionPoseAt(item.galleryPoseTime ?? 0); });
    }
  }
}
function progressStatistics() {
  const progress = loadLifetimeProgress();
  const exact = line => Boolean(line.id && progress.viewedDialogueText[line.id] === String(line.text || ''));
  const lines = project.acts.flatMap(item => item.steps.filter(line => String(line.text || '').trim()));
  const seen = lines.filter(exact).length;
  const characters = project.characters.map(character => {
    const own = lines.filter(line => line.characterId === character.id);
    return { id: character.id, name: hasDiscovered('character', character.id) ? character.name : hiddenName(character.name),
      total: own.length, seen: own.filter(exact).length };
  });
  const acts = project.acts.map((item, index) => {
    const own = item.steps.filter(line => String(line.text || '').trim());
    const read = own.filter(exact).length;
    const status = own.length && read === own.length ? 'complete'
      : own.length && read > 0 && progress.lastActId === item.id ? 'current' : 'pending';
    return { index: index + 1, name: item.name, total: own.length, seen: read, status };
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
    <div class="modal-box progress-box"><header><div><small>STORY PROGRESS</small><h2>游玩进度</h2></div>${button('关闭 ×', 'close-modal')}</header>
      <div class="progress-body"><div class="progress-summary">
        <div class="progress-overall"><small>全部台词</small><strong>${percent(stats.seen, stats.total)}</strong><span>已看过 ${stats.seen} / 共 ${stats.total} 句</span></div>
        <h3>各角色台词</h3><div class="progress-character-list">${stats.characters.map(item => `<div class="progress-character-row"><span>${escape(item.name)}</span><b>${percent(item.seen, item.total)}</b><small>${item.seen} / ${item.total} 句</small></div>`).join('') || '<p>还没有角色台词。</p>'}</div>
      </div><div class="progress-acts"><h3>幕的进度</h3><div class="progress-act-list">${stats.acts.map(item =>
        `<div class="progress-act-row ${item.status}"><span class="progress-act-number">${String(item.index).padStart(2, '0')}</span><span class="progress-act-name">${escape(item.name)}</span><small>${item.seen} / ${item.total} 句</small><strong>${item.status === 'complete' ? '✓ 已完成' : item.status === 'current' ? '正在经历' : '未完成'}</strong></div>`).join('')}</div></div></div>
    </div></section>`);
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
  const imported = await bridge('importAsset', { type });
  if (!imported?.length) return;
  for (const item of imported) {
    item.folderId = folderId;
    if (type === 'image') item.galleryImage = galleryImage;
  }
  if (folderId) openAssetFolders.add(folderId);
  if (titleImport) project.title[titleImport] = imported[0].id;
  project.assets.push(...imported); markDirty(); renderSidebar(); renderInspector(); toast(`已导入 ${imported.length} 个素材`);
  if (activePanel === 'title') updatePreview();
}
function renderPlayer() {
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
  const panel = event.target.closest('[data-panel]');
  if (panel && project) {
    activePanel = panel.dataset.panel;
    renderSidebar(); renderInspector(); updatePreview(); return;
  }
  const node = event.target.closest('[data-action]');
  if (!node) {
    if (playing && !transitioning && !saveModalMode && event.target.closest('.stage-frame')
      && !event.target.closest('#choice-list, #play-controls, #player-start, #player-modal')) next();
    return;
  }
  const action = node.dataset.action;
  if (new URLSearchParams(location.search).has('smoke')) window.__lastClickAction = action;
  try {
    if (action === 'new-project') {
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
      project.acts.push({ id: uid(), name: `第${project.acts.length + 1}幕`, backgroundId: '', bgmId: '',
        cast: { left: '', center: '', right: '' }, castSettings: {}, steps: [] });
      selectedAct = project.acts.length - 1; selectedStep = 0; markDirty(); renderSidebar(); renderInspector(); updatePreview();
    } else if (action === 'select-act') {
      selectedAct = Number(node.dataset.index); selectedStep = 0; renderSidebar(); renderInspector(); updatePreview();
    } else if (action === 'delete-act') {
      if (project.acts.length <= 1) { toast('至少保留一幕', true); return; }
      if (!confirm('删除这一幕及其中的对白？')) return;
      project.acts.splice(selectedAct, 1); selectedAct = Math.max(0, selectedAct - 1); selectedStep = 0;
      markDirty(); renderSidebar(); renderInspector(); updatePreview();
    } else if (action === 'add-step') {
      act().steps.push({ id:uid(), characterId:'', speaker:'', text:'', expressionWeights:{}, motionId:'', position:'center', size:defaultSize, offsetX:0, offsetY:0, voiceId:'', choices:[] });
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
      project.characters.push({ id:uid(), name:`角色${project.characters.length + 1}`, modelId:'', portraitId:'', title:'', description:'',
        galleryMotionId: project.assets.some(item => item.id === 'preset-mixamo-029') ? 'preset-mixamo-029' : '',
        galleryYaw: 0, galleryPoseTime: 0,
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
    } else if (action === 'delete-character') {
      if (!confirm('删除这个角色？已有对白会变成旁白。')) return;
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
      if (item?.modelId) await ensureCharacterPortrait(item, true);
    } else if (action === 'cancel-image-import') {
      document.querySelector('#image-import-modal')?.remove();
    } else if (action === 'confirm-image-import') {
      const galleryImage = Boolean(document.querySelector('#image-import-gallery')?.checked);
      document.querySelector('#image-import-modal')?.remove();
      await importAssets('image', node.dataset.folderId || '', node.dataset.titleImport || '', galleryImage);
    } else if (action === 'add-asset-folder') {
      const type = node.dataset.type;
      const name = prompt('新文件夹叫什么名字？', '新文件夹')?.trim();
      if (!name) return;
      if (project.assetFolders.some(folder => folder.type === type && folder.name.toLowerCase() === name.toLowerCase())) {
        toast('这个分类里已有同名文件夹', true); return;
      }
      const folder = { id: uid(), type, name: name.slice(0, 64) };
      project.assetFolders.push(folder);
      openAssetFolders.add(folder.id);
      markDirty(); renderSidebar();
    } else if (action === 'rename-asset-folder') {
      const folder = project.assetFolders.find(item => item.id === node.dataset.folderId);
      if (!folder) return;
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
      const used = JSON.stringify({ ...project, assets: [] }).includes(JSON.stringify(item.id));
      if (!confirm(used ? `“${item.name}”正在工程中使用。删除后，对应的模型、动作或画面会失效。确定删除吗？`
        : `从工程文件夹中删除“${item.name}”？`)) return;
      await bridge('deleteAsset', { path: item.path });
      project.assets = project.assets.filter(entry => entry.id !== item.id);
      markDirty(); renderSidebar(); renderInspector(); updatePreview();
    } else if (action === 'reset-expressions') {
      if (!step()) return;
      step().expressionWeights = {};
      step().expression = '';
      markDirty(); renderExpressionControls(); stage?.setExpressions({});
    } else if (action === 'reset-title-expressions') {
      project.title.expressionWeights = {};
      markDirty(); renderTitleExpressionControls(); stage?.setExpressions({});
    } else if (action === 'add-choice') {
      if (!step()) return;
      step().choices.push({ text:'', actId:'' }); markDirty(); renderInspector();
    } else if (action === 'delete-choice') {
      step().choices.splice(Number(node.dataset.index),1); markDirty(); renderInspector();
    } else if (action === 'play') {
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
  const node = event.target;
  if (node.dataset.motionOptions && project) {
    const scope = node.dataset.motionOptions;
    const holder = scope === 'step' ? step() : scope === 'title' ? project.title
      : scope.startsWith('cast:') ? (act().castSettings[scope.slice(5)] ||= {}) : null;
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
    if (scope === 'title') showTitleScene(false);
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
  if (node.dataset.titleField && project) {
    project.title[node.dataset.titleField] = node.value;
    markDirty();
    if (node.dataset.titleField !== 'authorNote') updatePreview();
    return;
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
  if (node.dataset.assetFolder && project) {
    const item = asset(node.dataset.assetFolder);
    if (!item) return;
    item.folderId = node.value;
    if (node.value) openAssetFolders.add(node.value);
    markDirty(); renderSidebar(); return;
  }
  if (node.dataset.stepCast && step()) {
    const positions = castAssignments(act(), step());
    const moving = positions.find(entry => entry.actorKey === node.dataset.stepCast);
    if (!moving || !castSlots.includes(node.value)) return;
    const previous = moving.position;
    const other = positions.find(entry => entry.position === node.value && entry !== moving);
    const updated = Object.fromEntries(positions.map(entry => [entry.actorKey, entry.position]));
    updated[moving.actorKey] = node.value;
    if (other) updated[other.actorKey] = previous;
    step().castPositions = updated;
    markDirty(); renderInspector(); updatePreview(); return;
  }
  if (node.dataset.castSlot && act()) {
    act().cast ||= { left: '', center: '', right: '' };
    for (const slot of castSlots) if (slot !== node.dataset.castSlot && act().cast[slot] === node.value) act().cast[slot] = '';
    act().cast[node.dataset.castSlot] = node.value;
    markDirty(); renderInspector(); updatePreview(); return;
  }
  if (node.dataset.castMotion && act()) {
    const slot = node.dataset.castMotion;
    act().castSettings ||= {};
    act().castSettings[slot] ||= {};
    act().castSettings[slot].motionId = node.value;
    markDirty(); updatePreview(); refreshMotionHints(); return;
  }
  if (node.dataset.castAdjust && act()) {
    const [slot, key] = node.dataset.castAdjust.split('.');
    act().castSettings ||= {};
    act().castSettings[slot] ||= {};
    act().castSettings[slot][key] = key === 'size' ? Number(node.value) / 100 : Number(node.value);
    const output = document.querySelector(`[data-cast-output="${slot}.${key}"]`);
    if (output) output.textContent = key === 'size' ? `${node.value}%` : key === 'yaw' ? `${node.value}°` : node.value;
    markDirty(); updatePreview(); return;
  }
  if (node.dataset.castExpression && act()) {
    const divider = node.dataset.castExpression.indexOf('.');
    const slot = node.dataset.castExpression.slice(0, divider);
    const name = node.dataset.castExpression.slice(divider + 1);
    act().castSettings ||= {};
    act().castSettings[slot] ||= {};
    act().castSettings[slot].expressionWeights ||= {};
    act().castSettings[slot].expressionWeights[name] = Number(node.value) / 100;
    const output = [...document.querySelectorAll('[data-cast-expression-output]')]
      .find(item => item.dataset.castExpressionOutput === node.dataset.castExpression);
    if (output) output.textContent = `${node.value}%`;
    markDirty();
    updatePreview(); return;
  }
  if (node.dataset.render && project) {
    const key = node.dataset.render;
    project.render[key] = key === 'autoLight' ? node.value === 'true'
      : key === 'shadowEnabled' ? node.checked
      : ['outline', 'shadowAngle'].includes(key) ? Number(node.value)
      : ['lightStrength', 'shadowOpacity', 'paintStrength'].includes(key) ? Number(node.value) / 100 : node.value;
    if (key === 'lightStrength') document.querySelector('#light-strength-value').textContent = `${node.value}%`;
    const output = document.querySelector(`[data-render-output="${key}"]`);
    if (output) output.textContent = key === 'shadowAngle' ? `${node.value}°` : `${node.value}%`;
    markDirty();
    stage?.setRenderSettings(project.render);
    stage?.setBackgroundLighting(asset(act()?.backgroundId));
    return;
  }
  if (node.dataset.galleryAdjust && project) {
    const item = project.characters[selectedCharacter];
    if (!item) return;
    const key = node.dataset.galleryAdjust;
    item[key] = Number(node.value);
    document.querySelector(`[data-gallery-output="${key}"]`).textContent = key === 'galleryYaw'
      ? `${node.value}°` : `${Number(node.value).toFixed(1)} 秒`;
    markDirty(); if (activePanel === 'characters') updatePreview(); return;
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
  if (nested) target[property][nested] = node.value;
  else target[property] = node.value;
  markDirty();
  if (node.tagName === 'SELECT') {
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
    renderSidebar(); renderExpressionControls(); updatePreview();
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
  if (node.dataset.galleryAdjust !== 'galleryPoseTime' && node.dataset.field !== 'character.galleryMotionId') return;
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
window.addEventListener('beforeunload', event => { if (dirty) event.preventDefault(); });
if (new URLSearchParams(location.search).has('smoke'))
  Object.assign(window, { __vrmSmokeAutoSave: () => saveAutoSlot(), __vrmSmokeSaveSlot: index => saveSlot(index) });
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
  speakerPortraitVisible: Boolean(document.querySelector('#speaker-portrait:not(.hidden)')),
  speakerPortraitSrc: document.querySelector('#speaker-portrait img')?.getAttribute('src') || '',
  characterPortraitIds: project?.characters.map(item => ({ id:item.id, modelId:item.modelId,
    portraitId:item.portraitId, portraitSource:item.portraitSource, portraitPoseKey:item.portraitPoseKey,
    galleryMotionId:item.galleryMotionId, galleryPoseTime:item.galleryPoseTime })) || [],
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
  ,castSlots: act()?.cast || {}
  ,castSettings: act()?.castSettings || {}
  ,visibleActors: [...(stage?.visibleRecords?.entries() || [])].map(([id, record]) => ({
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

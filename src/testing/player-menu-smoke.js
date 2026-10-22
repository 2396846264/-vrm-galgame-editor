import * as THREE from 'three';
import {isEvent} from '../events.js';
import {normalizeWeather,weatherDefaults,weatherNames} from '../weather.js';
import {assetUrl} from '../renderer.js';
import {voiceFolderId} from '../dialogue-voices.js';

// Legacy regression scenarios. Mutable test access is supplied explicitly by the host.
export function install(host) {
async function runMouthSmoke(phase) {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const checks = [];
  if (phase === 'mouth-editor') {
    host.activePanel = 'characters'; host.selectedCharacter = 0; host.renderSidebar(); host.renderInspector(); host.editorHistory.reset();
    const field = () => document.querySelector('[data-field="character.autoMouth"]');
    assert(field()?.value === 'on', 'default mouth setting');
    field().value = 'off'; field().dispatchEvent(new Event('input', { bubbles: true }));
    assert(host.project.characters[0].autoMouth === false, 'setting not boolean');
    await host.restoreEditorHistory(-1); assert(host.project.characters[0].autoMouth === true && field().value === 'on', 'mouth setting undo');
    await host.restoreEditorHistory(1); assert(host.project.characters[0].autoMouth === false, 'mouth setting redo');
    await host.restoreEditorHistory(-1);
    await host.save();
    return { ok: true, defaultEnabled: true, disableAndUndoRedo: true, settings: host.project.characters.map(c => ({ id: c.id, autoMouth: c.autoMouth })) };
  }
  assert(host.mode === 'player', 'mouth test requires exported game');
  const before = JSON.stringify(host.project);
  const role = host.project.characters[0], actorId = role.id;
  host.textSpeed = 12; host.playing = true; host.playAct = 0; host.playStep = 0; host.preparedAct = -1; await host.showPlayStep();
  const record = host.stage.visibleRecords.get(actorId);
  assert(record?.talkingMouth?.diagnostics().running && host.typingTimer, 'mouth not active while typing');
  const target = structuredClone(record.expressionTarget), initialOthers = [...host.stage.visibleRecords.entries()].filter(([id]) => id !== actorId).map(([id,r]) => [id, structuredClone(r.expressionTarget)]);
  const samples = [], shapes = new Set(); let visibleMorphChanged = false;
  const morphs = () => { const values = []; record.vrm.scene.traverse(node => { if (node.morphTargetInfluences) values.push(...node.morphTargetInfluences); }); return values; };
  await wait(400); const firstMorphs = morphs();
  for (let n = 0; n < 24; n++) {
    await wait(45);
    const state = record.talkingMouth.diagnostics(); samples.push(state.values);
    state.values.forEach((value, i) => { if (value > .08) shapes.add(state.names[i]); });
    assert(state.values.reduce((a,b) => a+b,0) < .67, 'mouth too wide');
    assert(Math.abs(record.vrm.expressionManager.getValue('happy') - target.happy) < .005, 'emotion overwritten');
    assert(initialOthers.every(([id]) => !host.stage.visibleRecords.get(id).talkingMouth?.diagnostics().running), 'other actor is talking');
    if (morphs().some((value, i) => Math.abs(value - firstMorphs[i]) > .015)) visibleMorphChanged = true;
  }
  assert(shapes.size >= 2 && visibleMorphChanged, 'mouth weights changed without mesh movement');
  assert(JSON.stringify(host.project) === before, 'animation changed authored project');
  checks.push('真实 VRM 模型嘴巴持续变化，只有说话角色动嘴，笑容及工程数据保持原样');
  host.stage.talkingLetter('。'); await wait(120); assert(record.talkingMouth.diagnostics().pause > 0, 'punctuation pause');
  checks.push('标点处短暂停顿');
  host.finishTyping(); assert(!host.stage.talkingRecord && !record.talkingMouth.diagnostics().running, 'instant text completion did not stop');
  for (const name of record.talkingMouth.diagnostics().names) assert(Math.abs(record.vrm.expressionManager.getValue(name) - (target[name] || 0)) < .005, 'authored mouth not restored');
  checks.push('点击显示全文立即停嘴，并恢复作者设定的嘴型');
  host.startTyping('自然结束。', actorId); await wait(700); assert(!host.typingTimer && !host.stage.talkingRecord, 'natural completion did not stop');
  checks.push('文字自然显示完成后停止');
  role.autoMouth = false; host.startTyping('关闭自动嘴型后的长句测试。', actorId); await wait(150); assert(host.typingTimer && !host.stage.talkingRecord, 'disabled role mouth still active');
  host.clearTyping(); role.autoMouth = true;
  checks.push('角色开关关闭后仍显示文字，但不自动动嘴');
  host.playStep = 1; await host.showPlayStep(); const secondId = host.project.acts[0].steps[1].characterId;
  assert(host.stage.talkingRecord === host.stage.visibleRecords.get(secondId) && !record.talkingMouth.diagnostics().running, 'speaker switching');
  host.clearTyping(); checks.push('换说话角色后，上一位停嘴，下一位开始动嘴');
  host.startTyping('背景叙述不应让场上人物说话。', ''); assert(!host.stage.talkingRecord, 'narrator moved actor mouth'); host.clearTyping();
  host.startTyping('继续说话并测试速度调整。', secondId);
  // This exercises the same restart path used by the text-speed slider.
  const shown = document.querySelector('#dialogue-text').textContent; const remaining = host.typingCharacters.slice(host.typingIndex).join('');
  host.textSpeed = 30; host.startTyping(remaining); host.typingCharacters = Array.from(shown + remaining); host.typingIndex = Array.from(shown).length;
  assert(host.stage.talkingRecord === host.stage.visibleRecords.get(secondId), 'speed adjustment lost actor');
  await wait(1100); assert(!host.stage.talkingRecord && !host.typingTimer, 'speed completion did not stop');
  checks.push('旁白不带动人物嘴巴，修改文字速度后嘴型继续跟随');
  host.playStep = 0; await host.showPlayStep(); host.stopPlay(); await wait(450); assert(!host.stage.talkingRecord && !host.typingTimer, 'title transition mouth leak');
  checks.push('返回标题停止嘴型');
  host.playing = true; host.playAct = 0; host.playStep = 0; host.preparedAct = -1; await host.showPlayStep();
  return { ok: true, checks, shapes: [...shapes], visibleMorphChanged, sampleCount: samples.length, mouth: record.talkingMouth.diagnostics() };
}

async function runDialogueVoiceSmoke() {
  const checks = [], assert = (v, m) => { if (!v) throw new Error(m); };
  const input = (selector, value) => { const node = document.querySelector(selector); assert(node, selector); node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); };
  const click = action => { const node = document.querySelector(`[data-action="${action}"]`); assert(node, action); node.click(); };
  const panel = name => document.querySelector(`[data-panel="${name}"]`).click();
  const settle = async () => { for (let i = 0; i < 100 && host.historyBusy; i++) await new Promise(r => setTimeout(r, 40)); assert(!host.historyBusy, 'history timeout'); };
  const undo = async () => { await host.restoreEditorHistory(-1); await settle(); };
  const redo = async () => { await host.restoreEditorHistory(1); await settle(); };
  const confirmBefore = window.confirm; window.confirm = () => true;
  try {
    host.selectedAct = 0; host.selectedStep = 0; host.activePanel = 'story'; host.renderSidebar(); host.renderInspector(); host.editorHistory.reset();
    assert(host.byType('voice').length === 2, 'legacy voice migration');
    assert(host.asset('shared')?.type === 'audio' && !host.asset('legacy'), 'music preservation');
    assert(host.byType('voice').every(v => v.path.startsWith('assets/voice/') && v.folderId === voiceFolderId(v.characterId)), 'physical folder migration');
    checks.push('旧对白配音转入角色文件夹，背景音乐保留');
    assert([...document.querySelectorAll('#asset-dock-tabs button')].map(n => n.dataset.type).join(',') === 'image,vrm,fbxCharacter,motion,audio,voice,video', 'tab order');
    assert(document.querySelector('[data-type="audio"][role="tab"]').textContent.startsWith('音乐与音效'), 'music tab label');
    checks.push('配音位于音乐与音效之后、视频之前');
    panel('characters'); click('add-character'); const newId = host.project.characters.at(-1).id;
    assert(host.project.assetFolders.some(f => f.id === voiceFolderId(newId) && f.locked), 'auto folder');
    input('[data-field="character.name"]', '新角色'); assert(host.project.assetFolders.find(f => f.characterId === newId).name === '新角色', 'folder rename');
    click('delete-character'); assert(host.project.assetFolders.find(f => f.characterId === newId)?.locked, 'folder deleted'); await undo();
    assert(host.project.characters.some(c => c.id === newId), 'character undo'); checks.push('新增角色自动建固定文件夹，角色改名同步，删除角色后文件夹仍保留');
    panel('story'); host.selectedAct = 0; host.selectedStep = 0; host.renderSidebar(); host.renderInspector();
    host.activeAssetType = 'voice'; host.currentAssetFolder.voice = ''; host.renderAssetDock();
    assert(!document.querySelector('#asset-dock-body .asset-file-tile') && !document.querySelector('#asset-dock-body [data-action="add-asset-folder"]'), 'voice root controls');

    const count = host.project.assets.length; await host.importAssets('voice'); await host.importDroppedEntries([]);
    assert(host.project.assets.length === count && document.querySelector('.dialogue-voice-field'), 'library import bypass');
    let rejected = false; try { await host.bridge('importAssets', { type: 'voice' }); } catch { rejected = true; } assert(rejected, 'native library import bypass');
    checks.push('素材库导入和拖入配音被拦截并定位对白');
    const original = host.step().voiceId; await host.uploadDialogueVoice(); const first = host.step().voiceId, firstAsset = host.asset(first);
    assert(first !== original && firstAsset?.name === host.step().text && firstAsset.characterId === host.step().characterId && firstAsset.path.startsWith('assets/voice/'), 'dialogue upload');
    const uploadedPath = firstAsset.path;
    await host.uploadDialogueVoice(); const second = host.step().voiceId;
    assert(second !== first && !host.asset(first), 'replacement pile'); await undo(); assert(host.step().voiceId === first && host.asset(first), 'upload undo'); await redo(); assert(host.step().voiceId === second, 'upload redo');
    checks.push('对白上传后全文命名，重复上传替换，撤销重做恢复旧配音');
    const fullText = '配音全文测试：标点、换行与很长的对白都要保留。\n第二行也完整显示。';
    input('[data-field="step.text"]', fullText); assert(host.asset(second).name === fullText, 'fulltext rename');
    host.editorHistory.seal();
    const opts = [...document.querySelector('[data-field="step.voiceId"]').options].map(o => o.value).filter(Boolean);
    assert(opts.every(id => host.asset(id)?.type === 'voice' && host.asset(id).characterId === host.step().characterId) && !opts.includes('shared'), 'voice filter');
    input('[data-field="step.characterId"]', 'role-b'); assert(!host.step().voiceId, 'cross role binding'); await undo(); assert(host.step().voiceId === second, 'role change undo');
    checks.push('全文随对白更新，只能选择当前角色的配音');
    host.currentAssetFolder.voice = voiceFolderId(host.step().characterId); host.renderAssetDock();
    assert(!document.querySelector('#asset-dock-body [data-action="rename-asset-folder"]') && !document.querySelector('#asset-dock-body [data-asset-folder]'), 'folder protection');
    assert(document.querySelector('.asset-voice-tile .asset-tile-name').textContent === fullText, 'display fulltext');
    await host.previewDialogueVoice(second); assert(!host.editorVoicePreview.paused && host.previewVoiceId === second, 'audio playback');
    checks.push('配音素材库全文显示，固定文件夹不可改名或移动，实际试听成功');
    const reused = host.act().steps[1]; reused.characterId = host.step().characterId; reused.voiceId = second; host.markDirty(); host.editorHistory.seal();
    document.querySelector(`[data-action="delete-asset"][data-asset-id="${second}"]`).click();
    assert(!host.asset(second) && !host.step().voiceId && !host.act().steps[1].voiceId && host.editorVoicePreview.paused, 'voice delete');
    await undo(); assert(host.asset(second) && host.step().voiceId === second && host.act().steps[1].voiceId === second, 'voice delete undo');
    await redo(); assert(!host.asset(second), 'voice delete redo'); await undo();
    checks.push('删除配音解除所有对白绑定，撤销重做正常');
    const snapshot = structuredClone(host.project); snapshot.acts[0].steps[0].characterId = '';
    rejected = false; try { await host.bridge('importDialogueVoice', { project: snapshot, actId: host.act().id, dialogueId: host.step().id }); } catch { rejected = true; } assert(rejected, 'no role upload');
    snapshot.acts[0].steps[0].characterId = host.step().characterId; snapshot.acts[0].steps[0].text = '   ';
    rejected = false; try { await host.bridge('importDialogueVoice', { project: snapshot, actId: host.act().id, dialogueId: host.step().id }); } catch { rejected = true; } assert(rejected, 'blank upload');
    checks.push('没有角色或没有对白文字时拒绝上传');
    await host.save(); host.renderAssetDock();
    return { ok: true, checks, voices: host.byType('voice'), uploadedPath, folders: host.project.assetFolders.filter(f => f.type === 'voice') };
  } finally { window.confirm = confirmBefore; host.stopEditorVoicePreview(); }
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
  const undo = async () => { click('editor-undo'); await wait(() => !host.historyBusy); };
  const redo = async () => { click('editor-redo'); await wait(() => !host.historyBusy); };
  const panel = name => { document.querySelector(`[data-panel="${name}"]`).click(); };
  try {
    // This runner is only available with --smoke and operates on a disposable fixture.
    host.selectedAct = 0; host.selectedStep = 0; host.activePanel = 'story'; host.renderSidebar(); host.renderInspector(); await host.updatePreview(); host.editorHistory.reset();
    const text = host.step().text;
    input('[data-field="step.text"]', '撤销测试'); input('[data-field="step.text"]', '撤销测试第二次');
    assert(host.editorHistory.status().undoCount === 1, 'typing did not merge');
    await undo(); assert(host.step().text === text, 'text undo failed'); await redo(); assert(host.step().text === '撤销测试第二次', 'text redo failed'); results.push('连续打字合并及文字恢复');
    const node = input('[data-field="step.speaker"]', '测试名字');
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })); await wait(() => !host.historyBusy);
    assert(host.step().speaker !== '测试名字', 'Ctrl+Z failed in input');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })); await wait(() => !host.historyBusy);
    assert(host.step().speaker === '测试名字', 'Ctrl+Shift+Z failed'); results.push('输入框快捷键');
    click('duplicate-step'); const copyId = host.step().id; const count = host.act().steps.length;
    click('delete-step'); assert(host.act().steps.length === count - 1, 'step delete failed');
    await undo(); assert(host.step().id === copyId && host.act().steps.length === count, 'deleted step or selection not restored'); await redo(); assert(host.act().steps.length === count - 1, 'step delete redo failed'); results.push('删除对白及选中位置恢复');
    const actId = host.act().id, actJson = JSON.stringify(host.act()); click('delete-act'); assert(!host.project.acts.some(a => a.id === actId), 'act delete failed');
    await undo(); assert(host.act().id === actId && JSON.stringify(host.act()) === actJson, 'whole act not restored'); results.push('整幕及全部对白恢复');
    const order = host.project.acts.map(a => a.id).join(','); host.editorHistory.seal(); host.editorHistory.begin(); host.reorderStory('act', 0, 1, true);
    assert(host.project.acts.map(a => a.id).join(',') !== order, 'reorder failed'); await undo(); assert(host.project.acts.map(a => a.id).join(',') === order, 'order undo failed'); await redo(); results.push('剧情拖动排序');
    panel('render'); const beforeBrightness = host.act().render.brightness; const beforeCount = host.editorHistory.status().undoCount;
    const slider = document.querySelector('[data-render="brightness"]'); slider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    input('[data-render="brightness"]', 120); input('[data-render="brightness"]', 140); input('[data-render="brightness"]', 160);
    slider.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); assert(host.editorHistory.status().undoCount === beforeCount + 1, 'slider did not merge');
    await undo(); assert(host.act().render.brightness === beforeBrightness, 'color undo failed'); await redo(); assert(host.act().render.brightness === 160, 'color redo failed'); results.push('滑块合并与每幕调色');
    panel('story'); const weather = host.act().weather.type; input('[data-weather="type"]', 'rain'); await undo(); assert(host.act().weather.type === weather, 'weather undo failed'); await redo(); assert(host.act().weather.type === 'rain', 'weather redo failed'); results.push('天气恢复');
    panel('characters'); host.selectedCharacter = 0; host.renderSidebar(); host.renderInspector(); const name = host.project.characters[0].name;
    input('[data-field="character.name"]', '新角色名字'); await undo(); assert(host.project.characters[0].name === name, 'character name undo failed'); await redo();
    click('delete-character'); await undo(); assert(host.project.characters[0].name === '新角色名字', 'character delete undo failed'); results.push('人物改名和删除');
    panel('title'); const oldName = host.project.name; input('#project-name', '新游戏名字'); await undo(); assert(host.project.name === oldName, 'game title undo failed'); await redo(); results.push('标题设置');
    panel('knowledge'); const book = host.project.knowledgeBooks[0]; assert(book, 'fixture needs a book'); const bookName = book.name;
    input('[data-book-field="name"]', '新书名'); await undo(); assert(host.project.knowledgeBooks[0].name === bookName, 'book undo failed'); await redo();
    click('book-delete'); await undo(); assert(host.project.knowledgeBooks[0].name === '新书名', 'book delete undo failed'); results.push('知识库编辑与删除');
    panel('story'); click('event-add'); const eventId = host.act().id; input('[data-event-field="title"]', '事件新标题'); await undo(); assert(host.act().event.title !== '事件新标题', 'event undo failed'); await redo();
    click('event-delete'); await undo(); assert(host.act().id === eventId && host.act().event.title === '事件新标题', 'event restore failed'); results.push('世界事件编辑与删除');
    const query = host.project.characters[0].name; await host.library.click('search-open', {}); input('#replace-find', query); await host.library.click('search-find', {}); input('#replace-with', '批量新名字');
    click('search-replace'); assert(host.project.characters[0].name === '批量新名字', 'replace failed'); click('search-undo'); await wait(() => !host.historyBusy); assert(host.project.characters[0].name === query, 'replace undo failed');
    click('search-redo'); await wait(() => !host.historyBusy); assert(host.project.characters[0].name === '批量新名字', 'replace redo failed'); await host.library.click('search-close', {}); results.push('批量替换统一撤销重做');
    // Check actual native PNG bytes, not just the portrait ID in the project.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16; const paint = canvas.getContext('2d');
    paint.fillStyle = '#ff0000'; paint.fillRect(0,0,16,16); const red = canvas.toDataURL();
    const portraitCharacter = host.project.characters[0];
    const first = await host.bridge('saveGeneratedPortrait', { dataUrl: red, characterId: portraitCharacter.id, name: portraitCharacter.name });
    const firstRevision = first.revision;
    await host.replaceAutoPortrait(portraitCharacter, first); portraitCharacter.portraitPoseKey = 'history-test-red'; host.markDirty({ derived: true });
    host.editorHistory.seal(); host.editorHistory.begin(); paint.fillStyle = '#0000ff'; paint.fillRect(0,0,16,16); const blue = canvas.toDataURL();
    const second = await host.bridge('saveGeneratedPortrait', { dataUrl: blue, characterId: portraitCharacter.id, name: portraitCharacter.name, previousRevision: first.revision });
    Object.assign(host.asset(first.id), second); portraitCharacter.portraitPoseKey = 'history-test-blue'; host.markDirty({ label: '重新拍摄头像' });
    const imageBytes = async () => [...new Uint8Array(await (await fetch(assetUrl(host.asset(first.id)), { cache: 'no-store' })).arrayBuffer())].join(',');
    const blueBytes = await imageBytes(); await undo(); const redBytes = await imageBytes(); assert(redBytes !== blueBytes && host.asset(first.id).revision === firstRevision, 'portrait file undo failed');
    await redo(); assert(await imageBytes() === blueBytes && host.asset(first.id).revision === second.revision, 'portrait file redo failed'); results.push('真实头像文件恢复');
    // Test a delete after save, then restore, then redo and save again.
    await host.save(); const removable = host.project.assets.find(a => a.id !== first.id && a.type === 'image'); assert(removable, 'fixture needs an image');
    host.activeAssetType = 'image'; host.currentAssetFolder.image = ''; host.renderAssetDock();
    document.querySelector(`[data-action="delete-asset"][data-asset-id="${removable.id}"]`).click(); assert(!host.asset(removable.id), 'asset delete failed'); await host.save();
    await undo(); assert(host.asset(removable.id), 'deleted asset metadata not restored'); assert((await fetch(assetUrl(host.asset(removable.id)), { cache: 'no-store' })).ok, 'deleted asset file missing after save and undo');
    await redo(); await host.save(); results.push('保存后撤销素材删除');
    await undo(); panel('title'); input('#project-name', '撤销重做验证工程'); assert(!host.editorHistory.status().canRedo, 'new edit did not discard redo branch'); results.push('新修改清空旧重做分支');
    // Final deletion lets the external ZIP/export check prove unused files/cache are excluded.
    host.activeAssetType = 'image'; host.currentAssetFolder.image = ''; host.renderAssetDock(); document.querySelector(`[data-action="delete-asset"][data-asset-id="${removable.id}"]`).click(); await host.save();
    panel('story'); host.selectedAct = 0; host.selectedStep = 0; host.renderSidebar(); host.renderInspector(); await host.updatePreview();
    assert(!document.querySelector('[data-action="editor-undo"]').disabled, 'undo button incorrectly disabled');
    const topbar = document.querySelector('.topbar'); assert(topbar.scrollWidth <= topbar.clientWidth + 2, 'topbar overflows'); results.push('小窗口按钮布局');
    return { ok: true, checks: results, removedPath: removable.path, retainedPortrait: host.asset(first.id).path, history: host.editorHistory.status() };
  } finally { window.confirm = originalConfirm; }
}

async function runPortraitHistorySmoke() {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const wait = async test => { for (let i = 0; i < 800; i++) { if (test()) return; await new Promise(r => setTimeout(r, 40)); } throw new Error('portrait test timed out'); };
  await wait(() => host.portraitJobs.size === 0 && host.project.characters[0].portraitId);
  host.activePanel = 'characters'; host.selectedCharacter = 0; host.renderSidebar(); host.renderInspector(); await host.updatePreview(); host.editorHistory.reset();
  const item = host.project.characters[0], oldRevision = host.asset(item.portraitId).revision;
  document.querySelector('[data-action="capture-character-portrait"]').click();
  await wait(() => host.portraitJobs.size === 0 && host.asset(host.project.characters[0].portraitId).revision !== oldRevision);
  const newRevision = host.asset(host.project.characters[0].portraitId).revision;
  assert(host.editorHistory.status().undoCount === 1, 'manual portrait capture not one undo step');
  await host.restoreEditorHistory(-1); assert(host.asset(host.project.characters[0].portraitId).revision === oldRevision, 'manual portrait undo failed');
  await host.restoreEditorHistory(1); assert(host.asset(host.project.characters[0].portraitId).revision === newRevision, 'manual portrait redo failed');
  const oldFrame = host.project.characters[0].galleryPoseFrame, oldDescription = host.project.characters[0].description;
  const slider = document.querySelector('[data-gallery-adjust="galleryPoseFrame"]'); assert(Number(slider.max) > oldFrame, 'fixture needs an animated motion');
  slider.value = Math.min(Number(slider.max), oldFrame + 20); slider.dispatchEvent(new Event('input', { bubbles: true })); slider.dispatchEvent(new Event('change', { bubbles: true }));
  const description = document.querySelector('[data-field="character.description"]'); description.value = '头像拍摄期间输入的介绍'; description.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(() => host.portraitJobs.size === 0);
  const frameRevision = host.asset(host.project.characters[0].portraitId).revision;
  await host.restoreEditorHistory(-1);
  assert(host.project.characters[0].description === oldDescription && host.asset(host.project.characters[0].portraitId).revision === frameRevision, 'late portrait result was attached to wrong edit');
  await host.restoreEditorHistory(-1);
  assert(host.project.characters[0].galleryPoseFrame === oldFrame && host.asset(host.project.characters[0].portraitId).revision === newRevision, 'frame and portrait not restored together');
  await host.restoreEditorHistory(1); await host.restoreEditorHistory(1); await host.save();
  return { ok: true, manualCaptureUndo: true, manualCaptureRedo: true, asyncFrameUndo: true, separateDescriptionUndo: true,
    portraitCount: host.project.assets.filter(a => a.generatedPortrait && a.characterId === host.project.characters[0].id).length };
}

if (new URLSearchParams(location.search).has('smoke'))
  Object.assign(window, { __vrmSmokeAutoSave: () => host.saveAutoSlot(), __vrmSmokeSaveSlot: index => host.saveSlot(index),
    __vrmSmokeMenuPolish: async phase => {
      if(phase==='agent-env-editor'){
        host.storyAssistant.render();await host.storyAssistant.click('assistant-toggle');if(!host.storyAssistant.isEnabled())throw Error('MCP 未开启');
        await host.storyAssistant.click('assistant-close');return {ok:true,agentEnabled:true};
      }
      if(phase==='agent-env-player'){
        const index=host.project.acts.findIndex(a=>a.environmentId&&host.project.environments.find(e=>e.id===a.environmentId)?.name.startsWith('MCP'));
        if(index<0)throw Error('MCP 场景未导出');host.playing=true;host.playAct=index;host.playStep=0;host.preparedAct=-1;await host.showPlayStep();await new Promise(resolve=>setTimeout(resolve,1500));
        const env=host.project.environments.find(e=>e.id===host.project.acts[index].environmentId);
        if(host.stageError||host.stage.environmentRuntime.objects.size!==env.nodes.length||host.stage.camera.position.distanceTo(new THREE.Vector3(...env.camera.position))>.001)throw Error('MCP 场景没有正确加载');
        return {ok:true,sceneNodes:env.nodes.length,loadedObjects:host.stage.environmentRuntime.objects.size,gameCamera:true,dialogue:host.project.acts[index].steps[0].text};
      }
      if (phase === 'agent-player') {
        const index=host.project.acts.findIndex(a=>a.draftBatchId&&a.kind!=='event');
        if(index<0)throw new Error('generated draft not found in export');
        host.playing=true;host.playAct=index;host.playStep=0;host.preparedAct=-1;await host.showPlayStep();
        await new Promise(r=>setTimeout(r,2500));
        if(host.stageError||!host.stage.weather.active||host.stage.weatherSettings.type!=='rain')throw new Error('generated scene or weather not playable');
        if(host.music.paused)throw new Error('generated BGM did not play');
        return {ok:true,act:host.project.acts[index].name,generatedDialogue:host.project.acts[index].steps[0].text,weather:host.stage.weatherSettings.type,musicPlaying:!host.music.paused,sceneError:host.stageError};
      }
      if (phase === 'agent-editor') {
        const assert=(value,label)=>{if(!value)throw new Error(label);};
        host.storyAssistant.render();
        document.querySelector('#assistant-source-name').value='港口故事';
        document.querySelector('#assistant-source-text').value='# 港口的急报\n绯音：我们必须马上离开！\n澄夏：等一下，我还没有看完信。\n雨越下越大，港口的电台传来消息。';
        await host.storyAssistant.click('assistant-source-paste');
        const before=JSON.stringify(host.project),count=host.project.acts.length;
        await host.storyAssistant.click('assistant-offline');
        assert(document.querySelector('#assistant-preview').textContent.includes('没有使用 AI'),'offline helper is not labelled');
        await host.storyAssistant.click('assistant-apply');
        assert(host.project.acts.length>count,'draft not appended');
        assert(host.project.assetFolders.filter(f=>f.type==='voice').every(f=>f.locked),'voice folders unprotected');
        await host.restoreEditorHistory(-1);assert(JSON.stringify(host.project)===before,'draft undo did not restore source project');
        await host.restoreEditorHistory(1);assert(host.project.acts.length>count,'draft redo failed');
        await host.restoreEditorHistory(-1);
        const context=await host.storyAssistant.call('get_project');
        const stale=await host.storyAssistant.call('propose_draft',{expectedRevision:context.revision,draft:{schemaVersion:1,acts:[{name:'冲突测试',steps:[{speaker:'旁白',text:'不可覆盖'}]}]}});
        host.project.name+=' · 未保存修改';host.markDirty({label:'测试作者同时修改'});
        let blocked=false;try{await host.storyAssistant.call('apply_draft',{proposalId:stale.proposalId,expectedRevision:stale.revision});}catch{blocked=true;}
        assert(blocked&&host.project.acts.length===count,'stale draft overwrote author edits');
        host.storyAssistant.render();await host.storyAssistant.click('assistant-toggle');
        assert(host.storyAssistant.isEnabled(),'native agent bridge not enabled');
        await host.storyAssistant.click('assistant-toggle');assert(!host.storyAssistant.isEnabled(),'agent disconnect failed');
        await host.storyAssistant.click('assistant-toggle');assert(host.storyAssistant.isEnabled(),'agent reconnect failed');
        const restoredConnection=await host.bridge('init');host.storyAssistant.setConnection(restoredConnection.agent);
        assert(host.storyAssistant.isEnabled(),'agent state lost on initialization');
        await host.save();
        return {ok:true,sourceImport:true,draftPreview:true,appendPreserved:true,undoRedo:true,staleWriteRejected:true,lockedVoiceFolders:true,agentEnabled:true};
      }
      if (phase === 'protected-editor') {
        const badge = document.querySelector('.editor-feedback');
        if (!badge || !host.feedbackGroup || badge.querySelector('strong').textContent !== host.feedbackGroup || !badge.textContent.includes('Bug反馈交流群')) throw new Error('feedback badge missing');
        const rect = badge.getBoundingClientRect(), topbar = document.querySelector('.topbar');
        if (rect.right > window.innerWidth || topbar.scrollWidth > topbar.clientWidth + 2) throw new Error('feedback badge toolbar overflow');
        await host.save();
        return { ok: true, feedbackGroup: host.feedbackGroup, badgeRight: rect.right, viewport: window.innerWidth, nativeBranding: true, saved: true };
      }
      if (phase.startsWith('mouth-')) return runMouthSmoke(phase);
      if (phase === 'voices-player') {
        host.playing = true; host.playAct = 0; host.playStep = 0; host.preparedAct = -1; await host.showPlayStep();
        for (let n = 0; n < 100 && (host.voice.paused || !host.voice.duration); n++) await new Promise(r => setTimeout(r, 50));
        if (host.asset(host.project.acts[0].steps[0].voiceId)?.type !== 'voice' || host.voice.paused || !host.voice.duration) throw new Error('exported character voice did not play');
        const result = { ok: true, duration: host.voice.duration, src: host.voice.src, voiceType: host.asset(host.project.acts[0].steps[0].voiceId).type };
        host.voice.pause(); return result;
      }
      if (phase === 'voices-editor') return runDialogueVoiceSmoke();
      if (phase === 'history-editor') return runEditorHistorySmoke();
      if (phase === 'history-portrait') return runPortraitHistorySmoke();
      const assert = (condition, message) => { if (!condition) throw new Error(message); };
      if (phase.startsWith('events-')) {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const waitFor = async predicate => { for (let n = 0; n < 100 && !predicate(); n++) await wait(100); assert(predicate(), 'scene did not finish loading'); };
        const find = (type, burst = false) => host.project.acts.findIndex(a => isEvent(a) && a.event.type === type && Boolean(a.event.burst) === burst);
        const open = async index => { host.closePlayerModal(); document.querySelector('#player-modal')?.remove();
          host.playing = true; host.playAct = index; host.playStep = 0; host.preparedAct = -1; host.restoredEventRemaining = undefined; await host.showPlayStep(); };
        const locked = () => {
          const index = host.playAct;
          host.next(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          document.querySelector('#scene-bg').click(); host.events.confirm();
          assert(host.playAct === index, 'forced reading bypassed');
          assert(document.querySelector('[data-action="event-confirm"]').disabled, 'continue button not disabled');
        };
        const scene = () => {
          assert(getComputedStyle(document.querySelector('#stage-canvas')).visibility === 'hidden', 'actor canvas still visible');
          assert(getComputedStyle(document.querySelector('#dialogue')).visibility === 'hidden', 'dialogue still visible');
          assert(getComputedStyle(document.querySelector('#scene-bg')).filter.includes('blur('), 'background not blurred');
          assert(!host.stage.weather?.active && !host.stage.weather?.audible, 'weather leaked into event');
        };
        if (phase === 'events-editor') {
          host.playing = false; host.mode = 'editor'; host.activePanel = 'story'; host.selectedAct = find('news'); host.renderEditor(); await wait(900);
          assert(document.querySelector('[data-event-field="type"]'), 'event inspector missing');
          const initial = host.project.acts.length;
          await host.handleEventAction('event-add', {}); const addedId = host.act().id;
          assert(isEvent(host.act()) && host.project.acts.length === initial + 1, 'event insertion failed');
          await host.handleEventAction('event-duplicate', {});
          assert(host.act().id !== addedId && host.project.acts.length === initial + 2, 'duplicate reused IDs');
          host.project.acts.splice(host.selectedAct - 1, 2); host.selectedAct = find('news'); host.renderSidebar(); host.renderInspector(); await host.updatePreview();
          assert(host.project.acts.length === initial, 'test cleanup failed');
          const newsId = host.act().id; host.reorderStory('act', host.selectedAct, 0, false);
          assert(host.project.acts[0].id === newsId && host.act().id === newsId, 'reorder lost selection');
          host.reorderStory('act', 0, 1, true); assert(host.project.acts[1].id === newsId, 'reorder back failed');
          const data = JSON.parse(JSON.stringify(host.project));
          assert(data.acts.filter(isEvent).length === 4 && data.acts.find(a => a.event?.burst).event.declarations.length === 29, 'event data lost');
          assert(!host.library.input(document.createElement('input')), 'unexpected library input');
          host.markDirty(); await host.save();
          return { ok: true, insertion: true, duplicateIds: true, serialization: true, events: 4 };
        }
        if (phase === 'events-news') {
          host.playing = false; host.mode = 'player'; host.renderPlayer(); await wait(500);
          const index = find('news'); await open(index); scene(); locked();
          const started = performance.now();
          await wait(300); assert(!host.music.paused && host.music.src.includes('atmosphere.wav'), 'event music did not play');
          const master = host.audioSettings.master; host.audioSettings.master = 0; host.applyAudioSettings(); assert(host.music.volume === 0, 'event music mute failed'); host.audioSettings.master = master; host.applyAudioSettings();
          host.renderSettingsModal(); const before = host.events.remaining(); await wait(1100);
          assert(Math.abs(host.events.remaining() - before) < .12, 'timer kept running in settings');
          assert(parseInt(getComputedStyle(document.querySelector('#player-modal')).zIndex) > parseInt(getComputedStyle(document.querySelector('#world-event')).zIndex), 'settings hidden behind event');
          host.closePlayerModal(); await wait(250); locked();
          host.autoPlay = true; host.scheduleAutoAdvance(host.project.acts[host.playAct].steps[0]); assert(!host.autoTimer, 'autoplay scheduled event skip'); host.autoPlay = false;
          await wait(3400); assert(host.events.remaining() === 0 && !document.querySelector('[data-action="event-confirm"]').disabled, 'news did not unlock');
          const result = { ok: true, requiredSeconds: 3, remaining: host.events.remaining(), pausedInSettings: true, resistedKeyboardAndAutoplay: true, elapsedMs: performance.now() - started };
          // Leave the newspaper onscreen for the native screenshot.
          return result;
        }
        if (phase === 'events-war') {
          const index = find('war');
          host.closePlayerModal(); host.playing = true; host.playAct = index; host.playStep = 0; host.preparedAct = -1;
          const pendingDisplay = host.showPlayStep();
          assert(host.events.remaining() === 0 && host.events.diagnostics().ready, 'war got a countdown');
          assert(host.events.confirm(), 'war could not close immediately during entrance');
          assert(host.playAct === index + 1, 'war did not advance'); await pendingDisplay; await wait(800);
          await open(index); scene();
          assert(!document.querySelector('.event-watch'), 'war has eye countdown');
          assert(document.querySelectorAll('.crt-flags img').length === 2, 'flags missing');
          return { ok: true, immediateClose: true, countdown: false, flags: 2 };
        }
        if (phase === 'events-burst') {
          const index = find('war', true); await open(index); await wait(7400);
          const d = host.events.diagnostics(); assert(d.received === 30, 'burst messages incomplete');
          assert(d.windows <= 8, 'burst windows unbounded');
          assert(document.querySelector('.war-message-count').textContent.includes('30 / 30'), 'message count wrong');
          return { ok: true, received: d.received, liveWindows: d.windows, closeAllEnabled: !document.querySelector('[data-action="event-confirm"]').disabled };
        }
        if (phase === 'events-major') {
          await open(find('major')); scene(); locked();
          const started = performance.now(); await wait(4300); locked();
          assert(host.events.remaining() > 4, 'major gate too short');
          await wait(6100); assert(host.events.remaining() === 0 && !document.querySelector('[data-action="event-confirm"]').disabled, 'major did not unlock after 10 seconds');
          assert(document.querySelector('.broadcast-copy blockquote'), 'major quote missing');
          return { ok: true, requiredSeconds: 10, elapsedMs: performance.now() - started, resistedEarlyClose: true };
        }
        if (phase === 'events-save') {
          await open(find('news')); await wait(950); host.renderSaveModal('save');
          const before = host.events.remaining(), slot = host.snapshotSlot();
          assert(before > 0 && slot.eventRemaining > 0 && slot.actId === host.project.acts[host.playAct].id, 'event snapshot missing');
          const slots = host.readSaveSlots(); slots[17] = slot; localStorage.setItem(host.saveKey(), JSON.stringify(slots));
          host.stopPlay(); host.loadSlot(17); await wait(850);
          assert(host.events.active() && host.events.remaining() <= before + .05 && host.events.remaining() > before - .7, 'saved countdown not restored');
          locked(); await wait(2600); const eventId = host.project.acts[host.playAct].id; host.events.confirm(); await waitFor(() => !host.transitioning && !host.events.active());
          assert(host.loadLifetimeProgress().completedEventIds.includes(eventId), 'event completion not stored');
          assert(!host.loadLifetimeProgress().viewedDialogueIds.includes(slot.stepId), 'event counted as dialogue');
          assert(!host.events.active() && !document.querySelector('.stage-frame').classList.contains('event-mode'), 'event overlay leaked into dialogue');
          return { ok: true, savedRemaining: before, loadedRemainingPreserved: true, completedEventId: eventId, normalDialogueRestored: true };
        }
        if (phase === 'events-flow') {
          const old = [...host.project.acts];
          try {
            const first = structuredClone(old[find('war')]), last = structuredClone(first); first.id = host.uid(); last.id = host.uid(); last.steps[0].id = host.uid();
            host.project.acts = [first, old[0], last]; host.playing = false; await host.showTitleScene(true);
            host.startPlay(); assert(isEvent(host.project.acts[host.playAct]) && host.events.active(), 'first event failed');
            host.events.confirm(); await waitFor(() => !host.transitioning && host.playAct === 1 && !host.events.active()); assert(host.stage.weather?.active && host.stage.visibleRecords.size > 0, 'actors/weather not restored after event');
            host.finishTyping(); host.next(); await wait(800); assert(host.playAct === 2 && host.events.active(), 'last event failed');
            host.events.confirm(); await wait(900); assert(!host.playing && !host.events.active() && document.querySelector('.stage-frame').classList.contains('title-mode'), 'last event did not finish story');
          } finally { host.project.acts = old; }
          const stats = host.progressStatistics(); assert(stats.acts.length === 4 && stats.total === 4, 'events polluted chapter dialogue counts');
          host.renderProgressModal(); assert(document.querySelectorAll('.chapter-card').length === 4, 'events shown as chapters');
          host.closePlayerModal(); await wait(250); await open(find('news'));
          return { ok: true, firstAndLastEvent: true, weatherRestored: true, chapterCards: stats.acts.length, dialogueTotal: stats.total };
        }
        if (phase === 'events-media') {
          const index = find('major'); const e = host.project.acts[index].event;
          const old = { ...e }, oldAssets = [...host.project.assets];
          host.project.assets.push({ id: 'event-video-test', name: 'test-video.webm', type: 'video', path: 'assets/events/test-video.webm' });
          try {
            const response = await fetch(assetUrl(host.asset('event-video-test'))), data = await response.arrayBuffer();
            assert(response.ok && data.byteLength > 100, `test video resource failed: ${response.status}, ${data.byteLength}`);
            const expected = await (await fetch(window.__eventVideo)).arrayBuffer();
            const prefix = Array.from(new Uint8Array(data).slice(0,12));
            assert(data.byteLength === expected.byteLength && prefix.join() === Array.from(new Uint8Array(expected).slice(0,12)).join(), `video bytes changed: ${data.byteLength}/${expected.byteLength}, ${prefix}`);
            e.videoId = 'event-video-test'; e.seId = e.bgmId; e.voiceId = e.bgmId;
            host.playing = false; host.mode = 'player'; host.renderPlayer(); await wait(400); await open(index); await wait(250);
            const video = document.querySelector('#world-event video');
            assert(video?.readyState >= 2 && !video.paused && video.muted, `event video did not play (${data.byteLength} bytes; ${prefix}): ${document.querySelector('#world-event')?.dataset.mediaError || JSON.stringify({ready:video?.readyState,paused:video?.paused,ended:video?.ended,time:video?.currentTime,duration:video?.duration})}`);
            assert(host.eventEffects.size === 1 && !host.voice.paused, 'event effect/narration did not play');
            host.renderSettingsModal(); await wait(250); assert(video.paused, 'video did not pause in settings');
            host.closePlayerModal(); await wait(250); assert(!video.paused, 'video did not resume');
            host.stopPlay(); assert(video.paused && host.voice.paused && host.eventEffects.size === 0, 'event media kept playing after exit');
            return { ok: true, videoPlayed: true, pausedAndResumed: true, narrationAndEffects: true, stoppedOnExit: true };
          } finally { host.project.acts[index].event = old; host.project.assets = oldAssets; }
        }
      }
      if (phase.startsWith('weather-')) {
        const type = phase.slice(8);
        const wait = () => new Promise(resolve => setTimeout(resolve, 1000));
        if (type === 'depth') {
          host.closePlayerModal(); host.playing=false; host.activePanel='story'; await host.stage.showCast([], '', false);
          host.stage.setRenderSettings({...host.act().render,outline:0,paintEffect:'none',shadowEnabled:false});
          host.stage.setWeather({...weatherDefaults,type:'rain',intensity:1}); await wait();
          host.stage.renderer.render(host.stage.scene,host.stage.camera);
          const gl=host.stage.renderer.getContext(), size={x:host.stage.renderer.domElement.width,y:host.stage.renderer.domElement.height};
          const pixels=new Uint8Array(size.x*size.y*4);
          gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
          let visible=0;for(let i=3;i<pixels.length;i+=4) if(pixels[i]>8)visible++;
          assert(visible>1000,'rain shader produced no visible particles');
          assert(gl.getError()===gl.NO_ERROR,'weather GPU error');
          await host.showTitleScene(true);
          return {ok:true,rainPixels:visible,gpuDepthTest:true};
        }
        if (type === 'editor') {
          host.stopPlay(); host.mode='editor'; host.selectedAct=0; host.selectedStep=0; host.activePanel='story'; host.renderEditor();
          assert(host.project.acts.every(a => normalizeWeather(a.weather).type==='none'), 'legacy weather not disabled');
          const picker=document.querySelector('[data-weather="type"]');
          picker.value='rain'; picker.dispatchEvent(new Event('input',{bubbles:true})); await wait();
          const strength=document.querySelector('[data-weather="intensity"]');
          strength.value=75; strength.dispatchEvent(new Event('input',{bubbles:true}));
          assert(host.act().weather.type==='rain' && host.act().weather.intensity===.75,'weather editor failed');
          assert(host.stage.weather.particles.geometry.instanceCount>0 && host.stage.element.style.visibility==='visible','weather preview missing');
          assert(!host.stage.weather.audible,'editor weather sound should be silent');
          const firstId=host.act().id;
          host.selectedAct=1; host.renderSidebar();host.renderInspector();await host.updatePreview();
          assert(host.stage.weatherSettings.type==='none' && !host.stage.weather.active,'weather leaked into next act');
          host.selectedAct=0;host.renderSidebar();host.renderInspector();await host.updatePreview();
          assert(host.act().id===firstId && host.stage.weatherSettings.type==='rain','weather lost after act switch');
          await host.save(); document.querySelector('.weather-editor')?.scrollIntoView({block:'start'}); await wait();
          return {ok:true,independentActs:true,savedWeather:host.act().weather};
        }
        if (type==='lifecycle') {
          const windOriginals=[...host.stage.weather.windJoints].map(([joint,original])=>({joint,power:original.power,dir:original.dir.clone()}));
          await host.showTitleScene(false);
          assert(!host.stage.weather.active && !host.stage.weather.audible,'weather leaked into title');
          assert(windOriginals.every(({joint,power,dir})=>joint.settings.gravityPower===power && joint.settings.gravityDir.equals(dir)),'weather wind changed original model settings');
          host.activePanel='characters'; await host.showCharacterEditorPreview();
          assert(!host.stage.weather.active,'weather leaked into gallery');
          host.activePanel='story'; host.hideCharacterEditorPreview();
          await host.updatePreview();
          host.setSceneWeather({...host.act(),weather:{...host.act().weather,type:'none'}});
          await host.stage.showCast([], '',false);
          host.setSceneWeather({...host.act(),weather:{...host.act().weather,type:'snow'}});
          assert(host.stage.weather.active && host.stage.element.style.visibility==='visible','empty cast hid snow');
          host.stage.setRenderSettings({...host.act().render,paintEffect:'oil',paintStrength:.65});
          host.showBackground(host.asset(host.act().backgroundId));await wait();
          assert(host.stage.paintEnabled && host.stage.weather.active,'oil mode lost weather');
          host.stage.setRenderSettings(host.act().render);
          await host.updatePreview();
          const scene=host.project.acts[0]; scene.weather=normalizeWeather({...scene.weather,type:'rain'});
          host.playing=true; host.playAct=0;host.playStep=0;host.preparedAct=-1;await host.showPlayStep();await wait();
          assert(host.stage.weather.audible,'player ambient sound missing');
          const master=host.audioSettings.master;
          host.audioSettings.master=0; host.applyAudioSettings();assert(host.stage.weather.audio.volume===0 && host.stage.weather.audioLevel===0,'mute failed');
          host.audioSettings.master=master;host.applyAudioSettings();host.stopPlay();
          assert(!host.stage.weather.audible,'weather sound leaked after stop');
          return {ok:true,titleAndGalleryClear:true,emptyCast:true,oilCompatible:true,playerAudioAndMute:true};
        }
        assert(Object.hasOwn(weatherNames,type),'unknown weather');
        host.mode='player';host.renderPlayer();await wait();
        host.project.acts[0].weather=normalizeWeather({...host.project.acts[0].weather,type,intensity:.7,wind:.6,ground:.82});
        host.playing=true;host.playAct=0;host.playStep=0;host.preparedAct=-1;await host.showPlayStep();await wait();
        assert(host.stage.weatherSettings.type===type && host.stage.weather.active,'player weather missing');
        const text=document.querySelector('#dialogue-text');
        assert(parseInt(getComputedStyle(document.querySelector('#dialogue')).zIndex)>0,'weather covers dialogue');
        return {ok:true,type,particles:host.stage.weather.particles.geometry.instanceCount,depthTest:host.stage.weather.particles.material.depthTest,
          audio:host.stage.weather.audible,canvasVisible:host.stage.element.style.visibility==='visible',subtitle:text.textContent};
      }
      if (phase === 'library-search') {
        host.closePlayerModal(); host.mode = 'editor'; host.renderEditor();
        const old = host.project.characters[0].name;
        document.querySelector('#text-search').value = old;
        await host.library.click('search-open', {});
        assert(document.querySelectorAll('.search-results article').length > 0, 'search found no role name');
        document.querySelector('#replace-with').value = '批量改名验证';
        await host.library.click('search-replace', {});
        assert(host.project.characters[0].name === '批量改名验证', 'replacement failed');
        await host.library.click('search-undo', {});
        assert(host.project.characters[0].name === old, 'undo failed');
        return { ok: true, replaceAndUndo: true };
      }
      if (phase === 'library-editor') {
        await host.library.click('search-close', {}); host.activePanel = 'knowledge'; host.renderSidebar(); host.renderInspector();
        assert(document.querySelector('[data-book-field="unlockActId"]'), 'book editor missing');
        return { ok: true, bookCount: host.project.knowledgeBooks.length };
      }
      if (phase === 'library-shelf') {
        host.mode = 'player'; host.renderPlayer(); await new Promise(resolve => setTimeout(resolve,1000));
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
        await host.library.click('book-read', { dataset: { index: '0' } });
        assert(!document.querySelector('#book-reader'), 'locked PDF was opened');
        await new Promise(resolve => setTimeout(resolve,1200));
        return { ok: true, lockedBookBlocked: true, titleButtonHit: true, iconWidth: icon.width };
      }
      if (phase === 'library-reader') {
        host.lifetimeProgress.viewedDialogueIds = host.project.acts[0].steps.map(line => line.id);
        await host.library.openBook(0);
        assert(document.querySelectorAll('.book-paper canvas').length === 2, 'PDF spread missing');
        return { ok: true, pages: document.querySelector('#book-page-state').textContent };
      }
      if (phase === 'library-turn') {
        await host.library.click('book-next', {});
        assert(document.querySelector('#book-page-state').textContent.startsWith('3'), 'next spread failed');
        await host.library.click('book-next', {});
        assert(document.querySelector('#book-page-state').textContent.startsWith('5') && document.querySelectorAll('.book-paper canvas').length === 1, 'odd last page failed');
        assert(document.querySelector('[data-action="book-next"]').disabled, 'last page next button enabled');
        await host.library.click('book-prev', {});
        await host.library.click('book-prev', {});
        assert(document.querySelector('#book-page-state').textContent.startsWith('1'), 'previous spread failed');
        return { ok: true, forwardAndBackward: true, oddLastPage: true };
      }
      if (phase === 'audio') {
        assert(host.mode === 'player' && !host.playing, 'test must start on untouched title screen');
        const titleButton = getComputedStyle(document.querySelector('#player-start [data-action="play"]'));
        assert(titleButton.color === 'rgb(0, 0, 0)' && titleButton.backdropFilter.includes('blur(0px)'), 'title button must start clear with black text');
        for (let i = 0; i < 50 && (host.music.paused || host.music.currentTime <= 0); i++) await new Promise(resolve => setTimeout(resolve,100));
        assert(!host.music.paused && host.music.currentTime > 0 && host.music.src === assetUrl(host.asset(host.project.title.bgmId)), 'title music did not autoplay');
        return { ok: true, titleMusicPlaying: true, time: host.music.currentTime };
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
        host.closePlayerModal();
        await new Promise(resolve => setTimeout(resolve,200));
        if (phase === 'chapters') host.renderProgressModal();
        else if (phase === 'saves') host.renderSaveModal('load');
        else if (phase === 'music' || phase === 'characters') {
          host.galleryTab = phase; host.renderGalleryModal();
        } else {
          host.playing = true; host.playAct = 0; host.playStep = 0; host.preparedAct = -1;
          await host.showPlayStep(); host.finishTyping();
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
      host.closePlayerModal();
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
        assert(host.project.acts.length >= 2, 'fixture needs two chapters');
        assert(host.project.acts[0].render !== host.project.acts[1].render, 'chapter settings share an object');
        host.selectedAct = 0; host.activePanel = 'story'; host.renderSidebar(); host.renderInspector(); await host.updatePreview();
        assert(document.querySelectorAll('.act-dialogues').length === 1, 'accordion did not fold');
        if (testCover) {
          const otherCover = host.project.acts[1].coverImageId;
          await host.uploadActCover();
          assert(host.asset(host.act().coverImageId)?.type === 'image' && host.project.acts[1].coverImageId === otherCover, 'cover upload failed or affected another chapter');
        }
        const original = host.project.acts[1].render.brightness;
        host.activePanel = 'render'; host.renderSidebar(); host.renderInspector();
        const slider = document.querySelector('[data-render="brightness"]');
        slider.value = 135; slider.dispatchEvent(new Event('input', { bubbles: true }));
        assert(host.project.acts[0].render.brightness === 135 && host.project.acts[1].render.brightness === original, 'color leaked to another chapter');
        const warmth = document.querySelector('[data-render="temperature"]');
        warmth.value = 35; warmth.dispatchEvent(new Event('input', { bubbles: true }));
        assert(document.querySelector('#stage-canvas').style.filter.includes('scene-temperature'), 'model color filter not applied');
        assert(document.querySelector('#scene-bg').style.filter === document.querySelector('#stage-canvas').style.filter, 'model and background color differ');
        warmth.value = 0; warmth.dispatchEvent(new Event('input', { bubbles: true }));
        host.selectedAct = 1; host.renderSidebar(); host.renderInspector(); await host.updatePreview();
        assert(document.querySelector('#scene-bg').style.filter.includes(`brightness(${original}%)`), 'chapter switch kept previous color');
        host.selectedAct = 0; host.activePanel = 'story'; host.renderSidebar(); host.renderInspector(); await host.updatePreview();
        const restored = JSON.parse(JSON.stringify(host.project));
        assert(restored.acts[0].render.brightness === 135 && restored.acts[0].coverImageId === host.project.acts[0].coverImageId, 'chapter fields lost on serialization');
        await host.save();
        return { ok: true, accordion: document.querySelectorAll('.act-dialogues').length, independentColors: restored.acts.map(a => a.render.brightness) };
      }
      if (phase === 'render') {
        host.activePanel = 'render'; host.renderSidebar(); host.renderInspector(); await host.updatePreview();
        return { ok: true, autoLight: host.act().render.autoLight };
      }
      if (phase === 'portraits') {
        host.mode = 'editor'; host.selectedCharacter = 0; host.activePanel = 'characters'; host.renderEditor();
        await Promise.all([...host.portraitJobs.values()]);
        const item = host.project.characters.find(character => character.modelId);
        assert(item, 'fixture needs a model');
        await host.ensureCharacterPortrait(item, true);
        const id = item.portraitId, path = host.asset(id)?.path, revision = host.asset(id)?.revision;
        item.galleryPoseFrame = Math.max(1, (Number(item.galleryPoseFrame) || 1) + 1);
        await host.ensureCharacterPortrait(item, true);
        await host.ensureCharacterPortrait(item, true);
        assert(item.portraitId === id && host.asset(id)?.path === path, 'reshoot changed portrait identity');
        assert(host.asset(id)?.revision !== revision, 'reshoot kept cached image');
        assert(host.project.assets.filter(asset => asset.generatedPortrait && asset.characterId === item.id).length === 1, 'reshoot duplicated portrait');
        assert(!host.project.assets.some(asset => asset.name === '自动头像.png' && !host.assetIsReferenced(asset.id)), 'unused legacy portraits remain');
        await host.save(); host.renderSidebar(); host.renderInspector(); await host.updatePreview();
        return { ok: true, id, path, count: host.project.assets.filter(asset => asset.generatedPortrait && asset.characterId === item.id).length };
      }
      if (phase === 'player') {
        host.mode = 'player'; host.lifetimeProgress = null;
        localStorage.removeItem(host.lifetimeKey()); host.renderPlayer();
        host.playing = true; host.playAct = 0; host.playStep = 0; await host.showPlayStep();
        host.renderProgressModal();
        assert(document.querySelectorAll('.chapter-card').length === host.project.acts.length, 'chapter cards missing');
        assert(document.querySelector('#chapter-card-1').disabled, 'unvisited chapter unlocked');
        host.playAct = 1; host.playStep = 0; host.closePlayerModal(); await host.showPlayStep(); host.renderProgressModal();
        assert(!document.querySelector('#chapter-card-1').disabled, 'visited chapter stayed locked');
        return { ok: true, cards: host.project.acts.length, progress: host.progressStatistics() };
      }
      const before = host.progressStatistics().seen;
      document.querySelector('#chapter-card-0').click();
      for (let i = 0; i < 100 && host.transitioning; i++) await new Promise(resolve => setTimeout(resolve, 50));
      assert(host.playAct === 0 && host.playStep === 0 && host.playing && !host.saveModalMode, 'chapter replay failed');
      assert(host.progressStatistics().seen === before, 'replay erased lifetime progress');
      assert(document.querySelector('#scene-bg').style.filter.includes('brightness(135%)'), 'replay used wrong chapter color');
      host.clearTyping(); host.clearAutoAdvance();
      return { ok: true, replayAct: host.playAct, replayStep: host.playStep, lifetimeSeen: before };
    }
  });
}

import {normalizeSceneAnimations} from './scene-animations.js';
import './scene-animation-dialog.css';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createSceneAnimationDialog({save, preview, stop}) {
  let state = null;
  const close = (restore = true) => {
    if (!state) return;
    const old = state; state = null;
    document.querySelector('#scene-animation-dialog')?.remove();
    stop(restore); old.focus?.focus();
  };
  function open({catalog, assets, cues, owner}) {
    close(false);
    if (!catalog.length) return;
    const existing = normalizeSceneAnimations(cues, catalog, assets);
    state = {catalog, assets, owner, focus: document.activeElement, draft: catalog.map(model => existing.find(cue => cue.nodeId === model.nodeId) || {
      nodeId: model.nodeId, assetId: model.assetId, clipIndex: model.clips[0].index, clipName: model.clips[0].name, enabled: false, delaySeconds: 0, soundId: ''})};
    const overlay = document.createElement('div'); overlay.id = 'scene-animation-dialog';
    overlay.innerHTML = `<section class="scene-animation-window" role="dialog" aria-modal="true" aria-labelledby="scene-animation-title">
      <header><h2 id="scene-animation-title">这一句的场景动画</h2><button data-scene-close aria-label="关闭">×</button></header>
      <p>只列出本幕场景里带动画的 GLB。勾选后，这句对白出现时播放一次；声音会和动画一起开始。</p>
      <div class="scene-animation-list">${catalog.map((model, i) => {
        const cue = state.draft[i];
        return `<article data-scene-row="${i}"><h3>${escape(model.name)}</h3>
          <label class="scene-animation-enabled"><input type="checkbox" data-scene-field="enabled" ${cue.enabled ? 'checked' : ''}>这一句播放动画</label>
          <div class="scene-animation-fields"><label>选择动画<select data-scene-field="clipIndex">${model.clips.map(clip => `<option value="${clip.index}" ${clip.index === cue.clipIndex ? 'selected' : ''}>${escape(clip.name || `动作 ${clip.index + 1}`)}（${clip.duration.toFixed(1)} 秒）</option>`).join('')}</select></label>
          <label>延迟几秒再播放<input type="number" data-scene-field="delaySeconds" min="0" max="600" step="0.1" value="${cue.delaySeconds}"><small>0 表示立即播放，例如 1 或 2 秒。</small></label>
          <label>播放时的声音<select data-scene-field="soundId"><option value="">无声音</option>${assets.filter(a => a.type === 'audio').map(a => `<option value="${escape(a.id)}" ${a.id === cue.soundId ? 'selected' : ''}>${escape(a.name)}</option>`).join('')}</select><small>先把声音导入“音乐与音效”素材库。</small></label></div></article>`;
      }).join('')}</div>
      <p class="scene-animation-note">切到下一句时，会停止本句动画和声音，并取消还没开始的延迟播放。</p>
      <footer><button data-scene-preview>▶ 试播本句</button><span role="status" class="scene-animation-status"></span><button data-scene-close>取消</button><button data-scene-save>保存</button></footer></section>`;
    document.body.append(overlay);
    const fields = () => overlay.querySelectorAll('[data-scene-field]');
    const refresh = () => overlay.querySelectorAll('[data-scene-row]').forEach(row => {
      const enabled = state.draft[Number(row.dataset.sceneRow)].enabled;
      row.querySelectorAll('.scene-animation-fields input,.scene-animation-fields select').forEach(input => input.disabled = !enabled);
    });
    refresh();
    fields().forEach(input => input.addEventListener('input', () => {
      const i = Number(input.closest('[data-scene-row]').dataset.sceneRow), cue = state.draft[i], key = input.dataset.sceneField;
      if (key === 'enabled') cue.enabled = input.checked;
      else if (key === 'clipIndex') { cue.clipIndex = Number(input.value); cue.clipName = catalog[i].clips.find(c => c.index === cue.clipIndex).name; }
      else if (key === 'delaySeconds') { if (input.value === '' || !Number.isFinite(input.valueAsNumber)) return; cue.delaySeconds = Math.max(0, Math.min(600, input.valueAsNumber)); }
      else cue.soundId = input.value;
      refresh();
    }));
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-scene-close]')) close();
      else if (event.target.closest('[data-scene-preview]')) { preview(structuredClone(state.draft), state.owner); overlay.querySelector('.scene-animation-status').textContent = '正在试播'; }
      else if (event.target.closest('[data-scene-save]')) {
        if ([...fields()].some(input => !input.disabled && !input.checkValidity())) { [...fields()].find(input => !input.disabled && !input.checkValidity())?.reportValidity(); return; }
        const old = state;
        close(false); save(normalizeSceneAnimations(old.draft, old.catalog, old.assets), old.owner);
      }
    });
    overlay.querySelector('[data-scene-field]')?.focus();
  }
  document.addEventListener('keydown', event => {
    if (!state) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
    if (event.ctrlKey || event.metaKey) event.stopImmediatePropagation();
    if (event.key !== 'Tab') return;
    const inputs = [...document.querySelectorAll('#scene-animation-dialog button,#scene-animation-dialog input:not(:disabled),#scene-animation-dialog select:not(:disabled)')];
    const first = inputs[0], last = inputs.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }, true);
  return {open, close, active: () => Boolean(state)};
}

import * as THREE from 'three';

// References belong to scene instances, so two copies of a GLB can act independently.
export function normalizeSceneAnimations(cues, catalog, assets) {
  const result = [], seen = new Set();
  for (const cue of Array.isArray(cues) ? cues : []) {
    if (!cue || seen.has(cue.nodeId)) continue;
    const model = catalog.find(item => item.nodeId === cue.nodeId && item.assetId === cue.assetId);
    const clip = model?.clips.find(item => item.index === cue.clipIndex && item.name === cue.clipName);
    if (!clip) continue;
    seen.add(cue.nodeId);
    result.push({ nodeId: model.nodeId, assetId: model.assetId, clipIndex: clip.index, clipName: clip.name,
      enabled: cue.enabled === true, delaySeconds: Math.max(0, Math.min(600, Number(cue.delaySeconds) || 0)),
      soundId: assets.some(item => item.id === cue.soundId && item.type === 'audio') ? cue.soundId : '' });
  }
  return result;
}

export class SceneAnimationPlayer {
  constructor(models = new Map()) { this.models = models; this.pending = []; this.active = []; this.sounds = []; this.key = null; this.paused = false; }
  catalog() {
    return [...this.models.values()].filter(model => model.clips.some(clip => clip.tracks.length && clip.duration > 0)).map(model => ({
      nodeId: model.nodeId, assetId: model.assetId, name: model.name,
      clips: model.clips.flatMap((clip, index) => clip.tracks.length && clip.duration > 0 ? [{index, name: clip.name, duration: clip.duration}] : [])
    }));
  }
  play(cues, assets, {key = null, sound = null, force = false} = {}) {
    if (!force && key !== null && key === this.key) return;
    this.stop(); this.key = key;
    this.pending = normalizeSceneAnimations(cues, this.catalog(), assets).filter(cue => cue.enabled).map(cue => ({...cue, elapsed: 0, sound}));
    this.update(0);
  }
  update(delta, paused = false) {
    delta = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    if (paused !== this.paused) {
      this.paused = paused;
      for (const sound of this.sounds) paused ? sound.pause?.() : sound.resume?.();
    }
    if (paused) return;
    for (const model of this.active) model.mixer.update(delta);
    const waiting = [];
    for (const cue of this.pending) {
      cue.elapsed += delta;
      if (cue.elapsed + 1e-9 < cue.delaySeconds) { waiting.push(cue); continue; }
      const model = this.models.get(cue.nodeId);
      if (!model) continue;
      const action = model.mixer.clipAction(model.clips[cue.clipIndex]);
      action.reset().setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
      this.active.push(model);
      model.mixer.update(Math.max(0, cue.elapsed - cue.delaySeconds));
      if (cue.soundId && cue.sound) { const handle = cue.sound(cue.soundId,cue.nodeId); if (handle) this.sounds.push(handle); }
    }
    this.pending = waiting;
  }
  stop() {
    this.pending = [];
    for (const model of this.active) model.mixer.stopAllAction();
    for (const sound of this.sounds) sound.stop?.();
    this.active = []; this.sounds = []; this.key = null; this.paused = false;
  }
  dispose() { this.stop(); for (const model of this.models.values()) model.mixer.uncacheRoot(model.root); }
  diagnostics() { return {pending: this.pending.map(cue => ({nodeId: cue.nodeId, elapsed: cue.elapsed, delaySeconds: cue.delaySeconds})),
    active: this.active.map(model => model.nodeId), sounds: this.sounds.length, paused: this.paused}; }
}

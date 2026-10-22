import assert from 'node:assert/strict';
import { readEditorPreferences, writeEditorPreferences } from '../src/editor/preferences.js';
import { createPlayerProgress } from '../src/player/progress.js';
import { createMediaPreloader } from '../src/player/media-preloader.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
const storage = memoryStorage();
const settings = { autoSaveMinutes: 5, theme: 'system', appearanceVersion: 51 };
storage.setItem('vrm-editor-settings', '{broken');
readEditorPreferences(settings, storage);
assert.equal(settings.autoSaveMinutes, 5);
storage.setItem(
  'vrm-editor-settings',
  JSON.stringify({ autoSaveMinutes: 30, theme: 'dark', appearanceVersion: 50 }),
);
readEditorPreferences(settings, storage);
assert.equal(settings.autoSaveMinutes, 30);
assert.equal(settings.theme, 'system', 'Legacy appearance settings retain the established reset');
settings.theme = 'light';
writeEditorPreferences(settings, 'ja', storage);
assert.deepEqual(JSON.parse(storage.getItem('vrm-editor-settings')), {
  ...settings,
  language: 'ja',
});

let project = {
  id: 'one',
  assets: [],
  characters: [{ id: 'role', name: '测试人物' }],
  acts: [
    { id: 'act', name: '章节', steps: [{ id: 'line', characterId: 'role', text: '原始台词' }] },
    { id: 'event', kind: 'event', steps: [{ id: 'event-line', text: '事件文字' }] },
    { id: 'later', steps: [{ id: 'later-line', characterId: 'role', text: '后续台词' }] },
  ],
};
let mode = 'player';
const progress = createPlayerProgress({
  project: () => project,
  mode: () => mode,
  storage,
  readSaveSlots: () => [null, { actId: 'act', stepId: 'line', backgroundId: 'image' }],
  readLegacyFirstSlot: () => null,
});
const old = progress.loadLifetimeProgress();
assert.deepEqual(old.viewedDialogueIds, ['line']);
assert.deepEqual(old.characterLineCounts, { role: 1 });
assert.deepEqual(old.seenImageIds, ['image']);
assert.equal(old.viewedDialogueText.line, '原始台词');
assert.equal(progress.progressStatistics().seen, 1);
project.acts[0].steps[0].text = '改过的台词';
assert.equal(progress.progressStatistics().seen, 0, 'Edited dialogue must be read again');
progress.rememberDiscovery('music', 'track');
progress.rememberDiscovery('music', 'track');
assert.deepEqual(old.heardMusicIds, ['track']);
mode = 'editor';
progress.rememberDiscovery('image', 'editor-image');
assert(!old.seenImageIds.includes('editor-image'));
assert.equal(progress.hasDiscovered('character', 'unknown'), true);
assert.deepEqual(progress.slotLocation({ actId: 'later', stepId: 'later-line', act: 0, step: 9 }), {
  actIndex: 2,
  stepIndex: 0,
});
assert.deepEqual(progress.legacyDialogueProgress({ actId: 'later', stepId: 'later-line' }).seen, [
  'line',
  'later-line',
]);
project = { ...project, id: 'two' };
progress.cache = null;
assert.equal(progress.lifetimeKey(), 'vrm-lifetime-progress-two');
storage.setItem(progress.lifetimeKey(), '{broken');
assert.deepEqual(progress.loadLifetimeProgress().viewedDialogueIds, []);
assert.equal(
  JSON.parse(storage.getItem('vrm-lifetime-progress-one')).viewedDialogueText.line,
  '原始台词',
);

const originalDocument = globalThis.document,
  originalImage = globalThis.Image;
const nodes = [];
class MediaNode extends EventTarget {
  constructor(tagName) {
    super();
    this.tagName = tagName;
    this.pauses = 0;
    nodes.push(this);
  }
  set src(value) {
    this.url = value;
    queueMicrotask(() =>
      this.dispatchEvent(new Event(this.tagName === 'IMG' ? 'load' : 'loadeddata')),
    );
  }
  get src() {
    return this.url;
  }
  pause() {
    this.pauses++;
  }
  removeAttribute(name) {
    if (name === 'src') this.url = '';
  }
  load() {}
}
try {
  globalThis.Image = class extends MediaNode {
    constructor() {
      super('IMG');
    }
  };
  globalThis.document = { createElement: (tag) => new MediaNode(tag.toUpperCase()) };
  const mediaProject = {
    assets: [
      { id: 'music', type: 'audio', path: 'assets/music/a b.ogg' },
      { id: 'voice', type: 'voice', path: 'assets/voice/line.wav' },
      { id: 'image', type: 'image', path: 'assets/image/cover.png' },
    ],
    characters: [],
  };
  const act = { bgmId: 'music', coverImageId: 'image', steps: [{ voiceId: 'voice' }] };
  const preloader = createMediaPreloader({ project: () => mediaProject });
  await preloader.prepareCurrentActMedia(act);
  const taken = preloader.takePreparedAudio('music');
  assert.equal(taken.src, 'https://project.galgame/assets/music/a%20b.ogg');
  assert.equal(preloader.takePreparedAudio('music'), null);
  assert.equal(preloader.takePreparedAudio('image'), null);
  preloader.releasePreparedMedia();
  assert.equal(taken.pauses, 0, 'Transferred audio remains owned by playback');
  assert(
    nodes.filter((node) => node !== taken).every((node) => node.pauses === 1 && node.src === ''),
  );
  const next = nodes.length;
  await preloader.prepareCurrentActMedia(act, () => false);
  assert(
    nodes.slice(next).every((node) => node.pauses === 1 && node.src === ''),
    'Stale asynchronous preparation releases all media',
  );
  assert.equal(preloader.takePreparedAudio('music'), null);
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalImage === undefined) delete globalThis.Image;
  else globalThis.Image = originalImage;
}
console.log(
  'PASS: preference compatibility, progress migration/isolation, edited-text progress, media URL resolution, ownership transfer and stale preload cleanup.',
);

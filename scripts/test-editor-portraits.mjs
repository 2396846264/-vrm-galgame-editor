import assert from 'node:assert/strict';
import { createPortraitAssets, autoPortraitFolderId } from '../src/editor/portrait-assets.js';
import { createPortraitJobs } from '../src/editor/portrait-jobs.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const role = {
  id: 'role',
  modelId: 'model',
  galleryMotionId: '',
  galleryPoseFrame: 1,
  portraitId: '',
  portraitSource: 'auto',
  name: '角色',
};
let project = {
  id: 'project',
  characters: [role],
  assets: [{ id: 'model', type: 'fbxCharacter' }],
  assetFolders: [],
  acts: [],
};
let mode = 'editor',
  captures = [],
  saves = [],
  repaint = 0;
const edits = [],
  errors = [],
  displayed = [],
  amended = [];
const assets = createPortraitAssets({
  project: () => project,
  markDirty: (options) => edits.push(options),
  changed: () => repaint++,
});
const jobs = createPortraitJobs({
  project: () => project,
  mode: () => mode,
  asset: (id) => project.assets.find((asset) => asset.id === id),
  capture: () => {
    const task = deferred();
    captures.push(task);
    return task.promise;
  },
  bridge: (action, payload) => {
    assert.equal(action, 'saveGeneratedPortrait');
    const task = deferred();
    saves.push({ ...task, payload });
    return task.promise;
  },
  history: {
    amend: (update) => {
      const snapshot = structuredClone(project);
      delete snapshot.characters[0].portraitPoseKey;
      amended.push({ snapshot, result: update(snapshot) });
    },
  },
  replace: assets.replace,
  markDirty: (options) => edits.push(options),
  changed: () => repaint++,
  display: (id) => displayed.push(id),
  toast: (message) => errors.push(message),
});

const staleCapture = jobs.ensure(role),
  sameCapture = jobs.ensure(role);
assert.equal(captures.length, 1);
assert.equal(jobs.jobs.size, 1);
role.modelId = 'changed';
captures[0].resolve({ dataUrl: 'stale', frame: 1 });
await Promise.all([staleCapture, sameCapture]);
assert.equal(saves.length, 0);
assert.equal(jobs.jobs.size, 0);
role.modelId = 'model';

const staleSave = jobs.ensure(role);
captures.at(-1).resolve({ dataUrl: 'captured', frame: 1 });
await Promise.resolve();
await Promise.resolve();
assert.equal(saves.length, 1);
project.assets.push({ id: 'manual', type: 'image', path: 'manual.png' });
role.portraitId = 'manual';
role.portraitSource = 'manual';
saves[0].resolve({ id: 'stale-portrait', type: 'image', path: 'stale.png' });
await staleSave;
assert.equal(role.portraitId, 'manual');
assert(!project.assets.some((asset) => asset.id === 'stale-portrait'));
await jobs.ensure(role, true);
assert.equal(captures.length, 2, 'Automatic updates must not overwrite manual portraits');

const captureManual = jobs.ensure(role, true, true);
captures.at(-1).resolve({ dataUrl: 'explicit', frame: 1 });
await Promise.resolve();
await Promise.resolve();
saves
  .at(-1)
  .resolve({ id: 'explicit', type: 'image', path: 'explicit.png', generatedPortrait: true });
await captureManual;
assert.equal(role.portraitId, 'explicit');
assert.equal(role.portraitSource, 'auto');
assert(edits.some((options) => options.label === '重新拍摄头像'));
assert.equal(amended.length, 0);

const auto = jobs.ensure(role, true);
captures.at(-1).resolve({ dataUrl: 'automatic', frame: 1 });
await Promise.resolve();
await Promise.resolve();
saves
  .at(-1)
  .resolve({ id: 'automatic', type: 'image', path: 'automatic.png', generatedPortrait: true });
await auto;
assert.equal(role.portraitId, 'automatic');
assert(assets.pendingDeletes.has('explicit.png'));
assert.equal(amended.length, 1);
assert(amended[0].result);
assert.equal(amended[0].snapshot.characters[0].portraitId, 'automatic');
assert(project.assetFolders.some((folder) => folder.id === autoPortraitFolderId));
assert.equal(project.assets.find((asset) => asset.id === 'automatic').galleryImage, false);
assert(edits.some((options) => options.derived));
assert(displayed.includes(role.id));

project.assets.push({
  id: 'shared-unused',
  type: 'image',
  generatedPortrait: true,
  path: 'manual.png',
});
await assets.removeUnused();
assert(!assets.pendingDeletes.has('manual.png'), 'Shared physical files remain available');
assert(!project.assets.some((asset) => asset.id === 'shared-unused'));

mode = 'player';
role.portraitId = '';
role.portraitSource = '';
const saveCount = saves.length,
  player = jobs.ensure(role);
captures.at(-1).resolve({ dataUrl: 'temporary', frame: 1 });
await player;
assert.equal(jobs.temporary.get(role.id), 'temporary');
assert.equal(saves.length, saveCount);
assert.equal(role.portraitId, '');

mode = 'editor';
const switching = jobs.ensure(role);
const previous = project;
project = structuredClone(project);
captures.at(-1).resolve({ dataUrl: 'wrong-project', frame: 1 });
await switching;
assert.equal(saves.length, saveCount);
assert.equal(previous.characters[0].portraitId, '');

const failed = jobs.ensure(project.characters[0]);
captures.at(-1).reject(Error('捕获失败'));
await failed;
assert.equal(jobs.jobs.size, 0);
assert(errors[0].includes('捕获失败'));
assert(repaint > 0);
console.log(
  'PASS: portrait task deduplication, stale capture/save rejection, manual portrait protection, history amendments, shared files and player-only temporary portraits.',
);

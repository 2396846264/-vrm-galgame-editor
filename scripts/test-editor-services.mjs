import assert from 'node:assert/strict';
import {
  addAct,
  removeAct,
  clearActReferences,
  addDialogue,
  duplicateDialogue,
  reorderStoryRows,
} from '../src/editor/commands/story.js';
import {
  addCharacter,
  removeCharacter,
  addCharacterProp,
  removeCharacterProp,
} from '../src/editor/commands/characters.js';
import { assetRemovalBlock, removeAsset } from '../src/editor/commands/assets.js';
import { addInventoryItem, removeInventoryItem } from '../src/editor/commands/inventory.js';
import { createEditorPersistence } from '../src/editor/persistence.js';
import { createHistoryInput, historyInputContextSupported } from '../src/editor/history-input.js';

let id = 0;
const uid = () => String(++id);
const project = {
  acts: [],
  characters: [],
  assets: [{ id: 'preset-mixamo-029' }],
  items: [],
  knowledgeBooks: [],
};
const act = addAct(project, uid),
  otherAct = addAct(project, uid);
const first = addDialogue(act, uid);
first.text = '保留原文';
first.choices.push({ text: '继续', actId: otherAct.id });
const next = addDialogue(act, uid);
assert.equal(next.text, '');
assert.equal(next.choices[0].actId, otherAct.id);
next.choices[0].text = '独立副本';
assert.equal(first.choices[0].text, '继续');
const copy = duplicateDialogue(act, 0, uid);
assert.equal(copy.text, '保留原文');
assert.notEqual(copy.id, first.id);
const before = project.acts.map((row) => row.id);
assert.equal(reorderStoryRows(project.acts, -1, 0, true), false);
assert.equal(reorderStoryRows(project.acts, 0, 0, true), false);
assert.deepEqual(
  project.acts.map((row) => row.id),
  before,
);
assert.equal(reorderStoryRows(project.acts, 0, 1, true), true);
assert.equal(project.acts[1], act);
removeAct(project, 0);
assert.equal(
  first.choices[0].actId,
  otherAct.id,
  'Toolbar removal keeps existing reference policy',
);
project.knowledgeBooks.push({ unlockActId: otherAct.id });
clearActReferences(project, otherAct.id);
assert.equal(first.choices[0].actId, '');
assert.equal(project.knowledgeBooks[0].unlockActId, '');

const role = addCharacter(project, uid);
assert.equal(role.galleryMotionId, 'preset-mixamo-029');
role.stories[0].text = '独立故事';
assert.equal(role.stories[1].text, '');
const prop = addCharacterProp(role, { id: 'model', name: '道具' }, uid);
first.characterId = role.id;
first.cast.left = { characterId: role.id, props: [prop.id] };
assert(assetRemovalBlock(project, 'model').includes('绑定'));
removeCharacterProp(project, role, prop.id);
assert.deepEqual(first.cast.left.props, []);
assert.equal(assetRemovalBlock(project, 'model'), '');
project.environments = [{ nodes: [{ assetId: 'scene' }] }];
assert(assetRemovalBlock(project, 'scene').includes('3D'));
removeCharacter(project, 0);
assert.equal(first.characterId, '');
assert.equal(first.cast.left.characterId, '');
const voice = { id: 'voice', type: 'voice', path: 'voice.wav' };
project.assets.push(voice);
first.voiceId = voice.id;
let stopped = false;
removeAsset(project, voice, () => {
  assert.equal(first.voiceId, '');
  assert(project.assets.includes(voice));
  stopped = true;
});
assert(stopped);
assert(!project.assets.includes(voice));
addInventoryItem(project, uid);
first.itemGrants = [{ itemId: project.items[0].id, quantity: 1 }];
removeInventoryItem(project, 0);
assert.equal(first.itemGrants.length, 1, 'Keep existing inventory reference policy');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
let current = {
  project: { id: 'doc', name: '原名', assets: [] },
  revision: 1,
  modulePanel: null,
  moduleBaseline: null,
};
let dirty = true;
const pending = new Set(['retained.png', 'obsolete.png']);
const requests = [],
  activities = [],
  applied = [];
let settled = 0,
  seals = 0;
const persistence = createEditorPersistence({
  read: () => current,
  history: { seal: () => seals++, retainedAssetPaths: () => ['retained.png'] },
  pendingPortraitDeletes: pending,
  bridge: (action, payload) => {
    const task = deferred();
    requests.push({ action, payload, ...task });
    return task.promise;
  },
  moduleSaved: (submitted, result, unchanged) => {
    applied.push({ submitted, result, unchanged });
    current.project = result.project;
  },
  saved: () => {
    dirty = false;
  },
  activity: (value) => activities.push(value),
  settled: () => settled++,
});
const saving = persistence.save();
assert.equal(persistence.inFlight, requests[0].promise);
assert.deepEqual(requests[0].payload.obsoletePortraitPaths, ['obsolete.png']);
current.project.name = '保存时继续编辑';
current.revision++;
assert.equal(requests[0].payload.project.name, '原名');
requests[0].resolve({});
await saving;
assert(dirty);
assert.deepEqual([...pending], ['retained.png']);
assert.equal(persistence.inFlight, null);
assert.deepEqual(activities, [true, false]);
assert.equal(settled, 1);

pending.add('failure.png');
const failed = persistence.save();
requests.at(-1).reject(Error('磁盘写入失败'));
await assert.rejects(failed, /磁盘/);
assert(dirty);
assert(pending.has('failure.png'));
assert.equal(persistence.inFlight, null);

const one = persistence.save(),
  two = persistence.save();
const firstRequest = requests.at(-1),
  count = requests.length;
assert.equal(count, 3, 'Second save waits for the existing request');
current.project.name = '第二次保存内容';
current.revision++;
firstRequest.resolve({});
await one;
await Promise.resolve();
assert.equal(requests.length, count + 1);
assert.equal(requests.at(-1).payload.project.name, '第二次保存内容');
assert.equal(persistence.inFlight, requests.at(-1).promise);
requests.at(-1).resolve({});
await two;
assert.equal(dirty, false);
assert.equal(seals, 4);

current.modulePanel = 'characters';
current.moduleBaseline = structuredClone(current.project);
dirty = true;
const moduleSave = persistence.save();
assert.equal(requests.at(-1).action, 'saveModule');
assert.equal(requests.at(-1).payload.base, current.moduleBaseline);
const merged = { ...current.project, name: '宿主合并结果' };
requests.at(-1).resolve({ project: merged, revision: 18 });
await moduleSave;
assert.equal(applied.length, 1);
assert(applied[0].unchanged);
assert.equal(current.project, merged);
assert(!dirty);

const listeners = new Map(),
  events = [];
const fakeDocument = {
  addEventListener: (name, fn, capture) => {
    assert.equal(capture, true);
    listeners.set(name, fn);
  },
  removeEventListener: (name, fn, capture) => {
    assert.equal(capture, true);
    assert.equal(listeners.get(name), fn);
    listeners.delete(name);
  },
};
const history = { begin: () => events.push('begin'), seal: () => events.push('seal') };
let editable = true;
const input = createHistoryInput({
  document: fakeDocument,
  history,
  mode: () => 'editor',
  editable: () => editable,
  selectionKey: () => ['act', 'line', 'role', 0],
});
const node = {
  id: '',
  type: 'range',
  dataset: { field: 'step.text', fieldOutput: 'ignored' },
  hasAttribute: () => false,
  closest: () => ({ querySelector: () => ({ textContent: '对白' }) }),
  getAttribute: () => null,
  matches: () => true,
};
assert(historyInputContextSupported(node));
listeners.get('pointerdown')({ target: node });
listeners.get('input')({ target: node });
assert(input.current().continuous);
assert.equal(input.current().label, '修改对白');
assert.deepEqual(JSON.parse(input.current().key), [
  'act',
  'line',
  'role',
  0,
  '',
  [['field', 'step.text']],
]);
await Promise.resolve();
assert.deepEqual(input.current(), {});
listeners.get('pointerup')({});
const button = { textContent: '＋ 新增幕' };
listeners.get('click')({ target: { closest: () => button } });
assert.equal(input.current().label, '新增幕');
editable = false;
const beforeEvents = events.length;
listeners.get('input')({ target: node });
assert.equal(events.length, beforeEvents);
input.dispose();
assert.equal(listeners.size, 0);
assert.deepEqual(input.current(), {});
console.log(
  'PASS: editor commands, retained undo assets, failed/overlapping saves, module save and capture-phase history grouping.',
);

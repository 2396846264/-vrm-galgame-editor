import assert from 'node:assert/strict';
import { createEditorSession } from '../src/editor/session.js';
import { createEditorModuleSession } from '../src/editor/module-session.js';

let project = {
  id: 'p',
  name: '原名',
  characters: [{ id: 'role', name: '角色', description: '' }],
  acts: [],
  items: [],
  title: {},
  ui: {},
  assets: [],
};
let mode = 'editor',
  busy = false;
const commits = [],
  order = [];
const context = { label: '输入标签', key: 'field' };
const editor = createEditorSession({
  project: () => project,
  mode: () => mode,
  uid: () => 'id',
  history: {
    commit: (options) => {
      order.push('history');
      commits.push(options);
    },
  },
  historyContext: () => context,
  historyBusy: () => busy,
  changed: () => {
    order.push('ui');
    assert(editor.dirty);
    assert.equal(project.environmentSchemaVersion, 1);
    assert(project.assetFolders.some((folder) => folder.type === 'voice'));
  },
});
editor.markDirty();
assert.equal(editor.revision, 1);
assert.equal(commits[0], context);
assert.deepEqual(order, ['ui', 'history']);
editor.markDirty({ skipHistory: true });
assert.equal(commits.length, 1);
busy = true;
editor.markDirty();
assert.equal(commits.length, 1);
editor.markDirty({ derived: true });
assert.equal(commits.length, 2);
assert(commits[1].derived);
busy = false;
mode = 'player';
editor.markDirty();
assert.equal(commits.length, 2);
editor.dirty = false;
editor.revision = 42;
assert(!editor.dirty);
assert.equal(editor.revision, 42);

mode = 'editor';
const baseline = structuredClone(project),
  snapshots = [structuredClone(project)];
let saving = false,
  panel = 'characters',
  nextTimer = 0,
  changes = 0;
const timers = new Map(),
  messages = [],
  errors = [];
const selected = { actId: 'act', roleId: 'role', itemId: 'item' };
const modules = createEditorModuleSession({
  project: () => project,
  panel: () => panel,
  revision: () => editor.revision,
  saving: () => saving,
  history: { amend: (update) => snapshots.forEach((snapshot) => update(snapshot)) },
  bridge: async (action, payload) => messages.push({ action, payload }),
  replaceProject: (value) => {
    project = value;
  },
  selection: () => selected,
  changed: (view) => {
    assert.equal(view, selected);
    assert.equal(modules.baselineRevision, 7);
    changes++;
  },
  error: (error) => errors.push(error),
  setTimer: (fn, delay) => {
    assert.equal(delay, 300);
    timers.set(++nextTimer, fn);
    return nextTimer;
  },
  clearTimer: (id) => timers.delete(id),
});
modules.baseline = structuredClone(baseline);
modules.baselineRevision = 3;
project.name = '本地改名';
const remote = structuredClone(baseline);
remote.characters[0].description = '外部编辑';
modules.refresh({ project: remote, revision: 2 });
assert.equal(changes, 0);
modules.refresh({ project: { ...remote, id: 'another' }, revision: 5 });
assert.equal(changes, 0);
saving = true;
modules.refresh({ project: remote, revision: 5 });
const latest = structuredClone(remote);
latest.characters[0].description = '最后一条外部编辑';
modules.refresh({ project: latest, revision: 7 });
assert.equal(changes, 0);
saving = false;
modules.flush();
assert.equal(changes, 1);
assert.equal(project.name, '本地改名');
assert.equal(project.characters[0].description, '最后一条外部编辑');
assert.equal(snapshots[0].characters[0].description, '最后一条外部编辑');
assert.equal(snapshots[0].name, baseline.name, 'Undo snapshot retains its own local value');
modules.flush();
assert.equal(changes, 1);

project.name = '本地再次改名';
const conflict = structuredClone(modules.baseline);
conflict.name = '外部同时改名';
const before = project,
  beforeBase = modules.baseline;
modules.refresh({ project: conflict, revision: 8 });
assert.equal(errors.length, 1);
assert.equal(project, before);
assert.equal(modules.baseline, beforeBase);

const submitted = structuredClone(project),
  saved = structuredClone(project);
saved.characters[0].description = '宿主保存合并';
project.ui.custom = '请求发出后的本地设置';
modules.acceptSaved(submitted, { project: saved, revision: 9 });
assert.equal(project.ui.custom, '请求发出后的本地设置');
assert.equal(project.characters[0].description, '宿主保存合并');
assert.equal(modules.baselineRevision, 9);
assert.equal(modules.baseline.ui.custom, undefined);
modules.acceptSaved(project, { project: structuredClone(project), revision: 0 });
assert.equal(modules.baselineRevision, 9);

panel = null;
modules.schedule();
modules.schedule();
assert.equal(timers.size, 1);
const fire = () => {
  const [id, fn] = timers.entries().next().value;
  timers.delete(id);
  fn();
};
saving = true;
fire();
assert.equal(messages.length, 0);
assert.equal(timers.size, 1);
saving = false;
fire();
assert.equal(messages.length, 1);
assert.equal(messages[0].action, 'notifyEditorModules');
assert.equal(messages[0].payload.revision, 42);
assert.notEqual(messages[0].payload.project, project);
modules.schedule();
modules.dispose();
assert.equal(timers.size, 0);
console.log(
  'PASS: editor dirty/revision ordering, derived history, queued module refresh, independent merge, conflict preservation, history rebasing and notification disposal.',
);

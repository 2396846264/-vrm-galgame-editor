import assert from 'node:assert/strict';
import { createPlayerSaves } from '../src/player/saves.js';

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};
let project = {
  id: 'old',
  name: '旧工程',
  characters: [{ id: 'c', name: '角色' }],
  acts: [
    {
      id: 'a',
      name: '第一幕',
      backgroundId: 'bg',
      steps: [{ id: 'line', characterId: 'c', text: '已有对白' }],
    },
  ],
};
const saves = createPlayerSaves({ project: () => project, storage });
assert.equal(saves.key(), 'vrm-save-slots-old');
values.set('vrm-save-old', JSON.stringify({ act: 0, step: 0 }));
let slots = saves.read();
assert.equal(slots.length, 20);
assert.equal(slots[0], null);
assert.equal(slots[1].stepId, 'line');
assert.equal(slots[1].speaker, '角色');
const original = { act: 0, step: 0, text: 'old first slot' };
values.set(saves.key(), JSON.stringify([original]));
slots = saves.read();
assert.equal(slots[0], null);
assert.deepEqual(slots[1], original);
const full = Array.from({ length: 20 }, (_, index) => ({ act: 0, step: 0, text: String(index) }));
values.set(saves.key(), JSON.stringify(full));
slots = saves.read();
assert.equal(slots[0], null);
assert.deepEqual(saves.readLegacy(), full[0]);
assert.deepEqual(slots.slice(1), full.slice(1));
values.set(saves.key(), JSON.stringify([{ auto: true, inventory: { counts: { key: 2 } } }]));
assert.equal(saves.read()[0].inventory.counts.key, 2);
values.set(saves.key(), '{invalid');
assert.deepEqual(saves.read(), Array(20).fill(null));
project = { ...project, id: 'another' };
assert.equal(saves.key(), 'vrm-save-slots-another');
assert.equal(values.get('vrm-save-slots-old'), '{invalid');
console.log(
  'PASS: old single-slot migration, automatic-slot reservation, full-slot fallback, inventory payloads, corrupt data and project isolation.',
);

import assert from 'node:assert/strict';
import { normalizeProject } from '../src/project/document.js';
import { historicalShips } from '../src/historical-warships.js';

// Keep fixture libraries present so this test exercises migration, rather than
// spending time generating the shipped demonstration vehicles.
const project = {
  id: 'legacy',
  name: '旧工程',
  assets: [{ id: 'portrait', name: '自动头像.png' }],
  characters: [{ id: 'role', portraitId: 'portrait', name: '角色' }],
  items: [{ id: 'key', consumable: false }],
  assetFolders: [{ id: 'auto-character-portraits' }],
  acts: [
    { id: 'act', steps: [{ id: 'line', text: '原文', characterId: 'role', position: 'center' }] },
  ],
  vehicles: [
    { id: 'air', vehicleType: 'aircraft', blueprint: {} },
    { id: 'ship', vehicleType: 'warship', blueprint: {} },
    ...Object.keys(historicalShips).map((sampleKey) => ({
      id: sampleKey,
      vehicleType: 'warship',
      sampleKey,
      blueprint: {},
    })),
  ],
};
let serial = 0;
assert.equal(
  normalizeProject(project, () => `migration-${++serial}`),
  project,
);
assert.equal(
  project.version,
  undefined,
  'Refactoring must not silently change the document version',
);
assert.equal(project.name, '旧工程');
assert.equal(project.acts[0].steps[0].text, '原文');
assert.equal(project.characters[0].portraitSource, 'auto');
assert.equal(project.characters[0].nameColor, '#ffbfdc');
assert.equal(project.items[0].consumable, undefined);
assert.equal(
  project.assetFolders.find((folder) => folder.id === 'auto-character-portraits').hidden,
  true,
);
assert.equal(project.acts[0].steps[0].cast.center.characterId, 'role');
assert(Array.isArray(project.acts[0].steps[0].choices));
assert.equal(project.playerInventory, undefined);
assert.equal(project.selectedAct, undefined);
const once = JSON.stringify(project);
normalizeProject(project, () => `migration-${++serial}`);
assert.equal(
  JSON.stringify(project),
  once,
  'Repeated normalization must not change an already migrated project',
);
console.log(
  'PASS: legacy defaults, cast/portrait/item migration, text/ID preservation, idempotence and no session data in the document.',
);

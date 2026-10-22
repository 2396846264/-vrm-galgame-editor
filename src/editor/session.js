import { migrateEnvironments } from '../environment-schema.js';
import { syncDialogueVoices } from '../dialogue-voices.js';
import { syncAssetOrganization } from '../asset-organization.js';

// Editing metadata lives outside the serialized project. The controller keeps
// selection and UI effects; all normal edits retain one history commit path.
export function createEditorSession({
  project,
  mode,
  uid,
  history,
  historyContext,
  historyBusy,
  changed,
}) {
  let dirty = false,
    revision = 0;
  function markDirty(options) {
    const current = project();
    if (current) migrateEnvironments(current);
    if (current) {
      syncDialogueVoices(current);
      syncAssetOrganization(current, uid);
    }
    revision++;
    dirty = true;
    changed();
    if (mode() === 'editor' && !options?.skipHistory && (!historyBusy() || options?.derived))
      history.commit(options || historyContext());
  }
  return {
    markDirty,
    get dirty() {
      return dirty;
    },
    set dirty(value) {
      dirty = value;
    },
    get revision() {
      return revision;
    },
    set revision(value) {
      revision = value;
    },
  };
}

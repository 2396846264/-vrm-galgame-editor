// Only editable project data is kept here. Player saves and editor preferences
// deliberately never enter the undo stack. Each entry owns an immutable copy.
export function createEditorHistory({ project, selection, changed = () => {}, limit = 100, byteLimit = 32 * 1024 * 1024, now = () => Date.now() }) {
  let entries = [], cursor = -1, mergeKey = '', mergeTime = 0;
  const copy = value => structuredClone(value);
  function status() {
    return { canUndo: cursor > 0, canRedo: cursor >= 0 && cursor < entries.length - 1,
      undoLabel: entries[cursor]?.label || '', redoLabel: entries[cursor + 1]?.label || '',
      undoCount: Math.max(0, cursor), redoCount: Math.max(0, entries.length - cursor - 1) };
  }
  function snapshot(label = '') {
    const json = JSON.stringify(project());
    return { json, view: copy(selection()), label, bytes: json.length * 2 };
  }
  function seal() { mergeKey = ''; mergeTime = 0; }
  function reset() { entries = project() ? [snapshot()] : []; cursor = entries.length - 1; seal(); changed(status()); }
  function begin() { if (entries[cursor]) entries[cursor].view = copy(selection()); }
  function trim() {
    let size = entries.reduce((sum, entry) => sum + entry.bytes, 0);
    while (entries.length > 2 && (entries.length > limit + 1 || size > byteLimit)) {
      if (cursor > 0) { size -= entries.shift().bytes; cursor--; }
      else size -= entries.pop().bytes;
    }
  }
  function commit({ key = '', label = '编辑工程', continuous = false, derived = false } = {}) {
    if (!project()) return false;
    if (cursor < 0) { reset(); return false; }
    const entry = snapshot(label);
    if (entry.json === entries[cursor].json) return false;
    if (derived) {
      // Generated portraits/frame corrections are part of the user's operation,
      // not an additional step the user must undo separately.
      entry.label = entries[cursor].label;
      entry.view = entries[cursor].view;
      entries[cursor] = entry;
    } else {
      const time = now();
      const merge = cursor > 0 && key && key === mergeKey && (continuous || time - mergeTime < 1000);
      entries.splice(cursor + 1);
      if (merge) entries[cursor] = entry;
      else { entries.push(entry); cursor++; }
      mergeKey = key; mergeTime = time;
    }
    trim(); changed(status()); return true;
  }
  function peek(direction) {
    const target = cursor + direction;
    if (target < 0 || target >= entries.length) return null;
    return { project: JSON.parse(entries[target].json), view: copy(entries[target].view),
      label: direction < 0 ? entries[cursor].label : entries[target].label, target };
  }
  function accept(target) { cursor = target; seal(); changed(status()); }
  function amend(update) {
    for (const entry of entries) {
      const value = JSON.parse(entry.json);
      if (!update(value)) continue;
      entry.json = JSON.stringify(value); entry.bytes = entry.json.length * 2;
    }
    trim(); changed(status());
  }
  function retainedAssetPaths() {
    return [...new Set(entries.flatMap(entry => (JSON.parse(entry.json).assets || []).map(asset => asset.path)))];
  }
  return { reset, begin, seal, commit, status, peek, accept, amend, retainedAssetPaths };
}

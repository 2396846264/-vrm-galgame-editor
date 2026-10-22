// Document persistence owns the in-flight request and snapshot/revision rules.
// The controller supplies current document metadata and applies UI effects.
export function createEditorPersistence({
  read,
  history,
  pendingPortraitDeletes,
  bridge,
  moduleSaved,
  saved,
  activity,
  settled,
}) {
  let inFlight = null;
  async function save() {
    if (inFlight) await inFlight;
    history.seal();
    const start = read();
    const revision = start.revision;
    const retainedPaths = new Set(history.retainedAssetPaths());
    const obsoletePortraitPaths = [...pendingPortraitDeletes].filter(
      (path) => !retainedPaths.has(path),
    );
    const submitted = structuredClone(start.project);
    const task = start.modulePanel
      ? bridge('saveModule', { base: start.moduleBaseline, project: submitted })
      : bridge('saveProject', { project: submitted, obsoletePortraitPaths });
    inFlight = task;
    activity(true);
    try {
      const result = await task;
      const current = read();
      if (current.modulePanel && result.project) {
        // History rebasing precedes replacement, exactly as in the controller.
        moduleSaved(submitted, result, revision === current.revision);
      }
      obsoletePortraitPaths.forEach((path) => pendingPortraitDeletes.delete(path));
      if (revision === read().revision) saved();
    } finally {
      if (inFlight === task) inFlight = null;
      activity(Boolean(inFlight));
      settled();
    }
  }
  return {
    save,
    get inFlight() {
      return inFlight;
    },
  };
}

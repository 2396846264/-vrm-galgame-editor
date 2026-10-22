import { mergeEditorProject, rebaseEditorHistoryProject } from '../editor-project-merge.js';

// Owns cross-window baselines and queued refreshes, without DOM or selection
// storage. UI callbacks apply the existing selection/focus policy after merging.
export function createEditorModuleSession({
  project,
  panel,
  revision,
  saving,
  history,
  bridge,
  replaceProject,
  selection,
  changed,
  error,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let baseline = null,
    baselineRevision = 0,
    pending = null,
    timer = null;
  function rebase(before, current) {
    history.amend((snapshot) => {
      const value = rebaseEditorHistoryProject(before, current, snapshot);
      for (const key of Object.keys(snapshot)) delete snapshot[key];
      Object.assign(snapshot, value);
      return true;
    });
  }
  function schedule() {
    clearTimer(timer);
    timer = setTimer(() => {
      if (saving()) {
        schedule();
        return;
      }
      bridge('notifyEditorModules', {
        project: structuredClone(project()),
        revision: revision(),
      }).catch(() => {});
    }, 300);
  }
  function refresh(payload) {
    const latest = payload.project || payload,
      nextRevision = Number(payload.revision) || 0;
    if (nextRevision < baselineRevision) return;
    if (!panel() || !baseline || !project() || latest?.id !== project().id) return;
    if (saving()) {
      pending = payload;
      return;
    }
    if (JSON.stringify(latest) === JSON.stringify(baseline)) return;
    try {
      const view = selection();
      const merged = mergeEditorProject(baseline, latest, project());
      rebase(baseline, latest);
      replaceProject(merged);
      baseline = structuredClone(latest);
      baselineRevision = nextRevision;
      changed(view);
    } catch (cause) {
      error(cause);
    }
  }
  function acceptSaved(submitted, saved) {
    rebase(submitted, saved.project);
    replaceProject(mergeEditorProject(submitted, saved.project, project()));
    baseline = structuredClone(saved.project);
    baselineRevision = Number(saved.revision) || baselineRevision;
  }
  function flush() {
    if (panel() && pending) {
      const latest = pending;
      pending = null;
      refresh(latest);
    }
  }
  function dispose() {
    clearTimer(timer);
    timer = null;
    pending = null;
  }
  return {
    schedule,
    refresh,
    rebase,
    acceptSaved,
    flush,
    dispose,
    get baseline() {
      return baseline;
    },
    set baseline(value) {
      baseline = value;
    },
    get baselineRevision() {
      return baselineRevision;
    },
    set baselineRevision(value) {
      baselineRevision = value;
    },
  };
}

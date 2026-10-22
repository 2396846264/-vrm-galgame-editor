export function readEditorPreferences(editorSettings, storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem('vrm-editor-settings') || 'null');
    if ([5, 10, 30, 60].includes(Number(saved?.autoSaveMinutes)))
      editorSettings.autoSaveMinutes = Number(saved.autoSaveMinutes);
    editorSettings.theme =
      saved?.appearanceVersion === 51 && ['dark', 'light', 'system'].includes(saved.theme)
        ? saved.theme
        : 'system';
  } catch {
    /* Keep the default interval. */
  }
}

export function writeEditorPreferences(
  editorSettings,
  language,
  storage = globalThis.localStorage,
) {
  editorSettings.language = language;
  storage.setItem('vrm-editor-settings', JSON.stringify(editorSettings));
}

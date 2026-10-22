// Read-only markup; editing and asynchronous work belong to the controller.
export function renderRenderPanel({ renderPresetEditor, editedRenderPreset, spatialCameraEditor }) {
  return `<div class="inspector-content"><h2>渲染预设制作</h2>${renderPresetEditor(editedRenderPreset())}${spatialCameraEditor('dialogue')}</div>`;
}

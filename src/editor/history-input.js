const supportedBindings = new Set([
  'field',
  'bookField',
  'eventField',
  'motionOptions',
  'galleryMusic',
  'galleryImage',
  'nprFilter',
  'itemField',
  'inventoryRow',
  'audioTitle',
  'storyIndex',
  'assetFolder',
  'titleField',
  'uiField',
  'titleAdjust',
  'titleExpression',
  'titleActorField',
  'titleActorAdjust',
  'titleActorExpression',
  'titleActorProp',
  'stepCast',
  'castSlot',
  'castMotion',
  'castAdjust',
  'castExpression',
  'castProp',
  'propField',
  'propTransform',
  'airField',
  'airPart',
  'airVector',
  'renderSelection',
  'renderCalibration',
  'renderPresetName',
  'presetFilter',
  'presetColor',
  'spatialCamera',
  'render',
  'weather',
  'galleryAdjust',
  'adjust',
  'expression',
  'choiceField',
]);
const bindingsOf = (node) =>
  Object.entries(node.dataset || {}).filter(([key]) => !key.endsWith('Output'));

export function historyInputContextSupported(node) {
  return (
    bindingsOf(node).some(([key]) => supportedBindings.has(key)) ||
    node.id === 'project-name' ||
    node.hasAttribute('data-gallery-frame-number')
  );
}

// Installed before bubble-phase editing handlers, so the pre-edit selection is
// captured before a mutation. This module owns only gesture/grouping state.
export function createHistoryInput({ document, history, mode, editable, selectionKey }) {
  let input = null,
    pointer = null,
    action = null;
  const listeners = [];
  const on = (name, handler) => {
    document.addEventListener(name, handler, true);
    listeners.push([name, handler]);
  };
  function context(node) {
    if (!historyInputContextSupported(node)) return null;
    const key = JSON.stringify([...selectionKey(), node.id, bindingsOf(node)]);
    const label =
      node.closest('label')?.querySelector('span')?.textContent?.trim() ||
      node.getAttribute('aria-label') ||
      '文字或设置';
    return { key, label: `修改${label.slice(0, 24)}`, continuous: pointer === node };
  }
  on('input', (event) => {
    if (event.target.hasAttribute('data-precise-fine')) return;
    if (!editable()) return;
    input = context(event.target);
    if (input) history.begin();
    queueMicrotask(() => {
      input = null;
    });
  });
  on('click', (event) => {
    if (!editable()) return;
    const button = event.target.closest?.('[data-action], [data-panel]');
    if (button) {
      input = null;
      history.seal();
      history.begin();
      action = {
        label:
          button.textContent
            .trim()
            .replace(/^＋\s*/, '')
            .slice(0, 24) || '编辑工程',
      };
    }
  });
  on('pointerdown', (event) => {
    if (mode() === 'editor' && event.target.type === 'range') {
      history.seal();
      history.begin();
      pointer = event.target;
    }
  });
  on('pointerup', () => {
    if (pointer) {
      pointer = null;
      history.seal();
    }
  });
  on('pointercancel', () => {
    pointer = null;
    history.seal();
  });
  on('focusout', (event) => {
    if (mode() === 'editor' && !pointer && event.target.matches?.('input, textarea, select'))
      history.seal();
  });
  on('drop', () => {
    if (mode() === 'editor') {
      history.seal();
      history.begin();
    }
  });
  function dispose() {
    for (const [name, handler] of listeners) document.removeEventListener(name, handler, true);
    listeners.length = 0;
    input = null;
    pointer = null;
    action = null;
  }
  return { context, current: () => input || action || {}, dispose };
}

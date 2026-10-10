// A project chooses one complete game skin. Editor appearance is independent.
export const gameUiPresets = [
  { id: 'classic', name: '经典玻璃', description: '保留原来的透明玻璃界面。' },
  { id: 'pop', name: '粉白舞台', description: '粉白圆角、半透明对白框和醒目姓名牌。' },
  { id: 'terminal', name: '青绿终端', description: '暗橄榄面板、青绿细框和复古终端按钮。' },
  { id: 'astral', name: '星曜剧场', description: '金色姓名、简洁对白、深蓝面板与明亮卡片。' }
];
export function normalizeGameUi(value) {
  return gameUiPresets.some(preset => preset.id === value) ? value : 'classic';
}
export function gameUiPicker(value) {
  const selected = normalizeGameUi(value);
  return `<div id="game-ui-picker" class="editor-settings-backdrop" role="dialog" aria-modal="true" aria-labelledby="game-ui-heading">
    <div class="editor-settings-card game-ui-picker-card"><header><h2 id="game-ui-heading">选择游戏 UI</h2><button type="button" data-action="close-game-ui">关闭 ×</button></header>
    <p>选择整套外观，标题、对白、存档和设置一起生效。游戏按钮和功能保持原样。</p>
    <div class="game-ui-options">${gameUiPresets.map(preset => `<label class="game-ui-option">
      <input type="radio" name="game-ui-preset" value="${preset.id}" ${preset.id === selected ? 'checked' : ''}>
      <span class="game-ui-sample" data-sample-ui="${preset.id}" aria-hidden="true"><span class="sample-menu">菜单</span><span class="sample-dialogue"><b>说话角色</b><span>让角色走进你的故事。</span></span><span class="sample-controls"><i>自动播放</i><i>读档</i><i>存档</i></span></span>
      <strong>${preset.name}</strong><small>${preset.description}</small>
    </label>`).join('')}</div>
    <footer><span>只改变游戏界面，不改变编辑器外观或场景渲染。</span><button type="button" data-action="apply-game-ui">应用到工程</button></footer></div></div>`;
}

import { field, escape, options, button } from '../../ui/markup.js';

// Read-only markup; editing and asynchronous work belong to the controller.
export function renderTitlePanel({
  title,
  project,
  byType,
  renderSelectionEditor,
  spatialCameraEditor,
  titleActorEditor,
}) {
  return `<div class="inspector-content"><h2>标题画面</h2>
      ${title.logoImageId === '__none__' ? '' : field('游戏名称', `<input id="project-name" value="${escape(project.name)}" aria-label="游戏名称">`)}
      ${field('标题副标题', `<input data-title-field="subtitle" value="${escape(title.subtitle || '')}" placeholder="例如：第一章 / 写给明天的信">`)}
      ${field('Logo 图片', `<select data-title-field="logoImageId"><option value="__none__" ${title.logoImageId === '__none__' ? 'selected' : ''}>不显示（留空）</option>${options(byType('image'), title.logoImageId, '使用游戏名称')}</select>`)}
      <div data-copy-environment>${field('标题场景', `<select data-title-field="environmentId">${options(project.environments || [], title.environmentId, '默认天空')}</select>`)}${button('编辑标题环境（独立窗口）', 'edit-environment')}</div>
      ${field('标题音乐', `<select data-title-field="bgmId">${options(byType('music'), title.bgmId, '无音乐')}</select>`)}
      ${field('按钮点击音效', `<select data-ui-field="clickSoundId">${options(byType('effect'), project.ui.clickSoundId, '使用内置轻提示音')}</select>`)}
      <p class="tip">选“不显示（留空）”后，左边的标题板会全部隐藏。底部菜单照常显示。</p>
      <details><summary>标题画面预设与微调</summary>${renderSelectionEditor(title.render || project.render, 'title')}</details>
      <details class="role-details-render-editor"><summary>角色详情的画面预设与微调</summary>${renderSelectionEditor(project.ui.roleDetailsRender || project.render, 'details')}<p class="tip">只用于角色详情，不改变标题和对白。保存后，在试玩的角色详情中查看效果。</p></details>
      ${spatialCameraEditor('title')}
      <hr><h2>标题人物 (${title.actors.length})</h2>${button('＋ 添加标题人物', 'add-title-actor')}
      <p class="tip">可以添加多个 VRM 或 FBX 人物，每个人分别调整。选择角色后，也能显示他绑定的物品。</p>
      ${title.actors.map(titleActorEditor).join('')}
    </div>`;
}

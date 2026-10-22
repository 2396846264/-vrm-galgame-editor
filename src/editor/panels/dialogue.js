import { escape, field, input, select, button, textarea, options } from '../../ui/markup.js';
import { assetUrl } from '../../platform/asset-url.js';

// Read-only markup; editing and asynchronous work belong to the controller.
export function renderDialoguePanel({
  currentAct,
  current,
  byType,
  asset,
  project,
  weatherEditor,
  selectedStep,
  offstageEditor,
  renderCastRows,
  dialogueVoiceField,
  itemAcquisitionEditor,
  renderSelectionEditor,
  inventoryRows,
}) {
  return `<div class="inspector-content"><details class="act-settings" ${current ? '' : 'open'}><summary>本幕设置 · ${escape(currentAct.name)}</summary>
    ${field('幕名称', input('act.name', currentAct.name))}
    ${field('章节封面', select('act.coverImageId', byType('image'), currentAct.coverImageId, '默认使用背景图'))}
    ${asset(currentAct.coverImageId || currentAct.backgroundId)?.type === 'image' ? `<img class="act-cover-preview" src="${escape(assetUrl(asset(currentAct.coverImageId || currentAct.backgroundId)))}" alt="本幕封面">` : '<p class="tip">还没有封面。建议上传竖图，人物放在图片中央。</p>'}
    <div class="inline-actions">${button('上传本幕封面', 'upload-act-cover')}${button('本幕渲染与调色', 'edit-act-render')}</div>
    <div data-copy-environment>${field('3D 场景', select('act.environmentId', project.environments || [], currentAct.environmentId, '默认天空'))}<div class="inline-actions">${button('编辑环境（独立窗口）', 'edit-environment')}${button('新建场景', 'new-environment')}</div></div>
    ${field('背景音乐', select('act.bgmId', byType('music'), currentAct.bgmId, '无音乐'))}
    ${weatherEditor(currentAct)}
    <div class="inline-actions">${button('删除本幕', 'delete-act', 'class="danger"')}</div>
    </details><hr><h2>第 ${selectedStep + 1} 句对白</h2>
    ${
      current
        ? `
      ${field('说话角色', select('step.characterId', project.characters, current.characterId, '旁白 / 场外说话'))}
      ${field('显示名字', input('step.speaker', current.speaker, '留空时用角色名字'))}
      ${offstageEditor(current)}
    <section class="dialogue-camera-options"><b>本句镜头</b><p class="tip">${current.camera ? '已设置独立镜头' : '沿用之前对白的镜头；本幕开始时使用初始镜头'}</p><div class="inline-actions">${button('镜头 · WASD 调整', 'edit-dialogue-camera')}${current.camera ? button('清除本句镜头', 'clear-dialogue-camera') : ''}</div></section>
      ${field('对白内容', textarea('step.text', current.text, '在这里写台词'))}
      <hr><h3>这一句在场的人物</h3><p class="tip">最多 30 人。空框点击添加角色，已有角色右键调整位置、动作和表情。</p>
      ${renderCastRows(currentAct)}
      ${dialogueVoiceField(current)}
      ${field('本句音效', select('step.seId', byType('effect'), current.seId, '无音效'))}
      <div id="scene-animation-controls"></div>
      ${itemAcquisitionEditor(current)}
      <details class="dialogue-render-editor"><summary>这一句的画面预设与微调</summary>${renderSelectionEditor(current.render || project.render, 'step')}</details>
      <div class="inline-actions">${button('上移', 'move-up')}${button('下移', 'move-down')}${button('删除', 'delete-step', 'class="danger"')}</div>
      <hr><div class="section-heading">选择分支 ${button('＋ 选项', 'add-choice')}</div>
      ${current.choices
        .map(
          (choice, index) => `<div class="choice-editor" data-copy-index="${index}">
        <input data-choice-index="${index}" data-choice-field="text" value="${escape(choice.text)}" placeholder="玩家看到的选项">
        <select data-choice-index="${index}" data-choice-field="actId">${options(project.acts, choice.actId, '选择跳转到哪一幕')}</select>
        <details><summary>所需物品条件</summary>${inventoryRows(choice.requirements, 'requirement', index)}${button('＋ 物品条件', 'add-inventory-condition', `data-choice="${index}"`)}<label class="inventory-consume-toggle"><input type="checkbox" data-choice-consume="${index}" ${choice.consumeRequired ? 'checked' : ''}>选择后扣除所需物品</label><p class="tip">全部条件满足才能选。勾选后扣除上面列出的数量；不勾选只检查持有数量。</p></details>${button('删除选项', 'delete-choice', `data-index="${index}"`)}</div>`,
        )
        .join('')}
    `
        : '<p class="tip">这幕还没有对白。</p>'
    }
    </div>`;
}

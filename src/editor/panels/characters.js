import { field, input, select, escape, button, textarea } from '../../ui/markup.js';
import { characterNameColor } from '../../character-name-color.js';
import { assetUrl } from '../../platform/asset-url.js';
import { motionsForCharacter } from '../../asset-organization.js';

// Read-only markup; editing and asynchronous work belong to the controller.
export function renderCharacterPanel({
  item,
  actorModels,
  motionFitEditor,
  isFbxModel,
  isLiveModel,
  asset,
  project,
  propEditor,
}) {
  return item
    ? `<div class="inspector-content"><h2>角色设置</h2>
      ${field('角色名字', input('character.name', item.name))}
      ${field('姓名颜色', `<input type="color" data-field="character.nameColor" value="${characterNameColor(item)}" aria-label="姓名颜色">`)}
      <p class="tip">每个角色单独设置，跟随对白姓名显示。</p>
      ${field('人物模型', select('character.modelId', actorModels(), item.modelId, '请选择模型'))}
      ${motionFitEditor(item)}
      ${
        !isFbxModel(item.modelId)
          ? `<label class="field"><span>自动说话嘴型</span><select data-field="character.autoMouth"><option value="on" ${item.autoMouth !== false ? 'selected' : ''}>开启（默认）</option><option value="off" ${item.autoMouth === false ? 'selected' : ''}>关闭</option></select></label>
      <p class="tip">跟随对白文字显示动嘴，标点处稍作停顿；文字显示完就停止。有 A、I、U、E、O 嘴型的模型可使用。</p>`
          : '<p class="tip">FBX 人物只播放身体动作。</p>'
      }
      ${isLiveModel(item.modelId) ? '<div class="portrait-editor"><span>说话头像 · 实时模型</span><p class="tip">使用此角色的动态模型头像，动作与模型同步。FBX 不使用表情或嘴型系统；头像位置与大小在 UI 编辑器中统一调整。</p></div>' : `<div class="portrait-editor"><span>说话头像</span>${asset(item.portraitId) ? `<img src="${assetUrl(asset(item.portraitId))}" alt="${escape(item.name)}的头像">` : '<div class="portrait-empty">还没有头像</div>'}<div class="inline-actions">${button('上传 PNG 头像', 'upload-character-portrait')}${isFbxModel(item.modelId) ? button('重新生成 FBX 头像', 'capture-character-portrait') : ''}</div><p class="tip">FBX 使用静态图片头像，可自动生成或手动上传。没有模型的角色仍可上传 PNG。</p></div>`}
      ${field('角色详情待机动作', select('character.detailsIdleId', motionsForCharacter(project, item.id), item.detailsIdleId || '', '自然待机（自动）'))}
      <p class="tip">角色详情使用全身、正面的循环待机，不再设置定格帧。无需额外导入动作，也可以选择自己的待机动作。</p>
      ${propEditor(item)}
      ${field('身份 / 称号', input('character.title', item.title, '例如：旅行者、学生'))}
      ${field('角色简介', textarea('character.description', item.description, '玩家在角色详情里看到的介绍'))}
      <hr><h2>角色故事（最多三段）</h2>
      <p class="tip">留空的故事不会出现在游戏里。解锁数字填 0 时，玩家一开始就能阅读。</p>
      ${item.stories
        .map(
          (story, index) => `<div class="character-story-editor">
        <h3>故事 ${index + 1}</h3>
        ${field('故事内容', `<textarea data-story-index="${index}" data-story-field="text" placeholder="不写就不显示">${escape(story.text)}</textarea>`)}
        ${field('读过这个角色多少句对白后解锁', `<input type="number" min="0" step="1" data-story-index="${index}" data-story-field="unlockLines" value="${Math.max(0, Number(story.unlockLines) || 0)}">`)}
      </div>`,
        )
        .join('')}
      <div class="inline-actions">${button('导入 VRM', 'import', 'data-type="vrm"')}${button('导入 FBX 人物', 'import', 'data-type="fbxCharacter"')}${button('导入 MMD 人物', 'import', 'data-type="mmdCharacter"')}${button('删除角色', 'delete-character', 'class="danger"')}</div>
      <p class="tip">选中角色后，预览里会显示它。表情名称取决于模型本身。</p></div>`
    : '<div class="inspector-content empty">先新增角色</div>';
}

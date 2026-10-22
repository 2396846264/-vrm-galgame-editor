import { escape, field, options, button } from '../../ui/markup.js';
import { motionsForCharacter } from '../../asset-organization.js';
import { preciseTransform } from '../../precise-transform.js';

export function titleActorEditor(
  actor,
  index,
  { character, asset, actorModels, project, motionAdvanced, isFbxModel },
) {
  const role = character(actor.characterId);
  const transforms = [
    ['size', '大小', 50, 500, 5],
    ['offsetX', '左右位置', -100, 100, 0.01],
    ['offsetY', '上下位置', -100, 100, 0.01],
    ['offsetZ', '前后位置', -100, 100, 0.01],
    ['yaw', '左右转身', -360, 360, 0.1],
    ['pitch', '上下转角', -360, 360, 0.1],
  ];
  return `<details class="title-actor-editor" data-copy-id="${actor.id}" open><summary>人物 ${index + 1} · ${escape(asset(actor.modelId)?.name || '未选择模型')}</summary>
    ${field('人物模型', `<select data-title-actor-id="${actor.id}" data-title-actor-field="modelId">${options(actorModels(), actor.modelId, '不显示人物')}</select>`)}
    ${field(
      '使用角色及其物品',
      `<select data-title-actor-id="${actor.id}" data-title-actor-field="characterId">${options(
        project.characters.filter((c) => c.modelId),
        actor.characterId,
        '直接使用模型',
      )}</select>`,
    )}
    ${field('人物动作', `<select data-title-actor-id="${actor.id}" data-title-actor-field="motionId">${options(motionsForCharacter(project, actor.characterId), actor.motionId, '保持站立')}</select>`)}
    ${motionAdvanced(actor, `titleActor:${actor.id}`)}
    ${transforms.map(([key, label, min, max, step]) => preciseTransform(label, key === 'size' ? Math.round(actor.size * 100) : actor[key], min, max, `data-title-actor-id="${actor.id}" data-title-actor-adjust="${key}"`, '', key === 'size' ? ' (%)' : '', step)).join('')}
    ${role?.modelId === actor.modelId ? (role.props || []).map((prop) => `<label class="motion-option-row"><span>显示 ${escape(prop.name)}</span><input type="checkbox" data-title-actor-id="${actor.id}" data-title-actor-prop="${prop.id}" ${actor.props.includes(prop.id) ? 'checked' : ''}></label>`).join('') : ''}
    ${actor.modelId && !isFbxModel(actor.modelId) ? `<h3>人物表情</h3><div data-title-actor-expressions="${actor.id}" class="expression-controls"></div>` : ''}
    ${button('删除这个标题人物', 'delete-title-actor', `data-id="${actor.id}"`)}
  </details>`;
}

import { normalizeMotionFit } from '../../motion-fit.js';
import { field, escape, button, options } from '../../ui/markup.js';
import { editorLabel } from '../../editor-language.js';
import { motionsForCharacter } from '../../asset-organization.js';
import { propBoneLabels } from '../../character-props.js';

export function motionFitEditor(item, { project }) {
  const id = item.fitPreviewMotionId || '',
    own = item.motionFitOverrides?.[id],
    s = normalizeMotionFit(own || item.motionFit);
  const slider = (key, label, min, max, step, value) =>
    field(
      label,
      `<div class="npr-slider"><input type="range" data-motion-fit="${key}" min="${min}" max="${max}" step="${step}" value="${value}"><output data-motion-fit-output="${key}">${value}</output></div>`,
    );
  return `<details class="motion-fit-editor" open><summary>${editorLabel('动作适配与 Mixamo')}</summary>
 ${field(
   '测试动作',
   `<select data-fit-preview><option value="">${editorLabel('自然待机')}</option>${motionsForCharacter(
     project,
     item.id,
   )
     .map(
       (m) =>
         `<option value="${escape(m.id)}" ${id === m.id ? 'selected' : ''}>${escape(m.name)}</option>`,
     )
     .join('')}</select>`,
 )}
 ${id ? `<div class="inline-actions">${button('暂停 / 继续', 'fit-preview-play')}</div><label class="field"><span>${editorLabel('检查动作帧')}</span><input type="range" data-fit-frame min="1" max="1" value="1"><output data-fit-frame-output>1</output></label>` : ''}
 <p class="tip">${editorLabel(own ? '正在调整当前动作的独立设置。' : '正在调整此角色的默认设置。')}</p>
 ${field('头发与裙摆自动防穿模', `<select data-secondary-collision><option value="on" ${item.secondaryCollision !== false ? 'selected' : ''}>${editorLabel('开启（默认）')}</option><option value="off" ${item.secondaryCollision === false ? 'selected' : ''}>${editorLabel('关闭')}</option></select>`)}
 <p class="tip">自动保护头颈、肩背和腿部，保留模型原有物理。需要模型具有独立的头发或裙摆物理骨骼。</p>
 ${field('双手防穿模', `<select data-motion-fit="enabled"><option value="on" ${s.enabled ? 'selected' : ''}>${editorLabel('开启')}</option><option value="off" ${!s.enabled ? 'selected' : ''}>${editorLabel('关闭')}</option></select>`)}
 ${slider('strength', '修正强度', 0, 100, 1, Math.round(s.strength * 100))}${slider('clearance', '身体安全间距（厘米）', 0, 8, 0.5, Math.round(s.clearance * 1000) / 10)}${slider('bodyScale', '身体包络大小（百分比）', 65, 150, 1, Math.round(s.bodyScale * 100))}
 <div class="inline-actions">${id ? button(own ? '恢复角色默认适配' : '为此动作单独适配', own ? 'fit-motion-reset' : 'fit-motion-own') : ''}${button('重置动作适配', 'fit-reset')}</div>
 <p class="tip">自动估算身体范围，修正手腕与前臂。衣摆和头发保留原有物理。抱胸、摸脸或持物动作可单独减弱或关闭。原生 VMD 保持原动作。</p>
 <div class="inline-actions">${button('导出 Mixamo 白模（FBX）', 'export-mixamo-white', item.modelId ? '' : 'disabled')}${button('导出兼容白模（OBJ）', 'export-mixamo-obj', item.modelId ? '' : 'disabled')}</div>
 <p class="tip">FBX 使用 2013 兼容格式并保留骨骼。若网站仍提示骨骼映射失败，请上传 OBJ 白模，按提示标记关节后由 Mixamo 自动绑骨。</p>
 <p class="tip">导出当前体型的 T 姿势、白色蒙皮和 Mixamo 骨骼，不包含贴图、表情或物理。上传 Mixamo 调整后，下载 FBX Binary、Without Skin，作为动作导回此角色。</p></details>`;
}

export function propEditor(item, { byType, bones }) {
  const choices = bones.length
    ? bones
    : Object.entries(propBoneLabels).map(([value, label]) => ({ value, label }));
  return `<section class="prop-editor"><h2>绑定物品</h2><p class="tip">先导入 GLB，添加物品，再选手或其他骨骼。角色页会显示所有已绑定物品，方便调整；对白里勾选后才会显示。</p><div class="inline-actions">${button('导入物品 GLB', 'import-prop-model')}${button('＋ 添加物品', 'add-character-prop')}${item.props?.length ? button('调整视角与物品', 'binding-view-open') : ''}</div>${(
    item.props || []
  )
    .map(
      (
        prop,
        index,
      ) => `<details class="prop-binding" data-copy-id="${escape(prop.id)}" ${index === 0 ? 'open' : ''}><summary>${escape(prop.name || '物品')}</summary>
    ${field('物品名称', `<input data-prop-field="name" data-prop-id="${escape(prop.id)}" value="${escape(prop.name)}">`)}
    ${field('物品模型', `<select data-prop-field="assetId" data-prop-id="${escape(prop.id)}">${options(byType('sceneModel'), prop.assetId, '请选择 GLB')}</select>`)}
    ${field('绑定骨骼', `<select data-prop-field="bone" data-prop-id="${escape(prop.id)}">${choices.map((b) => `<option value="${escape(b.value)}" ${b.value === prop.bone ? 'selected' : ''}>${escape(b.label)}</option>`).join('')}${!choices.some((b) => b.value === prop.bone) ? `<option selected value="${escape(prop.bone)}">${escape(prop.bone)}（等待模型读取）</option>` : ''}</select>`)}
    <div class="inline-actions">${button('放大绑定部位', 'binding-view-bone', `data-prop-id="${escape(prop.id)}"`)}${button('看物品', 'binding-view-item', `data-prop-id="${escape(prop.id)}"`)}</div>
    ${['position', 'rotation', 'scale']
      .map(
        (kind, i) =>
          `<details class="prop-vector" ${i === 0 ? 'open' : ''}><summary>${['位置（米）', '旋转（度）', '缩放'][i]}</summary>${prop[
            kind
          ]
            .map((value, axis) => {
              const lower = kind === 'scale' ? 0.001 : kind === 'rotation' ? -180 : -2,
                upper = kind === 'scale' ? 5 : kind === 'rotation' ? 180 : 2;
              const data = `data-prop-transform="${escape(prop.id)}" data-vector="${kind}" data-axis="${axis}"`;
              return `<div class="prop-axis" data-prop-axis="${escape(prop.id)}.${kind}.${axis}"><label class="prop-number"><span>${['X · 左右', 'Y · 上下', 'Z · 前后'][axis]}</span><input type="number" ${data} data-mode="number" min="${kind === 'scale' ? 0.001 : -10000}" max="10000" step="${kind === 'rotation' ? 0.1 : 0.001}" value="${Number(value.toFixed(5))}"></label><label><span>细调</span><input type="range" ${data} data-mode="fine" min="-100" max="100" step="1" value="0"></label></div>`;
            })
            .join('')}</details>`,
      )
      .join(
        '',
      )}<p class="tip">细调一次：位置 0.001 米、旋转 0.1 度、缩放 0.001。松开细调滑块后会回到中间，保留修改结果。模型先按最长边约 0.8 米摆放。</p>${button('移除这个绑定', 'remove-character-prop', `data-prop-id="${escape(prop.id)}" class="danger"`)}</details>`,
    )
    .join('')}</section>`;
}

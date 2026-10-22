import { renderSelection } from '../../render-presets.js';
import { field, escape, button } from '../../ui/markup.js';
import { helpLabel } from '../../render-help.js';
import { colorAdjustments, filterGroups, customFilterSpecs } from '../../render-style.js';
import { editorLabel } from '../../editor-language.js';
import { normalizeSpatialCamera } from '../../spatial-camera.js';

export function renderSelectionEditor(value, scope, { project }) {
  const choice = renderSelection(value),
    attr = `data-render-scope="${scope}"`;
  return `${field(helpLabel('画面预设', 'preset'), `<select data-render-selection ${attr}><option value="">原始画面（不使用预设）</option>${project.renderPresets.map((p) => `<option value="${escape(p.id)}" ${p.id === choice.presetId ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select>`)}<p class="tip">详细滤镜在渲染编辑器中制作，这里只选择预设和微调。</p><h3>画面微调</h3>${Object.keys(
    colorAdjustments,
  )
    .map((key) =>
      field(
        helpLabel({ brightness: '亮度', contrast: '对比度', saturation: '饱和度' }[key], key),
        `<div class="npr-slider"><input type="range" data-render-calibration="${key}" ${attr} min="0" max="200" step="1" value="${choice[key]}"><input type="number" data-render-calibration="${key}" ${attr} min="0" max="200" step="1" value="${choice[key]}" aria-label="${key}"></div>`,
      ),
    )
    .join('')}`;
}

export function renderPresetEditor(entry, {}) {
  if (!entry)
    return `<div class="render-preset-empty"><p>在这里制作可以重复使用的画面预设。</p>${button('＋ 新建渲染预设', 'add-render-preset')}</div>`;
  const settings = entry.settings;
  return `${field(helpLabel('预设名称', 'presetName'), `<input class="render-preset-name" data-render-preset-name value="${escape(entry.name)}" maxlength="100">`)}<div class="inline-actions">${button('复制预设', 'duplicate-render-preset')}${button('删除预设', 'delete-render-preset', 'class="danger"')}</div><p class="render-preset-help">调整会保存到这个预设。选用它的对白、标题会同步更新；左侧参考镜头仅用于预览。</p><h3>预设基础调色</h3>${Object.keys(
    colorAdjustments,
  )
    .map((key) =>
      field(
        helpLabel({ brightness: '亮度', contrast: '对比度', saturation: '饱和度' }[key], key),
        `<div class="npr-slider"><input type="range" data-preset-color="${key}" min="0" max="200" step="1" value="${settings[key]}"><input type="number" data-preset-color="${key}" min="0" max="200" step="1" value="${settings[key]}"></div>`,
      ),
    )
    .join('')}${Object.entries(filterGroups)
    .map(
      ([group, name]) =>
        `<details class="npr-filter-group"><summary>${editorLabel(name)}</summary>${group === 'depth' ? `<p class="tip">焦点附近清晰，前后逐渐虚化。</p>${button('按画面人物对焦', 'dof-focus', 'data-render-scope="preset"') + helpLabel('', 'focus')}` : ''}${customFilterSpecs
          .filter((spec) => spec[6] === group)
          .map(([key, label, min, max, step]) =>
            field(
              helpLabel(label, key),
              min === 'color'
                ? `<input type="color" data-preset-filter="${key}" value="${settings.filters[key]}">`
                : `<div class="npr-slider"><input type="range" data-preset-filter="${key}" min="${min}" max="${max}" step="${step}" value="${settings.filters[key]}"><input type="number" data-preset-filter="${key}" min="${min}" max="${max}" step="${step}" value="${settings.filters[key]}"></div>`,
            ),
          )
          .join('')}</details>`,
    )
    .join('')}`;
}

export function spatialCameraEditor(scope, { project }) {
  const value = normalizeSpatialCamera(
    scope === 'title' ? project.title.spatialCamera : project.ui.spatialCamera,
  );
  return `<details class="spatial-camera-editor"><summary>${scope === 'title' ? '标题' : '对白'}空间镜头</summary>${field(helpLabel('鼠标轻微跟随', 'spatialEnabled'), `<select data-spatial-camera="enabled" data-spatial-scope="${scope}"><option value="off" ${!value.enabled ? 'selected' : ''}>关闭</option><option value="on" ${value.enabled ? 'selected' : ''}>开启</option></select>`)}${field(helpLabel('跟随强度', 'spatialStrength'), `<div class="npr-slider"><input type="range" data-spatial-camera="strength" data-spatial-scope="${scope}" min="0" max="100" step="1" value="${Math.round(value.strength * 100)}"><input type="number" data-spatial-camera="strength" data-spatial-scope="${scope}" min="0" max="100" step="1" value="${Math.round(value.strength * 100)}" aria-label="跟随强度百分比"></div>`)}<p class="tip">鼠标移动时，三维镜头轻微摆动。${scope === 'title' ? '只用于标题界面。' : '用于整个工程的对白画面。'}文字和按钮不跟着移动。</p></details>`;
}

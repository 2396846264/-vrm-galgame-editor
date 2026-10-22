import { escape, options, field, select, button } from '../../ui/markup.js';
import { offstageSettings } from '../../offstage-motion.js';
import { motionsForCharacter } from '../../asset-organization.js';
import { preciseTransform } from '../../precise-transform.js';
import { editorLabel } from '../../editor-language.js';
import { voicesForCharacter } from '../../dialogue-voices.js';
import { normalizeWeather, weatherNames } from '../../weather.js';

export function motionAdvanced(holder, scope, { motionOptionsOf }) {
  const settings = motionOptionsOf(holder);
  const loop = settings.loop !== false;
  const start = Math.max(1, Math.floor(Number(settings.startFrame) || 1));
  const end = Number(settings.endFrame) > 0 ? Math.floor(Number(settings.endFrame)) : '';
  return `<details class="motion-advanced"><summary>高级动作选项</summary><div class="motion-advanced-body">
    <label class="motion-option-row"><span>循环播放</span><select data-motion-options="${escape(scope)}" data-motion-setting="loop">
      <option value="true" ${loop ? 'selected' : ''}>是（默认）</option><option value="false" ${loop ? '' : 'selected'}>否，只播一次</option></select></label>
    <label class="motion-option-row"><span>动作走位</span><select data-motion-options="${escape(scope)}" data-motion-setting="placement">
      <option value="free" ${['bounded', 'inPlace'].includes(settings.placement) ? '' : 'selected'}>跟随动作移动（连续）</option>
      <option value="inPlace" ${['bounded', 'inPlace'].includes(settings.placement) ? 'selected' : ''}>原地播放</option></select></label>
    <p class="tip">连续移动不会在每轮动作结束时跳回起点。原地播放保留抬腿、跳跃和坐下等身体动作。</p>
    <label class="motion-option-row"><span>脚掌固定</span><select data-motion-options="${escape(scope)}" data-motion-setting="feet">
      <option value="free" ${!['auto', 'lock'].includes(settings.feet) ? 'selected' : ''}>跟随动作（走路、跳跃）</option>
      <option value="lock" ${settings.feet === 'lock' ? 'selected' : ''}>固定双脚（待机、站立）</option>
      <option value="auto" ${settings.feet === 'auto' ? 'selected' : ''}>自动（待机、说话时固定）</option></select></label>
    <p class="tip">脚掌有轻微漂移时可选“固定双脚”。行走、跳跃等动作请选“跟随动作”，保留正常抬脚。</p>
    <div class="motion-frame-row"><label><span>起始帧</span><input type="number" min="1" step="1" value="${start}"
      data-motion-options="${escape(scope)}" data-motion-setting="startFrame"></label>
      <label><span>结束帧</span><input type="number" min="1" step="1" value="${end}" placeholder="最后一帧"
      data-motion-options="${escape(scope)}" data-motion-setting="endFrame"></label></div>
    <p class="tip" data-motion-hint="${escape(scope)}">第 1 帧是动作开头，结束帧留空会播到最后。</p>
    <label class="motion-option-row"><span>播完后</span><select data-motion-options="${escape(scope)}" data-motion-setting="after" ${loop ? 'disabled' : ''}>
      <option value="hold" ${settings.after === 'idle' ? '' : 'selected'}>停在最后一帧</option>
      <option value="idle" ${settings.after === 'idle' ? 'selected' : ''}>${scope === 'step' ? '平滑回到本幕动作' : '平滑回到默认动作'}</option></select></label>
  </div></details>`;
}

export function offstageEditor(line, { character, isLiveModel, project, motionAdvanced }) {
  const role = character(line.characterId);
  if (
    !isLiveModel(role?.modelId) ||
    Object.values(line.cast || {}).some((c) => c.characterId === line.characterId)
  )
    return '';
  const off = offstageSettings(line);
  return `<section class="offstage-motion-editor"><b>场外头像动作</b><p class="tip">人物不上场时，模型在缓存中隐藏，所选动作仍会反映在可动头像上。</p><select data-offstage-motion>${options(motionsForCharacter(project, line.characterId), off.motionId, '自然待机')}</select>${motionAdvanced(off, 'offstage')}</section>`;
}

export function castEditor(
  currentAct,
  slot,
  {
    castSettingsOf,
    step,
    castSlotLabels,
    character,
    project,
    motionAdvanced,
    defaultSize,
    isFbxModel,
    asset,
  },
) {
  const settings = castSettingsOf(currentAct, slot);
  const actorId = settings.characterId;
  const slider = (key, label, value, min, max, stepSize, unit = '') =>
    preciseTransform(
      label,
      value,
      key.startsWith('offset') ? -100 : key === 'yaw' || key === 'pitch' ? -360 : min,
      key.startsWith('offset') ? 100 : key === 'yaw' || key === 'pitch' ? 360 : max,
      `data-cast-adjust="${slot}.${key}"`,
      `data-cast-output="${slot}.${key}"`,
      unit,
      key === 'yaw' || key === 'pitch' ? 0.1 : key === 'size' ? 0.1 : 0.01,
    );
  return `<details class="cast-editor" ${actorId && actorId === step()?.characterId ? 'open' : ''}><summary>${editorLabel(castSlotLabels[slot])} · ${character(actorId)?.name ? escape(character(actorId).name) : editorLabel('未选择')}</summary>
    <div class="cast-editor-body">
      ${field(
        '角色',
        `<select data-cast-slot="${slot}">${options(
          project.characters.filter((item) => item.modelId || item.id === actorId),
          actorId,
          '此位置无人',
        )}</select>`,
      )}
      ${
        actorId
          ? `${field('这一句的动作', `<select data-cast-motion="${slot}">${options(motionsForCharacter(project, actorId), settings.motionId, '保持站立')}</select>`)}
        ${motionAdvanced(settings, `cast:${slot}`)}
        ${slider('size', '大小', Math.round((settings.size ?? defaultSize) * 100), 50, 250, 5, '%')}
        ${slider('offsetX', '左右', Number(settings.offsetX) || 0, -1.5, 1.5, 0.05)}
        ${slider('offsetY', '上下', Number(settings.offsetY) || 0, -3, 2, 0.05)}
        ${slider('offsetZ', '前后', Number(settings.offsetZ) || 0, -100, 100, 0.1)}
        ${slider('yaw', '转身角度', Number(settings.yaw) || 0, -360, 360, 0.1, '°')}
        ${slider('pitch', '俯仰角度', Number(settings.pitch) || 0, -360, 360, 0.1, '°')}
${!isFbxModel(character(actorId)?.modelId) ? `<div class="field"><span>这一句的表情</span><div id="cast-expression-${slot}" class="expression-controls"></div></div>` : ''}<div class="dialogue-props"><b>这一句显示的物品</b>${(character(actorId)?.props || []).map((prop) => `<label><input type="checkbox" data-cast-prop="${slot}" data-prop-id="${escape(prop.id)}" ${(settings.props || []).includes(prop.id) ? 'checked' : ''}>${escape(prop.name || asset(prop.assetId)?.name || '物品')}</label>`).join('') || '<small>先到角色页绑定物品。</small>'}</div>`
          : ''
      }
    </div></details>`;
}

export function renderCastRows({ castSlots, step, castSlotLabels, castAvatar }) {
  return `<p class="tip">左键选择头像，右键设置人物。每行 3 个，共 10 行。</p><div class="cast-avatar-grid">${castSlots
    .map((slot) => {
      const id = step()?.cast?.[slot]?.characterId;
      return `<button type="button" class="cast-avatar-slot ${id ? 'occupied' : ''}" data-cast-cell="${slot}" aria-label="${escape(castSlotLabels[slot])}${id ? '：已有人物' : '：空位'}">${id ? castAvatar(id) : ''}</button>`;
    })
    .join('')}</div>`;
}

export function dialogueVoiceField(current, { character, project }) {
  const role = character(current.characterId);
  const voices = voicesForCharacter(project, current.characterId);
  return `<div class="field dialogue-voice-field"><span>角色配音${role ? ` · ${escape(role.name)}` : ''}</span>
    ${select('step.voiceId', voices, current.voiceId, role ? '无配音（仅显示这个角色的配音）' : '请先选择这句对白的角色')}
    <div class="dialogue-voice-tools">${button(current.voiceId ? '上传新配音' : '上传配音', 'upload-dialogue-voice')}
    ${button('▶ 试听', 'preview-dialogue-voice', current.voiceId ? '' : 'disabled')}
    ${button('移除绑定', 'remove-dialogue-voice', current.voiceId ? '' : 'disabled')}</div>
    <p class="tip">只在这句对白上传。文件自动放入角色专属文件夹，并用对白全文命名。</p></div>`;
}

export function inventoryRows(rows, kind, index = '', { readyItems }) {
  return `<div class="inventory-rows">${(rows || []).map((row, i) => `<div class="inventory-rule-row"><select data-inventory-row="${kind}" data-choice="${index}" data-row="${i}" data-key="itemId">${options(readyItems(), row.itemId, '选择物品')}${row.itemId && !readyItems().some((item) => item.id === row.itemId) ? `<option selected value="${escape(row.itemId)}">物品已删除或未填写完整</option>` : ''}</select><input type="number" min="1" max="1000000" step="1" aria-label="物品数量" value="${row.quantity}" data-inventory-row="${kind}" data-choice="${index}" data-row="${i}" data-key="quantity">${button('删除', 'remove-inventory-row', `data-kind="${kind}" data-choice="${index}" data-row="${i}"`)}</div>`).join('')}</div>`;
}

export function itemAcquisitionEditor(line, { inventoryRows }) {
  return `<details class="inventory-dialogue-editor"><summary>这一句获得的物品</summary>${inventoryRows(line.itemGrants, 'grant')}${button('＋ 获得物品', 'add-inventory-grant')}<p class="tip">对白显示完后，额外显示“玩家获得了物品 × 数量”和正方形立绘。同一存档中这句不会重复发放。</p></details>`;
}

export function weatherEditor(chapter, { byType }) {
  const w = normalizeWeather(chapter.weather);
  const slider = (key, label, min = 0, max = 100) =>
    field(
      label,
      `<input type="range" data-weather="${key}" min="${min}" max="${max}" step="1" value="${Math.round(w[key] * 100)}"><output data-weather-output="${key}">${Math.round(w[key] * 100)}%</output>`,
    );
  const toggle = (key, label) =>
    `<label class="weather-toggle"><input type="checkbox" data-weather="${key}" ${w[key] ? 'checked' : ''}><span>${editorLabel(label)}</span></label>`;
  return `<section class="weather-editor"><h3>本幕天气</h3>
    ${field(
      '天气',
      `<select data-weather="type">${Object.entries(weatherNames)
        .map(
          ([key, name]) =>
            `<option value="${key}" ${w.type === key ? 'selected' : ''}>${editorLabel(name)}</option>`,
        )
        .join('')}</select>`,
    )}
    ${
      w.type !== 'none'
        ? `${slider('intensity', '天气强度')}
    ${slider('wind', '风速')}
    ${field('风向', `<select data-weather="direction"><option value="1" ${w.direction === 1 ? 'selected' : ''}>向右吹 →</option><option value="-1" ${w.direction === -1 ? 'selected' : ''}>向左吹 ←</option></select>`)}
    ${w.type === 'rain' ? `${toggle('splashes', '显示地面水花与细小涟漪')}${w.splashes ? slider('ground', '地面起点（上 → 下）', 20) : ''}` : ''}
    ${w.type === 'sunny' ? slider('sunX', '阳光位置（左 → 右）') : ''}
    ${toggle('windMotion', '风吹动模型的头发与衣物（模型需要支持）')}
    ${toggle('atmosphere', '柔和光束 / 空气薄雾')}${toggle('autoMood', '天气自动配色与人物配光')}
    ${field(
      '天气声音',
      `<select data-weather="soundId"><option value="">静音</option><option value="auto" ${w.soundId === 'auto' ? 'selected' : ''}>内置雨声 / 风声</option>${byType(
        'effect',
      )
        .map(
          (a) =>
            `<option value="${escape(a.id)}" ${w.soundId === a.id ? 'selected' : ''}>${escape(a.name)}</option>`,
        )
        .join('')}</select>`,
    )}
    ${slider('volume', '天气音量')}
    <p class="tip">只改变这一幕。雨雪有远近层次；水花请对准背景的地面，室内可以关闭水花。预览不播放天气声，试玩会播放；声音跟随游戏设置中的音效音量。</p>`
        : '<p class="tip">当前没有天气。选择天气后，可以马上在中间预览。</p>'
    }
    </section>`;
}

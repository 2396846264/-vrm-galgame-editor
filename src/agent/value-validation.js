import { emptyDialogueCast, dialogueSlots } from '../dialogue-cast.js';
import { normalizeEvent } from '../events/schema.js';
import { motionsForCharacter } from '../asset-organization.js';
import { modelTypes, projectAgentFields } from './project-schema.js';
import {
  keys,
  text,
  num,
  bool,
  array,
  ref,
  objectRef,
  audio,
  weights,
  playback,
} from './validation.js';
import { validateAgentCombat } from './combat-validation.js';

export function actor(p, v, current = {}) {
  keys(v, projectAgentFields.titleActor, '场上人物');
  const result = { ...current, ...structuredClone(v) };
  if (v.characterId !== undefined) objectRef(p.characters, v.characterId, '角色');
  if (v.modelId !== undefined) ref(p, v.modelId, modelTypes, '人物');
  if (v.motionId !== undefined) ref(p, v.motionId, ['motion'], '动作');
  if (v.motionOptions !== undefined) result.motionOptions = playback(v.motionOptions);
  if (v.expressionWeights !== undefined) result.expressionWeights = weights(v.expressionWeights);
  for (const k of ['offsetX', 'offsetY', 'offsetZ'])
    if (v[k] !== undefined) num(v[k], -100, 100, k);
  for (const k of ['yaw', 'pitch']) if (v[k] !== undefined) num(v[k], -36000, 36000, k);
  if (v.size !== undefined) num(v.size, 0.0001, 100, '人物缩放');
  if (result.props) {
    const role = p.characters.find((r) => r.id === result.characterId);
    array(result.props, 100, '绑定物品').forEach((id) => {
      if (!id) throw Error('物品 ID 为空');
      objectRef(role?.props || [], id, '绑定物品');
    });
  }
  if (
    result.motionId &&
    !motionsForCharacter(p, result.characterId).some((m) => m.id === result.motionId)
  )
    throw Error('动作不在该角色或通用动作文件夹');
  return result;
}

export function cast(p, v, current) {
  keys(v, dialogueSlots, '30 人位置');
  const result = structuredClone(current || emptyDialogueCast());
  for (const [slot, value] of Object.entries(v)) {
    keys(
      value,
      projectAgentFields.titleActor.filter((k) => k !== 'modelId'),
      '对白人物',
    );
    result[slot] = actor(p, value, result[slot]);
  }
  const seen = new Set();
  for (const row of Object.values(result))
    if (row.characterId) {
      if (seen.has(row.characterId)) throw Error('同一角色不能重复站在两个位置');
      seen.add(row.characterId);
    }
  return result;
}

export function event(p, v) {
  const fields = [
    'type',
    'title',
    'body',
    'imageId',
    'videoId',
    'backgroundId',
    'bgmId',
    'seId',
    'voiceId',
    'paperName',
    'date',
    'quote',
    'buttonText',
    'countryA',
    'countryB',
    'flagAId',
    'flagBId',
    'burst',
    'declarations',
    'burstInterval',
    'combat',
  ];
  keys(v, fields, '事件');
  if (v.type !== undefined && !['news', 'war', 'major', 'cutscene', 'aircombat'].includes(v.type))
    throw Error('事件类型无效');
  for (const k of ['imageId', 'backgroundId', 'flagAId', 'flagBId'])
    if (v[k] !== undefined) ref(p, v[k], ['image'], '事件图片');
  if (v.videoId !== undefined) {
    ref(p, v.videoId, ['video'], '过场视频');
    if (v.videoId && !/\.mp4$/i.test(p.assets.find((a) => a.id === v.videoId).path || ''))
      throw Error('过场只支持 MP4');
  }
  if (v.bgmId !== undefined) audio(p, v.bgmId, 'music');
  for (const k of ['seId', 'voiceId']) if (v[k] !== undefined) audio(p, v[k], 'effect');
  if (v.burst !== undefined) bool(v.burst, 'burst');
  if (v.burstInterval !== undefined) num(v.burstInterval, 0.12, 3, '连发间隔');
  if (v.declarations !== undefined)
    array(v.declarations, 59, '宣战消息').forEach((row) => {
      keys(row, ['countryA', 'countryB', 'flagAId', 'flagBId', 'body'], '宣战消息');
      for (const k of ['flagAId', 'flagBId'])
        if (row[k] !== undefined) ref(p, row[k], ['image'], '国旗');
      for (const k of ['countryA', 'countryB', 'body']) if (row[k] !== undefined) text(row[k], k);
    });
  if (v.combat !== undefined) validateAgentCombat(p, v.combat);
  for (const k of fields.filter(
    (k) => !k.endsWith('Id') && !['burst', 'declarations', 'burstInterval', 'combat'].includes(k),
  ))
    if (v[k] !== undefined) text(v[k], k);
  return normalizeEvent(v);
}

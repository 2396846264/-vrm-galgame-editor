import { renderSelection } from '../render-presets.js';
import { normalizeCombat } from '../aircombat-schema.js';

export const eventNames = {
  news: '一般新闻',
  war: '宣战消息',
  major: '重大事件',
  cutscene: '过场动画',
  aircombat: '空战幕',
};
export const eventSeconds = { news: 3, war: 0, major: 10, cutscene: 0, aircombat: 0 };
export const isEvent = (node) => node?.kind === 'event';
export function normalizeEvent(value = {}) {
  const type = Object.hasOwn(eventNames, value.type) ? value.type : 'news';
  return {
    type,
    title: '',
    body: '',
    imageId: '',
    videoId: '',
    backgroundId: '',
    bgmId: '',
    seId: '',
    voiceId: '',
    paperName: '世界新闻',
    date: '',
    quote: '',
    buttonText: '继续',
    countryA: '',
    countryB: '',
    flagAId: '',
    flagBId: '',
    burst: false,
    declarations: [],
    burstInterval: 0.22,
    ...value,
    type,
    ...(type === 'aircombat'
      ? {
          combat: normalizeCombat(value.combat),
          ...(value.render ? { render: renderSelection(value.render) } : {}),
        }
      : {}),
    burstInterval: Math.max(0.12, Math.min(3, Number(value.burstInterval) || 0.22)),
    declarations: Array.isArray(value.declarations)
      ? value.declarations.slice(0, 59).map((row) => ({
          countryA: '',
          countryB: '',
          flagAId: '',
          flagBId: '',
          body: '',
          ...row,
        }))
      : [],
  };
}
export function newEvent(id, stepId) {
  return {
    id,
    kind: 'event',
    name: '新事件',
    event: normalizeEvent(),
    cast: {},
    castSettings: {},
    steps: [{ id: stepId, text: '', speaker: '', characterId: '', choices: [] }],
  };
}

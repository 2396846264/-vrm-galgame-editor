import { customFilterSpecs } from '../render-style.js';
import { presetSettings, renderSelection } from '../render-presets.js';
import { motionPlayback } from '../character-motion.js';
import { normalizeSpatialCamera } from '../spatial-camera.js';
import { itemDefinitionReady } from '../inventory.js';

export const plain = (v) => v && typeof v === 'object' && !Array.isArray(v),
  own = (v, k) => Object.hasOwn(v, k);

export function keys(v, allowed, label) {
  if (!plain(v) || Object.keys(v).some((k) => !allowed.includes(k)))
    throw Error(label + '含有不支持的字段');
}

export function text(v, label, max = 10000) {
  if (typeof v !== 'string' || v.length > max) throw Error(label + '需要文本，最多 ' + max + ' 字');
  return v;
}

export function num(v, lo, hi, label) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi)
    throw Error(label + '范围为 ' + lo + ' ～ ' + hi);
  return v;
}

export function bool(v, k) {
  if (typeof v !== 'boolean') throw Error(k + '需要 true 或 false');
  return v;
}

export function array(v, max, label) {
  if (!Array.isArray(v) || v.length > max) throw Error(label + '需要最多 ' + max + ' 项的列表');
  return v;
}

export function ref(p, id, types, label) {
  if (
    typeof id !== 'string' ||
    (id && !p.assets.some((a) => a.id === id && types.includes(a.type)))
  )
    throw Error(label + '素材不存在或类型不匹配');
  return id;
}

export function objectRef(list, id, label) {
  if (typeof id !== 'string' || (id && !list.some((o) => o.id === id)))
    throw Error(label + ' ID 不存在');
  return id;
}

export function audio(p, id, kind) {
  ref(p, id, ['audio'], kind);
  if (id && p.assets.find((a) => a.id === id).audioKind !== kind) throw Error('音乐和音效不能混用');
}

export function weights(v) {
  keys(
    v,
    Object.keys(v || {}).filter((k) => !['__proto__', 'constructor', 'prototype'].includes(k)),
    '表情',
  );
  if (Object.keys(v).length > 300) throw Error('表情过多');
  for (const [k, n] of Object.entries(v)) {
    text(k, '表情名称', 200);
    num(n, 0, 1, '表情权重');
  }
  return structuredClone(v);
}

export function playback(v) {
  keys(v, ['loop', 'startFrame', 'endFrame', 'after', 'placement', 'feet'], '动作播放');
  for (const k of ['startFrame', 'endFrame'])
    if (v[k] != null) {
      num(v[k], 1, 1e8, k);
      if (!Number.isInteger(v[k])) throw Error('动作帧应为整数');
    }
  if (v.loop !== undefined) bool(v.loop, 'loop');
  for (const [k, values] of Object.entries({
    after: ['idle', 'hold'],
    placement: ['inPlace', 'free', 'bounded'],
    feet: ['auto', 'free', 'lock'],
  }))
    if (v[k] !== undefined && !values.includes(v[k])) throw Error('动作 ' + k + ' 无效');
  if (v.endFrame && v.endFrame < (v.startFrame || 1)) throw Error('结束帧不能小于起始帧');
  return motionPlayback(v);
}

export function selection(p, v) {
  keys(v, ['presetId', 'brightness', 'contrast', 'saturation'], '画面选择');
  if (v.presetId !== undefined) objectRef(p.renderPresets || [], v.presetId, '渲染预设');
  for (const key of ['brightness', 'contrast', 'saturation'])
    if (v[key] !== undefined) num(v[key], 0, 200, key);
  return renderSelection(v);
}

export function settings(v) {
  keys(
    v,
    ['schemaVersion', 'preset', 'strength', 'brightness', 'contrast', 'saturation', 'filters'],
    '渲染设置',
  );
  for (const key of ['brightness', 'contrast', 'saturation'])
    if (v[key] !== undefined) num(v[key], 0, 200, key);
  if (v.filters) {
    keys(
      v.filters,
      customFilterSpecs.map((s) => s[0]),
      '滤镜',
    );
    for (const [k, value] of Object.entries(v.filters)) {
      const spec = customFilterSpecs.find((s) => s[0] === k);
      if (spec[2] === 'color') {
        if (typeof value !== 'string' || !/^#[a-f\d]{6}$/i.test(value))
          throw Error('颜色应为 #RRGGBB');
      } else num(value, spec[2], spec[3], k);
    }
  }
  return presetSettings(v);
}

export function spatial(v) {
  keys(v, ['enabled', 'strength'], '空间镜头');
  if (v.enabled !== undefined) bool(v.enabled, 'enabled');
  if (v.strength !== undefined) num(v.strength, 0, 1, '跟随强度');
  return normalizeSpatialCamera(v);
}

export function itemRows(p, v) {
  return array(v, 200, '物品数量').map((row) => {
    keys(row, ['itemId', 'quantity'], '物品条件');
    if (!row.itemId) throw Error('请指定物品');
    objectRef(p.items || [], row.itemId, '物品');
    if (
      !itemDefinitionReady(
        p.items.find((i) => i.id === row.itemId),
        p.assets,
      )
    )
      throw Error('物品需要名字、立绘和介绍后才可用于对白或条件');
    num(row.quantity, 1, 1e6, '物品数量');
    if (!Number.isInteger(row.quantity)) throw Error('物品数量应为整数');
    return structuredClone(row);
  });
}

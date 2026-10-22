import { normalizeWarship, validateWarship } from '../warship-schema.js';
import { navalParts } from '../naval-kit.js';
import { fleetFormations } from '../naval-formations.js';
import { blockKit } from '../vehicle-structure.js';
import { shapeKit } from '../vehicle-shapes.js';
import { normalizeCombat, validateAircraft, partKit, partFamily } from '../aircombat-schema.js';
import { motionsForCharacter } from '../asset-organization.js';
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

export function validateAgentCombat(p, c) {
  keys(
    c,
    [
      'playerWingId',
      'playerSlot',
      'allyWings',
      'seaMapId',
      'ships',
      'fleets',
      'fireSounds',
      'dialogues',
      'schemaVersion',
      'aircraft',
      'enemyAircraft',
      'allyAircraft',
      'enemies',
      'allies',
      'altitude',
      'duration',
      'difficulty',
      'mission',
      'wind',
      'winActId',
      'loseActId',
      'allowSkip',
      'startOnGround',
    ],
    '空战配置',
  );
  for (const [key, lo, hi] of [
    ['enemies', 0, 8],
    ['allies', 0, 4],
    ['altitude', 150, 1800],
    ['duration', 30, 900],
    ['difficulty', 0.4, 1.5],
    ['wind', -15, 15],
  ])
    if (c[key] !== undefined) num(c[key], lo, hi, key);
  if (c.fireSounds !== undefined) {
    keys(
      c.fireSounds,
      Object.keys(partKit).filter((type) => ['gun', 'turret'].includes(partFamily(type))),
      '机炮音效',
    );
    for (const id of Object.values(c.fireSounds)) audio(p, id, 'effect');
  }
  for (const key of ['winActId', 'loseActId'])
    if (c[key] !== undefined) objectRef(p.acts, c[key], '剧情出口');
  if (c.startOnGround !== undefined) bool(c.startOnGround, 'startOnGround');
  if (c.allowSkip !== undefined) bool(c.allowSkip, 'allowSkip');
  if (
    c.mission !== undefined &&
    !['eliminate', 'survive', 'sinkShips', 'protectShips'].includes(c.mission)
  )
    throw Error('空战任务无效');
  for (const key of ['aircraft', 'enemyAircraft', 'allyAircraft'])
    if (c[key] !== undefined) {
      const a = c[key];
      if (a.fireSounds !== undefined) {
        keys(
          a.fireSounds,
          Object.keys(partKit).filter((type) => ['gun', 'turret'].includes(partFamily(type))),
          '载具机炮音效',
        );
        for (const id of Object.values(a.fireSounds)) audio(p, id, 'effect');
      }
      if (a.schemaVersion === 2) {
        keys(
          a,
          [
            'pilotBlockVersion',
            'schemaVersion',
            'vehicleType',
            'name',
            'gridSize',
            'blocks',
            'parts',
            'vehicleId',
            'fireSounds',
          ],
          '方块载具',
        );
        if (a.vehicleType !== 'aircraft' || ![0.125, 0.25, 0.5].includes(a.gridSize))
          throw Error('载具类型或网格无效');
        text(a.name, '载具名称', 80);
        array(a.blocks, 64000, '机体方块').forEach((b) => {
          keys(b, ['cell', 'kind', 'color', 'shape', 'shapeRotation'], '方块');
          if (!blockKit[b.kind] || (b.shape && !shapeKit[b.shape])) throw Error('方块或形状无效');
          if (
            !Array.isArray(b.cell) ||
            b.cell.length !== 3 ||
            b.cell.some((n, i) => !Number.isInteger(n) || n < (i === 0 ? 0 : -256) || n > 256)
          )
            throw Error('方块必须位于右半边网格');
          if (!/^#[\da-f]{6}$/i.test(b.color)) throw Error('方块颜色无效');
          if (
            b.shapeRotation &&
            (!Array.isArray(b.shapeRotation) ||
              b.shapeRotation.length !== 3 ||
              b.shapeRotation.some((n) => !Number.isFinite(n) || n % 90))
          )
            throw Error('形状角度必须为90度倍数');
        });
        array(a.parts, 64, '功能附件').forEach((p) => {
          keys(
            p,
            [
              'id',
              'type',
              'parentId',
              'socketId',
              'color',
              'scale',
              'powerHp',
              'offset',
              'rotation',
              'mirrorOf',
              'gearFoldDirection',
              'firepower',
              'firepowerId',
              'minYaw',
              'maxYaw',
              'minPitch',
              'maxPitch',
              'yawRate',
              'pitchRate',
              'traverseAcceleration',
              'ammoType',
              'fuze',
              'burstTime',
              'proximityRadius',
            ],
            '功能附件',
          );
          if (!partKit[p.type]) throw Error('附件类型无效');
          text(p.id, '附件ID', 100);
          if (!/^#[\da-f]{6}$/i.test(p.color)) throw Error('附件颜色无效');
          num(p.scale, 0.25, 2, '倍率');
          if (partFamily(p.type) === 'engine') num(p.powerHp, 50, 3000, '马力');
          for (const f of ['offset', 'rotation']) {
            if (!Array.isArray(p[f]) || p[f].length !== 3) throw Error('附件向量无效');
            p[f].forEach((n) => num(n, f === 'offset' ? -32 : -180, f === 'offset' ? 32 : 180, f));
          }
          if (
            p.gearFoldDirection &&
            !['forward', 'backward', 'inward', 'outward'].includes(p.gearFoldDirection)
          )
            throw Error('折叠方向无效');
        });
        if (new Set(a.parts.map((p) => p.id)).size !== a.parts.length) throw Error('附件ID重复');
        const errors = validateAircraft(a);
        if (errors.length) throw Error(errors.join('；'));
        continue;
      }
      keys(a, ['name', 'parts', 'vehicleId', 'fireSounds'], '飞机');
      text(a.name, '飞机名称', 80);
      array(a.parts, 48, '飞机组件').forEach((part) => {
        keys(
          part,
          [
            'id',
            'type',
            'parentId',
            'socketId',
            'color',
            'scale',
            'powerHp',
            'offset',
            'rotation',
            'firepower',
            'firepowerId',
            'minYaw',
            'maxYaw',
            'minPitch',
            'maxPitch',
            'yawRate',
            'pitchRate',
            'traverseAcceleration',
            'ammoType',
            'fuze',
            'burstTime',
            'proximityRadius',
          ],
          '飞机组件',
        );
        if (!partKit[part.type]) throw Error('飞机组件类型无效');
        text(part.id, '组件 ID', 100);
        if (!/^#[\da-f]{6}$/i.test(part.color)) throw Error('飞机颜色应为 #RRGGBB');
        num(part.scale, 0.6, 1.5, '尺寸');
        if (partFamily(part.type) === 'engine') num(part.powerHp, 50, 3000, '马力');
        for (const field of ['offset', 'rotation']) {
          if (!Array.isArray(part[field]) || part[field].length !== 3)
            throw Error('组件向量需要三个数');
          part[field].forEach((value) =>
            num(value, field === 'offset' ? -0.3 : -15, field === 'offset' ? 0.3 : 15, field),
          );
        }
      });
      if (new Set(a.parts.map((x) => x.id)).size !== a.parts.length)
        throw Error('飞机组件 ID 重复');
      const errors = validateAircraft(a);
      if (errors.length) throw Error(errors.join('；'));
    }
  if (c.fleets !== undefined) {
    keys(c.fleets, ['ally', 'enemy'], '舰队');
    for (const f of Object.values(c.fleets)) {
      keys(f, ['formation', 'spacing', 'x', 'z', 'heading', 'speed'], '舰队设置');
      if (f.formation !== undefined && !fleetFormations[f.formation]) throw Error('未知舰队阵型');
      for (const [k, lo, hi] of [
        ['spacing', 300, 2000],
        ['x', -30000, 30000],
        ['z', -30000, 30000],
        ['heading', -180, 180],
        ['speed', 0, 25],
      ])
        if (f[k] !== undefined) num(f[k], lo, hi, k);
    }
  }
  if (c.ships !== undefined)
    array(c.ships, 12, '舰船编组').forEach((r) => {
      keys(r, ['id', 'team', 'count', 'x', 'z', 'heading', 'blueprint'], '舰船编组');
      if (!['ally', 'enemy'].includes(r.team)) throw Error('舰船必须属于友军或敌军');
      num(r.count, 1, 16, '舰船数量');
      const v = r.blueprint;
      keys(
        v,
        [
          'schemaVersion',
          'pilotBlockVersion',
          'vehicleType',
          'shipClass',
          'gridSize',
          'name',
          'blocks',
          'parts',
          'fireSounds',
          'vehicleId',
          'cruiseSpeed',
        ],
        '战舰',
      );
      if (v.vehicleType !== 'warship') throw Error('需要战舰蓝图');
      array(v.blocks, 64000, '战舰方块');
      array(v.parts, 96, '战舰附件');
      for (const p of v.parts) if (!navalParts[p.type]) throw Error('未知舰船附件');
      for (const id of Object.values(v.fireSounds || {})) audio(p, id, 'effect');
      const normalized = normalizeWarship(v),
        errors = validateWarship(normalized);
      if (errors.length) throw Error(errors.join('；'));
    });
  if (c.dialogues !== undefined)
    array(c.dialogues, 200, '开战前对话').forEach((row) => {
      keys(row, ['id', 'characterId', 'speaker', 'text', 'voiceId', 'offstage'], '空战对话');
      objectRef(p.characters, row.characterId, '角色');
      text(row.text, '对话', 100000);
      if (row.voiceId) {
        ref(p, row.voiceId, ['voice'], '配音');
        if (p.assets.find((a) => a.id === row.voiceId).characterId !== row.characterId)
          throw Error('配音不属于当前角色');
      }
      if (row.offstage) {
        keys(row.offstage, ['motionId', 'motionOptions', 'expressionWeights'], '场外动作');
        ref(p, row.offstage.motionId, ['motion'], '动作');
        if (
          row.offstage.motionId &&
          !motionsForCharacter(p, row.characterId).some((a) => a.id === row.offstage.motionId)
        )
          throw Error('动作不属于当前角色');
        if (row.offstage.motionOptions) playback(row.offstage.motionOptions);
        if (row.offstage.expressionWeights) weights(row.offstage.expressionWeights);
      }
    });
  return normalizeCombat(c);
}

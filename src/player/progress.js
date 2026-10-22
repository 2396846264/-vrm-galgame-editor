import { isEvent } from '../events/schema.js';
import { chapterUnlocked } from '../chapters.js';

export function createPlayerProgress({
  project: getProject,
  mode: getMode,
  readSaveSlots,
  readLegacyFirstSlot,
  storage = globalThis.localStorage,
}) {
  const asset = (id) => getProject()?.assets.find((item) => item.id === id);
  let lifetimeProgress = null;
  const lifetimeKey = () => `vrm-lifetime-progress-${getProject().id || getProject().name}`;
  function loadLifetimeProgress() {
    if (lifetimeProgress) return lifetimeProgress;
    const fresh = {
      version: 2,
      viewedDialogueIds: [],
      viewedDialogueText: {},
      characterLineCounts: {},
      seenCharacterIds: [],
      seenImageIds: [],
      heardMusicIds: [],
      seenItemIds: [],
      enteredActIds: [],
      completedEventIds: [],
      lastActId: '',
    };
    try {
      const stored = JSON.parse(storage.getItem(lifetimeKey()) || 'null');
      if (stored && typeof stored === 'object') {
        for (const key of [
          'viewedDialogueIds',
          'seenCharacterIds',
          'seenImageIds',
          'heardMusicIds',
          'seenItemIds',
          'enteredActIds',
          'completedEventIds',
        ])
          if (Array.isArray(stored[key]))
            fresh[key] = [...new Set(stored[key].filter((id) => typeof id === 'string'))];
        if (stored.characterLineCounts && typeof stored.characterLineCounts === 'object')
          for (const [id, count] of Object.entries(stored.characterLineCounts))
            fresh.characterLineCounts[id] = Math.max(0, Number(count) || 0);
        if (stored.viewedDialogueText && typeof stored.viewedDialogueText === 'object')
          for (const [id, value] of Object.entries(stored.viewedDialogueText))
            if (typeof value === 'string') fresh.viewedDialogueText[id] = value;
        if (typeof stored.lastActId === 'string') fresh.lastActId = stored.lastActId;
      } else {
        // 旧版没有独立的鉴赏记录：尽量从已有存档补回已读对白和场景。
        for (const slot of [...readSaveSlots().filter(Boolean), readLegacyFirstSlot()].filter(
          Boolean,
        )) {
          const old = slotDialogueProgress(slot);
          for (const id of old.seen)
            if (!fresh.viewedDialogueIds.includes(id)) fresh.viewedDialogueIds.push(id);
          for (const [id, count] of Object.entries(old.counts))
            fresh.characterLineCounts[id] = Math.max(
              fresh.characterLineCounts[id] || 0,
              Number(count) || 0,
            );
          if (slot.backgroundId && !fresh.seenImageIds.includes(slot.backgroundId))
            fresh.seenImageIds.push(slot.backgroundId);
        }
        const seen = new Set(fresh.viewedDialogueIds);
        for (const act of getProject().acts)
          for (const line of act.steps)
            if (
              seen.has(line.id) &&
              line.characterId &&
              !fresh.seenCharacterIds.includes(line.characterId)
            )
              fresh.seenCharacterIds.push(line.characterId);
      }
      // v0.7.2 只记对白编号；首次升级时按当前工程补记文本，后续修改文本则需要重新阅读。
      const seen = new Set(fresh.viewedDialogueIds);
      for (const act of getProject().acts)
        for (const line of act.steps)
          if (line.id && seen.has(line.id) && fresh.viewedDialogueText[line.id] === undefined) {
            fresh.viewedDialogueText[line.id] = String(line.text || '');
            fresh.lastActId = act.id;
          }
    } catch {
      /* 损坏的记录从空白重建，不影响普通存档。 */
    }
    lifetimeProgress = fresh;
    storage.setItem(lifetimeKey(), JSON.stringify(fresh));
    return fresh;
  }
  function rememberDiscovery(type, id) {
    if (getMode() !== 'player' || !id) return;
    const progress = loadLifetimeProgress();
    const key = { character: 'seenCharacterIds', image: 'seenImageIds', music: 'heardMusicIds' }[
      type
    ];
    if (!key || progress[key].includes(id)) return;
    progress[key].push(id);
    storage.setItem(lifetimeKey(), JSON.stringify(progress));
  }
  const hasDiscovered = (type, id) =>
    getMode() !== 'player' ||
    Boolean(
      id &&
        loadLifetimeProgress()[
          { character: 'seenCharacterIds', image: 'seenImageIds', music: 'heardMusicIds' }[type]
        ]?.includes(id),
    );
  const maskSecret = (value) =>
    Array.from(String(value || ''))
      .map((char) => (/\s/u.test(char) ? char : 'X'))
      .join('');
  const hiddenName = (value) => {
    const chars = Array.from(String(value || ''));
    return chars.length ? `${chars[0]}${'X'.repeat(chars.length - 1)}` : 'X';
  };
  function storyRank(actIndex, stepIndex) {
    if (actIndex < 0 || stepIndex < 0) return -1;
    return (
      getProject()
        .acts.slice(0, actIndex)
        .reduce((total, item) => total + item.steps.length, 0) +
      stepIndex +
      1
    );
  }
  function slotLocation(slot) {
    const actIndex = slot.actId
      ? getProject().acts.findIndex((item) => item.id === slot.actId)
      : Number(slot.act);
    const stepIndex = slot.stepId
      ? getProject().acts[actIndex]?.steps.findIndex((item) => item.id === slot.stepId)
      : Number(slot.step);
    return { actIndex, stepIndex };
  }
  function legacyDialogueProgress(slot) {
    const { actIndex, stepIndex } = slotLocation(slot);
    const seen = [];
    const counts = {};
    if (
      !Number.isInteger(actIndex) ||
      !Number.isInteger(stepIndex) ||
      actIndex < 0 ||
      stepIndex < 0
    )
      return { seen, counts };
    for (let a = 0; a <= actIndex; a++) {
      if (isEvent(getProject().acts[a])) continue;
      for (const entry of getProject().acts[a]?.steps.slice(
        0,
        a === actIndex ? stepIndex + 1 : undefined,
      ) || []) {
        if (entry.id) seen.push(entry.id);
        if (entry.characterId) counts[entry.characterId] = (counts[entry.characterId] || 0) + 1;
      }
    }
    return { seen, counts };
  }
  function slotDialogueProgress(slot) {
    if (
      Array.isArray(slot.viewedDialogueIds) &&
      slot.characterLineCounts &&
      typeof slot.characterLineCounts === 'object'
    ) {
      return { seen: slot.viewedDialogueIds, counts: slot.characterLineCounts };
    }
    return legacyDialogueProgress(slot);
  }
  function progressStatistics() {
    const progress = loadLifetimeProgress();
    const exact = (line) =>
      Boolean(line.id && progress.viewedDialogueText[line.id] === String(line.text || ''));
    const lines = getProject()
      .acts.filter((item) => !isEvent(item))
      .flatMap((item) => item.steps.filter((line) => String(line.text || '').trim()));
    const seen = lines.filter(exact).length;
    const characters = getProject().characters.map((character) => {
      const own = lines.filter((line) => line.characterId === character.id);
      return {
        id: character.id,
        name: hasDiscovered('character', character.id)
          ? character.name
          : hiddenName(character.name),
        total: own.length,
        seen: own.filter(exact).length,
      };
    });
    let chapterNumber = 0;
    const acts = getProject().acts.flatMap((item, nodeIndex) => {
      if (isEvent(item)) return [];
      const index = chapterNumber++;
      const own = item.steps.filter((line) => String(line.text || '').trim());
      const read = own.filter(exact).length;
      const status =
        own.length && read === own.length
          ? 'complete'
          : own.length && read > 0 && progress.lastActId === item.id
            ? 'current'
            : 'pending';
      return [
        {
          index: index + 1,
          nodeIndex,
          name: item.name,
          total: own.length,
          seen: read,
          status,
          unlocked: chapterUnlocked(item, index, progress),
          cover: asset(item.coverImageId) || asset(item.backgroundId),
        },
      ];
    });
    return { total: lines.length, seen, characters, acts };
  }
  return {
    lifetimeKey,
    loadLifetimeProgress,
    rememberDiscovery,
    hasDiscovered,
    maskSecret,
    hiddenName,
    storyRank,
    slotLocation,
    legacyDialogueProgress,
    slotDialogueProgress,
    progressStatistics,
    get cache() {
      return lifetimeProgress;
    },
    set cache(value) {
      lifetimeProgress = value;
    },
  };
}

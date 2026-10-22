// Owns save-slot keys, storage and legacy migration. No DOM or editor state.
export function createPlayerSaves({ project: getProject, storage = globalThis.localStorage }) {
  const character = (id) => getProject().characters.find((role) => role.id === id);
  const saveKey = () => `vrm-save-slots-${getProject().id || getProject().name}`;

  const legacySlotKey = () => `${saveKey()}-legacy-slot-1`;

  function readLegacyFirstSlot() {
    try {
      return JSON.parse(storage.getItem(legacySlotKey()) || 'null');
    } catch {
      return null;
    }
  }

  function readSaveSlots() {
    const slots = Array(20).fill(null);
    try {
      const stored = JSON.parse(storage.getItem(saveKey()) || 'null');
      if (Array.isArray(stored)) {
        stored.slice(0, 20).forEach((item, index) => {
          slots[index] = item || null;
        });
        if (slots[0] && !slots[0].auto) {
          const free = slots.findIndex((item, index) => index > 0 && !item);
          if (free > 0) slots[free] = slots[0];
          else storage.setItem(legacySlotKey(), JSON.stringify(slots[0]));
          slots[0] = null;
          storage.setItem(saveKey(), JSON.stringify(slots));
        }
        return slots;
      }
      // Preserve progress created by the earlier one-slot version.
      const old = JSON.parse(
        storage.getItem(`vrm-save-${getProject().id || getProject().name}`) || 'null',
      );
      if (old && Number.isInteger(old.act) && Number.isInteger(old.step)) {
        const oldAct = getProject().acts[old.act];
        const oldStep = oldAct?.steps[old.step];
        if (oldStep)
          slots[1] = {
            act: old.act,
            step: old.step,
            actId: oldAct.id,
            stepId: oldStep.id,
            actName: oldAct.name,
            text: oldStep.text,
            speaker: oldStep.speaker || character(oldStep.characterId)?.name || '旁白',
            backgroundId: oldAct.backgroundId,
            savedAt: null,
          };
        storage.setItem(saveKey(), JSON.stringify(slots));
      }
    } catch {
      /* Ignore broken old save data; the slots remain usable. */
    }
    return slots;
  }

  return {
    key: saveKey,
    legacyKey: legacySlotKey,
    readLegacy: readLegacyFirstSlot,
    read: readSaveSlots,
  };
}

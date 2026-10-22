import { canGeneratePortrait } from '../portrait-policy.js';
import { autoPortraitFolderId } from './portrait-assets.js';
export function createPortraitJobs({
  project: getProject,
  mode: getMode,
  asset,
  capture,
  bridge,
  history,
  replace,
  markDirty,
  changed,
  display,
  toast,
}) {
  const jobs = new Map(),
    temporary = new Map();
  async function ensureCharacterPortrait(item, force = false, userCapture = false) {
    const modelAsset = asset(item?.modelId);
    if (
      !canGeneratePortrait(
        item,
        modelAsset?.type,
        Boolean(asset(item?.portraitId)),
        force,
        userCapture,
      )
    )
      return;
    const motionId = item.galleryMotionId || '';
    const motionAsset = asset(motionId);
    const poseFrame = Math.max(1, Math.floor(Number(item.galleryPoseFrame) || 1));
    const legacySeconds = Number.isFinite(Number(item.galleryPoseTime))
      ? Number(item.galleryPoseTime)
      : null;
    const jobKey = `${getProject().id}:${item.id}:${item.modelId}:${motionId}:${poseFrame}`;
    if (jobs.has(jobKey)) return jobs.get(jobKey);
    const modelId = item.modelId;
    const portraitAtStart = item.portraitId,
      sourceAtStart = item.portraitSource;
    const task = (async () => {
      const { dataUrl, frame } = await capture(modelAsset, motionAsset, poseFrame, legacySeconds);
      if (
        getProject().characters.find((entry) => entry.id === item.id) !== item ||
        item.modelId !== modelId ||
        item.galleryMotionId !== motionId ||
        !(
          Number(item.galleryPoseFrame) === poseFrame ||
          (legacySeconds !== null && Number(item.galleryPoseFrame) === frame)
        ) ||
        item.portraitId !== portraitAtStart ||
        item.portraitSource !== sourceAtStart ||
        (!force && asset(item.portraitId))
      )
        return;
      item.galleryPoseFrame = frame;
      delete item.galleryPoseTime;
      if (getMode() === 'player') temporary.set(item.id, dataUrl);
      else {
        const saved = await bridge('saveGeneratedPortrait', {
          dataUrl,
          characterId: item.id,
          name: item.name,
          previousRevision: asset(item.portraitId)?.revision || '',
        });
        if (
          getProject().characters.find((entry) => entry.id === item.id) !== item ||
          item.modelId !== modelId ||
          item.galleryMotionId !== motionId ||
          Number(item.galleryPoseFrame) !== frame ||
          item.portraitId !== portraitAtStart ||
          item.portraitSource !== sourceAtStart ||
          (!force && asset(item.portraitId))
        )
          return;
        await replace(item, saved, true);
        item.portraitSource = 'auto';
        item.portraitPoseKey = `portrait-v3:${item.modelId}:${motionId}:${frame}`;
        if (!userCapture)
          history.amend((value) => {
            const target = value.characters.find((character) => character.id === item.id);
            if (
              !target ||
              target.portraitSource === 'manual' ||
              target.modelId !== item.modelId ||
              (target.galleryMotionId || '') !== motionId ||
              Number(target.galleryPoseFrame) !== frame ||
              target.portraitPoseKey === item.portraitPoseKey
            )
              return false;
            Object.assign(target, {
              portraitId: saved.id,
              portraitSource: 'auto',
              portraitPoseKey: item.portraitPoseKey,
            });
            const existing = value.assets.find((asset) => asset.id === saved.id);
            if (existing) Object.assign(existing, saved);
            else value.assets.push(structuredClone(saved));
            if (!value.assetFolders.some((folder) => folder.id === autoPortraitFolderId))
              value.assetFolders.push({
                id: autoPortraitFolderId,
                name: '自动角色头像',
                type: 'image',
              });
            return true;
          });
        markDirty(userCapture ? { label: '重新拍摄头像' } : { derived: true });
        changed(item);
      }
      display(item.id);
    })()
      .catch((error) => toast(`头像生成失败：${error.message}`, true))
      .finally(() => jobs.delete(jobKey));
    jobs.set(jobKey, task);
    return task;
  }
  return { jobs, temporary, ensure: ensureCharacterPortrait };
}

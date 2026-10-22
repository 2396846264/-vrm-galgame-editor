export const autoPortraitFolderId = 'auto-character-portraits';
export function createPortraitAssets({ project: getProject, markDirty, changed }) {
  const pendingDeletes = new Set();
  const asset = (id) => getProject()?.assets.find((item) => item.id === id);
  function assetIsReferenced(id) {
    const scan = (value) =>
      typeof value === 'string'
        ? value === id
        : value && typeof value === 'object'
          ? Object.values(value).some(scan)
          : false;
    return scan({ ...getProject(), assets: undefined, assetFolders: undefined });
  }
  async function removeUnusedAutoPortraits(deferHistory = false) {
    for (const old of [...getProject().assets]) {
      if (
        old.type !== 'image' ||
        !(old.generatedPortrait || old.name === '自动头像.png') ||
        assetIsReferenced(old.id)
      )
        continue;
      // Another asset can still use the same physical file.
      if (!getProject().assets.some((other) => other.id !== old.id && other.path === old.path))
        pendingDeletes.add(old.path);
      getProject().assets = getProject().assets.filter((other) => other !== old);
      markDirty(deferHistory ? { skipHistory: true } : { derived: true });
    }
  }
  async function replaceAutoPortrait(item, saved, deferHistory = false) {
    if (!getProject().assetFolders.some((folder) => folder.id === autoPortraitFolderId))
      getProject().assetFolders.push({
        id: autoPortraitFolderId,
        name: '自动角色头像',
        type: 'image',
      });
    saved.galleryImage = false;
    saved.folderId = autoPortraitFolderId;
    saved.internalPortrait = true;
    const existing = asset(saved.id);
    if (existing) Object.assign(existing, saved);
    else getProject().assets.push(saved);
    item.portraitId = saved.id;
    item.portraitSource = 'auto';
    markDirty(deferHistory ? { skipHistory: true } : { derived: true });
    await removeUnusedAutoPortraits(deferHistory);
    changed();
  }
  return {
    pendingDeletes,
    isReferenced: assetIsReferenced,
    removeUnused: removeUnusedAutoPortraits,
    replace: replaceAutoPortrait,
  };
}

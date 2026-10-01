export const voiceFolderId = characterId => `character-voice-${characterId}`;
export const dialogueLines = project => (project.acts || []).filter(act => act.kind !== 'event')
  .flatMap(act => (act.steps || []).map(line => ({ act, line })));
function collectStrings(value, result = new Set()) {
  if (typeof value === 'string') result.add(value);
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collectStrings(item, result));
  return result;
}
function legacyCharacter(project, line) {
  const name = line.speaker || '旁白';
  let character = project.characters.find(item => item.legacyVoiceCharacter && item.name === name);
  if (!character) {
    character = { id: crypto.randomUUID().replaceAll('-', ''), name, legacyVoiceCharacter: true, modelId: '', portraitId: '',
      title: '', description: '', galleryMotionId: '', galleryPoseFrame: 1, galleryYaw: 0,
      stories: Array.from({ length: 3 }, () => ({ text: '', unlockLines: 0 })) };
    project.characters.push(character);
  }
  line.characterId = character.id;
  return character;
}
// Every voice belongs to a character folder. This runs in the same edit as a
// rename/create/change, so undo restores the dialogue, folder and voice together.
export function syncDialogueVoices(project, { migrateLegacy = false } = {}) {
  project.assetFolders ||= []; project.assets ||= []; project.characters ||= [];
  const lines = dialogueLines(project), migrated = new Set(), originalAssets = new Map(project.assets.map(item => [item.id, item]));
  if (migrateLegacy) for (const { line } of lines) {
    const old = originalAssets.get(line.voiceId);
    if (old?.type !== 'audio') continue;
    const role = project.characters.find(item => item.id === line.characterId) || legacyCharacter(project, line);
    line.id ||= crypto.randomUUID().replaceAll('-', '');
    const id = `legacy-voice-${line.id}`;
    if (!project.assets.some(item => item.id === id)) project.assets.push({ ...old, id, type: 'voice', name: line.text || '（空白对白）',
      originalName: old.name, characterId: role.id, dialogueId: line.id, folderId: voiceFolderId(role.id), galleryMusic: false });
    line.voiceId = id; migrated.add(old.id);
  }
  if (migrateLegacy) {
    const referenced = collectStrings({ ...project, assets: undefined, assetFolders: undefined });
    project.assets = project.assets.filter(item => !migrated.has(item.id) || referenced.has(item.id));
  }
  for (const role of project.characters) {
    let folder = project.assetFolders.find(item => item.id === voiceFolderId(role.id));
    if (!folder) { folder = { id: voiceFolderId(role.id) }; project.assetFolders.push(folder); }
    Object.assign(folder, { type: 'voice', name: role.name, characterId: role.id, locked: true, characterDeleted: false });
  }
  for (const folder of project.assetFolders.filter(item => item.type === 'voice')) {
    folder.locked = true;
    folder.characterDeleted = !project.characters.some(role => role.id === folder.characterId);
  }
  const owners = new Map(lines.map(({ line }) => [line.id, line]));
  for (const item of project.assets.filter(item => item.type === 'voice')) {
    const owner = owners.get(item.dialogueId);
    if (!item.characterId) item.characterId = owner?.characterId;
    if (!item.characterId && migrateLegacy) item.characterId = legacyCharacter(project, owner || {}).id;
    if (!item.characterId) continue;
    item.folderId = voiceFolderId(item.characterId); item.galleryMusic = false;
    if (!project.assetFolders.some(folder => folder.id === item.folderId)) project.assetFolders.push({
      id: item.folderId, type: 'voice', name: project.characters.find(role => role.id === item.characterId)?.name || '旧配音角色',
      characterId: item.characterId, locked: true, characterDeleted: !project.characters.some(role => role.id === item.characterId) });
    if (owner?.characterId === item.characterId) item.name = owner.text || '（空白对白）';
  }
  const assets = new Map(project.assets.map(item => [item.id, item])), roles = new Set(project.characters.map(role => role.id));
  for (const { line } of lines) {
    if (!line.voiceId) continue;
    const voice = assets.get(line.voiceId);
    if (voice?.type !== 'voice' || voice.characterId !== line.characterId || !roles.has(line.characterId)) line.voiceId = '';
  }
}
export function voicesForCharacter(project, characterId) {
  return project.characters.some(role => role.id === characterId)
    ? project.assets.filter(item => item.type === 'voice' && item.characterId === characterId && item.folderId === voiceFolderId(characterId)) : [];
}
export function clearVoiceReferences(project, id) {
  for (const { line } of dialogueLines(project)) if (line.voiceId === id) line.voiceId = '';
}

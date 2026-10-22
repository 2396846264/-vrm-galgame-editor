import { clearVoiceReferences } from '../../dialogue-voices.js';

export function assetRemovalBlock(project, id) {
  if (project.characters.some((character) => character.props?.some((prop) => prop.assetId === id)))
    return '这个模型已绑定为角色物品，请先到角色页移除绑定。';
  if (
    project.environments?.some((environment) =>
      environment.nodes.some((node) => node.assetId === id),
    )
  )
    return '这个素材正在 3D 场景里使用，请先从场景中移除对应物体。';
  return '';
}

export function assetUsedByDocument(project, id) {
  return JSON.stringify({ ...project, assets: [] }).includes(JSON.stringify(id));
}

export function removeAsset(project, item, afterReferences = () => {}) {
  // Retain physical files for undo. Saved/exported archives select only assets
  // in the current document. Controllers stop any active voice preview first.
  if (item.type === 'voice') clearVoiceReferences(project, item.id);
  afterReferences();
  project.assets = project.assets.filter((entry) => entry.id !== item.id);
}

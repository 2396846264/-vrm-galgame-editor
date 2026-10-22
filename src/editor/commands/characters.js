import { defaultNameColor } from '../../character-name-color.js';

export function addCharacter(project, uid) {
  const character = {
    id: uid(),
    name: `角色${project.characters.length + 1}`,
    nameColor: defaultNameColor,
    autoMouth: true,
    modelId: '',
    portraitId: '',
    title: '',
    description: '',
    galleryMotionId: project.assets.some((item) => item.id === 'preset-mixamo-029')
      ? 'preset-mixamo-029'
      : '',
    galleryYaw: 0,
    galleryPoseFrame: 1,
    stories: Array.from({ length: 3 }, () => ({ text: '', unlockLines: 0 })),
  };
  project.characters.push(character);
  return character;
}

export function removeCharacter(project, index) {
  const deletedId = project.characters[index].id;
  for (const act of project.acts)
    for (const line of act.steps) {
      if (line.characterId === deletedId) line.characterId = '';
      for (const value of Object.values(line.cast || {}))
        if (value.characterId === deletedId) {
          value.characterId = '';
          value.props = [];
        }
    }
  return project.characters.splice(index, 1)[0];
}

export function addCharacterProp(character, model, uid) {
  const prop = {
    id: uid(),
    name: model.name,
    assetId: model.id,
    bone: 'rightHand',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
  character.props ||= [];
  character.props.push(prop);
  return prop;
}

export function removeCharacterProp(project, character, id) {
  character.props = (character.props || []).filter((prop) => prop.id !== id);
  for (const act of project.acts)
    for (const line of act.steps)
      for (const value of Object.values(line.cast || {}))
        value.props = (value.props || []).filter((propId) => propId !== id);
}

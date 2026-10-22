import { normalizeWeather } from '../../weather.js';
import { createNextDialogue } from '../../dialogue-new.js';

// Commands mutate document data only. Confirmation, selection and history belong
// to the calling controller; event dialogue continues through its own controller.
export function addAct(project, uid) {
  const act = {
    id: uid(),
    name: `第${project.acts.length + 1}幕`,
    backgroundId: '',
    bgmId: '',
    weather: normalizeWeather(),
    coverImageId: '',
    steps: [],
  };
  project.acts.push(act);
  return act;
}

export function removeAct(project, index) {
  return project.acts.splice(index, 1)[0];
}

// The existing context-menu path clears these references. The toolbar path
// intentionally keeps its existing behavior; migration must not change policy.
export function clearActReferences(project, id) {
  for (const chapter of project.acts)
    for (const line of chapter.steps || [])
      for (const choice of line.choices || []) if (choice.actId === id) choice.actId = '';
  for (const book of project.knowledgeBooks || [])
    if (book.unlockActId === id) book.unlockActId = '';
}

export function addDialogue(act, uid) {
  const line = createNextDialogue(act.steps.at(-1), uid());
  act.steps.push(line);
  return line;
}

export function duplicateDialogue(act, index, uid) {
  const copy = structuredClone(act.steps[index]);
  copy.id = uid();
  act.steps.splice(index + 1, 0, copy);
  return copy;
}

export function removeDialogue(act, index) {
  return act.steps.splice(index, 1)[0];
}

export function swapDialogue(act, source, target) {
  [act.steps[source], act.steps[target]] = [act.steps[target], act.steps[source]];
}

export function reorderStoryRows(items, source, target, after) {
  if (!items || source < 0 || target < 0 || source >= items.length || target >= items.length)
    return false;
  let insertion = target + (after ? 1 : 0);
  if (source < insertion) insertion--;
  if (source === insertion) return false;
  const [moved] = items.splice(source, 1);
  items.splice(insertion, 0, moved);
  return true;
}

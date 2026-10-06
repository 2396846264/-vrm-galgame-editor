import {normalizeRender,mergeRender,colorAdjustments} from './render-style.js';
export const colorDefaults = colorAdjustments;
export function chapterRender(chapter, inherited = {}) {
  return mergeRender(inherited,chapter?.render);
}
export function dialogueRender(chapter,line,inherited={}){return mergeRender(chapterRender(chapter,inherited),line?.render);}
export function colorFilter(settings = {}) {
  const value = { ...colorDefaults, ...settings };
  const clamp = (n, low, high) => Math.max(low, Math.min(high, Number(n) || 0));
  return {
    filter: `brightness(${clamp(value.brightness, 0, 200)}%) contrast(${clamp(value.contrast, 0, 200)}%) saturate(${clamp(value.saturation, 0, 200)}%)`,
    matrix: '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0'
  };
}
export function chapterUnlocked(chapter, index, progress) {
  return index === 0 || progress.enteredActIds?.includes(chapter.id) ||
    chapter.steps.some(line => progress.viewedDialogueIds?.includes(line.id));
}

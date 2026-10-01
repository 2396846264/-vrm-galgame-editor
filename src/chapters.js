export const colorDefaults = { brightness: 100, contrast: 100, saturation: 100, temperature: 0, hue: 0 };
export function chapterRender(chapter, inherited = {}) {
  return { ...inherited, ...colorDefaults, ...chapter?.render };
}
export function colorFilter(settings = {}) {
  const value = { ...colorDefaults, ...settings };
  const clamp = (n, low, high) => Math.max(low, Math.min(high, Number(n) || 0));
  const warmth = clamp(value.temperature, -100, 100) / 100;
  return {
    filter: `brightness(${clamp(value.brightness, 0, 200)}%) contrast(${clamp(value.contrast, 0, 200)}%) saturate(${clamp(value.saturation, 0, 200)}%) hue-rotate(${clamp(value.hue, -180, 180)}deg)${warmth ? ' url(#scene-temperature)' : ''}`,
    matrix: `${1 + warmth * .22} 0 0 0 0  0 1 0 0 0  0 0 ${1 - warmth * .22} 0 0  0 0 0 1 0`
  };
}
export function chapterUnlocked(chapter, index, progress) {
  return index === 0 || progress.enteredActIds?.includes(chapter.id) ||
    chapter.steps.some(line => progress.viewedDialogueIds?.includes(line.id));
}
